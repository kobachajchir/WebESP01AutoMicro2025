import { useState } from "react";
import CarModeSelectorModal from "../../components/CarModeSelectorModal";
import MotionControlActions from "../motion/MotionControlActions";
import { MotionBalanceStatus } from "../motion/MotionControlPanel";
import type { MotionController } from "../motion/useMotionControl";
import { useCarMode } from "../../contexts/CarModeContext";
export default function ControlToolbar({control,recommended="IDLE",isSimulating=false,onStopSimulation}:{
 control:MotionController; recommended?:"IDLE"|"GOTO"; isSimulating?:boolean; onStopSimulation?:()=>void;
}) {
 const mode=useCarMode(),[selector,setSelector]=useState(false);
 return <section className="control-toolbar" aria-label="Estado y acciones del vehículo">
  <div className="control-toolbar-status">
   <span className="control-connection-status">{control.real?"Sesión autorizada":"Sin conexión autorizada"}</span>
   <button type="button" className="control-mode-button" onClick={()=>setSelector(true)} aria-haspopup="dialog">Modo {mode.mode}<span aria-hidden="true">⌄</span></button>
   <MotionBalanceStatus control={control}/>
  </div>
  <div className="control-toolbar-actions"><MotionControlActions control={control} isSimulating={isSimulating} onStopSimulation={onStopSimulation}/></div>
  <CarModeSelectorModal open={selector} recommended={recommended} onClose={()=>setSelector(false)}/>
 </section>;
}
