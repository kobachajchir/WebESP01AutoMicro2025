import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useUser } from "../../contexts/UserContext";
import { ESP_COMMANDS } from "../../protocol/wsApi";

export type LineProfile = { means: number[][]; noise: number[][]; usefulScans: number; pitchDeg: number; rollDeg: number; yawDeg: number };
export type LineDeviceState = {
  status: number; version: number; calibrationState: number; target: number; phase: number;
  progress: number; calibrationReason: number; followReason: number;
  whiteValid: boolean; trackValid: boolean; balanceSettled: boolean; following: boolean;
  motionArmed: boolean; balanceActive: boolean; safetyStop: boolean; routeValid: boolean;
  carMode: number; pattern: number; confidence: number; sessionId: number;
  whiteRevision: number; trackWhiteRevision: number; usefulScans: number;
  neutralPitchDeg: number; referenceRollDeg: number; referenceYawDeg: number;
  white: LineProfile; track: LineProfile;
};
export const lineReasons = [
  "Disponible", "Seguimiento detenido", "MPU sin una lectura vÃ¡lida y reciente",
  "ActivÃ¡ el balance antes de seguir", "InclinaciÃ³n fuera del lÃ­mite", "Ancho de lÃ­nea invÃ¡lido",
  "CompletÃ¡ las calibraciones de blanco y sobre pista", "Lecturas IR no disponibles",
  "Lectura de lÃ­nea ambigua", "No se pudo recuperar la lÃ­nea", "Movimiento rechazado",
  "SeleccionÃ¡ el modo FOLLOW", "EsperÃ¡ a que el balance se estabilice",
  "Hay una calibraciÃ³n en curso", "AlineÃ¡ el auto: blanco, negro, blanco",
  "Esperando estabilizaciÃ³n de la iluminaciÃ³n", "MantenÃ© el auto vertical y quieto",
  "Contraste insuficiente o captura con demasiado ruido", "No se pudo guardar la calibraciÃ³n",
  "Esta sesiÃ³n de calibraciÃ³n ya no estÃ¡ disponible", "La captura no terminÃ³ a tiempo",
];
export const lineReason = (code: number) => lineReasons[code] ?? `OperaciÃ³n rechazada (${code})`;
export const calibrationBusy = (s: LineDeviceState | null) => !!s && s.calibrationState >= 1 && s.calibrationState <= 4;

function parseState(value: unknown): LineDeviceState {
  const s = value as LineDeviceState | null;
  if (!s || s.version !== 1 || ![0, 1].includes(s.status) ||
    ![s.whiteValid, s.trackValid, s.balanceSettled, s.following, s.motionArmed, s.balanceActive, s.safetyStop, s.routeValid].every(v => typeof v === "boolean") ||
    ![s.calibrationState, s.target, s.phase, s.progress, s.calibrationReason, s.followReason, s.carMode, s.pattern, s.sessionId].every(Number.isInteger)) {
    throw new Error("La placa no confirmÃ³ el estado de seguimiento. ActualizÃ¡ F4 y ESP y consultÃ¡ nuevamente.");
  }
  return s;
}

export function useLineDevice() {
  const { request, connected, mockMode } = useWebSocket();
  const { remotePinAuthenticated } = useUser();
  const enabled = connected && !mockMode && remotePinAuthenticated;
  const [state, setState] = useState<LineDeviceState | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [action, setAction] = useState("");
  const alive = useRef(true);
  const generation = useRef(0);
  const mutation = useRef(false);
  const ownedSession = useRef<number | null>(null);
  const pollVersion = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    const g = generation.current, v = pollVersion.current;
    const next = parseState(await request(ESP_COMMANDS.GET_LINE_STATE, {}, { timeoutMs: 2000 }));
    if (alive.current && g === generation.current && v === pollVersion.current) { setState(next); setError(""); }
    return g === generation.current ? next : null;
  }, [enabled, request]);

  useEffect(() => {
    alive.current = true; ++generation.current; ownedSession.current = null; mutation.current = false; setPending(false);
    if (!enabled) { setState(null); setError(""); setPending(false); }
    let cancelled = false; let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (cancelled || !enabled) return;
      if (!mutation.current) {
        try { await refresh(); }
        catch (cause) {
          if (!cancelled) { setState(null); setError(cause instanceof Error ? cause.message : "Sin respuesta de F4"); }
          if (!cancelled) timer = setTimeout(() => { void poll(); }, 5000);
          return;
        }
      }
      if (!cancelled) timer = setTimeout(() => { void poll(); }, 300);
    }
    void poll();
    return () => { cancelled = true; alive.current = false; ++generation.current; if (timer) clearTimeout(timer); };
  }, [enabled, refresh]);

  async function command(name: string, args: Record<string, unknown>, label: string) {
    if (!enabled || mutation.current) return null;
    mutation.current = true; ++pollVersion.current; setPending(true); setAction(label); setError("");
    const g = generation.current;
    try {
      const next = parseState(await request(name, args, { timeoutMs: 2000 }));
      if (alive.current && g === generation.current) {
        setState(next);
        if (next.status !== 0) setError(lineReason(name === ESP_COMMANDS.LINE_CALIBRATION_CONTROL ? next.calibrationReason : next.followReason));
        else if (name === ESP_COMMANDS.LINE_CALIBRATION_CONTROL && Number(args.operation) <= 1) ownedSession.current = next.sessionId;
      }
      return g === generation.current ? next : null;
    } catch (cause) {
      if (alive.current && g === generation.current) { setState(null); setError(cause instanceof Error ? cause.message : "No se pudo confirmar la orden"); }
      return null;
    } finally {
      if (g === generation.current) mutation.current = false;
      if (alive.current && g === generation.current) { setPending(false); setAction(""); }
    }
  }

  async function calibrate(operation: 0 | 1 | 2 | 3) {
    const sessionId = operation <= 1 ? 0 : ownedSession.current;
    if (sessionId === null) { setError("La captura pertenece a otra interfaz. EsperÃ¡ a que termine."); return null; }
    return command(ESP_COMMANDS.LINE_CALIBRATION_CONTROL, { operation, sessionId }, "Calibrando");
  }

  const follow = (on: boolean) => command(ESP_COMMANDS.SET_LINE_FOLLOW, { enabled: on }, on ? "Iniciando" : "Deteniendo");
  const balance = (on: boolean) => commandBalance(on);
  async function commandBalance(on: boolean) {
    if (!enabled || mutation.current) return;
    mutation.current = true; setPending(true); setAction("Balance"); setError("");
    const g = generation.current;
    try {
      const response = await request<{ status: number }>(ESP_COMMANDS.SET_BALANCE_ENABLED, { enabled: on }, { timeoutMs: 2000 });
      if (response.status !== 0) throw new Error("F4 no pudo activar el balance. RevisÃ¡ el MPU y la postura del auto.");
      await refresh();
    } catch (cause) { if (alive.current && g === generation.current) setError(cause instanceof Error ? cause.message : "Balance sin confirmar"); }
    finally { if (g === generation.current) mutation.current = false; if (alive.current && g === generation.current) { setPending(false); setAction(""); } }
  }

  return { state: enabled ? state : null, enabled, pending, action, error, refresh, follow, balance, calibrate,
    busy: calibrationBusy(enabled ? state : null),
    ownsCalibration: !!state && state.sessionId === ownedSession.current };
}
export type LineDevice = ReturnType<typeof useLineDevice>;
