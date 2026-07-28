import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { type GLTF } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";
import PageHeader from "../components/PageHeader";
import SectionStatusStrip from "../components/SectionStatusStrip";
import TransportActionButton from "../components/TransportActionButton";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  getEspConnectionDetail,
  getEspConnectionLabel,
  useEspWifiStatus,
} from "../contexts/EspWifiStatusContext";
import {
  F4_STREAM_LIMITS,
  IR_SENSOR_ORDER,
  normalizeStreamPeriodMs,
  parseIrData,
} from "../protocol/f4Payloads";
import type { IrSensorKey, IrSnapshot } from "../protocol/f4Payloads";
import { useSensorSubscription } from "../hooks/useSensorSubscription";
import { getSharedDracoLoader, ResilientGLTFLoader } from "../utils/dracoLoader";
import ModelLoadingScreen from "../components/ModelLoadingScreen";
import { useModelLoadingState } from "../hooks/useModelLoadingState";
import Modal from "../components/modal";
import ThemeModeToggleCard from "../components/ThemeModeToggleCard";
import HdAssetsSettingsCard from "../components/HdAssetsSettingsCard";
import { usePreferredModelUrl } from "../contexts/AssetQualityContext";

type CameraMode = "top" | "iso" | "chase" | "orbit";
type RenderMode = "points" | "ribbon" | "debug";
type SampleSource = "real" | "simulado";

type TrackPose = {
  x: number;
  z: number;
  theta: number;
  seq: number;
};

type TrackPoint = {
  id: string;
  seq: number;
  x: number;
  z: number;
  confidence: number;
  lateralErrorMm: number;
  source: SampleSource;
  segmentId: number;
  tsHostMs: number;
};

type ObstaclePoint = {
  id: string;
  seq: number;
  x: number;
  z: number;
  confidence: number;
  label: string;
  source: SampleSource;
};

type StreamState = {
  active: boolean;
  pending: boolean;
  packets: number;
  lastSeq: number | null;
  updatedAt: number | null;
  statusText: string;
  lastFrameHex: string;
};

const DEFAULT_IR_PERIOD_MS = 50;
const IR_STREAM_LIMITS = { ...F4_STREAM_LIMITS, PAYLOAD_BYTES: 56 } as const;
const normalizeIrStreamPeriodMs = normalizeStreamPeriodMs;
const TRACK_SENSOR_PITCH_MM = 18;
const TRACK_SENSOR_FRONT_OFFSET_M = 0.105;
const TRACK_STEP_REAL_M = 0.016;
const TRACK_STEP_SIM_M = 0.024;
const MAX_TRACK_POINTS = 1800;
const MAX_OBSTACLES = 260;
const MIN_CONFIDENCE_TO_MAP = 0.6;
const MIN_POINT_SEPARATION_M = 0.008;
const OBJECT_TRIGGER_NORM = 900;
const IR_NORM_MAX = 4095;

const LINE_CHANNELS: Array<{
  key: IrSensorKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "lineLeft", label: "Línea izquierda", shortLabel: "IZQ" },
  { key: "lineCenter", label: "Línea centro", shortLabel: "CTR" },
  { key: "lineRight", label: "Línea derecha", shortLabel: "DER" },
];

const OBJECT_CHANNELS: Array<{
  key: IrSensorKey;
  label: string;
  shortLabel: string;
  bearingDeg: number;
}> = [
  { key: "objectLeft45", label: "Objeto izq. 45", shortLabel: "I45", bearingDeg: -45 },
  { key: "objectLeftCenter", label: "Objeto izq. centro", shortLabel: "IC", bearingDeg: -16 },
  { key: "objectCenter", label: "Objeto centro", shortLabel: "C", bearingDeg: 0 },
  { key: "objectRightCenter", label: "Objeto der. centro", shortLabel: "DC", bearingDeg: 16 },
  { key: "objectRight45", label: "Objeto der. 45", shortLabel: "D45", bearingDeg: 45 },
];

