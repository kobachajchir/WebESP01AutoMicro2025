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
import {
  UNER_V2_CMD,
  createUnerV2StreamParser,
} from "../api/UnerFrameV2";
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
  isPermissionValidationScreenCode,
} from "../screens/screenCodes";
import { useCarMode, type CarModeLabel } from "./CarModeContext";

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
  const { connected, send, subscribe, subscribeRaw } = useWebSocket();
  const { user, loading } = useUser();
  const {
    mode: carMode,
    applyCarModeValue,
  } = useCarMode();

  const [currentScreen, setCurrentScreen] = useState<ScreenViewModel | null>(
    () => createInitialCurrentScreen(),
  );

  const pendingScreenRequestsRef = useRef(new Set<string>());
  const lastSyncAuthKeyRef = useRef<string | null>(null);
  const rawScreenParserRef = useRef(createUnerV2StreamParser());

  const applyScreenReport = useCallback(
    (data: unknown, updateKind: ScreenUpdateKind, requestId?: string) => {
      const report = normalizeScreenReport(data);

      if (!report) {
        console.warn("[screen] Payload de pantalla inválido:", data);
        return false;
      }

      const baseScreen = toCurrentScreen(report, updateKind, requestId);
      const reportedCarMode = readCarModeLabelFromScreenData(data);

      if (reportedCarMode) {
        applyCarModeValue(reportedCarMode, "screen-report");
      }

      const effectiveCarMode = reportedCarMode ?? carMode;
      const nextScreen = enrichCurrentScreen(baseScreen, data, {
        carMode: effectiveCarMode,
        sensoresVisible: effectiveCarMode === "TEST",
      });
      setCurrentScreen(nextScreen);
      return true;
    },
    [applyCarModeValue, carMode],
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
        (hasScreenReportCmd(payload.data) || hasScreenReportCmd(payload))
      ) {
        applyScreenReport(payload.data ?? payload, "screen.changed");
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
      if (hasScreenReportCmd(payload)) {
        applyScreenReport(payload, "screen.changed");
      }
    });

    const offRawScreenEvent = subscribeRaw((incoming) => {
      const bytes =
        incoming instanceof Uint8Array ? incoming : new Uint8Array(incoming);

      for (const frame of rawScreenParserRef.current.push(bytes)) {
        if (frame.cmd !== UNER_V2_CMD.EVT_MENU_SELECTION_CHANGED) {
          continue;
        }

        applyScreenReport(
          {
            cmd: frame.cmd,
            payload: Array.from(frame.payload),
          },
          "screen.changed",
        );
      }
    });

    return () => {
      offDeviceEvent();
      offDeviceResponse();
      offStmEvent();
      offRawScreenEvent();
    };
  }, [applyScreenReport, subscribe, subscribeRaw]);

  useEffect(() => {
    if (!connected) {
      rawScreenParserRef.current.reset();
    }
  }, [connected]);

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
  globalMeta: {
    carMode: CarModeLabel;
    sensoresVisible: boolean;
  } = {
    carMode: "UNKNOWN",
    sensoresVisible: false,
  },
): ScreenViewModel {
  const meta = extractScreenMeta(rawData);

  const itemsCount = clampByte(meta.itemsCount ?? (meta.hasMenuItems ? 1 : 0));
  const hasMenuItems = itemsCount > 0 || meta.hasMenuItems === true;
  const selectedIndex =
    meta.selectedIndex !== undefined ? clampByte(meta.selectedIndex) : null;

  const rawPage =
    typeof baseScreen.page === "number" && Number.isFinite(baseScreen.page)
      ? Math.max(1, Math.trunc(baseScreen.page))
      : 1;

  const totalMenuPages = hasMenuItems
    ? Math.max(1, Math.ceil(itemsCount / MENU_ITEMS_PER_PAGE))
    : 1;

  const selectedMenuPage =
    hasMenuItems && selectedIndex !== null
      ? Math.floor(selectedIndex / MENU_ITEMS_PER_PAGE) + 1
      : rawPage;

  const currentMenuPage = Math.min(selectedMenuPage, totalMenuPages);
  const firstVisibleIndex = hasMenuItems
    ? (currentMenuPage - 1) * MENU_ITEMS_PER_PAGE
    : 0;

  const visibleStartIndex = hasMenuItems
    ? firstVisibleIndex + 1
    : 0;

  const visibleEndIndex = hasMenuItems
    ? Math.min(itemsCount, visibleStartIndex + MENU_ITEMS_PER_PAGE - 1)
    : 0;

  const isValidationScreen = isPermissionValidationScreenCode(
    baseScreen.screenCode,
    baseScreen.source,
  );
  const pinDigitsCount = isValidationScreen
    ? getValidationPinDigitsCount(baseScreen.screenCode)
    : 0;

  return {
    ...baseScreen,
    rawData: enrichRawScreenData(baseScreen.rawData, {
      carMode: globalMeta.carMode,
      firstVisibleIndex,
      hasMenuItems,
      itemsCount,
      selectedIndex,
      sensoresVisible: globalMeta.sensoresVisible,
    }),
    itemsCount,
    hasMenuItems,
    currentMenuPage,
    totalMenuPages,
    selectedIndex,
    visibleStartIndex,
    visibleEndIndex,
    isValidationScreen,
    pinDigitsCount,
    screenDefinition: getScreenDefinition(baseScreen.screenCode),
  };
}

