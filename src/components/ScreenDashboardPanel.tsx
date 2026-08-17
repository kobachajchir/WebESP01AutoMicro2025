// ScreenDashboardPanel.tsx
import { useState, useEffect } from "react";
import ScreenStreamWorkspace from "./ScreenStreamWorkspace";

interface ScreenDashboardPanelProps {
 compact?: boolean;
}

export default function ScreenDashboardPanel({
 compact = false,
}: ScreenDashboardPanelProps) {
 const [screenVisible, setScreenVisible] = useState(false);
 const [hovered, setHovered] = useState(false);
 const [accentBorder30, setAccentBorder30] = useState<string>(
 "rgba(34,211,238,0.3)",
 );

 useEffect(() => {
 try {
 const raw =
 getComputedStyle(document.documentElement).getPropertyValue(
 "--ui-accent",
 ) || "#22d3ee";
 const hex = raw.trim();
 const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
 if (m) {
 const hh = m[1];
 const r = parseInt(hh.slice(0, 2), 16);
 const g = parseInt(hh.slice(2, 4), 16);
 const b = parseInt(hh.slice(4, 6), 16);
 setAccentBorder30(`rgba(${r}, ${g}, ${b}, 0.3)`);
 }
 } catch {
 // ignore
 }
 }, []);

 return (
 <section
 className={
 compact
 ? "screen-dashboard screen-dashboard--compact"
 : "screen-dashboard screen-dashboard--embedded flex w-full max-w-4xl flex-col items-center justify-center overflow-hidden text-left"
 }
 >
 <div
 className={
 compact
 ? "screen-dashboard__control"
 : "flex w-full flex-col items-center justify-center p-3 align-middle md:min-w-[18rem] md:w-1/3"
 }
 >
 {!compact ? (
 <div
 className="my-2 text-[10px] uppercase tracking-[0.24em] text-[var(--ui-text)]"
 style={{ alignSelf: "flex-start" }}
 >
 Visor
 </div>
 ) : null}

 <button
 type="button"
 onClick={() => setScreenVisible((value) => !value)}
 onMouseEnter={() => setHovered(true)}
 onMouseLeave={() => setHovered(false)}
 className={
 compact
 ? `screen-dashboard__trigger ${
 screenVisible || hovered ? "screen-dashboard__trigger--active" : ""
 }`
 : "screen-dashboard__trigger screen-dashboard__trigger--embedded relative flex flex-col rounded-md border px-4 py-3 text-left transition-all duration-300"
 }
 style={
 compact
 ? undefined
 : screenVisible || hovered
 ? ({
 borderColor: "white",
 color: "white",
 borderStyle: "solid",
 borderWidth: "2px",
 } as React.CSSProperties)
 : ({
 borderColor: accentBorder30,
 color: "var(--ui-accent)",
 borderStyle: "solid",
 borderWidth: "2px",
 } as React.CSSProperties)
 }
 aria-pressed={screenVisible}
 >
 <span className="screen-dashboard__eyebrow">
 OLED STM
 </span>

 <span className="screen-dashboard__title">
 {screenVisible ? "Ocultar visor" : "Abrir visor"}
 </span>

 <span
 className={
 compact
 ? "screen-dashboard__hint"
 : "mt-2 block text-sm text-[var(--ui-text)]"
 }
 >
 {screenVisible
 ? "El render del firmware está visible."
 : "El estado sigue sincronizado en segundo plano."}
 </span>
 </button>
 </div>

 <section
 className={
 screenVisible
 ? compact
 ? "screen-dashboard__workspace app-panel"
 : "app-panel flex w-full max-w-4xl flex-col overflow-hidden p-4 text-left"
 : "hidden"
 }
 >
 <ScreenStreamWorkspace />
 </section>
 </section>
 );
}
