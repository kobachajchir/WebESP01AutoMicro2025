/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { ESP_COMMANDS } from "../protocol/wsApi";
import { useUser } from "./UserContext";

export type CarModeLabel = "IDLE" | "FOLLOW" | "TEST" | "UNKNOWN";
export type SelectableCarMode = Exclude<CarModeLabel, "UNKNOWN">;
export type CarModeStatus = "idle" | "loading" | "synced" | "error";

interface CarModeContextValue {
  mode: CarModeLabel;
  rawMode: number | null;
  isTestMode: boolean;
  status: CarModeStatus;
  lastUpdatedAt: number | null;
  requestCarMode: () => void;
  setCarMode: (mode: SelectableCarMode) => Promise<boolean>;
  applyCarModeValue: (value: number | string, source?: string) => void;
}

interface CarModeProviderProps {
  children: ReactNode;
}

const CAR_MODE_POLL_MS = 3000;
const CAR_MODE_LABEL_BY_VALUE: Record<number, CarModeLabel> = {
  0x00: "IDLE",
  0x01: "FOLLOW",
  0x02: "TEST",
};
const CAR_MODE_VALUE_BY_LABEL: Record<SelectableCarMode, number> = {
  IDLE: 0x00,
  FOLLOW: 0x01,
  TEST: 0x02,
};

const CarModeContext = createContext<CarModeContextValue | undefined>(undefined);

