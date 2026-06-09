import { useCallback, useEffect, useRef, useState } from "react";
import ThreeModelViewer from "../components/ThreeModelViewer";
import OrientationControls from "../components/OrientationControls";
import type { CameraRigHandle, PresetKey } from "../components/CameraRig";
import CameraRig from "../components/CameraRig";
import CameraPresetsPanel from "../components/CameraPresetsPanel";
import PageHeader from "../components/PageHeader";
import RealtimeEulerPanel from "../components/RealtimeEulerPanel";
import MockEulerGenerator from "../components/MockEulerGenerator";
import Modal from "../components/modal";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  UNER_V2_CMD,
  buildSetMpuStreamFrame,
  buildStopMpuStreamFrame,
  createUnerV2StreamParser,
  formatUnerFrameHex,
} from "../api/UnerFrameV2";
import { TELEMETRY_LIMITS } from "../types/UnerProtocolCMDTypes";

type TelemetryMode = "timed" | "constant";
type SensorSectionView = "MPU" | "IR";

interface TelemetryStatus {
  packetsReceived: number;
  lastSeq: number | null;
  lastStatus: number | null;
  lastFlags: number | null;
  lastSampleDtUs: number | null;
  lastAccelMg: Vector3 | null;
  lastLinearAccelMg: Vector3 | null;
  lastGyroMdps: Vector3 | null;
  ackCode: number | null;
  ackActive: boolean | null;
  ackPeriodMs: number | null;
  statusText: string;
  lastFrameHex: string;
}

type Vector3 = { x: number; y: number; z: number };

interface MpuSnapshot {
  status: number;
  flags: number;
  seq: number;
  roll: number;
  pitch: number;
  yaw: number;
  accelMg: Vector3;
  linearAccelMg: Vector3;
  gyroMdps: Vector3;
  sampleDtUs: number;
}

const MIN_MPU_STREAM_PERIOD_MS = 8;

const MPU_STATUS_LABELS: Record<number, string> = {
  0: "OK",
  1: "BAD_PAYLOAD",
  2: "SCREEN_MISMATCH",
  3: "NO_VALID_SAMPLE",
  4: "NO_PENDING_OR_BUSY",
  5: "BAD_ARGUMENT",
};

const SEGMENTED_BUTTON_CLASS =
  "min-w-[116px] rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40";
const SECTION_SEGMENTED_BUTTON_CLASS =
  "min-w-[140px] rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40";

