import { useId, useRef } from "react";
import "./SegmentedControl.css";
export type SegmentOption = { value: string; label: string; disabled?: boolean };
export default function SegmentedControl({ label, value, options, onChange }: {
  label: string; value: string; options: readonly SegmentOption[]; onChange: (value: string) => void;
}) {
  const id = useId(), buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <div className="studio-segmented-control shared-segmented-control" role="group" aria-label={label}
    onPointerDown={event => { event.currentTarget.dataset.keyboard="false"; }}
    onKeyDown={event => {
      event.currentTarget.dataset.keyboard="true";
      const enabled = options.map((option, index) => ({option,index})).filter(item => !item.option.disabled);
      if (!enabled.length || !["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
      event.preventDefault();
      const current = Math.max(0, enabled.findIndex(item => item.option.value === value));
      const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 :
        (current + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length;
      onChange(enabled[next].option.value);
      buttons.current[enabled[next].index]?.focus();
    }}>
    {options.map((option,index) => <button key={option.value} id={id+"-"+option.value}
      ref={element => { buttons.current[index] = element; }} type="button"
      aria-pressed={value === option.value} tabIndex={value === option.value ? 0 : -1}
      disabled={option.disabled} onClick={() => { if(option.value !== value) onChange(option.value); }}>{option.label}</button>)}
  </div>;
}
