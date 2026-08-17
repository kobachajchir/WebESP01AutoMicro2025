import { useEffect, useMemo, useState } from "react";

import { useRef } from "react";
type Euler = { yaw: number; pitch: number; roll: number };

interface RealtimeEulerPanelProps {
 eulerDeg: Euler;
 maxPoints?: number;
 sampleMs?: number;
 heightPx?: number;
 sensorIntervalTime: number;
}

export default function RealtimeEulerPanel({
 eulerDeg,
 maxPoints = 80,
 sampleMs = 250,
 heightPx = 130,
 sensorIntervalTime,
}: RealtimeEulerPanelProps) {
 const [series, setSeries] = useState<{
 yaw: number[];
 pitch: number[];
 roll: number[];
 }>({ yaw: [], pitch: [], roll: [] });
 const latestEulerRef = useRef(eulerDeg);

 useEffect(() => {
 latestEulerRef.current = eulerDeg;
 }, [eulerDeg]);


 useEffect(() => {
 const id = window.setInterval(() => {
 const latest = latestEulerRef.current;
 setSeries((s) => ({
 yaw: pushClamped(s.yaw, latest.yaw, maxPoints),
 pitch: pushClamped(s.pitch, latest.pitch, maxPoints),
 roll: pushClamped(s.roll, latest.roll, maxPoints),
 }));
 }, sampleMs);

 return () => window.clearInterval(id);
 }, [sampleMs, maxPoints]);

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

 const { width, height, paths } = useMemo(() => {
 const width = 560;
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
 <div className="app-panel-strong w-full rounded-md border border-cyan-300/18 p-4">
 <div className="mb-3">
 <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--ui-text)]">
 Lecturas MPU en tiempo real
 </h3>
 <p className="mt-1 text-xs text-[var(--ui-muted)]">
 Orientación fusionada del MPU9250. Refresco del sensor: {sensorIntervalTime} ms
 </p>
 </div>

 <div className="grid grid-cols-1 gap-2">
 <Row label="Yaw magnético" value={eulerDeg.yaw} colorDot="bg-indigo-400" />
 <Row
 label="Pitch"
 value={eulerDeg.pitch}
 colorDot="bg-emerald-400"
 />
 <Row label="Roll" value={eulerDeg.roll} colorDot="bg-rose-400" />
 </div>

 <div className="mt-4">
 <div className="relative w-full">
 <div className="absolute inset-0 rounded-md bg-gradient-to-b from-[var(--ui-panel)] to-transparent" />
 <svg
 viewBox={`0 0 ${width} ${height}`}
 className="w-full"
 role="img"
 aria-label="Tendencia Yaw, Pitch y Roll"
 >
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

 <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--ui-muted)]">
 <Legend label="Yaw" dot="bg-indigo-400" />
 <Legend label="Pitch" dot="bg-emerald-400" />
 <Legend label="Roll" dot="bg-rose-400" />
 <span className="ml-auto opacity-70">Rango: −180° a 180°</span>
 </div>
 </div>
 </div>
 );
}

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
 <label className="w-20 text-xs text-[var(--ui-muted)]">{label}</label>
 <input
 readOnly
 value={`${toFixedSafe(value, 1)}°`}
 className="app-input flex-1 rounded-md px-2 py-1.5 text-[var(--ui-text)]"
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