export default function EstadoSection() {
  const {
    connected,
    sendRaw,
    subscribeRaw,
    setSensorRefreshInterval,
    sensorRefreshInterval,
  } = useWebSocket();
  const [e, setE] = useState({ yaw: 0, pitch: 0, roll: 0 });
  const [mockActive, setMockActive] = useState(false);
  const [mockMs, setMockMs] = useState(120);

  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [openInfoModal, setOpenInfoModal] = useState(false);
  const [isEmu, setIsEmu] = useState(false);
  const [telemetryMode, setTelemetryMode] = useState<TelemetryMode>("timed");
  const [activeSensorView, setActiveSensorView] =
    useState<SensorSectionView>("MPU");
  const [durationSeconds, setDurationSeconds] = useState(2);
  const [rateDraftMs, setRateDraftMs] = useState(sensorRefreshInterval);
  const [telemetryActive, setTelemetryActive] = useState(false);
  const [telemetryPending, setTelemetryPending] = useState(false);
  const [telemetryEndsAt, setTelemetryEndsAt] = useState<number | null>(null);
  const [telemetryRemainingSeconds, setTelemetryRemainingSeconds] = useState<
    number | null
  >(null);
  const [telemetryStatus, setTelemetryStatus] = useState<TelemetryStatus>({
    packetsReceived: 0,
    lastSeq: null,
    lastStatus: null,
    lastFlags: null,
    lastSampleDtUs: null,
    lastAccelMg: null,
    lastLinearAccelMg: null,
    lastGyroMdps: null,
    ackCode: null,
    ackActive: null,
    ackPeriodMs: null,
    statusText: "Stream detenido.",
    lastFrameHex: "",
  });

  const base = import.meta.env.BASE_URL || "/";

  const rigRef = useRef<CameraRigHandle>(null);
  const sensorValue = useRef<HTMLInputElement>(null);
  const pendingTimerRef = useRef<number | null>(null);
  const telemetryParserRef = useRef(createUnerV2StreamParser());

  function handlePick(k: PresetKey) {
    setE({ yaw: 0, pitch: 0, roll: 0 });
    rigRef.current?.goTo(k);
  }

  const sendTelemetryRate = useCallback(
    (periodMs: number, reason: string) => {
      const normalizedPeriod = normalizePeriodMs(periodMs);
      const frame =
        normalizedPeriod === 0
          ? buildStopMpuStreamFrame()
          : buildSetMpuStreamFrame(normalizedPeriod);
      const isStop = normalizedPeriod === 0;

      setTelemetryPending(true);
      sendRaw(frame, {
        action: isStop ? "stopMpuStream" : "setMpuStream",
        cmd: isStop ? "STOP_MPU_STREAM" : "SET_MPU_STREAM",
        periodMs: normalizedPeriod,
        reason,
      });

      setTelemetryStatus((current) => ({
        ...current,
        lastFrameHex: formatUnerFrameHex(frame),
        statusText:
          isStop
            ? "STOP_MPU_STREAM enviado."
            : `SET_MPU_STREAM enviado cada ${normalizedPeriod} ms.`,
      }));

      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
      }
      pendingTimerRef.current = window.setTimeout(() => {
        setTelemetryPending(false);
      }, 350);
    },
    [sendRaw],
  );

  const applySensorRate = useCallback(
    (rawValue: number) => {
      const nextRate = normalizeStreamingPeriodMs(rawValue);
      setRateDraftMs(nextRate);
      setSensorRefreshInterval(nextRate);

      if (telemetryActive) {
        sendTelemetryRate(nextRate, "rate-update");
        setTelemetryStatus((current) => ({
          ...current,
          statusText: `Stream activo. Periodo actualizado a ${nextRate} ms.`,
        }));
      }
    },
    [sendTelemetryRate, setSensorRefreshInterval, telemetryActive],
  );

  const startTelemetry = useCallback(() => {
    const nextRate = normalizeStreamingPeriodMs(rateDraftMs);
    const nextDuration = clampDurationSeconds(durationSeconds);
    const nextEndsAt =
      telemetryMode === "timed" ? Date.now() + nextDuration * 1000 : null;

    setRateDraftMs(nextRate);
    setSensorRefreshInterval(nextRate);
    setDurationSeconds(nextDuration);
    setTelemetryActive(true);
    setTelemetryEndsAt(nextEndsAt);
    setTelemetryRemainingSeconds(
      telemetryMode === "timed" ? nextDuration : null,
    );

    sendTelemetryRate(
      nextRate,
      telemetryMode === "timed" ? "timed-start" : "constant-start",
    );
    setTelemetryStatus((current) => ({
      ...current,
      packetsReceived: 0,
      lastSeq: null,
      lastStatus: null,
      lastFlags: null,
      lastSampleDtUs: null,
      lastAccelMg: null,
      lastLinearAccelMg: null,
      lastGyroMdps: null,
      statusText:
        telemetryMode === "timed"
          ? `Stream temporizado activo por ${nextDuration} s.`
          : "Stream constante activo hasta Detener.",
    }));
  }, [
    durationSeconds,
    rateDraftMs,
    sendTelemetryRate,
    setSensorRefreshInterval,
    telemetryMode,
  ]);

  const stopTelemetry = useCallback(
    (reason: "manual" | "timeout" | "mode-change" = "manual") => {
      sendTelemetryRate(0, reason);
      setTelemetryActive(false);
      setTelemetryEndsAt(null);
      setTelemetryRemainingSeconds(null);
      setTelemetryStatus((current) => ({
        ...current,
        statusText:
          reason === "timeout"
            ? "Captura temporizada finalizada. STOP_MPU_STREAM enviado."
            : "Stream detenido. STOP_MPU_STREAM enviado.",
      }));
    },
    [sendTelemetryRate],
  );

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setRateDraftMs(sensorRefreshInterval);
  }, [sensorRefreshInterval]);

  useEffect(() => {
    const offRaw = subscribeRaw((data) => {
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;

      for (const frame of telemetryParserRef.current.push(bytes)) {
        if (
          frame.source === 0x03 &&
          frame.destination === 0x01 &&
          (frame.cmd === UNER_V2_CMD.SET_MPU_STREAM ||
            frame.cmd === UNER_V2_CMD.STOP_MPU_STREAM)
        ) {
          continue;
        }

        if (frame.cmd === UNER_V2_CMD.SET_MPU_STREAM) {
          if (frame.payload.length < 4) {
            setTelemetryStatus((current) => ({
              ...current,
              statusText: "SET_MPU_STREAM respondio con payload incompleto.",
            }));
            return;
          }

          const periodMs = readU16LE(frame.payload, 2);
          const active = frame.payload[1] !== 0;
          setTelemetryPending(false);
          setTelemetryActive(active);
          setSensorRefreshInterval(periodMs || MIN_MPU_STREAM_PERIOD_MS);
          setTelemetryStatus((current) => ({
            ...current,
            ackCode: frame.payload[0],
            ackActive: active,
            ackPeriodMs: periodMs,
            statusText: `SET_MPU_STREAM ${statusCodeLabel(frame.payload[0])}; stream ${
              active ? "activo" : "detenido"
            } cada ${periodMs} ms.`,
          }));
          return;
        }

        if (frame.cmd === UNER_V2_CMD.STOP_MPU_STREAM) {
          if (frame.payload.length < 2) {
            setTelemetryStatus((current) => ({
              ...current,
              statusText: "STOP_MPU_STREAM respondio con payload incompleto.",
            }));
            return;
          }

          setTelemetryPending(false);
          setTelemetryActive(frame.payload[1] !== 0);
          setTelemetryStatus((current) => ({
            ...current,
            ackCode: frame.payload[0],
            ackActive: frame.payload[1] !== 0,
            ackPeriodMs: 0,
            statusText: `STOP_MPU_STREAM ${statusCodeLabel(frame.payload[0])}; stream ${
              frame.payload[1] !== 0 ? "activo" : "detenido"
            }.`,
          }));
          return;
        }

        if (frame.cmd === UNER_V2_CMD.EVT_APP_GET_MPU_READINGS) {
          const telemetry = decodeMpuSnapshot(frame.payload);
          if (!telemetry) {
            setTelemetryStatus((current) => ({
              ...current,
              statusText: `EVT_APP_GET_MPU_READINGS recibido con ${frame.payload.length} bytes; se esperaban 42.`,
            }));
            return;
          }

          setE({
            yaw: telemetry.yaw,
            pitch: telemetry.pitch,
            roll: telemetry.roll,
          });

          setTelemetryStatus((current) => ({
            ...current,
            packetsReceived: current.packetsReceived + 1,
            lastSeq: telemetry.seq,
            lastStatus: telemetry.status,
            lastFlags: telemetry.flags,
            lastSampleDtUs: telemetry.sampleDtUs,
            lastAccelMg: telemetry.accelMg,
            lastLinearAccelMg: telemetry.linearAccelMg,
            lastGyroMdps: telemetry.gyroMdps,
            statusText: "EVT_APP_GET_MPU_READINGS recibido.",
          }));
        }
      }
    });

    return () => offRaw();
  }, [setSensorRefreshInterval, subscribeRaw]);

  useEffect(() => {
    if (
      !telemetryActive ||
      telemetryMode !== "timed" ||
      telemetryEndsAt === null
    ) {
      return;
    }

    const tick = () => {
      const remainingMs = telemetryEndsAt - Date.now();
      const nextRemaining = Math.max(0, Math.ceil(remainingMs / 1000));
      setTelemetryRemainingSeconds(nextRemaining);

      if (remainingMs <= 0) {
        stopTelemetry("timeout");
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [stopTelemetry, telemetryActive, telemetryEndsAt, telemetryMode]);

  useEffect(() => {
    if (isEmu && telemetryActive) {
      stopTelemetry("mode-change");
    }
  }, [isEmu, stopTelemetry, telemetryActive]);

  useEffect(() => {
    if (activeSensorView === "IR" && telemetryActive) {
      stopTelemetry("mode-change");
    }
  }, [activeSensorView, stopTelemetry, telemetryActive]);

  useEffect(() => {
    if (activeSensorView === "IR" && openSettingsModal) {
      setOpenSettingsModal(false);
    }
  }, [activeSensorView, openSettingsModal]);

  useEffect(() => {
    if (!connected && telemetryActive) {
      setTelemetryActive(false);
      setTelemetryEndsAt(null);
      setTelemetryRemainingSeconds(null);
      telemetryParserRef.current.reset();
      setTelemetryStatus((current) => ({
        ...current,
        statusText: "WebSocket desconectado. Stream marcado como detenido.",
      }));
    }
  }, [connected, telemetryActive]);

  return (
    <section
      data-active="true"
      className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100 transition-[opacity,transform] duration-300 data-[active=true]:translate-y-0 data-[active=true]:opacity-100 data-[active=false]:translate-y-2 data-[active=false]:opacity-0"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <PageHeader
          setOpenSettingsModal={
            activeSensorView === "MPU" ? setOpenSettingsModal : undefined
          }
          setOpenInfoModal={setOpenInfoModal}
          titleOverride="MPU + IR"
        />

        <div className="relative pt-7">
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-cyan-300/20 bg-slate-950/85 p-1 shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl">
              <button
                type="button"
                className={SECTION_SEGMENTED_BUTTON_CLASS}
                style={sensorSectionSegmentedButtonStyle(activeSensorView === "MPU")}
                onClick={() => setActiveSensorView("MPU")}
              >
                MPU
              </button>
              <button
                type="button"
                className={SECTION_SEGMENTED_BUTTON_CLASS}
                style={sensorSectionSegmentedButtonStyle(activeSensorView === "IR")}
                onClick={() => setActiveSensorView("IR")}
              >
                IR
              </button>
            </div>
          </div>

          <div
            className={`app-panel-strong relative overflow-hidden px-5 pb-6 pt-14 md:px-7 ${
              activeSensorView === "MPU"
                ? statusSectionToneClass("cyan")
                : statusSectionToneClass("rose")
            }`}
          >
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-black text-white md:text-3xl">
                  {activeSensorView === "MPU" ? "Visor 3D y MPU" : "Canal IR"}
                </h2>
                <p className="max-w-3xl text-sm text-slate-300">
                  {activeSensorView === "MPU"
                    ? "Seguimiento de orientacion en tiempo real, control de telemetria del MPU y herramientas de prueba sobre el visor 3D."
                    : "Espacio dedicado al canal infrarrojo, listo para mostrar lecturas, comandos y eventos sin mezclarlo con la experiencia del MPU."}
                </p>
              </div>

              <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200">
                {activeSensorView === "MPU"
                  ? connected
                    ? "WebSocket activo"
                    : "Sin enlace activo"
                  : "Vista IR dedicada"}
              </div>
            </div>

            {activeSensorView === "MPU" ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.72fr)]">
                <div className="order-2 flex flex-col gap-4 lg:order-1">
                  <div className={mockActive ? "pointer-events-none opacity-60" : ""}>
                    <CameraPresetsPanel onPick={handlePick} />
                  </div>

                  <div
                    className={`app-panel-strong overflow-hidden rounded-md p-4 ${statusSectionToneClass("indigo")}`}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
                          Escena 3D
                        </h3>
                        <p className="mt-1 text-xs text-slate-300">
                          Modelo del vehiculo con controles de camara y rig activo.
                        </p>
                      </div>
                    </div>

                    <div className="min-h-[360px] overflow-hidden rounded-md border border-white/10 bg-slate-950/35">
                      <ThreeModelViewer
                        modelUrl={`${base}models/AutoCompressedNORemesh.glb`}
                        eulerDeg={e}
                        allowControls
                        classNames="w-full h-auto"
                        background="#fafafa25"
                        childrenInsideCanvas={<CameraRig ref={rigRef} />}
                      />
                    </div>
                  </div>
                </div>

                <div className="order-1 flex flex-col gap-4 lg:order-2">
                  <section
                    className={`app-panel-strong rounded-md p-4 ${statusSectionToneClass("emerald")}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
                          Fuente de datos
                        </h3>
                        <p className="mt-1 text-xs text-slate-300">
                          Elegi entre senal real del sistema o emulacion local.
                        </p>
                      </div>

                      <div className="flex items-center gap-1 rounded-full border border-cyan-300/20 bg-slate-950/85 p-1 shadow-[0_20px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                        <button
                          type="button"
                          className={SEGMENTED_BUTTON_CLASS}
                          style={statusSegmentedButtonStyle(!isEmu, "cyan")}
                          onClick={() => {
                            setIsEmu(false);
                            setMockActive(false);
                          }}
                        >
                          Real
                        </button>
                        <button
                          type="button"
                          className={SEGMENTED_BUTTON_CLASS}
                          style={statusSegmentedButtonStyle(isEmu, "emerald")}
                          onClick={() => setIsEmu(true)}
                        >
                          Emulado
                        </button>
                      </div>
                    </div>
                  </section>

                  {!mockActive && (
                    <OrientationControls eulerDeg={e} isEmu={isEmu} onChange={setE} />
                  )}

                  {isEmu && (
                    <>
                      <section
                        className={`app-panel-strong rounded-md p-4 ${statusSectionToneClass("emerald")}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
                              Mock 3D
                            </h3>
                            <p className="mt-1 text-xs text-slate-300">
                              Activa o pausa el generador automatico del visor.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setMockActive((v) => !v)}
                            className={statusActionButtonClass("emerald", mockActive)}
                            aria-pressed={mockActive}
                          >
                            {mockActive ? "ON" : "OFF"}
                          </button>
                        </div>
                      </section>

                      <MockEulerGenerator
                        active={isEmu && mockActive}
                        ms={mockMs}
                        onMsChange={setMockMs}
                        onUpdate={(nextEuler) => setE(nextEuler)}
                      />
                    </>
                  )}

                  <RealtimeEulerPanel
                    eulerDeg={e}
                    sampleMs={Math.max(MIN_MPU_STREAM_PERIOD_MS, sensorRefreshInterval)}
                    sensorIntervalTime={sensorRefreshInterval}
                  />

                  {!isEmu && (
                    <section
                      className={`app-panel-strong rounded-md p-4 ${statusSectionToneClass("cyan")}`}
                    >
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wide text-white">
                            MPU en tiempo real
                          </h3>
                          <p className="mt-1 text-xs text-slate-300">
                            {connected
                              ? "WebSocket listo para enviar comandos."
                              : "Sin WebSocket activo."}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                            telemetryActive
                              ? "border border-emerald-300/30 bg-emerald-500/15 text-emerald-200"
                              : "border border-white/10 bg-white/5 text-slate-200"
                          }`}
                        >
                          {telemetryActive ? "Activo" : "Detenido"}
                        </span>
                      </div>

                      <div className="grid gap-3">
                        <div>
                          <div className="mb-2 text-xs font-medium uppercase text-slate-300">
                            Modo de captura
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              className={statusModeButtonClass(
                                "cyan",
                                telemetryMode === "timed",
                              )}
                              onClick={() => setTelemetryMode("timed")}
                              disabled={telemetryActive}
                              aria-pressed={telemetryMode === "timed"}
                            >
                              Temporizado
                            </button>
                            <button
                              type="button"
                              className={statusModeButtonClass(
                                "rose",
                                telemetryMode === "constant",
                              )}
                              onClick={() => setTelemetryMode("constant")}
                              disabled={telemetryActive}
                              aria-pressed={telemetryMode === "constant"}
                            >
                              Constante
                            </button>
                          </div>
                        </div>

                        <form
                          className="grid gap-3 sm:grid-cols-[1fr_auto]"
                          onSubmit={(event) => {
                            event.preventDefault();
                            applySensorRate(rateDraftMs);
                          }}
                        >
                          <label className="text-xs font-medium uppercase text-slate-300">
                            Periodo de medicion (ms)
                            <input
                              type="number"
                              min={MIN_MPU_STREAM_PERIOD_MS}
                              max={65535}
                              step={1}
                              value={rateDraftMs}
                              onChange={(event) => {
                                const nextValue = Number(event.target.value);
                                setRateDraftMs(nextValue);
                                if (
                                  telemetryActive &&
                                  Number.isFinite(nextValue) &&
                                  nextValue > 0
                                ) {
                                  applySensorRate(nextValue);
                                }
                              }}
                              className="app-input mt-2 w-full px-3 py-2 text-sm"
                            />
                            <span className="mt-1 block text-[11px] normal-case text-slate-400">
                              Minimo {MIN_MPU_STREAM_PERIOD_MS} ms para el stream MPU.
                            </span>
                          </label>
                          <button
                            type="submit"
                            className={`${statusActionButtonClass("indigo", true)} self-end`}
                          >
                            Aplicar
                          </button>
                        </form>

                        {telemetryMode === "timed" ? (
                          <label className="text-xs font-medium uppercase text-slate-300">
                            Duracion en segundos
                            <input
                              type="number"
                              min={TELEMETRY_LIMITS.MIN_RECOMMENDED_DURATION_SECONDS}
                              max={TELEMETRY_LIMITS.MAX_DURATION_SECONDS}
                              step={1}
                              value={durationSeconds}
                              onChange={(event) =>
                                setDurationSeconds(
                                  clampDurationSeconds(Number(event.target.value)),
                                )
                              }
                              className="app-input mt-2 w-full px-3 py-2 text-sm"
                            />
                            <span className="mt-1 block text-[11px] normal-case text-slate-400">
                              Maximo {TELEMETRY_LIMITS.MAX_DURATION_SECONDS}s.
                            </span>
                          </label>
                        ) : (
                          <div className="rounded-md border border-rose-300/20 bg-rose-500/10 p-3 text-xs text-rose-100">
                            En modo constante no hace falta duracion: el stream queda
                            activo hasta presionar Detener.
                          </div>
                        )}

                        <button
                          type="button"
                          className={statusActionButtonClass(
                            telemetryActive ? "rose" : "cyan",
                            true,
                          )}
                          onClick={() =>
                            telemetryActive
                              ? stopTelemetry("manual")
                              : startTelemetry()
                          }
                          disabled={!connected || telemetryPending}
                        >
                          {telemetryPending
                            ? "Enviando..."
                            : telemetryActive
                              ? "Detener"
                              : "Iniciar"}
                        </button>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <TelemetryMetric
                            label="Paquetes"
                            value={String(telemetryStatus.packetsReceived)}
                          />
                          <TelemetryMetric
                            label="Ultimo seq"
                            value={
                              telemetryStatus.lastSeq === null
                                ? "-"
                                : String(telemetryStatus.lastSeq)
                            }
                          />
                          <TelemetryMetric
                            label="Flags"
                            value={
                              telemetryStatus.lastFlags === null
                                ? "-"
                                : formatHexByte(telemetryStatus.lastFlags)
                            }
                          />
                          <TelemetryMetric
                            label="Estado"
                            value={
                              telemetryStatus.lastStatus === null
                                ? "-"
                                : statusCodeLabel(telemetryStatus.lastStatus)
                            }
                          />
                          <TelemetryMetric
                            label="Restante"
                            value={
                              telemetryMode === "timed" && telemetryActive
                                ? `${telemetryRemainingSeconds ?? durationSeconds}s`
                                : "-"
                            }
                          />
                          <TelemetryMetric
                            label="dt muestra"
                            value={
                              telemetryStatus.lastSampleDtUs === null
                                ? "-"
                                : `${telemetryStatus.lastSampleDtUs} us`
                            }
                          />
                          <TelemetryMetric
                            label="ACK"
                            value={
                              telemetryStatus.ackCode === null
                                ? "-"
                                : `${statusCodeLabel(telemetryStatus.ackCode)} / ${
                                    telemetryStatus.ackPeriodMs ?? "-"
                                  }ms / ${
                                    telemetryStatus.ackActive === null
                                      ? "-"
                                      : telemetryStatus.ackActive
                                        ? "ON"
                                        : "OFF"
                                  }`
                            }
                          />
                          <TelemetryMetric
                            label="Accel mg"
                            value={formatVector(telemetryStatus.lastAccelMg)}
                          />
                          <TelemetryMetric
                            label="Lin accel mg"
                            value={formatVector(telemetryStatus.lastLinearAccelMg)}
                          />
                          <TelemetryMetric
                            label="Gyro mdps"
                            value={formatVector(telemetryStatus.lastGyroMdps)}
                          />
                        </div>

                        <div className="rounded-md border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-200">
                          <p className="font-semibold text-white">
                            {telemetryStatus.statusText}
                          </p>
                          {telemetryStatus.lastFrameHex ? (
                            <code className="mt-2 block break-all text-cyan-100">
                              {telemetryStatus.lastFrameHex}
                            </code>
                          ) : null}
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-3xl flex-col">
                <section
                  className={`app-panel-strong rounded-md p-4 ${statusSectionToneClass("rose")}`}
                >
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-white">
                        IR
                      </h3>
                      <p className="mt-1 text-xs text-slate-300">
                        Superficie visual preparada para integrar lectura y eventos
                        infrarrojos sin tocar el flujo del MPU.
                      </p>
                    </div>
                    <span className="rounded-full border border-rose-300/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-rose-100">
                      Pendiente de enlace
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <TelemetryMetric label="Ultimo frame" value="-" />
                    <TelemetryMetric label="Comando" value="-" />
                    <TelemetryMetric label="Intensidad" value="-" />
                    <TelemetryMetric label="Canal" value="-" />
                  </div>

                  <div className="mt-3 rounded-md border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
                    Este bloque queda listo para enganchar los eventos IR reales
                    cuando el transporte los exponga en la web.
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>

      {openInfoModal && (
        <Modal
          isOpen={openInfoModal}
          onClose={() => setOpenInfoModal(false)}
          closeOnOverlayClick={false}
        >
          <div className="flex flex-col gap-4">
            <div>
              <div className="app-kicker mb-3">Info</div>
              <h2 className="text-2xl font-black text-white">
                {activeSensorView === "MPU" ? "MPU y visor 3D" : "Canal IR"}
              </h2>
            </div>

            <p className="text-sm leading-relaxed text-slate-300">
              {activeSensorView === "MPU"
                ? "En esta vista puedes visualizar el modelo 3D del vehiculo, rotarlo segun la orientacion medida por el MPU6050 y alternar entre modo real y emulado."
                : "En esta vista queda aislado el bloque IR para poder crecer como modulo propio, sin mezclar la interfaz con el flujo del MPU y el visor 3D."}
            </p>

            {activeSensorView === "MPU" ? (
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  <span className="font-semibold text-white">Modos:</span> real para
                  datos del sistema y emulado para pruebas manuales o mock 3D.
                </li>
                <li>
                  <span className="font-semibold text-white">Orientacion:</span> el
                  modelo aplica Euler en orden <code>YXZ</code>.
                </li>
                <li>
                  <span className="font-semibold text-white">Camara:</span>{" "}
                  OrbitControls con presets y foco estable sobre el vehiculo.
                </li>
                <li>
                  <span className="font-semibold text-white">Telemetria:</span>{" "}
                  puedes iniciar, detener y ajustar el stream del MPU desde la
                  misma pantalla.
                </li>
              </ul>
            ) : (
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  <span className="font-semibold text-white">Objetivo:</span>{" "}
                  reservar una pantalla dedicada para lecturas, comandos y estados
                  del canal infrarrojo.
                </li>
                <li>
                  <span className="font-semibold text-white">Metricas:</span> el
                  panel ya contempla ultimo frame, comando, intensidad y canal.
                </li>
                <li>
                  <span className="font-semibold text-white">Escalado:</span> al
                  tener vista propia, IR puede crecer sin romper la UX del visor
                  3D ni la telemetria MPU.
                </li>
              </ul>
            )}

            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              <p className="m-0">
                <span className="font-semibold text-white">Tip:</span>{" "}
                {activeSensorView === "MPU"
                  ? "si publicas yaw, pitch y roll ya filtrados en grados, la experiencia del visor se mantiene mucho mas estable y facil de comparar con el mock."
                  : "cuando el transporte IR este disponible, lo ideal es desacoplar ultimo frame, comando decodificado y metadatos de intensidad para que la lectura quede clara tambien en la web."}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {openSettingsModal && activeSensorView === "MPU" && (
        <Modal
          isOpen={openSettingsModal}
          onClose={() => setOpenSettingsModal(false)}
          closeOnOverlayClick={false}
          containerClassnames="flex flex-col items-center justify-center"
        >
          <div className="flex w-full flex-col gap-4">
            <div>
              <div className="app-kicker mb-3">Config</div>
              <h2 className="w-full text-2xl font-black text-white">
                Configuracion
              </h2>
            </div>

            <div
              className={`flex w-full flex-col gap-4 rounded-md p-4 ${statusSectionCardClass("indigo")}`}
            >
              <div className="flex flex-col items-center justify-center gap-3 lg:flex-row">
                <div className="flex w-full flex-col items-center justify-center lg:w-1/2">
                  <p className="text-sm text-slate-300">
                    Intervalo refresco de datos actual
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {sensorRefreshInterval}ms
                  </p>
                </div>
                <div className="flex flex-col">
                  <input
                    id="sensor-slider"
                    type="range"
                    min={MIN_MPU_STREAM_PERIOD_MS}
                    max={10000}
                    step={1}
                    defaultValue={sensorRefreshInterval}
                    className="w-56 accent-cyan-400"
                    ref={sensorValue}
                    onInput={(e) => {
                      const label = document.querySelector(
                        'label[for="sensor-slider"]',
                      );
                      if (label) {
                        label.textContent = `${e.currentTarget.value}ms`;
                      }
                    }}
                  />
                  <label
                    htmlFor="sensor-slider"
                    className="text-sm text-slate-200"
                  >
                    {sensorRefreshInterval}ms
                  </label>
                </div>
              </div>

              <button
                onClick={() => {
                  if (sensorValue) {
                    applySensorRate(Number(sensorValue.current?.value));
                  }
                }}
                className={statusActionButtonClass("cyan", true)}
              >
                Enviar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function TelemetryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/45 p-2">
      <div className="text-[10px] font-semibold uppercase text-slate-400">
        {label}
      </div>
      <div className="mt-1 break-words font-mono text-sm text-slate-100">
        {value}
      </div>
    </div>
  );
}

function statusSegmentedButtonStyle(
  active: boolean,
  tone: "cyan" | "emerald",
): React.CSSProperties {
  if (!active) {
    return {
      background: "transparent",
      color: "var(--ui-text)",
    };
  }

  return tone === "emerald"
    ? {
        background: "#10b981",
        color: "#ffffff",
        boxShadow: "0 12px 28px rgba(16,185,129,0.28)",
      }
    : {
        background: "var(--ui-accent)",
        color: "#061016",
        boxShadow: "0 12px 28px rgba(34,211,238,0.28)",
      };
}

function sensorSectionSegmentedButtonStyle(
  active: boolean,
): React.CSSProperties {
  return active
    ? {
        background: "var(--ui-accent)",
        color: "var(--ui-action-hover-ink)",
        boxShadow: "0 12px 28px rgba(34,211,238,0.28)",
      }
    : {
        background: "transparent",
        color: "var(--ui-text)",
      };
}

function statusSectionToneClass(
  tone: "cyan" | "emerald" | "indigo" | "rose",
) {
  return {
    cyan: "border-cyan-300/18",
    emerald: "border-emerald-300/18",
    indigo: "border-indigo-300/18",
    rose: "border-rose-300/18",
  }[tone];
}

function statusSectionCardClass(
  tone: "cyan" | "emerald" | "indigo" | "rose",
) {
  return `app-panel-strong rounded-md ${statusSectionToneClass(tone)}`;
}

function statusModeButtonClass(
  tone: "cyan" | "rose",
  active: boolean,
) {
  const activeClass =
    tone === "rose"
      ? "border-rose-300/70 bg-rose-500 text-white shadow-[0_14px_34px_rgba(244,63,94,0.24)]"
      : "border-cyan-300/70 bg-cyan-500 text-slate-950 shadow-[0_14px_34px_rgba(34,211,238,0.24)]";

  const idleClass =
    tone === "rose"
      ? "border-rose-300/30 bg-rose-500/8 text-rose-100 hover:bg-rose-500/14"
      : "border-cyan-300/30 bg-cyan-500/8 text-cyan-100 hover:bg-cyan-500/14";

  return `rounded-md border px-3 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/35 disabled:cursor-not-allowed disabled:opacity-50 ${
    active ? activeClass : idleClass
  }`;
}

function statusActionButtonClass(
  tone: "cyan" | "emerald" | "indigo" | "rose",
  active = false,
) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

  const activeMap = {
    cyan:
      "border-cyan-300/70 bg-cyan-500 text-slate-950 shadow-[0_14px_34px_rgba(34,211,238,0.24)] focus-visible:ring-cyan-300/40",
    emerald:
      "border-emerald-300/70 bg-emerald-500 text-white shadow-[0_14px_34px_rgba(16,185,129,0.24)] focus-visible:ring-emerald-300/40",
    indigo:
      "border-indigo-300/70 bg-indigo-500 text-white shadow-[0_14px_34px_rgba(99,102,241,0.24)] focus-visible:ring-indigo-300/40",
    rose:
      "border-rose-300/70 bg-rose-500 text-white shadow-[0_14px_34px_rgba(244,63,94,0.24)] focus-visible:ring-rose-300/40",
  };

  const idleMap = {
    cyan:
      "border-cyan-300/30 bg-cyan-500/8 text-cyan-100 hover:bg-cyan-500/14 focus-visible:ring-cyan-300/35",
    emerald:
      "border-emerald-300/30 bg-emerald-500/8 text-emerald-100 hover:bg-emerald-500/14 focus-visible:ring-emerald-300/35",
    indigo:
      "border-indigo-300/30 bg-indigo-500/8 text-indigo-100 hover:bg-indigo-500/14 focus-visible:ring-indigo-300/35",
    rose:
      "border-rose-300/30 bg-rose-500/8 text-rose-100 hover:bg-rose-500/14 focus-visible:ring-rose-300/35",
  };

  return `${base} ${active ? activeMap[tone] : idleMap[tone]}`;
}

function normalizePeriodMs(value: number) {
  if (!Number.isFinite(value)) {
    return 500;
  }
  const rounded = Math.round(value);
  if (rounded <= 0) {
    return 0;
  }
  return Math.min(0xffff, rounded);
}

function normalizeStreamingPeriodMs(value: number) {
  const normalized = normalizePeriodMs(value);
  return normalized === 0 ? MIN_MPU_STREAM_PERIOD_MS : Math.max(MIN_MPU_STREAM_PERIOD_MS, normalized);
}

function clampDurationSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return TELEMETRY_LIMITS.MIN_RECOMMENDED_DURATION_SECONDS;
  }

  return Math.min(
    TELEMETRY_LIMITS.MAX_DURATION_SECONDS,
    Math.max(TELEMETRY_LIMITS.MIN_RECOMMENDED_DURATION_SECONDS, Math.round(value)),
  );
}

function decodeMpuSnapshot(payload: Uint8Array): MpuSnapshot | null {
  if (payload.length !== 42) {
    return null;
  }

  return {
    status: payload[0],
    flags: payload[1],
    seq: readU16LE(payload, 2),
    roll: readI32LE(payload, 4) / 1000,
    pitch: readI32LE(payload, 8) / 1000,
    yaw: readI32LE(payload, 12) / 1000,
    accelMg: {
      x: readI16LE(payload, 16),
      y: readI16LE(payload, 18),
      z: readI16LE(payload, 20),
    },
    linearAccelMg: {
      x: readI16LE(payload, 22),
      y: readI16LE(payload, 24),
      z: readI16LE(payload, 26),
    },
    gyroMdps: {
      x: readI32LE(payload, 28),
      y: readI32LE(payload, 32),
      z: readI32LE(payload, 36),
    },
    sampleDtUs: readU16LE(payload, 40),
  };
}

function readU16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readI16LE(bytes: Uint8Array, offset: number) {
  const value = readU16LE(bytes, offset);
  return value & 0x8000 ? value - 0x10000 : value;
}

function readI32LE(bytes: Uint8Array, offset: number) {
  const value =
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0;
  return value & 0x80000000 ? value - 0x100000000 : value;
}

function statusCodeLabel(code: number) {
  return MPU_STATUS_LABELS[code] ?? `CODE_${code}`;
}

function formatHexByte(value: number) {
  return `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
}

function formatVector(value: Vector3 | null) {
  if (!value) {
    return "-";
  }

  return `${value.x}, ${value.y}, ${value.z}`;
}