export default function TrackFollowerSection() {
  const { connected, subscribeEvent } = useWebSocket();
  const base = import.meta.env.BASE_URL || "/";
  const modelUrl = usePreferredModelUrl(`${base}models/auto_micro.glb`);
  const poseRef = useRef<TrackPose>({ x: 0, z: 0, theta: 0, seq: 0 });
  const segmentRef = useRef(0);
  const lastPointRef = useRef<TrackPoint | null>(null);
  const demoSeqRef = useRef(0);

  const [, setOpenInfoModal] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [irPeriodMs, setIrPeriodMs] = useState(DEFAULT_IR_PERIOD_MS);
  const [cameraMode, setCameraMode] = useState<CameraMode>("chase");
  const [renderMode, setRenderMode] = useState<RenderMode>("points");
  const [simulationEnabled, setSimulationEnabled] = useState(true);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [obstacles, setObstacles] = useState<ObstaclePoint[]>([]);
  const [pose, setPose] = useState<TrackPose>(() => poseRef.current);
  const [lastIr, setLastIr] = useState<IrSnapshot>(() =>
    createIdleTrackIrSnapshot(DEFAULT_IR_PERIOD_MS),
  );
  const [stream, setStream] = useState<StreamState>({
    active: false,
    pending: false,
    packets: 0,
    lastSeq: null,
    updatedAt: null,
    statusText: "IR real detenido. Simulación local disponible.",
    lastFrameHex: "",
  });
  const [streamRequested, setStreamRequested] = useState(false);
  const streamRequestedRef = useRef(false);
  const irSampleConfirmedRef = useRef(false);
  const irSubscription = useSensorSubscription(
    "ir",
    streamRequested && !simulationEnabled,
    irPeriodMs,
  );
  const [seqGapCount, setSeqGapCount] = useState(0);
  const [lineLostCount, setLineLostCount] = useState(0);

  const latestLine = useMemo(() => deriveLineObservation(lastIr), [lastIr]);
  const mappingMode = simulationEnabled ? "Simulación local" : connected ? "IR real" : "Sin conexión";
  const mapQuality =
    latestLine.confidence >= 0.78 && !lastIr.ambiguous
      ? "Alta"
      : latestLine.confidence >= MIN_CONFIDENCE_TO_MAP
        ? "Media"
        : "Sin línea";

  const consumeSnapshot = useCallback(
    (snapshot: IrSnapshot, source: SampleSource) => {
      setLastIr(snapshot);
      setStream((current) => {
        const nextSeq = snapshot.sampleSeq;
        const hasGap =
          source === "real" &&
          current.lastSeq !== null &&
          nextSeq !== ((current.lastSeq + 1) & 0xffff);

        if (hasGap) {
          setSeqGapCount((count) => count + 1);
        }

        return {
          ...current,
          active: true,
          pending: false,
          packets: current.packets + 1,
          lastSeq: nextSeq,
          updatedAt: Date.now(),
          statusText:
            source === "real"
              ? "IR_STREAM recibido para mapeo de pista."
              : "Muestra simulada de seguidor de pista.",
        };
      });

      if (paused) {
        return;
      }

      const observation = deriveLineObservation(snapshot);
      if (!observation.present || observation.confidence < MIN_CONFIDENCE_TO_MAP) {
        segmentRef.current += 1;
        lastPointRef.current = null;
        setLineLostCount((count) => count + 1);
        return;
      }

      const point = integrateTrackPoint(snapshot, observation, source);
      if (!point) {
        return;
      }

      setTrackPoints((current) => {
        const next = [...current, point];
        return next.length > MAX_TRACK_POINTS ? next.slice(-MAX_TRACK_POINTS) : next;
      });

      const obstacle = projectObstacle(snapshot, source, poseRef.current);
      if (obstacle) {
        setObstacles((current) => {
          const next = [...current, obstacle];
          return next.length > MAX_OBSTACLES ? next.slice(-MAX_OBSTACLES) : next;
        });
      }
    },
    [paused],
  );

  useEffect(() => {
    const offIr = subscribeEvent("irSample", ({ data }) => {
      if (!streamRequestedRef.current) return;
      try {
        irSampleConfirmedRef.current = true;
        consumeSnapshot(parseIrData(data), "real");
      } catch (cause) {
        setStream((current) => ({
          ...current,
          statusText: cause instanceof Error ? cause.message : "Payload IR API v1 invalido.",
        }));
      }
    });
    return offIr;
  }, [consumeSnapshot, subscribeEvent]);

  useEffect(() => {
    const confirmedBySample = irSampleConfirmedRef.current;
    setStream((current) => ({
      ...current,
      active: irSubscription.error && !confirmedBySample ? false : irSubscription.active || current.active,
      pending: irSubscription.error ? false : irSubscription.state === "subscribing" && !current.active,
      statusText: irSubscription.error
        ? confirmedBySample
          ? "IR activo confirmado por muestras; no llego el ACK final."
          : irSubscription.error.message
        : irSubscription.active
          ? "Suscripcion IR compartida confirmada por F4."
          : current.statusText,
    }));
  }, [irSubscription.active, irSubscription.error, irSubscription.state]);

  useEffect(() => {
    if (!irSubscription.error || irSampleConfirmedRef.current) return;
    streamRequestedRef.current = false;
    setStreamRequested(false);
  }, [irSubscription.error]);

  useEffect(() => {
    if (!connected) {
      setStream((current) => ({
        ...current,
        active: false,
        pending: false,
        statusText: simulationEnabled
          ? "Sin WebSocket real. Simulación local activa."
          : "Sin WebSocket real. IR real no disponible.",
      }));
    }
  }, [connected, simulationEnabled]);

  useEffect(() => {
    if (!simulationEnabled) {
      return;
    }

    const timer = window.setInterval(() => {
      demoSeqRef.current = (demoSeqRef.current + 1) & 0xffff;
      consumeSnapshot(createSimulatedTrackIrSnapshot(demoSeqRef.current, irPeriodMs), "simulado");
    }, Math.max(35, irPeriodMs));

    return () => window.clearInterval(timer);
  }, [consumeSnapshot, irPeriodMs, simulationEnabled]);

  function integrateTrackPoint(
    snapshot: IrSnapshot,
    observation: LineObservation,
    source: SampleSource,
  ): TrackPoint | null {
    const currentPose = poseRef.current;
    const step = source === "simulado" ? TRACK_STEP_SIM_M : TRACK_STEP_REAL_M;
    const correction = clamp(observation.lateralM * -2.4, -0.045, 0.045);
    const nextTheta = currentPose.theta + correction;
    const forward = {
      x: Math.sin(nextTheta),
      z: -Math.cos(nextTheta),
    };
    const right = {
      x: Math.cos(nextTheta),
      z: Math.sin(nextTheta),
    };
    const nextPose = {
      x: currentPose.x + forward.x * step,
      z: currentPose.z + forward.z * step,
      theta: nextTheta,
      seq: snapshot.sampleSeq,
    };
    const linePoint = {
      x:
        nextPose.x +
        forward.x * TRACK_SENSOR_FRONT_OFFSET_M +
        right.x * observation.lateralM,
      z:
        nextPose.z +
        forward.z * TRACK_SENSOR_FRONT_OFFSET_M +
        right.z * observation.lateralM,
    };

    const last = lastPointRef.current;
    if (
      last &&
      Math.hypot(linePoint.x - last.x, linePoint.z - last.z) < MIN_POINT_SEPARATION_M
    ) {
      poseRef.current = nextPose;
      setPose(nextPose);
      return null;
    }

    poseRef.current = nextPose;
    setPose(nextPose);

    const point: TrackPoint = {
      id: `${source}-${snapshot.sampleSeq}-${Date.now()}`,
      seq: snapshot.sampleSeq,
      x: linePoint.x,
      z: linePoint.z,
      confidence: observation.confidence,
      lateralErrorMm: snapshot.lateralErrorMm,
      source,
      segmentId: segmentRef.current,
      tsHostMs: Date.now(),
    };

    lastPointRef.current = point;
    return point;
  }

  function sendIrStream(enable: boolean) {
    const normalizedPeriod = normalizeIrStreamPeriodMs(irPeriodMs);
    setIrPeriodMs(normalizedPeriod);
    if (enable) {
      setSimulationEnabled(false);
    }
    streamRequestedRef.current = enable;
    irSampleConfirmedRef.current = false;
    setStreamRequested(enable);

    setStream((current) => ({
      ...current,
      pending: true,
      statusText: enable
        ? `Solicitando IR compartido cada ${normalizedPeriod} ms.`
        : "Liberando IR de la vista seguidor; otros consumidores se conservan.",
    }));
  }

  function resetSession() {
    poseRef.current = { x: 0, z: 0, theta: 0, seq: 0 };
    segmentRef.current = 0;
    lastPointRef.current = null;
    setPose(poseRef.current);
    setTrackPoints([]);
    setObstacles([]);
    setSeqGapCount(0);
    setLineLostCount(0);
    setRecording(false);
  }

  function exportNdjson() {
    const manifest = {
      type: "track-follower-session",
      schemaVersion: 1,
      exportedAtIso: new Date().toISOString(),
      source: mappingMode,
      robot: {
        lineSensorCount: 3,
        lineSensorPitchMm: TRACK_SENSOR_PITCH_MM,
        lineSensorOffsetM: TRACK_SENSOR_FRONT_OFFSET_M,
        odometry: "pendiente en firmware/web protocol",
      },
      counters: {
        trackPoints: trackPoints.length,
        obstacles: obstacles.length,
        seqGaps: seqGapCount,
        lineLost: lineLostCount,
      },
    };
    const lines = [
      JSON.stringify({ kind: "manifest", manifest }),
      ...trackPoints.map((point) => JSON.stringify({ kind: "trackPoint", ...point })),
      ...obstacles.map((obstacle) => JSON.stringify({ kind: "obstacle", ...obstacle })),
    ];
    const blob = new Blob([`${lines.join("\n")}\n`], {
      type: "application/x-ndjson;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `seguidor-pista-${new Date().toISOString().replace(/[:.]/g, "-")}.ndjson`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="track-dashboard-shell">
      <div className="track-dashboard-grid-bg" aria-hidden="true" />
      <div className="track-dashboard-frame">
        <PageHeader
          className="app-page-header home-page-header track-page-header"
          titleOverride="Seguidor de pista"
          leadingSlot={<TrackBrandGlyph />}
          setOpenSettingsModal={setOpenSettingsModal}
          setOpenInfoModal={setOpenInfoModal}
        />

        <TrackStatusStrip
          connected={connected}
          stream={stream}
          mappingMode={mappingMode}
          mapQuality={mapQuality}
          latestLine={latestLine}
          pointCount={trackPoints.length}
          obstaclesCount={obstacles.length}
          seqGapCount={seqGapCount}
        />

        <div className="track-dashboard-main">
          <main className="track-map-panel">
            <div className="track-map-panel__header">
              <div>
                <span className="track-kicker">Mapa en vivo</span>
                <h2>Reconstrucción visual de la pista</h2>
              </div>
              <div className="track-map-panel__modes">
                <SegmentButton
                  active={cameraMode === "top"}
                  label="Top"
                  onClick={() => setCameraMode("top")}
                />
                <SegmentButton
                  active={cameraMode === "iso"}
                  label="ISO"
                  onClick={() => setCameraMode("iso")}
                />
                <SegmentButton
                  active={cameraMode === "chase"}
                  label="Trasera"
                  onClick={() => setCameraMode("chase")}
                />
                <SegmentButton
                  active={cameraMode === "orbit"}
                  label="Órbita"
                  onClick={() => setCameraMode("orbit")}
                />
              </div>
            </div>

            <div className="track-canvas-wrap">
              <TrackMapScene
                modelUrl={modelUrl}
                points={trackPoints}
                obstacles={obstacles}
                pose={pose}
                cameraMode={cameraMode}
                renderMode={renderMode}
                latestLine={latestLine}
              />
              <div className="track-canvas-overlay">
                <span>Frente físico: lado TCRT</span>
                <strong>
                  {latestLine.present
                    ? `${Math.round(latestLine.confidence * 100)}% confianza`
                    : "Línea no detectada"}
                </strong>
              </div>
            </div>

            <div className="track-transport-row">
              <TrackActionButton
                title={streamRequested ? "Detener IR" : "Iniciar IR"}
                subtitle={connected ? `${irPeriodMs} ms` : "Requiere conexión"}
                tone={streamRequested ? "rose" : "cyan"}
                disabled={!connected}
                onClick={() => sendIrStream(!streamRequested)}
              />
              <TrackActionButton
                title={recording ? "Grabando" : "Grabar"}
                subtitle="Sesión local"
                tone={recording ? "emerald" : "muted"}
                onClick={() => setRecording((current) => !current)}
              />
              <TrackActionButton
                title={paused ? "Continuar" : "Pausar"}
                subtitle="Mapeo host"
                tone={paused ? "cyan" : "muted"}
                onClick={() => setPaused((current) => !current)}
              />
              <TrackActionButton
                title="Reset"
                subtitle="Origen + path"
                tone="muted"
                onClick={resetSession}
              />
              <TrackActionButton
                title="Exportar"
                subtitle="NDJSON"
                tone="cyan"
                disabled={trackPoints.length === 0}
                onClick={exportNdjson}
              />
            </div>
          </main>

          <aside className="track-side-panel">
            <PanelCard title="Sensores de línea" kicker="TCRT [0, 4095]">
              <SensorBars snapshot={lastIr} />
              <div className="track-line-summary">
                <StatusPair label="Patrón" value={formatHexByte(lastIr.linePattern)} />
                <StatusPair label="Error lateral" value={`${formatDecimal(lastIr.lateralErrorMm, 1)} mm`} />
                <StatusPair label="Ancho detectado" value={`${lastIr.lineWidthMm} mm`} />
                <StatusPair label="Ambiguo" value={lastIr.ambiguous ? "Sí" : "No"} tone={lastIr.ambiguous ? "error" : "ok"} />
              </div>
            </PanelCard>

            <PanelCard title="Sesión" kicker="Buffer local">
              <StatusPair label="Modo" value={mappingMode} tone={simulationEnabled ? "info" : connected ? "ok" : "muted"} />
              <StatusPair label="Puntos" value={String(trackPoints.length)} tone="ok" />
              <StatusPair label="Obstáculos" value={String(obstacles.length)} />
              <StatusPair label="Cortes de línea" value={String(lineLostCount)} tone={lineLostCount > 0 ? "warn" : "ok"} />
              <StatusPair label="Saltos seq" value={String(seqGapCount)} tone={seqGapCount > 0 ? "warn" : "ok"} />
            </PanelCard>

            <PanelCard title="Modelo de mapeo" kicker="Contrato actual">
              <p className="track-note">
                El control de línea sigue siendo autoridad del STM32. Esta pantalla reconstruye
                visualmente la pista desde IR y deja marcada la odometría real como pendiente.
              </p>
              <StatusPair label="Odometría" value="Pendiente" tone="warn" />
              <StatusPair label="Pose usada" value="Host visual" tone="info" />
              <StatusPair label="Separación mínima" value="8 mm" />
              <StatusPair label="Confianza mínima" value="60%" />
            </PanelCard>
          </aside>
        </div>

        <section className="track-control-console">
          <ConsoleGroup title="Entrada">
            <InlineToggle
              label="Simulación local"
              active={simulationEnabled}
              onClick={() => setSimulationEnabled((current) => {
                const next = !current;
                if (next) {
                  streamRequestedRef.current = false;
                  irSampleConfirmedRef.current = false;
                  setStreamRequested(false);
                }
                return next;
              })}
            />
            <label className="track-number-control">
              <span>IR período</span>
              <input
                type="number"
                min={IR_STREAM_LIMITS.MIN_PERIOD_MS}
                max={IR_STREAM_LIMITS.MAX_PERIOD_MS}
                value={irPeriodMs}
                onChange={(event) =>
                  setIrPeriodMs(normalizeIrStreamPeriodMs(Number(event.target.value)))
                }
              />
              <strong>ms</strong>
            </label>
          </ConsoleGroup>

          <ConsoleGroup title="Render">
            <InlineToggle
              label="Puntos"
              active={renderMode === "points"}
              onClick={() => setRenderMode("points")}
            />
            <InlineToggle
              label="Ribbon"
              active={renderMode === "ribbon"}
              onClick={() => setRenderMode("ribbon")}
            />
            <InlineToggle
              label="Debug sensores"
              active={renderMode === "debug"}
              onClick={() => setRenderMode("debug")}
            />
          </ConsoleGroup>

          <ConsoleGroup title="Diagnóstico">
            <StatusPair label="Último seq" value={stream.lastSeq === null ? "--" : String(stream.lastSeq)} />
            <StatusPair label="Paquetes" value={String(stream.packets)} />
            <StatusPair label="Último frame" value={stream.lastFrameHex ? "TX listo" : "--"} tone={stream.lastFrameHex ? "info" : "muted"} />
            <StatusPair label="Estado" value={stream.statusText} />
          </ConsoleGroup>
        </section>
        {openSettingsModal ? (
          <Modal
            isOpen={openSettingsModal}
            onClose={() => setOpenSettingsModal(false)}
            closeOnOverlayClick={false}
            containerClassnames="home-settings-dialog flex flex-col"
          >
            <ThemeModeToggleCard />
            <HdAssetsSettingsCard />
          </Modal>
        ) : null}
      </div>
    </section>
  );
}

type LineObservation = {
  present: boolean;
  confidence: number;
  lateralM: number;
};

function deriveLineObservation(snapshot: IrSnapshot): LineObservation {
  const left = snapshot.norm.lineLeft ?? 0;
  const center = snapshot.norm.lineCenter ?? 0;
  const right = snapshot.norm.lineRight ?? 0;
  const sum = left + center + right;
  const confidence = clamp01(snapshot.confidence / 100);

  if (sum <= 0 || snapshot.linePattern === 0) {
    return { present: false, confidence, lateralM: 0 };
  }

  const weighted = (-1 * left + 0 * center + 1 * right) / sum;
  const fallbackMm = weighted * TRACK_SENSOR_PITCH_MM;
  const lateralMm = Number.isFinite(snapshot.lateralErrorMm)
    ? snapshot.lateralErrorMm
    : fallbackMm;

  return {
    present: true,
    confidence,
    lateralM: clamp(lateralMm / 1000, -0.08, 0.08),
  };
}

function projectObstacle(
  snapshot: IrSnapshot,
  source: SampleSource,
  pose: TrackPose,
): ObstaclePoint | null {
  let best = OBJECT_CHANNELS[0];
  let bestValue = 0;

  for (const channel of OBJECT_CHANNELS) {
    const value = snapshot.norm[channel.key] ?? 0;
    if (value > bestValue) {
      bestValue = value;
      best = channel;
    }
  }

  if (bestValue < OBJECT_TRIGGER_NORM || snapshot.sampleSeq % 8 !== 0) {
    return null;
  }

  const intensity = clamp01(bestValue / IR_NORM_MAX);
  const bearing = THREE.MathUtils.degToRad(best.bearingDeg);
  const theta = pose.theta + bearing;
  const distance = 0.18 + (1 - intensity) * 0.72;

  return {
    id: `${source}-obs-${snapshot.sampleSeq}-${best.key}`,
    seq: snapshot.sampleSeq,
    x: pose.x + Math.sin(theta) * distance,
    z: pose.z - Math.cos(theta) * distance,
    confidence: intensity,
    label: best.shortLabel,
    source,
  };
}

function TrackMapScene({
  modelUrl,
  points,
  obstacles,
  pose,
  cameraMode,
  renderMode,
  latestLine,
}: {
  modelUrl: string;
  points: TrackPoint[];
  obstacles: ObstaclePoint[];
  pose: TrackPose;
  cameraMode: CameraMode;
  renderMode: RenderMode;
  latestLine: LineObservation;
}) {
  const { isModelLoading, markModelLoaded } = useModelLoadingState(modelUrl);

  return (
    <>
      <ModelLoadingScreen visible={isModelLoading} />
      <Canvas
        camera={{ position: [0, 4.8, 0.01], fov: 42, near: 0.05, far: 90 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
        }}
      >
        <color attach="background" args={["#f7fbff"]} />
        <fog attach="fog" args={["#eef7ff", 9, 24]} />
        <ambientLight intensity={1.25} />
        <hemisphereLight args={["#ffffff", "#c7d2fe", 1.2]} />
        <directionalLight position={[3, 5, 4]} intensity={3.4} />
        <directionalLight position={[-4, 2, -3]} intensity={1.6} color="#67e8f9" />
        <TrackCameraRig pose={pose} mode={cameraMode} />
        {cameraMode === "orbit" ? <OrbitControls enableDamping dampingFactor={0.08} target={[pose.x, 0, pose.z]} /> : null}
        <TrackGround />
        {renderMode === "ribbon" || renderMode === "debug" ? <TrackRibbon points={points} /> : null}
        <TrackPointInstances points={points} />
        <ObstacleInstances obstacles={obstacles} />
        <Suspense fallback={<FallbackRobotMarker pose={pose} latestLine={latestLine} debug={renderMode === "debug"} />}>
          <TrackVehicleModel
            modelUrl={modelUrl}
            pose={pose}
            latestLine={latestLine}
            debug={renderMode === "debug"}
            onLoaded={markModelLoaded}
          />
        </Suspense>
      </Canvas>
    </>
  );
}

function TrackCameraRig({ pose, mode }: { pose: TrackPose; mode: CameraMode }) {
  const { camera } = useThree();

  useFrame((_, dt) => {
    if (mode === "orbit") {
      return;
    }

    const forward = new THREE.Vector3(Math.sin(pose.theta), 0, -Math.cos(pose.theta));
    const target = new THREE.Vector3(pose.x, 0.08, pose.z).addScaledVector(forward, 0.18);
    const desired = new THREE.Vector3();

    if (mode === "top") {
      desired.set(pose.x, 4.9, pose.z + 0.001);
    } else if (mode === "iso") {
      desired.set(pose.x + 2.9, 2.7, pose.z + 3.1);
    } else {
      desired
        .set(pose.x, 0.95, pose.z)
        .addScaledVector(forward, -1.35)
        .addScaledVector(new THREE.Vector3(0, 1, 0), 0.35);
    }

    const alpha = 1 - Math.exp(-dt * (mode === "chase" ? 6.2 : 4.2));
    camera.position.lerp(desired, alpha);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  });

  return null;
}

function TrackGround() {
  const grid = useMemo(() => {
    const helper = new THREE.GridHelper(12, 48, "#38bdf8", "#cbd5e1");
    const material = helper.material as THREE.Material;
    material.transparent = true;
    material.opacity = 0.42;
    return helper;
  }, []);

  return (
    <group>
      <primitive object={grid} position={[0, -0.006, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.72} metalness={0.02} />
      </mesh>
    </group>
  );
}

function TrackPointInstances({ points }: { points: TrackPoint[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const temp = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!meshRef.current) {
      return;
    }

    const recent = points.slice(-MAX_TRACK_POINTS);
    recent.forEach((point, index) => {
      temp.position.set(point.x, 0.014, point.z);
      temp.rotation.set(Math.PI / 2, 0, 0);
      temp.scale.setScalar(0.7 + point.confidence * 0.6);
      temp.updateMatrix();
      meshRef.current?.setMatrixAt(index, temp.matrix);
      color.setRGB(0.1 + point.confidence * 0.9, 0.45 + point.confidence * 0.45, 1);
      meshRef.current?.setColorAt(index, color);
    });
    meshRef.current.count = recent.length;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    meshRef.current.computeBoundingSphere();
  }, [color, points, temp]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_TRACK_POINTS]}>
      <cylinderGeometry args={[0.016, 0.016, 0.006, 12]} />
      <meshStandardMaterial vertexColors roughness={0.42} metalness={0.05} emissive="#02141f" />
    </instancedMesh>
  );
}

