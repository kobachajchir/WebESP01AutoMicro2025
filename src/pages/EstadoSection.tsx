import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/modal";
import MpuIrScene3D from "../components/MpuIrScene3D";
import RealtimeEulerPanel from "../components/RealTimeEulerPanel";
import MockEulerGenerator from "../components/MockEulerGenerator";
import OrientationControls from "../components/OrientationControls";
import SectionStatusStrip from "../components/SectionStatusStrip";
import ThemeModeToggleCard from "../components/ThemeModeToggleCard";
import HdAssetsSettingsCard from "../components/HdAssetsSettingsCard";
import { usePreferredModelUrl } from "../contexts/AssetQualityContext";
import IrCalibrationWorkbench from "../features/ir/IrCalibrationWorkbench";
import type {
  EulerDeg,
  MpuIrScene3DHandle,
  SensorCameraPreset,
} from "../components/MpuIrScene3D";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  F4_MPU_FLAGS,
  F4_STREAM_LIMITS,
  IR_SENSOR_ORDER,
  normalizeStreamPeriodMs,
  parseIrData,
  parseMpuData,
} from "../protocol/f4Payloads";
import type { IrSensorKey, IrSnapshot } from "../protocol/f4Payloads";
import { useSensorSubscription } from "../hooks/useSensorSubscription";
import {
  getEspConnectionDetail,
  getEspConnectionLabel,
  useEspWifiStatus,
} from "../contexts/EspWifiStatusContext";
import { EspApiError } from "../protocol/espClient";
import {
  IR_OBJECT_DETECTION_THRESHOLD,
  IR_OBJECT_SENSOR_KEYS,
  estimateIrObjectPosition,
  normalizeIrObjectReading,
  simulateIrObjectReadings,
} from "../features/ir/irObjectModel";
import {
  buildIrForwardCalibration,
  createEmptyIrCalibrationProfile,
  parseIrCalibrationProfile,
  serializeIrCalibrationProfile,
} from "../features/ir/irCalibration";
import type { IrCalibrationProfile } from "../features/ir/irCalibration";
import { relativeRigEulerDeg } from "../features/ir/irSensorFrame";
import type {
  IrObjectPoint,
  IrObjectPositionEstimate,
  IrObjectSensorKey,
} from "../features/ir/irObjectModel";

interface StreamStatus {
  active: boolean;
  pending: boolean;
  packetsReceived: number;
  lastSeq: number | null;
  lastStatus: number | null;
  lastFlags: number | null;
  ackCode: number | null;
  ackActive: boolean | null;
  ackPeriodMs: number | null;
  statusText: string;
  lastFrameHex: string;
  updatedAt: number | null;
}

type SensorControlMode = "real" | "simulated";

const MIN_MPU_STREAM_PERIOD_MS = F4_STREAM_LIMITS.MIN_PERIOD_MS;
const DEFAULT_MPU_PERIOD_MS = 20;
const DEFAULT_IR_PERIOD_MS = 50;
const IR_STREAM_LIMITS = { ...F4_STREAM_LIMITS, PAYLOAD_BYTES: 56 } as const;
const IR_NORM_MAX = 4095;
const SENSOR_SENSITIVITY_MIN_CM = 0;
const SENSOR_SENSITIVITY_MAX_CM = 15;
const DEFAULT_SENSOR_SENSITIVITY_CM = 15;
const IR_CALIBRATION_STORAGE_KEY = "uner.ir-object-calibration.v1";

const OBJECT_CHANNELS: Array<{
  key: IrSensorKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "objectLeft45", label: "Objeto izquierdo 45°", shortLabel: "IZQ 45°" },
  { key: "objectLeftCenter", label: "Objeto izquierdo centro", shortLabel: "IZQ C." },
  { key: "objectCenter", label: "Objeto central", shortLabel: "CENTRO" },
  { key: "objectRightCenter", label: "Objeto derecho centro", shortLabel: "DER C." },
  { key: "objectRight45", label: "Objeto derecho 45°", shortLabel: "DER 45°" },
];

const FLOOR_CHANNELS: Array<{
  key: IrSensorKey;
  label: string;
  shortLabel: string;
  bit: number;
}> = [
  { key: "lineLeft", label: "Línea izquierda", shortLabel: "IZQ.", bit: 0x04 },
  { key: "lineCenter", label: "Línea central", shortLabel: "CENTRO", bit: 0x02 },
  { key: "lineRight", label: "Línea derecha", shortLabel: "DER.", bit: 0x01 },
];

