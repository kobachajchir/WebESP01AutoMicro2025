import { useEffect, useMemo, useRef, useState } from "react";
import SensorDisclosure from "./SensorDisclosure";
import SimulatedBadge from "./SimulatedBadge";

type Euler = { yaw: number; pitch: number; roll: number };
type Series = Record<keyof Euler, number[]>;

interface RealtimeEulerPanelProps {
  eulerDeg: Euler;
  connected: boolean;
  simulated?: boolean;
  sampling: boolean;
  sampleVersion: number;
  maxPoints?: number;
  sampleMs?: number;
  heightPx?: number;
  sensorIntervalTime: number;
}

export default function RealtimeEulerPanel({
  eulerDeg, connected, simulated = false, sampling, sampleVersion,
  maxPoints = 80, sampleMs = 250, heightPx = 130, sensorIntervalTime,
}: RealtimeEulerPanelProps) {
  const [series, setSeries] = useState<Series>({ yaw: [], pitch: [], roll: [] });
  const latestSampleRef = useRef({ eulerDeg, sampleVersion });
  const consumedVersionRef = useRef<number | null>(null);
  const available = simulated || connected;

  useEffect(() => {
    latestSampleRef.current = { eulerDeg, sampleVersion };
  }, [eulerDeg, sampleVersion]);

  useEffect(() => {
    consumedVersionRef.current = null;
    setSeries({ yaw: [], pitch: [], roll: [] });
  }, [available, simulated]);

  useEffect(() => {
    if (!available || !sampling) return;
    const capture = () => {
      const latest = latestSampleRef.current;
      if (!simulated && (latest.sampleVersion === 0 || latest.sampleVersion === consumedVersionRef.current)) return;
      if (!Object.values(latest.eulerDeg).every(Number.isFinite)) return;
      consumedVersionRef.current = latest.sampleVersion;
      setSeries((current) => ({
        yaw: pushClamped(current.yaw, latest.eulerDeg.yaw, maxPoints),
        pitch: pushClamped(current.pitch, latest.eulerDeg.pitch, maxPoints),
        roll: pushClamped(current.roll, latest.eulerDeg.roll, maxPoints),
      }));
    };
    capture();
    const intervalId = window.setInterval(capture, sampleMs);
    return () => window.clearInterval(intervalId);
  }, [available, simulated, sampling, sampleMs, maxPoints]);

  const { width, height, paths } = useMemo(() => {
    const width = 560;
    const height = heightPx;
    const toY = (value: number) => height - ((Math.max(-180, Math.min(180, value)) + 180) / 360) * height;
    const stepX = width / Math.max(1, maxPoints - 1);
    const toPath = (values: number[]) => values.map((value, index) =>
      `${(maxPoints - values.length + index) * stepX},${toY(value)}`).join(" ");
    return { width, height, paths: {
      yaw: toPath(series.yaw), pitch: toPath(series.pitch), roll: toPath(series.roll),
    } };
  }, [series, maxPoints, heightPx]);

  const hasSamples = available && (simulated || sampleVersion > 0);
  return <SensorDisclosure key={simulated ? "simulated" : "real"}
    title="Gráfica en tiempo real" className="sensor-realtime-panel" defaultExpanded={simulated}
    titleAccessory={simulated ? <SimulatedBadge description="Orientación del vehículo" /> : undefined}
    detail={simulated ? "MPU local" : connected ? sampling ? "MPU real" : "MPU detenido" : undefined}
    disabled={!available} disabledDescription="No conectada">
    <p className="sensor-realtime-panel__description">
      {simulated
        ? `Orientación simulada localmente. Refresco de la gráfica: ${sampleMs} ms.`
        : `Orientación recibida de la placa. Refresco del sensor: ${sensorIntervalTime} ms.`}
    </p>
    {!sampling ? <p className="sensor-realtime-panel__notice" role="status">
      Activá Flujo MPU en Control real para recibir lecturas.
    </p> : null}
    <div className="sensor-realtime-panel__readings">
      <Row label={simulated ? "Yaw simulado" : "Yaw magnético"} value={eulerDeg.yaw} hasSamples={hasSamples} colorDot="bg-indigo-400" />
      <Row label="Pitch" value={eulerDeg.pitch} hasSamples={hasSamples} colorDot="bg-emerald-400" />
      <Row label="Roll" value={eulerDeg.roll} hasSamples={hasSamples} colorDot="bg-rose-400" />
    </div>
    <div className="sensor-realtime-panel__chart">
      {series.yaw.length > 0 ? <svg viewBox={`0 0 ${width} ${height}`} className="w-full"
        role="img" aria-label={simulated ? "Tendencia simulada de Yaw, Pitch y Roll" : "Tendencia de Yaw, Pitch y Roll recibida del MPU"}>
        {Array.from({ length: 5 }, (_, index) => <line key={index} x1={0} x2={width}
          y1={(index / 4) * height} y2={(index / 4) * height} className="sensor-realtime-panel__grid" strokeWidth={1} />)}
        <polyline points={paths.yaw} fill="none" strokeWidth={2} className="stroke-indigo-400" />
        <polyline points={paths.pitch} fill="none" strokeWidth={2} className="stroke-emerald-400" strokeDasharray="7 3" />
        <polyline points={paths.roll} fill="none" strokeWidth={2} className="stroke-rose-400" strokeDasharray="2 3" />
      </svg> : <p className="sensor-realtime-panel__notice">{simulated ? "Esperando muestras simuladas." : "Esperando muestras del MPU."}</p>}
      <div className="sensor-realtime-panel__legend">
        <Legend label="Yaw" dot="bg-indigo-400" />
        <Legend label="Pitch" dot="bg-emerald-400" />
        <Legend label="Roll" dot="bg-rose-400" />
        <span>Rango: −180° a 180°</span>
      </div>
    </div>
  </SensorDisclosure>;
}

function Row({ label, value, hasSamples, colorDot }: {
  label: string; value: number; hasSamples: boolean; colorDot: string;
}) {
  return <div className="sensor-realtime-panel__reading">
    <span className={`inline-flex h-2 w-2 rounded-full ${colorDot}`} aria-hidden="true" />
    <span>{label}</span>
    <output>{hasSamples && Number.isFinite(value) ? `${value.toFixed(1)}°` : "—"}</output>
  </div>;
}

function Legend({ label, dot }: { label: string; dot: string }) {
  return <span className="inline-flex items-center gap-1.5">
    <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />{label}
  </span>;
}

function pushClamped(values: number[], value: number, max: number) {
  return [...values.slice(Math.max(0, values.length - max + 1)), value];
}
