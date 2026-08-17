import AppLoadingScreen from "./AppLoadingScreen";
import { useAssetQuality } from "../contexts/AssetQualityContext";

export default function ModelLoadingScreen({
  visible,
  customLabel,
}: {
  visible: boolean;
  customLabel?: string;
}) {
  const { isHdModelActive, toggleHdModelQuality } = useAssetQuality();

  if (!visible) return null;

  const isHd = isHdModelActive;
  const label =
    customLabel ??
    (isHd
      ? "Cargando modelo 3D HD (Alta definición)..."
      : "Cargando modelo 3D local...");

  return (
    <AppLoadingScreen label={label}>
      {isHd ? (
        <button
          type="button"
          className="app-loading-screen__fallback-button"
          onClick={toggleHdModelQuality}
          title="Omitir espera y usar el modelo local"
        >
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Usar modelo SD local</span>
        </button>
      ) : null}
    </AppLoadingScreen>
  );
}
