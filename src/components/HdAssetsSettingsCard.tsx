import { toast } from "sonner";
import { useAssetQuality } from "../contexts/AssetQualityContext";
import ToggleButton from "./toggleButton";

export default function HdAssetsSettingsCard({
  className = "",
}: {
  className?: string;
}) {
  const {
    internetStatus,
    hdAssetsEnabled,
    hdAssetsActive,
    hdModelUrl,
    setHdAssetsEnabled,
  } = useAssetQuality();

  if (internetStatus !== "online") {
    return null;
  }

  const sourceAvailable = hdModelUrl !== null;

  function handleToggle(checked: boolean) {
    setHdAssetsEnabled(checked);
    if (!checked) {
      toast.info("Usando modelo 3D optimizado local");
    }
  }

  return (
    <section
      className={`settings-identity-card settings-assets-card ${className}`.trim()}
    >
      <div className="settings-assets-card__content">
        <div className="settings-card-heading">
          <span className="settings-card-heading__icon settings-card-heading__icon--online">
            <HdAssetIcon />
          </span>
          <div>
            <div className="settings-assets-card__status">
              <span className="settings-assets-card__status-dot" />
              Internet disponible
            </div>
            <h3>Usar assets HD</h3>
            <p>
              Descarga el modelo 3D de alta definición desde Internet. Requiere
              conexión y puede consumir más datos.
            </p>
          </div>
        </div>

        <div className="settings-assets-card__control">
          <ToggleButton
            checked={sourceAvailable && hdAssetsEnabled}
            onChange={handleToggle}
            disabled={!sourceAvailable}
            labels
            labelOff="Estándar"
            labelOn="HD"
            size="lg"
            ariaLabel="Usar assets en alta definición"
            title={
              sourceAvailable
                ? "Alternar assets estándar y HD"
                : "La fuente del modelo HD todavía no está publicada"
            }
          />
          <small>
            {!sourceAvailable
              ? "La conexión está disponible, pero todavía falta publicar la fuente HD para esta compilación."
              : hdAssetsActive
                ? "HD activo. Si Internet se interrumpe, se usará automáticamente el modelo local."
                : "Se está usando el modelo optimizado guardado en el ESP."}
          </small>
        </div>
      </div>
    </section>
  );
}

function HdAssetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 4.5 7.2v9.6L12 21l7.5-4.2V7.2L12 3Z" />
      <path d="m4.8 7.4 7.2 4 7.2-4M12 11.4V21" />
      <path d="M8.2 15.5v-3M8.2 14h2.2v-1.5M14 12.5h1.5c1.4 0 2.3.9 2.3 2s-.9 2-2.3 2H14v-4Z" />
    </svg>
  );
}