function enrichRawScreenData(
  rawData: unknown,
  meta: {
    carMode: CarModeLabel;
    firstVisibleIndex: number;
    hasMenuItems: boolean;
    itemsCount: number;
    sensoresVisible: boolean;
    selectedIndex: number | null;
  },
): Record<string, unknown> {
  const enriched: Record<string, unknown> = isRecord(rawData)
    ? { ...rawData }
    : {};

  enriched.itemCount = meta.itemsCount;
  enriched.itemsCount = meta.itemsCount;
  enriched.hasMenuItems = meta.hasMenuItems;
  enriched.firstVisibleIndex = meta.firstVisibleIndex;
  enriched.sensoresVisible = meta.sensoresVisible;
  enriched.carMode = meta.carMode === "UNKNOWN" ? "IDLE" : meta.carMode;

  if (meta.selectedIndex !== null) {
    enriched.selectedIndex = meta.selectedIndex;
  }

  return enriched;
}

function readCarModeLabelFromScreenData(data: unknown): CarModeLabel | null {
  if (!isRecord(data)) {
    return null;
  }

  const rawCarMode =
    data.carMode ??
    data.car_mode ??
    data.carModeValue ??
    data.car_mode_value;

  if (typeof rawCarMode === "number" && Number.isFinite(rawCarMode)) {
    return carModeLabelFromByte(rawCarMode);
  }

  if (typeof rawCarMode === "string") {
    const normalized = rawCarMode.trim().toUpperCase();
    if (
      normalized === "IDLE" ||
      normalized === "FOLLOW" ||
      normalized === "TEST"
    ) {
      return normalized;
    }

    if (normalized.length > 0) {
      const parsed = normalized.startsWith("0X")
        ? Number.parseInt(normalized.slice(2), 16)
        : Number(normalized);

      return Number.isFinite(parsed) ? carModeLabelFromByte(parsed) : null;
    }
  }

  return null;
}

function carModeLabelFromByte(value: number): CarModeLabel {
  const normalized = Math.max(0, Math.min(0xff, Math.trunc(value)));
  if (normalized === 0x00) return "IDLE";
  if (normalized === 0x01) return "FOLLOW";
  if (normalized === 0x02) return "TEST";
  return "UNKNOWN";
}

function extractScreenMeta(data: unknown): {
  hasMenuItems?: boolean;
  itemsCount?: number;
  selectedIndex?: number;
} {
  if (!isRecord(data)) {
    return {};
  }

  const directItemsCount =
    readNumber(data.itemCount) ??
    readNumber(data.item_count) ??
    readNumber(data.itemsCount) ??
    readNumber(data.items_count) ??
    readNumber(data.itemCOunt) ??
    readNumber(data.menuItemCount) ??
    readNumber(data.menu_item_count) ??
    readNumber(data.menuItemsCount) ??
    readNumber(data.menu_items_count);

  const directHasMenuItems =
    readBoolean(data.hasMenuItems) ??
    readBoolean(data.has_menu_items) ??
    readBoolean(data.hasItems) ??
    readBoolean(data.has_items);

  const directSelectedIndexZeroBased =
    readNumber(data.selectedIndexZeroBased) ??
    readNumber(data.selected_index_zero_based);

  const directSelectedIndexFromStm =
    readNumber(data.selectedIndex) ??
    readNumber(data.selected_index) ??
    readNumber(data.menuSelectedIndex) ??
    readNumber(data.menu_selected_index);

  const directSelectedIndex =
    directSelectedIndexZeroBased ??
    normalizeStmMenuIndex(directSelectedIndexFromStm, directItemsCount);

  if (
    directItemsCount !== undefined ||
    directSelectedIndex !== undefined ||
    directHasMenuItems !== undefined
  ) {
    return {
      hasMenuItems: directHasMenuItems,
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
      hasMenuItems: payload[5] > 0,
      selectedIndex: normalizeStmMenuIndex(payload[4], payload[5]),
      itemsCount: payload[5],
    };
  }

  if (payload.length >= 6) {
    return {
      hasMenuItems: payload[4] > 0,
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

function normalizeStmMenuIndex(
  value: number | undefined,
  itemsCount?: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const selectedIndex = clampByte(value);
  const count = itemsCount === undefined ? undefined : clampByte(itemsCount);

  if (selectedIndex > 0 && (count === undefined || selectedIndex <= count)) {
    return selectedIndex - 1;
  }

  return selectedIndex;
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
    hasMenuItems: false,
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

function hasScreenReportCmd(data: unknown): boolean {
  if (!isRecord(data)) {
    return false;
  }

  const cmd = readNumber(data.cmd);
  return cmd === UNER_V2_CMD.EVT_MENU_SELECTION_CHANGED || cmd === 0x95;
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

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const normalized = value.trim().toLowerCase();

    if (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "yes" ||
      normalized === "si"
    ) {
      return true;
    }

    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
