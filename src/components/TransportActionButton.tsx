import type { ReactNode } from "react";

export type TransportActionTone = "cyan" | "emerald" | "rose" | "muted";

type TransportActionButtonProps = {
  label: string;
  detail: string;
  icon: ReactNode;
  tone: TransportActionTone;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
};

export default function TransportActionButton({
  label,
  detail,
  icon,
  tone,
  active = false,
  disabled = false,
  className = "",
  onClick,
}: TransportActionButtonProps) {
  const toneClass = {
    cyan: active
      ? "border-cyan-300/70 bg-cyan-500/24 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.16)]"
      : "border-cyan-300/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/16",
    emerald: active
      ? "border-emerald-300/70 bg-emerald-500/24 text-emerald-50 shadow-[0_0_24px_rgba(16,185,129,0.16)]"
      : "border-emerald-300/35 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/16",
    rose: "border-rose-300/55 bg-rose-500/14 text-rose-100 hover:bg-rose-500/22",
    muted: "border-white/12 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]",
  }[tone];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`flex min-h-[76px] items-center gap-3 rounded-md border px-4 py-4 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${toneClass} ${className}`}
    >
      <span className="flex min-w-10 justify-center rounded-md border border-current/25 bg-black/15 px-2 py-1 text-sm font-black">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-white">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-current/75">{detail}</span>
      </span>
    </button>
  );
}
