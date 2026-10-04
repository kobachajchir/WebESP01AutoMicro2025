import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { ESP_COMMANDS } from "../../protocol/wsApi";
import "./motion.css";

type MotionState = {
  status: number; motionArmed: boolean; balanceActive: boolean; commandActive: boolean;
  safetyStop: boolean; rejectReason: number; carMode: number; motorTestActive: boolean;
};
const reasons = ["Disponible", "Control sin inicializar", "MPU sin datos válidos", "MPU calibrando",
  "Inclinación fuera del límite", "Control deshabilitado", "Balance desactivado", "Lectura MPU vencida",
  "Parada pendiente de reactivación", "Orden inválida"];
function parseState(value: unknown): MotionState {
  const s = value as Partial<MotionState> | null;
  if (!s || typeof s.status !== "number" || !Number.isInteger(s.carMode) || !Number.isInteger(s.rejectReason) ||
      ![s.motionArmed, s.balanceActive, s.commandActive, s.safetyStop, s.motorTestActive].every(v => typeof v === "boolean"))
    throw new Error("La placa no confirmó el estado de motores. Actualizá los firmwares y volvé a consultar.");
  if (s.status !== 0) throw new Error(`Orden rechazada (${s.status}): ${reasons[s.rejectReason ?? 0] ?? "estado no disponible"}.`);
  return s as MotionState;
}
export default function MotionControlPanel() {
  const { request, connected, mockMode } = useWebSocket();
  const [state, setState] = useState<MotionState | null>(null);
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const [angle, setAngle] = useState(0); const [turn, setTurn] = useState(0);
  const [left, setLeft] = useState(0); const [right, setRight] = useState(0);
  const [telemetry, setTelemetry] = useState<Record<string, unknown> | null>(null);
  const busy = useRef(false); const alive = useRef(true);
  const real = connected && !mockMode;
  const read = useCallback(async () => {
    const next = parseState(await request(ESP_COMMANDS.GET_MOTION, {}, { timeoutMs: 2000 }));
    if (alive.current) setState(next);
    try {
      const data = await request<Record<string, unknown>>(ESP_COMMANDS.GET_TELEMETRY, {}, { timeoutMs: 2000 });
      if (alive.current) setTelemetry(data.status === 0 ? data : null);
    } catch { if (alive.current) setTelemetry(null); }
    // TEST remains available when the independent MPU is absent or calibrating.
  }, [request]);
  useEffect(() => {
    alive.current = true;
    if (!real) { setState(null); setTelemetry(null); return () => { alive.current = false; }; }
    let cancelled = false; let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (cancelled) return;
      if (!busy.current) {
        busy.current = true; setPending(true);
        try { await read(); }
        catch (e) { if (!cancelled) { setState(null); setTelemetry(null); setError(e instanceof Error ? e.message : "No se pudo consultar motores."); } return; }
        finally { busy.current = false; if (!cancelled) setPending(false); }
      }
      if (!cancelled) timer = setTimeout(() => { void poll(); }, 1000);
    }
    void poll();
    return () => { cancelled = true; alive.current = false; if (timer) clearTimeout(timer); };
  }, [real, read]);
  async function run(command: string, args: Record<string, unknown>) {
    if (!real || busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      const next = parseState(await request(command, args, { timeoutMs: 2000 }));
      if (alive.current) setState(next);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "No se pudo confirmar la orden."); }
    finally { busy.current = false; if (alive.current) setPending(false); }
  }
  async function refresh() {
    if (!real || busy.current) return;
    busy.current = true; setPending(true); setError("");
    try { await read(); } catch (e) { setState(null); setTelemetry(null); setError(e instanceof Error ? e.message : "Sin respuesta de la placa."); }
    finally { busy.current = false; setPending(false); }
  }
  const ready = real && !!state && !pending;
  const driveReady = ready && state?.motionArmed && !state?.safetyStop && (state?.carMode === 0 || state?.carMode === 3);
  function display(key: string, suffix: string) {
    const value = telemetry?.[key]; return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : "—";
  }
  return <section className="motion-control-panel" aria-label="Balance y motores reales">
    <div className="motion-control-heading"><div><span className="home-kicker">Control de la placa</span><h2>Balance y motores</h2></div>
      <button className="app-button" disabled={!real || pending} onClick={() => { void refresh(); }}>Consultar estado</button></div>
    <p>Con balance desactivado, el MPU sigue midiendo y los motores dejan de compensar. Activá el balance cuando el auto esté apoyado. Avanzar y retroceder cambia la inclinación objetivo; la corrección permanece a cargo de la F4.</p>
    <p role="status">{!real ? "Necesitás conexión real y sesión autorizada." : !state ? "Estado sin confirmar" : state.safetyStop ? `Parada: ${reasons[state.rejectReason] ?? "reactivación requerida"}` : state.balanceActive ? "Balance compensando" : state.motionArmed ? "Balance armado; esperando datos" : "Balance desactivado"}</p>
    <div className="motion-control-actions">
      <button className="app-button" disabled={!ready || state?.carMode === 2} onClick={() => { void run(ESP_COMMANDS.SET_BALANCE_ENABLED, { enabled: true }); }}>Activar balance</button>
      <button className="app-button" disabled={!real || pending} onClick={() => { void run(ESP_COMMANDS.SET_BALANCE_ENABLED, { enabled: false }); }}>Desactivar balance</button>
      <button className="app-button" disabled={!real || pending} onClick={() => { void run(ESP_COMMANDS.STOP_MOTION, { disableBalance: false }); }}>Detener marcha</button>
      <button className="app-button" disabled={!real || pending} onClick={() => { void run(ESP_COMMANDS.STOP_MOTION, { disableBalance: true }); }}>Parar motores y balance</button>
    </div>
    <div className="motion-control-grid"><label>Inclinación objetivo (°)<input className="app-input" type="number" min="-6" max="6" step="0.1" value={angle} onChange={e => setAngle(Number(e.target.value))} /></label>
      <label>Giro (%)<input className="app-input" type="number" min="-100" max="100" value={turn} onChange={e => setTurn(Number(e.target.value))} /></label>
      <button className="app-button" disabled={!driveReady || !Number.isFinite(angle) || Math.abs(angle) > 6 || !Number.isFinite(turn) || Math.abs(turn) > 100}
        onClick={() => { void run(ESP_COMMANDS.SET_MOTION, { forwardPercent: angle / 6 * 100, turnPercent: turn, durationMs: 750 }); }}>Mover durante 750 ms</button></div>
    <p>Al terminar o detener la marcha, el objetivo vuelve a 0° y el balance continúa. El giro usa la capacidad que queda disponible después de compensar.</p>
    <details><summary>Prueba directa de motores en TEST</summary><p>Requiere modo TEST y balance desactivado. Cada pulso termina localmente después de 750 ms.</p>
      <div className="motion-control-grid"><label>Motor izquierdo (%)<input className="app-input" type="number" min="-100" max="100" value={left} onChange={e => setLeft(Number(e.target.value))} /></label>
        <label>Motor derecho (%)<input className="app-input" type="number" min="-100" max="100" value={right} onChange={e => setRight(Number(e.target.value))} /></label>
        <button className="app-button" disabled={!ready || state?.carMode !== 2 || state?.motionArmed || ![left,right].every(v => Number.isFinite(v) && Math.abs(v) <= 100)}
          onClick={() => { void run(ESP_COMMANDS.SET_MOTOR_TEST, { leftPercent: left, rightPercent: right, durationMs: 750 }); }}>Probar durante 750 ms</button></div></details>
    <div className="motion-control-readings"><span>Inclinación: {display("pitchMeasuredDeg", "°")}</span><span>Objetivo: {display("pitchSetpointDeg", "°")}</span><span>Izquierdo: {display("leftOutputPercent", "%")}</span><span>Derecho: {display("rightOutputPercent", "%")}</span></div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
