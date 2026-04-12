import { useCallback, useEffect, useRef, useState } from "react";
import ThreeModelViewer from "../components/ThreeModelViewer";
import OrientationControls from "../components/OrientationControls";
import type { CameraRigHandle, PresetKey } from "../components/CameraRig";
import CameraRig from "../components/CameraRig";
import CameraPresetsPanel from "../components/CameraPresetsPanel";
import ToggleButton from "../components/toggleButton";
import PageHeader from "../components/PageHeader";
import RealtimeEulerPanel from "../components/RealTimeEulerPanel";
import MockEulerGenerator from "../components/MockEulerGenerator";
import Modal from "../components/modal";
import { useWebSocket } from "../hooks/useWebSocket";
import { buildTelemetrySetRateFrame, formatUnerFrameHex } from "../api/UnerFrameV2";
import { CMD, ERROR_CODES, MPU6050_CONVERSION, TELEMETRY_LIMITS } from "../types/UnerProtocolCMDTypes";

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
  Object.entries(ERROR_CODES).map(([name, code]) => [code, name])
) as Record<number, string>;

export default function EstadoSection() {
  const { connected, sendRaw, subscribeRaw, setSensorRefreshInterval, sensorRefreshInterval } = useWebSocket();
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
  const [telemetryRemainingSeconds, setTelemetryRemainingSeconds] = useState<number | null>(null);
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
    [sendRaw]
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
    [sendTelemetryRate, setSensorRefreshInterval, telemetryActive]
  );

  const startTelemetry = useCallback(() => {
    const nextRate = normalizeStreamingPeriodMs(rateDraftMs);
    const nextDuration = clampDurationSeconds(durationSeconds);
    const nextEndsAt = telemetryMode === "timed" ? Date.now() + nextDuration * 1000 : null;

    setRateDraftMs(nextRate);
    setSensorRefreshInterval(nextRate);
    setDurationSeconds(nextDuration);
    setTelemetryActive(true);
    setTelemetryEndsAt(nextEndsAt);
    setTelemetryRemainingSeconds(telemetryMode === "timed" ? nextDuration : null);

    sendTelemetryRate(nextRate, telemetryMode === "timed" ? "timed-start" : "constant-start");
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
  }, [durationSeconds, rateDraftMs, sendTelemetryRate, setSensorRefreshInterval, telemetryMode]);

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
    [sendTelemetryRate]
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
    if (!telemetryActive || telemetryMode !== "timed" || telemetryEndsAt === null) {
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
      className="min-h-screen w-full
                 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100
                 transition-[opacity,transform] duration-300
                 data-[active=true]:opacity-100 data-[active=true]:translate-y-0
                 data-[active=false]:opacity-0 data-[active=false]:translate-y-2"
    >
      <div className="flex flex-col gap-4 p-6 w-full mx-auto max-w-7xl">
        <PageHeader
          setOpenSettingsModal={setOpenSettingsModal}
          setOpenInfoModal={setOpenInfoModal}
        />

        <div className="flex flex-col lg:flex-row gap-6 w-full h-[calc(100vh-7rem)] items-stretch justify-stretch">
          {/* Viewer */}
          <div
            className="order-2 lg:order-1 flex flex-col w-full h-1/2 lg:w-2/3 lg:h-full
                       rounded-2xl overflow-hidden shadow-sm backdrop-blur
                       transition-shadow duration-300 hover:shadow-md items-center justify-center"
          >
            {/* Presets de cámara (si usás este panel) */}
            <div
              className={
                mockActive ? "w-full opacity-50 pointer-events-none" : "w-full"
              }
            >
              <div
                className="w-full rounded-2xl shadow-sm backdrop-blur p-4
                          transition-[opacity,transform] duration-300
                          data-[state=open]:opacity-100 data-[state=open]:translate-y-0 data-[state=open]:scale-100
                          data-[state=closed]:opacity-0 data-[state=closed]:translate-y-2 data-[state=closed]:scale-95"
                data-state="open"
              >
                <CameraPresetsPanel onPick={handlePick} />
              </div>
            </div>
            <ThreeModelViewer
              modelUrl={`${base}models/AutoCompressedNORemesh.glb`}
              eulerDeg={e}
              allowControls
              classNames="w-full h-auto"
              background="#fafafa25"
              // ⬇️ inyectamos el rig (vive dentro del Canvas, puede usar hooks r3f)
              childrenInsideCanvas={<CameraRig ref={rigRef} />}
            />
          </div>

          {/* Panel derecho */}
          <div
            className="order-1 lg:order-2 w-full lg:w-1/3
                       flex flex-col gap-4 overflow-y-auto
                       rounded-2xl p-4
                       bg-white/80 dark:bg-neutral-900/60
                       ring-1 ring-black/5 shadow-sm backdrop-blur
                       transition-shadow duration-300 hover:shadow-md"
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-medium text-slate-200">
                Modo emulación
              </span>
              <ToggleButton
                checked={isEmu}
                onChange={(checked) => setIsEmu(checked)}
                onDeactivate={() => setMockActive(false)}
                labels
                labelOn="Emulado"
                labelOff="Real"
                size="md"
              />
            </div>
            {/* Controles de orientación */}
            {!mockActive && (
              <OrientationControls eulerDeg={e} isEmu={isEmu} onChange={setE} />
            )}
            {isEmu && (
              <>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-medium text-slate-200">
                    Mock 3D
                  </span>
                  <button
                    type="button"
                    onClick={() => setMockActive((v) => !v)}
                    className={`inline-flex items-center justify-center gap-2
                rounded-xl px-3 py-1.5 text-xs font-medium
                transition-all duration-200 ring-1
                ${
                  mockActive
                    ? "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40 hover:bg-emerald-500/30"
                    : "bg-white/10 text-slate-300 ring-white/10 hover:bg-white/20"
                }`}
                    aria-pressed={mockActive}
                  >
                    {mockActive ? "ON" : "OFF"}
                  </button>
                </div>
                <MockEulerGenerator
                  active={isEmu && mockActive}
                  ms={mockMs}
                  onMsChange={setMockMs}
                  onUpdate={(e) => setE(e)} // o useCallback si querés fijar la ref
                />
              </>
            )}
            {/* Inputs readonly que usan los valores leidos en tiempo real */}
            <RealtimeEulerPanel
              eulerDeg={e}
              sensorIntervalTime={sensorRefreshInterval}
            />
            {!isEmu && (
              <section className="app-panel-strong p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Telemetria real
                    </h3>
                    <p className="mt-1 text-xs text-slate-300">
                      {connected ? "WebSocket listo para enviar comandos." : "Sin WebSocket activo."}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${
                      telemetryActive
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-slate-500/15 text-slate-200"
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
                        className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                          telemetryMode === "timed"
                            ? "border-cyan-300/40 bg-cyan-500/20 text-cyan-100"
                            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                        }`}
                        onClick={() => setTelemetryMode("timed")}
                        disabled={telemetryActive}
                        aria-pressed={telemetryMode === "timed"}
                      >
                        Temporizado
                      </button>
                      <button
                        type="button"
                        className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                          telemetryMode === "constant"
                            ? "border-rose-300/40 bg-rose-500/20 text-rose-100"
                            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                        }`}
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
                          if (telemetryActive && Number.isFinite(nextValue) && nextValue > 0) {
                            applySensorRate(nextValue);
                          }
                        }}
                        className="mt-2 w-full rounded-md bg-slate-950/70 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                      />
                    </label>
                    <button
                      type="submit"
                      className="self-end rounded-md border border-cyan-300/30 bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
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
                        onChange={(event) => setDurationSeconds(clampDurationSeconds(Number(event.target.value)))}
                        className="mt-2 w-full rounded-md bg-slate-950/70 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                      />
                      <span className="mt-1 block text-[11px] normal-case text-slate-400">
                        Maximo {TELEMETRY_LIMITS.MAX_DURATION_SECONDS}s.
                      </span>
                    </label>
                  ) : (
                    <div className="rounded-md border border-rose-300/20 bg-rose-500/10 p-3 text-xs text-rose-100">
                      En modo constante no hace falta duracion: el stream queda activo hasta presionar Detener.
                    </div>
                  )}

                  <button
                    type="button"
                    className="app-button px-4 py-2 font-semibold"
                    onClick={() => (telemetryActive ? stopTelemetry("manual") : startTelemetry())}
                    disabled={!connected || telemetryPending}
                  >
                    {telemetryPending ? "Enviando..." : telemetryActive ? "Detener" : "Iniciar"}
                  </button>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <TelemetryMetric label="Paquetes" value={String(telemetryStatus.packetsReceived)} />
                    <TelemetryMetric label="Ultimo seq" value={telemetryStatus.lastSeq === null ? "-" : String(telemetryStatus.lastSeq)} />
                    <TelemetryMetric label="Temperatura" value={formatTemperature(telemetryStatus.lastTempC)} />
                    <TelemetryMetric
                      label="Restante"
                      value={telemetryMode === "timed" && telemetryActive ? `${telemetryRemainingSeconds ?? durationSeconds}s` : "-"}
                    />
                    <TelemetryMetric label="Schema" value={telemetryStatus.lastSchema === null ? "-" : formatHexByte(telemetryStatus.lastSchema)} />
                    <TelemetryMetric
                      label="ACK"
                      value={
                        telemetryStatus.ackCode === null
                          ? "-"
                          : `${ackCodeLabel(telemetryStatus.ackCode)} / ${telemetryStatus.ackPeriodMs ?? "-"}ms`
                      }
                    />
                  </div>

                  <div className="rounded-md border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-200">
                    <p className="font-semibold text-white">{telemetryStatus.statusText}</p>
                    {telemetryStatus.lastFrameHex ? (
                      <code className="mt-2 block break-all text-cyan-100">{telemetryStatus.lastFrameHex}</code>
                    ) : null}
                  </div>
                </div>
              </section>
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
          <h2 className="text-2xl font-bold mb-4 text-slate-900">
            Visor 3D y Datos del MPU6050
          </h2>

          <p className="mb-3 text-black leading-relaxed">
            En esta sección podés visualizar el modelo 3D del vehículo, rotarlo
            según la orientación medida por el <strong>MPU6050</strong> y
            alternar entre un
            <strong> modo Real</strong> (datos del sensor) y un
            <strong> modo Emulado</strong> (sliders de yaw/pitch/roll). El visor
            usa <em>Three.js / React Three Fiber</em>, con fondo transparente y
            auto-encuadre del modelo.
          </p>

          <ul className="mb-4 space-y-2 text-black">
            <li>
              <span className="font-semibold">Modos:</span>{" "}
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-emerald-600 text-white ring-1 ring-emerald-500/20">
                Real
              </span>{" "}
              toma datos del MPU6050 (giroscopio+acelerómetro, filtrado
              complementario) y{" "}
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-indigo-500 text-white ring-1 ring-indigo-500/20">
                Emulado
              </span>{" "}
              habilita sliders para yaw/pitch/roll en grados.
            </li>

            <li>
              <span className="font-semibold">Orientación:</span> el modelo
              aplica Euler en orden <code>YXZ</code> (yaw→pitch→roll). Asegurate
              de mapear correctamente ejes del sensor con el chasis (marcar eje
              +X, +Y, +Z en el PCB).
            </li>

            <li>
              <span className="font-semibold">Cámara y controles:</span>{" "}
              OrbitControls con presets (Frente, Izq/Der, Arriba/Abajo, ISO). El
              visor auto-encuadra el modelo al cargar y mantiene el foco en el
              origen.
            </li>

            <li>
              <span className="font-semibold">Carga de modelo:</span> se soporta{" "}
              <code>.glb/.gltf</code> (opcional Draco). Ubicá el archivo en{" "}
              <code>public/models/</code>. El fondo del canvas es transparente
              para integrarlo con el resto de la UI.
            </li>

            <li>
              <span className="font-semibold">Datos en tiempo real:</span> el
              backend PC recibe paquetes del MPU6050 (ej. vía ESP‑01/WebSocket o
              Serial), publica
              <code> yaw/pitch/roll</code> en ° y los graficamos en una
              tabla/serie de tendencias (últimos N segundos).
            </li>

            <li>
              <span className="font-semibold">Calibración:</span> offset de
              giroscopio en reposo, nivelación inicial (pitch/roll) y ajuste de
              signo por eje. Guardar en EEPROM/LocalStorage.
            </li>
          </ul>

          <div className="rounded-xl bg-white/70 dark:bg-neutral-900/50 ring-1 ring-black/5 dark:ring-white/10 shadow-sm backdrop-blur p-3 text-xs text-black">
            <p className="m-0">
              <span className="font-semibold">Tip:</span> publicá los ángulos ya
              en grados. Si leés crudos <code>INT16</code> del giroscopio,
              escalá a°/s (LSB según el rango) y aplicá un filtro complementario
              típico:
              <code>
                {" "}
                angle = α·(angle + gyro·dt) + (1-α)·accAngle
              </code> con <code>α≈0.98</code> y <code>dt</code> en s. Frecuencia
              sugerida: <code>50-100&nbsp;Hz</code>. Limita jitter con una
              ventana móvil o <code>median</code> sobre 3-5 muestras.
            </p>
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
          <h2 className="text-2xl font-bold mb-4 text-slate-900 w-full">
            Configuracion
          </h2>
          <div className="flex w-full lg:w-2/3 flex-col gap-4 p-3 items-center justify-center rounded-lg bg-slate-600/80 border-slate-700">
            <div className="flex flex-col w-full items-center justify-center">
              <div className="flex flex-col lg:flex-row gap-3 w-full items-center justify-center">
                <div className="flex flex-col w-2/3 lg:w-1/2 items-center justify-center">
                  <p className="text-sm text-white">
                    Intervalo refresco de datos actual
                  </p>
                  <p className="text-sm text-white">
                    {sensorRefreshInterval}ms
                  </p>
                </div>
                <div className="flex flex-col ">
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
                      // Actualizar solo el texto del label
                      const label = document.querySelector(
                        'label[for="sensor-slider"]'
                      );
                      if (label) {
                        label.textContent = `${e.currentTarget.value}ms`;
                      }
                    }}
                  />
                  <label htmlFor="sensor-slider" className="text-sm text-white">
                    {sensorRefreshInterval}ms
                  </label>
                </div>
              </div>
              <button
                onClick={() => {
                  if(sensorValue){
                    applySensorRate(Number(sensorValue.current?.value)); // Usa el valor del estado
                  }
                }}
                className="mt-3 px-4 py-2 bg-cyan-400 text-slate-900 rounded hover:bg-cyan-300 transition-colors"
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
      <div className="text-[10px] font-semibold uppercase text-slate-400">{label}</div>
      <div className="mt-1 break-words font-mono text-sm text-slate-100">{value}</div>
    </div>
  );
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
    Math.max(TELEMETRY_LIMITS.MIN_RECOMMENDED_DURATION_SECONDS, Math.round(value))
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
  return `0x${`00${(value & 0xff).toString(16).toUpperCase()}`.slice(-2)}`;
}
