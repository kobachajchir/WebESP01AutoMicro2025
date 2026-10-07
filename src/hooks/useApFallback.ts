import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import { ESP_COMMANDS } from "../protocol/wsApi";

type Policy = { status: number; enabled: boolean; syncState: number };
const states = ["Sin confirmación del backend", "Aplicación pendiente", "Aplicada", "Error de aplicación"];

export function useApFallback() {
  const { connected, request } = useWebSocket();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  const busy = useRef(false);

  const read = useCallback(async () => {
    const current = generation.current;
    const data = await request<Policy>(ESP_COMMANDS.GET_AP_FALLBACK);
    if (current !== generation.current) return;
    if (data.status !== 0 || typeof data.enabled !== "boolean" || !Number.isInteger(data.syncState) || data.syncState < 0 || data.syncState > 3) {
      throw new Error("La política AP fallback no tiene una respuesta compatible.");
    }
    setPolicy(data);
  }, [request]);

  useEffect(() => {
    generation.current += 1;
    busy.current = false;
    setPolicy(null); setPending(false); setMessage("");
    return () => { generation.current += 1; };
  }, [connected]);

  const run = useCallback(async (operation: () => Promise<void>) => {
    if (!connected || busy.current) return;
    const current = generation.current;
    busy.current = true; setPending(true); setMessage("");
    try { await operation(); }
    catch (cause) {
      if (current === generation.current) {
        setPolicy(null);
        setMessage(cause instanceof Error ? cause.message : "No se confirmó la operación. Revisá la sesión STM y la versión del firmware.");
      }
    } finally {
      if (current === generation.current) { busy.current = false; setPending(false); }
    }
  }, [connected]);

  const refresh = useCallback(() => run(read), [run, read]);
  const toggle = useCallback(async () => {
    if (!policy) return;
    await run(async () => {
      const data = await request<{ status: number }>(ESP_COMMANDS.SET_AP_FALLBACK, { enabled: !policy.enabled });
      if (data.status !== 0) throw new Error("F4 rechazó el cambio de política.");
      await read();
    });
  }, [policy, run, request, read]);

  return { policy, pending, message, connected, refresh, toggle,
    statusText: policy ? `AP fallback ${policy.enabled ? "activado" : "desactivado"} · ${states[policy.syncState]}` : "Política sin confirmar. Consultala con una sesión STM autorizada." };
}

export type ApFallbackController = ReturnType<typeof useApFallback>;
