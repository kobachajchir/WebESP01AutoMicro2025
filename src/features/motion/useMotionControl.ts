import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { ESP_COMMANDS } from "../../protocol/wsApi";

export type MotionState = {
  status: number;
  motionArmed: boolean;
  balanceActive: boolean;
  commandActive: boolean;
  safetyStop: boolean;
  rejectReason: number;
  carMode: number;
  motorTestActive: boolean;
};

export const motionReasons = [
  "Disponible", "Control sin inicializar", "MPU sin datos válidos", "MPU calibrando",
  "Inclinación fuera del límite", "Control deshabilitado", "Balance desactivado",
  "Lectura MPU vencida", "Parada pendiente de reactivación", "Orden inválida",
];

function parseState(value: unknown): MotionState {
  const state = value as Partial<MotionState> | null;
  if (!state || typeof state.status !== "number" || !Number.isInteger(state.carMode) ||
      !Number.isInteger(state.rejectReason) ||
      ![state.motionArmed, state.balanceActive, state.commandActive, state.safetyStop,
        state.motorTestActive].every((entry) => typeof entry === "boolean")) {
    throw new Error("La placa no confirmó el estado de motores. Actualizá los firmwares y volvé a consultar.");
  }
  if (state.status !== 0) {
    throw new Error(`Orden rechazada (${state.status}): ${motionReasons[state.rejectReason ?? 0] ?? "estado no disponible"}.`);
  }
  return state as MotionState;
}

// One controller keeps the settings, action bar and diagnostic badge in sync.
export function useMotionControl(active = true) {
  const { request, connected, mockMode } = useWebSocket();
  const [state, setState] = useState<MotionState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [telemetry, setTelemetry] = useState<Record<string, unknown> | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const real = active && connected && !mockMode;

  const read = useCallback(async () => {
    const next = parseState(await request(ESP_COMMANDS.GET_MOTION, {}, { timeoutMs: 2000 }));
    if (alive.current) { setState(next); setError(""); }
    try {
      const data = await request<Record<string, unknown>>(ESP_COMMANDS.GET_TELEMETRY, {}, { timeoutMs: 2000 });
      if (alive.current) setTelemetry(data.status === 0 ? data : null);
    } catch {
      if (alive.current) setTelemetry(null);
    }
    // TEST remains available when the independent MPU is absent or calibrating.
  }, [request]);

  useEffect(() => {
    alive.current = true;
    if (!real) {
      setState(null); setTelemetry(null); setError("");
      return () => { alive.current = false; };
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (cancelled) return;
      if (!busy.current) {
        busy.current = true; setPending(true);
        try { await read(); }
        catch (cause) {
          if (!cancelled) {
            setState(null); setTelemetry(null);
            setError(cause instanceof Error ? cause.message : "No se pudo consultar motores.");
          }
          return;
        } finally {
          busy.current = false;
          if (!cancelled) setPending(false);
        }
      }
      if (!cancelled) timer = setTimeout(() => { void poll(); }, 1000);
    }
    void poll();
    return () => {
      cancelled = true; alive.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [real, read]);

  async function run(command: string, args: Record<string, unknown>) {
    if (!real || busy.current) return false;
    busy.current = true; setPending(true); setError("");
    try {
      const next = parseState(await request(command, args, { timeoutMs: 2000 }));
      if (alive.current) setState(next);
      return true;
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "No se pudo confirmar la orden.");
      return false;
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }

  async function refresh() {
    if (!real || busy.current) return;
    busy.current = true; setPending(true); setError("");
    try { await read(); }
    catch (cause) {
      if (alive.current) {
        setState(null); setTelemetry(null);
        setError(cause instanceof Error ? cause.message : "Sin respuesta de la placa.");
      }
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }

  const ready = real && !!state && !pending;
  const driveReady = !!(ready && state?.motionArmed && !state.safetyStop &&
    (state.carMode === 0 || state.carMode === 3));
  const balanceEnabled = !!(real && state?.motionArmed);
  const statusText = !real ? "Necesitás conexión real y sesión autorizada."
    : !state ? "Estado sin confirmar"
    : state.safetyStop ? `Parada: ${motionReasons[state.rejectReason] ?? "reactivación requerida"}`
    : state.balanceActive ? "Balance compensando"
    : state.motionArmed ? "Balance activado; esperando datos"
    : "Balance desactivado";

  return { state: real ? state : null, pending, error, telemetry: real ? telemetry : null,
    real, ready, driveReady, balanceEnabled, statusText, run, refresh };
}

export type MotionController = ReturnType<typeof useMotionControl>;
