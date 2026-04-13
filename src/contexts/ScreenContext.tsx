import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useUser } from "./UserContext";
import {
  SCREEN_GET_CURRENT_COMMAND,
  normalizeScreenReport,
  toCurrentScreen,
  type CurrentScreen,
  type ScreenUpdateKind,
} from "../types/ScreenTypes";

interface ScreenContextType {
  currentScreen: CurrentScreen | null;
  requestCurrentScreen: () => string | null;
}

export const ScreenContext = createContext<ScreenContextType | undefined>(
  undefined
);

interface ScreenProviderProps {
  children: ReactNode;
}

export const ScreenProvider: React.FC<ScreenProviderProps> = ({ children }) => {
  const { connected, send, subscribe } = useWebSocket();
  const { user, loading } = useUser();
  const [currentScreen, setCurrentScreen] = useState<CurrentScreen | null>(() =>
    createInitialCurrentScreen()
  );
  const pendingScreenRequestsRef = useRef(new Set<string>());
  const lastSyncAuthKeyRef = useRef<string | null>(null);

  const applyScreenReport = useCallback(
    (data: unknown, updateKind: ScreenUpdateKind, requestId?: string) => {
      const report = normalizeScreenReport(data);
      if (!report) {
        console.warn("[screen] Payload de pantalla invalido:", data);
        return false;
      }

      setCurrentScreen(toCurrentScreen(report, updateKind, requestId));
      return true;
    },
    []
  );

  const requestCurrentScreen = useCallback(() => {
    if (!connected || !user) {
      return null;
    }

    const requestId = createRequestId();
    pendingScreenRequestsRef.current.add(requestId);

    send("device.command", {
      requestId,
      target: "stm",
      command: SCREEN_GET_CURRENT_COMMAND,
      params: {},
    });

    window.setTimeout(() => {
      pendingScreenRequestsRef.current.delete(requestId);
    }, 10000);

    return requestId;
  }, [connected, send, user]);

  useEffect(() => {
    const offDeviceEvent = subscribe("device.event", (payload: unknown) => {
      if (!isRecord(payload)) {
        return;
      }

      const eventName = readString(payload.event);
      if (eventName === "screen.changed" || eventName === "screen.current") {
        applyScreenReport(payload.data, eventName);
        return;
      }

      if (
        eventName === "stm.event" &&
        (hasReservedScreenCmd(payload.data) || hasReservedScreenCmd(payload))
      ) {
        warnReservedScreenDiagnostic(payload.data ?? payload);
      }
    });

    const offDeviceResponse = subscribe("device.response", (payload: unknown) => {
      if (!isRecord(payload)) {
        return;
      }

      const requestId = readString(payload.requestId);
      const isPendingScreenRequest = requestId
        ? pendingScreenRequestsRef.current.has(requestId)
        : false;
      const isCurrentScreenResponse =
        readString(payload.command) === SCREEN_GET_CURRENT_COMMAND ||
        readString(payload.payloadCommand) === SCREEN_GET_CURRENT_COMMAND;

      if (!isPendingScreenRequest && !isCurrentScreenResponse) {
        return;
      }

      if (applyScreenReport(payload.data, "device.response", requestId)) {
        if (requestId) {
          pendingScreenRequestsRef.current.delete(requestId);
        }
      }
    });

    const offStmEvent = subscribe("stm.event", (payload: unknown) => {
      if (hasReservedScreenCmd(payload)) {
        warnReservedScreenDiagnostic(payload);
      }
    });

    return () => {
      offDeviceEvent();
      offDeviceResponse();
      offStmEvent();
    };
  }, [applyScreenReport, subscribe]);

  useEffect(() => {
    if (!connected) {
      lastSyncAuthKeyRef.current = null;
      return;
    }

    if (loading || !user) {
      return;
    }

    const authKey = user.id;
    if (lastSyncAuthKeyRef.current === authKey) {
      return;
    }

    lastSyncAuthKeyRef.current = authKey;
    requestCurrentScreen();
  }, [connected, loading, requestCurrentScreen, user]);

  return (
    <ScreenContext.Provider value={{ currentScreen, requestCurrentScreen }}>
      {children}
    </ScreenContext.Provider>
  );
};

function createRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `screen-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createInitialCurrentScreen(): CurrentScreen {
  const report = normalizeScreenReport({
    screenCode: 0x010101,
    screenCodeHex: "0x010101",
    menu: 1,
    submenu: 1,
    page: 1,
    source: 0x02,
    sourceName: "RENDER",
    payload: [0x01, 0x01, 0x01, 0x00, 0x02],
  });

  if (!report) {
    throw new Error("No se pudo crear la pantalla inicial Dashboard.");
  }

  return toCurrentScreen(report, "screen.current");
}

function hasReservedScreenCmd(data: unknown): boolean {
  if (!isRecord(data)) {
    return false;
  }

  return readNumber(data.cmd) === 0x95;
}

function warnReservedScreenDiagnostic(data: unknown) {
  console.warn(
    "[screen] stm.event con cmd=0x95 recibido como diagnostico o payload invalido; el bridge debe publicar screen.changed.",
    data
  );
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const trimmed = value.trim();
    const parsed = trimmed.toLowerCase().startsWith("0x")
      ? Number.parseInt(trimmed.slice(2), 16)
      : Number(trimmed);

    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
