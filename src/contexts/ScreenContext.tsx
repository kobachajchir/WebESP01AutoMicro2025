// src/contexts/ScreenContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
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
import {
  getScreenDefinition,
  getValidationPinDigitsCount,
  isValidationScreenCode,
} from "../screens/screenCodes";

const MENU_ITEMS_PER_PAGE = 3;

export interface ScreenViewModel extends CurrentScreen {
  itemsCount: number;
  hasMenuItems: boolean;
  currentMenuPage: number;
  totalMenuPages: number;
  selectedIndex: number | null;
  visibleStartIndex: number;
  visibleEndIndex: number;
  isValidationScreen: boolean;
  pinDigitsCount: number;
  screenDefinition: ReturnType<typeof getScreenDefinition>;
}

interface ScreenContextType {
  currentScreen: ScreenViewModel | null;
  requestCurrentScreen: () => string | null;
}

export const ScreenContext = createContext<ScreenContextType | undefined>(
  undefined,
);

interface ScreenProviderProps {
  children: ReactNode;
}

export const ScreenProvider: React.FC<ScreenProviderProps> = ({ children }) => {
  const { connected, send, subscribe } = useWebSocket();
  const { user, loading } = useUser();

  const [currentScreen, setCurrentScreen] = useState<ScreenViewModel | null>(
    () => createInitialCurrentScreen(),
  );

  const pendingScreenRequestsRef = useRef(new Set<string>());
  const lastSyncAuthKeyRef = useRef<string | null>(null);

  const applyScreenReport = useCallback(
    (data: unknown, updateKind: ScreenUpdateKind, requestId?: string) => {
      const report = normalizeScreenReport(data);

      if (!report) {
        console.warn("[screen] Payload de pantalla inválido:", data);
        return false;
      }

      const baseScreen = toCurrentScreen(report, updateKind, requestId);
      const nextScreen = enrichCurrentScreen(baseScreen, data);
      setCurrentScreen(nextScreen);
      return true;
    },
    [],
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

    const offDeviceResponse = subscribe(
      "device.response",
      (payload: unknown) => {
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
      },
    );

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

export function useScreen(): ScreenContextType {
  const context = useContext(ScreenContext);

  if (!context) {
    throw new Error("useScreen debe usarse dentro de un ScreenProvider");
  }

  return context;
}

function enrichCurrentScreen(
  baseScreen: CurrentScreen,
  rawData: unknown,
): ScreenViewModel {
  const meta = extractScreenMeta(rawData);

  const itemsCount = clampByte(meta.itemsCount ?? 0);
  const hasMenuItems = itemsCount > 0;

  const rawPage =
    typeof baseScreen.page === "number" && Number.isFinite(baseScreen.page)
      ? Math.max(1, Math.trunc(baseScreen.page))
      : 1;

  const totalMenuPages = hasMenuItems
    ? Math.max(1, Math.ceil(itemsCount / MENU_ITEMS_PER_PAGE))
    : 1;

  const currentMenuPage = Math.min(rawPage, totalMenuPages);

  const visibleStartIndex = hasMenuItems
    ? (currentMenuPage - 1) * MENU_ITEMS_PER_PAGE + 1
    : 0;

  const visibleEndIndex = hasMenuItems
    ? Math.min(itemsCount, visibleStartIndex + MENU_ITEMS_PER_PAGE - 1)
    : 0;

  const isValidationScreen = isValidationScreenCode(baseScreen.screenCode);
  const pinDigitsCount = isValidationScreen
    ? getValidationPinDigitsCount(baseScreen.screenCode)
    : 0;

  return {
    ...baseScreen,
    itemsCount,
    hasMenuItems,
    currentMenuPage,
    totalMenuPages,
    selectedIndex:
      meta.selectedIndex !== undefined ? clampByte(meta.selectedIndex) : null,
    visibleStartIndex,
    visibleEndIndex,
    isValidationScreen,
    pinDigitsCount,
    screenDefinition: getScreenDefinition(baseScreen.screenCode),
  };
}

function extractScreenMeta(data: unknown): {
  itemsCount?: number;
  selectedIndex?: number;
} {
  if (!isRecord(data)) {
    return {};
  }

  const directItemsCount =
    readNumber(data.itemCount) ??
    readNumber(data.item_count) ??
    readNumber(data.menuItemCount) ??
    readNumber(data.menu_item_count);

  const directSelectedIndex =
    readNumber(data.selectedIndex) ??
    readNumber(data.selected_index) ??
    readNumber(data.menuSelectedIndex) ??
    readNumber(data.menu_selected_index);

  if (directItemsCount !== undefined || directSelectedIndex !== undefined) {
    return {
      itemsCount: directItemsCount,
      selectedIndex: directSelectedIndex,
    };
  }

  const payload = readPayloadBytes(data);
  if (!payload) {
    return {};
  }

  /*
   * Formatos soportados:
   * 1) ScreenReport extendido:
   *    [screen_code_le(4), item_count, source]
   * 2) MenuSelectionReport:
   *    [screen_code_le(4), selected_index, item_count, source]
   * 3) Legacy:
   *    [screen_code_le(4), source]
   */

  if (payload.length >= 7) {
    return {
      selectedIndex: payload[4],
      itemsCount: payload[5],
    };
  }

  if (payload.length >= 6) {
    return {
      itemsCount: payload[4],
    };
  }

  return {};
}

function readPayloadBytes(data: unknown): number[] | undefined {
  if (!isRecord(data) || !Array.isArray(data.payload)) {
    return undefined;
  }

  const bytes: number[] = [];

  for (const item of data.payload) {
    const n = readNumber(item);
    if (n === undefined) {
      return undefined;
    }
    bytes.push(clampByte(n));
  }

  return bytes;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(0xff, Math.trunc(value)));
}

function createRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `screen-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createInitialCurrentScreen(): ScreenViewModel {
  const initialRawData = {
    screenCode: 0x010101,
    screenCodeHex: "0x010101",
    menu: 1,
    submenu: 1,
    page: 1,
    source: 0x02,
    sourceName: "RENDER",
    payload: [0x01, 0x01, 0x01, 0x00, 0x00, 0x02],
    itemCount: 0,
  };

  const report = normalizeScreenReport(initialRawData);

  if (!report) {
    throw new Error("No se pudo crear la pantalla inicial Dashboard.");
  }

  return enrichCurrentScreen(
    toCurrentScreen(report, "screen.current"),
    initialRawData,
  );
}

function hasReservedScreenCmd(data: unknown): boolean {
  if (!isRecord(data)) {
    return false;
  }

  return readNumber(data.cmd) === 0x95;
}

function warnReservedScreenDiagnostic(data: unknown) {
  console.warn(
    "[screen] stm.event con cmd=0x95 recibido como diagnóstico o payload inválido; el bridge debe publicar screen.changed.",
    data,
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
