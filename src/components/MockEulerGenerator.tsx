import { useEffect, useRef, useTransition } from "react";

type Euler = { yaw: number; pitch: number; roll: number };

interface MockEulerGeneratorProps {
  active: boolean;
  ms: number;
  onMsChange: (ms: number) => void;
  onUpdate: (e: Euler) => void;
}

export default function MockEulerGenerator({
  active,
  ms,
  onMsChange,
  onUpdate,
}: MockEulerGeneratorProps) {
  const intervalRef = useRef<number | null>(null);
  const t0Ref = useRef<number>(performance.now());
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const clampedMs = clamp(Math.round(ms), 50, 3000);
    const F_HZ = 0.25;
    const W = Math.PI * 2 * F_HZ;

    t0Ref.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const t = (now - t0Ref.current) / 1000;

      const yaw = 120 * Math.sin(W * t + 0.0);
      const pitch = 60 * Math.sin(W * t + Math.PI / 3);
      const roll = 120 * Math.sin(W * t + (2 * Math.PI) / 3);

      const e: Euler = {
        yaw: clamp(yaw, -180, 180),
        pitch: clamp(pitch, -90, 90),
        roll: clamp(roll, -180, 180),
      };

      startTransition(() => {
        onUpdateRef.current(e);
      });
    };

    tick();
    intervalRef.current = window.setInterval(tick, clampedMs);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, ms]);

  return (
    <div className="app-panel-strong rounded-md border border-emerald-300/18 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold uppercase tracking-wide text-white">
            Movimiento automático
          </span>
          <p className="mt-1 text-xs text-slate-300">
            Señal simulada para validar la animación y el refresco.
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${
            active
              ? "bg-emerald-500/20 text-emerald-300 ring-emerald-400/40"
              : "bg-slate-500/10 text-slate-400 ring-white/10"
          }`}
        >
          {active ? "Activo" : "Inactivo"}
        </span>
      </div>

      <label className="mb-1 block text-xs text-slate-300">Intervalo (ms)</label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={50}
          max={3000}
          step={10}
          value={clamp(ms, 50, 3000)}
          onChange={(e) => onMsChange(clamp(Number(e.target.value), 50, 3000))}
          className="flex-1 accent-emerald-400"
        />
        <input
          type="number"
          min={50}
          max={3000}
          step={10}
          value={clamp(ms, 50, 3000)}
          onChange={(e) => onMsChange(clamp(Number(e.target.value), 50, 3000))}
          className="app-input w-24 rounded-md px-2 py-1.5 text-slate-100"
        />
      </div>

      <p className="mt-2 text-[11px] text-slate-400">
        Emite guiñada, cabeceo y alabeo sinusoidales cada{" "}
        <span className="font-medium">{clamp(ms, 50, 3000)} ms</span>.
      </p>
    </div>
  );
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
