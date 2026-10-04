import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { ESP_COMMANDS } from "../../protocol/wsApi";
import { downloadSession, newSession, parseSession, summarize, telemetrySample } from "./session";
import type { BalanceSession } from "./session";
import type { Analysis } from "./optimizer";
import { deleteSession, listSessions, saveSession } from "./storage";
import { remoteAnalysis } from "./remote";
import AnalysisWorker from "./analysis.worker?worker&inline";
import MotionControlPanel from "../motion/MotionControlPanel";
import { useBalancePid } from "./useBalancePid";

export default function BalanceWorkbench({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const { request, connected, mockMode } = useWebSocket();
  const pid = useBalancePid();
  const [modifyPid, setModifyPid] = useState(false);
  const [draft, setDraft] = useState({ kp: "", ki: "", kd: "" });
  const [processingName, setProcessingName] = useState("");
  const [session, setSession] = useState<BalanceSession | null>(null);
  const [history, setHistory] = useState<BalanceSession[]>([]);
  const [name, setName] = useState("Balance · sesión base"); const [notes, setNotes] = useState("");
  const [capturing, setCapturing] = useState(false); const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState("Registrá el balance actual o importá una sesión sincronizada.");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const remote = useRef<AbortController | null>(null);
  const [chart, setChart] = useState<"angle" | "output" | "terms">("angle");
  const [comparisonId, setComparisonId] = useState("");
  const buffer = useRef<BalanceSession | null>(null); const worker = useRef<Worker | null>(null);
  const startedAt = useRef(0);
  const stats = session ? summarize(session) : null;
  const comparison = history.find((s) => s.id === comparisonId && s.id !== session?.id);
  const comparisonStats = comparison ? summarize(comparison) : null;
  useEffect(() => { listSessions().then(setHistory).catch((e: Error) => setFeedback(e.message)); }, []);
  useEffect(() => { onBusyChange(capturing || analyzing || pid.pending); return () => onBusyChange(false); }, [capturing, analyzing, pid.pending, onBusyChange]);
  useEffect(() => { if (pid.current) setDraft({ kp: String(pid.current.kp), ki: String(pid.current.ki), kd: String(pid.current.kd) }); else setModifyPid(false); }, [pid.current]);
  useEffect(() => () => { worker.current?.terminate(); remote.current?.abort(); }, []);
  async function persist(value: BalanceSession) {
    try { await saveSession(value); setHistory(await listSessions()); return true; }
    catch { setFeedback("No se pudo guardar el historial. Exportá la sesión para conservar los datos."); return false; }
  }
  useEffect(() => {
    if (!capturing) return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const started = startedAt.current;
    async function next() {
      try {
        if (!connected || mockMode) throw new Error("Se perdió la conexión real. Registro finalizado.");
        const data = await request<unknown>(ESP_COMMANDS.GET_TELEMETRY, {}, { timeoutMs: 3000 });
        if (cancelled || !buffer.current) return;
        const s = buffer.current;
        s.samples.push(telemetrySample(data, performance.now() - started, s.samples.length));
        setSession({ ...s, samples: [...s.samples] });
        if (s.samples.length % 10 === 0) void persist({ ...s, samples: [...s.samples] });
        if (s.samples.length >= 600 || performance.now() - started >= 120000) {
          setCapturing(false); setFeedback("Registro finalizado por límite de dos minutos o 600 muestras."); return;
        }
        timer = setTimeout(() => { void next(); }, 200);
      } catch (e) {
        if (!cancelled) { setCapturing(false); setFeedback(e instanceof Error ? e.message : "Registro interrumpido."); }
      }
    }
    void next();
    return () => {
      cancelled = true; if (timer) clearTimeout(timer);
      const value = buffer.current;
      if (value?.samples.length) void persist({ ...value, samples: [...value.samples] });
    };
    // Reconnect changes stop this run; no overlapping polling requests.
  }, [capturing, connected, mockMode, request]);
  function start() {
    const value = newSession(name.trim() || "Sesión de balance", notes);
    if (pid.current) value.initialPid = { ...pid.current };
    startedAt.current = performance.now();
    buffer.current = value; setSession(value); setAnalysis(null); setCapturing(true);
    setFeedback("Registrando snapshots reales. Detener registro no detiene los motores.");
  }
  function analyze() {
    if (!session) return;
    setAnalyzing(true); setAnalysis(null);
    const task = new AnalysisWorker(); worker.current = task;
    task.onmessage = (event: MessageEvent<{ ok: boolean; result?: Analysis; error?: string }>) => {
      if (event.data.ok && event.data.result) setAnalysis(event.data.result);
      else setFeedback(event.data.error ?? "No se pudo analizar.");
      task.terminate(); worker.current = null; setAnalyzing(false);
    };
    task.onerror = () => { task.terminate(); worker.current = null; setAnalyzing(false); setFeedback("No se pudo iniciar el análisis local."); };
    task.postMessage(session);
  }
  async function sendAnalysis() {
    if (!session || !processingName.trim()) { setFeedback("Poné un nombre al registro antes de procesarlo."); return; }
    if (!endpoint.trim()) { setFeedback("El conector del servidor MCP todavía no está configurado. No se enviaron datos."); return; }
    const controller = new AbortController(); remote.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setAnalyzing(true); setAnalysis(null);
    try {
      const sent = { ...session, name: processingName.trim() };
      const result = await remoteAnalysis(sent, endpoint, token, controller.signal);
      setAnalysis(result);
      if (result.status === "proposal" && result.candidate) {
        const next = { ...sent, processed: { name: sent.name, processedAt: new Date().toISOString(), algorithm: result.algorithm, candidate: result.candidate } };
        setSession(next); if (await persist(next)) setFeedback("Respuesta recibida y guardada como registro procesado. Revisá P, I y D antes de setearlos.");
      }
    }
    catch (e) { setFeedback(controller.signal.aborted ? "Análisis remoto cancelado o vencido (30 s)." : e instanceof Error ? e.message : "Servicio no disponible."); }
    finally { clearTimeout(timeout); remote.current = null; setAnalyzing(false); }
  }
  async function sendPid(candidate = false) {
    try {
      const values = candidate ? session?.processed?.candidate : { kp: Number(draft.kp), ki: Number(draft.ki), kd: Number(draft.kd) };
      if (!values || (!candidate && Object.values(draft).some((v) => !v.trim()))) throw new Error("Completá P, I y D antes de enviar.");
      const confirmed = await pid.write(values); setModifyPid(false);
      if (candidate && session?.processed) {
        const next = { ...session, processed: { ...session.processed, confirmedPid: confirmed, appliedAt: new Date().toISOString() } };
        setSession(next); if (!await persist(next)) return;
      }
      setFeedback("La placa confirmó y guardó P, I y D. El controlador reinició su estado.");
    } catch (e) { setFeedback(e instanceof Error ? e.message : "No se pudo enviar el PID."); }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("La sesión supera el límite de 8 MB.");
      const value = parseSession(JSON.parse(await file.text()));
      setSession(value); setAnalysis(null); await persist(value); setFeedback("Sesión importada. Revisá el origen y los tiempos antes de analizar.");
    } catch (e) { setFeedback(e instanceof Error ? e.message : "Sesión inválida."); }
  }
  return <section className="balance-workbench" aria-label="Calibración del balance">
    <MotionControlPanel />
    <div className="calibration-guide"><span className="home-kicker">Preparar → Registrar → Analizar</span>
      <h2>Entender el equilibrio</h2><p>Compará inclinación, esfuerzo de motores y aportes del PID. El balance sigue ejecutándose en la F4.</p></div>
    <div className="calibration-card"><div className="calibration-result-heading"><div><span className="home-kicker">Valores de la placa</span><h3>PID actual</h3></div><button className="app-button" disabled={!connected || mockMode || pid.pending || capturing || analyzing} onClick={() => { void pid.read().catch(() => undefined); }}>Actualizar PID</button></div>
      <div className="calibration-pid-grid">{(["kp", "ki", "kd"] as const).map((key, i) => <label key={key}>{["P · Proporcional", "I · Integral", "D · Derivativo"][i]}
        {modifyPid ? <input type="number" min="0" max="1000" step="any" value={draft[key]} disabled={pid.pending || capturing || analyzing} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} /> : <strong>{pid.current?.[key] ?? "—"}</strong>}</label>)}</div>
      <label className="calibration-checkbox"><input type="checkbox" checked={modifyPid} disabled={!pid.current || pid.pending || capturing || analyzing} onChange={(e) => setModifyPid(e.target.checked)} />Modificar</label>
      {modifyPid && <><p>Enviar guarda las ganancias en la placa y reinicia el estado del PID.</p><button className="app-button calibration-button--primary" disabled={pid.pending || capturing || analyzing || !connected || mockMode} onClick={() => { void sendPid(); }}>Enviar</button></>}
      {pid.pending && <p role="status">Consultando o enviando PID…</p>}{pid.error && <p role="alert">{pid.error}</p>}
    </div>
    <div className="calibration-grid"><div className="calibration-card">
      <h3>Registrar una sesión</h3>
      <label>Nombre<input className="app-input" value={name} disabled={capturing} onChange={(e) => setName(e.target.value)} maxLength={160} /></label>
      <label>Condiciones del auto<textarea className="app-input" value={notes} disabled={capturing} onChange={(e) => setNotes(e.target.value)} maxLength={4000} placeholder="Batería, carga, superficie y cambios realizados" /></label>
      <p className="ui-muted">La captura actual usa tiempos del navegador. Sirve para diagnóstico; el optimizador exige ciclos sincronizados de la F4.</p>
      <div className="calibration-actions">
        <button className="app-button calibration-button--primary" disabled={!connected || mockMode || !pid.current || pid.pending || capturing || analyzing} onClick={start}>Iniciar registro</button>
        {capturing && <button className="app-button" onClick={() => { setCapturing(false); setFeedback("Registro finalizado. El control del auto continúa en la F4."); }}>Detener registro</button>}
        <label className="ir-calibration-file-button">Importar sesión<input type="file" accept=".json,application/json" disabled={capturing || analyzing} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; void importFile(file); }} /></label>
      </div>
      {!connected || mockMode ? <p>Necesitás una conexión real para registrar. Podés trabajar con sesiones guardadas.</p> : null}
      <p role="status" className="calibration-feedback">{feedback}</p>
    </div><aside className="calibration-card">
      <h3>Historial local</h3><p className="ui-muted">Las sesiones se guardan en este navegador y pueden exportarse.</p>
      {history.length === 0 && <p>Todavía no hay sesiones guardadas.</p>}
      <div className="calibration-history">{history.map((s) => <div key={s.id}>
        <button className="app-button" disabled={capturing || analyzing} aria-pressed={s.id === session?.id} onClick={() => { setSession(s); setAnalysis(null); }}>{s.name}<small>{new Date(s.createdAt).toLocaleString()} · {s.samples.length} muestras</small></button>
        <button className="app-button" disabled={capturing || analyzing} aria-label={`Eliminar ${s.name}`} onClick={() => {
          void deleteSession(s.id).then(() => listSessions()).then(setHistory).catch(() => setFeedback("No se pudo eliminar la sesión."));
        }}>Eliminar</button></div>)}</div>
    </aside></div>
    {session && <div className="calibration-card">
      <header className="calibration-result-heading"><div><span className="home-kicker">{session.processed ? "Registro procesado" : session.timing === "f4-control-cycle" ? "Ciclos F4 · importados" : "Snapshot real · llegada Web"}</span><h3>{session.name}</h3></div>
        <button className="app-button" disabled={capturing} onClick={() => downloadSession(session)}>Exportar sesión</button></header>
      <div className="calibration-metrics"><div><strong>{stats?.count}</strong><span>Muestras</span></div><div><strong>{stats?.durationS.toFixed(1)} s</strong><span>Duración</span></div>
        <div><strong>{stats?.rmsDeg.toFixed(2)}°</strong><span>Error RMS</span></div><div><strong>{stats?.peakDeg.toFixed(2)}°</strong><span>Error máximo</span></div></div>
      <div className="calibration-tabs" aria-label="Variable del gráfico">{(["angle", "output", "terms"] as const).map((key) => <button className="app-button" key={key} aria-pressed={chart === key} onClick={() => setChart(key)}>{key === "angle" ? "Inclinación" : key === "output" ? "Motores" : "Aportes P / I / D"}</button>)}</div>
      <SessionChart session={session} mode={chart} />
      <label>Comparar con una sesión anterior<select className="app-input" value={comparisonId} onChange={(e) => setComparisonId(e.target.value)}>
        <option value="">Seleccionar sesión</option>{history.filter((s) => s.id !== session.id).map((s) => <option key={s.id} value={s.id}>{s.name} · {new Date(s.createdAt).toLocaleString()}</option>)}
      </select></label>
      {comparisonStats && <><table className="ir-calibration-table"><caption>Comparación de registros · las condiciones pueden diferir</caption><thead><tr><th>Métrica</th><th>{comparison?.name}</th><th>{session.name}</th></tr></thead><tbody>
        <tr><th>Error RMS</th><td>{comparisonStats.rmsDeg.toFixed(2)}°</td><td>{stats?.rmsDeg.toFixed(2)}°</td></tr>
        <tr><th>Error máximo</th><td>{comparisonStats.peakDeg.toFixed(2)}°</td><td>{stats?.peakDeg.toFixed(2)}°</td></tr>
        <tr><th>Duración</th><td>{comparisonStats.durationS.toFixed(1)} s</td><td>{stats?.durationS.toFixed(1)} s</td></tr>
      </tbody></table><p className="ui-muted">RMS por muestras observadas; esta comparación no acredita una mejora física ni iguala condiciones de batería, carga o muestreo.</p></>}
      <button className="app-button calibration-button--primary" disabled={capturing || analyzing || session.samples.length === 0} onClick={analyze}>{analyzing ? "Analizando…" : "Analizar y calcular propuesta"}</button>
      <div className="calibration-card"><h3>Procesar con MCP</h3><p>Prepará un registro con nombre para el futuro servidor de procesamiento. El conector HTTP debe estar configurado para enviar los datos.</p>
        <label>Nombre del registro procesado<input value={processingName} maxLength={160} disabled={analyzing || capturing} onChange={(e) => setProcessingName(e.target.value)} placeholder="Ej. Balance · batería cargada" /></label>
        <button className="app-button calibration-button--primary" disabled={capturing || analyzing || pid.pending || !processingName.trim()} onClick={() => { void sendAnalysis(); }}>Procesar con MCP</button>
      <details><summary>Conexión del servidor MCP</summary><p>Se envían las muestras y condiciones de esta sesión al conector HTTP del servicio MCP. No se envía el PIN del dispositivo. La disponibilidad del servidor y su integración MCP son futuras.</p>
        <label>Servicio de análisis<input className="app-input" value={endpoint} disabled={analyzing} onChange={(e) => setEndpoint(e.target.value)} /></label>
        <label>Token del servicio<input className="app-input" type="password" autoComplete="off" value={token} disabled={analyzing} onChange={(e) => setToken(e.target.value)} /></label>
      </details></div>
      {session.processed && <div className="calibration-analysis"><span className="home-kicker">Respuesta del procesamiento</span><h3>{session.processed.name}</h3>
        <div className="calibration-pid-grid">{(["kp", "ki", "kd"] as const).map((key) => <div key={key}><span>{key.toUpperCase()}</span><strong>{session.processed?.candidate[key].toFixed(4)}</strong></div>)}</div>
        <button className="app-button calibration-button--primary" disabled={!connected || mockMode || capturing || analyzing || pid.pending} onClick={() => { void sendPid(true); }}>Setear valores</button>
        {session.processed.appliedAt && <p>La placa confirmó estos valores el {new Date(session.processed.appliedAt).toLocaleString()}. Registro guardado.</p>}
      </div>}
      {analyzing && <button className="app-button" onClick={() => { worker.current?.terminate(); worker.current = null; remote.current?.abort(); if (!remote.current) setAnalyzing(false); }}>Cancelar análisis</button>}
      {analysis && <div className="calibration-analysis" role="status"><h3>{analysis.status === "proposal" ? "Propuesta experimental" : analysis.status === "no-candidate" ? "Sin candidato admisible" : "Datos insuficientes para optimizar"}</h3>
        <button className="app-button" onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" }));
          const anchor = document.createElement("a"); anchor.href = url; anchor.download = `balance-analysis-${session.id}.json`; anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Exportar informe</button>
        {analysis.reasons.map((r) => <p key={r}>{r}</p>)}
        {analysis.candidate && <><table className="ir-calibration-table"><caption>Ganancias actuales y propuesta · simulación</caption><thead><tr><th>Término</th><th>Actual</th><th>Propuesta</th></tr></thead><tbody>
          {(["kp", "ki", "kd"] as const).map((k) => <tr key={k}><th>{k.toUpperCase()}</th><td>{(session.samples[0]?.gains[k] ?? session.initialPid?.[k])?.toFixed(4) ?? "—"}</td><td>{analysis.candidate?.[k].toFixed(4)}</td></tr>)}</tbody></table>
          <p>Costo simulado: {analysis.baselineCost?.toFixed(4)} → {analysis.candidateCost?.toFixed(4)}. Error del modelo: {analysis.fitErrorDeg?.toFixed(3)}°.</p>
          <table className="ir-calibration-table"><caption>Sensibilidad · costo al variar cada ganancia</caption><thead><tr><th>Término</th><th>−10%</th><th>+10%</th></tr></thead><tbody>{analysis.sensitivity.map((s) => <tr key={s.term}><th>{s.term.toUpperCase()}</th><td>{s.minusCost?.toFixed(4) ?? "No admisible"}</td><td>{s.plusCost?.toFixed(4) ?? "No admisible"}</td></tr>)}</tbody></table>
        </>}
        <p className="ui-muted">La propuesta simulada no garantiza estabilidad física. La prueba temporal con reversión sigue pendiente; el envío explícito de valores guarda el PID mediante los comandos existentes.</p>
      </div>}
    </div>}
  </section>;
}
function SessionChart({ session, mode }: { session: BalanceSession; mode: "angle" | "output" | "terms" }) {
  const all = session.samples; if (all.length < 2) return <p>El gráfico aparece al registrar dos muestras.</p>;
  const samples = all.filter((_, i) => i % Math.max(1, Math.ceil(all.length / 500)) === 0 || i === all.length - 1);
  const series = mode === "angle" ? [samples.map((s) => s.pitch), samples.map((s) => s.target)] : mode === "output" ?
    [samples.map((s) => s.left), samples.map((s) => s.right)] : [samples.map((s) => s.gains.kp * s.error), samples.map((s) => s.gains.ki * s.integral), samples.map((s) => s.gains.kd * s.derivative)];
  const max = Math.max(1, ...series.flat().map(Math.abs)); const start = samples[0].timeMs;
  const duration = samples[samples.length - 1].timeMs - start;
  const labels = mode === "angle" ? ["Medido", "Objetivo"] : mode === "output" ? ["Izquierdo", "Derecho"] : ["P", "I", "D"];
  return <figure className="calibration-chart"><svg viewBox="0 0 800 230" role="img" aria-label={`${labels.join(", ")} en función del tiempo. Escala de −${max.toFixed(1)} a ${max.toFixed(1)} ${mode === "angle" ? "grados" : "por ciento"}.`}>
    <line x1="35" x2="785" y1="110" y2="110" stroke="currentColor" opacity=".2" />
    {series.map((values, i) => <polyline key={labels[i]} className={`calibration-series-${i}`} fill="none" strokeWidth="2" points={values.map((v, j) => `${35 + (samples[j].timeMs - start) / duration * 750},${110 - v / max * 90}`).join(" ")} />)}
    <text x="35" y="220" fill="currentColor">0 s</text><text x="710" y="220" fill="currentColor">{(duration / 1000).toFixed(1)} s</text><text x="35" y="15" fill="currentColor">±{max.toFixed(1)} {mode === "angle" ? "°" : "%"}</text>
  </svg><figcaption>{labels.map((label, i) => <span key={label} className={`calibration-series-${i}`}>{label}</span>)}{mode === "terms" && <span>Aportes calculados desde ganancias y estados reportados, antes de límites e inversión.</span>}</figcaption></figure>;
}
