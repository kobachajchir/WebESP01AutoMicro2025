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

const borderColorsByKind: Record<BlockKind, string> = {
  ramp: "!ring-amber-400",
  hold: "!ring-emerald-400",
  pivot: "!ring-sky-400",
  arc: "!ring-indigo-400",
  stop: "!ring-rose-400",
};

const bgByKind: Record<BlockKind, string> = {
  ramp: "bg-amber-500 text-white border-amber-300/70 shadow-[0_16px_36px_rgba(245,158,11,0.26)]",
  hold: "bg-emerald-500 text-white border-emerald-300/70 shadow-[0_16px_36px_rgba(16,185,129,0.26)]",
  pivot: "bg-sky-500 text-white border-sky-300/70 shadow-[0_16px_36px_rgba(14,165,233,0.26)]",
  arc: "bg-indigo-500 text-white border-indigo-300/70 shadow-[0_16px_36px_rgba(99,102,241,0.26)]",
  stop: "bg-rose-500 text-white border-rose-300/70 shadow-[0_16px_36px_rgba(244,63,94,0.26)]",
};

const outlineByKind: Record<BlockKind, string> = {
  ramp: "border-amber-300/45 bg-amber-500/10 text-amber-100",
  hold: "border-emerald-300/45 bg-emerald-500/10 text-emerald-100",
  pivot: "border-sky-300/45 bg-sky-500/10 text-sky-100",
  arc: "border-indigo-300/45 bg-indigo-500/10 text-indigo-100",
  stop: "border-rose-300/45 bg-rose-500/10 text-rose-100",
};

export default function MotorBlock({
  kind,
  selected = false,
  pairSelected = false,
  disabled = false,
  onClick,
}: Props) {
  const base =
    "group relative flex flex-col items-center justify-center rounded-md border px-4 py-5 text-slate-100 shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2";

  const tone = selected ? bgByKind[kind] : outlineByKind[kind];
  const hover = disabled
    ? ""
    : selected
      ? "hover:-translate-y-0.5 hover:brightness-105"
      : "hover:-translate-y-0.5 hover:bg-slate-900/85";

  const active = pairSelected && kind === "pivot"
    ? "shadow-[0_0_0_1px_rgba(255,255,255,0.24),0_0_0_4px_rgba(56,189,248,0.10)]"
    : "";

  const disabledCls = disabled
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer";

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className={`${base} ${tone} ${hover} ${active} ${disabledCls} ${borderColorsByKind[kind]}`}
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
