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
      onClick={() => onPick(k)}
      className="px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm transition-colors"
    >
      {label}
    </button>
  );

  return (
    <div
      className={`w-full p-3 border border-slate-800 rounded-2xl bg-slate-900/60 ${className}`}
    >
      <h3 className="m-0 mb-2 text-slate-100 text-sm">Vistas</h3>
      <div className="grid grid-cols-4 lg:grid-cols-6 gap-2">
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
