import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { ESP_COMMANDS } from "../protocol/wsApi";

type Policy = { status: number; enabled: boolean; syncState: number };
const states = ["Sin confirmación del backend", "Aplicación pendiente", "Aplicada", "Error de aplicación"];

export default function ApFallbackControls() {
  const { connected, request } = useWebSocket();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const generation = useRef(0);
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
    setPolicy(null);
    setPending(false);
    setMessage("");
    return () => { generation.current += 1; };
  }, [connected]);
  const run = async (operation: () => Promise<void>) => {
    const current = generation.current;
    setPending(true);
    setMessage("");
    try { await operation(); }
    catch (error) {
      if (current === generation.current) {
        setPolicy(null);
        setMessage(error instanceof Error ? error.message : "No se confirmó la operación. Revisá la sesión STM y la versión del firmware.");
      }
    } finally { if (current === generation.current) setPending(false); }
  };
  return <section className="app-panel" aria-labelledby="ap-fallback-title">
    <h3 id="ap-fallback-title">Recuperación de conexión</h3>
    <p>La F4 conserva la política que abre el punto de acceso si la estación no logra conectarse.</p>
    <p role="status">{policy ? `AP fallback ${policy.enabled ? "activado" : "desactivado"} · ${states[policy.syncState]}` : "Política sin confirmar. Consultala con una sesión STM autorizada."}</p>
    <div className="flex flex-wrap gap-3">
      <button className="app-button" disabled={!connected || pending} onClick={() => void run(read)}>Consultar política</button>
      <button className="app-button" disabled={!connected || pending || !policy} onClick={() => void run(async () => {
        const data = await request<{ status: number }>(ESP_COMMANDS.SET_AP_FALLBACK, { enabled: !policy!.enabled });
        if (data.status !== 0) throw new Error("F4 rechazó el cambio de política.");
        await read();
      })}>{policy?.enabled ? "Desactivar AP fallback" : "Activar AP fallback"}</button>
      <button className="app-button" disabled={!connected || pending} onClick={() => void run(async () => {
        const data = await request<{ status: number }>("esp.wifi.connect", {}, { timeoutMs: 25000 });
        if (data.status !== 0) throw new Error("No se confirmó el reintento de estación.");
        setMessage("Reintento solicitado. Consultá el estado de conexión para conocer el resultado.");
      })}>Reintentar estación</button>
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}
