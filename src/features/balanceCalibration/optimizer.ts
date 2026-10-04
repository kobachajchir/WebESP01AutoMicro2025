import { parseSession, summarize } from "./session.ts";
import type { BalanceSession, Gains } from "./session.ts";
export interface Analysis {
  algorithm: "arx2-grid-v1"; sessionId: string;
  status: "insufficient-data" | "no-candidate" | "proposal";
  reasons: string[]; candidate: Gains | null; baselineCost: number | null;
  candidateCost: number | null; fitErrorDeg: number | null;
  sensitivity: { term: keyof Gains; minusCost: number | null; plusCost: number | null }[];
}
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
function solve(matrix: number[][], vector: number[]): number[] | null {
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < 4; col++) {
    let pivot = col;
    for (let i = col + 1; i < 4; i++) if (Math.abs(a[i][col]) > Math.abs(a[pivot][col])) pivot = i;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    if (Math.abs(a[col][col]) < 1e-9) return null;
    const divisor = a[col][col]; for (let j = col; j < 5; j++) a[col][j] /= divisor;
    for (let i = 0; i < 4; i++) if (i !== col) {
      const factor = a[i][col]; for (let j = col; j < 5; j++) a[i][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[4]);
}
export function analyzeSession(value: unknown): Analysis {
  const session = parseSession(value); const stats = summarize(session);
  const result: Analysis = { algorithm: "arx2-grid-v1", sessionId: session.id, status: "insufficient-data",
    reasons: [], candidate: null, baselineCost: null, candidateCost: null, fitErrorDeg: null, sensitivity: [] };
  const p = session.samples; const c = session.controller;
  if (session.timing !== "f4-control-cycle") result.reasons.push("Los tiempos son de llegada al navegador, no del ciclo F4.");
  if (!c) result.reasons.push("Falta la configuración completa del filtro, límites e inversión de salida.");
  if (session.firmware === "no informado" || !session.firmware.trim()) result.reasons.push("Falta identificar la versión de firmware.");
  if (p.length < 200 || stats.durationS < 2) result.reasons.push("Se necesitan al menos 200 ciclos y 2 segundos de datos.");
  if (stats.gaps || p.some((s) => s.stopped)) result.reasons.push("Hay pérdidas de ciclos o una parada en el registro.");
  if (result.reasons.length || !c) return result;
  const base = p[0].gains; const target = p[0].target;
  const dt = (p[p.length - 1].timeMs - p[0].timeMs) / (p.length - 1) / 1000;
  if (dt < .001 || dt > .05 || p.slice(1).some((s, i) => Math.abs((s.timeMs - p[i].timeMs) / 1000 - dt) > dt * .1))
    result.reasons.push("El período no es uniforme o está fuera de 1–50 ms.");
  if (p.some((s) => s.target !== target || s.gains.kp !== base.kp || s.gains.ki !== base.ki || s.gains.kd !== base.kd))
    result.reasons.push("Objetivo y ganancias deben permanecer constantes en esta identificación.");
  if (p.some((s) => Math.abs(s.left - s.right) > 5 || Math.abs(s.output) > c.outputLimit * .95))
    result.reasons.push("La sesión incluye giro o salida cercana a saturación; requiere otro modelo.");
  if (result.reasons.length) return result;
  const trainEnd = Math.floor(p.length * .7);
  const matrix = Array.from({ length: 4 }, () => [0, 0, 0, 0]); const vector = [0, 0, 0, 0];
  for (let i = 2; i < trainEnd; i++) {
    const x = [p[i - 1].pitch - target, p[i - 2].pitch - target, p[i - 1].output / c.outputLimit, 1];
    for (let j = 0; j < 4; j++) { vector[j] += x[j] * (p[i].pitch - target);
      for (let k = 0; k < 4; k++) matrix[j][k] += x[j] * x[k]; }
  }
  const model = solve(matrix, vector);
  if (!model || model.some((v) => !Number.isFinite(v)) || Math.abs(model[2]) < 1e-6) {
    result.reasons.push("Excitación insuficiente para identificar la dinámica de forma independiente."); return result;
  }
  let residual = 0;
  for (let i = trainEnd; i < p.length; i++) {
    const predicted = model[0] * (p[i - 1].pitch - target) + model[1] * (p[i - 2].pitch - target) +
      model[2] * p[i - 1].output / c.outputLimit + model[3];
    residual += (predicted - (p[i].pitch - target)) ** 2;
  }
  result.fitErrorDeg = Math.sqrt(residual / (p.length - trainEnd));
  if (result.fitErrorDeg > Math.max(.1, stats.rmsDeg * .25)) {
    result.reasons.push("El modelo no explica suficientemente la parte reservada de la sesión."); return result;
  }
  const cost = (g: Gains): number => simulate(session, model, dt, g);
  const baselineCost = cost(base);
  if (!Number.isFinite(baselineCost)) { result.status = "no-candidate"; result.reasons.push("El modelo no conserva la base estable en los escenarios simulados."); return result; }
  result.baselineCost = baselineCost;
  let best = base; let bestCost = baselineCost;
  for (const kp of [.8, 1, 1.2]) for (const ki of [0, .8, 1, 1.2]) for (const kd of [.8, 1, 1.2]) {
    const g = { kp: base.kp * kp, ki: base.ki * ki, kd: base.kd * kd }; const value = cost(g);
    if (value < bestCost) { bestCost = value; best = g; }
  }
  if (bestCost >= baselineCost * .98) {
    result.status = "no-candidate"; result.reasons.push("No hay una mejora simulada mayor al 2% dentro de ±20% de las ganancias iniciales."); return result;
  }
  result.status = "proposal"; result.candidate = best; result.candidateCost = bestCost;
  result.reasons.push("Propuesta experimental basada en modelo ARX local; requiere ensayo físico. No acredita márgenes de estabilidad.");
  result.sensitivity = (["kp", "ki", "kd"] as const).map((term) => {
    const minus = cost({ ...best, [term]: best[term] * .9 }); const plus = cost({ ...best, [term]: best[term] * 1.1 });
    return { term, minusCost: Number.isFinite(minus) ? minus : null, plusCost: Number.isFinite(plus) ? plus : null };
  });
  return result;
}
function simulate(session: BalanceSession, m: number[], dt: number, gains: Gains): number {
  const c = session.controller!; let worst = 0;
  // Fixed objective: angle + angular change + normalized actuator effort + saturation.
  for (const disturbance of [-1, 1]) for (const response of [.9, 1, 1.1]) {
    let y = disturbance; let previous = y; let integral = 0; let derivative = 0; let sum = 0;
    const steps = Math.min(5000, Math.ceil(5 / dt));
    for (let i = 0; i < steps; i++) {
      const error = -y; integral = clamp(integral + error * dt, c.integralMin, c.integralMax);
      derivative += dt / (c.derivativeTauS + dt) * (-(y - previous) / dt - derivative);
      let raw = gains.kp * error + gains.ki * integral + gains.kd * derivative;
      let output = clamp(raw, -c.outputLimit, c.outputLimit);
      if (output !== raw && gains.ki !== 0 && c.antiWindupGain > 0) {
        integral = clamp(integral + c.antiWindupGain * (output - raw) / gains.ki, c.integralMin, c.integralMax);
        raw = gains.kp * error + gains.ki * integral + gains.kd * derivative;
        output = clamp(raw, -c.outputLimit, c.outputLimit);
      }
      if (c.inverted) output = -output;
      const next = m[0] * y + m[1] * previous + m[2] * response * output / c.outputLimit + m[3];
      if (!Number.isFinite(next) || Math.abs(next) > 10) return Infinity;
      sum += y ** 2 + .01 * ((y - previous) / dt) ** 2 + .05 * (output / c.outputLimit) ** 2 + (Math.abs(raw) > c.outputLimit ? 2 : 0);
      previous = y; y = next;
    }
    if (Math.abs(y) > .2) return Infinity;
    worst = Math.max(worst, sum / steps);
  }
  return worst;
}
