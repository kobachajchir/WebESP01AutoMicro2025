import { useCallback, useState } from "react";

const loadedModelUrls = new Set<string>();

export function useModelLoadingState(modelUrl: string) {
  const [loadedModelUrl, setLoadedModelUrl] = useState<string | null>(null);

  const isModelLoading =
    !loadedModelUrls.has(modelUrl) && loadedModelUrl !== modelUrl;

  const markModelLoaded = useCallback(() => {
    loadedModelUrls.add(modelUrl);
    setLoadedModelUrl(modelUrl);
  }, [modelUrl]);

  return { isModelLoading, markModelLoaded };
}
