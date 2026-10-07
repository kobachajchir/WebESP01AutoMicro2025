import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ConditionStatus from "../../components/ConditionStatus";
import CarModeSelectorModal from "../../components/CarModeSelectorModal";
import Modal from "../../components/modal";
import MotionControlActions from "../motion/MotionControlActions";
import { MotionBalancePanel } from "../motion/MotionControlPanel";
import { useMotionControl, type MotionController } from "../motion/useMotionControl";
import type { AutoDevice } from "./useAutoMotion";
import type { LineDeviceState } from "../lineFollow/useLineDevice";
import { useIrEmitters } from "../../contexts/IrEmittersContext";
import { packStoredIr } from "./motorCodec";
import "./autoMotion.css";
export default function MotionReadiness({auto,mode,line,onMotors,onLine,control,calibration=false}:{auto:AutoDevice;mode:"GOTO"|"FOLLOW";
 line?:LineDeviceState|null;onMotors?:()=>void;onLine?:()=>void;control?:MotionController;calibration?:boolean}) {
 const navigate=useNavigate(),[dialog,setDialog]=useState<"mode"|"balance"|"mpu"|"connection"|"line"|"security"|"objects"|null>(null);
 const emitters=useIrEmitters(),[irError,setIrError]=useState("");
 const ownControl=useMotionControl(!control),motorControl=control??ownControl,s=auto.state,known=!!s;
 const modeReady=!!s&&(s.carMode===(mode==="GOTO"?3:1)||(calibration&&s.carMode===0));
 return <>
  <section className="motion-readiness"><header className="motion-readiness-heading"><div><span className="home-kicker">Preparación</span><h3>Requisitos del vehículo</h3></div><p>Seleccioná una condición pendiente para resolverla.</p></header>
  <div className="condition-status-grid" aria-label="Requisitos del vehículo">
   <ConditionStatus label="Conexión autorizada" detail="Dispositivo y sesión disponibles" checked={auto.enabled} onResolve={()=>setDialog("connection")}/>
   <ConditionStatus label={calibration?"Modo IDLE / GOTO":`Modo ${mode}`} detail="El modo permite esta operación" checked={modeReady} confirmed={known} onResolve={()=>setDialog("mode")}/>
   <ConditionStatus label="MPU calibrado" detail="Referencia y lectura reciente" checked={!!s?.mpuReady&&!!s?.mpuCalibrated} confirmed={known} onResolve={()=>setDialog("mpu")}/>
   {mode==="GOTO"&&!calibration&&<ConditionStatus label="Motores calibrados" detail="Perfil guardado en el vehículo" checked={!!s?.motorCalibrated} confirmed={known} onResolve={onMotors}/>}
   {mode==="GOTO"&&<ConditionStatus label="IR de objetos" detail="Calibración guardada y lecturas recientes" checked={!!s?.irCalibrated&&!!s.objectsEnabled&&!!s.objectsFresh} confirmed={known} onResolve={()=>setDialog("objects")}/>}
   {(mode==="FOLLOW"||calibration)&&<ConditionStatus label="Sensores de línea" detail="Blanco y pista calibrados; emisores activos" checked={!!s?.lineCalibrated&&!!s.lineFresh} confirmed={known} onResolve={onLine??(()=>navigate("/seguidor-pista?resolve=line"))}/>}
   <ConditionStatus label="Balance estable" detail="Motores armados y vehículo equilibrado" checked={!!s?.balanceActive&&!!s.balanceSettled&&!s.safetyStop} confirmed={known} onResolve={()=>setDialog("balance")}/>
   {mode==="FOLLOW"&&<ConditionStatus label="Auto sobre la línea" detail="Patrón blanco, negro, blanco" checked={!!line?.routeValid&&line.pattern===2} confirmed={!!line} onResolve={()=>setDialog("line")}/>}
   <ConditionStatus label="Sin bloqueos de seguridad" detail="Control disponible" checked={!!s&&!s.safetyStop&&!auto.busy} confirmed={known} onResolve={()=>setDialog("security")}/>
  </div></section>
  <CarModeSelectorModal open={dialog==="mode"} recommended={mode} onClose={()=>setDialog(null)}/>
  {dialog&&dialog!=="mode"&&<Modal isOpen onClose={()=>setDialog(null)} containerClassnames="line-device-modal control-task-dialog">
   {dialog==="balance"?<><h2>Balance del vehículo</h2><div className="control-toolbar-actions"><MotionControlActions control={motorControl}/></div><MotionBalancePanel control={motorControl} showStatus/><p>Esperá a que la F4 confirme estabilidad antes de iniciar.</p></>:
    dialog==="objects"?<><h2>Preparar IR de objetos</h2><div className="control-toolbar-actions"><MotionControlActions control={motorControl}/></div><p>Calibrá los cinco sensores y transferí el perfil a la F4 con el balance desactivado. El perfil admite entre 2 y 8 distancias por sensor.</p>
     <button className="app-button" disabled={!emitters.available||emitters.pending||auto.busy} onClick={()=>void emitters.setEnabled("objects",true)}>Activar emisores de objetos</button>
     <button className="app-button" disabled={!auto.enabled||auto.pending||auto.busy||!!s?.balanceActive} onClick={()=>{setIrError("");try{void auto.send("stm.goto.irCalibration.set",{payload:packStoredIr()})}catch(e){setIrError(e instanceof Error?e.message:"Perfil inválido")}}}>Transferir perfil guardado</button>
     <button className="app-button" onClick={()=>navigate("/statics?resolve=objects")}>Abrir calibración de objetos</button>
     {(irError||emitters.error)&&<p className="auto-motion-error">{irError||emitters.error}</p>}</>:
    dialog==="mpu"?<><h2>Calibrar MPU</h2><p>Sostené el vehículo vertical y quieto. Esta acción desactiva el balance y abre el procedimiento de la F4.</p>
     <button className="app-button" disabled={!auto.enabled||auto.pending||auto.busy} onClick={()=>void auto.send("stm.mpu.calibration.request")}>Iniciar calibración MPU</button>
     <p>{s?.mpuCalibrated&&s.mpuReady?"Referencia calibrada y lectura reciente":"Esperando calibración y lectura reciente de la F4"}</p></>:
    dialog==="connection"?<><h2>Conectar el vehículo</h2><p>Conectá el ESP y autorizá tu sesión con el PIN del vehículo.</p>
     <button className="app-button" onClick={()=>navigate("/wifi")}>Abrir WiFi</button><button className="app-button" onClick={()=>navigate("/login")}>Autorizar sesión</button></>:
    dialog==="line"?<><h2>Alinear sobre la pista</h2><p>Colocá el centro sobre negro y los laterales sobre blanco.</p><p>Patrón actual: {line?line.pattern.toString(2).padStart(3,"0"):"Sin confirmar"}</p></>:
    <><h2>Estado de seguridad</h2><p>{auto.busy?"Hay un recorrido o ensayo en curso. Cancelalo antes de cambiar la preparación.":s?.safetyStop?"La F4 detuvo los motores. Corregí la postura y revisá el MPU antes de reactivar el balance.":"Consultá el vehículo para recuperar un estado confirmado."}</p>
     <button className="app-button" disabled={!auto.enabled||auto.pending} onClick={()=>void auto.refresh().catch(()=>undefined)}>Consultar estado</button></>}
   {auto.error&&<p role="alert" className="auto-motion-error">{auto.error}</p>}
   <button className="app-button" onClick={()=>setDialog(null)}>Cerrar</button>
  </Modal>}
 </>;
}
