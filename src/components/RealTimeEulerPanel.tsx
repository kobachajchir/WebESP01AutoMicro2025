import { useEffect, useMemo, useState } from "react";

type Euler = { yaw: number; pitch: number; roll: number };

interface RealtimeEulerPanelProps {
  eulerDeg: Euler;
  /** cantidad máxima de puntos en la serie */
  maxPoints?: number;
  /** cada cuánto samplear (ms) */
  sampleMs?: number;
  /** alto del gráfico en px */
  heightPx?: number;
  sensorIntervalTime: number;
}

/**
 * Panel con:
 * - 3 filas (Yaw/Pitch/Roll) con inputs readonly
 * - Gráfica de tendencia (SVG) para Yaw/Pitch/Roll superpuestos
 * Sin libs externas. Estilo material-ish (glass, ring, sombras, transiciones).
 */
export default function RealtimeEulerPanel({
  eulerDeg,
  maxPoints = 80,
  sampleMs = 250,
  heightPx = 130,
  sensorIntervalTime
}: RealtimeEulerPanelProps) {
  const [series, setSeries] = useState<{
    yaw: number[];
    pitch: number[];
    roll: number[];
  }>({ yaw: [], pitch: [], roll: [] });

  // Sampleo periódico del valor entrante (tiempo real)
  useEffect(() => {
    const id = window.setInterval(() => {
      setSeries((s) => ({
        yaw: pushClamped(s.yaw, eulerDeg.yaw, maxPoints),
        pitch: pushClamped(s.pitch, eulerDeg.pitch, maxPoints),
        roll: pushClamped(s.roll, eulerDeg.roll, maxPoints),
      }));
    }, sampleMs);
    return () => window.clearInterval(id);
  }, [eulerDeg, sampleMs, maxPoints]);

  // Paddings para que el gráfico tenga N puntos aunque haya pocos samples
  const seriesPadded = useMemo(() => {
    const pad = (arr: number[]) =>
      arr.length >= maxPoints
        ? arr.slice(-maxPoints)
        : Array(maxPoints - arr.length)
            .fill(arr[0] ?? 0)
            .concat(arr);
    return {
      yaw: pad(series.yaw),
      pitch: pad(series.pitch),
      roll: pad(series.roll),
    };
  }, [series, maxPoints]);

  // Construcción de polylines (normalizamos a rango fijo [-180, 180])
  const { width, height, paths } = useMemo(() => {
    const width = 560; // ancho virtual; el SVG escalará al contenedor (w-full)
    const height = heightPx;
    const domainMin = -180;
    const domainMax = 180;
    const toY = (v: number) => {
      const vv = clamp(v, domainMin, domainMax);
      return height - ((vv - domainMin) / (domainMax - domainMin)) * height;
    };
    const stepX = width / Math.max(1, maxPoints - 1);
    const toPath = (arr: number[]) =>
      arr.map((v, i) => `${i * stepX},${toY(v)}`).join(" ");

    return {
      width,
      height,
      paths: {
        yaw: toPath(seriesPadded.yaw),
        pitch: toPath(seriesPadded.pitch),
        roll: toPath(seriesPadded.roll),
      },
    };
  }, [seriesPadded, maxPoints, heightPx]);

  return (
    <div
      className="w-full rounded-2xl
                 bg-white/70 dark:bg-neutral-900/50
                 ring-1 ring-black/5 shadow-sm backdrop-blur
                 p-4 transition-shadow hover:shadow-md"
    >
      <h3 className="text-sm font-semibold text-slate-200 mb-3">
        Lecturas en tiempo real ({sensorIntervalTime} ms)
      </h3>

      {/* Filas de inputs readonly */}
      <div className="grid grid-cols-1 gap-2">
        <Row label="Yaw (°)" value={eulerDeg.yaw} colorDot="bg-indigo-400" />
        <Row
          label="Pitch (°)"
          value={eulerDeg.pitch}
          colorDot="bg-emerald-400"
        />
        <Row label="Roll (°)" value={eulerDeg.roll} colorDot="bg-rose-400" />
      </div>

      {/* Gráfico de tendencia */}
      <div className="mt-4">
        <div className="relative w-full">
          {/* fondo / grid suave */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/5 to-transparent" />
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            role="img"
            aria-label="Tendencia Yaw, Pitch y Roll"
          >
            {/* grid horizontal suave */}
            {Array.from({ length: 5 }).map((_, i) => {
              const y = (i / 4) * height;
              return (
                <line
                  key={i}
                  x1={0}
                  y1={y}
                  x2={width}
                  y2={y}
                  className="stroke-white/10"
                  strokeWidth={1}
                />
              );
            })}

            {/* Líneas */}
            <polyline
              points={paths.yaw}
              fill="none"
              strokeWidth={2}
              className="stroke-indigo-400"
            />
            <polyline
              points={paths.pitch}
              fill="none"
              strokeWidth={2}
              className="stroke-emerald-400"
            />
            <polyline
              points={paths.roll}
              fill="none"
              strokeWidth={2}
              className="stroke-rose-400"
            />
          </svg>
        </div>

        {/* Leyenda */}
        <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-400">
          <Legend label="Yaw" dot="bg-indigo-400" />
          <Legend label="Pitch" dot="bg-emerald-400" />
          <Legend label="Roll" dot="bg-rose-400" />
          <span className="ml-auto opacity-70">Rango: −180° a 180°</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers UI ---------- */

function Row({
  label,
  value,
  colorDot,
}: {
  label: string;
  value: number;
  colorDot: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex h-2 w-2 rounded-full ${colorDot}`} />
      <label className="text-xs text-slate-300 w-20">{label}</label>
      <input
        readOnly
        value={`${toFixedSafe(value, 1)}°`}
        className="flex-1 rounded-xl px-2 py-1.5
                   bg-white/60 dark:bg-neutral-900/40
                   text-slate-900 dark:text-slate-100
                   ring-1 ring-black/10 dark:ring-white/10
                   shadow-sm transition-all"
      />
    </div>
  );
}

function Legend({ label, dot }: { label: string; dot: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span>{label}</span>
    </span>
  );
}

/* ---------- helpers data ---------- */

function pushClamped(arr: number[], v: number, max: number) {
  const next = arr.length >= max ? arr.slice(1) : arr.slice();
  next.push(v);
  return next;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function toFixedSafe(n: number, d = 1) {
  if (!Number.isFinite(n)) return "0.0";
  return n.toFixed(d);
}
