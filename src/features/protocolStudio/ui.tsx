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
    <section className={`${PANEL_CLASS} studio-panel ${className}`}>
      <div className="studio-panel-heading">
        <h2 className="studio-panel-title">
          {title}
        </h2>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

export function InfoCell({ label, value, tone = "cyan", className = "" }: InfoCellProps) {
  return (
    <div className={`studio-info-cell studio-info-cell--${tone} ${className}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-text)]">{label}</div>
      <div className={"studio-info-value"}>{value}</div>
    </div>
  );
}

export function DetailItem({ label, value, className = "" }: DetailItemProps) {
  return (
    <div className={`studio-detail-item ${className}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-text)]">{label}</div>
      <div className="mt-2 break-words font-mono text-sm text-[var(--ui-text)]">{value}</div>
    </div>
  );
}

export function StatusPill({ tone, children }: StatusPillProps) {
  return (
    <span className={`studio-status studio-status--${tone}`}>
      {children}
    </span>
  );
}

export function ColoredFrame({ bytes }: { bytes: number[] }) {
  if (!bytes.length) return <p className="studio-caption">Todavía no hay un paquete para mostrar.</p>;
  const role = (index: number) => index < 4 ? "header" : index < 7 ? "meta" : index === 7 ? "route" : index === 8 ? "command" : index === bytes.length - 1 ? "checksum" : "payload";
  return (
    <div className="studio-byte-stream" tabIndex={0} aria-label="Bytes del paquete, en orden">
      {bytes.map((byte, index) => (
        <span key={index} className={`studio-byte studio-byte--${role(index)}`} title={`Byte ${index}: ${h2(byte)}`}>
          {h2(byte)}
        </span>
      ))}
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
