import { useMemo, useState } from "react";
import { useScreen } from "../hooks/useScreen";
import { useWebSocket } from "../hooks/useWebSocket";
import { formatScreenCodeHex } from "../types/ScreenTypes";
import { resolveOledScreen } from "../screens";
import OledCommandPreview from "./OledCommandPreview";

export default function ScreenDashboardPanel() {
  let currentMenu = {
    itemsCount: 1,
  } 
  const { connected } = useWebSocket();
  const { currentScreen, requestCurrentScreen } = useScreen();
  const [hoverSync, setHoverSync] = useState(false);
  const [hoverSync2, setHoverSync2] = useState(false);
  const [hoverSync3, setHoverSync3] = useState(false);
  const [screenVisible, setScreenVisible] = useState(false);
  const [openScreenDetails, setOpenScreenDetails] = useState(false);
  const [screenHasMenuItems, setScreenHasMenuItems] = useState(true);
  const [selectedMenuItem, setSelectedMenuItem] = useState<number>(1);
  const [hoverMenuUp, setHoverMenuUp] = useState(false);
  const [hoverMenuDown, setHoverMenuDown] = useState(false);
  const currentMenuMaxItems = currentMenu?.itemsCount ?? 1;
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
    [currentScreen]
  );

  const sendCurrentMenuSelection = (item: number) => {
    // construir comando y mandarlo
  };

  const handleMenuScrollUp = () => {
    console.log("[Menu] Scroll up solicitado");

    // Acá después mandás el comando real al firmware
    // sendMenuScrollUp();
  };

  const handleMenuScrollDown = () => {
    console.log("[Menu] Scroll down solicitado");

    // Acá después mandás el comando real al firmware
    // sendMenuScrollDown();
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
    ? currentScreen.sourceName ?? `source ${currentScreen.source ?? "?"}`
    : "Sin source";
  const renderLabel = resolvedScreen
    ? `${resolvedScreen.category} / ${resolvedScreen.builder}`
    : "Sin builder resuelto";

  return (
    <section className="flex justify-center items-center flex-col w-full max-w-4xl overflow-hidden text-left">
      <div className="flex w-full md:w-1/3 flex-col p-3 justify-center items-center align-middle md:min-w-[18rem]">
        <div
          className="text-[10px] uppercase tracking-[0.24em] text-slate-200 my-2"
          style={{ alignSelf: "flex-start" }}
        >
          Visor
        </div>
        <button
          type="button"
          onClick={() => setScreenVisible((value) => !value)}
          className={`relative flex flex-col rounded-md border px-4 py-3 text-left transition-all duration-300 ${
            screenVisible
              ? "border-cyan-400/40 bg-cyan-500/15 text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]"
              : "border-white/10 bg-slate-950/50 text-slate-300 hover:border-cyan-400/30 hover:text-white"
          }`}
          aria-pressed={screenVisible}
        >
          <span className="text-[10px] uppercase tracking-[0.22em] text-slate-200">
            OLED STM
          </span>
          <span className="mt-2 block text-lg font-bold text-cyan-200">
            {screenVisible ? "Ocultar pantalla" : "Mostrar pantalla"}
          </span>
          <span className="mt-2 block text-sm text-slate-400">
            {screenVisible
              ? "El render del firmware esta visible."
              : "El estado sigue sincronizado en segundo plano."}
          </span>
        </button>
      </div>
      <section
        className={
          screenVisible
            ? "flex flex-col app-panel w-full max-w-4xl overflow-hidden p-4 text-left"
            : "hidden"
        }
      >
        <div className="flex flex-row gap-4">
          <div className="flex flex-col w-full gap-3 justify-center items-center">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div>
                  <h2 className="text-2xl font-black uppercase text-white">
                    Pantalla STM
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Render OLED vinculado al <code>screenCode</code> del bridge
                    JSON.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-row gap-4 items-center justify-center pb-4">
          {screenVisible ? (
            <div className="flex flex-row gap-x-2 items-center">
              <div className="flex flex-col col-auto">
                <div className="flex flex-wrap gap-2 my-2">
                  <span className="rounded-md bg-cyan-500/15 px-2 py-1 text-xs font-bold uppercase text-cyan-100 ring-1 ring-cyan-300/20">
                    {updateLabel}
                  </span>
                  {resolvedScreen ? (
                    <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-bold uppercase text-emerald-100 ring-1 ring-emerald-300/20">
                      Render OK
                    </span>
                  ) : null}
                  {!screenVisible ? (
                    <span className="rounded-md bg-slate-500/15 px-2 py-1 text-xs font-bold uppercase text-slate-200 ring-1 ring-white/10">
                      OLED oculto
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col my-2">
                  <p className="text-xl font-black text-white">{screenLabel}</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {resolvedScreen?.description ??
                      "Esperando screen.current o screen.changed para resolver el builder OLED."}
                  </p>
                </div>
                {screenHasMenuItems && (
                  <div className="flex flex-row col-auto app-panel-strong p-4">
                    <p className="text-xs text-slate-400">
                      Podes enviar la selección del menú actual
                    </p>

                    <div className="flex flex-row col-auto items-end gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-white">
                          Item actual (1 - {currentMenuMaxItems})
                        </label>

                        <input
                          type="number"
                          min={1}
                          max={currentMenuMaxItems}
                          step={1}
                          inputMode="numeric"
                          value={selectedMenuItem}
                          onChange={(e) => {
                            const value = e.target.value;

                            if (value === "") {
                              setSelectedMenuItem("");
                              return;
                            }

                            const numericValue = Number(value);

                            if (Number.isNaN(numericValue)) {
                              return;
                            }

                            const clampedValue = Math.min(
                              currentMenuMaxItems,
                              Math.max(1, numericValue),
                            );

                            setSelectedMenuItem(String(clampedValue));
                          }}
                          onBlur={() => {
                            if (selectedMenuItem === "") {
                              setSelectedMenuItem("1");
                              return;
                            }

                            const numericValue = Number(selectedMenuItem);
                            const clampedValue = Math.min(
                              currentMenuMaxItems,
                              Math.max(1, numericValue),
                            );

                            setSelectedMenuItem(String(clampedValue));
                          }}
                          className="w-24 rounded-md border px-3 py-1.5 text-xs outline-none"
                          style={{
                            borderColor: "rgba(34,211,238,0.3)",
                            background: "transparent",
                            color: "var(--color-text-primary)",
                          }}
                          disabled={!connected}
                        />
                      </div>

                      <button
                        type="button"
                        className="w-fit rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => {
                          const itemToSend = Math.min(
                            currentMenuMaxItems,
                            Math.max(1, Number(selectedMenuItem) || 1),
                          );
                          sendCurrentMenuSelection(itemToSend);
                        }}
                        disabled={!connected}
                        onMouseEnter={() => setHoverSync3(true)}
                        onMouseLeave={() => setHoverSync3(false)}
                        style={
                          hoverSync3
                            ? ({
                                background: "var(--ui-accent)",
                                color: "var(--ui-action-hover-ink)",
                                borderColor: "var(--ui-accent)",
                              } as React.CSSProperties)
                            : ({
                                borderColor: "rgba(34,211,238,0.3)",
                                color: "var(--ui-accent)",
                              } as React.CSSProperties)
                        }
                      >
                        Enviar selección
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-row col-auto mx-8">
                <div className="flex flex-col col-auto mx-8">
                  <div className="text-xs font-semibold uppercase text-slate-400 my-2">
                    OLED render
                  </div>
                  {resolvedScreen ? (
                    <OledCommandPreview commands={resolvedScreen.commands} />
                  ) : (
                    <div className="flex aspect-[2/1] w-full items-center justify-center rounded-md border border-cyan-300/30 bg-slate-950 px-4 text-center text-xs text-slate-400">
                      Sin comandos para renderizar.
                    </div>
                  )}
                  <p className="text-xs text-slate-400 my-2">
                    Renderizado desde <code>src/screens</code> usando{" "}
                    <code>screenCode</code> como identidad.
                  </p>
                </div>
                {screenHasMenuItems && (
                  <div className="flex flex-col items-center gap-2 justify-center col-auto">
                    <button
                      type="button"
                      onClick={handleMenuScrollUp}
                      onMouseEnter={() => setHoverMenuUp(true)}
                      onMouseLeave={() => setHoverMenuUp(false)}
                      className="flex h-9 w-9 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40"
                      style={
                        hoverMenuUp
                          ? ({
                              background: "var(--ui-accent)",
                              color: "var(--ui-action-hover-ink)",
                              borderColor: "var(--ui-accent)",
                            } as React.CSSProperties)
                          : ({
                              borderColor: "rgba(34,211,238,0.3)",
                              color: "var(--ui-accent)",
                              background: "transparent",
                            } as React.CSSProperties)
                      }
                      aria-label="Scroll menu up"
                      title="Subir en el menú"
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
                      onClick={handleMenuScrollDown}
                      onMouseEnter={() => setHoverMenuDown(true)}
                      onMouseLeave={() => setHoverMenuDown(false)}
                      className="flex h-9 w-9 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40"
                      style={
                        hoverMenuDown
                          ? ({
                              background: "var(--ui-accent)",
                              color: "var(--ui-action-hover-ink)",
                              borderColor: "var(--ui-accent)",
                            } as React.CSSProperties)
                          : ({
                              borderColor: "rgba(34,211,238,0.3)",
                              color: "var(--ui-accent)",
                              background: "transparent",
                            } as React.CSSProperties)
                      }
                      aria-label="Scroll menu down"
                      title="Bajar en el menú"
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
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-row w-full items-center justify-center mb-4 gap-4 ">
          <button
            type="button"
            className="w-fit rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            onClick={requestCurrentScreen}
            disabled={!connected}
            onMouseEnter={() => setHoverSync(true)}
            onMouseLeave={() => setHoverSync(false)}
            style={
              hoverSync
                ? ({
                    background: "var(--ui-accent)",
                    color: "var(--ui-action-hover-ink)",
                    borderColor: "var(--ui-accent)",
                  } as React.CSSProperties)
                : ({
                    borderColor: "rgba(34,211,238,0.3)",
                    color: "var(--ui-accent)",
                  } as React.CSSProperties)
            }
          >
            Sincronizar pantalla
          </button>
          <button
            type="button"
            className="flex w-fit gap-x-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              setOpenScreenDetails((value) => !value);
            }}
            style={
              hoverSync2
                ? ({
                    background: "var(--ui-accent)",
                    color: "var(--ui-action-hover-ink)",
                    borderColor: "var(--ui-accent)",
                  } as React.CSSProperties)
                : ({
                    borderColor: "rgba(34,211,238,0.3)",
                    color: "var(--ui-accent)",
                  } as React.CSSProperties)
            }
            onMouseEnter={() => setHoverSync2(true)}
            onMouseLeave={() => setHoverSync2(false)}
          >
            <p>{openScreenDetails ? "Ocultar detalles" : "Mostrar detalles"}</p>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="flex size-4 transition-transform duration-200 items-center justify-center"
              style={{
                transform: openScreenDetails
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
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
          <div className="flex flex-row gap-4 ">
            <div className="flex flex-col w-full gap-3 justify-center items-center rounded-xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex flex-wrap gap-2 text-xs text-slate-300 grid-cols-1 md:grid-cols-3 justify-center items-center">
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
      </section>
    </section>
  );
}

function ScreenFact({
  label,
  value,
  wide = false,
  styles = ""
}: {
  label: string;
  value: string;
  wide?: boolean;
  styles?: string;
}) {
  return (
  <div className={`${wide ? "sm:col-span-2" : undefined} ${styles}`}>
      <span className="block font-semibold uppercase text-slate-500">{label}</span>
      <span className="break-words font-mono text-slate-100">{value}</span>
    </div>
  );
}

function formatPayload(payload: number[] | undefined) {
  return payload?.length
    ? payload.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ")
    : "sin payload";
}