export function CarModeProvider({ children }: CarModeProviderProps) {
  const { connected, request, subscribeEvent } = useWebSocket();
  const { remotePinAuthenticated } = useUser();
  const [rawMode, setRawMode] = useState<number | null>(null);
  const [mode, setMode] = useState<CarModeLabel>("UNKNOWN");
  const [status, setStatus] = useState<CarModeStatus>("idle");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const requestInFlightRef = useRef(false);
  const rawModeRef = useRef<number | null>(null);

  const applyCarModeValue = useCallback((value: number | string, source = "unknown") => {
    const parsed = normalizeCarModeValue(value);
    if (parsed === null) {
      return;
    }

    requestInFlightRef.current = false;
    rawModeRef.current = parsed;
    setRawMode(parsed);
    setMode(CAR_MODE_LABEL_BY_VALUE[parsed] ?? "UNKNOWN");
    setStatus("synced");
    setLastUpdatedAt(Date.now());

    console.log("[car-mode] actualizado", {
      source,
      rawMode: parsed,
      mode: CAR_MODE_LABEL_BY_VALUE[parsed] ?? "UNKNOWN",
    });
  }, []);

  const requestCarMode = useCallback(() => {
    if (!connected || !remotePinAuthenticated) {
      requestInFlightRef.current = false;
      setStatus("idle");
      return;
    }

    requestInFlightRef.current = true;
    setStatus((current) => (current === "synced" ? current : "loading"));
    void request<Record<string, unknown>>(ESP_COMMANDS.GET_CAR_MODE)
      .then((data) => applyCarModeValue(data.mode as number, "getCarMode"))
      .catch(() => {
        requestInFlightRef.current = false;
        setStatus("error");
      });
  }, [applyCarModeValue, connected, remotePinAuthenticated, request]);

  const setCarMode = useCallback(async (nextMode: SelectableCarMode): Promise<boolean> => {
    if (!connected || !remotePinAuthenticated) {
      setStatus("error");
      return false;
    }

    const expectedMode = CAR_MODE_VALUE_BY_LABEL[nextMode];
    setStatus("loading");
    try {
      const data = await request<Record<string, unknown>>(
        ESP_COMMANDS.SET_CAR_MODE,
        { mode: expectedMode },
        { timeoutMs: 3_500 },
      );
      if (typeof data.status === "number" && data.status !== 0) {
        console.warn(`[car-mode] F4 rechazo el cambio de modo (status ${data.status}).`);
        setStatus("error");
        requestCarMode();
        return false;
      }
      const confirmedMode = normalizeCarModeValue(data.mode as number);
      if (confirmedMode !== null) {
        applyCarModeValue(confirmedMode, "setCarMode");
      }
      if (confirmedMode === expectedMode) {
        return true;
      }
    } catch (cause) {
      console.warn("[car-mode] se perdio la respuesta correlacionada; verificando el estado real", cause);
    }

    // La F4 publica carModeChanged al aplicar el modo. Si la respuesta directa
    // se pierde, ese evento sigue siendo una confirmacion autoritativa.
    if (rawModeRef.current === expectedMode) {
      setStatus("synced");
      return true;
    }

    // Como ultima comprobacion se consulta nuevamente a la F4. Esto evita un
    // falso error cuando el modo se aplico pero vencio la respuesta 0x6E.
    try {
      const current = await request<Record<string, unknown>>(
        ESP_COMMANDS.GET_CAR_MODE,
        {},
        { timeoutMs: 1_500 },
      );
      const confirmedMode = normalizeCarModeValue(current.mode as number);
      if (confirmedMode !== null) {
        applyCarModeValue(confirmedMode, "setCarMode.verify");
      }
      if (confirmedMode === expectedMode) {
        return true;
      }
    } catch (verificationCause) {
      console.warn("[car-mode] tampoco se pudo verificar el modo actual", verificationCause);
    }

    if (rawModeRef.current === expectedMode) {
      setStatus("synced");
      return true;
    }

    setStatus("error");
    requestCarMode();
    return false;
  }, [applyCarModeValue, connected, remotePinAuthenticated, request, requestCarMode]);

  useEffect(() => {
    const applyEvent = ({ data }: { data: unknown }) => {
      if (typeof data === "object" && data !== null) {
        const record = data as Record<string, unknown>;
        const value = record.mode ?? record.carMode ?? record.value;
        if (typeof value === "number" || typeof value === "string") applyCarModeValue(value, "carModeChanged");
      }
    };
    const offCanonical = subscribeEvent("carModeChanged", applyEvent);
    const offTransitional = subscribeEvent("stm.event", applyEvent);
    return () => { offCanonical(); offTransitional(); };
  }, [applyCarModeValue, subscribeEvent]);

  useEffect(() => {
    if (!connected || !remotePinAuthenticated) {
      requestInFlightRef.current = false;
      rawModeRef.current = null;
      setStatus("idle");
      setRawMode(null);
      setMode("UNKNOWN");
      return;
    }

    requestCarMode();
    const interval = window.setInterval(() => {
      requestCarMode();
    }, CAR_MODE_POLL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [connected, remotePinAuthenticated, requestCarMode]);

  useEffect(() => {
    if (!requestInFlightRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (!requestInFlightRef.current) {
        return;
      }

      requestInFlightRef.current = false;
      setStatus((current) => (current === "synced" ? current : "error"));
    }, 1200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [status]);

  const value = useMemo<CarModeContextValue>(
    () => ({
      mode,
      rawMode,
      isTestMode: mode === "TEST",
      status,
      lastUpdatedAt,
      requestCarMode,
      setCarMode,
      applyCarModeValue,
    }),
    [applyCarModeValue, lastUpdatedAt, mode, rawMode, requestCarMode, setCarMode, status],
  );

  return (
    <CarModeContext.Provider value={value}>
      {children}
    </CarModeContext.Provider>
  );
}

export function useCarMode(): CarModeContextValue {
  const context = useContext(CarModeContext);

  if (!context) {
    throw new Error("useCarMode debe usarse dentro de <CarModeProvider>");
  }

  return context;
}

function normalizeCarModeValue(value: number | string): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(0xff, Math.trunc(value)));
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  const named = Object.entries(CAR_MODE_LABEL_BY_VALUE).find(
    ([, label]) => label === normalized,
  );

  if (named) {
    return Number(named[0]);
  }

  const parsed = normalized.startsWith("0X")
    ? Number.parseInt(normalized.slice(2), 16)
    : Number(normalized);

  return Number.isFinite(parsed)
    ? Math.max(0, Math.min(0xff, Math.trunc(parsed)))
    : null;
}
