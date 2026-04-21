// src/components/ScreenStreamWorkspace.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useScreen } from "../contexts/ScreenContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { formatScreenCodeHex } from "../types/ScreenTypes";
import { resolveOledScreen } from "../screens";
import OledCommandPreview from "./OledCommandPreview";
import PinScreenModal from "./PinScreenModal";
import useUser from "../contexts/UserContext";
import { useCarMode } from "../contexts/CarModeContext";

const LONG_PRESS_THRESHOLD_MS = 2000;
const POST_COMMAND_SCREEN_REFRESH_DELAY_MS = 120;

const UNER_CMD_GET_CURRENT_SCREEN = "0x52";
const UNER_CMD_MENU_ITEM_CLICK = "0x53";
const UNER_CMD_TRIGGER_ENCODER_BUTTON = "0x54";
const UNER_CMD_TRIGGER_USER_BUTTON = "0x55";
const UNER_CMD_REQUEST_SCREEN_PAGE = "0x56";
const UNER_CMD_TRIGGER_ENCODER_ROTATE_LEFT = "0x57";
const UNER_CMD_TRIGGER_ENCODER_ROTATE_RIGHT = "0x58";
const UNER_CMD_AUTH_PIN_GRANTED = "0x59";

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
  const { validatePin } = useUser();
  const { connected, send } = useWebSocket();
  const { currentScreen, requestCurrentScreen } = useScreen();
  const { requestCarMode } = useCarMode();

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

  const refreshTimeoutRef = useRef<number | null>(null);
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

  const itemsCount = Math.max(0, currentScreen?.itemsCount ?? 0);
  const screenHasMenuItems = currentScreen?.hasMenuItems ?? itemsCount > 0;
  const isValidationScreen = currentScreen?.isValidationScreen ?? false;
  const pinDigitsCount = Math.max(0, currentScreen?.pinDigitsCount ?? 0);

  const currentPage = Math.max(1, currentScreen?.currentMenuPage ?? 1);
  const totalPages = Math.max(1, currentScreen?.totalMenuPages ?? 1);
  const selectedIndex = currentScreen?.selectedIndex ?? null;
  const visibleStartIndex = currentScreen?.visibleStartIndex ?? 0;
  const visibleEndIndex = currentScreen?.visibleEndIndex ?? 0;

  const [openPinValidationModal, setOpenPinValidationModal] = useState(false);

  const visibleButtonsCount = screenHasMenuItems
    ? Math.max(0, visibleEndIndex - visibleStartIndex + 1)
    : 0;

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
    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const scheduleScreenRefresh = () => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      requestCurrentScreen();
      requestCarMode();
    }, POST_COMMAND_SCREEN_REFRESH_DELAY_MS);
  };

  const dispatchUnerCommand = (
    cmdHex: string,
    payload: number[],
    description: string,
  ) => {
    console.log("[UNER][WEB->MCU] comando solicitado", {
      cmdHex,
      description,
      payloadHex: payload
        .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
        .join(" "),
      payloadBytes: payload,
    });

    if (!connected) {
      console.warn("[UNER][WEB->MCU] no conectado, comando ignorado", {
        cmdHex,
        description,
      });
      return null;
    }

    const requestId = createCommandRequestId();

    send("device.command", {
      requestId,
      target: "stm",
      command: cmdHex,
      payload,
    });

    return requestId;
  };

  const getAccentButtonStyle = (
    hovered: boolean,
    pressed = false,
  ): React.CSSProperties => {
    if (pressed) {
      return {
        background: "var(--ui-accent)",
        color: "var(--ui-action-hover-ink)",
        borderColor: "var(--ui-accent)",
        transform: "scale(0.94)",
        boxShadow: "0 0 0 2px rgba(34,211,238,0.22) inset",
      };
    }

    if (hovered) {
      return {
        background: "var(--ui-accent)",
        color: "var(--ui-action-hover-ink)",
        borderColor: "var(--ui-accent)",
      };
    }

    return {
      borderColor: "rgba(34,211,238,0.3)",
      color: "var(--ui-accent)",
      background: "transparent",
    };
  };

  const getWhiteAuxButtonStyle = (
    hovered: boolean,
    pressed: boolean,
    isLongPress: boolean,
  ): React.CSSProperties => {
    if (isLongPress) {
      return {
        background: "#16a34a",
        color: "#ffffff",
        borderColor: "#16a34a",
        boxShadow: "0 0 0 2px rgba(22,163,74,0.2) inset",
      };
    }

    if (pressed) {
      return {
        background: "rgba(255,255,255,0.16)",
        color: "#ffffff",
        borderColor: "rgba(255,255,255,0.72)",
        transform: "scale(0.94)",
        boxShadow: "0 0 0 2px rgba(255,255,255,0.08) inset",
      };
    }

    if (hovered) {
      return {
        background: "rgba(255,255,255,0.08)",
        color: "#ffffff",
        borderColor: "rgba(255,255,255,0.6)",
      };
    }

    return {
      borderColor: "rgba(255,255,255,0.22)",
      color: "#ffffff",
      background: "transparent",
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

    dispatchUnerCommand(
      UNER_CMD_MENU_ITEM_CLICK,
      payload,
      `Emular click físico sobre item visible ${item}`,
    );

    scheduleScreenRefresh();
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

    dispatchUnerCommand(
      UNER_CMD_REQUEST_SCREEN_PAGE,
      payload,
      direction === "up"
        ? "Solicitar página anterior de la screen actual"
        : "Solicitar página siguiente de la screen actual",
    );

    scheduleScreenRefresh();
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

    const cmdHex =
      kind === "encoder"
        ? UNER_CMD_TRIGGER_ENCODER_BUTTON
        : UNER_CMD_TRIGGER_USER_BUTTON;

    const payload = buildAuxButtonPayload(currentScreen.screenCode, pressKind);

    dispatchUnerCommand(
      cmdHex,
      payload,
      `${kind === "encoder" ? "Emular botón encoder" : "Emular botón user"} como ${
        pressKind === UNER_PRESS_KIND_LONG ? "longpress" : "shortpress"
      }`,
    );

    setPressedAuxButton((prev) => (prev === kind ? null : prev));
    setLongPressActive((prev) => ({ ...prev, [kind]: false }));

    scheduleScreenRefresh();
  };

  const handleEncoderRotate = (direction: "left" | "right") => {
    if (!currentScreen) {
      console.warn("[Encoder] No hay currentScreen para enviar rotación");
      return;
    }

    animateRotatePress(direction);

    const cmdHex =
      direction === "left"
        ? UNER_CMD_TRIGGER_ENCODER_ROTATE_LEFT
        : UNER_CMD_TRIGGER_ENCODER_ROTATE_RIGHT;

    const payload = buildEncoderRotatePayload(currentScreen.screenCode);

    dispatchUnerCommand(
      cmdHex,
      payload,
      direction === "left"
        ? "Emular giro físico del encoder hacia la izquierda"
        : "Emular giro físico del encoder hacia la derecha",
    );

    scheduleScreenRefresh();
  };

const handleValidatePin = async (pin: string) => {
  if (!currentScreen) {
    console.warn("[PIN] No hay currentScreen activa para validar");
    return false;
  }

  const ok = await validatePin(pin);

  console.log("[PIN][WEB->ESP] resultado validación", {
    pin,
    ok,
    screenCode:
      currentScreen.screenCodeHex ??
      formatScreenCodeHex(currentScreen.screenCode ?? 0),
  });

  if (!ok) {
    return false;
  }

  const payload = screenCodeToLeBytes(currentScreen.screenCode);

  dispatchUnerCommand(
    UNER_CMD_AUTH_PIN_GRANTED,
    payload,
    `Notificar a STM que el PIN fue validado para screen ${currentScreen.screenCodeHex ?? formatScreenCodeHex(currentScreen.screenCode)}`,
  );

  scheduleScreenRefresh();

  return true;
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

  return (
    <div className={`flex w-full flex-col ${isModal ? "min-h-[72vh]" : ""}`}>
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
                  className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition"
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
                  i
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
            className={`flex w-full gap-3 justify-center items-center flex-col lg:flex-row ${
              isModal ? "" : ""
            } `}
          >
            <div className="flex min-w-0 flex-col gap-3">
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

              <div className="flex flex-wrap items-stretch justify-between gap-3">
                <div className="flex flex-wrap items-stretch gap-3">
                  <ControlBlock title="Button">
                    <button
                      type="button"
                      onPointerDown={() => startAuxPress("user")}
                      onPointerUp={() => releaseAuxPress("user")}
                      onPointerCancel={() => cancelAuxPress("user")}
                      onPointerLeave={() => {
                        if (pressedAuxButton === "user") {
                          cancelAuxPress("user");
                        }
                      }}
                      onMouseEnter={() => setHoverUserBtn(true)}
                      onMouseLeave={() => setHoverUserBtn(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                      style={getWhiteAuxButtonStyle(
                        hoverUserBtn,
                        pressedAuxButton === "user",
                        longPressActive.user,
                      )}
                      disabled={!connected}
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
                  </ControlBlock>

                  <ControlBlock title="Encoder">
                    <button
                      type="button"
                      onPointerDown={() => startAuxPress("encoder")}
                      onPointerUp={() => releaseAuxPress("encoder")}
                      onPointerCancel={() => cancelAuxPress("encoder")}
                      onPointerLeave={() => {
                        if (pressedAuxButton === "encoder") {
                          cancelAuxPress("encoder");
                        }
                      }}
                      onMouseEnter={() => setHoverEncoderBtn(true)}
                      onMouseLeave={() => setHoverEncoderBtn(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                      style={getWhiteAuxButtonStyle(
                        hoverEncoderBtn,
                        pressedAuxButton === "encoder",
                        longPressActive.encoder,
                      )}
                      disabled={!connected}
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
                  </ControlBlock>
                </div>

                <ControlBlock title="Giro encoder">
                  <div className="flex flex-row items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEncoderRotate("left")}
                      onMouseEnter={() => setHoverRotateLeft(true)}
                      onMouseLeave={() => setHoverRotateLeft(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                      style={getAccentButtonStyle(
                        hoverRotateLeft,
                        pressedRotate === "left",
                      )}
                      disabled={!connected}
                      aria-label="Emular giro encoder izquierda"
                      title="Girar encoder a la izquierda"
                    >
                      <TurnArrowIcon direction="left" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEncoderRotate("right")}
                      onMouseEnter={() => setHoverRotateRight(true)}
                      onMouseLeave={() => setHoverRotateRight(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                      style={getAccentButtonStyle(
                        hoverRotateRight,
                        pressedRotate === "right",
                      )}
                      disabled={!connected}
                      aria-label="Emular giro encoder derecha"
                      title="Girar encoder a la derecha"
                    >
                      <TurnArrowIcon direction="right" />
                    </button>
                  </div>
                </ControlBlock>
              </div>
            </div>
            {isValidationScreen || screenHasMenuItems ? (            <div
              className="w-px self-stretch"
              style={{ background: "var(--ui-accent)" }}
            />) : null}

            {isValidationScreen ? (
              <div
                className="flex items-stretch gap-2"
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
                  </div>

                  <button
                    type="button"
                    className="w-full rounded-md border px-3 py-2 text-sm font-semibold transition"
                    style={getAccentButtonStyle(false, false)}
                    onClick={() => setOpenPinValidationModal(true)}
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
                  className="flex items-stretch gap-2"
                  style={{
                    height: `${previewHeight}px`,
                    minHeight: `${previewHeight}px`,
                  }}
                >
                  <div
                    className="flex flex-col items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 p-2"
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
                      disabled={!connected || visibleButtonsCount < 1}
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
                      disabled={!connected || visibleButtonsCount < 2}
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
                      disabled={!connected || visibleButtonsCount < 3}
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
                      disabled={!connected || currentPage <= 1}
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
                      disabled={!connected || currentPage >= totalPages}
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

      <div className="mb-4 flex w-full flex-row flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          className="w-fit rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => {
            dispatchUnerCommand(
              UNER_CMD_GET_CURRENT_SCREEN,
              [],
              "Solicitar snapshot actual de pantalla",
            );
            requestCurrentScreen();
          }}
          disabled={!connected}
          onMouseEnter={() => setHoverSync(true)}
          onMouseLeave={() => setHoverSync(false)}
          style={actionButtonStyle(hoverSync)}
        >
          Sincronizar pantalla
        </button>

        <button
          type="button"
          className="flex w-fit gap-x-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => {
            setOpenScreenDetails((value) => !value);
          }}
          style={actionButtonStyle(hoverSync2)}
          onMouseEnter={() => setHoverSync2(true)}
          onMouseLeave={() => setHoverSync2(false)}
        >
          <p>{openScreenDetails ? "Ocultar detalles" : "Mostrar detalles"}</p>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="flex size-4 items-center justify-center transition-transform duration-200"
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
      <PinScreenModal
        isOpen={openPinValidationModal}
        onClose={() => setOpenPinValidationModal(false)}
        title="Validar PIN"
        subtitle="Ingresá el PIN para validar esta acción."
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
        errorMessage="PIN inválido."
        loadingMessage="Validando..."
      />
    </div>
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
    <div className="flex min-w-[84px] flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {title}
      </span>
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
