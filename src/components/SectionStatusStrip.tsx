export type SectionStatusTone = "ok" | "error" | "info" | "warn" | "muted";

export type SectionStatusItem = {
  label: string;
  value: string;
  detail?: string;
  tone?: SectionStatusTone;
  title?: string;
};

type SectionStatusStripProps = {
  ariaLabel: string;
  items: SectionStatusItem[];
  className?: string;
};

export default function SectionStatusStrip({
  ariaLabel,
  items,
  className = "",
}: SectionStatusStripProps) {
  return (
    <section
      className={`section-status-strip ${className}`.trim()}
      aria-label={ariaLabel}
    >
      {items.map(({ label, value, detail, tone = "muted", title }) => (
        <div
          key={`${label}-${value}`}
          className={`section-status-row section-status-row--${tone}`}
          title={title}
        >
          <span
            className={`home-status-dot home-status-dot--${
              tone === "warn" ? "info" : tone
            }`}
            aria-hidden="true"
          />
          <span className="section-status-row__label">{label}</span>
          <span className="section-status-row__valueWrap">
            <strong className="section-status-row__value">{value}</strong>
            {detail ? <small className="section-status-row__detail">{detail}</small> : null}
          </span>
        </div>
      ))}
    </section>
  );
}