function TrackRibbon({ points }: { points: TrackPoint[] }) {
  const segments = useMemo(() => {
    const recent = points.slice(-420);
    return recent.slice(1).map((point, index) => {
      const previous = recent[index];
      const dx = point.x - previous.x;
      const dz = point.z - previous.z;
      const length = Math.hypot(dx, dz);
      return {
        id: `${previous.id}-${point.id}`,
        x: (point.x + previous.x) / 2,
        z: (point.z + previous.z) / 2,
        length,
        theta: Math.atan2(dx, dz),
        confidence: Math.min(point.confidence, previous.confidence),
        sameSegment: point.segmentId === previous.segmentId,
      };
    });
  }, [points]);

  return (
    <group>
      {segments.map((segment) =>
        segment.sameSegment && segment.length < 0.12 ? (
          <mesh
            key={segment.id}
            position={[segment.x, 0.008, segment.z]}
            rotation={[0, segment.theta, 0]}
          >
            <boxGeometry args={[0.058, 0.004, Math.max(0.012, segment.length)]} />
            <meshStandardMaterial color="#0ea5e9" emissive="#082f49" opacity={0.36 + segment.confidence * 0.34} transparent />
          </mesh>
        ) : null,
      )}
    </group>
  );
}

function ObstacleInstances({ obstacles }: { obstacles: ObstaclePoint[] }) {
  return (
    <group>
      {obstacles.slice(-MAX_OBSTACLES).map((obstacle) => (
        <mesh key={obstacle.id} position={[obstacle.x, 0.055, obstacle.z]}>
          <cylinderGeometry args={[0.045, 0.045, 0.11, 16]} />
          <meshStandardMaterial color="#fb7185" emissive="#4c0519" opacity={0.52 + obstacle.confidence * 0.36} transparent />
        </mesh>
      ))}
    </group>
  );
}

