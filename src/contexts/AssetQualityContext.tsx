import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLoader } from "@react-three/fiber";
import { toast } from "sonner";
import {
  checkInternetAccess,
  resolvePreferredModelUrl,
  type InternetStatus,
} from "../utils/assetQuality";
import { getSharedDracoLoader, ResilientGLTFLoader } from "../utils/dracoLoader";

const HD_ASSETS_STORAGE_KEY = "web-esp01-use-hd-assets-v1";
const INTERNET_RECHECK_INTERVAL_MS = 30_000;
const DEFAULT_INTERNET_PROBE_URL = "https://www.gstatic.com/generate_204";

interface AssetQualityContextValue {
  internetStatus: InternetStatus;
  internetAvailable: boolean;
  hdAssetsEnabled: boolean;
  hdAssetsActive: boolean;
  hdModelUrl: string | null;
  setHdAssetsEnabled: (enabled: boolean) => void;
  refreshInternetStatus: () => void;
  resolveModelUrl: (localUrl: string) => string;
}

const AssetQualityContext = createContext<AssetQualityContextValue | null>(null);

function readStoredHdPreference() {
  try {
    return window.localStorage.getItem(HD_ASSETS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function readOptionalUrl(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function AssetQualityProvider({ children }: { children: ReactNode }) {
  const probeUrl =
    readOptionalUrl(import.meta.env.VITE_INTERNET_PROBE_URL) ??
    DEFAULT_INTERNET_PROBE_URL;
  const hdModelUrl = readOptionalUrl(import.meta.env.VITE_HD_MODEL_URL);
  const [internetStatus, setInternetStatus] = useState<InternetStatus>(() =>
    window.navigator.onLine === false ? "offline" : "checking",
  );
  const [hdAssetsEnabledState, setHdAssetsEnabledState] = useState(
    readStoredHdPreference,
  );
  const probeSequenceRef = useRef(0);

  const runInternetProbe = useCallback(
    async (showCheckingState: boolean) => {
      const sequence = probeSequenceRef.current + 1;
      probeSequenceRef.current = sequence;

      if (window.navigator.onLine === false) {
        setInternetStatus("offline");
        return;
      }

      if (showCheckingState) {
        setInternetStatus("checking");
      }

      const online = await checkInternetAccess({
        networkOnline: window.navigator.onLine,
        probeUrl,
      });

      if (probeSequenceRef.current === sequence) {
        setInternetStatus(online ? "online" : "offline");
      }
    },
    [probeUrl],
  );

  const refreshInternetStatus = useCallback(() => {
    void runInternetProbe(true);
  }, [runInternetProbe]);

  useEffect(() => {
    void runInternetProbe(true);

    const handleOnline = () => {
      void runInternetProbe(true);
    };
    const handleOffline = () => {
      probeSequenceRef.current += 1;
      setInternetStatus("offline");
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runInternetProbe(false);
      }
    };
    const intervalId = window.setInterval(() => {
      void runInternetProbe(false);
    }, INTERNET_RECHECK_INTERVAL_MS);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      probeSequenceRef.current += 1;
      window.clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [runInternetProbe]);

  const downloadedUrlRef = useRef<string | null>(null);
  const downloadingRef = useRef(false);

  const downloadHdModel = useCallback((url: string, showToasts: boolean = true) => {
    if (downloadedUrlRef.current === url || downloadingRef.current) return;
    downloadingRef.current = true;

    if (showToasts) {
      toast.loading("Descargando modelo 3D HD desde GitHub...", {
        id: "hd-asset-download",
      });
    }

    fetch(url, { cache: "force-cache" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await res.arrayBuffer();
        downloadedUrlRef.current = url;
        downloadingRef.current = false;
        try {
          useLoader.preload(ResilientGLTFLoader, url, (loader) => {
            const base = import.meta.env.BASE_URL || "/";
            loader.setDRACOLoader(getSharedDracoLoader(base));
          });
        } catch {
          // Preload context fallback
        }
        if (showToasts) {
          toast.success("¡Modelo 3D HD descargado con éxito desde GitHub!", {
            id: "hd-asset-download",
          });
        }
      })
      .catch((err) => {
        downloadingRef.current = false;
        console.warn("Fallo descarga del modelo HD:", err);
        if (showToasts) {
          toast.error("No se pudo descargar el modelo HD. Usando modelo estándar.", {
            id: "hd-asset-download",
          });
        }
      });
  }, []);

  const setHdAssetsEnabled = useCallback((enabled: boolean) => {
    setHdAssetsEnabledState(enabled);
    try {
      window.localStorage.setItem(HD_ASSETS_STORAGE_KEY, String(enabled));
    } catch {
      // La preferencia sigue activa durante esta sesión si storage no está disponible.
    }
    if (enabled && hdModelUrl && internetStatus === "online") {
      downloadHdModel(hdModelUrl, true);
    }
  }, [downloadHdModel, hdModelUrl, internetStatus]);

  useEffect(() => {
    if (internetStatus === "online" && hdAssetsEnabledState && hdModelUrl) {
      downloadHdModel(hdModelUrl, false);
    }
  }, [downloadHdModel, hdAssetsEnabledState, hdModelUrl, internetStatus]);

  const internetAvailable = internetStatus === "online";
  const hdAssetsActive =
    internetAvailable && hdAssetsEnabledState && hdModelUrl !== null;

  const value = useMemo<AssetQualityContextValue>(
    () => ({
      internetStatus,
      internetAvailable,
      hdAssetsEnabled: hdAssetsEnabledState,
      hdAssetsActive,
      hdModelUrl,
      setHdAssetsEnabled,
      refreshInternetStatus,
      resolveModelUrl: (localUrl: string) =>
        resolvePreferredModelUrl({
          localUrl,
          hdUrl: hdModelUrl,
          hdAssetsEnabled: hdAssetsEnabledState,
          internetStatus,
        }),
    }),
    [
      hdAssetsActive,
      hdAssetsEnabledState,
      hdModelUrl,
      internetAvailable,
      internetStatus,
      refreshInternetStatus,
      setHdAssetsEnabled,
    ],
  );

  return (
    <AssetQualityContext.Provider value={value}>
      {children}
    </AssetQualityContext.Provider>
  );
}

export function useAssetQuality() {
  const context = useContext(AssetQualityContext);
  if (!context) {
    throw new Error("useAssetQuality debe usarse dentro de AssetQualityProvider");
  }
  return context;
}

export function usePreferredModelUrl(localUrl: string) {
  return useAssetQuality().resolveModelUrl(localUrl);
}
