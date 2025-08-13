import { useEffect } from "react";

export type BlockKind = "ramp" | "hold" | "pivot" | "arc" | "stop";

interface Props {
  kind: BlockKind;
  selected?: boolean;
  /** Si el par del pivot está seleccionado en la timeline */
  pairSelected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

const labelES: Record<BlockKind, string> = {
  ramp: "RAMPA",
  hold: "CONSTANTE",
  pivot: "PIVOTE",
  arc: "CURVA",
  stop: "DETENER",
};

const bgByKind: Record<BlockKind, string> = {
  ramp: "!bg-amber-500/80",
  hold: "!bg-emerald-500/80",
  pivot: "!bg-sky-500/80",
  arc: "!bg-indigo-500/80",
  stop: "!bg-rose-500/80",
};

const hoverByKind: Record<BlockKind, string> = {
  ramp: "hover:" + bgByKind["ramp"],
  hold: "hover:" + bgByKind["hold"],
  pivot: "hover:" + bgByKind["pivot"],
  arc: "hover:" + bgByKind["arc"],
  stop: "hover:" + bgByKind["stop"],
};

export default function MotorBlock({
  kind,
  selected = false,
  pairSelected = false,
  disabled = false,
  onClick,
}: Props) {
  const base =
    "group relative flex flex-col items-center justify-center rounded-2xl px-4 py-5 " +
    `${
      !selected ? "bg-white/10" : bgByKind[kind]
    } text-slate-100 ring-1 ring-white/10 shadow-sm transition-all duration-300 ` +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40";

  const hover =
    "hover:text-slate-900 hover:shadow-[inset_0_0_0_1px_theme('colors.cyan.400')] hover:-translate-y-1";

  const active = selected
    ? "border-4 border-cyan-400/20"
    : pairSelected && kind === "pivot"
    ? "outline outline-4 outline-white outline-offset-2 ring-2 ring-white/50"
    : "";

  const disabledCls = disabled
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer";

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className={`${base} ${hover} ${active} ${disabledCls} ${hoverByKind[kind]}`}
      aria-pressed={selected}
      aria-selected={selected}
      aria-label={labelES[kind]}
      data-kind={kind}
      data-pairselected={pairSelected ? "true" : "false"}
      title={labelES[kind]}
    >
      {/* Ícono */}
      <div className="mb-3 flex items-center justify-center">
        {kind === "ramp" && (
          // Ícono genérico de rampa (triángulo). La forma real se pinta en TimelineRow.
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor">
            <path d="M4 18h16L4 6v12Z" />
          </svg>
        )}

        {kind === "hold" && (
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor">
            <rect x="4" y="8" width="16" height="8" rx="2" />
          </svg>
        )}

        {kind === "pivot" && (
          <svg
            viewBox="0 0 24 24"
            className="h-10 w-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="7" />
          </svg>
        )}

        {kind === "arc" && (
          <svg
            viewBox="0 0 24 24"
            className="h-10 w-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 16c6-10 10-10 16 0" strokeLinecap="round" />
          </svg>
        )}

        {kind === "stop" && (
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor">
            <rect x="7" y="7" width="10" height="10" rx="2" />
          </svg>
        )}
      </div>

      {/* Etiqueta */}
      <div className="text-sm font-semibold tracking-wide">{labelES[kind]}</div>
    </button>
  );
}
