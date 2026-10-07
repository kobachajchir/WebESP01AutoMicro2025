import { useEffect, useRef, useState } from "react";
import Modal from "./modal";
import SegmentedControl from "./SegmentedControl";
import { useCarMode, CAR_MODE_NAMES, type SelectableCarMode } from "../contexts/CarModeContext";
export default function CarModeSelectorModal({ open, recommended, onClose }: {open:boolean;recommended:SelectableCarMode;onClose:()=>void}) {
 const mode=useCarMode(),[selected,setSelected]=useState<SelectableCarMode>(recommended),[pending,setPending]=useState(false);
 const sending=useRef(false);
 useEffect(()=>{if(open)setSelected(recommended)},[open,recommended]);
 async function apply() {
  if(sending.current)return;sending.current=true;setPending(true);
  try { if(await mode.setCarMode(selected))onClose(); } finally {sending.current=false;setPending(false);}
 }
 return <Modal isOpen={open} onClose={()=>{if(!pending)onClose()}} closeOnOverlayClick={!pending} containerClassnames="line-device-modal control-task-dialog">
  <h2>Modo del vehículo</h2><p>Actual: {mode.mode}. Elegí el modo y aplicá el cambio.</p>
  <SegmentedControl label="Modo de la F4" value={selected} options={(["IDLE","FOLLOW","TEST","GOTO"] as const).map(value=>({value,label:value,disabled:pending}))} onChange={value=>setSelected(value as SelectableCarMode)}/>
  <p>{CAR_MODE_NAMES[selected]}</p>
  {mode.status==="error"&&<p className="auto-motion-error" role="alert">La placa no confirmó el cambio. Consultá el estado antes de repetirlo.</p>}
  <p>Recomendado para esta pantalla: {recommended}. Cambiar de modo cancela el recorrido activo.</p>
  <div className="auto-motion-actions"><button className="app-button control-button--primary" disabled={pending} onClick={()=>void apply()}>{pending?"Aplicando…":"Aplicar modo"}</button><button className="app-button" disabled={pending} onClick={onClose}>Cancelar</button></div>
 </Modal>;
}
