import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import type { SelectableCarMode } from "../contexts/CarModeContext";
export const CAR_MODE_LABELS: Record<SelectableCarMode,string> = {IDLE:"Espera",FOLLOW:"Seguidor",TEST:"Testeo",GOTO:"GOTO"};
export default function CarModeDropdown({value,open,onOpenChange,onSelect,disabled=false,label="Cambiar",excludeCurrent=false}:{
 value:string;open:boolean;onOpenChange:(open:boolean)=>void;onSelect:(mode:SelectableCarMode)=>void;
 disabled?:boolean;label?:string;excludeCurrent?:boolean;
}) {
 const id=useId(),ref=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!ref.current?.contains(event.target))onOpenChange(false)};
  window.addEventListener("pointerdown",outside);
  return()=>window.removeEventListener("pointerdown",outside);
 },[open,onOpenChange]);
 function keyboard(event:KeyboardEvent<HTMLDivElement>){
  const options=Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)')??[]);
  if(event.key==="Escape"&&open){event.preventDefault();event.stopPropagation();onOpenChange(false);trigger.current?.focus();return}
  if(!["ArrowDown","ArrowUp","Home","End"].includes(event.key))return;
  event.preventDefault();
  if(!open){onOpenChange(true);return}
  const current=options.indexOf(document.activeElement as HTMLButtonElement);
  const index=event.key==="Home"?0:event.key==="End"?options.length-1:event.key==="ArrowUp"?(current-1+options.length)%options.length:(current+1)%options.length;
  options[index]?.focus();
 }
 useEffect(()=>{if(open)ref.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"]')?.focus()},[open]);
 return <div className="home-mode-dropdown" ref={ref} onKeyDown={keyboard}>
  <button ref={trigger} type="button" className="home-floating-dropdown" aria-label="Mostrar modos disponibles" aria-haspopup="menu" aria-controls={open?id:undefined} aria-expanded={open} disabled={disabled} onClick={()=>onOpenChange(!open)}>
   <span>{label}</span><svg className="home-dropdown-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transform:open?"rotate(180deg)":undefined}}><path d="m6 9 6 6 6-6"/></svg>
  </button>
  {open&&<div id={id} className="home-mode-options" role="menu" aria-label="Modos disponibles">{(["IDLE","FOLLOW","TEST","GOTO"] as const).filter(mode=>!excludeCurrent||mode!==value).map(mode=>
   <button key={mode} type="button" role="menuitemradio" aria-checked={mode===value} className="home-mode-option" disabled={disabled} onClick={()=>{onOpenChange(false);trigger.current?.focus();onSelect(mode)}}>
    <span>{CAR_MODE_LABELS[mode]}</span><span aria-hidden="true">{mode===value?"✓":mode}</span>
   </button>)}</div>}
 </div>;
}