function TrackVehicleModel({
  modelUrl,
  pose,
  latestLine,
  debug,
  onLoaded,
}: {
  modelUrl: string;
  pose: TrackPose;
  latestLine: LineObservation;
  debug: boolean;
  onLoaded: () => void;
}) {
  const { scene } = useLoader(ResilientGLTFLoader, modelUrl, (loader) => {
    const base = import.meta.env.BASE_URL || "/";
    loader.setDRACOLoader(getSharedDracoLoader(base));
  }) as GLTF;

  useEffect(() => {
    onLoaded();
  }, [onLoaded, scene]);

  const vehicleRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);

  const modelScene = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    if (!modelRef.current) {
      return;
    }

    const box = new THREE.Box3().setFromObject(modelScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 0.42 / maxDim;
    modelRef.current.scale.setScalar(scale);
    modelRef.current.position.copy(center.multiplyScalar(-scale));
    modelRef.current.position.y += 0.09;
  }, [modelScene]);

  useEffect(() => {
    if (!vehicleRef.current) {
      return;
    }

    vehicleRef.current.position.set(pose.x, 0.035, pose.z);
    vehicleRef.current.rotation.set(0, pose.theta, 0);
  }, [pose.theta, pose.x, pose.z]);

  return (
    <group ref={vehicleRef}>
      <group ref={modelRef}>
        <primitive object={modelScene} />
      </group>
      <TrackSensorOverlay latestLine={latestLine} debug={debug} />
    </group>
  );
}

