import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

type DecoderResponseType = "arraybuffer" | "text";
type DecoderAsset = ArrayBuffer | string;

type DracoLoaderInternals = DRACOLoader & {
  _loadLibrary: (
    fileName: string,
    responseType: DecoderResponseType,
  ) => Promise<DecoderAsset>;
};

const decoderAssets = new Map<string, Promise<DecoderAsset>>();
let sharedLoader: DRACOLoader | null = null;
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
        ? await response.arrayBuffer()
        : await response.text();
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

/**
 * Comparte Draco entre los canvas usando los archivos locales de public/draco.
 * Carga el WASM antes del wrapper para evitar dos descargas simultaneas desde
 * el ESP. Los fallos de lectura del cuerpo tambien participan en el reintento.
 */
export function getSharedDracoLoader() {
  if (sharedLoader) return sharedLoader;

  const loader = new DRACOLoader();
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const decoderPath = new URL(`${normalizedBase}draco/`, window.location.href).toString();
  loader.setDecoderPath(decoderPath);
  loader.setDecoderConfig({ type: "wasm" });

  const internals = loader as DracoLoaderInternals;

  const loadWasm = () => fetchDecoderAsset(
    new URL("draco_decoder.wasm", decoderPath).toString(), "arraybuffer",
  );
  internals._loadLibrary = (fileName, responseType) => {
    if (fileName === "draco_decoder.wasm") {
      return loadWasm();
    }

    if (fileName === "draco_wasm_wrapper.js") {
      return loadWasm().then(() => fetchDecoderAsset(
        new URL(fileName, decoderPath).toString(), "text",
      ));
    }

    return fetchDecoderAsset(new URL(fileName, decoderPath).toString(), responseType);
  };

  sharedLoader = loader;
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
    // Una URL data/blob no tiene un directorio relativo. El GLB local incluye
    // sus buffers e imagenes; los modelos HTTP conservan su directorio normal.
    const resourceBaseUrl = /^(data|blob):/.test(absoluteUrl)
      ? window.location.href
      : absoluteUrl;
    const resourcePath = this.resourcePath || new URL(".", resourceBaseUrl).toString();

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
