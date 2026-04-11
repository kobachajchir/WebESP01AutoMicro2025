import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { UNERProtocol } from "../api/UnerProtocol";
import { readLe16 } from "../api/UnerProtocolUtils";
import { useWebSocket } from "../hooks/useWebSocket";
import { useUNERProtocol } from "../hooks/useUnerProtocol";
import {
  CMD,
  ERROR_CODES,
  MPU6050_CONVERSION,
  PayloadBuilder,
  type U16,
} from "../types/UnerProtocolCMDTypes";

const MAX_TELEMETRY_DURATION_SECONDS = 240;

type TelemetryStopReason = "manual" | "timeout" | null;

function clampDurationSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return 2;
  }
  return Math.max(1, Math.min(MAX_TELEMETRY_DURATION_SECONDS, Math.round(value)));
}

function toSignedInt16(low: number, high: number) {
  const raw = (low | (high << 8)) & 0xffff;
  return raw > 0x7fff ? raw - 0x10000 : raw;
}

function telemetryErrorLabel(code: number) {
  switch (code) {
    case ERROR_CODES.OK:
      return "OK";
    case ERROR_CODES.ARG:
      return "Argumentos invalidos";
    case ERROR_CODES.UNSUPPORTED:
      return "Operacion no soportada";
    case ERROR_CODES.BUSY:
      return "Sistema ocupado";
    case ERROR_CODES.TIMEOUT:
      return "Timeout";
    case ERROR_CODES.APPLY_FAIL:
      return "Error aplicando configuracion";
    default:
      return `Codigo ${code}`;
  }
}

function buildTelemetryAckPayload(periodMs: number, code = ERROR_CODES.OK) {
  return new Uint8Array([code & 0xff, periodMs & 0xff, (periodMs >> 8) & 0xff]);
}

function buildMockTelemetryDataPayload(sequence: number, elapsedMs: number) {
  const payload = new Uint8Array(17);
  const accX = Math.round(5500 * Math.sin(elapsedMs / 650));
  const accY = Math.round(3200 * Math.sin(elapsedMs / 980));
  const accZ = 16384 + Math.round(1200 * Math.cos(elapsedMs / 720));
  const gyroX = Math.round(180 * Math.sin(elapsedMs / 500));
  const gyroY = Math.round(140 * Math.cos(elapsedMs / 780));
  const gyroZ = Math.round(220 * Math.sin(elapsedMs / 430));
  const tempRaw = Math.round((27 - 36.53) * 340);

  payload[0] = 0x01;
  payload[1] = sequence & 0xff;
  payload[2] = (sequence >> 8) & 0xff;

  const values = [accX, accY, accZ, gyroX, gyroY, gyroZ, tempRaw];
  let offset = 3;

  for (const value of values) {
    const normalized = value < 0 ? 0x10000 + value : value;
    payload[offset++] = normalized & 0xff;
    payload[offset++] = (normalized >> 8) & 0xff;
  }

  return payload;
}

