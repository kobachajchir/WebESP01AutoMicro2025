import { useId } from "react";
import "./ConditionStatus.css";

export function ConditionCheckbox({ checked }: { checked: boolean }) {
  return <span className="condition-checkbox" data-checked={checked} aria-hidden="true">
    <svg viewBox="0 0 20 20" fill="none">
      <path d="m4.5 10 3.5 3.5 7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>;
}

export default function ConditionStatus({ label, detail, checked, confirmed = true }: {
  label: string;
  detail: string;
  checked: boolean;
  confirmed?: boolean;
}) {
  const labelId = useId();
  const detailId = useId();
  const complete = confirmed && checked;

  return <div className="condition-status" data-state={!confirmed ? "unknown" : complete ? "complete" : "pending"}>
    <span className="condition-status__indicator">
      <input type="checkbox" checked={complete} disabled aria-labelledby={labelId} aria-describedby={detailId} />
      <ConditionCheckbox checked={complete} />
    </span>
    <div className="condition-status__copy">
      <span id={labelId} className="condition-status__label">{label}</span>
      <p id={detailId} className="condition-status__detail">{detail}</p>
    </div>
  </div>;
}
