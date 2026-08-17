import React from "react";

interface OrientationControlsProps {
 eulerDeg: { yaw: number; pitch: number; roll: number };
 isEmu: boolean;
 onChange: (euler: { yaw: number; pitch: number; roll: number }) => void;
}

export default function OrientationControls({
 eulerDeg,
 isEmu,
 onChange,
}: OrientationControlsProps) {
 const handleSliderChange =
 (axis: "yaw" | "pitch" | "roll") =>
 (e: React.ChangeEvent<HTMLInputElement>) => {
 onChange({ ...eulerDeg, [axis]: Number(e.target.value) });
 };

 const handleReset = () => {
 onChange({ yaw: 0, pitch: 0, roll: 0 });
 };

 const handleQuickRotation = (
 axis: "yaw" | "pitch" | "roll",
 degrees: number,
 ) => {
 const newValue = eulerDeg[axis] + degrees;
 let normalizedValue = newValue;

 if (axis === "yaw" || axis === "roll") {
 normalizedValue = ((newValue % 360) + 360) % 360;
 if (normalizedValue > 180) normalizedValue -= 360;
 } else if (axis === "pitch") {
 normalizedValue = Math.max(-90, Math.min(90, newValue));
 }

 onChange({ ...eulerDeg, [axis]: normalizedValue });
 };

 if (!isEmu) return null;

 return (
 <div className="app-panel-strong flex w-full max-w-lg flex-col gap-4 rounded-md border border-cyan-300/18 p-4">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="m-0 text-sm font-semibold uppercase tracking-wide text-[var(--ui-text)]">
 Orientación manual
 </h3>
 <p className="mt-1 text-xs text-[var(--ui-muted)]">
 Ajuste manual de guiñada, cabeceo y alabeo para probar la escena.
 </p>
 </div>
 <button
 type="button"
 onClick={handleReset}
 className="rounded-md border border-[var(--ui-ring)] bg-[var(--ui-panel-hover)] px-3 py-1.5 text-xs font-semibold text-[var(--ui-text)] transition-all duration-200 hover:bg-[var(--ui-panel-hover)]"
 >
 Restablecer
 </button>
 </div>

 <div className="flex flex-col gap-4">
 {[
 {
 label: "Guiñada / Yaw (Y)",
 key: "yaw",
 min: -180,
 max: 180,
 desc: "Rotación horizontal",
 },
 {
 label: "Cabeceo / Pitch (X)",
 key: "pitch",
 min: -90,
 max: 90,
 desc: "Inclinación vertical",
 },
 {
 label: "Alabeo / Roll (Z)",
 key: "roll",
 min: -180,
 max: 180,
 desc: "Rotación sobre eje",
 },
 ].map(({ label, key, min, max, desc }) => (
 <div key={key}>
 <div className="mb-1 flex items-center justify-between">
 <div className="flex flex-col">
 <label className="block text-xs font-medium text-[var(--ui-muted)]">
 {label}
 </label>
 <span className="text-[10px] text-[var(--ui-muted)]">{desc}</span>
 </div>
 <div className="flex items-center gap-1">
 <button
 type="button"
 onClick={() =>
 handleQuickRotation(key as "yaw" | "pitch" | "roll", -15)
 }
 className="h-6 w-6 rounded-md border border-cyan-300/25 bg-cyan-500/10 text-xs text-cyan-100 transition-colors hover:bg-cyan-500/18"
 >
 -
 </button>
 <span className="inline-flex min-w-[52px] items-center justify-center rounded-md border border-[var(--ui-ring)] bg-[var(--ui-panel-hover)] px-2 py-0.5 text-[11px] text-[var(--ui-text)]">
 {eulerDeg[key as "yaw" | "pitch" | "roll"].toFixed(1)}°
 </span>
 <button
 type="button"
 onClick={() =>
 handleQuickRotation(key as "yaw" | "pitch" | "roll", 15)
 }
 className="h-6 w-6 rounded-md border border-cyan-300/25 bg-cyan-500/10 text-xs text-cyan-100 transition-colors hover:bg-cyan-500/18"
 >
 +
 </button>
 </div>
 </div>

 <input
 type="range"
 min={min}
 max={max}
 step={1}
 value={eulerDeg[key as "yaw" | "pitch" | "roll"]}
 onChange={handleSliderChange(key as "yaw" | "pitch" | "roll")}
 className="w-full accent-cyan-400 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
 />
 </div>
 ))}
 </div>

 <div className="mt-2 text-xs text-[var(--ui-muted)]">
 <strong className="text-[var(--ui-muted)]">Consejo:</strong> El modelo rota sobre su
 propio centro de masa y los controles de cámara orbitan alrededor del
 vehículo.
 </div>
 </div>
 );
}
