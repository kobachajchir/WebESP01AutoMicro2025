// src/components/TimelineRow.tsx
import type { Block, TrackKey } from "../types/MotorTypes";
import type { BlockKind } from "./MotorBlock";

interface TimelineRowProps {
  title: string;
  track: TrackKey;
  blocks: Block[];
  totalMs: number;
  kindColor: Record<BlockKind, string>;
  activeIndex: number;
  activeProgress: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** IDs a resaltar (ej: par de pivot en el otro track) */
  highlightIds?: string[];
}

// Formas por tipo
function getBlockStyles(block: Block) {
  switch (block.kind) {
    case "ramp": {
      const rampSteepness = Math.min(
        Math.max(block.durationMs / 2000, 0.2),
        0.8
      );
      const rampEndPoint = 20 + rampSteepness * 60; // 20%..80%
      return {
        clipPath: `polygon(0% 100%, ${rampEndPoint}% 0%, 100% 100%)`,
        borderRadius: "0.75rem 0.75rem 0 0", // radios solo arriba
        height: "100%", // <<< importante
      } as React.CSSProperties;
    }
    case "arc": {
      const arcIntensity = block.speed ? Math.min(block.speed / 100, 1) : 0.7;
      const borderRadiusValue = `${50 + arcIntensity * 50}% ${
        50 + arcIntensity * 50
      }% 20% 20%`;
      return {
        borderRadius: borderRadiusValue,
        clipPath: "none",
        height: "100%", // <<< importante
      } as React.CSSProperties;
    }
    case "hold": {
      const constantHeight = block.speed
        ? Math.max(block.speed / 100, 0.3)
        : 0.8;
      return {
        clipPath: "none",
        borderRadius: "0.75rem 0.75rem 0 0", // radios solo arriba
        height: `${constantHeight * 100}%`,
        marginTop: `${(1 - constantHeight) * 100}%`,
      } as React.CSSProperties;
    }
    case "stop": {
      return {
        clipPath: "none",
        borderRadius: "0.25rem",
        height: "8px",
        marginTop: "calc(100% - 8px)",
        opacity: 0.3,
      } as React.CSSProperties;
    }
    default:
      return {
        clipPath: "none",
        borderRadius: "0.75rem 0.75rem 0 0", // radios solo arriba
        height: "100%", // <<< importante
      } as React.CSSProperties;
  }
}

