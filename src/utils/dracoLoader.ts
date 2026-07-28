import { DRACOLoader, GLTFLoader, type GLTF } from "three/examples/jsm/Addons.js";

type DecoderResponseType = "arraybuffer" | "text";
type DecoderAsset = ArrayBuffer | string;

type DracoLoaderInternals = DRACOLoader & {
  _loadLibrary: (
    fileName: string,
    responseType: DecoderResponseType,
  ) => Promise<DecoderAsset>;
};

const decoderAssets = new Map<string, Promise<DecoderAsset>>();
const sharedLoaders = new Map<string, DRACOLoader>();
const ASSET_RETRY_DELAYS_MS = [0, 450, 1_200, 2_500] as const;

function wait(delayMs: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
}

async function fetchAssetWithRetry(
  url: string,
  responseType: DecoderResponseType,
  init: RequestInit = {},
): Promise<DecoderAsset> {
  let lastError: unknown = new Error(`No se pudo cargar ${url}`);

  for (let attempt = 0; attempt < ASSET_RETRY_DELAYS_MS.length; attempt += 1) {
    const delayMs = ASSET_RETRY_DELAYS_MS[attempt];
    if (delayMs > 0) await wait(delayMs);

    try {
      const response = await fetch(url, {
        cache: attempt === 0 ? "force-cache" : "reload",
        credentials: "same-origin",
        ...init,
      });
      if (!response.ok) {
        throw new Error(`No se pudo cargar ${url}: HTTP ${response.status}`);
      }

      return responseType === "arraybuffer"
        ? response.arrayBuffer()
        : response.text();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function fetchDecoderAsset(url: string, responseType: DecoderResponseType) {
  const cacheKey = `${responseType}:${url}`;
  const cached = decoderAssets.get(cacheKey);
  if (cached) return cached;

  const pending = fetchAssetWithRetry(url, responseType)
    .catch((error) => {
      decoderAssets.delete(cacheKey);
      throw error;
    });

  decoderAssets.set(cacheKey, pending);
  return pending;
}

function resolveDecoderPath(baseUrl: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(`${normalizedBase}draco/`, window.location.href).toString();
}

/**
 * Comparte una única instancia de Draco y serializa sus dos assets WASM.
 *
 * DRACOLoader solicita el wrapper JS y el binario WASM en paralelo. El
 * ESP8266 puede servir cualquiera de los dos por separado, pero bajo esas dos
 * descargas simultáneas deja una respuesta a medio enviar. El hook interno
 * conserva el contrato de Three.js, cargando primero el WASM y luego el
 * wrapper, y reutiliza ambos resultados para todos los visores 3D.
 */
export function getSharedDracoLoader(baseUrl: string) {
  const decoderPath = resolveDecoderPath(baseUrl);
  const cached = sharedLoaders.get(decoderPath);
  if (cached) return cached;

  const loader = new DRACOLoader();
  loader.setDecoderPath(decoderPath);
  loader.setDecoderConfig({ type: "wasm" });

  const internals = loader as DracoLoaderInternals;
  const wasmUrl = new URL("draco_decoder.wasm", decoderPath).toString();
  const wrapperUrl = new URL("draco_wasm_wrapper.js", decoderPath).toString();
  const loadWasm = () => fetchDecoderAsset(wasmUrl, "arraybuffer");

  internals._loadLibrary = (fileName, responseType) => {
    if (fileName === "draco_decoder.wasm") {
      return loadWasm();
    }

    if (fileName === "draco_wasm_wrapper.js") {
      return loadWasm().then(() => fetchDecoderAsset(wrapperUrl, "text"));
    }

    return fetchDecoderAsset(
      new URL(fileName, decoderPath).toString(),
      responseType,
    );
  };

  sharedLoaders.set(decoderPath, loader);
  return loader;
}

/**
 * GLTFLoader tolerante a cortes breves del HTTP embebido.
 *
 * El ESP8266 puede cerrar una descarga grande mientras conserva o recupera el
 * WebSocket. El loader normal deja ese rechazo cacheado por React Three Fiber;
 * esta variante reintenta el GLB completo antes de entregar un error al Canvas.
 */
export class ResilientGLTFLoader extends GLTFLoader {
  override load(
    url: string,
    onLoad: (data: GLTF) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const requestUrl = this.manager.resolveURL(`${this.path || ""}${url}`);
    const absoluteUrl = new URL(requestUrl, window.location.href).toString();
    const resourcePath = this.resourcePath || new URL(".", absoluteUrl).toString();

    this.manager.itemStart(absoluteUrl);
    void fetchAssetWithRetry(absoluteUrl, "arraybuffer", {
      headers: this.requestHeader,
      credentials: this.withCredentials ? "include" : "same-origin",
    })
      .then((asset) => {
        const data = asset as ArrayBuffer;
        onProgress?.(new ProgressEvent("load", {
          lengthComputable: true,
          loaded: data.byteLength,
          total: data.byteLength,
        }));
        this.parse(
          data,
          resourcePath,
          (gltf) => {
            onLoad(gltf);
            this.manager.itemEnd(absoluteUrl);
          },
          (error) => {
            onError?.(error);
            this.manager.itemError(absoluteUrl);
            this.manager.itemEnd(absoluteUrl);
          },
        );
      })
      .catch((error) => {
        onError?.(error);
        this.manager.itemError(absoluteUrl);
        this.manager.itemEnd(absoluteUrl);
      });
  }
}
