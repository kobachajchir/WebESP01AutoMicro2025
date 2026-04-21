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
  buildTelemetrySetRateFrame,
  formatUnerFrameHex,
} from "../api/UnerFrameV2";
import {
  CMD,
  ERROR_CODES,
  MPU6050_CONVERSION,
  TELEMETRY_LIMITS,
} from "../types/UnerProtocolCMDTypes";

type TelemetryMode = "timed" | "constant";

interface TelemetryStatus {
  packetsReceived: number;
  lastSeq: number | null;
  lastTempC: number | null;
  lastTempRaw: number | null;
  lastSchema: number | null;
  ackCode: number | null;
  ackPeriodMs: number | null;
  statusText: string;
  lastFrameHex: string;
}

const TELEMETRY_ACK_LABELS = Object.fromEntries(
  Object.entries(ERROR_CODES).map(([name, code]) => [code, name]),
) as Record<number, string>;

const SEGMENTED_BUTTON_CLASS =
  "min-w-[116px] rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40";

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
    lastTempC: null,
    lastTempRaw: null,
    lastSchema: null,
    ackCode: null,
    ackPeriodMs: null,
    statusText: "Stream detenido.",
    lastFrameHex: "",
  });

  const base = import.meta.env.BASE_URL || "/";

  const rigRef = useRef<CameraRigHandle>(null);
  const sensorValue = useRef<HTMLInputElement>(null);
  const pendingTimerRef = useRef<number | null>(null);

  function handlePick(k: PresetKey) {
    setE({ yaw: 0, pitch: 0, roll: 0 });
    rigRef.current?.goTo(k);
  }

  const sendTelemetryRate = useCallback(
    (periodMs: number, reason: string) => {
      const normalizedPeriod = normalizePeriodMs(periodMs);
      const frame = buildTelemetrySetRateFrame(normalizedPeriod);

      setTelemetryPending(true);
      sendRaw(frame, {
        action: "telemetrySetRate",
        cmd: "TELEMETRY_SET_RATE",
        periodMs: normalizedPeriod,
        reason,
      });

      setTelemetryStatus((current) => ({
        ...current,
        lastFrameHex: formatUnerFrameHex(frame),
        statusText:
          normalizedPeriod === 0
            ? "Finalizador TELEMETRY_SET_RATE(0) enviado."
            : `TELEMETRY_SET_RATE enviado cada ${normalizedPeriod} ms.`,
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
      lastTempC: null,
      lastTempRaw: null,
      lastSchema: null,
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
            ? "Captura temporizada finalizada. Finalizador enviado."
            : "Stream detenido. Finalizador enviado.",
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
      const packet = readTelemetryPacket(bytes);

      if (!packet) {
        return;
      }

      if (packet.cmd === CMD.TELEMETRY_ACK) {
        if (packet.payload.length < 3) {
          setTelemetryStatus((current) => ({
            ...current,
            statusText: "TELEMETRY_ACK recibido con payload incompleto.",
          }));
          return;
        }

        const periodMs = readU16LE(packet.payload, 1);
        setTelemetryStatus((current) => ({
          ...current,
          ackCode: packet.payload[0],
          ackPeriodMs: periodMs,
          statusText: `ACK ${ackCodeLabel(packet.payload[0])} para ${periodMs} ms.`,
        }));
        return;
      }

      if (packet.cmd === CMD.TELEMETRY_DATA) {
        const telemetry = decodeTelemetryData(packet.payload);
        if (!telemetry) {
          setTelemetryStatus((current) => ({
            ...current,
            statusText: `TELEMETRY_DATA recibido con ${packet.payload.length} bytes; se esperaban 17.`,
          }));
          return;
        }

        setTelemetryStatus((current) => ({
          ...current,
          packetsReceived: current.packetsReceived + 1,
          lastSeq: telemetry.seq,
          lastTempC: telemetry.tempC,
          lastTempRaw: telemetry.tempRaw,
          lastSchema: telemetry.schema,
          statusText: "TELEMETRY_DATA recibido.",
        }));
      }
    });

    return () => offRaw();
  }, [subscribeRaw]);

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
    if (!connected && telemetryActive) {
      setTelemetryActive(false);
      setTelemetryEndsAt(null);
      setTelemetryRemainingSeconds(null);
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
          setOpenSettingsModal={setOpenSettingsModal}
          setOpenInfoModal={setOpenInfoModal}
          titleOverride="MPU + IR"
        />

        <div
          className={`app-panel-strong relative overflow-hidden px-5 pb-6 pt-6 md:px-7 ${statusSectionToneClass("cyan")}`}
        >
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-black text-white md:text-3xl">
                Visor 3D, MPU e IR
              </h2>
              <p className="max-w-3xl text-sm text-slate-300">
                Seguimiento de orientacion en tiempo real, control de telemetria
                del MPU y una superficie preparada para integrar el canal IR sin
                romper lo que ya estaba funcionando.
              </p>
            </div>

            <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200">
              {connected ? "WebSocket activo" : "Sin enlace activo"}
            </div>
          </div>

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
                          min={1}
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
                        label="Temperatura"
                        value={formatTemperature(telemetryStatus.lastTempC)}
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
                        label="Schema"
                        value={
                          telemetryStatus.lastSchema === null
                            ? "-"
                            : formatHexByte(telemetryStatus.lastSchema)
                        }
                      />
                      <TelemetryMetric
                        label="ACK"
                        value={
                          telemetryStatus.ackCode === null
                            ? "-"
                            : `${ackCodeLabel(telemetryStatus.ackCode)} / ${
                                telemetryStatus.ackPeriodMs ?? "-"
                              }ms`
                        }
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
                MPU, visor 3D e IR
              </h2>
            </div>

            <p className="text-sm leading-relaxed text-slate-300">
              En esta pantalla podes visualizar el modelo 3D del vehiculo,
              rotarlo segun la orientacion medida por el <strong>MPU6050</strong>{" "}
              y alternar entre modo real y emulado. Tambien queda reservado el
              bloque IR para sumar ese canal sin rehacer la interfaz.
            </p>

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
                <span className="font-semibold text-white">IR:</span> panel listo
                para mostrar comandos, intensidad, canal y ultimo frame cuando se
                conecte el flujo real.
              </li>
            </ul>

            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              <p className="m-0">
                <span className="font-semibold text-white">Tip:</span> si publicas
                yaw, pitch y roll ya filtrados en grados, la experiencia del visor
                se mantiene mucho mas estable y facil de comparar con el mock.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {openSettingsModal && (
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
                    min={50}
                    max={10000}
                    step={50}
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
  return normalized === 0 ? 1 : normalized;
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

interface ParsedTelemetryPacket {
  cmd: number;
  payload: Uint8Array;
}

function readTelemetryPacket(bytes: Uint8Array): ParsedTelemetryPacket | null {
  if (bytes.length < 1) {
    return null;
  }

  const isUnerV2Frame =
    bytes.length >= 10 &&
    bytes[0] === 0x55 &&
    bytes[1] === 0x4e &&
    bytes[2] === 0x45 &&
    bytes[3] === 0x52 &&
    bytes[5] === 0x3a &&
    bytes[6] === 0x02;

  if (!isUnerV2Frame) {
    return {
      cmd: bytes[0],
      payload: bytes.slice(1),
    };
  }

  const payloadLength = bytes[4];
  const totalLength = 10 + payloadLength;
  if (bytes.length < totalLength) {
    return null;
  }

  const frame = bytes.slice(0, totalLength);
  const receivedChecksum = frame[frame.length - 1];
  const calculatedChecksum = xorChecksum(frame.slice(0, -1));

  if (receivedChecksum !== calculatedChecksum) {
    return null;
  }

  return {
    cmd: frame[8],
    payload: frame.slice(9, 9 + payloadLength),
  };
}

function decodeTelemetryData(payload: Uint8Array) {
  if (payload.length !== 17) {
    return null;
  }

  const tempRaw = readI16LE(payload, 15);

  return {
    schema: payload[0],
    seq: readU16LE(payload, 1),
    tempRaw,
    tempC: MPU6050_CONVERSION.convertTemperature(tempRaw),
  };
}

function readU16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readI16LE(bytes: Uint8Array, offset: number) {
  const value = readU16LE(bytes, offset);
  return value & 0x8000 ? value - 0x10000 : value;
}

function xorChecksum(bytes: Uint8Array) {
  return bytes.reduce((checksum, byte) => checksum ^ byte, 0) & 0xff;
}

function ackCodeLabel(code: number) {
  return TELEMETRY_ACK_LABELS[code] ?? `CODE_${code}`;
}

function formatTemperature(value: number | null) {
  return value === null ? "-" : `${value.toFixed(2)} C`;
}

function formatHexByte(value: number) {
  return `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
}
