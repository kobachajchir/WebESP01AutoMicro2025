// src/components/ScreenStreamWorkspace.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSavedOledScreens } from "../contexts/SavedOledScreensContext";
import { useScreen } from "../contexts/ScreenContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { formatScreenCodeHex } from "../types/ScreenTypes";
import { resolveOledScreen } from "../screens";
import OledCommandPreview from "./OledCommandPreview";
import PinScreenModal from "./PinScreenModal";
import useUser from "../contexts/UserContext";
import { useCarMode } from "../contexts/CarModeContext";
import { useOledCanvasTransfer } from "../features/oledEditor/useOledCanvasTransfer";
import { rasterizeOledDocument } from "../features/oledEditor/oledCanvasRasterizer";
import { OLED_CANVAS_SCREEN_CODE } from "../features/oledEditor/oledCanvasProtocol";
import {
  getStmRemoteCommandMode,
  STM_LEGACY_REMOTE_COMMANDS,
  STM_REMOTE_COMMAND_MODE,
  STM_REMOTE_INPUT_COMMANDS,
  toRemotePressKindLabel,
} from "../types/RemoteBridgeTypes";
import {
  SCREEN_CODE_CONNECTIVITY_ESP_MENU,
  SCREEN_CODE_CONNECTIVITY_WIFI_MENU,
  SCREEN_CODE_CONNECTIVITY_WIFI_RESULTS,
  SCREEN_CODE_CORE_MAIN_MENU,
  SCREEN_CODE_SENSORS_DISPLAY_MENU,
  SCREEN_CODE_SENSORS_MENU,
  SCREEN_CODE_SETTINGS_MENU,
} from "../screens/screenCodes";
import { getStmRemoteActionFeedback } from "../utils/stmRemoteActionFeedback";

const LONG_PRESS_THRESHOLD_MS = 1500;
const POST_COMMAND_SCREEN_REFRESH_DELAY_MS = 120;
const MENU_VISIBLE_ITEMS = 3;

const UNER_SCREEN_PAGE_DIR_UP = 0x00;
const UNER_SCREEN_PAGE_DIR_DOWN = 0x01;

const UNER_PRESS_KIND_SHORT = 0x00;
const UNER_PRESS_KIND_LONG = 0x01;

type ScreenPageDirection = "up" | "down";
type AuxButtonKind = "encoder" | "user";
const Icon_Encoder_bits = new Uint8Array([
  0xf8, 0x03, 0xfc, 0x07, 0x0e, 0x0e, 0xf7, 0x1d, 0xfb, 0x1b, 0xfb, 0x1b, 0xfb,
  0x1b, 0xfb, 0x1b, 0xfb, 0x1b, 0xf7, 0x1d, 0x0e, 0x0e, 0xfc, 0x07, 0xf8, 0x03,
]);

const Icon_UserBtn_bits = new Uint8Array([
  0xe0, 0x03, 0x38, 0x0e, 0xcc, 0x19, 0xf6, 0x37, 0xfa, 0x2f, 0xfb, 0x6f, 0xfd,
  0x5f, 0xfd, 0x5f, 0xfd, 0x5f, 0xfb, 0x6f, 0xfa, 0x2f, 0xf6, 0x37, 0xcc, 0x19,
  0x38, 0x0e, 0xe0, 0x03, 0x00, 0x00,
]);

function screenCodeToLeBytes(screenCode: number): number[] {
  const value = screenCode >>> 0;
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}

function buildScreenPagePayload(
  screenCode: number,
  direction: ScreenPageDirection,
): number[] {
  return [
    ...screenCodeToLeBytes(screenCode),
    direction === "up" ? UNER_SCREEN_PAGE_DIR_UP : UNER_SCREEN_PAGE_DIR_DOWN,
  ];
}

function buildMenuItemClickPayload(
  screenCode: number,
  item: 1 | 2 | 3,
): number[] {
  return [...screenCodeToLeBytes(screenCode), item];
}

function buildAuxButtonPayload(
  screenCode: number,
  pressKind: number,
): number[] {
  return [...screenCodeToLeBytes(screenCode), pressKind];
}

function buildEncoderRotatePayload(screenCode: number): number[] {
  return [...screenCodeToLeBytes(screenCode)];
}

function createCommandRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `screen-cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ScreenStreamWorkspace({
  isModal = false,
}: {
  isModal?: boolean;
}) {
  const { validatePin, remotePinAuthenticated } = useUser();
  const { connected, request } = useWebSocket();
  const { currentScreen, requestCurrentScreen } = useScreen();
  const { rawMode, requestCarMode } = useCarMode();
  const { savedScreens } = useSavedOledScreens();
  const oledCanvasTransfer = useOledCanvasTransfer();
  const stmRemoteCommandMode = getStmRemoteCommandMode();

  const [hoverSync, setHoverSync] = useState(false);
  const [hoverSync2, setHoverSync2] = useState(false);

  const [openScreenDetails, setOpenScreenDetails] = useState(false);
  const [, setSelectedMenuItem] = useState<number>(1);

  const [hoverMenuUp, setHoverMenuUp] = useState(false);
  const [hoverMenuDown, setHoverMenuDown] = useState(false);

  const [hoverMenuItem1, setHoverMenuItem1] = useState(false);
  const [hoverMenuItem2, setHoverMenuItem2] = useState(false);
  const [hoverMenuItem3, setHoverMenuItem3] = useState(false);

  const [hoverInfo, setHoverInfo] = useState(false);

  const [hoverEncoderBtn, setHoverEncoderBtn] = useState(false);
  const [hoverUserBtn, setHoverUserBtn] = useState(false);
  const [hoverRotateLeft, setHoverRotateLeft] = useState(false);
  const [hoverRotateRight, setHoverRotateRight] = useState(false);
  const [savedScreensOpen, setSavedScreensOpen] = useState(false);
  const [remoteCommandStatus, setRemoteCommandStatus] = useState<{
    tone: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ tone: "idle", message: "Controles remotos listos." });
  const canUseSavedScreens = rawMode === 0x02 &&
    currentScreen?.screenCode === OLED_CANVAS_SCREEN_CODE;

  const [pressedMenuItem, setPressedMenuItem] = useState<number | null>(null);
  const [pressedScrollDir, setPressedScrollDir] =
    useState<ScreenPageDirection | null>(null);
  const [pressedRotate, setPressedRotate] = useState<"left" | "right" | null>(
    null,
  );



  const [pressedAuxButton, setPressedAuxButton] =
    useState<AuxButtonKind | null>(null);
  const [longPressActive, setLongPressActive] = useState<
    Record<AuxButtonKind, boolean>
  >({
    encoder: false,
    user: false,
  });

  const auxPressStartRef = useRef<Record<AuxButtonKind, number | null>>({
    encoder: null,
    user: null,
  });

  const auxLongPressTimeoutRef = useRef<Record<AuxButtonKind, number | null>>({
    encoder: null,
    user: null,
  });

  const currentScreenRef = useRef(currentScreen);
  const refreshTimeoutRef = useRef<number | null>(null);
  const manualSyncRequestRef = useRef<string | null>(null);
  const manualSyncTimeoutRef = useRef<number | null>(null);
  const previewMeasureRef = useRef<HTMLDivElement | null>(null);
  const [previewHeight, setPreviewHeight] = useState<number>(256);

  const resolvedScreen = useMemo(
    () =>
      currentScreen
        ? resolveOledScreen({
            screenCode: currentScreen.screenCode,
            source: currentScreen.source,
            sourceName: currentScreen.sourceName,
            title: currentScreen.title,
            rawData: currentScreen.rawData,
          })
        : null,
    [currentScreen],
  );
  const notificationRemainingMs = readFiniteNumber(currentScreen?.rawData?.remainingMs);
  const notificationTotalMs = readFiniteNumber(currentScreen?.rawData?.totalMs);
  const notificationActive = currentScreen?.rawData?.notificationActive === true
    || (notificationRemainingMs !== null && notificationRemainingMs > 0);

  const isKnownSelectableScreen = isMenuControlScreenCode(
    currentScreen?.screenCode,
  );
  const itemsCount = Math.max(
    0,
    currentScreen?.itemsCount ?? (isKnownSelectableScreen ? MENU_VISIBLE_ITEMS : 0),
  );
  const screenHasMenuItems = Boolean(
    currentScreen &&
      (currentScreen.hasMenuItems || itemsCount > 0 || isKnownSelectableScreen),
  );
  const isValidationScreen = currentScreen?.isValidationScreen ?? false;
  const pinDigitsCount = Math.max(0, currentScreen?.pinDigitsCount ?? 0);

  const currentPage = Math.max(1, currentScreen?.currentMenuPage ?? 1);
  const totalPages = Math.max(1, currentScreen?.totalMenuPages ?? 1);
  const selectedIndex = currentScreen?.selectedIndex ?? null;
  const visibleStartIndex = currentScreen?.visibleStartIndex ?? 0;
  const visibleEndIndex = currentScreen?.visibleEndIndex ?? 0;

  const [openPinValidationModal, setOpenPinValidationModal] = useState(false);

  const visibleButtonsCount = screenHasMenuItems
    ? Math.max(
        1,
        visibleEndIndex >= visibleStartIndex
          ? visibleEndIndex - visibleStartIndex + 1
          : 0,
        Math.min(MENU_VISIBLE_ITEMS, itemsCount || MENU_VISIBLE_ITEMS),
      )
    : 0;

  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  useEffect(() => {
    const target = previewMeasureRef.current;
    if (!target) return;

    const updateHeight = () => {
      const rect = target.getBoundingClientRect();
      if (rect.height > 0) {
        setPreviewHeight(rect.height);
      }
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [resolvedScreen, isModal]);

  useEffect(() => {
    const auxLongPressTimers = auxLongPressTimeoutRef.current;
    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
      if (manualSyncTimeoutRef.current !== null) {
        window.clearTimeout(manualSyncTimeoutRef.current);
      }
      (Object.keys(auxLongPressTimers) as AuxButtonKind[]).forEach((kind) => {
        const timer = auxLongPressTimers[kind];
        if (timer !== null) window.clearTimeout(timer);
      });
    };
  }, []);

  useEffect(() => {
    if (!currentScreen?.requestId || currentScreen.requestId !== manualSyncRequestRef.current) {
      return;
    }

    manualSyncRequestRef.current = null;
    if (manualSyncTimeoutRef.current !== null) {
      window.clearTimeout(manualSyncTimeoutRef.current);
      manualSyncTimeoutRef.current = null;
    }
    setRemoteCommandStatus({
      tone: "success",
      message: currentScreen.hasMenuItems
        ? `Pantalla y seleccion ${currentScreen.selectedIndex ?? 0} sincronizadas desde la F4.`
        : "Pantalla sincronizada desde la F4.",
    });
  }, [currentScreen]);

  const scheduleScreenRefresh = () => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      requestCurrentScreen();
      requestCarMode();
    }, POST_COMMAND_SCREEN_REFRESH_DELAY_MS);
  };

  const dispatchStmCommand = async (
    legacyCommand: string,
    payloadOrOptionsOrDescription:
      | number[]
      | {
          payload?: number[];
          jsonCommand?: string;
          jsonParams?: Record<string, unknown>;
        }
      | string,
    descriptionOrOptions?:
      | string
      | {
          payload?: number[];
          jsonCommand?: string;
          jsonParams?: Record<string, unknown>;
        },
  ) => {
    const description =
      typeof payloadOrOptionsOrDescription === "string"
        ? payloadOrOptionsOrDescription
        : typeof descriptionOrOptions === "string"
          ? descriptionOrOptions
          : "Sin descripcion";
    const options = normalizeStmCommandOptions(
      payloadOrOptionsOrDescription,
      descriptionOrOptions,
    );
    const payload = options.payload ?? [];
    const useJsonCommand =
      stmRemoteCommandMode === STM_REMOTE_COMMAND_MODE.JSON &&
      Boolean(options.jsonCommand);
    const command = useJsonCommand ? options.jsonCommand! : legacyCommand;

    console.log("[UNER][WEB->MCU] comando solicitado", {
      command,
      description,
      bridgeMode: useJsonCommand ? "json" : "legacy-hex",
      payloadHex: payload
        .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
        .join(" "),
      payloadBytes: payload,
      params: options.jsonParams,
    });

    if (!connected) {
      console.warn("[UNER][WEB->MCU] no conectado, comando ignorado", {
        command,
        description,
      });
      setRemoteCommandStatus({ tone: "error", message: "No hay WebSocket activo." });
      return false;
    }

    if (!remotePinAuthenticated) {
      setRemoteCommandStatus({
        tone: "error",
        message: "La sesion PIN no esta autorizada. Volve a ingresar.",
      });
      return false;
    }

    const requestId = createCommandRequestId();

    setRemoteCommandStatus({ tone: "loading", message: `Enviando: ${description}` });
    try {
      await request(
        command,
        useJsonCommand ? options.jsonParams ?? {} : { payload },
        { requestId, timeoutMs: 3_500 },
      );
      setRemoteCommandStatus({ tone: "success", message: `Confirmado por F4: ${description}` });
      return true;
    } catch (cause) {
      const feedback = getStmRemoteActionFeedback(cause, description);
      setRemoteCommandStatus({
        tone: "error",
        message: feedback.message,
      });
      if (feedback.refreshScreen) scheduleScreenRefresh();
      return false;
    }
  };

  const getAccentButtonStyle = (
    hovered: boolean,
    pressed = false,
    longPressed = false,
  ): React.CSSProperties => {
    if (longPressed) {
      return {
        background: "#f59e0b",
        color: "#0f172a",
        borderColor: "#fbbf24",
        transform: "scale(0.94)",
        boxShadow: "0 0 0 3px rgba(251,191,36,0.28)",
      };
    }

    if (pressed) {
      return {
        background: "var(--ui-action-bg)",
        color: "var(--ui-action-ink)",
        borderColor: "var(--ui-action-bg)",
        transform: "scale(0.94)",
        boxShadow: "0 0 0 2px var(--ui-accent-wash) inset",
      };
    }

    if (hovered) {
      return {
        background: "var(--ui-action-hover-bg)",
        color: "var(--ui-action-hover-ink)",
        borderColor: "var(--ui-action-hover-bg)",
      };
    }

    return {
      borderColor: "var(--ui-action-bg)",
      color: "var(--ui-action-ink)",
      background: "var(--ui-action-bg)",
    };
  };

  const animateMenuItemPress = (item: number) => {
    setPressedMenuItem(item);
    window.setTimeout(() => {
      setPressedMenuItem((prev) => (prev === item ? null : prev));
    }, 140);
  };

  const animateScrollPress = (direction: ScreenPageDirection) => {
    setPressedScrollDir(direction);
    window.setTimeout(() => {
      setPressedScrollDir((prev) => (prev === direction ? null : prev));
    }, 140);
  };

  const animateRotatePress = (direction: "left" | "right") => {
    setPressedRotate(direction);
    window.setTimeout(() => {
      setPressedRotate((prev) => (prev === direction ? null : prev));
    }, 140);
  };

  const handleMenuItemClick = (item: 1 | 2 | 3) => {
    if (!currentScreen || !screenHasMenuItems) {
      console.warn("[Menu] No hay currentScreen o el menú no tiene items");
      return;
    }

    if (item > visibleButtonsCount) {
      return;
    }

    setSelectedMenuItem(item);
    animateMenuItemPress(item);

    const payload = buildMenuItemClickPayload(currentScreen.screenCode, item);

    void dispatchStmCommand(
      STM_LEGACY_REMOTE_COMMANDS.MENU_ITEM_CLICK,
      {
        payload,
        jsonCommand: STM_REMOTE_INPUT_COMMANDS.MENU_ITEM_CLICK,
        jsonParams: { screenCode: currentScreen.screenCode, item },
      },
      `Emular click físico sobre item visible ${item}`,
    ).then((ok) => { if (ok) scheduleScreenRefresh(); });
  };

  const handleMenuScroll = (direction: ScreenPageDirection) => {
    if (!currentScreen || !screenHasMenuItems) {
      console.warn("[Menu] No hay currentScreen o el menú no tiene paginación");
      return;
    }

    if (direction === "up" && currentPage <= 1) {
      return;
    }

    if (direction === "down" && currentPage >= totalPages) {
      return;
    }

    animateScrollPress(direction);

    const payload = buildScreenPagePayload(currentScreen.screenCode, direction);

    void dispatchStmCommand(
      STM_LEGACY_REMOTE_COMMANDS.REQUEST_SCREEN_PAGE,
      {
        payload,
        jsonCommand: STM_REMOTE_INPUT_COMMANDS.REQUEST_SCREEN_PAGE,
        jsonParams: { screenCode: currentScreen.screenCode, direction },
      },
      direction === "up"
        ? "Solicitar página anterior de la screen actual"
        : "Solicitar página siguiente de la screen actual",
    ).then((ok) => { if (ok) scheduleScreenRefresh(); });
  };

  const startAuxPress = (kind: AuxButtonKind) => {
    auxPressStartRef.current[kind] = Date.now();
    setPressedAuxButton(kind);
    setLongPressActive((prev) => ({ ...prev, [kind]: false }));

    if (auxLongPressTimeoutRef.current[kind] !== null) {
      window.clearTimeout(auxLongPressTimeoutRef.current[kind]!);
    }

    auxLongPressTimeoutRef.current[kind] = window.setTimeout(() => {
      setLongPressActive((prev) => ({ ...prev, [kind]: true }));
    }, LONG_PRESS_THRESHOLD_MS);
  };

  const cancelAuxPress = (kind: AuxButtonKind) => {
    auxPressStartRef.current[kind] = null;
    setPressedAuxButton((prev) => (prev === kind ? null : prev));
    setLongPressActive((prev) => ({ ...prev, [kind]: false }));

    if (auxLongPressTimeoutRef.current[kind] !== null) {
      window.clearTimeout(auxLongPressTimeoutRef.current[kind]!);
      auxLongPressTimeoutRef.current[kind] = null;
    }
  };

  const releaseAuxPress = (kind: AuxButtonKind) => {
    const startedAt = auxPressStartRef.current[kind];

    if (auxLongPressTimeoutRef.current[kind] !== null) {
      window.clearTimeout(auxLongPressTimeoutRef.current[kind]!);
      auxLongPressTimeoutRef.current[kind] = null;
    }

    auxPressStartRef.current[kind] = null;

    if (!currentScreen) {
      cancelAuxPress(kind);
      return;
    }

    if (startedAt === null) {
      cancelAuxPress(kind);
      return;
    }

    const heldMs = Date.now() - startedAt;
    const pressKind =
      heldMs >= LONG_PRESS_THRESHOLD_MS
        ? UNER_PRESS_KIND_LONG
        : UNER_PRESS_KIND_SHORT;

    const legacyCommand =
      kind === "encoder"
        ? STM_LEGACY_REMOTE_COMMANDS.ENCODER_BUTTON
        : STM_LEGACY_REMOTE_COMMANDS.USER_BUTTON;
    const jsonCommand =
      kind === "encoder"
        ? STM_REMOTE_INPUT_COMMANDS.ENCODER_BUTTON
        : STM_REMOTE_INPUT_COMMANDS.USER_BUTTON;

    const payload = buildAuxButtonPayload(currentScreen.screenCode, pressKind);

    void dispatchStmCommand(
      legacyCommand,
      {
        payload,
        jsonCommand,
        jsonParams: {
          screenCode: currentScreen.screenCode,
          pressKind: toRemotePressKindLabel(pressKind),
        },
      },
      `${kind === "encoder" ? "Emular botón encoder" : "Emular botón user"} como ${
        pressKind === UNER_PRESS_KIND_LONG ? "longpress" : "shortpress"
      }`,
    ).then((ok) => { if (ok) scheduleScreenRefresh(); });

    setPressedAuxButton((prev) => (prev === kind ? null : prev));
    setLongPressActive((prev) => ({ ...prev, [kind]: false }));

  };

  const handleEncoderRotate = (direction: "left" | "right") => {
    if (!currentScreen) {
      console.warn("[Encoder] No hay currentScreen para enviar rotación");
      return;
    }

    animateRotatePress(direction);

    const legacyCommand =
      direction === "left"
        ? STM_LEGACY_REMOTE_COMMANDS.ROTATE_LEFT
        : STM_LEGACY_REMOTE_COMMANDS.ROTATE_RIGHT;
    const jsonCommand =
      direction === "left"
        ? STM_REMOTE_INPUT_COMMANDS.ROTATE_LEFT
        : STM_REMOTE_INPUT_COMMANDS.ROTATE_RIGHT;

    const payload = buildEncoderRotatePayload(currentScreen.screenCode);

    void dispatchStmCommand(
      legacyCommand,
      {
        payload,
        jsonCommand,
        jsonParams: {
          screenCode: currentScreen.screenCode,
        },
      },
      direction === "left"
        ? "Emular giro físico del encoder hacia la izquierda"
        : "Emular giro físico del encoder hacia la derecha",
    ).then((ok) => { if (ok) scheduleScreenRefresh(); });
  };

  const handleValidatePin = async (pin: string) => {
    const screenAtSubmit = currentScreenRef.current;

    if (!screenAtSubmit) {
      return {
        ok: false,
        reason: "unknown" as const,
        message: "No hay pantalla STM activa para validar.",
      };
    }

    const validation = await validatePin(pin, screenAtSubmit.screenCode);

    if (!validation.ok) {
      return validation;
    }

    scheduleScreenRefresh();
    return validation;
  };

  const screenLabel = currentScreen
    ? currentScreen.known
      ? currentScreen.title
      : `Pantalla desconocida ${currentScreen.screenCodeHex}`
    : "Sin snapshot";

  const updateLabel =
    currentScreen?.updateKind === "screen.changed"
      ? "Stream"
      : currentScreen
        ? "Snapshot"
        : "Sin datos";

  const sourceLabel = currentScreen
    ? (currentScreen.sourceName ?? `source ${currentScreen.source ?? "?"}`)
    : "Sin source";

  const renderLabel = resolvedScreen
    ? `${resolvedScreen.category} / ${resolvedScreen.builder}`
    : "Sin builder resuelto";

  const actionButtonStyle = (hovered: boolean): React.CSSProperties =>
    hovered
      ? {
          background: "var(--ui-accent)",
          color: "var(--ui-action-hover-ink)",
          borderColor: "var(--ui-accent)",
        }
      : {
          borderColor: "rgba(34,211,238,0.3)",
          color: "var(--ui-accent)",
        };

  const sendSavedScreen = async (screenId: string) => {
    const savedScreen = savedScreens.find((screen) => screen.id === screenId);

    if (!savedScreen) {
      return;
    }

    if (!canUseSavedScreens) {
      setRemoteCommandStatus({
        tone: "error",
        message: "En la F4 entra a Testeo > Pantalla > OLED Canvas antes de enviar.",
      });
      return;
    }

    setRemoteCommandStatus({
      tone: "loading",
      message: `Enviando "${savedScreen.title}" a la OLED...`,
    });
    try {
      await oledCanvasTransfer.send(rasterizeOledDocument(savedScreen.document));
      setRemoteCommandStatus({
        tone: "success",
        message: `"${savedScreen.title}" fue mostrada y confirmada por la F4.`,
      });
    } catch (cause) {
      setRemoteCommandStatus({
        tone: "error",
        message: cause instanceof Error ? cause.message : "No se pudo enviar la pantalla guardada.",
      });
    }
  };

  const handleManualScreenSync = () => {
    const requestId = requestCurrentScreen();
    requestCarMode();
    if (!requestId) {
      setRemoteCommandStatus({ tone: "error", message: "No hay una sesion F4 disponible para sincronizar." });
      return;
    }

    manualSyncRequestRef.current = requestId;
    setRemoteCommandStatus({
      tone: "loading",
      message: "Consultando pantalla y seleccion actual directamente en la F4...",
    });
    if (manualSyncTimeoutRef.current !== null) {
      window.clearTimeout(manualSyncTimeoutRef.current);
    }
    manualSyncTimeoutRef.current = window.setTimeout(() => {
      if (manualSyncRequestRef.current !== requestId) return;
      manualSyncRequestRef.current = null;
      manualSyncTimeoutRef.current = null;
      setRemoteCommandStatus({ tone: "error", message: "La F4 no respondio la sincronizacion de pantalla." });
    }, 3_500);
  };

  return (
    <div
      className={`screen-stream-workspace flex w-full flex-col ${
        isModal ? "min-h-[72vh] screen-stream-workspace--modal" : ""
      }`}
    >
      <div
        className={`mb-6 flex w-full flex-col gap-4 ${
          isModal ? "" : "lg:flex-row lg:items-center lg:justify-between"
        }`}
      >
        <div className="flex flex-1 flex-col gap-4">
          {!isModal && (
            <div>
              <h2 className="text-2xl font-black uppercase text-white">
                Pantalla STM
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Render OLED vinculado al <code>screenCode</code> del bridge
                JSON.
              </p>
            </div>
          )}

          <div className="my-1 flex flex-wrap items-center gap-2">
            <PillWithTooltip
              label={updateLabel}
              tooltip={
                updateLabel === "Snapshot"
                  ? "Snapshot: estado puntual pedido explícitamente desde la web al MCU."
                  : updateLabel === "Stream"
                    ? "Stream: actualización espontánea recibida desde el MCU."
                    : "Sin datos de actualización."
              }
              tone="cyan"
            />

            {resolvedScreen ? (
              <PillWithTooltip
                label="Render OK"
                tooltip="Render OK: el screenCode actual pudo resolverse contra un builder de src/screens y generar comandos OLED válidos."
                tone="emerald"
              />
            ) : null}

            {notificationActive ? (
              <PillWithTooltip
                label={`Notificacion activa · ${formatRemainingSeconds(notificationRemainingMs)}`}
                tooltip={`La F4 informa el aviso transitorio activo y su tiempo restante${notificationTotalMs !== null ? ` de ${(notificationTotalMs / 1000).toFixed(1)} s` : ""}. Al finalizar enviara la pantalla restaurada.`}
                tone="cyan"
              />
            ) : null}

            {isValidationScreen && (
              <PillWithTooltip
                label="PIN"
                tooltip="Pantalla de validación. El panel lateral permite preparar un PIN local y enviarlo luego al bridge."
                tone="cyan"
              />
            )}
          </div>

          <div className="flex flex-col">
            <p className="text-xl font-black text-white">{screenLabel}</p>
            <p className="mt-1 text-sm text-slate-300">
              {resolvedScreen?.description ??
                "Esperando screen.current o screen.changed para resolver el builder OLED."}
            </p>
          </div>

          {isValidationScreen ? (
            //Aca iba la pill de pin validation, agregala
            <div className="app-panel-strong flex flex-row p-4">
              <p className="text-xs text-slate-400">
                Esta pantalla es de validación. Podés ingresar el PIN y enviarlo
                al MCU para validar de manera remota.
              </p>
            </div>
          ) : (
            screenHasMenuItems && (
              <div className="app-panel-strong flex flex-row p-4">
                <p className="text-xs text-slate-400">
                  Podés enviar eventos del menú visible. Esta pantalla tiene{" "}
                  <span className="font-bold text-slate-200">{itemsCount}</span>{" "}
                  items distribuidos en{" "}
                  <span className="font-bold text-slate-200">{totalPages}</span>{" "}
                  páginas.
                </p>
              </div>
            )
          )}
        </div>
      </div>

      <div className="flex w-full flex-col gap-4 pb-4">
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-center text-xs font-semibold uppercase text-slate-400">
            <div className="flex flex-row items-center gap-2">
              <div className="relative flex items-center justify-center">
                <button
                  type="button"
                  className="screen-render-info-button transition"
                  style={{
                    borderColor: "rgba(34,211,238,0.3)",
                    color: "var(--ui-accent)",
                    background: "transparent",
                  }}
                  aria-label="Información del render"
                  title="Información del render"
                  onMouseEnter={() => setHoverInfo(true)}
                  onMouseLeave={() => setHoverInfo(false)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M11.25 10.5a.75.75 0 0 1 .75-.75h.05a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0V12a.75.75 0 0 1-.05-1.5ZM12 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                    />
                    <path
                      fill="currentColor"
                      fillRule="evenodd"
                      d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5Zm0 1.5a8.25 8.25 0 1 1 0 16.5 8.25 8.25 0 0 1 0-16.5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {hoverInfo && (
                  <div className="absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-cyan-300/20 bg-slate-950 px-3 py-2 text-[11px] normal-case text-slate-300 shadow-lg">
                    Renderizado desde <code>src/screens</code> usando{" "}
                    <code>screenCode</code> como identidad.
                  </div>
                )}
              </div>

              <span>OLED render</span>
              <span>
                {currentPage}/{totalPages}
              </span>
            </div>
          </div>

          <div
            className={`screen-stream-preview-layout flex w-full gap-3 justify-center items-center flex-col lg:flex-row ${
              isModal ? "" : ""
            } `}
          >
            <div className="screen-stream-preview-column flex min-w-0 flex-col gap-3">
              <div
                ref={previewMeasureRef}
                className={`${isModal ? "w-full max-w-[980px]" : "w-fit"}`}
              >
                {resolvedScreen ? (
                  <OledCommandPreview commands={resolvedScreen.commands} />
                ) : (
                  <div className="flex aspect-[2/1] w-full items-center justify-center rounded-md border border-cyan-300/30 bg-slate-950 px-4 text-center text-xs text-slate-400">
                    Sin comandos para renderizar.
                  </div>
                )}
              </div>

              <div className="screen-live-controls">
                <ControlBlock title="Controles físicos">
                  <div className="screen-live-button-row">
                    <LabeledLiveControl title="BTN">
                      <button
                        type="button"
                        onPointerDown={(event) => {
                          event.currentTarget.setPointerCapture(event.pointerId);
                          startAuxPress("user");
                        }}
                        onPointerUp={(event) => {
                          releaseAuxPress("user");
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                            event.currentTarget.releasePointerCapture(event.pointerId);
                          }
                        }}
                        onPointerCancel={(event) => {
                          cancelAuxPress("user");
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                            event.currentTarget.releasePointerCapture(event.pointerId);
                          }
                        }}
                        onLostPointerCapture={() => {
                          if (auxPressStartRef.current.user !== null) cancelAuxPress("user");
                        }}
                        onMouseEnter={() => setHoverUserBtn(true)}
                        onMouseLeave={() => setHoverUserBtn(false)}
                        className="screen-live-button"
                        style={getAccentButtonStyle(
                          hoverUserBtn,
                          pressedAuxButton === "user",
                          longPressActive.user,
                        )}
                        disabled={!connected || !remotePinAuthenticated}
                        aria-label="Emular botón user"
                        title="Botón user"
                      >
                        <MonoBitmapIcon
                        bitmap={Icon_UserBtn_bits}
                        width={15}
                        height={16}
                        scale={2}
                          color="#FFFFFF"
                        />
                      </button>
                    </LabeledLiveControl>

                    <LabeledLiveControl title="BTN encoder">
                      <button
                        type="button"
                        onPointerDown={(event) => {
                          event.currentTarget.setPointerCapture(event.pointerId);
                          startAuxPress("encoder");
                        }}
                        onPointerUp={(event) => {
                          releaseAuxPress("encoder");
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                            event.currentTarget.releasePointerCapture(event.pointerId);
                          }
                        }}
                        onPointerCancel={(event) => {
                          cancelAuxPress("encoder");
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                            event.currentTarget.releasePointerCapture(event.pointerId);
                          }
                        }}
                        onLostPointerCapture={() => {
                          if (auxPressStartRef.current.encoder !== null) cancelAuxPress("encoder");
                        }}
                        onMouseEnter={() => setHoverEncoderBtn(true)}
                        onMouseLeave={() => setHoverEncoderBtn(false)}
                        className="screen-live-button"
                        style={getAccentButtonStyle(
                          hoverEncoderBtn,
                          pressedAuxButton === "encoder",
                          longPressActive.encoder,
                        )}
                        disabled={!connected || !remotePinAuthenticated}
                        aria-label="Emular botón encoder"
                        title="Botón encoder"
                      >
                        <MonoBitmapIcon
                        bitmap={Icon_Encoder_bits}
                        width={13}
                        height={13}
                        scale={2}
                          color="#FFFFFF"
                        />
                      </button>
                    </LabeledLiveControl>

                    <LabeledLiveControl title="Giro izq.">
                      <button
                        type="button"
                        onClick={() => handleEncoderRotate("left")}
                        onMouseEnter={() => setHoverRotateLeft(true)}
                        onMouseLeave={() => setHoverRotateLeft(false)}
                        className="screen-live-button"
                        style={getAccentButtonStyle(
                          hoverRotateLeft,
                          pressedRotate === "left",
                        )}
                        disabled={!connected || !remotePinAuthenticated}
                        aria-label="Emular giro encoder izquierda"
                        title="Girar encoder a la izquierda"
                      >
                        <TurnArrowIcon direction="left" />
                      </button>
                    </LabeledLiveControl>

                    <LabeledLiveControl title="Giro der.">
                      <button
                        type="button"
                        onClick={() => handleEncoderRotate("right")}
                        onMouseEnter={() => setHoverRotateRight(true)}
                        onMouseLeave={() => setHoverRotateRight(false)}
                        className="screen-live-button"
                        style={getAccentButtonStyle(
                          hoverRotateRight,
                          pressedRotate === "right",
                        )}
                        disabled={!connected || !remotePinAuthenticated}
                        aria-label="Emular giro encoder derecha"
                        title="Girar encoder a la derecha"
                      >
                        <TurnArrowIcon direction="right" />
                      </button>
                    </LabeledLiveControl>
                  </div>
                </ControlBlock>
              </div>
            </div>
            {isValidationScreen || screenHasMenuItems ? (
              <div
                className="screen-stream-preview-divider w-px self-stretch"
                style={{ background: "var(--ui-accent)" }}
              />
            ) : null}

            {isValidationScreen ? (
              <div
                className="screen-stream-preview-side screen-validation-side-panel flex items-stretch gap-2"
                style={{
                  height: `${previewHeight}px`,
                  minHeight: `${previewHeight}px`,
                }}
              >
                <div
                  className="flex flex-col justify-between rounded-xl border border-white/10 bg-slate-950/40 p-3"
                  style={{
                    height: `${previewHeight}px`,
                    minHeight: `${previewHeight}px`,
                  }}
                >
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-semibold text-white">
                      Pantalla de validación
                    </p>
                    <p className="text-xs text-slate-400">
                      Esta pantalla requiere ingreso de PIN.
                    </p>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-200/80">
                      {remotePinAuthenticated
                        ? "Sesion remota autenticada en ESP"
                        : "Sin sesion remota autenticada"}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="w-full rounded-md border px-3 py-2 text-sm font-semibold transition"
                    style={getAccentButtonStyle(false, false)}
                    onClick={() => setOpenPinValidationModal(true)}
                    disabled={!connected || !remotePinAuthenticated}
                    aria-label="Validar PIN"
                    title="Validar PIN"
                  >
                    Validar PIN
                  </button>
                </div>
              </div>
            ) : (
              screenHasMenuItems && (
                <div
                  className="screen-stream-preview-side screen-menu-side-controls flex items-stretch gap-2"
                  style={{
                    height: `${previewHeight}px`,
                    minHeight: `${previewHeight}px`,
                  }}
                >
                  <div
                    className="screen-menu-item-selector flex flex-col items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 p-2"
                    style={{
                      height: `${previewHeight}px`,
                      minHeight: `${previewHeight}px`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleMenuItemClick(1)}
                      onMouseEnter={() => setHoverMenuItem1(true)}
                      onMouseLeave={() => setHoverMenuItem1(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-md border text-xs font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                      style={getAccentButtonStyle(
                        hoverMenuItem1,
                        pressedMenuItem === 1,
                      )}
                      disabled={!connected || !remotePinAuthenticated || visibleButtonsCount < 1}
                      aria-label="Seleccionar item visible 1"
                      title="Seleccionar item visible 1"
                    >
                      1
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMenuItemClick(2)}
                      onMouseEnter={() => setHoverMenuItem2(true)}
                      onMouseLeave={() => setHoverMenuItem2(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-md border text-xs font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                      style={getAccentButtonStyle(
                        hoverMenuItem2,
                        pressedMenuItem === 2,
                      )}
                      disabled={!connected || !remotePinAuthenticated || visibleButtonsCount < 2}
                      aria-label="Seleccionar item visible 2"
                      title="Seleccionar item visible 2"
                    >
                      2
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMenuItemClick(3)}
                      onMouseEnter={() => setHoverMenuItem3(true)}
                      onMouseLeave={() => setHoverMenuItem3(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-md border text-xs font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                      style={getAccentButtonStyle(
                        hoverMenuItem3,
                        pressedMenuItem === 3,
                      )}
                      disabled={!connected || !remotePinAuthenticated || visibleButtonsCount < 3}
                      aria-label="Seleccionar item visible 3"
                      title="Seleccionar item visible 3"
                    >
                      3
                    </button>
                  </div>

                  <div
                    className="flex flex-col items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 p-2"
                    style={{
                      height: `${previewHeight}px`,
                      minHeight: `${previewHeight}px`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleMenuScroll("up")}
                      onMouseEnter={() => setHoverMenuUp(true)}
                      onMouseLeave={() => setHoverMenuUp(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                      style={getAccentButtonStyle(
                        hoverMenuUp,
                        pressedScrollDir === "up",
                      )}
                      aria-label="Scroll menu up"
                      title="Subir página"
                      disabled={!connected || !remotePinAuthenticated || currentPage <= 1}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-4 w-4"
                      >
                        <path d="M18 15l-6-6-6 6" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMenuScroll("down")}
                      onMouseEnter={() => setHoverMenuDown(true)}
                      onMouseLeave={() => setHoverMenuDown(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                      style={getAccentButtonStyle(
                        hoverMenuDown,
                        pressedScrollDir === "down",
                      )}
                      aria-label="Scroll menu down"
                      title="Bajar página"
                      disabled={!connected || !remotePinAuthenticated || currentPage >= totalPages}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-4 w-4"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <div
        role="status"
        className={`mb-3 rounded-md border px-3 py-2 text-xs ${
          remoteCommandStatus.tone === "error"
            ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
            : remoteCommandStatus.tone === "success"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-cyan-300/20 bg-cyan-400/5 text-slate-300"
        }`}
      >
        {remoteCommandStatus.message}
      </div>

      <div className="mb-4 flex w-full flex-row flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          className="screen-stream-action-button w-fit border text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
          onClick={handleManualScreenSync}
          disabled={!connected || !remotePinAuthenticated}
          onMouseEnter={() => setHoverSync(true)}
          onMouseLeave={() => setHoverSync(false)}
          style={actionButtonStyle(hoverSync)}
        >
          Sincronizar pantalla
        </button>

        <button
          type="button"
          className="screen-stream-action-button w-fit border text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => {
            setOpenScreenDetails((value) => !value);
          }}
          style={actionButtonStyle(hoverSync2)}
          onMouseEnter={() => setHoverSync2(true)}
          onMouseLeave={() => setHoverSync2(false)}
        >
          <span>{openScreenDetails ? "Ocultar detalles" : "Mostrar detalles"}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="size-4 transition-transform duration-200"
            style={{
              transform: openScreenDetails ? "rotate(180deg)" : "rotate(0deg)",
              color: "currentColor",
            }}
          >
            <path
              d="M6 8l4 4 4-4"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {openScreenDetails && (
        <div className="flex flex-row gap-4">
          <div className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <div className="grid-cols-1 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300 md:grid-cols-3">
              <ScreenFact
                label="Codigo"
                value={currentScreen?.screenCodeHex ?? formatScreenCodeHex(0)}
                styles="app-dialog flex flex-row items-start gap-2 py-2 px-4 !w-fit rounded-md bg-slate-900/50 border border-slate-700/50"
              />

              <ScreenFact
                label="Origen"
                value={sourceLabel}
                styles="app-dialog flex flex-row items-start gap-2 py-2 px-4 !w-fit rounded-md bg-slate-900/50 border border-slate-700/50"
              />

              <ScreenFact
                label="Segmentos"
                value={
                  currentScreen
                    ? `menu ${currentScreen.menu} / submenu ${currentScreen.submenu} / page ${currentScreen.page}`
                    : "sin datos"
                }
                styles="app-dialog flex flex-row items-start gap-2 py-2 px-4 !w-fit rounded-md bg-slate-900/50 border border-slate-700/50"
              />

              <ScreenFact
                label="Items"
                value={String(itemsCount)}
                styles="app-dialog flex flex-row items-start gap-2 py-2 px-4 !w-fit rounded-md bg-slate-900/50 border border-slate-700/50"
              />

              <ScreenFact
                label="Páginas menú"
                value={`${currentPage}/${totalPages}`}
                styles="app-dialog flex flex-row items-start gap-2 py-2 px-4 !w-fit rounded-md bg-slate-900/50 border border-slate-700/50"
              />

              <ScreenFact
                label="Seleccionado"
                value={
                  selectedIndex !== null ? String(selectedIndex) : "sin dato"
                }
                styles="app-dialog flex flex-row items-start gap-2 py-2 px-4 !w-fit rounded-md bg-slate-900/50 border border-slate-700/50"
              />

              <ScreenFact
                label="Rango visible"
                value={
                  screenHasMenuItems
                    ? `${visibleStartIndex}-${visibleEndIndex}`
                    : "sin menú"
                }
                styles="app-dialog flex flex-row items-start gap-2 py-2 px-4 !w-fit rounded-md bg-slate-900/50 border border-slate-700/50"
              />

              <ScreenFact
                label="Validación PIN"
                value={
                  isValidationScreen ? `sí (${pinDigitsCount} dígitos)` : "no"
                }
                styles="app-dialog flex flex-row items-start gap-2 py-2 px-4 !w-fit rounded-md bg-slate-900/50 border border-slate-700/50"
              />

              <ScreenFact
                label="Payload 0x95"
                value={formatPayload(currentScreen?.payload)}
                styles="app-dialog flex flex-row items-start gap-2 py-2 px-4 !w-fit rounded-md bg-slate-900/50 border border-slate-700/50"
              />

              <ScreenFact
                label="Render"
                value={renderLabel}
                wide
                styles="app-dialog flex flex-row items-start gap-2 py-2 px-4 !w-fit rounded-md bg-slate-900/50 border border-slate-700/50"
              />

              <ScreenFact
                label="Variante"
                value={resolvedScreen?.variant ?? "sin resolver"}
                wide
                styles="app-dialog flex flex-row items-start gap-2 py-2 px-4 !w-fit rounded-md bg-slate-900/50 border border-slate-700/50"
              />
            </div>
          </div>
        </div>
      )}

      {canUseSavedScreens ? (
      <section className="mt-4 flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-950/45 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Pantallas guardadas
            </div>
            <p className="mt-1 text-sm text-slate-300">
              Disponibles porque la F4 esta en TEST y OLED Canvas esta activo.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSavedScreensOpen((current) => !current)}
            className="flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
          >
            <span>Pantallas guardadas ({savedScreens.length})</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="h-4 w-4 transition-transform duration-200"
              style={{
                transform: savedScreensOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <path
                d="M6 8l4 4 4-4"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {savedScreensOpen ? (
          savedScreens.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {savedScreens.map((screen) => (
                <article
                  key={screen.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/55 p-3"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {screen.title}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {new Date(screen.updatedAt).toLocaleString("es-AR")}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void sendSavedScreen(screen.id)}
                      disabled={oledCanvasTransfer.active}
                      className="rounded-md border border-cyan-300/70 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-cyan-200"
                    >
                      Mandar
                    </button>
                  </div>

                  <div className="rounded-xl border border-cyan-300/15 bg-slate-950/80 p-2">
                    <OledCommandPreview
                      commands={screen.commands}
                      className="mx-auto max-w-[220px]"
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 px-4 py-5 text-sm text-slate-400">
              Todavia no hay pantallas guardadas para mostrar en el visor.
            </div>
          )
        ) : null}
      </section>
      ) : null}

      <PinScreenModal
        isOpen={openPinValidationModal}
        onClose={() => {
          setOpenPinValidationModal(false);
        }}
        title="Validar PIN"
        subtitle="Ingresa el PIN; F4 valida PIN y screenCode en una unica respuesta."
        kicker="Validación"
        submitLabel="Validar PIN"
        digitsCount={currentScreen?.pinDigitsCount ?? 4}
        canClose={true}
        onSubmit={handleValidatePin}
        successAction={() => {
          setOpenPinValidationModal(false);
          requestCurrentScreen();
          requestCarMode();
        }}
        idleMessage="Ingresá el PIN para continuar."
        errorMessage="No se pudo validar el PIN remoto."
        loadingMessage="Validando con ESP y esperando screen.changed..."
      />
    </div>
  );
}

function normalizeStmCommandOptions(
  payloadOrOptionsOrDescription:
    | number[]
    | {
        payload?: number[];
        jsonCommand?: string;
        jsonParams?: Record<string, unknown>;
      }
    | string,
  descriptionOrOptions?:
    | string
    | {
        payload?: number[];
        jsonCommand?: string;
        jsonParams?: Record<string, unknown>;
      },
) {
  if (Array.isArray(payloadOrOptionsOrDescription)) {
    return {
      ...(isStmCommandOptions(descriptionOrOptions) ? descriptionOrOptions : {}),
      payload: payloadOrOptionsOrDescription,
    };
  }

  if (isStmCommandOptions(payloadOrOptionsOrDescription)) {
    return payloadOrOptionsOrDescription;
  }

  if (isStmCommandOptions(descriptionOrOptions)) {
    return descriptionOrOptions;
  }

  return {};
}

function isStmCommandOptions(
  value: unknown,
): value is {
  payload?: number[];
  jsonCommand?: string;
  jsonParams?: Record<string, unknown>;
} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMenuControlScreenCode(screenCode: number | undefined): boolean {
  return (
    screenCode === SCREEN_CODE_CORE_MAIN_MENU ||
    screenCode === SCREEN_CODE_CONNECTIVITY_WIFI_MENU ||
    screenCode === SCREEN_CODE_CONNECTIVITY_WIFI_RESULTS ||
    screenCode === SCREEN_CODE_CONNECTIVITY_ESP_MENU ||
    screenCode === SCREEN_CODE_SENSORS_DISPLAY_MENU ||
    screenCode === SCREEN_CODE_SENSORS_MENU ||
    screenCode === SCREEN_CODE_SETTINGS_MENU
  );
}

function ControlBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="screen-live-control-block">
      <span className="screen-live-control-block__title">
        {title}
      </span>
      {children}
    </div>
  );
}

function LabeledLiveControl({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="screen-live-labeled-control">
      <span className="screen-live-control-block__title">{title}</span>
      {children}
    </div>
  );
}

function MonoBitmapIcon({
  bitmap,
  width,
  height,
  scale = 2,
  color,
}: {
  bitmap: Uint8Array;
  width: number;
  height: number;
  scale?: number;
  color: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bytesPerRow = Math.ceil(width / 8);

    canvas.width = width * scale;
    canvas.height = height * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const byte = bitmap[y * bytesPerRow + (x >> 3)] ?? 0;
        const bit = 1 << (x & 7);

        if (byte & bit) {
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
  }, [bitmap, color, height, scale, width]);

  return (
    <canvas
      ref={canvasRef}
      width={width * scale}
      height={height * scale}
      className="block"
      aria-hidden="true"
    />
  );
}

function TurnArrowIcon({ direction }: { direction: "left" | "right" }) {
  if (direction === "left") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M9 7H5v4" />
        <path d="M5 11a7 7 0 1 0 2-4.9L5 7" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M15 7h4v4" />
      <path d="M19 11a7 7 0 1 1-2-4.9L19 7" />
    </svg>
  );
}

function PillWithTooltip({
  label,
  tooltip,
  tone,
}: {
  label: string;
  tooltip: string;
  tone: "cyan" | "emerald";
}) {
  const baseClass =
    "relative rounded-md px-2 py-1 text-xs font-bold uppercase ring-1";
  const toneClass =
    tone === "cyan"
      ? "bg-cyan-500/15 text-cyan-100 ring-cyan-300/20"
      : "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";

  return (
    <div className="group relative">
      <span className={`${baseClass} ${toneClass} cursor-default`}>
        {label}
      </span>

      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-cyan-300/20 bg-slate-950 px-3 py-2 text-[11px] normal-case text-slate-300 shadow-lg group-hover:block">
        {tooltip}
      </div>
    </div>
  );
}

function ScreenFact({
  label,
  value,
  wide = false,
  styles = "",
}: {
  label: string;
  value: string;
  wide?: boolean;
  styles?: string;
}) {
  return (
    <div className={`${wide ? "sm:col-span-2" : ""} ${styles}`}>
      <span className="block font-semibold uppercase text-slate-500">
        {label}
      </span>
      <span className="break-words font-mono text-slate-100">{value}</span>
    </div>
  );
}

function formatPayload(payload: number[] | undefined) {
  return payload?.length
    ? payload
        .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
        .join(" ")
    : "sin payload";
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatRemainingSeconds(remainingMs: number | null): string {
  if (remainingMs === null) return "activa";
  return `${Math.max(0, remainingMs / 1000).toFixed(1)} s`;
}
