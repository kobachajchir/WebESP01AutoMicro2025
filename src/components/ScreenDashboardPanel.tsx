// ScreenDashboardPanel.tsx
import { useState, useEffect } from "react";
import ScreenStreamWorkspace from "./ScreenStreamWorkspace";

export default function ScreenDashboardPanel() {
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
    } catch (e) {
      // ignore
    }
  }, []);

  return (
    <section className="flex w-full max-w-4xl flex-col items-center justify-center overflow-hidden text-left">
      <div className="flex w-full flex-col items-center justify-center p-3 align-middle md:min-w-[18rem] md:w-1/3">
        <div
          className="my-2 text-[10px] uppercase tracking-[0.24em] text-slate-200"
          style={{ alignSelf: "flex-start" }}
        >
          Visor
        </div>

        <button
          type="button"
          onClick={() => setScreenVisible((value) => !value)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`relative flex flex-col rounded-md border px-4 py-3 text-left transition-all duration-300`}
          style={
            screenVisible || hovered
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
          <span className="text-[10px] uppercase tracking-[0.22em] text-white">
            OLED STM
          </span>

          <span className="mt-2 block text-lg font-bold text-white">
            {screenVisible ? "Ocultar pantalla" : "Mostrar pantalla"}
          </span>

          <span className="mt-2 block text-sm text-white">
            {screenVisible
              ? "El render del firmware está visible."
              : "El estado sigue sincronizado en segundo plano."}
          </span>
        </button>
      </div>

      <section
        className={
          screenVisible
            ? "app-panel flex w-full max-w-4xl flex-col overflow-hidden p-4 text-left"
            : "hidden"
        }
      >
        <ScreenStreamWorkspace />
      </section>
    </section>
  );
}
