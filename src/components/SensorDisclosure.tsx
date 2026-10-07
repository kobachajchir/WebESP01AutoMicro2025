import { useEffect, useId, useState, type ReactNode } from "react";

export default function SensorDisclosure({ title, icon, titleAccessory, headerActions, detail, className = "", defaultExpanded = false, disabled = false, disabledDescription, children }: {
  title: string;
  icon?: ReactNode;
  titleAccessory?: ReactNode;
  headerActions?: ReactNode;
  detail?: string;
  className?: string;
  defaultExpanded?: boolean;
  disabled?: boolean;
  disabledDescription?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = useId();
  const headingId = useId();
  const disabledDescriptionId = useId();
  const isExpanded = expanded && !disabled;
  useEffect(() => {
    if (disabled) setExpanded(false);
  }, [disabled]);
  return <section className={`sensor-console-group sensor-disclosure ${className}`} aria-labelledby={headingId}>
    <header className="sensor-console-group__header">
      <div className="sensor-disclosure__title">
        {icon}<h3 id={headingId}>{title}</h3>{titleAccessory}
      </div>
      <div className="sensor-console-group__header-actions">
        {headerActions}
        {detail ? <span className="sensor-console-group__state sensor-tone-info">{detail}</span> : null}
        <button type="button" className="sensor-console-group__collapse"
          disabled={disabled}
          aria-describedby={disabled && disabledDescription ? disabledDescriptionId : undefined}
          aria-expanded={isExpanded} aria-controls={contentId}
          aria-label={`${isExpanded ? "Contraer" : "Expandir"} ${title.toLowerCase()}`}
          onClick={() => setExpanded((value) => !value)}>
          <svg className={`home-dropdown-chevron ${isExpanded ? "home-dropdown-chevron--open" : ""}`}
            viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>
    </header>
    {disabled && disabledDescription ? <p id={disabledDescriptionId} className="sensor-disclosure__unavailable" role="status">{disabledDescription}</p> : null}
    <div id={contentId} className="sensor-disclosure__body" hidden={!isExpanded}>{children}</div>
  </section>;
}
