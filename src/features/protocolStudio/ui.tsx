import type { ReactNode } from "react";
import { PANEL_CLASS } from "./catalog";
import { h2 } from "./utils";
import type { ValidationItem } from "./types";

interface PanelProps {
  title: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
}

interface InfoCellProps {
  label: string;
  value: string;
  tone?: "cyan" | "emerald" | "violet" | "rose";
  className?: string;
}

interface DetailItemProps {
  label: string;
  value: string;
  className?: string;
}

interface StatusPillProps {
  tone: "ok" | "warn" | "bad";
  children: ReactNode;
}

export function Panel({ title, children, className = "", headerRight }: PanelProps) {
  return (
    <section className={`${PANEL_CLASS} ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--ui-text)]">
          {title}
        </h2>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

export function InfoCell({ label, value, tone = "cyan", className = "" }: InfoCellProps) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "violet"
      ? "text-violet-300"
      : tone === "rose"
      ? "text-rose-300"
      : "text-cyan-300";

  return (
    <div className={`rounded-xl border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/50 p-3 text-center ${className}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-text)]">{label}</div>
      <div className={`mt-1 font-mono text-sm font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

export function DetailItem({ label, value, className = "" }: DetailItemProps) {
  return (
    <div className={`rounded-xl border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/50 p-3 ${className}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-text)]">{label}</div>
      <div className="mt-2 break-words font-mono text-sm text-[var(--ui-text)]">{value}</div>
    </div>
  );
}

export function StatusPill({ tone, children }: StatusPillProps) {
  const className =
    tone === "ok"
      ? "border border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
      : tone === "bad"
      ? "border border-rose-400/30 bg-rose-500/15 text-rose-200"
      : "border border-amber-400/30 bg-amber-500/15 text-amber-200";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${className}`}>
      {children}
    </span>
  );
}

export function ColoredFrame({ bytes }: { bytes: number[] }) {
  if (bytes.length === 0) {
    return <p className="text-sm text-[var(--ui-text)]">Sin frame para mostrar.</p>;
  }

  return (
    <div className="flex min-h-14 flex-wrap items-center gap-2 rounded-xl border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/50 p-3">
      {bytes.map((byte, index) => {
        let colorClass = "bg-[var(--ui-panel)] text-[var(--ui-muted)] ring-[var(--ui-ring)]";

        if (index < 4) {
          colorClass = "bg-cyan-500/15 text-cyan-200 ring-cyan-400/20";
        } else if (index === 4) {
          colorClass = "bg-emerald-500/15 text-emerald-200 ring-emerald-400/20";
        } else if (index === 5 || index === 6) {
          colorClass = "bg-amber-500/15 text-amber-200 ring-amber-400/20";
        } else if (index === 7) {
          colorClass = "bg-violet-500/15 text-violet-200 ring-violet-400/20";
        } else if (index === 8) {
          colorClass = "bg-rose-500/15 text-rose-200 ring-rose-400/20";
        } else if (index === bytes.length - 1) {
          colorClass = "bg-[var(--ui-panel)] text-[var(--ui-muted)] ring-[var(--ui-ring)]";
        } else {
          colorClass = "bg-sky-500/15 text-sky-200 ring-sky-400/20";
        }

        return (
          <span
            key={`${byte}-${index}`}
            title={`Pos ${index}`}
            className={`inline-flex min-w-9 items-center justify-center rounded-md px-2 py-1 font-mono text-xs font-semibold ring-1 ${colorClass}`}
          >
            {h2(byte)}
          </span>
        );
      })}
    </div>
  );
}

export function ValidationRow({ item }: { item: ValidationItem }) {
  const icon = item.tone === "ok" ? "OK" : item.tone === "warn" ? "!" : "X";
  const textClass =
    item.tone === "ok" ? "text-emerald-300" : item.tone === "warn" ? "text-amber-300" : "text-rose-300";

  return (
    <div className="rounded-xl border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/50 p-3 text-sm text-[var(--ui-text)]">
      <span className={`mr-2 inline-flex min-w-6 justify-center font-bold ${textClass}`}>{icon}</span>
      <span>{item.message}</span>
    </div>
  );
}
