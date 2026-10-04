import { useCallback, useEffect, useState } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { ESP_COMMANDS } from "../../protocol/wsApi";
import type { Gains } from "./session";
export function parsePid(value: unknown): Gains {
  if (!value || typeof value !== "object") throw new Error("La placa devolvió un PID inválido.");
  const data = value as Record<string, unknown>;
  if (data.status !== 0) throw new Error(`La placa rechazó el PID (status ${String(data.status)}).`);
  const values = [data.kp, data.ki, data.kd];
  if (!values.every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1000))
    throw new Error("La respuesta PID no contiene ganancias válidas en 0–1000.");
  return { kp: data.kp as number, ki: data.ki as number, kd: data.kd as number };
}
export function useBalancePid() {
  const { request, connected, mockMode } = useWebSocket();
  const [current, setCurrent] = useState<Gains | null>(null);
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const read = useCallback(async () => {
    if (!connected || mockMode) throw new Error("Necesitás una conexión real con la placa.");
    setPending(true); setError("");
    try {
      const value = parsePid(await request(ESP_COMMANDS.GET_BALANCE_PID, {}, { timeoutMs: 3000 }));
      setCurrent(value); return value;
    } catch (e) { setCurrent(null); setError(e instanceof Error ? e.message : "No se pudo leer el PID."); throw e; }
    finally { setPending(false); }
  }, [connected, mockMode, request]);
  useEffect(() => {
    if (!connected || mockMode) { setCurrent(null); return; }
    let active = true;
    setPending(true); setCurrent(null); setError("");
    request(ESP_COMMANDS.GET_BALANCE_PID, {}, { timeoutMs: 3000 }).then(parsePid).then((value) => { if (active) setCurrent(value); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "No se pudo leer el PID."); })
      .finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [connected, mockMode, request]);
  const write = async (gains: Gains): Promise<Gains> => {
    if (!connected || mockMode) throw new Error("Necesitás una conexión real con la placa.");
    if (![gains.kp, gains.ki, gains.kd].every((v) => Number.isFinite(v) && v >= 0 && v <= 1000))
      throw new Error("P, I y D deben ser valores entre 0 y 1000.");
    setPending(true); setError("");
    try {
      const confirmed = parsePid(await request(ESP_COMMANDS.SET_BALANCE_PID, { ...gains }, { timeoutMs: 3000 }));
      if ((["kp", "ki", "kd"] as const).some((key) => Math.abs(confirmed[key] - Math.fround(gains[key])) > 1e-4))
        throw new Error("La respuesta no confirma los valores enviados. Volvé a leer el PID de la placa.");
      setCurrent(confirmed); return confirmed;
    } catch (e) { setCurrent(null); setError(e instanceof Error ? e.message : "No se pudo confirmar el PID; volvé a leer la placa."); throw e; }
    finally { setPending(false); }
  };
  return { current, pending, error, read, write };
}
