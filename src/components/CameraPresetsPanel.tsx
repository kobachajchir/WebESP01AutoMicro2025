import type { PresetKey } from "./CameraRig";

export default function CameraPresetsPanel({
  onPick,
  className = "",
}: {
  onPick: (k: PresetKey) => void;
  className?: string;
}) {
  const Btn = ({ label, k }: { label: string; k: PresetKey }) => (
    <button
      type="button"
      onClick={() => onPick(k)}
      className="rounded-md border border-indigo-300/35 bg-indigo-500/10 px-3 py-2 text-sm font-semibold text-indigo-100 transition-all duration-200 hover:bg-indigo-500/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/35"
    >
      {label}
    </button>
  );

  return (
    <div
      className={`app-panel-strong w-full rounded-md border border-indigo-300/18 p-4 ${className}`}
    >
      <div className="mb-3">
        <h3 className="m-0 text-sm font-semibold uppercase tracking-wide text-[var(--ui-text)]">
          Vistas
        </h3>
        <p className="mt-1 text-xs text-[var(--ui-muted)]">
          Atajos de cámara para revisar la postura del modelo.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-6">
        <Btn label="Frente" k="front" />
        <Btn label="Atrás" k="back" />
        <Btn label="Arriba" k="top" />
        <Btn label="Abajo" k="bottom" />
        <Btn label="Izq." k="left" />
        <Btn label="Der." k="right" />
        <Btn label="ISO NE" k="isoNE" />
        <Btn label="ISO NW" k="isoNW" />
      </div>
    </div>
  );
}