function TimelineRow({
  title,
  track,
  blocks,
  totalMs,
  kindColor,
  activeIndex,
  activeProgress,
  selectedId,
  onSelect,
  highlightIds = [],
}: TimelineRowProps) {
  return (
    <div className="w-full overflow-x-auto items-center flex flex-row gap-4 mb-2">
      <div className="items-center flex flex-col gap-1">
        {track === "left" ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 169.53 169.53"
            className="size-8"
          >
            <circle
              cx="84.77"
              cy="84.77"
              r="84.77"
              className="fill-indigo-600"
            />
            <path
              className="fill-white"
              d="M88.43,72.68v20.17c0,4.54.4,7.47,1.19,8.79.97,1.55,3,2.33,6.11,2.33,3.34,0,5.98-.73,7.91-2.2s3.28-3.75,4.04-6.86c.44-1.9,1.44-2.86,2.99-2.86s2.82.7,3.8,2.09c.98,1.39,1.47,3.2,1.47,5.43,0,3.63-1.35,7.51-4.04,11.65-.85,1.32-1.6,2.22-2.24,2.7-.64.48-1.42.73-2.33.73l-9.76-1.19h-30.72c-2.02,0-3.44-.23-4.26-.7-1.2-.67-1.8-1.68-1.8-3.03,0-.82.2-1.43.59-1.82.4-.4,1.35-.96,2.88-1.69,1.67-.79,2.74-1.9,3.21-3.34.38-1.2.57-4.7.57-10.5,0-2.7-.07-6.58-.22-11.65-.15-4.86-.23-8.53-.26-10.99,0-2.34-.18-3.95-.55-4.81-.37-.86-1.14-1.49-2.31-1.87-1.93-.67-3.16-1.22-3.69-1.63-.94-.73-1.41-1.57-1.41-2.5,0-2.14,1.77-3.76,5.32-4.88,3.02-.97,7.06-1.45,12.13-1.45,5.68,0,9.93.29,12.74.88,3.63.79,5.45,2.37,5.45,4.75,0,.97-.24,1.68-.72,2.15-.48.47-1.66,1.1-3.54,1.89-1.11.5-1.82,1.35-2.11,2.55s-.44,3.82-.44,7.87Z"
            />
          </svg>
        ) : track === "right" ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 169.53 169.53"
            className="size-8"
          >
            <circle
              cx="84.77"
              cy="84.77"
              r="84.77"
              className="fill-indigo-600"
            />
            <path
              className="fill-white"
              d="M83.77,88.48c-1.11,0-1.82.34-2.13,1.01-.31.67-.46,2.24-.46,4.7,0,3.72.23,6.62.7,8.7.15.59.37,1.04.66,1.36s.85.72,1.67,1.19c1.76.97,2.64,2.24,2.64,3.82,0,1.93-1.22,3.3-3.67,4.11-2.45.81-6.58,1.21-12.41,1.21-10.84,0-16.26-2.05-16.26-6.15,0-.7.16-1.27.48-1.69.32-.42,1.05-1.02,2.2-1.78,1.29-.85,2.16-1.85,2.61-3.01.45-1.16.77-3.16.94-6,.15-2.08.22-9.54.22-22.37,0-4.07-.21-6.84-.62-8.31-.41-1.46-1.29-2.53-2.64-3.21-1.29-.62-2.15-1.18-2.59-1.69-.44-.51-.66-1.18-.66-2,0-1.08.42-2.03,1.25-2.83.83-.8,2-1.4,3.49-1.78,1.26-.32,2.99-.48,5.19-.48.97,0,3.38.15,7.25.44.73.06,1.89.09,3.47.09,2.64,0,6.15-.18,10.55-.53,2.78-.21,4.73-.31,5.85-.31,6.27,0,11.46,1.51,15.56,4.53,3.69,2.72,5.54,6.5,5.54,11.34,0,2.7-.64,5.15-1.93,7.36-1.29,2.21-3.06,3.88-5.32,4.99-.94.47-1.41,1.03-1.41,1.67,0,.85.72,1.54,2.15,2.07,3.08,1.11,5.33,2.8,6.77,5.05s2.46,5.71,3.08,10.37c.26,1.93.64,3.19,1.14,3.76.5.57,1.65,1.12,3.47,1.65.56.18,1.03.55,1.41,1.12.38.57.57,1.21.57,1.91,0,.91-.35,1.82-1.05,2.75-.7.92-1.61,1.65-2.72,2.18-2.46,1.14-5.83,1.71-10.11,1.71-5.71,0-9.8-1.51-12.26-4.53-1.11-1.35-2.06-3.05-2.83-5.1-.78-2.05-1.69-5.24-2.75-9.58-.67-2.78-1.53-4.75-2.57-5.89-1.04-1.14-2.53-1.76-4.46-1.85ZM81.22,66.07l-.48,10.24v.4c0,1.05.15,1.76.46,2.11.31.35.93.53,1.87.53,2.58,0,4.45-.67,5.62-2,1.17-1.33,1.76-3.46,1.76-6.39,0-5.65-2.01-8.48-6.02-8.48-1.14,0-1.95.26-2.42.79s-.73,1.46-.79,2.81Z"
            />
          </svg>
        ) : null}

        <span className="w-28 text-center text-lg text-slate-200 uppercase font-semibold">
          {title}
        </span>
      </div>

      <div className="relative w-full h-28 flex items-end gap-2">
        {blocks.map((b, i) => {
          const w = `${(Math.max(0, b.durationMs) / totalMs) * 100}%`;
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          const isSelected = selectedId === b.id;
          const isHighlighted = highlightIds.includes(b.id);

          const fill = isPast
            ? 1
            : isActive
            ? Math.max(0, Math.min(1, activeProgress))
            : 0;

          return (
            <div
              key={b.id}
              className="flex flex-col justify-between h-full"
              style={{ width: w, minWidth: 56 }}
            >
              {/* Cabecera */}
              <div className="flex flex-col items-center mb-1">
                <div className="text-xs text-slate-300">{b.label}</div>
                <div className="text-[11px] text-slate-400">
                  {b.durationMs} ms
                </div>
              </div>

              {/* Bloque */}
              <div className="relative h-16 flex items-end">
                <button
                  onClick={() => onSelect(isSelected ? null : b.id)}
                  className={`w-full h-full ${
                    kindColor[b.kind]
                  } ring-1 ring-white/10 shadow-sm
                              transition-all duration-300 hover:-translate-y-1
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40
                              ${isActive ? "shadow-md" : ""}
                              ${isSelected ? "bg-white !text-slate-900" : ""}
                              ${
                                isHighlighted
                                  ? "outline outline-4 outline-amber-400 outline-offset-2 ring-2 ring-amber-400/50"
                                  : ""
                              }`}
                  style={getBlockStyles(b)}
                  title={`${b.kind} (${b.durationMs} ms)`}
                  aria-pressed={isSelected}
                >
                  {isActive && b.kind !== "stop" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                    </div>
                  )}
                </button>

                {isActive && (
                  <span className="absolute -top-2 right-2 text-[10px] px-2 py-[2px] rounded-full bg-yellow-400 text-slate-900 font-bold">
                    ACTIVO
                  </span>
                )}
              </div>

              {/* Progreso */}
              <div className="mt-1 h-2 w-full rounded-full bg-white/10 ring-1 ring-white/10 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isActive ? "bg-yellow-400" : "bg-cyan-400"
                  }`}
                  style={{ width: `${fill * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TimelineRow;
