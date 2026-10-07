import { useEffect, useRef, useState } from "react";
import Modal from "./modal";
import { useCarMode, CAR_MODE_NAMES, type SelectableCarMode } from "../contexts/CarModeContext";
export default function CarModeSelectorModal({ open, recommended, onClose }: {open:boolean;recommended:SelectableCarMode;onClose:()=>void}) {
 const mode=useCarMode(),[selected,setSelected]=useState<SelectableCarMode>(recommended),[pending,setPending]=useState(false);
 const sending=useRef(false);
 useEffect(()=>{if(open)setSelected(recommended)},[open,recommended]);
 async function apply() {
  if(sending.current)return;sending.current=true;setPending(true);
  try { if(await mode.setCarMode(selected))onClose(); } finally {sending.current=false;setPending(false);}
 }
 return <Modal isOpen={open} onClose={()=>{if(!pending)onClose()}} closeOnOverlayClick={!pending} containerClassnames="line-device-modal">
  <h2>Modo del vehículo</h2><p>Actual: {mode.mode}. Elegí el modo y aplicá el cambio.</p>
  <div className="auto-motion-pill" role="group" aria-label="Modo de la F4">
   {(["IDLE","FOLLOW","TEST","GOTO"] as const).map(m=><button type="button" className="app-button" key={m} aria-pressed={selected===m} disabled={pending} onClick={()=>setSelected(m)}>{m}<small>{CAR_MODE_NAMES[m]}</small></button>)}
  </div>
  <p>Recomendado para esta pantalla: {recommended}. Cambiar de modo cancela el recorrido activo.</p>
  <button className="app-button" disabled={pending} onClick={()=>void apply()}>{pending?"Aplicando…":"Aplicar"}</button>
 </Modal>;
}
