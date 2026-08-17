import { useAssetQuality } from "../contexts/AssetQualityContext";

export default function HdModelQualityButton({
  className = "",
}: {
  className?: string;
}) {
  const {
    hdAssetsEnabled,
    hdModelUrl,
    internetStatus,
    isHdModelActive,
    toggleHdModelQuality,
  } = useAssetQuality();

  // El botón solo aparece si el asset HD de config está activado y hay conexión a Internet
  if (!hdAssetsEnabled || !hdModelUrl || internetStatus !== "online") {
    return null;
  }

  return (
    <button
      type="button"
      className={`render-quality-toggle render-quality-toggle--${isHdModelActive ? "hd" : "sd"} ${className}`.trim()}
      onClick={toggleHdModelQuality}
      title={
        isHdModelActive
          ? "Modelo 3D en Alta Definición (clic para cambiar a SD)"
          : "Modelo 3D Estándar (clic para cambiar a HD)"
      }
      aria-label={`Calidad del modelo 3D: ${isHdModelActive ? "HD" : "SD"}. Clic para alternar.`}
    >
      <span className="render-quality-toggle__dot" />
      <span>{isHdModelActive ? "HD" : "SD"}</span>
    </button>
  );
}