export default function EstadoSection() {
  const {
    connected,
    subscribeEvent,
    setSensorRefreshInterval,
  } = useWebSocket();

  const base = import.meta.env.BASE_URL || "/";
  const modelUrl = usePreferredModelUrl(`${base}models/auto_micro.glb`);
  const sceneRef = useRef<MpuIrScene3DHandle>(null);
  const irEmuSequenceRef = useRef(0);

  const [openInfoModal, setOpenInfoModal] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [openIrCalibrationModal, setOpenIrCalibrationModal] = useState(false);
  const [controlMode, setControlMode] = useState<SensorControlMode>("real");
  const [irCalibrationProfile, setIrCalibrationProfile] =
    useState<IrCalibrationProfile>(loadStoredIrCalibrationProfile);
  const [mpuPeriodMs, setMpuPeriodMs] = useState(DEFAULT_MPU_PERIOD_MS);
  const [irPeriodMs, setIrPeriodMs] = useState(DEFAULT_IR_PERIOD_MS);
  const [mpuEulerRaw, setMpuEulerRaw] = useState<EulerDeg>({
    yaw: 0,
    pitch: 0,
    roll: 0,
  });
  const [zeroOffset, setZeroOffset] = useState<EulerDeg>({
    yaw: 0,
    pitch: 0,
    roll: 0,
  });
  const [renderEuler, setRenderEuler] = useState<EulerDeg>({
    yaw: 0,
    pitch: 0,
    roll: 0,
  });
  const [renderLink, setRenderLink] = useState(true);
  const [freezePose, setFreezePose] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showBubble, setShowBubble] = useState(true);
  const [showOrigin, setShowOrigin] = useState(true);
  const [sensorSensitivityCm, setSensorSensitivityCm] = useState(
    DEFAULT_SENSOR_SENSITIVITY_CM,
  );
  const [irEmu, setIrEmu] = useState(false);
  const [mpuEmu, setMpuEmu] = useState(false);
  const [mpuAutoMotion, setMpuAutoMotion] = useState(false);
  const [mpuEmuPeriodMs, setMpuEmuPeriodMs] = useState(100);
  const [mpuEmuEuler, setMpuEmuEuler] = useState<EulerDeg>({
    yaw: 0,
    pitch: 0,
    roll: 0,
  });
  const [lastMpuSampleDtUs, setLastMpuSampleDtUs] = useState<number | null>(
    null,
  );
  const [mpuStatus, setMpuStatus] = useState<StreamStatus>(() =>
    createStreamStatus("MPU stream detenido."),
  );
  const [irStatus, setIrStatus] = useState<StreamStatus>(() =>
    createStreamStatus("IR stream detenido."),
  );
  const [irSnapshot, setIrSnapshot] = useState<IrSnapshot>(() =>
    createIdleIrSnapshot(DEFAULT_IR_PERIOD_MS),
  );
  const [mpuRequested, setMpuRequested] = useState(false);
  const [irRequested, setIrRequested] = useState(false);
  const mpuRequestedRef = useRef(false);
  const irRequestedRef = useRef(false);
  const mpuSampleConfirmedRef = useRef(false);
  const irSampleConfirmedRef = useRef(false);
  const mpuSubscription = useSensorSubscription(
    "mpu",
    mpuRequested && !mpuEmu,
    mpuPeriodMs,
  );
  const irSubscription = useSensorSubscription(
    "ir",
    irRequested && !irEmu,
    irPeriodMs,
  );

  const activeMpuEuler = mpuEmu ? mpuEmuEuler : mpuEulerRaw;

  const effectiveRenderEuler = useMemo(() => {
    if (!renderLink || freezePose) {
      return renderEuler;
    }

    return relativeRigEulerDeg(activeMpuEuler, zeroOffset);
  }, [activeMpuEuler, freezePose, renderEuler, renderLink, zeroOffset]);
  const mpuMagValid = mpuEmu
    ? true
    : mpuStatus.lastFlags === null
      ? null
      : (mpuStatus.lastFlags & F4_MPU_FLAGS.MAG_VALID) !== 0;

  const irForwardCalibration = useMemo(
    () => buildIrForwardCalibration(irCalibrationProfile),
    [irCalibrationProfile],
  );
  const irObjectEstimate = useMemo(
    () =>
      estimateIrObjectPosition(
        pickObjectSensorReadings(irSnapshot.norm),
        sensorSensitivityCm,
        { calibration: irForwardCalibration },
      ),
    [irForwardCalibration, irSnapshot.norm, sensorSensitivityCm],
  );
  const irSceneNorm = useMemo(() => {
    if (!irForwardCalibration) {
      return irSnapshot.norm;
    }

    const normalized = { ...irSnapshot.norm };
    IR_OBJECT_SENSOR_KEYS.forEach((key) => {
      normalized[key] = Math.round(
        normalizeIrObjectReading(
          key,
          irSnapshot.norm[key],
          irForwardCalibration,
        ) * IR_NORM_MAX,
      );
    });
    return normalized;
  }, [irForwardCalibration, irSnapshot.norm]);

  const mpuHz = periodToHz(mpuPeriodMs);
  const irHz = periodToHz(irPeriodMs);
  const systemMode =
    mpuEmu && irEmu
      ? "MPU + IR simulados"
      : mpuEmu
        ? "MPU simulado"
        : irEmu
          ? "IR simulado"
          : connected
            ? "Real"
            : "Sin conexión";

  useEffect(() => {
    if (renderLink && !freezePose) {
      setRenderEuler(relativeRigEulerDeg(activeMpuEuler, zeroOffset));
    }
  }, [activeMpuEuler, freezePose, renderLink, zeroOffset]);

  useEffect(() => {
    setSensorRefreshInterval(normalizeMpuPeriodMs(mpuPeriodMs));
  }, [mpuPeriodMs, setSensorRefreshInterval]);

  useEffect(() => {
    const offMpu = subscribeEvent("mpuSample", ({ data }) => {
      if (!mpuRequestedRef.current) return;
      try {
        const telemetry = parseMpuData(data);
        if (!telemetry.valid) {
          setMpuStatus((current) => ({ ...current, statusText: `MPU sin muestra valida (status ${telemetry.status}).` }));
          return;
        }
        mpuSampleConfirmedRef.current = true;
        setMpuEulerRaw({ yaw: telemetry.eulerDeg.yaw, pitch: telemetry.eulerDeg.pitch, roll: telemetry.eulerDeg.roll });
        setLastMpuSampleDtUs(telemetry.sampleDtUs);
        setMpuStatus((current) => ({
          ...current, active: true, pending: false,
          packetsReceived: current.packetsReceived + 1,
          lastSeq: telemetry.sampleSeq, lastStatus: telemetry.status,
          lastFlags: telemetry.flags, updatedAt: Date.now(), statusText: "MPU API v1 recibido.",
        }));
      } catch (cause) {
        setMpuStatus((current) => ({ ...current, statusText: cause instanceof Error ? cause.message : "MPU invalido." }));
      }
    });
    const offIr = subscribeEvent("irSample", ({ data }) => {
      if (!irRequestedRef.current) return;
      try {
        const snapshot = parseIrData(data);
        irSampleConfirmedRef.current = true;
        setIrSnapshot(snapshot);
        setIrStatus((current) => ({
          ...current, active: true, pending: false,
          packetsReceived: current.packetsReceived + 1,
          lastSeq: snapshot.sampleSeq, lastStatus: snapshot.status,
          lastFlags: snapshot.flags, updatedAt: Date.now(), ackPeriodMs: snapshot.periodMs,
          statusText: "IR API v1 recibido.",
        }));
      } catch (cause) {
        setIrStatus((current) => ({ ...current, statusText: cause instanceof Error ? cause.message : "IR invalido." }));
      }
    });
    return () => { offMpu(); offIr(); };
  }, [subscribeEvent]);

  useEffect(() => {
    const confirmedBySample = mpuSampleConfirmedRef.current;
    setMpuStatus((current) => ({
      ...current,
      active: mpuSubscription.error && !confirmedBySample ? false : mpuSubscription.active || current.active,
      pending: mpuSubscription.error ? false : mpuSubscription.state === "subscribing" && !current.active,
      ackPeriodMs: mpuSubscription.active ? mpuSubscription.periodMs : 0,
      statusText: mpuSubscription.error
        ? confirmedBySample
          ? "MPU en streaming confirmado por muestras; no llego el ACK final."
          : formatStreamSubscriptionError("MPU", mpuSubscription.error)
        : mpuSubscription.active
          ? "Suscripcion MPU confirmada por F4."
          : current.statusText,
    }));
  }, [mpuSubscription.active, mpuSubscription.error, mpuSubscription.periodMs, mpuSubscription.state]);

  useEffect(() => {
    const confirmedBySample = irSampleConfirmedRef.current;
    setIrStatus((current) => ({
      ...current,
      active: irSubscription.error && !confirmedBySample ? false : irSubscription.active || current.active,
      pending: irSubscription.error ? false : irSubscription.state === "subscribing" && !current.active,
      ackPeriodMs: irSubscription.active ? irSubscription.periodMs : 0,
      statusText: irSubscription.error
        ? confirmedBySample
          ? "IR en streaming confirmado por muestras; no llego el ACK final."
          : formatStreamSubscriptionError("IR", irSubscription.error)
        : irSubscription.active
          ? "Suscripcion IR confirmada por F4."
          : current.statusText,
    }));
  }, [irSubscription.active, irSubscription.error, irSubscription.periodMs, irSubscription.state]);

  useEffect(() => {
    if (!connected) {
      setMpuStatus((current) => ({
        ...current,
        active: false,
        pending: false,
        statusText: "WebSocket desconectado. MPU detenido en UI.",
      }));
      setIrStatus((current) => ({
        ...current,
        active: false,
        pending: false,
        statusText: "WebSocket desconectado. IR detenido en UI.",
      }));
    }
  }, [connected]);

  const sendMpuStream = useCallback(
    (enable: boolean, reason: string) => {
      void reason;
      mpuRequestedRef.current = enable;
      mpuSampleConfirmedRef.current = false;
      setMpuRequested(enable);
      setMpuStatus((current) => ({
        ...current,
        active: enable ? current.active : false,
        pending: enable,
        ackActive: enable ? current.ackActive : false,
        statusText: enable
          ? `Solicitando MPU cada ${normalizeMpuPeriodMs(mpuPeriodMs)} ms al broker ESP.`
          : "Liberando suscripcion MPU de esta vista.",
      }));
    },
    [mpuPeriodMs],
  );

  const sendIrStream = useCallback(
    (enable: boolean, reason: string) => {
      void reason;
      const nextPeriod = normalizeIrStreamPeriodMs(irPeriodMs);

      if (irEmu) {
        setIrStatus((current) => ({
          ...current,
          active: enable,
          pending: false,
          ackPeriodMs: nextPeriod,
          statusText: enable
            ? "IR emulado activo. No se envia comando real."
            : "IR emulado detenido.",
        }));
        return;
      }

      irRequestedRef.current = enable;
      irSampleConfirmedRef.current = false;
      setIrRequested(enable);
      setIrStatus((current) => ({
        ...current,
        active: enable ? current.active : false,
        pending: enable,
        ackActive: enable ? current.ackActive : false,
        ackPeriodMs: enable ? nextPeriod : 0,
        statusText: enable
          ? `Solicitando IR cada ${nextPeriod} ms al broker ESP.`
          : "Liberando suscripcion IR de esta vista.",
      }));
    },
    [irEmu, irPeriodMs],
  );

  function handleRenderLinkToggle() {
    setRenderLink((current) => {
      const next = !current;
      if (!next) {
        setRenderEuler(effectiveRenderEuler);
      }
      return next;
    });
  }

  function handleFreezePoseToggle() {
    setFreezePose((current) => {
      const next = !current;
      if (next) {
        setRenderEuler(effectiveRenderEuler);
      }
      return next;
    });
  }

  function handleIrEmuToggle() {
    const next = !irEmu;
    setIrEmu(next);
    sceneRef.current?.clearIrTarget();

    if (next) {
      irRequestedRef.current = false;
      irSampleConfirmedRef.current = false;
      setIrRequested(false);

      setIrStatus((current) => ({
        ...current,
        active: false,
        pending: false,
        statusText:
          "IR emulado listo. Ubicá un objeto: quedará fijo al mover el auto.",
      }));
    } else {
      setIrSnapshot(createIdleIrSnapshot(irPeriodMs));
      setIrStatus((current) => ({
        ...current,
        active: false,
        statusText: "IR real listo para iniciar stream.",
      }));
    }
  }

  function handleZeroMpu() {
    setZeroOffset(activeMpuEuler);
    setRenderEuler({ yaw: 0, pitch: 0, roll: 0 });
  }

  function handleClearIr() {
    setIrSnapshot(createIdleIrSnapshot(irPeriodMs));
    sceneRef.current?.clearIrTarget();
    setIrStatus((current) => ({
      ...current,
      statusText: irEmu
        ? "Detecciones IR emuladas limpiadas."
        : "Detecciones IR limpiadas en UI.",
    }));
  }

  function handleCameraPreset(preset: SensorCameraPreset) {
    sceneRef.current?.setCameraPreset(preset);
  }

  const updateIrEmulation = useCallback(
    (point: IrObjectPoint) => {
      irEmuSequenceRef.current = (irEmuSequenceRef.current + 1) & 0xffff;
      const simulated = simulateIrObjectReadings(
        point,
        sensorSensitivityCm,
        { calibration: irForwardCalibration },
      );
      setIrSnapshot(
        createEmulatedIrSnapshot(
          simulated.readings,
          irPeriodMs,
          irEmuSequenceRef.current,
        ),
      );
      setIrStatus((current) => ({
        ...current,
        active: true,
        packetsReceived: current.packetsReceived + 1,
        lastSeq: (current.lastSeq ?? 0) + 1,
        lastStatus: 0,
        lastFlags: 0x03,
        ackActive: true,
        ackPeriodMs: irPeriodMs,
        updatedAt: Date.now(),
        statusText:
          simulated.supportCount >= 2
            ? `IR emulado: interseccion de ${simulated.supportCount} conos.`
            : simulated.supportCount === 1
              ? "IR emulado: un cono activo, posicion ambigua."
              : "IR emulado: objeto fuera de cobertura.",
      }));
    },
    [irForwardCalibration, irPeriodMs, sensorSensitivityCm],
  );

  const handleIrCalibrationProfileChange = useCallback(
    (profile: IrCalibrationProfile) => {
      setIrCalibrationProfile(profile);
      try {
        window.localStorage.setItem(
          IR_CALIBRATION_STORAGE_KEY,
          serializeIrCalibrationProfile(profile),
        );
      } catch {
        // La calibración sigue activa en memoria aunque el navegador no permita persistirla.
      }
    },
    [],
  );

  return (
    <section className="sensor-dashboard-shell" data-active="true">
      <div className="sensor-dashboard-grid-bg" aria-hidden="true" />
      <div className="sensor-dashboard-frame">
        <PageHeader
          className="app-page-header sensor-dashboard-header home-page-header"
          titleOverride="Panel MPU + IR"
          leadingSlot={<SensorBrandGlyph />}
          setOpenSettingsModal={setOpenSettingsModal}
          setOpenInfoModal={setOpenInfoModal}
        />

        <SensorHeaderStatus
          connected={connected}
          mpuHz={mpuHz}
          irHz={irHz}
          mpuPeriodMs={mpuPeriodMs}
          irPeriodMs={irPeriodMs}
        />

        <SensorConnectionBar
          connected={connected}
          mpuStatus={mpuStatus}
          irStatus={irStatus}
          renderLink={renderLink}
          onOpenCalibration={() => setOpenIrCalibrationModal(true)}
        />

        <SensorBottomConsole
          connected={connected}
          mpuStatus={mpuStatus}
          irStatus={irStatus}
          mpuPeriodMs={mpuPeriodMs}
          irPeriodMs={irPeriodMs}
          irEmu={irEmu}
          mpuEmu={mpuEmu}
          mpuAutoMotion={mpuAutoMotion}
          mpuRequested={mpuRequested}
          irRequested={irRequested}
          controlMode={controlMode}
          onControlModeChange={setControlMode}
          onMpuPeriodChange={setMpuPeriodMs}
          onIrPeriodChange={(value) =>
            setIrPeriodMs(normalizeIrStreamPeriodMs(value))
          }
          onMpuToggle={() => sendMpuStream(!mpuRequested, "bottom-toggle")}
          onIrToggle={() => sendIrStream(!irRequested, "bottom-toggle")}
          onIrEmuToggle={handleIrEmuToggle}
          onMpuEmuToggle={() => {
            setMpuEmu((current) => {
              const next = !current;
              setMpuAutoMotion(false);
              setZeroOffset({ yaw: 0, pitch: 0, roll: 0 });
              if (next) {
                mpuRequestedRef.current = false;
                mpuSampleConfirmedRef.current = false;
                setMpuRequested(false);
                setRenderLink(true);
                setMpuEmuEuler(effectiveRenderEuler);
              }
              return next;
            });
          }}
          onMpuAutoMotionToggle={() => setMpuAutoMotion((current) => !current)}
          onZeroMpu={handleZeroMpu}
        />

        <div className="sensor-dashboard-main">
          <SensorToolbox
            showGrid={showGrid}
            showBubble={showBubble}
            showOrigin={showOrigin}
            freezePose={freezePose}
            renderLink={renderLink}
            onPreset={handleCameraPreset}
            onResetCamera={() => sceneRef.current?.resetCamera()}
            onToggleFreeze={handleFreezePoseToggle}
            onToggleGrid={() => setShowGrid((current) => !current)}
            onToggleBubble={() => setShowBubble((current) => !current)}
            onToggleOrigin={() => setShowOrigin((current) => !current)}
            onToggleRenderLink={handleRenderLinkToggle}
            onClear={handleClearIr}
          />

          <main className="sensor-dashboard-stage" aria-label="Escena MPU e IR">
            <MpuIrScene3D
              ref={sceneRef}
              modelUrl={modelUrl}
              eulerDeg={effectiveRenderEuler}
              irNorm={irSceneNorm}
              showGrid={showGrid}
              showBubble={showBubble}
              showOrigin={showOrigin}
              sensorSensitivityCm={sensorSensitivityCm}
              irSamplePeriodMs={irPeriodMs}
              renderLink={renderLink}
              freezePose={freezePose}
              irEmu={irEmu}
              estimatedTarget={irObjectEstimate}
              onEmulatedTarget={updateIrEmulation}
            />
            <SensorCanvasTelemetry irSnapshot={irSnapshot} />
            <SensorSensitivityControl
              valueCm={sensorSensitivityCm}
              onChange={setSensorSensitivityCm}
            />
          </main>

          <SensorStatusPanel
            connected={connected}
            systemMode={systemMode}
            mpuEulerRaw={activeMpuEuler}
            renderEuler={effectiveRenderEuler}
            mpuMagValid={mpuMagValid}
            mpuStatus={mpuStatus}
            irStatus={irStatus}
            irSnapshot={irSnapshot}
            irObjectEstimate={irObjectEstimate}
            lastMpuSampleDtUs={lastMpuSampleDtUs}
          />
        </div>

        <RealtimeEulerPanel
          eulerDeg={effectiveRenderEuler}
          sampleMs={Math.max(100, mpuPeriodMs)}
          sensorIntervalTime={mpuPeriodMs}
          maxPoints={100}
          heightPx={160}
        />

        {mpuEmu ? (
          <MpuSimulationWorkbench
            eulerDeg={mpuEmuEuler}
            autoMotion={mpuAutoMotion}
            periodMs={mpuEmuPeriodMs}
            onEulerChange={setMpuEmuEuler}
            onPeriodChange={setMpuEmuPeriodMs}
          />
        ) : null}
      </div>

      {openIrCalibrationModal ? (
        <Modal
          isOpen={openIrCalibrationModal}
          onClose={() => setOpenIrCalibrationModal(false)}
          closeOnOverlayClick={false}
          containerClassnames="ir-calibration-modal-content"
        >
          <IrCalibrationWorkbench
            profile={irCalibrationProfile}
            snapshot={irSnapshot}
            captureAvailable={connected && irStatus.active && !irEmu}
            onProfileChange={handleIrCalibrationProfileChange}
          />
        </Modal>
      ) : null}

      {openInfoModal ? (
        <Modal
          isOpen={openInfoModal}
          onClose={() => setOpenInfoModal(false)}
          closeOnOverlayClick={false}
        >
          <div className="sensor-modal-copy">
            <div className="home-kicker">Info</div>
            <h2>Panel MPU + IR</h2>
            <p>
              Esta pantalla funciona como hub 3D de sensores. El MPU actualiza
              la orientacion del vehiculo y el canal IR pinta obstaculos, linea
              de piso y estado del seguimiento dentro de la misma escena.
            </p>
            <p>
              El enlace MPU al render conecta o desacopla la telemetria del
              modelo. Los simuladores MPU e IR permiten probar orientación y
              detección sin depender del firmware.
            </p>
          </div>
        </Modal>
      ) : null}

      {openSettingsModal ? (
        <Modal
          isOpen={openSettingsModal}
          onClose={() => setOpenSettingsModal(false)}
          closeOnOverlayClick={false}
          containerClassnames="home-settings-dialog flex flex-col"
        >
          <ThemeModeToggleCard />
          <HdAssetsSettingsCard />
          <div className="sensor-modal-copy">
            <div className="home-kicker">Config</div>
            <h2>Frecuencias de streaming</h2>
            <label>
              MPU periodo ms
              <input
                className="sensor-console-input"
                type="number"
                min={MIN_MPU_STREAM_PERIOD_MS}
                max={F4_STREAM_LIMITS.MAX_PERIOD_MS}
                value={mpuPeriodMs}
                onChange={(event) =>
                  setMpuPeriodMs(
                    normalizeMpuPeriodMs(Number(event.target.value)),
                  )
                }
              />
            </label>
            <label>
              IR periodo ms
              <input
                className="sensor-console-input"
                type="number"
                min={IR_STREAM_LIMITS.MIN_PERIOD_MS}
                max={IR_STREAM_LIMITS.MAX_PERIOD_MS}
                value={irPeriodMs}
                onChange={(event) =>
                  setIrPeriodMs(
                    normalizeIrStreamPeriodMs(Number(event.target.value)),
                  )
                }
              />
            </label>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function SensorBrandGlyph() {
  return (
    <span className="home-brand-glyph" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="m12 2 8 4.5v9L12 20l-8-4.5v-9L12 2Z" />
        <path d="M4 6.5 12 11l8-4.5" />
        <path d="M12 11v9" />
      </svg>
    </span>
  );
}

function SensorHeaderStatus({
  connected,
  mpuHz,
  irHz,
  mpuPeriodMs,
  irPeriodMs,
}: {
  connected: boolean;
  mpuHz: number;
  irHz: number;
  mpuPeriodMs: number;
  irPeriodMs: number;
}) {
  const { status: espWifiStatus } = useEspWifiStatus();

  return (
    <SectionStatusStrip
      ariaLabel="Estado MPU e IR"
      className="sensor-status-strip"
      items={[
        {
          label: "Conexión",
          value: connected ? getEspConnectionLabel(espWifiStatus) : "Sin WiFi",
          detail: connected ? getEspConnectionDetail(espWifiStatus) : undefined,
          tone: connected ? "ok" : "error",
        },
        { label: "FW", value: "UNER v2", tone: "info" },
        { label: "MPU", value: `${mpuHz} Hz`, detail: `${mpuPeriodMs} ms refresco`, tone: "info" },
        { label: "IR", value: `${irHz} Hz`, detail: `${irPeriodMs} ms refresco`, tone: "info" },
      ]}
    />
  );
}

function HeaderPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "error" | "info" | "muted";
}) {
  return (
    <span className={`home-status-pill home-status-pill--${tone}`}>
      <span className={`home-status-dot home-status-dot--${tone}`} />
      {label}: <strong className="home-status-pill__value">{value}</strong>
    </span>
  );
}

function SensorConnectionBar({
  connected,
  mpuStatus,
  irStatus,
  renderLink,
  onOpenCalibration,
}: {
  connected: boolean;
  mpuStatus: StreamStatus;
  irStatus: StreamStatus;
  renderLink: boolean;
  onOpenCalibration: () => void;
}) {
  return (
    <section className="sensor-connection-bar" aria-label="Conexion del sistema">
      <div className="sensor-connection-bar__main">
        <span
          className={
            connected
              ? "home-status-dot home-status-dot--ok"
              : "home-status-dot home-status-dot--error"
          }
        />
        <div>
          <span>Conexion del sistema</span>
          <strong>{connected ? "WiFi/WebSocket activo" : "Sin conexion activa"}</strong>
        </div>
      </div>

      <div className="sensor-connection-bar__metrics">
        <HeaderPill
          label="MPU"
          value={
            mpuStatus.pending
              ? "Enviando"
              : mpuStatus.active
                ? "Stream"
                : "Detenido"
          }
          tone={mpuStatus.active ? "ok" : mpuStatus.pending ? "info" : "muted"}
        />
        <HeaderPill
          label="IR"
          value={
            irStatus.pending
              ? "Enviando"
              : irStatus.active
                ? "Stream"
                : "Detenido"
          }
          tone={irStatus.active ? "ok" : irStatus.pending ? "info" : "muted"}
        />
        <HeaderPill
          label="Render"
          value={renderLink ? "Enlazado" : "Libre"}
          tone={renderLink ? "ok" : "muted"}
        />
      </div>

      <button
        type="button"
        className="sensor-connection-action"
        title="Captura puntos ADC y genera la curva de calibración IR."
        onClick={onOpenCalibration}
      >
        <SensorIcon name="signal" />
        Calibrar sensores
      </button>
    </section>
  );
}

function SensorToolbox({
  showGrid,
  showBubble,
  showOrigin,
  freezePose,
  renderLink,
  onPreset,
  onResetCamera,
  onToggleFreeze,
  onToggleGrid,
  onToggleBubble,
  onToggleOrigin,
  onToggleRenderLink,
  onClear,
}: {
  showGrid: boolean;
  showBubble: boolean;
  showOrigin: boolean;
  freezePose: boolean;
  renderLink: boolean;
  onPreset: (preset: SensorCameraPreset) => void;
  onResetCamera: () => void;
  onToggleFreeze: () => void;
  onToggleGrid: () => void;
  onToggleBubble: () => void;
  onToggleOrigin: () => void;
  onToggleRenderLink: () => void;
  onClear: () => void;
}) {
  return (
    <aside className="sensor-toolbox" aria-label="Herramientas de escena">
      <h2>Herramientas</h2>
      <ToolButton label="Vista isométrica" icon="cube" onClick={() => onPreset("iso")} />
      <ToolButton label="Vista superior" icon="target" onClick={() => onPreset("top")} />
      <ToolButton label="Vista frontal" icon="frame" onClick={() => onPreset("front")} />
      <ToolButton label="Restablecer cámara" icon="focus" onClick={onResetCamera} />
      <ToolButton
        label="Congelar pose"
        icon="snow"
        active={freezePose}
        title="Mantiene fija la orientación del modelo mientras la telemetría continúa actualizándose."
        onClick={onToggleFreeze}
      />
      <ToolButton label="Cuadrícula" icon="grid" active={showGrid} onClick={onToggleGrid} />
      <ToolButton label="Haz sensado" icon="orbit" active={showBubble} onClick={onToggleBubble} />
      <ToolButton
        label={showOrigin ? "Esconder origen" : "Mostrar origen"}
        icon="origin"
        active={showOrigin}
        onClick={onToggleOrigin}
      />
      <ToolButton
        label="MPU Render"
        icon="link"
        active={renderLink}
        title="Enlaza o desacopla la orientación MPU del modelo 3D."
        onClick={onToggleRenderLink}
      />
      <ToolButton label="Limpiar sensores" icon="trash" danger onClick={onClear} />
    </aside>
  );
}

function ToolButton({
  label,
  icon,
  active,
  danger = false,
  title,
  onClick,
}: {
  label: string;
  icon: SensorIconName;
  active?: boolean;
  danger?: boolean;
  title?: string;
  onClick: () => void;
}) {
  const isToggle = typeof active === "boolean";
  const isActive = active === true;
  const className = `sensor-tool-button ${isActive ? "sensor-tool-button--active" : ""} ${
    danger ? "sensor-tool-button--danger" : ""
  }`;

  if (isToggle) {
    return (
      <label className={className} title={title}>
        <SensorIcon name={icon} />
        <span>{label}</span>
        <input
          type="checkbox"
          className="sensor-tool-check"
          checked={isActive}
          onChange={() => onClick()}
        />
      </label>
    );
  }

  return (
    <button
      type="button"
      className={className}
      title={title}
      onClick={onClick}
    >
      <SensorIcon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function SensorStatusPanel({
  connected,
  systemMode,
  mpuEulerRaw,
  renderEuler,
  mpuMagValid,
  mpuStatus,
  irStatus,
  irSnapshot,
  irObjectEstimate,
  lastMpuSampleDtUs,
}: {
  connected: boolean;
  systemMode: string;
  mpuEulerRaw: EulerDeg;
  renderEuler: EulerDeg;
  mpuMagValid: boolean | null;
  mpuStatus: StreamStatus;
  irStatus: StreamStatus;
  irSnapshot: IrSnapshot;
  irObjectEstimate: IrObjectPositionEstimate;
  lastMpuSampleDtUs: number | null;
}) {
  return (
    <aside className="sensor-status-panel" aria-label="Estado del sistema">
      <PanelBlock title="Estado del sistema" icon="signal">
        <StatusRow label="Guiñada (Yaw magnético relativo)" value={`${formatSigned(renderEuler.yaw)}°`} tone="info" />
        <StatusRow label="Cabeceo (Pitch)" value={`${formatSigned(renderEuler.pitch)}°`} tone="info" />
        <StatusRow label="Alabeo (Roll)" value={`${formatSigned(renderEuler.roll)}°`} tone="info" />
        <StatusRow
          label="Magnetómetro AK8963"
          value={mpuMagValid === null ? "Sin datos" : mpuMagValid ? "Válido" : "Sin referencia"}
          tone={mpuMagValid === null ? "muted" : mpuMagValid ? "ok" : "error"}
        />
        <StatusRow label="Flujo MPU" value={mpuStatus.active ? "Activo" : "Detenido"} tone={mpuStatus.active ? "ok" : "muted"} />
        <StatusRow label="Flujo IR" value={irStatus.active ? "Activo" : "Detenido"} tone={irStatus.active ? "ok" : "muted"} />
        <StatusRow label="Paquetes MPU / IR" value={`${mpuStatus.packetsReceived} / ${irStatus.packetsReceived}`} />
        <StatusRow label="Latencia" value={formatMpuLatency(lastMpuSampleDtUs)} />
        <StatusRow label="Protocolo" value="UNER v2" tone="info" />
        <StatusRow label="Modo" value={systemMode} tone={connected ? "info" : "muted"} />
      </PanelBlock>

      <PanelBlock title="Seguimiento de línea" icon="frame">
        <StatusRow label="Patrón" value={formatHexByte(irSnapshot.linePattern)} tone="info" />
        <StatusRow label="Alineación" value={`RUTA_${irSnapshot.lineAlignment}`} />
        <StatusRow label="Confianza" value={`${irSnapshot.confidence}%`} tone="ok" />
        <StatusRow label="Ambiguo" value={irSnapshot.ambiguous ? "SÍ" : "NO"} tone={irSnapshot.ambiguous ? "error" : "ok"} />
        <StatusRow label="Ancho detectado" value={`${irSnapshot.lineWidthMm} mm`} />
        <StatusRow label="Error lateral" value={`${formatDecimal(irSnapshot.lateralErrorMm, 1)} mm`} />
        <StatusRow label="Error normalizado" value={formatDecimal(irSnapshot.lateralErrorNorm, 2)} />
        <StatusRow label="Yaw magnético sin cero local" value={`${formatDecimal(mpuEulerRaw.yaw, 1)}°`} />
      </PanelBlock>

      <PanelBlock title="Posición estimada" icon="target">
        <StatusRow
          label="Detección"
          value={irObjectEstimate.detected ? "OBJETO" : "SIN OBJETO"}
          tone={irObjectEstimate.detected ? "ok" : "muted"}
        />
        <StatusRow
          label="Lateral"
          value={
            irObjectEstimate.detected
              ? `${formatSigned(irObjectEstimate.lateralCm)} cm`
              : "--"
          }
          tone="info"
        />
        <StatusRow
          label="Frente"
          value={
            irObjectEstimate.detected
              ? `${formatDecimal(irObjectEstimate.forwardCm, 2)} cm`
              : "--"
          }
        />
        <StatusRow
          label="Rumbo"
          value={
            irObjectEstimate.detected
              ? `${formatSigned(irObjectEstimate.bearingDeg)}°`
              : "--"
          }
        />
        <StatusRow
          label="Conos activos"
          value={`${irObjectEstimate.supportCount}/5 · ${formatObjectMask(irObjectEstimate.activeMask)}`}
          tone={irObjectEstimate.supportCount >= 2 ? "ok" : "muted"}
        />
        <StatusRow
          label="Confianza"
          value={`${Math.round(irObjectEstimate.confidence * 100)}%`}
          tone={irObjectEstimate.confidence >= 0.5 ? "ok" : "muted"}
        />
        <StatusRow
          label="Solución"
          value={irObjectEstimate.ambiguous ? "AMBIGUA" : "LOCALIZADA"}
          tone={irObjectEstimate.ambiguous ? "error" : "ok"}
        />
        <StatusRow
          label="Incertidumbre"
          value={
            irObjectEstimate.detected
              ? `±${formatDecimal(irObjectEstimate.uncertaintyCm, 2)} cm`
              : "--"
          }
        />
      </PanelBlock>
    </aside>
  );
}

function SensorCanvasTelemetry({
  irSnapshot,
}: {
  irSnapshot: IrSnapshot;
}) {
  return (
    <div className="sensor-canvas-telemetry" aria-label="Lecturas IR sobre la escena">
      <VerticalSensorGroup
        title="Sensores de objetos"
        tone="rose"
        channels={OBJECT_CHANNELS}
        values={irSnapshot.norm}
      />
      <VerticalSensorGroup
        title="Sensores de línea"
        tone="cyan"
        channels={FLOOR_CHANNELS}
        values={irSnapshot.norm}
      />
    </div>
  );
}

function SensorSensitivityControl({
  valueCm,
  onChange,
}: {
  valueCm: number;
  onChange: (value: number) => void;
}) {
  return (
    <section
      className="sensor-sensitivity-control"
      aria-label="Sensibilidad del haz IR"
    >
      <header>
        <span>Sensibilidad IR</span>
        <strong>{formatDecimal(valueCm, 1)} cm</strong>
      </header>
      <input
        type="range"
        min={SENSOR_SENSITIVITY_MIN_CM}
        max={SENSOR_SENSITIVITY_MAX_CM}
        step={0.5}
        value={valueCm}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="sensor-sensitivity-control__meta">
        <span>Frente del auto</span>
        <span>{`Detección ΔADC ≥ ${IR_OBJECT_DETECTION_THRESHOLD}`}</span>
      </div>
    </section>
  );
}

function VerticalSensorGroup({
  title,
  tone,
  channels,
  values,
}: {
  title: string;
  tone: "cyan" | "rose";
  channels: Array<{
    key: IrSensorKey;
    label: string;
    shortLabel: string;
  }>;
  values: Record<IrSensorKey, number>;
}) {
  return (
    <section className={`sensor-vertical-group sensor-vertical-group--${tone}`}>
      <header>
        <strong>{title}</strong>
        <span>0–4095</span>
      </header>
      <div className="sensor-vertical-group__bars">
        {channels.map((channel) => (
          <VerticalSensorBar
            key={channel.key}
            label={channel.label}
            shortLabel={channel.shortLabel}
            value={values[channel.key]}
            tone={tone}
          />
        ))}
      </div>
    </section>
  );
}

function VerticalSensorBar({
  label,
  shortLabel,
  value,
  tone,
}: {
  label: string;
  shortLabel: string;
  value: number;
  tone: "cyan" | "rose";
}) {
  const normalizedValue = Math.round(
    Math.max(0, Math.min(IR_NORM_MAX, value)),
  );
  const percent = Math.round(clamp01(normalizedValue / IR_NORM_MAX) * 100);

  return (
    <div className="sensor-vertical-bar" title={`${label}: ${normalizedValue}`}>
      <strong>{normalizedValue}</strong>
      <div className={`sensor-vertical-bar__track sensor-vertical-bar__track--${tone}`}>
        <i style={{ height: `${percent}%` }} />
      </div>
      <span>{shortLabel}</span>
    </div>
  );
}

function PanelBlock({
  title,
  icon,
  children,
}: {
  title: string;
  icon: SensorIconName;
  children: ReactNode;
}) {
  return (
    <section className="sensor-side-block">
      <header>
        <span>{title}</span>
        <SensorIcon name={icon} />
      </header>
      <div className="sensor-side-block__body">{children}</div>
    </section>
  );
}

function StatusRow({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "ok" | "error" | "info" | "muted";
}) {
  return (
    <div className="sensor-status-row">
      <span>{label}</span>
      <strong className={`sensor-status-row__value sensor-tone-${tone}`}>
        {value}
      </strong>
    </div>
  );
}

function SensorBottomConsole({
  connected,
  mpuStatus,
  irStatus,
  mpuPeriodMs,
  irPeriodMs,
  irEmu,
  mpuEmu,
  mpuAutoMotion,
  mpuRequested,
  irRequested,
  controlMode,
  onControlModeChange,
  onMpuPeriodChange,
  onIrPeriodChange,
  onMpuToggle,
  onIrToggle,
  onIrEmuToggle,
  onMpuEmuToggle,
  onMpuAutoMotionToggle,
  onZeroMpu,
}: {
  connected: boolean;
  mpuStatus: StreamStatus;
  irStatus: StreamStatus;
  mpuPeriodMs: number;
  irPeriodMs: number;
  irEmu: boolean;
  mpuEmu: boolean;
  mpuAutoMotion: boolean;
  mpuRequested: boolean;
  irRequested: boolean;
  controlMode: SensorControlMode;
  onControlModeChange: (mode: SensorControlMode) => void;
  onMpuPeriodChange: (value: number) => void;
  onIrPeriodChange: (value: number) => void;
  onMpuToggle: () => void;
  onIrToggle: () => void;
  onIrEmuToggle: () => void;
  onMpuEmuToggle: () => void;
  onMpuAutoMotionToggle: () => void;
  onZeroMpu: () => void;
}) {
  const [expandedPanels, setExpandedPanels] = useState<Record<SensorControlMode, boolean>>({
    real: false,
    simulated: false,
  });

  function togglePanel(mode: SensorControlMode) {
    setExpandedPanels((current) => ({ ...current, [mode]: !current[mode] }));
  }

  function handleControlModeChange(nextMode: SensorControlMode) {
    onControlModeChange(nextMode);
    setExpandedPanels({ real: false, simulated: false });
  }

  function handleControlModeKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const nextMode: SensorControlMode =
      event.key === "ArrowLeft" || event.key === "Home" ? "real" : "simulated";
    handleControlModeChange(nextMode);
    window.requestAnimationFrame(() => {
      document.getElementById(`sensor-control-${nextMode}-tab`)?.focus();
    });
  }

  return (
    <footer
      className="sensor-bottom-console"
      aria-label="Controles principales"
    >
      <div
        className="sensor-console-tabs"
        role="tablist"
        aria-label="Fuente de control"
      >
        <button
          id="sensor-control-real-tab"
          type="button"
          role="tab"
          aria-selected={controlMode === "real"}
          aria-controls="sensor-control-real-panel"
          tabIndex={controlMode === "real" ? 0 : -1}
          className={`sensor-console-tab sensor-console-tab--real ${
            controlMode === "real" ? "sensor-console-tab--active" : ""
          }`}
          onClick={() => handleControlModeChange("real")}
          onKeyDown={handleControlModeKeyDown}
        >
          <span className="sensor-console-tab__indicator" aria-hidden="true" />
          <span className="sensor-console-tab__copy">
            <strong>Control real</strong>
            <small>WebSocket · STM32</small>
          </span>
          <span
            className={`sensor-console-tab__state ${
              connected ? "sensor-tone-ok" : "sensor-tone-error"
            }`}
          >
            {connected ? "Conectado" : "Sin conexión"}
          </span>
        </button>

        <button
          id="sensor-control-simulated-tab"
          type="button"
          role="tab"
          aria-selected={controlMode === "simulated"}
          aria-controls="sensor-control-simulated-panel"
          tabIndex={controlMode === "simulated" ? 0 : -1}
          className={`sensor-console-tab sensor-console-tab--simulated ${
            controlMode === "simulated" ? "sensor-console-tab--active" : ""
          }`}
          onClick={() => handleControlModeChange("simulated")}
          onKeyDown={handleControlModeKeyDown}
        >
          <span className="sensor-console-tab__indicator" aria-hidden="true" />
          <span className="sensor-console-tab__copy">
            <strong>Simulado</strong>
            <small>Pruebas sin hardware</small>
          </span>
          <span className="sensor-console-tab__state sensor-tone-info">
            Local
          </span>
        </button>
      </div>

      <section
        id="sensor-control-real-panel"
        role="tabpanel"
        aria-labelledby="sensor-control-real-tab"
        className="sensor-console-group sensor-console-group--real"
        hidden={controlMode !== "real"}
      >
        <header className="sensor-console-group__header">
          <div>
            <span>Control real</span>
            <strong>WebSocket y telemetría STM32</strong>
          </div>
          <div className="sensor-console-group__header-actions">
            <span
              className={
                connected
                  ? "sensor-console-group__state sensor-tone-ok"
                  : "sensor-console-group__state sensor-tone-error"
              }
            >
              {connected ? "Conectado" : "Sin conexión"}
            </span>
            <button
              type="button"
              className="sensor-console-group__collapse"
              aria-expanded={expandedPanels.real}
              aria-controls="sensor-control-real-content"
              aria-label={
                expandedPanels.real
                  ? "Contraer control real"
                  : "Expandir control real"
              }
              onClick={() => togglePanel("real")}
            >
              <svg
                className={`home-dropdown-chevron ${expandedPanels.real ? "home-dropdown-chevron--open" : ""}`}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </header>

        <div
          id="sensor-control-real-content"
          className="sensor-console-group__grid sensor-console-group__grid--real"
          style={expandedPanels.real ? { marginTop: "0.55rem" } : {}}
          hidden={!expandedPanels.real}
        >
          <ConsoleCard
            title="Flujo MPU"
            status={mpuStatus.pending ? "Enviando" : ""}
            active={mpuStatus.active}
            layout="toggle"
          >
            <SwitchButton
              active={mpuRequested}
              disabled={!connected || mpuStatus.pending}
              onClick={onMpuToggle}
            />
          </ConsoleCard>
          <ConsoleCard
            title="Flujo IR"
            status={irStatus.pending ? "Enviando" : ""}
            active={irStatus.active}
            layout="toggle"
          >
            <SwitchButton
              active={irRequested}
              disabled={!connected || irStatus.pending}
              onClick={onIrToggle}
            />
          </ConsoleCard>
          <ConsoleCard
            title="Período MPU"
            status={`${periodToHz(mpuPeriodMs)} Hz`}
          >
            <NumberControl
              value={mpuPeriodMs}
              min={MIN_MPU_STREAM_PERIOD_MS}
              max={F4_STREAM_LIMITS.MAX_PERIOD_MS}
              suffix="ms"
              onChange={(value) =>
                onMpuPeriodChange(normalizeMpuPeriodMs(value))
              }
            />
          </ConsoleCard>
          <ConsoleCard
            title="Período IR"
            status={`${periodToHz(irPeriodMs)} Hz`}
          >
            <NumberControl
              value={irPeriodMs}
              min={IR_STREAM_LIMITS.MIN_PERIOD_MS}
              max={IR_STREAM_LIMITS.MAX_PERIOD_MS}
              suffix="ms"
              onChange={(value) => onIrPeriodChange(value)}
            />
          </ConsoleCard>
          <ConsoleCard title="Calibración MPU" status="Activo">
            <button
              type="button"
              className="sensor-console-secondary"
              onClick={onZeroMpu}
            >
              Poner a cero
            </button>
          </ConsoleCard>
        </div>
      </section>

      <section
        id="sensor-control-simulated-panel"
        role="tabpanel"
        aria-labelledby="sensor-control-simulated-tab"
        className="sensor-console-group sensor-console-group--simulated"
        hidden={controlMode !== "simulated"}
      >
        <header className="sensor-console-group__header">
          <div>
            <span>Simulado</span>
            <strong>Pruebas sin hardware</strong>
          </div>
          <div className="sensor-console-group__header-actions">
            <span className="sensor-console-group__state sensor-tone-info">
              Local
            </span>
            <button
              type="button"
              className="sensor-console-group__collapse"
              aria-expanded={expandedPanels.simulated}
              aria-controls="sensor-control-simulated-content"
              aria-label={
                expandedPanels.simulated
                  ? "Contraer controles simulados"
                  : "Expandir controles simulados"
              }
              onClick={() => togglePanel("simulated")}
            >
              <svg
                className={`home-dropdown-chevron ${expandedPanels.simulated ? "home-dropdown-chevron--open" : ""}`}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </header>

        <div
          id="sensor-control-simulated-content"
          className={`sensor-console-group__grid sensor-console-group__grid--simulated`}
          style={expandedPanels.simulated ? { marginTop: "0.55rem" } : {}}
          hidden={!expandedPanels.simulated}
        >
          <ConsoleCard title="Simulador MPU" active={mpuEmu} layout="toggle">
            <SwitchButton active={mpuEmu} onClick={onMpuEmuToggle} />
          </ConsoleCard>
          <ConsoleCard
            title="Movimiento automático"
            active={mpuAutoMotion}
            layout="toggle"
          >
            <SwitchButton
              active={mpuAutoMotion}
              disabled={!mpuEmu}
              onClick={onMpuAutoMotionToggle}
            />
          </ConsoleCard>
          <ConsoleCard title="Emulador IR" active={irEmu} layout="toggle">
            <SwitchButton active={irEmu} onClick={onIrEmuToggle} />
          </ConsoleCard>
        </div>
      </section>
    </footer>
  );
}

function MpuSimulationWorkbench({
  eulerDeg,
  autoMotion,
  periodMs,
  onEulerChange,
  onPeriodChange,
}: {
  eulerDeg: EulerDeg;
  autoMotion: boolean;
  periodMs: number;
  onEulerChange: (value: EulerDeg) => void;
  onPeriodChange: (value: number) => void;
}) {
  return (
    <section className="sensor-simulation-workbench">
      <header className="sensor-simulation-workbench__header">
        <div>
          <span>Simulación MPU</span>
          <h2>Orientación manual y movimiento automático</h2>
        </div>
        <span className="sensor-simulation-workbench__status">
          {autoMotion ? "Movimiento automático activo" : "Control manual"}
        </span>
      </header>
      <div className="sensor-simulation-workbench__grid">
        <OrientationControls
          eulerDeg={eulerDeg}
          isEmu
          onChange={onEulerChange}
        />
        <MockEulerGenerator
          active={autoMotion}
          ms={periodMs}
          onMsChange={onPeriodChange}
          onUpdate={onEulerChange}
        />
      </div>
    </section>
  );
}

function ConsoleCard({
  title,
  status,
  active = false,
  layout = "default",
  children,
}: {
  title: string;
  status?: string;
  active?: boolean;
  layout?: "default" | "toggle";
  children: ReactNode;
}) {
  return (
    <section className={`sensor-console-card ${layout === "toggle" ? "sensor-console-card--toggle" : ""} ${active ? "sensor-console-card--active" : ""}`}>
      <div className="sensor-console-card__main">
        <span className="sensor-console-card__label">{title}</span>
        <div className="sensor-console-card__control">{children}</div>
      </div>
      {status ? <strong className="sensor-console-card__status">{status}</strong> : null}
    </section>
  );
}

function SwitchButton({
  active,
  disabled = false,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sensor-switch ${active ? "sensor-switch--active" : ""}`}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="sr-only">{active ? "Activo" : "Inactivo"}</span>
      <span className="sensor-switch__track" aria-hidden="true">
        <i />
      </span>
    </button>
  );
}

function NumberControl({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="sensor-number-control">
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span>{suffix}</span>
    </label>
  );
}

type SensorIconName =
  | "cube"
  | "target"
  | "frame"
  | "focus"
  | "snow"
  | "grid"
  | "orbit"
  | "origin"
  | "trash"
  | "signal"
  | "link";

function SensorIcon({ name }: { name: SensorIconName }) {
  const paths: Record<SensorIconName, ReactNode> = {
    cube: (
      <>
        <path d="m12 3 7 4v8l-7 4-7-4V7l7-4Z" />
        <path d="m5 7 7 4 7-4" />
        <path d="M12 11v8" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 3v3" />
        <path d="M21 12h-3" />
        <path d="M12 21v-3" />
        <path d="M3 12h3" />
      </>
    ),
    frame: (
      <>
        <path d="M4 7V4h3" />
        <path d="M17 4h3v3" />
        <path d="M20 17v3h-3" />
        <path d="M7 20H4v-3" />
        <path d="M8 12h8" />
      </>
    ),
    focus: (
      <>
        <path d="M12 8v8" />
        <path d="M8 12h8" />
        <circle cx="12" cy="12" r="7" />
      </>
    ),
    snow: (
      <>
        <path d="M12 3v18" />
        <path d="m5 7 14 10" />
        <path d="M19 7 5 17" />
      </>
    ),
    grid: (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M4 9h16" />
        <path d="M4 15h16" />
        <path d="M9 4v16" />
        <path d="M15 4v16" />
      </>
    ),
    orbit: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M4 12c2.5-5.5 13.5-5.5 16 0" />
        <path d="M4 12c2.5 5.5 13.5 5.5 16 0" />
      </>
    ),
    origin: (
      <>
        <path d="M12 4v16" />
        <path d="M4 12h16" />
        <circle cx="12" cy="12" r="3" />
        <path d="m15.5 8.5 3-3" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="m6 7 1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
      </>
    ),
    signal: (
      <>
        <path d="M4 18h2" />
        <path d="M9 18h2v-5H9z" />
        <path d="M14 18h2V9h-2z" />
        <path d="M19 18h1V5h-1z" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15" />
        <path d="M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20.07l1.15-1.15" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function createStreamStatus(statusText: string): StreamStatus {
  return {
    active: false,
    pending: false,
    packetsReceived: 0,
    lastSeq: null,
    lastStatus: null,
    lastFlags: null,
    ackCode: null,
    ackActive: null,
    ackPeriodMs: null,
    statusText,
    lastFrameHex: "",
    updatedAt: null,
  };
}

function formatStreamSubscriptionError(sensor: "MPU" | "IR", error: Error): string {
  if (error instanceof EspApiError && error.code === "unauthorized") {
    return `${sensor}: la sesion PIN vencio o no esta autorizada. Volve a ingresar.`;
  }
  if (error instanceof EspApiError && error.code === "timeout") {
    return `${sensor}: timeout esperando la confirmacion del ESP/F4.`;
  }
  return `${sensor}: ${error.message}`;
}

function loadStoredIrCalibrationProfile(): IrCalibrationProfile {
  try {
    const stored = window.localStorage.getItem(IR_CALIBRATION_STORAGE_KEY);
    if (stored) {
      const parsed = parseIrCalibrationProfile(stored);
      if (parsed.ok && parsed.profile) {
        return parsed.profile;
      }
    }
  } catch {
    // Si localStorage no está disponible se usa un perfil nuevo sólo en memoria.
  }

  return createEmptyIrCalibrationProfile();
}

function createIdleIrSnapshot(periodMs: number): IrSnapshot {
  return {
    status: 0,
    flags: 0,
    sampleSeq: 0,
    periodMs,
    tickMs: 0,
    raw: createEmptySensorRecord(),
    norm: createEmptySensorRecord(),
    linePattern: 0,
    lineAlignment: 0,
    confidence: 0,
    ambiguous: false,
    lineWidthMm: 0,
    lateralErrorMm: 0,
    lateralErrorNorm: 0,
  };
}

function createEmptySensorRecord(): Record<IrSensorKey, number> {
  return IR_SENSOR_ORDER.reduce(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<IrSensorKey, number>,
  );
}

function pickObjectSensorReadings(
  values: Readonly<Record<IrSensorKey, number>>,
): Record<IrObjectSensorKey, number> {
  return IR_OBJECT_SENSOR_KEYS.reduce(
    (record, key) => {
      record[key] = values[key] ?? 0;
      return record;
    },
    {} as Record<IrObjectSensorKey, number>,
  );
}

function createEmulatedIrSnapshot(
  objectReadings: Readonly<Record<IrObjectSensorKey, number>>,
  periodMs: number,
  sampleSeq: number,
): IrSnapshot {
  const norm = createEmptySensorRecord();
  const raw = createEmptySensorRecord();

  IR_OBJECT_SENSOR_KEYS.forEach((key) => {
    const value = Math.round(
      Math.max(0, Math.min(IR_NORM_MAX, objectReadings[key] ?? 0)),
    );
    norm[key] = value;
    raw[key] = value;
  });

  return {
    status: 0,
    flags: 0x03,
    sampleSeq,
    periodMs,
    tickMs: Math.round(performance.now()),
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

function normalizeMpuPeriodMs(value: number) {
  return normalizeStreamPeriodMs(value);
}

function normalizeIrStreamPeriodMs(value: number) {
  return normalizeStreamPeriodMs(value);
}

function periodToHz(periodMs: number) {
  if (!Number.isFinite(periodMs) || periodMs <= 0) {
    return 0;
  }

  return Math.round(1000 / periodMs);
}

function formatHexByte(value: number) {
  return `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
}

function formatObjectMask(value: number) {
  return `0b${(value & 0x1f).toString(2).padStart(5, "0")}`;
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${formatDecimal(value, 1)}`;
}

function formatDecimal(value: number, digits: number) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(digits);
}

function formatMpuLatency(sampleDtUs: number | null) {
  if (sampleDtUs === null) {
    return "-- ms";
  }

  return `${formatDecimal(sampleDtUs / 1000, 1)} ms`;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
