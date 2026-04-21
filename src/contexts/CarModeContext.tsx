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
import {
  UNER_V2_CMD,
  buildGetCarModeFrame,
  createUnerV2StreamParser,
} from "../api/UnerFrameV2";
import { useWebSocket } from "../hooks/useWebSocket";

export type CarModeLabel = "IDLE" | "FOLLOW" | "TEST" | "UNKNOWN";
export type CarModeStatus = "idle" | "loading" | "synced" | "error";

interface CarModeContextValue {
  mode: CarModeLabel;
  rawMode: number | null;
  isTestMode: boolean;
  status: CarModeStatus;
  lastUpdatedAt: number | null;
  requestCarMode: () => void;
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

const CarModeContext = createContext<CarModeContextValue | undefined>(undefined);

export function CarModeProvider({ children }: CarModeProviderProps) {
  const { connected, sendRaw, subscribeRaw } = useWebSocket();
  const [rawMode, setRawMode] = useState<number | null>(null);
  const [mode, setMode] = useState<CarModeLabel>("UNKNOWN");
  const [status, setStatus] = useState<CarModeStatus>("idle");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const requestInFlightRef = useRef(false);
  const rawCarModeParserRef = useRef(createUnerV2StreamParser());

  const applyCarModeValue = useCallback((value: number | string, source = "unknown") => {
    const parsed = normalizeCarModeValue(value);
    if (parsed === null) {
      return;
    }

    requestInFlightRef.current = false;
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
    if (!connected) {
      requestInFlightRef.current = false;
      setStatus("idle");
      return;
    }

    try {
      requestInFlightRef.current = true;
      setStatus((current) => (current === "synced" ? current : "loading"));
      sendRaw(buildGetCarModeFrame(), {
        action: "getCarMode",
        cmd: "CMD_GET_CAR_MODE",
      });
    } catch (error) {
      requestInFlightRef.current = false;
      setStatus("error");
      console.error("[car-mode] no se pudo solicitar GET_CAR_MODE", error);
    }
  }, [connected, sendRaw]);

  useEffect(() => {
    return subscribeRaw((incoming) => {
      const bytes =
        incoming instanceof Uint8Array ? incoming : new Uint8Array(incoming);

      for (const frame of rawCarModeParserRef.current.push(bytes)) {
        if (
          (frame.cmd === UNER_V2_CMD.GET_CAR_MODE ||
            frame.cmd === UNER_V2_CMD.EVT_CAR_MODE_CHANGED) &&
          frame.payloadLength >= 1
        ) {
          applyCarModeValue(
            frame.payload[0],
            frame.cmd === UNER_V2_CMD.EVT_CAR_MODE_CHANGED
              ? "car-mode-changed-event"
              : "uner-v2-response",
          );
        }
      }
    });
  }, [applyCarModeValue, subscribeRaw]);

  useEffect(() => {
    if (!connected) {
      rawCarModeParserRef.current.reset();
    }
  }, [connected]);

  useEffect(() => {
    if (!connected) {
      requestInFlightRef.current = false;
      setStatus("idle");
      return;
    }

    requestCarMode();
    const interval = window.setInterval(() => {
      requestCarMode();
    }, CAR_MODE_POLL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [connected, requestCarMode]);

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
      applyCarModeValue,
    }),
    [applyCarModeValue, lastUpdatedAt, mode, rawMode, requestCarMode, status],
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
