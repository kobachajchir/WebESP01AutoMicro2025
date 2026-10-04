export interface Gains { kp: number; ki: number; kd: number }
export interface BalanceSample {
  timeMs: number; sequence: number; pitch: number; target: number;
  output: number; left: number; right: number; error: number;
  integral: number; derivative: number; gains: Gains; stopped: boolean;
}
export interface ControllerConfig {
  derivativeTauS: number; integralMin: number; integralMax: number;
  outputLimit: number; antiWindupGain: number; inverted: boolean;
}
export interface BalanceSession {
  schema: "automicro.balance-session"; version: 1; id: string; createdAt: string;
  name: string; notes: string; firmware: string;
  timing: "web-arrival" | "f4-control-cycle";
  controller: ControllerConfig | null; samples: BalanceSample[];
  initialPid?: Gains;
  processed?: { name: string; processedAt: string; algorithm: string; candidate: Gains;
    confirmedPid?: Gains; appliedAt?: string };
}
export function newSession(name: string, notes: string): BalanceSession {
  return { schema: "automicro.balance-session", version: 1, id: crypto.randomUUID(),
    createdAt: new Date().toISOString(), name, notes, firmware: "no informado",
    timing: "web-arrival", controller: null, samples: [] };
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Objeto de sesión inválido.");
  return value as Record<string, unknown>;
}
function finite(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("La sesión contiene un valor numérico inválido.");
  return value;
}
function flag(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Estado booleano inválido.");
  return value;
}
function text(value: unknown): string {
  if (typeof value !== "string" || value.length > 4000) throw new Error("Texto de sesión inválido.");
  return value;
}
function gains(value: unknown): Gains {
  const g = record(value); return { kp: finite(g.kp), ki: finite(g.ki), kd: finite(g.kd) };
}
export function parseSession(value: unknown): BalanceSession {
  const s = record(value);
  if (s.schema !== "automicro.balance-session" || s.version !== 1 ||
      !Array.isArray(s.samples) || s.samples.length > 10000 ||
      !["web-arrival", "f4-control-cycle"].includes(String(s.timing))) throw new Error("Formato de sesión no compatible.");
  const samples = s.samples.map((value): BalanceSample => {
    const p = record(value);
    return { timeMs: finite(p.timeMs), sequence: finite(p.sequence), pitch: finite(p.pitch),
      target: finite(p.target), output: finite(p.output), left: finite(p.left), right: finite(p.right),
      error: finite(p.error), integral: finite(p.integral), derivative: finite(p.derivative),
      gains: gains(p.gains), stopped: flag(p.stopped) };
  });
  samples.forEach((p, i) => {
    if (!Number.isSafeInteger(p.sequence) || p.sequence < 0 || p.timeMs < 0 ||
        (i > 0 && (p.timeMs <= samples[i - 1].timeMs || p.sequence <= samples[i - 1].sequence)))
      throw new Error("Los tiempos y secuencias deben ser crecientes.");
  });
  let controller: ControllerConfig | null = null;
  if (s.controller !== null) {
    const c = record(s.controller);
    controller = { derivativeTauS: finite(c.derivativeTauS), integralMin: finite(c.integralMin),
      integralMax: finite(c.integralMax), outputLimit: finite(c.outputLimit),
      antiWindupGain: finite(c.antiWindupGain), inverted: flag(c.inverted) };
    if (controller.derivativeTauS < 0 || controller.outputLimit <= 0 || controller.outputLimit > 100 ||
        controller.integralMin > controller.integralMax || controller.antiWindupGain < 0)
      throw new Error("Límites del controlador inválidos.");
  }
  let processed: BalanceSession["processed"];
  if (s.processed !== undefined) {
    const p = record(s.processed);
    processed = { name: text(p.name), processedAt: text(p.processedAt), algorithm: text(p.algorithm), candidate: gains(p.candidate),
      ...(p.confirmedPid !== undefined ? { confirmedPid: gains(p.confirmedPid) } : {}),
      ...(p.appliedAt !== undefined ? { appliedAt: text(p.appliedAt) } : {}) };
  }
  return { schema: "automicro.balance-session", version: 1, id: text(s.id), createdAt: text(s.createdAt),
    name: text(s.name), notes: text(s.notes), firmware: text(s.firmware),
    timing: s.timing as BalanceSession["timing"], controller, samples,
    ...(s.initialPid !== undefined ? { initialPid: gains(s.initialPid) } : {}),
    ...(processed ? { processed } : {}) };
}
export function telemetrySample(value: unknown, timeMs: number, sequence: number): BalanceSample {
  const p = record(value);
  if (p.status !== 0 || p.balanceActive !== true || p.safetyStop !== false)
    throw new Error("La F4 no informa un balance activo y sin parada. Registro detenido.");
  return { timeMs, sequence, pitch: finite(p.pitchMeasuredDeg), target: finite(p.pitchSetpointDeg),
    output: finite(p.balanceOutputPercent), left: finite(p.leftOutputPercent), right: finite(p.rightOutputPercent),
    error: finite(p.pidErrorDeg), integral: finite(p.pidIntegralDegS), derivative: finite(p.pidDerivativeDegS),
    gains: gains(p.pid), stopped: flag(p.safetyStop) };
}
export function summarize(session: BalanceSession) {
  const p = session.samples;
  return { count: p.length, durationS: p.length > 1 ? (p[p.length - 1].timeMs - p[0].timeMs) / 1000 : 0,
    rmsDeg: p.length ? Math.sqrt(p.reduce((sum, s) => sum + s.error ** 2, 0) / p.length) : 0,
    peakDeg: p.reduce((max, s) => Math.max(max, Math.abs(s.error)), 0),
    gaps: p.slice(1).filter((s, i) => s.sequence !== p[i].sequence + 1).length };
}
export function downloadSession(session: BalanceSession) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(session, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = `balance-${session.id}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