function FallbackRobotMarker({
  pose,
  latestLine,
  debug,
}: {
  pose: TrackPose;
  latestLine: LineObservation;
  debug: boolean;
}) {
  return (
    <group position={[pose.x, 0.07, pose.z]} rotation={[0, pose.theta, 0]}>
      <FallbackRobotBody />
      <TrackSensorOverlay latestLine={latestLine} debug={debug} />
    </group>
  );
}

function FallbackRobotBody() {
  return (
    <>
      <mesh>
        <boxGeometry args={[0.22, 0.08, 0.34]} />
        <meshStandardMaterial color="#0f5b6b" roughness={0.4} metalness={0.28} />
      </mesh>
      <mesh position={[0, 0.052, -0.2]}>
        <boxGeometry args={[0.28, 0.018, 0.032]} />
        <meshStandardMaterial color="#fbbf24" emissive="#78350f" />
      </mesh>
    </>
  );
}

function TrackSensorOverlay({
  latestLine,
  debug,
}: {
  latestLine: LineObservation;
  debug: boolean;
}) {
  const lineColor = latestLine.present ? "#22d3ee" : "#64748b";

  return (
    <>
      <mesh position={[0, 0.055, -TRACK_SENSOR_FRONT_OFFSET_M - 0.07]}>
        <boxGeometry args={[0.28, 0.014, 0.026]} />
        <meshStandardMaterial color="#fbbf24" emissive="#78350f" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[latestLine.lateralM, 0.07, -TRACK_SENSOR_FRONT_OFFSET_M - 0.07]}>
        <sphereGeometry args={[0.025 + latestLine.confidence * 0.018, 16, 12]} />
        <meshStandardMaterial color={lineColor} emissive={lineColor} emissiveIntensity={0.65} />
      </mesh>
      {debug ? (
        <>
          <mesh position={[-0.09, 0.06, -TRACK_SENSOR_FRONT_OFFSET_M - 0.07]}>
            <sphereGeometry args={[0.012, 10, 8]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <mesh position={[0, 0.06, -TRACK_SENSOR_FRONT_OFFSET_M - 0.07]}>
            <sphereGeometry args={[0.012, 10, 8]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <mesh position={[0.09, 0.06, -TRACK_SENSOR_FRONT_OFFSET_M - 0.07]}>
            <sphereGeometry args={[0.012, 10, 8]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </>
      ) : null}
    </>
  );
}

function TrackStatusStrip({
  connected,
  stream,
  mappingMode,
  mapQuality,
  latestLine,
  pointCount,
  obstaclesCount,
  seqGapCount,
}: {
  connected: boolean;
  stream: StreamState;
  mappingMode: string;
  mapQuality: string;
  latestLine: LineObservation;
  pointCount: number;
  obstaclesCount: number;
  seqGapCount: number;
}) {
  const { status: espWifiStatus } = useEspWifiStatus();

  return (
    <SectionStatusStrip
      ariaLabel="Estado del seguidor"
      className="track-status-strip"
      items={[
        {
          label: "Conexión",
          value: connected ? getEspConnectionLabel(espWifiStatus) : "Mock/local",
          detail: connected ? getEspConnectionDetail(espWifiStatus) : undefined,
          tone: connected ? "ok" : "muted",
        },
        { label: "Modo", value: mappingMode, tone: "info" },
        {
          label: "Mapa",
          value: mapQuality,
          tone: mapQuality === "Alta" ? "ok" : mapQuality === "Media" ? "info" : "error",
        },
        {
          label: "Stream IR",
          value: stream.active ? "Activo" : "Detenido",
          tone: stream.active ? "ok" : "muted",
        },
        {
          label: "Confianza línea",
          value: `${Math.round(latestLine.confidence * 100)}%`,
          tone: latestLine.confidence >= MIN_CONFIDENCE_TO_MAP ? "ok" : "error",
        },
        { label: "Puntos", value: String(pointCount), tone: "ok" },
        {
          label: "Obstáculos",
          value: String(obstaclesCount),
          tone: obstaclesCount > 0 ? "warn" : "muted",
        },
        {
          label: "Saltos seq",
          value: String(seqGapCount),
          tone: seqGapCount > 0 ? "warn" : "ok",
        },
      ]}
    />
  );
}

function SensorBars({ snapshot }: { snapshot: IrSnapshot }) {
  return (
    <div className="track-sensor-bars">
      {LINE_CHANNELS.map((channel) => {
        const value = snapshot.norm[channel.key] ?? 0;
        const percent = Math.round(clamp01(value / IR_NORM_MAX) * 100);
        return (
          <div key={channel.key} className="track-sensor-bar">
            <strong>{channel.shortLabel}</strong>
            <span>{value}</span>
            <div className="track-sensor-bar__track">
              <i style={{ height: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PanelCard({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <section className="track-panel-card">
      <header>
        <span>{kicker}</span>
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}

function ConsoleGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="track-console-group">
      <header>{title}</header>
      <div>{children}</div>
    </section>
  );
}

function StatusPair({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "ok" | "error" | "info" | "warn" | "muted";
}) {
  return (
    <div className={`track-status-pair track-status-pair--${tone}`}>
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function SegmentButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`track-segment-button ${active ? "track-segment-button--active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function InlineToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`track-inline-toggle ${active ? "track-inline-toggle--active" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span>{label}</span>
      <i />
    </button>
  );
}

function TrackActionButton({
  title,
  subtitle,
  tone,
  disabled = false,
  onClick,
}: {
  title: string;
  subtitle: string;
  tone: "cyan" | "emerald" | "rose" | "muted";
  disabled?: boolean;
  onClick: () => void;
}) {
  const icon =
    title.startsWith("Detener")
      ? "■"
      : title.startsWith("Iniciar") || title.startsWith("Continuar")
        ? "▶"
        : title.startsWith("Grabar") || title.startsWith("Grabando")
          ? "●"
          : title === "Reset"
            ? "↺"
            : "⇩";

  return (
    <TransportActionButton
      label={title}
      detail={subtitle}
      icon={icon}
      tone={tone}
      disabled={disabled}
      onClick={onClick}
    />
  );
}

function TrackBrandGlyph() {
  return (
    <span className="home-brand-glyph track-brand-glyph" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M4 17c3-6 5-8 8-8s5 2 8 8" />
        <path d="M5 18h14" />
        <path d="M8 14c1.4-1.6 2.6-2.4 4-2.4s2.6.8 4 2.4" />
        <path d="M12 3v5M8 5l4 3 4-3" />
      </svg>
    </span>
  );
}

function createIdleTrackIrSnapshot(periodMs: number): IrSnapshot {
  const raw = Object.fromEntries(IR_SENSOR_ORDER.map((key) => [key, 0])) as Record<IrSensorKey, number>;
  const norm = Object.fromEntries(IR_SENSOR_ORDER.map((key) => [key, 0])) as Record<IrSensorKey, number>;
  return {
    status: 0,
    flags: 0,
    sampleSeq: 0,
    periodMs,
    tickMs: 0,
    raw,
    norm,
    linePattern: 0,
    lineAlignment: 0,
    confidence: 0,
    ambiguous: false,
    lineWidthMm: 0,
    lateralErrorMm: 0,
    lateralErrorNorm: 0,
  };
}

function createSimulatedTrackIrSnapshot(seq: number, periodMs: number): IrSnapshot {
  const t = seq / 18;
  const lateral = Math.sin(t * 0.62) * 0.78 + Math.sin(t * 0.17) * 0.18;
  const raw = Object.fromEntries(IR_SENSOR_ORDER.map((key) => [key, 80])) as Record<IrSensorKey, number>;
  const norm = Object.fromEntries(IR_SENSOR_ORDER.map((key) => [key, 0])) as Record<IrSensorKey, number>;

  LINE_CHANNELS.forEach((channel, index) => {
    const sensorPosition = index - 1;
    const closeness = Math.max(0, 1 - Math.abs(sensorPosition - lateral) / 1.1);
    const value = Math.round(220 + closeness ** 1.8 * 3600);
    raw[channel.key] = value;
    norm[channel.key] = value;
  });

  const objectPulse = seq % 180 > 112 && seq % 180 < 132;
  norm.objectCenter = objectPulse ? 2600 : 120;
  raw.objectCenter = norm.objectCenter;

  const linePattern = LINE_CHANNELS.reduce(
    (acc, channel, index) => (norm[channel.key] > 700 ? acc | (1 << (2 - index)) : acc),
    0,
  );
  const left = norm.lineLeft;
  const right = norm.lineRight;
  const denom = Math.max(1, left + norm.lineCenter + right);
  const lateralErrorNorm = (right - left) / denom;

  return {
    status: 0,
    flags: 0x03,
    sampleSeq: seq,
    periodMs,
    tickMs: seq * periodMs,
    raw,
    norm,
    linePattern,
    lineAlignment: linePattern,
    confidence: Math.round(Math.max(norm.lineLeft, norm.lineCenter, norm.lineRight) / 40.95),
    ambiguous: linePattern === 0 || linePattern === 0x05 || linePattern === 0x07,
    lineWidthMm: LINE_CHANNELS.filter((channel) => norm[channel.key] > 700).length * TRACK_SENSOR_PITCH_MM,
    lateralErrorMm: lateralErrorNorm * 33,
    lateralErrorNorm,
  };
}

function formatHexByte(value: number) {
  return `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
}

function formatDecimal(value: number, digits: number) {
  return Number.isFinite(value) ? value.toFixed(digits) : "--";
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}
