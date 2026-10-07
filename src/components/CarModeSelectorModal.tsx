import { useEffect, useRef, useState } from "react";
import MotorDialog from "../features/autoMotion/MotorDialog";
import SegmentedControl from "./SegmentedControl";
import { useCarMode, CAR_MODE_NAMES, type SelectableCarMode } from "../contexts/CarModeContext";
const descriptions: Record<SelectableCarMode,string> = {
 IDLE:"Preparación del vehículo y operaciones de calibración.",
 FOLLOW:"Seguimiento de la pista con los sensores de línea.",
 TEST:"Control libre y comandos directos de los motores.",
 GOTO:"Recorrido hacia coordenadas con el perfil de motores y los sensores de objetos.",
};
export default function CarModeSelectorModal({ open, recommended, onClose }: {open:boolean;recommended:SelectableCarMode;onClose:()=>void}) {
 const mode=useCarMode(),[selected,setSelected]=useState<SelectableCarMode>(recommended),[pending,setPending]=useState(false);
 const sending=useRef(false);
 useEffect(()=>{if(open)setSelected(recommended)},[open,recommended]);
 async function apply() {
  if(sending.current)return;sending.current=true;setPending(true);
  try { if(await mode.setCarMode(selected))onClose(); } finally {sending.current=false;setPending(false);}
 }
 return <MotorDialog isOpen={open} onClose={onClose} closeDisabled={pending} closeOnOverlayClick={!pending}
  icon="mode" title="Modo del vehículo" description="Elegí cómo va a trabajar la F4 y aplicá el cambio."
  badge={<><span>Actual: {mode.mode}</span><span>Recomendado: {recommended}</span></>}
  footer={<><button type="button" className="app-button" disabled={pending} onClick={onClose}>Cancelar</button><button type="button" className="app-button control-button--primary" disabled={pending} onClick={()=>void apply()}>{pending?"Aplicando…":"Aplicar "+selected}</button></>}>
  <SegmentedControl label="Modo de la F4" value={selected} options={(["IDLE","FOLLOW","TEST","GOTO"] as const).map(value=>({value,label:value,disabled:pending}))} onChange={value=>setSelected(value as SelectableCarMode)}/>
  <section className="motor-dialog__card motor-dialog__card--accent"><h3>{CAR_MODE_NAMES[selected]}</h3><p>{descriptions[selected]}</p></section>
  <div className="motor-dialog__note">Cambiar de modo cancela el recorrido activo. El selector se cierra cuando la placa confirma el cambio.</div>
  {mode.status==="error"&&<p className="auto-motion-error" role="alert">La placa no confirmó el cambio. Consultá el estado antes de repetirlo.</p>}
 </MotorDialog>;
}