export default function EstadoSection() {
  const { mockMode, mockRaw, setSensorRefreshInterval, sensorRefreshInterval } =
    useWebSocket();
  const { send, subscribe } = useUNERProtocol();
  const mockProtocol = useMemo(() => new UNERProtocol(), []);

  const [e, setE] = useState({ yaw: 0, pitch: 0, roll: 0 });
  const [mockActive, setMockActive] = useState(false);
  const [mockMs, setMockMs] = useState(120);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [openInfoModal, setOpenInfoModal] = useState(false);
  const [isEmu, setIsEmu] = useState(false);
  const [sensorSliderValue, setSensorSliderValue] = useState(sensorRefreshInterval);
  const [telemetryConstant, setTelemetryConstant] = useState(false);
  const [telemetryDurationSeconds, setTelemetryDurationSeconds] = useState(2);
  const [telemetryActive, setTelemetryActive] = useState(false);
  const [telemetryPending, setTelemetryPending] = useState(false);
  const [telemetryAppliedPeriodMs, setTelemetryAppliedPeriodMs] = useState(0);
  const [telemetryRemainingSeconds, setTelemetryRemainingSeconds] = useState<number | null>(null);
  const [telemetryPackets, setTelemetryPackets] = useState(0);
  const [telemetryLastSeq, setTelemetryLastSeq] = useState<number | null>(null);
  const [telemetryLastTempC, setTelemetryLastTempC] = useState<number | null>(null);
  const [telemetryLastRxAt, setTelemetryLastRxAt] = useState<number | null>(null);
  const [telemetryStatus, setTelemetryStatus] = useState<string | null>(null);

  const base = import.meta.env.BASE_URL || "/";
  const rigRef = useRef<CameraRigHandle>(null);
  const stopTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const mockTelemetryIntervalRef = useRef<number | null>(null);
  const mockSequenceRef = useRef(0);
  const mockTelemetryStartedAtRef = useRef(0);
  const stopReasonRef = useRef<TelemetryStopReason>(null);

  function handlePick(k: PresetKey) {
    setE({ yaw: 0, pitch: 0, roll: 0 });
    rigRef.current?.goTo(k);
  }

  const clearSessionTimers = useCallback(() => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const stopMockTelemetryStream = useCallback(() => {
    if (mockTelemetryIntervalRef.current !== null) {
      window.clearInterval(mockTelemetryIntervalRef.current);
      mockTelemetryIntervalRef.current = null;
    }
  }, []);

  const emitMockFrame = useCallback(
    (cmd: number, payload?: Uint8Array, delayMs = 0) => {
      window.setTimeout(() => {
        mockRaw(mockProtocol.buildPacket(cmd, payload));
      }, delayMs);
    },
    [mockProtocol, mockRaw]
  );

  const startMockTelemetryStream = useCallback(
    (periodMs: number) => {
      stopMockTelemetryStream();
      mockSequenceRef.current = 0;
      mockTelemetryStartedAtRef.current = performance.now();
      emitMockFrame(CMD.TELEMETRY_ACK, buildTelemetryAckPayload(periodMs), 80);

      const interval = Math.max(50, periodMs);
      mockTelemetryIntervalRef.current = window.setInterval(() => {
        const elapsedMs = performance.now() - mockTelemetryStartedAtRef.current;
        const payload = buildMockTelemetryDataPayload(
          mockSequenceRef.current++,
          elapsedMs
        );
        emitMockFrame(CMD.TELEMETRY_DATA, payload);
      }, interval);
    },
    [emitMockFrame, stopMockTelemetryStream]
  );

  const finishTelemetrySession = useCallback(
    async (reason: TelemetryStopReason) => {
      clearSessionTimers();
      stopReasonRef.current = reason;
      setTelemetryPending(true);
      setTelemetryStatus(
        reason === "timeout"
          ? "Tiempo cumplido, enviando finalizador de telemetria..."
          : "Enviando finalizador de telemetria..."
      );

      try {
        await send(CMD.TELEMETRY_SET_RATE, PayloadBuilder.telemetrySetRate(0));
        setTelemetryActive(false);
        setTelemetryAppliedPeriodMs(0);
        setTelemetryRemainingSeconds(null);

        if (mockMode) {
          stopMockTelemetryStream();
          emitMockFrame(CMD.TELEMETRY_ACK, buildTelemetryAckPayload(0), 80);
        }
      } catch (error) {
        setTelemetryPending(false);
        setTelemetryStatus(
          error instanceof Error
            ? error.message
            : "No se pudo detener la telemetria."
        );
      }
    },
    [clearSessionTimers, emitMockFrame, mockMode, send, stopMockTelemetryStream]
  );

  const startTelemetrySession = useCallback(async () => {
    const durationSeconds = clampDurationSeconds(telemetryDurationSeconds);
    const nextPeriod = Math.max(1, Math.min(0xffff, sensorRefreshInterval)) as U16;

    setTelemetryPending(true);
    setTelemetryPackets(0);
    setTelemetryLastSeq(null);
    setTelemetryLastTempC(null);
    setTelemetryLastRxAt(null);
    setTelemetryStatus(
      telemetryConstant
        ? `Solicitando telemetria continua cada ${nextPeriod} ms.`
        : `Solicitando telemetria por ${durationSeconds} s cada ${nextPeriod} ms.`
    );

    try {
      await send(
        CMD.TELEMETRY_SET_RATE,
        PayloadBuilder.telemetrySetRate(nextPeriod)
      );

      setTelemetryActive(true);
      setTelemetryAppliedPeriodMs(nextPeriod);
      setTelemetryPending(false);

      if (telemetryConstant) {
        setTelemetryRemainingSeconds(null);
      } else {
        setTelemetryRemainingSeconds(durationSeconds);
        const endsAt = Date.now() + durationSeconds * 1000;

        stopTimerRef.current = window.setTimeout(() => {
          void finishTelemetrySession("timeout");
        }, durationSeconds * 1000);

        countdownIntervalRef.current = window.setInterval(() => {
          const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
          setTelemetryRemainingSeconds(remaining);
        }, 250);
      }

      if (mockMode) {
        startMockTelemetryStream(nextPeriod);
      }
    } catch (error) {
      setTelemetryActive(false);
      setTelemetryAppliedPeriodMs(0);
      setTelemetryPending(false);
      setTelemetryStatus(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar la telemetria."
      );
    }
  }, [
    finishTelemetrySession,
    mockMode,
    send,
    sensorRefreshInterval,
    startMockTelemetryStream,
    telemetryConstant,
    telemetryDurationSeconds,
  ]);

  const updateTelemetryRate = useCallback(
    async (nextPeriodMs: number) => {
      setTelemetryPending(true);
      setTelemetryStatus(`Actualizando tasa de telemetria a ${nextPeriodMs} ms.`);

      try {
        await send(
          CMD.TELEMETRY_SET_RATE,
          PayloadBuilder.telemetrySetRate(nextPeriodMs as U16)
        );
        setTelemetryAppliedPeriodMs(nextPeriodMs);
        setTelemetryPending(false);

        if (mockMode) {
          startMockTelemetryStream(nextPeriodMs);
        }
      } catch (error) {
        setTelemetryPending(false);
        setTelemetryStatus(
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la telemetria."
        );
      }
    },
    [mockMode, send, startMockTelemetryStream]
  );

  useEffect(() => {
    return () => {
      clearSessionTimers();
      stopMockTelemetryStream();
    };
  }, [clearSessionTimers, stopMockTelemetryStream]);

  useEffect(() => {
    setSensorSliderValue(sensorRefreshInterval);
  }, [sensorRefreshInterval]);

  useEffect(() => {
    const offAck = subscribe(CMD.TELEMETRY_ACK, (packet) => {
      const code = packet.payload[0] ?? ERROR_CODES.ARG;
      const periodMs = packet.payload.length >= 3 ? readLe16(packet.payload, 1) : 0;

      if (code !== ERROR_CODES.OK) {
        clearSessionTimers();
        stopMockTelemetryStream();
        setTelemetryActive(false);
        setTelemetryAppliedPeriodMs(0);
        setTelemetryRemainingSeconds(null);
        setTelemetryPending(false);
        setTelemetryStatus(`TELEMETRY_ACK con error: ${telemetryErrorLabel(code)}.`);
        stopReasonRef.current = null;
        return;
      }

      if (periodMs > 0) {
        setTelemetryActive(true);
        setTelemetryAppliedPeriodMs(periodMs);
        setTelemetryPending(false);
        setTelemetryStatus(
          telemetryConstant
            ? `Telemetria continua activa cada ${periodMs} ms.`
            : `Telemetria activa por ventana temporizada, periodo ${periodMs} ms.`
        );
        return;
      }

      clearSessionTimers();
      stopMockTelemetryStream();
      setTelemetryActive(false);
      setTelemetryAppliedPeriodMs(0);
      setTelemetryRemainingSeconds(null);
      setTelemetryPending(false);

      if (stopReasonRef.current === "timeout") {
        setTelemetryStatus("Telemetria finalizada automaticamente por tiempo.");
      } else {
        setTelemetryStatus("Telemetria detenida.");
      }

      stopReasonRef.current = null;
    });

    const offData = subscribe(CMD.TELEMETRY_DATA, (packet) => {
      if (packet.payload.length < 17) {
        return;
      }

      const sequence = readLe16(packet.payload, 1);
      const tempRaw = toSignedInt16(packet.payload[13], packet.payload[14]);

      setTelemetryPackets((current) => current + 1);
      setTelemetryLastSeq(sequence);
      setTelemetryLastTempC(
        Number(MPU6050_CONVERSION.convertTemperature(tempRaw).toFixed(1))
      );
      setTelemetryLastRxAt(Date.now());
    });

    return () => {
      offAck();
      offData();
    };
  }, [
    clearSessionTimers,
    stopMockTelemetryStream,
    subscribe,
    telemetryConstant,
  ]);

  const handleTelemetryButton = useCallback(() => {
    if (telemetryPending) {
      return;
    }

    if (telemetryActive) {
      void finishTelemetrySession("manual");
      return;
    }

    void startTelemetrySession();
  }, [finishTelemetrySession, startTelemetrySession, telemetryActive, telemetryPending]);

  const handleApplySensorInterval = useCallback(() => {
    setSensorRefreshInterval(sensorSliderValue);

    if (telemetryActive) {
      void updateTelemetryRate(sensorSliderValue);
    }
  }, [sensorSliderValue, setSensorRefreshInterval, telemetryActive, updateTelemetryRate]);

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
          <div
            className="order-2 lg:order-1 flex flex-col w-full h-1/2 lg:w-2/3 lg:h-full
                       rounded-2xl overflow-hidden shadow-sm backdrop-blur
                       transition-shadow duration-300 hover:shadow-md items-center justify-center"
          >
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
              childrenInsideCanvas={<CameraRig ref={rigRef} />}
            />
          </div>

          <div
            className="order-1 lg:order-2 w-full lg:w-1/3
                       flex flex-col gap-4
                       rounded-2xl p-4
                       bg-white/80 dark:bg-neutral-900/60
                       ring-1 ring-black/5 shadow-sm backdrop-blur
                       transition-shadow duration-300 hover:shadow-md"
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-medium text-slate-200">
                Modo emulacion
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

            {!isEmu && (
              <div
                className="w-full rounded-2xl bg-white/70 dark:bg-neutral-900/50
                           ring-1 ring-black/5 shadow-sm backdrop-blur p-4
                           transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 m-0">
                      Sesion de telemetria real
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Pide `TELEMETRY_SET_RATE (0x20)` al firmware. Puede ser
                      una captura temporizada o continua, y al finalizar envia
                      automaticamente el finalizador con periodo `0`.
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                      telemetryActive
                        ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
                        : "bg-slate-500/15 text-slate-300 ring-white/10"
                    }`}
                  >
                    {telemetryActive
                      ? `${telemetryAppliedPeriodMs || sensorRefreshInterval} ms`
                      : "Inactiva"}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">
                    Modo de captura
                  </span>
                  <ToggleButton
                    checked={telemetryConstant}
                    onChange={(checked) => setTelemetryConstant(checked)}
                    labels
                    labelOn="Constante"
                    labelOff="Temporizada"
                    size="sm"
                    disabled={telemetryActive || telemetryPending}
                  />
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  <label htmlFor="telemetry-duration" className="text-xs text-slate-300">
                    Duracion maxima de la medicion
                  </label>
                  <input
                    id="telemetry-duration"
                    type="number"
                    min={1}
                    max={MAX_TELEMETRY_DURATION_SECONDS}
                    step={1}
                    disabled={telemetryConstant || telemetryActive || telemetryPending}
                    value={telemetryDurationSeconds}
                    onChange={(event) =>
                      setTelemetryDurationSeconds(
                        clampDurationSeconds(Number(event.target.value))
                      )
                    }
                    className="w-full rounded-xl bg-white/10 text-slate-100 placeholder-slate-400 ring-1 ring-white/10 p-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 transition duration-300 disabled:opacity-50"
                  />
                  <p className="text-[11px] text-slate-400">
                    Rango permitido: 1 a {MAX_TELEMETRY_DURATION_SECONDS}s. Si
                    elegis modo constante, el corte se hace solo con
                    `Detener`.
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTelemetryButton}
                    disabled={telemetryPending}
                    className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ring-1 disabled:cursor-not-allowed disabled:opacity-70 ${
                      telemetryActive
                        ? "bg-rose-500/20 text-rose-100 ring-rose-400/40 hover:bg-rose-500/30"
                        : "bg-cyan-500/20 text-cyan-100 ring-cyan-400/40 hover:bg-cyan-500/30"
                    }`}
                  >
                    {telemetryPending
                      ? "Enviando..."
                      : telemetryActive
                      ? "Detener"
                      : "Iniciar"}
                  </button>
                  <span className="text-xs text-slate-400">
                    Intervalo actual: {sensorRefreshInterval} ms
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                    <div className="text-slate-400">Paquetes RX</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {telemetryPackets}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                    <div className="text-slate-400">Ultimo seq</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {telemetryLastSeq ?? "-"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                    <div className="text-slate-400">Temperatura</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {telemetryLastTempC !== null ? `${telemetryLastTempC}°C` : "-"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                    <div className="text-slate-400">Restante</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {telemetryConstant
                        ? "Constante"
                        : telemetryRemainingSeconds !== null
                        ? `${telemetryRemainingSeconds}s`
                        : "-"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-slate-400">
                  {telemetryLastRxAt
                    ? `Ultimo paquete recibido hace ${Math.max(
                        0,
                        Math.round((Date.now() - telemetryLastRxAt) / 1000)
                      )} s.`
                    : "Todavia no llegaron paquetes de telemetria."}
                </div>

                {telemetryStatus && (
                  <p className="mt-3 text-xs text-slate-300">{telemetryStatus}</p>
                )}
              </div>
            )}

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
                  onUpdate={(nextEuler) => setE(nextEuler)}
                />
              </>
            )}

            <RealtimeEulerPanel
              eulerDeg={e}
              sensorIntervalTime={telemetryAppliedPeriodMs || sensorRefreshInterval}
            />
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
            Visor 3D y telemetria del MPU6050
          </h2>

          <p className="mb-3 text-black leading-relaxed">
            En esta seccion podes visualizar el modelo 3D del vehiculo y
            alternar entre modo <strong>Real</strong> y <strong>Emulado</strong>.
            En modo real ahora existe una sesion explicita de telemetria que
            puede ser continua o temporizada.
          </p>

          <ul className="mb-4 space-y-2 text-black">
            <li>
              <span className="font-semibold">Comando de inicio:</span>{" "}
              `TELEMETRY_SET_RATE (0x20)` con payload LE16 del periodo en ms.
            </li>
            <li>
              <span className="font-semibold">Finalizador:</span> para detener
              la transmision, la web vuelve a emitir `TELEMETRY_SET_RATE` con
              periodo `0`.
            </li>
            <li>
              <span className="font-semibold">Ventana temporizada:</span> si
              elegis una duracion, la UI programa el finalizador
              automaticamente al vencer el tiempo.
            </li>
            <li>
              <span className="font-semibold">Modo constante:</span> el stream
              queda activo hasta que presiones <code>Detener</code>.
            </li>
            <li>
              <span className="font-semibold">Limite de duracion:</span> la
              ventana manual permite entre 1s y {MAX_TELEMETRY_DURATION_SECONDS}
              s.
            </li>
            <li>
              <span className="font-semibold">ACK y datos:</span> el firmware
              responde con `TELEMETRY_ACK (0x21)` y luego transmite
              `TELEMETRY_DATA (0x22)` mientras la sesion siga activa.
            </li>
          </ul>

          <div className="rounded-xl bg-white/70 dark:bg-neutral-900/50 ring-1 ring-black/5 dark:ring-white/10 shadow-sm backdrop-blur p-3 text-xs text-black">
            <p className="m-0">
              <span className="font-semibold">Tip:</span> si cambias el
              intervalo de refresco mientras la telemetria esta activa, la
              pantalla reenvia `TELEMETRY_SET_RATE` con el nuevo periodo sin
              cortar la sesion.
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
                <div className="flex flex-col">
                  <input
                    id="sensor-slider"
                    type="range"
                    min={50}
                    max={10000}
                    step={50}
                    value={sensorSliderValue}
                    className="w-56 accent-cyan-400"
                    onChange={(event) =>
                      setSensorSliderValue(Number(event.target.value))
                    }
                  />
                  <label htmlFor="sensor-slider" className="text-sm text-white">
                    {sensorSliderValue}ms
                  </label>
                </div>
              </div>
              <button
                onClick={handleApplySensorInterval}
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
