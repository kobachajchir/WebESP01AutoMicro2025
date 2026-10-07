import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ConditionStatus from "../../components/ConditionStatus";
import CarModeSelectorModal from "../../components/CarModeSelectorModal";
import MotorDialog from "./MotorDialog";
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
 const [detailDialog,setDetailDialog]=useState<"balance"|"mpu"|"connection"|"line"|"security"|"objects">("balance");
 function showDialog(next:NonNullable<typeof dialog>){if(next!=="mode")setDetailDialog(next);setDialog(next)}
 const emitters=useIrEmitters(),[irError,setIrError]=useState("");
 const ownControl=useMotionControl(!control),motorControl=control??ownControl,s=auto.state,known=!!s;
 const modeReady=!!s&&(s.carMode===(mode==="GOTO"?3:1)||(calibration&&s.carMode===0));
 return <>
  <section className="motion-readiness"><header className="motion-readiness-heading"><div><span className="home-kicker">Preparación</span><h3>Requisitos del vehículo</h3></div><p>Seleccioná una condición pendiente para resolverla.</p></header>
  <div className="condition-status-grid" aria-label="Requisitos del vehículo">
   <ConditionStatus label="Conexión autorizada" detail="Dispositivo y sesión disponibles" checked={auto.enabled} onResolve={()=>showDialog("connection")}/>
   <ConditionStatus label={calibration?"Modo IDLE / GOTO":`Modo ${mode}`} detail="El modo permite esta operación" checked={modeReady} confirmed={known} onResolve={()=>showDialog("mode")}/>
   <ConditionStatus label="MPU calibrado" detail="Referencia y lectura reciente" checked={!!s?.mpuReady&&!!s?.mpuCalibrated} confirmed={known} onResolve={()=>showDialog("mpu")}/>
   {mode==="GOTO"&&!calibration&&<ConditionStatus label="Motores calibrados" detail="Perfil guardado en el vehículo" checked={!!s?.motorCalibrated} confirmed={known} onResolve={onMotors}/>}
   {mode==="GOTO"&&<ConditionStatus label="IR de objetos" detail="Calibración guardada y lecturas recientes" checked={!!s?.irCalibrated&&!!s.objectsEnabled&&!!s.objectsFresh} confirmed={known} onResolve={()=>showDialog("objects")}/>}
   {(mode==="FOLLOW"||calibration)&&<ConditionStatus label="Sensores de línea" detail="Blanco y pista calibrados; emisores activos" checked={!!s?.lineCalibrated&&!!s.lineFresh} confirmed={known} onResolve={onLine??(()=>navigate("/seguidor-pista?resolve=line"))}/>}
   <ConditionStatus label="Balance estable" detail="Motores armados y vehículo equilibrado" checked={!!s?.balanceActive&&!!s.balanceSettled&&!s.safetyStop} confirmed={known} onResolve={()=>showDialog("balance")}/>
   {mode==="FOLLOW"&&<ConditionStatus label="Auto sobre la línea" detail="Patrón blanco, negro, blanco" checked={!!line?.routeValid&&line.pattern===2} confirmed={!!line} onResolve={()=>showDialog("line")}/>}
   <ConditionStatus label="Sin bloqueos de seguridad" detail="Control disponible" checked={!!s&&!s.safetyStop&&!auto.busy} confirmed={known} onResolve={()=>showDialog("security")}/>
  </div></section>
  <CarModeSelectorModal open={dialog==="mode"} recommended={mode} onClose={()=>setDialog(null)}/>
  <MotorDialog isOpen={!!dialog&&dialog!=="mode"} onClose={()=>setDialog(null)} icon={detailDialog}
   title={{balance:"Balance del vehículo",objects:"Preparar IR de objetos",mpu:"Calibrar MPU",connection:"Conectar el vehículo",line:"Alinear sobre la pista",security:"Estado de seguridad"}[detailDialog]}
   description={{balance:"Ajustá el equilibrio y esperá la confirmación de la F4.",objects:"Prepará los sensores que permiten detectar obstáculos durante GOTO.",mpu:"Definí la referencia de postura antes de activar el balance.",connection:"Completá la conexión y la autorización de esta sesión.",line:"Ubicá los sensores sobre la referencia de la pista.",security:"Resolvé el bloqueo antes de comenzar otro recorrido."}[detailDialog]}
   footer={<button type="button" className="app-button" onClick={()=>setDialog(null)}>Listo</button>}>
   {detailDialog==="balance"?<>
    <div className="motor-dialog__status" data-ready={!!s?.balanceActive&&!!s.balanceSettled&&!s.safetyStop}><span>Confirmación del vehículo</span><strong>{!s?"Sin confirmar":s.balanceActive&&s.balanceSettled&&!s.safetyStop?"Balance estable":"Preparación pendiente"}</strong></div>
    <section className="motor-dialog__card"><h3>Control de motores</h3><div className="control-toolbar-actions"><MotionControlActions control={motorControl}/></div></section>
    <MotionBalancePanel control={motorControl} showStatus/>
    <div className="motor-dialog__note">Esperá a que la F4 confirme estabilidad antes de iniciar.</div>
   </>:detailDialog==="objects"?<>
    <section className="motor-dialog__card"><h3>Preparación del vehículo</h3><div className="control-toolbar-actions"><MotionControlActions control={motorControl}/></div><p>Desactivá el balance antes de transferir el perfil.</p></section>
    <section className="motor-dialog__card"><h3>1. Activar los sensores</h3><p>Los emisores de objetos deben estar encendidos para obtener lecturas.</p><button type="button" className="app-button" disabled={!emitters.available||emitters.pending||auto.busy} onClick={()=>void emitters.setEnabled("objects",true)}>Activar emisores de objetos</button></section>
    <section className="motor-dialog__card"><h3>2. Preparar el perfil</h3><p>Calibrá los cinco sensores con entre 2 y 8 distancias por sensor.</p><button type="button" className="app-button" onClick={()=>navigate("/statics?resolve=objects")}>Abrir calibración de objetos</button></section>
    <section className="motor-dialog__card motor-dialog__card--accent"><h3>3. Transferir a la F4</h3><p>Usá el perfil guardado en esta interfaz cuando la calibración esté completa.</p><button type="button" className="app-button control-button--primary" disabled={!auto.enabled||auto.pending||auto.busy||!!s?.balanceActive} onClick={()=>{setIrError("");try{void auto.send("stm.goto.irCalibration.set",{payload:packStoredIr()})}catch(e){setIrError(e instanceof Error?e.message:"Perfil inválido")}}}>Transferir perfil guardado</button></section>
    {(irError||emitters.error)&&<p role="alert" className="auto-motion-error">{irError||emitters.error}</p>}
   </>:detailDialog==="mpu"?<>
    <ol className="motor-dialog__steps"><li>Sostené el vehículo vertical.</li><li>Mantenelo quieto durante el procedimiento de la F4.</li><li>Esperá una referencia calibrada y una lectura reciente.</li></ol>
    <div className="motor-dialog__status" data-ready={!!s?.mpuCalibrated&&!!s.mpuReady}><span>Referencia MPU</span><strong>{s?.mpuCalibrated&&s.mpuReady?"Calibrada y reciente":"Pendiente de confirmación"}</strong></div>
    <div className="motor-dialog__note">Iniciar la calibración desactiva el balance y abre el procedimiento en la F4.</div>
    <button type="button" className="app-button control-button--primary" disabled={!auto.enabled||auto.pending||auto.busy} onClick={()=>void auto.send("stm.mpu.calibration.request")}>Iniciar calibración MPU</button>
   </>:detailDialog==="connection"?<>
    <section className="motor-dialog__card"><h3>1. Conectar el ESP</h3><p>Revisá la red del vehículo y el enlace con la interfaz.</p><button type="button" className="app-button" onClick={()=>navigate("/wifi")}>Abrir WiFi</button></section>
    <section className="motor-dialog__card motor-dialog__card--accent"><h3>2. Autorizar la sesión</h3><p>Ingresá el PIN del vehículo para habilitar los comandos.</p><button type="button" className="app-button control-button--primary" onClick={()=>navigate("/login")}>Autorizar sesión</button></section>
   </>:detailDialog==="line"?<>
    <section className="motor-dialog__card motor-dialog__card--accent"><h3>Blanco · negro · blanco</h3><p>Colocá el sensor central sobre negro y ambos laterales sobre blanco.</p></section>
    <div className="motor-dialog__status" data-ready={!!line?.routeValid&&line.pattern===2}><span>Patrón actual</span><strong>{line?line.pattern.toString(2).padStart(3,"0"):"Sin confirmar"}</strong></div>
   </>:<>
    <section className="motor-dialog__card"><h3>{auto.busy?"Recorrido en curso":s?.safetyStop?"Motores detenidos por la F4":"Recuperar el estado"}</h3><p>{auto.busy?"Cancelá el recorrido o ensayo antes de cambiar la preparación.":s?.safetyStop?"Corregí la postura y revisá el MPU antes de reactivar el balance.":"Consultá el vehículo para recuperar un estado confirmado."}</p></section>
    <button type="button" className="app-button control-button--primary" disabled={!auto.enabled||auto.pending} onClick={()=>void auto.refresh().catch(()=>undefined)}>Consultar estado</button>
   </>}
   {auto.error&&<p role="alert" className="auto-motion-error">{auto.error}</p>}
  </MotorDialog>
 </>;
}
