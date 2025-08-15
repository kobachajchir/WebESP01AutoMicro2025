import { useEffect, useRef, useTransition } from "react";

type Euler = { yaw: number; pitch: number; roll: number };

interface MockEulerGeneratorProps {
  /** Si está activo, emite valores en onUpdate */
  active: boolean;
  /** Intervalo de muestreo en ms (50..3000) */
  ms: number;
  /** Setter del intervalo */
  onMsChange: (ms: number) => void;
  /** Callback que recibe los eulerDeg calculados */
  onUpdate: (e: Euler) => void;
}

/**
 * Generador de euler mock (frecuencia fija):
 * - yaw: seno (±120°)
 * - pitch: seno desfasado (±60°, clamp a ±90)
 * - roll: seno desfasado (±120°)
 *
 * Se emiten muestras cada `ms` milisegundos (50..3000).
 * Usa setInterval y refs para no recrear intervalos innecesariamente.
 */
export default function MockEulerGenerator({
  active,
  ms,
  onMsChange,
  onUpdate,
}: MockEulerGeneratorProps) {
  const intervalRef = useRef<number | null>(null);
  const t0Ref = useRef<number>(performance.now());

  // refs para evitar recrear el intervalo por cambios de identidad
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // transición no urgente para no bloquear la UI
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
    // frecuencia fija (Hz): periodo ≈ 4s => 0.25 Hz
    const F_HZ = 0.25;
    const W = Math.PI * 2 * F_HZ; // omega

    t0Ref.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const t = (now - t0Ref.current) / 1000; // seg

      // Señales con fase distinta
      const yaw = 120 * Math.sin(W * t + 0.0); // ±120°
      const pitch = 60 * Math.sin(W * t + Math.PI / 3); // ±60° (clamp a ±90)
      const roll = 120 * Math.sin(W * t + (2 * Math.PI) / 3); // ±120°

      const e: Euler = {
        yaw: clamp(yaw, -180, 180),
        pitch: clamp(pitch, -90, 90),
        roll: clamp(roll, -180, 180),
      };

      startTransition(() => {
        onUpdateRef.current(e);
      });
    };

    tick(); // primer tick inmediato
    intervalRef.current = window.setInterval(tick, clampedMs);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, ms]);

  return (
    <div
      className="rounded-2xl p-4
                 bg-white/70 dark:bg-neutral-900/50
                 ring-1 ring-black/5 shadow-sm backdrop-blur
                 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-200">
          Mock (auto)
        </span>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full ring-1
                     ${
                       active
                         ? "bg-emerald-500/20 ring-emerald-400/40 text-emerald-300"
                         : "bg-slate-500/10 ring-white/10 text-slate-400"
                     }`}
        >
          {active ? "Activo" : "Inactivo"}
        </span>
      </div>

      {/* Intervalo (ms) */}
      <label className="block text-xs text-slate-300 mb-1">
        Intervalo (ms)
      </label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={50}
          max={3000}
          step={10}
          value={clamp(ms, 50, 3000)}
          onChange={(e) => onMsChange(clamp(Number(e.target.value), 50, 3000))}
          className="flex-1 accent-indigo-500"
        />
        <input
          type="number"
          min={50}
          max={3000}
          step={10}
          value={clamp(ms, 50, 3000)}
          onChange={(e) => onMsChange(clamp(Number(e.target.value), 50, 3000))}
          className="w-24 rounded-xl px-2 py-1.5
                     bg-white/60 dark:bg-neutral-900/40
                     text-slate-900 dark:text-slate-100
                     ring-1 ring-black/10 dark:ring-white/10 shadow-sm"
        />
      </div>

      <p className="text-[11px] text-slate-400 mt-2">
        Emite yaw/pitch/roll sinusoidales cada{" "}
        <span className="font-medium">{clamp(ms, 50, 3000)} ms</span>.
      </p>
    </div>
  );
}

/* helpers */
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
