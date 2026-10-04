import type { BalanceSession } from "./session";
import type { Analysis } from "./optimizer";
export async function remoteAnalysis(session: BalanceSession, endpoint: string, token: string, signal: AbortSignal): Promise<Analysis> {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))
    throw new Error("Usá HTTPS o un servicio local para enviar la sesión.");
  if (url.username || url.password) throw new Error("La URL no debe contener credenciales.");
  const response = await fetch(url, { method: "POST", headers: {
    "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, body: JSON.stringify(session), signal, credentials: "omit" });
  if (!response.ok) throw new Error(`El servicio rechazó el análisis (${response.status}).`);
  const value: unknown = await response.json();
  if (!value || typeof value !== "object") throw new Error("Respuesta inválida del servicio.");
  const r = value as Analysis;
  if (r.algorithm !== "arx2-grid-v1" || r.sessionId !== session.id ||
      !["insufficient-data", "no-candidate", "proposal"].includes(r.status) ||
      !Array.isArray(r.reasons) || !r.reasons.every((s) => typeof s === "string") ||
      !Array.isArray(r.sensitivity) || !r.sensitivity.every((s) => s && ["kp", "ki", "kd"].includes(s.term) && [s.minusCost, s.plusCost].every(numberOrNull)) ||
      ![r.baselineCost, r.candidateCost, r.fitErrorDeg].every(numberOrNull) ||
      (r.status === "proposal" && (!r.candidate || ![r.candidate.kp, r.candidate.ki, r.candidate.kd].every((v) => typeof v === "number" && Number.isFinite(v)))) ||
      (r.status !== "proposal" && r.candidate !== null)) throw new Error("El resultado no corresponde al contrato de análisis.");
  return r;
}
function numberOrNull(v: unknown) { return v === null || (typeof v === "number" && Number.isFinite(v)); }
