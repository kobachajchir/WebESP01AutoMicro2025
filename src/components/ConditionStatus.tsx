import { useId } from "react";
import "./ConditionStatus.css";
export function ConditionCheckbox({ checked, confirmed = true }: { checked: boolean; confirmed?: boolean }) {
 return <span className="condition-checkbox" data-checked={checked} data-confirmed={confirmed} aria-hidden="true">
  <svg viewBox="0 0 20 20" fill="none">
   <path d={!confirmed ? "M5 10h.01 M10 10h.01 M15 10h.01" : checked ? "m4.5 10 3.5 3.5 7.5-7.5" : "m6 6 8 8 M14 6l-8 8"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
 </span>;
}
export default function ConditionStatus({ label, detail, checked, confirmed = true, onResolve, pending = false }: {
 label: string; detail: string; checked: boolean; confirmed?: boolean; onResolve?: () => void; pending?: boolean;
}) {
 const labelId=useId(), detailId=useId(), complete=confirmed&&checked;
 const content=<><span className="condition-status__indicator"><ConditionCheckbox checked={complete} confirmed={confirmed}/></span>
  <span className="condition-status__copy"><span id={labelId} className="condition-status__label">{label}</span>
   <span id={detailId} className="condition-status__detail">{confirmed?detail:"Sin confirmar"}</span></span></>;
 const props={className:"condition-status","data-state":!confirmed?"unknown":complete?"complete":"pending",
  "aria-labelledby":labelId,"aria-describedby":detailId};
 return !complete && onResolve
  ? <button {...props} type="button" onClick={onResolve} disabled={pending} aria-busy={pending}>{content}</button>
  : <div {...props}>{content}</div>;
}
