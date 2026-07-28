/* eslint-disable react-refresh/only-export-components */
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
} from "../api/UnerFrameV2";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  SCREEN_GET_CURRENT_COMMAND,
  normalizeScreenReport,
  toCurrentScreen,
  type CurrentScreen,
  type ScreenUpdateKind,
} from "../types/ScreenTypes";
import {
  SCREEN_CODE_CONNECTIVITY_ESP_MENU,
  SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_FAILED,
  SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_SUCCEEDED,
  SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_WEB,
  SCREEN_CODE_CONNECTIVITY_WIFI_MENU,
  SCREEN_CODE_CONNECTIVITY_WIFI_RESULTS,
  SCREEN_CODE_CORE_MAIN_MENU,
  SCREEN_CODE_CORE_DASHBOARD,
  SCREEN_CODE_SENSORS_DISPLAY_MENU,
  SCREEN_CODE_SENSORS_MENU,
  SCREEN_CODE_SETTINGS_MENU,
  getScreenDefinition,
  getValidationPinDigitsCount,
  isPermissionValidationScreenCode,
} from "../screens/screenCodes";
import { useCarMode, type CarModeLabel } from "./CarModeContext";
import { useWifiCredentials } from "./WifiCredentialsContext";
import { normalizeStmMenuIndex } from "../protocol/screenMenuState";
import { useUser } from "./UserContext";

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
  const { connected, request, subscribe } = useWebSocket();
  const { remotePinAuthenticated } = useUser();
  const {
    mode: carMode,
    applyCarModeValue,
  } = useCarMode();
  const { state: wifiCredentials } = useWifiCredentials();

  const [currentScreen, setCurrentScreen] = useState<ScreenViewModel | null>(
    null,
  );

  const pendingScreenRequestsRef = useRef(new Set<string>());
  const initialSyncDoneRef = useRef(false);
  const dashboardHydrationReceivedAtRef = useRef<number | null>(null);

  const applyScreenReport = useCallback(
    (data: unknown, updateKind: ScreenUpdateKind, requestId?: string) => {
      const screenData = mergeWifiCredentialsIntoScreenData(
        data,
        wifiCredentials,
      );
      const report = normalizeScreenReport(screenData);

      if (!report) {
        console.warn("[screen] Payload de pantalla inválido:", data);
        return false;
      }

      const baseScreen = toCurrentScreen(report, updateKind, requestId);
      const reportedCarMode = readCarModeLabelFromScreenData(screenData);

      if (reportedCarMode) {
        applyCarModeValue(reportedCarMode, "screen-report");
      }

      const effectiveCarMode = reportedCarMode ?? carMode;
      const nextScreen = enrichCurrentScreen(baseScreen, screenData, {
        carMode: effectiveCarMode,
        sensoresVisible: effectiveCarMode === "TEST",
      });
      setCurrentScreen((previousScreen) =>
        preservePreviousMenuCountForShortSelection(nextScreen, previousScreen),
      );
      return true;
    },
    [applyCarModeValue, carMode, wifiCredentials],
  );

  const requestCurrentScreen = useCallback(() => {
    if (!connected || !remotePinAuthenticated) {
      return null;
    }

    const requestId = createRequestId();
    pendingScreenRequestsRef.current.add(requestId);

    void request(SCREEN_GET_CURRENT_COMMAND, {}, { requestId, timeoutMs: 3_000 })
      .catch(() => pendingScreenRequestsRef.current.delete(requestId));

    window.setTimeout(() => {
      pendingScreenRequestsRef.current.delete(requestId);
    }, 10000);

    return requestId;
  }, [connected, remotePinAuthenticated, request]);

  useEffect(() => {
    const offDeviceEvent = subscribe("device.event", (payload: unknown) => {
      if (!isRecord(payload)) {
        return;
      }

      const eventName = getScreenEventName(payload);

      if (eventName === "screen.changed" || eventName === "screen.current") {
        applyScreenReport(
          unwrapScreenEventData(payload),
          eventName,
          getScreenResponseRequestId(payload),
        );
        return;
      }

      const eventData = unwrapScreenEventData(payload);
      if (
        eventName === "stm.event" &&
        (hasScreenReportCmd(eventData) || hasScreenReportCmd(payload))
      ) {
        applyScreenReport(eventData, "screen.changed");
        return;
      }

      if (eventName === undefined && hasScreenIdentity(eventData)) {
        applyScreenReport(eventData, "screen.changed");
      }
    });

    const offDirectScreenChanged = subscribe("screen.changed", (payload: unknown) => {
      applyScreenReport(unwrapScreenEventData(payload), "screen.changed");
    });

    const offDirectScreenCurrent = subscribe("screen.current", (payload: unknown) => {
      applyScreenReport(unwrapScreenEventData(payload), "screen.current");
    });

    const offDeviceResponse = subscribe(
      "device.response",
      (payload: unknown) => {
        if (!isRecord(payload)) {
          return;
        }

        const requestId = getScreenResponseRequestId(payload);
        const isPendingScreenRequest = requestId
          ? pendingScreenRequestsRef.current.has(requestId)
          : false;

        const isCurrentScreenResponse =
          getScreenResponseCommand(payload) === SCREEN_GET_CURRENT_COMMAND;

        if (!isPendingScreenRequest && !isCurrentScreenResponse) {
          return;
        }

        if (
          applyScreenReport(
            unwrapScreenEventData(payload),
            "device.response",
            requestId,
          )
        ) {
          if (requestId) {
            pendingScreenRequestsRef.current.delete(requestId);
          }
        }
      },
    );

    const offStmEvent = subscribe("stm.event", (payload: unknown) => {
      const eventData = unwrapScreenEventData(payload);
      if (hasScreenReportCmd(eventData) || hasScreenReportCmd(payload)) {
        applyScreenReport(eventData, "screen.changed");
      }
    });

    return () => {
      offDeviceEvent();
      offDirectScreenChanged();
      offDirectScreenCurrent();
      offDeviceResponse();
      offStmEvent();
    };
  }, [applyScreenReport, subscribe]);

  useEffect(() => {
    if (!connected || !remotePinAuthenticated) {
      initialSyncDoneRef.current = false;
      setCurrentScreen(null);
      return;
    }

    if (initialSyncDoneRef.current) {
      return;
    }

    initialSyncDoneRef.current = true;
    requestCurrentScreen();
  }, [connected, remotePinAuthenticated, requestCurrentScreen]);

  useEffect(() => {
    if (currentScreen?.screenCode !== SCREEN_CODE_CORE_DASHBOARD) {
      dashboardHydrationReceivedAtRef.current = null;
      return;
    }

    if (
      currentScreen.updateKind === "screen.changed" &&
      currentScreen.rawData?.backend === undefined &&
      dashboardHydrationReceivedAtRef.current !== currentScreen.receivedAt
    ) {
      dashboardHydrationReceivedAtRef.current = currentScreen.receivedAt;
      requestCurrentScreen();
    }
  }, [currentScreen, requestCurrentScreen]);

  useEffect(() => {
    setCurrentScreen((screen) => {
      if (!screen) {
        return screen;
      }

      const screenData = mergeWifiCredentialsIntoScreenData(
        screen.rawData ?? screen,
        wifiCredentials,
      );
      const refreshedScreen = enrichCurrentScreen(screen, screenData, {
        carMode,
        sensoresVisible: carMode === "TEST",
      });

      return refreshedScreen;
    });
  }, [carMode, wifiCredentials]);

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

  const knownMenuItemsCount = getKnownMenuItemsCount(
    baseScreen.screenCode,
    rawData,
    globalMeta.sensoresVisible,
  );
  const reportedItemsCount =
    meta.itemsCount !== undefined ? clampByte(meta.itemsCount) : undefined;
  const itemsCount = clampByte(
    reportedItemsCount ??
      knownMenuItemsCount ??
      (meta.hasMenuItems ? MENU_ITEMS_PER_PAGE : 0),
  );
  const hasMenuItems =
    knownMenuItemsCount !== undefined ||
    itemsCount > 0 ||
    meta.hasMenuItems === true;
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
    rawData: enrichRawScreenData(rawData, {
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

function preservePreviousMenuCountForShortSelection(
  nextScreen: ScreenViewModel,
  previousScreen: ScreenViewModel | null,
): ScreenViewModel {
  if (
    !previousScreen ||
    previousScreen.screenCode !== nextScreen.screenCode ||
    !previousScreen.hasMenuItems ||
    !nextScreen.hasMenuItems ||
    previousScreen.itemsCount <= nextScreen.itemsCount ||
    !isShortMenuSelectionReport(nextScreen.rawData)
  ) {
    return nextScreen;
  }

  return withMenuItemsCount(nextScreen, previousScreen.itemsCount);
}

function withMenuItemsCount(
  screen: ScreenViewModel,
  itemsCount: number,
): ScreenViewModel {
  const normalizedItemsCount = clampByte(itemsCount);
  const hasMenuItems = normalizedItemsCount > 0;
  const totalMenuPages = hasMenuItems
    ? Math.max(1, Math.ceil(normalizedItemsCount / MENU_ITEMS_PER_PAGE))
    : 1;
  const normalizedSelectedIndex =
    screen.selectedIndex !== null && hasMenuItems
      ? Math.min(screen.selectedIndex, normalizedItemsCount - 1)
      : screen.selectedIndex;
  const currentMenuPage =
    hasMenuItems && normalizedSelectedIndex !== null
      ? Math.floor(normalizedSelectedIndex / MENU_ITEMS_PER_PAGE) + 1
      : Math.min(Math.max(1, screen.currentMenuPage), totalMenuPages);
  const firstVisibleIndex = hasMenuItems
    ? (currentMenuPage - 1) * MENU_ITEMS_PER_PAGE
    : 0;
  const visibleStartIndex = hasMenuItems ? firstVisibleIndex + 1 : 0;
  const visibleEndIndex = hasMenuItems
    ? Math.min(normalizedItemsCount, visibleStartIndex + MENU_ITEMS_PER_PAGE - 1)
    : 0;
  const rawData = isRecord(screen.rawData) ? { ...screen.rawData } : {};

  rawData.itemCount = normalizedItemsCount;
  rawData.itemsCount = normalizedItemsCount;
  rawData.hasMenuItems = hasMenuItems;
  rawData.firstVisibleIndex = firstVisibleIndex;

  if (normalizedSelectedIndex !== null) {
    rawData.selectedIndex = normalizedSelectedIndex;
  }

  return {
    ...screen,
    itemsCount: normalizedItemsCount,
    hasMenuItems,
    totalMenuPages,
    currentMenuPage,
    selectedIndex: normalizedSelectedIndex,
    visibleStartIndex,
    visibleEndIndex,
    rawData,
  };
}

function unwrapScreenEventData(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload;
  }

  const nestedPayload = toRecord(payload.payload);
  const nestedData = toRecord(payload.data);
  const nestedPayloadData = nestedPayload?.data;

  return (
    payload.screen ??
    nestedPayload?.screen ??
    nestedData?.screen ??
    payload.currentScreen ??
    nestedPayload?.currentScreen ??
    nestedData?.currentScreen ??
    (nestedData && isScreenLikeRecord(nestedData) ? nestedData : undefined) ??
    (isScreenLikeRecord(nestedPayloadData) ? nestedPayloadData : undefined) ??
    payload.data ??
    nestedPayloadData ??
    (nestedPayload && isScreenLikeRecord(nestedPayload)
      ? nestedPayload
      : payload)
  );
}

function mergeWifiCredentialsIntoScreenData(
  data: unknown,
  credentials: {
    status: string;
    ssid: string | null;
    reason: string | null;
    timeoutMs: number | null;
    requestId: string | null;
  },
): Record<string, unknown> {
  const enriched: Record<string, unknown> = isRecord(data)
    ? { ...data }
    : {};

  enriched.webCredentialsStatus = credentials.status;

  if (credentials.ssid) {
    enriched.webCredentialsSsid = credentials.ssid;
    enriched.pendingWifiCredentialsSsid = credentials.ssid;

    if (
      isWifiCredentialsScreenCode(readScreenCodeValue(enriched)) &&
      readString(enriched.ssid) === undefined
    ) {
      enriched.ssid = credentials.ssid;
    }
  }

  if (credentials.reason) {
    enriched.webCredentialsReason = credentials.reason;
  }

  if (credentials.timeoutMs !== null) {
    enriched.webCredentialsTimeoutMs = credentials.timeoutMs;
  }

  if (credentials.requestId) {
    enriched.webCredentialsRequestId = credentials.requestId;
  }

  return enriched;
}

function isWifiCredentialsScreenCode(screenCode: number | null): boolean {
  return (
    screenCode === SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_WEB ||
    screenCode === SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_SUCCEEDED ||
    screenCode === SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_FAILED
  );
}

function readScreenCodeValue(data: Record<string, unknown>): number | null {
  const direct =
    readNumber(data.screenCode) ??
    readNumber(data.screen_code) ??
    readNumber(data.screenCodeHex);

  if (direct !== undefined) {
    return direct >>> 0;
  }

  const payload = readPayloadBytes(data);
  if (payload && payload.length >= 4) {
    return (
      payload[0] |
      (payload[1] << 8) |
      (payload[2] << 16) |
      (payload[3] << 24)
    ) >>> 0;
  }

  const menu = readNumber(data.menu);
  const submenu = readNumber(data.submenu);
  const page = readNumber(data.page);
  if (menu === undefined || submenu === undefined || page === undefined) {
    return null;
  }

  return ((menu & 0xff) << 16) | ((submenu & 0xff) << 8) | (page & 0xff);
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
    readNumber(data.selected_index_zero_based) ??
    readNumber(data.cursor) ??
    readNumber(data.menuCursor) ??
    readNumber(data.menu_cursor) ??
    readNumber(data.selectedItemZeroBased) ??
    readNumber(data.selected_item_zero_based) ??
    readNumber(data.currentItemZeroBased) ??
    readNumber(data.current_item_zero_based);

  const directSelectedIndexFromStm =
    readNumber(data.selectedIndex) ??
    readNumber(data.selected_index) ??
    readNumber(data.menuSelectedIndex) ??
    readNumber(data.menu_selected_index) ??
    readNumber(data.selectedItem) ??
    readNumber(data.selected_item) ??
    readNumber(data.currentItem) ??
    readNumber(data.current_item);

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

  const cmd = readNumber(data.cmd);

  /*
   * Formatos soportados:
   * 1) ScreenReport extendido:
   *    [screen_code_le(4), item_count, source]
   * 2) MenuSelectionReport:
   *    [screen_code_le(4), selected_index, item_count, source]
   * 3) MenuSelectionReport corto:
   *    [screen_code_le(4), selected_index, source]
   * 4) Legacy:
   *    [screen_code_le(4), source]
   */

  if (cmd === UNER_V2_CMD.EVT_MENU_SELECTION_CHANGED) {
    if (payload.length >= 7) {
      return {
        hasMenuItems: payload[5] > 0,
        selectedIndex: normalizeStmMenuIndex(payload[4], payload[5]),
        itemsCount: payload[5],
      };
    }

    if (payload.length >= 6) {
      return {
        hasMenuItems: true,
        selectedIndex: normalizeStmMenuIndex(payload[4]),
      };
    }
  }

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

function getKnownMenuItemsCount(
  screenCode: number,
  data: unknown,
  sensoresVisible: boolean,
): number | undefined {
  switch (screenCode) {
    case SCREEN_CODE_CORE_MAIN_MENU:
      return sensoresVisible ? 6 : 4;
    case SCREEN_CODE_CONNECTIVITY_WIFI_MENU:
      return 5;
    case SCREEN_CODE_CONNECTIVITY_ESP_MENU:
      return 4;
    case SCREEN_CODE_SENSORS_MENU:
      return 5;
    case SCREEN_CODE_SENSORS_DISPLAY_MENU:
      return 4;
    case SCREEN_CODE_SETTINGS_MENU:
      return 3;
    case SCREEN_CODE_CONNECTIVITY_WIFI_RESULTS:
      return getWifiResultSsidCount(data) + 2;
    default:
      return undefined;
  }
}

function getWifiResultSsidCount(data: unknown): number {
  if (!isRecord(data)) {
    return 1;
  }

  const values =
    readArray(data.networkSsids) ??
    readArray(data.ssids) ??
    readArray(data.networks) ??
    readArray(data.items);

  return values ? Math.max(1, values.length) : 1;
}

function readArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
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

function hasScreenReportCmd(data: unknown): boolean {
  if (!isRecord(data)) {
    return false;
  }

  const cmd = readNumber(data.cmd);
  return (
    cmd === UNER_V2_CMD.EVT_SCREEN_CHANGED ||
    cmd === UNER_V2_CMD.EVT_MENU_SELECTION_CHANGED
  );
}

function getScreenEventName(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const nestedPayload = toRecord(payload.payload);
  const nestedData = toRecord(payload.data);

  return (
    readString(payload.event) ??
    readString(nestedPayload?.event) ??
    readString(nestedData?.event)
  );
}

function getScreenResponseRequestId(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const nestedPayload = toRecord(payload.payload);
  const nestedData = toRecord(payload.data);

  return (
    readString(payload.requestId) ??
    readString(nestedPayload?.requestId) ??
    readString(nestedData?.requestId)
  );
}

function getScreenResponseCommand(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const nestedPayload = toRecord(payload.payload);
  const nestedData = toRecord(payload.data);

  return (
    readString(payload.command) ??
    readString(payload.payloadCommand) ??
    readString(nestedPayload?.command) ??
    readString(nestedPayload?.payloadCommand) ??
    readString(nestedData?.command) ??
    readString(nestedData?.payloadCommand)
  );
}

function isShortMenuSelectionReport(data: unknown): boolean {
  if (!isRecord(data) || readNumber(data.cmd) !== UNER_V2_CMD.EVT_MENU_SELECTION_CHANGED) {
    return false;
  }

  const payload = readPayloadBytes(data);
  return payload !== undefined && payload.length >= 6 && payload.length < 7;
}

function isScreenLikeRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    readNumber(value.screenCode) !== undefined ||
    readNumber(value.screen_code) !== undefined ||
    readNumber(value.screenCodeHex) !== undefined ||
    (readNumber(value.menu) !== undefined &&
      readNumber(value.submenu) !== undefined &&
      readNumber(value.page) !== undefined) ||
    hasScreenReportCmd(value) ||
    readPayloadBytes(value) !== undefined
  );
}

function hasScreenIdentity(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    readNumber(value.screenCode) !== undefined ||
    readNumber(value.screen_code) !== undefined ||
    readNumber(value.screenCodeHex) !== undefined ||
    (readNumber(value.menu) !== undefined &&
      readNumber(value.submenu) !== undefined &&
      readNumber(value.page) !== undefined) ||
    hasScreenReportCmd(value)
  );
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
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
