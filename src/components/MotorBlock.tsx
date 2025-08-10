// src/components/MotorBlock.tsx
export type BlockKind = "ramp" | "hold" | "pivot" | "arc" | "stop";

interface Props {
  kind: BlockKind;
  selected?: boolean; // Cambiado: ahora es boolean para indicar si está seleccionado
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

export default function MotorBlock({
  kind,
  selected = false,
  disabled,
  onClick,
}: Props) {
  const base =
    "group relative flex flex-col items-center justify-center rounded-2xl px-4 py-5 " +
    "bg-white/10 text-slate-100 ring-1 ring-white/10 shadow-sm transition-all duration-300 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40";

  const hover =
    "hover:bg-white hover:text-slate-900 hover:shadow-[inset_0_0_0_1px_theme('colors.cyan.400')] hover:-translate-y-1";

  const active = selected
    ? "border-cyan-400 border-4"
    : "";

  const disabledCls = disabled
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer";

  return (
    <button
      type="button"
      className={`${base} ${hover} ${active} ${disabledCls}`}
      onClick={disabled ? undefined : onClick}
      aria-pressed={selected}
      aria-label={labelES[kind]}
    >
      {/* Ícono */}
      <div className="mb-3 flex items-center justify-center">
        {kind === "ramp" && (
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
