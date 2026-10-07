import { useEffect, useRef, useState } from "react";
import MotorDialog from "../features/autoMotion/MotorDialog";
import CarModeDropdown, { CAR_MODE_LABELS } from "./CarModeDropdown";
import { useCarMode, CAR_MODE_NAMES, type SelectableCarMode } from "../contexts/CarModeContext";
const descriptions: Record<SelectableCarMode,string> = {
 IDLE:"Preparación del vehículo y operaciones de calibración.",
 FOLLOW:"Seguimiento de la pista con los sensores de línea.",
 TEST:"Control libre y comandos directos de los motores.",
 GOTO:"Recorrido hacia coordenadas con el perfil de motores y los sensores de objetos.",
};
export default function CarModeSelectorModal({ open, recommended, onClose }: {open:boolean;recommended:SelectableCarMode;onClose:()=>void}) {
 const mode=useCarMode(),[selected,setSelected]=useState<SelectableCarMode>(recommended),[pending,setPending]=useState(false);
 const [menuOpen,setMenuOpen]=useState(false);
 const sending=useRef(false);
 useEffect(()=>{if(open){setSelected(recommended);setMenuOpen(false)}},[open,recommended]);
 async function apply() {
  if(sending.current)return;sending.current=true;setPending(true);
  try { if(await mode.setCarMode(selected))onClose(); } finally {sending.current=false;setPending(false);}
 }
 return <MotorDialog isOpen={open} onClose={onClose} closeDisabled={pending} closeOnOverlayClick={!pending}
  icon="mode" title="Modo del vehículo" description="Elegí cómo va a trabajar la F4 y aplicá el cambio."
  badge={<><span>Actual: {mode.mode}</span><span>Recomendado: {recommended}</span></>}
  footer={<><button type="button" className="app-button" disabled={pending} onClick={onClose}>Cancelar</button><button type="button" className="app-button control-button--primary" disabled={pending} onClick={()=>void apply()}>{pending?"Aplicando…":"Aplicar "+selected}</button></>}>
  <section className="motor-dialog__card"><h3>Seleccionar modo</h3><CarModeDropdown value={selected} open={menuOpen} onOpenChange={setMenuOpen} onSelect={setSelected} disabled={pending} label={CAR_MODE_LABELS[selected]+" · "+selected}/></section>
  <section className="motor-dialog__card motor-dialog__card--accent"><h3>{CAR_MODE_NAMES[selected]}</h3><p>{descriptions[selected]}</p></section>
  <div className="motor-dialog__note">Cambiar de modo cancela el recorrido activo. El selector se cierra cuando la placa confirma el cambio.</div>
  {mode.status==="error"&&<p className="auto-motion-error" role="alert">La placa no confirmó el cambio. Consultá el estado antes de repetirlo.</p>}
 </MotorDialog>;
}
