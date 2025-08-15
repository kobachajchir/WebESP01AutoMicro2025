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
    degrees: number
  ) => {
    const newValue = eulerDeg[axis] + degrees;
    // Normalizar valores para mantenerlos en rango
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
    <div
      className="w-full max-w-lg rounded-2xl
                 bg-white/70 dark:bg-neutral-900/50
                 ring-1 ring-black/5 shadow-sm backdrop-blur
                 p-4 flex flex-col gap-4
                 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 m-0">
          Orientación
        </h3>
        <button
          onClick={handleReset}
          className="px-2 py-1 text-xs rounded-md
                     bg-slate-100/10 hover:bg-slate-100/20
                     ring-1 ring-white/10 text-slate-300
                     transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {[
          {
            label: "Yaw (Y)",
            key: "yaw",
            min: -180,
            max: 180,
            desc: "Rotación horizontal",
          },
          {
            label: "Pitch (X)",
            key: "pitch",
            min: -90,
            max: 90,
            desc: "Inclinación vertical",
          },
          {
            label: "Roll (Z)",
            key: "roll",
            min: -180,
            max: 180,
            desc: "Rotación sobre eje",
          },
        ].map(({ label, key, min, max, desc }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex flex-col">
                <label className="block text-xs font-medium text-slate-300">
                  {label}
                </label>
                <span className="text-[10px] text-slate-400">{desc}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    handleQuickRotation(key as "yaw" | "pitch" | "roll", -15)
                  }
                  className="w-6 h-6 rounded text-xs bg-slate-100/10 hover:bg-slate-100/20
                             ring-1 ring-white/10 text-slate-300 transition-colors"
                >
                  -
                </button>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5
                               bg-slate-100/10 ring-1 ring-white/10 text-[11px] text-slate-300 min-w-[45px] justify-center"
                >
                  {eulerDeg[key as "yaw" | "pitch" | "roll"]}°
                </span>
                <button
                  onClick={() =>
                    handleQuickRotation(key as "yaw" | "pitch" | "roll", 15)
                  }
                  className="w-6 h-6 rounded text-xs bg-slate-100/10 hover:bg-slate-100/20
                             ring-1 ring-white/10 text-slate-300 transition-colors"
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
              className="w-full accent-indigo-500
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40
                         transition-all"
            />
          </div>
        ))}
      </div>

      <div className="text-xs text-slate-400 mt-2">
        💡 <strong>Tip:</strong> El modelo rota sobre su propio centro de masa.
        Los controles de cámara (clic y arrastrar) orbitan alrededor del modelo.
      </div>
    </div>
  );
}
