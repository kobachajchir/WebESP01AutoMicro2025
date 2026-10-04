/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useUser } from "./UserContext";
import { ESP_COMMANDS } from "../protocol/wsApi";
export type IrEmittersState = { objects: boolean; line: boolean; lights: boolean };
type ContextValue = { state: IrEmittersState | null; available: boolean; pending: boolean; error: string | null; refresh: () => Promise<void>; setEnabled: (key: keyof IrEmittersState, enabled: boolean) => Promise<void> };
const Context = createContext<ContextValue | null>(null);
function decode(value: unknown): IrEmittersState {
  const data = value as Partial<IrEmittersState> | null;
  if (!data || typeof data.objects !== "boolean" || typeof data.line !== "boolean" || typeof data.lights !== "boolean") throw new Error("Respuesta de emisores IR inválida");
  return { objects: data.objects, line: data.line, lights: data.lights };
}
export function IrEmittersProvider({ children }: { children: ReactNode }) {
  const { connected, mockMode, request, subscribeEvent } = useWebSocket();
  const { stmAuth } = useUser();
  const available = connected && stmAuth.authenticated && !mockMode;
  const [state, setState] = useState<IrEmittersState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<IrEmittersState | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const commit = useCallback((value: unknown) => { const next = decode(value); current.current = next; setState(next); }, []);
  const execute = useCallback(async (args?: IrEmittersState) => {
    if (!available || busy.current) return;
    const epoch = generation.current;
    busy.current = true; setPending(true); setError(null);
    try {
      const value = await request<unknown>(args ? ESP_COMMANDS.SET_IR_EMITTERS : ESP_COMMANDS.GET_IR_EMITTERS, args ?? {}, { timeoutMs: 2000 });
      if (epoch !== generation.current) return;
      if (args && (value as { status?: number })?.status !== 0) throw new Error("F4 rechazó el cambio de emisores IR");
      commit(value);
    } catch (reason) {
      if (epoch === generation.current) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (epoch === generation.current) { busy.current = false; setPending(false); }
    }
  }, [available, request, commit]);
  const refresh = useCallback(() => execute(), [execute]);
  const setEnabled = useCallback(async (key: keyof IrEmittersState, enabled: boolean) => {
    if (current.current) await execute({ ...current.current, [key]: enabled });
  }, [execute]);
  useEffect(() => {
    generation.current++; busy.current = false; current.current = null;
    setState(null); setPending(false); setError(null);
    if (available) void refresh();
    return () => { generation.current++; };
  }, [available, refresh]);
  useEffect(() => subscribeEvent("stm.irEmitters.changed", (event) => {
    if (!available) return;
    try { commit(event.data); } catch (reason) { setError(String(reason)); }
  }), [available, subscribeEvent, commit]);
  return <Context.Provider value={{ state, available, pending, error, refresh, setEnabled }}>{children}</Context.Provider>;
}
export function useIrEmitters() {
  const value = useContext(Context);
  if (!value) throw new Error("useIrEmitters requiere IrEmittersProvider");
  return value;
}
