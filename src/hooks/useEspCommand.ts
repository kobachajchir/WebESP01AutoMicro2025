import { useCallback, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { CommandName } from "../protocol/wsApi";

export function useEspCommand<T>(command: CommandName) {
  const { request } = useWebSocket();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (args: Record<string, unknown> = {}) => {
    setPending(true);
    setError(null);
    try {
      return await request<T>(command, args);
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error(String(cause));
      setError(nextError);
      throw nextError;
    } finally {
      setPending(false);
    }
  }, [command, request]);

  return { execute, pending, error };
}
