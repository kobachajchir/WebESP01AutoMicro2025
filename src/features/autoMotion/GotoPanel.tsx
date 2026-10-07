import { useEffect,useRef,useState } from "react";
import ConditionStatus from "../../components/ConditionStatus";
import Modal from "../../components/modal";
import MotionReadiness from "./MotionReadiness";
import MotorCalibration from "./MotorCalibration";
import ControlToolbar from "./ControlToolbar";
import { autoReason,type AutoDevice } from "./useAutoMotion";
import type { MotionController } from "../motion/useMotionControl";
function destinationDraft():{x:number;y:number}{try{const saved=JSON.parse(sessionStorage.getItem("automicro.goto.draft.v1")??"null");return saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)?saved:{x:0,y:100}}catch{return{x:0,y:100}}}
export default function GotoPanel({device,control}:{device:AutoDevice;control:MotionController}){
 const [x,setX]=useState(()=>destinationDraft().x),[y,setY]=useState(()=>destinationDraft().y),[calibration,setCalibration]=useState(false),xInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(Number.isFinite(x)&&Number.isFinite(y))try{sessionStorage.setItem("automicro.goto.draft.v1",JSON.stringify({x,y}))}catch{}},[x,y]);
 const s=device.state,coordinates=Number.isFinite(x)&&Number.isFinite(y)&&Math.hypot(x,y)>=10&&Math.hypot(x,y)<=200;
 const ready=coordinates&&!!s&&s.carMode===3&&s.mpuReady&&s.mpuCalibrated&&s.motorCalibrated&&s.irCalibrated&&s.objectsEnabled&&s.objectsFresh&&s.balanceActive&&s.balanceSettled&&!s.safetyStop&&!device.busy;
 const status=!s?"Sin confirmar":s.kind===0&&s.state===3?"Destino estimado alcanzado":s.state===2?"Esquivando obstáculo":s.state===1?"En recorrido":autoReason(s.reason);
 return <section className="auto-motion-panel" aria-label="GOTO XY">
  <MotionReadiness auto={device} mode="GOTO" control={control} onMotors={()=>setCalibration(true)}/>
  <div className="auto-motion-task-grid">
   <section className="auto-motion-card"><header><span className="home-kicker">Destino</span><h3>Coordenadas</h3><p>El origen se fija al comenzar. X hacia la derecha; Y hacia adelante.</p></header>
    <ConditionStatus label="Destino válido" detail="Entre 10 y 200 cm del origen" checked={coordinates} onResolve={()=>xInput.current?.focus()}/>
    <div className="auto-motion-fields">
     <label>X · derecha (cm)<input ref={xInput} className="app-input" type="number" inputMode="decimal" value={Number.isFinite(x)?x:""} disabled={device.busy} onChange={e=>setX(e.target.value===""?NaN:Number(e.target.value))}/></label>
     <label>Y · adelante (cm)<input className="app-input" type="number" inputMode="decimal" value={Number.isFinite(y)?y:""} disabled={device.busy} onChange={e=>setY(e.target.value===""?NaN:Number(e.target.value))}/></label>
    </div>
    <div className="auto-motion-actions"><button type="button" className="app-button control-button--primary" disabled={!device.enabled||device.pending||!ready} onClick={()=>void device.send("stm.goto.start",{xCm:x,yCm:y})}>Comenzar recorrido</button><button type="button" className="app-button" disabled={!device.enabled||device.pending||!device.busy} onClick={()=>void device.send("stm.goto.cancel")}>Cancelar recorrido</button></div>
    {!ready&&!device.busy&&<p className="auto-motion-hint">Resolvé los requisitos pendientes para comenzar.</p>}
    {device.error&&<p role="alert" className="auto-motion-error">{device.error}</p>}
   </section>
   <section className="auto-motion-card"><header><span className="home-kicker">Recorrido</span><h3>Estado del vehículo</h3></header>
    <p className="auto-motion-status" role="status">{status}</p>
    <dl className="auto-motion-metrics">
     <div><dt>X estimada</dt><dd>{s?s.xCm.toFixed(1):"—"} <small>cm</small></dd></div><div><dt>Y estimada</dt><dd>{s?s.yCm.toFixed(1):"—"} <small>cm</small></dd></div>
     <div><dt>Tiempo</dt><dd>{s?(s.elapsedMs/1000).toFixed(1):"—"} <small>s</small></dd></div><div><dt>Rumbo relativo</dt><dd>{s?s.yawDeg.toFixed(1):"—"} <small>°</small></dd></div>
    </dl>
    <p>Posición estimada a partir del rumbo y la calibración de motores.</p>
    <details className="auto-motion-disclosure"><summary>Durante el recorrido</summary><p>Cancelar conserva el balance. Si se pierde la conexión, la F4 continúa hasta terminar, encontrar un bloqueo o agotar 30 segundos. Detener apaga motores y balance.</p></details>
   </section>
  </div>
  <Modal isOpen={calibration} onClose={()=>setCalibration(false)} containerClassnames="ir-calibration-modal-content control-task-dialog">
   <div className="control-dialog-heading"><h2>Calibración de motores</h2><button type="button" className="app-button" onClick={()=>setCalibration(false)}>Volver a GOTO</button></div>
   <ControlToolbar control={control} recommended="GOTO"/>
   <MotorCalibration device={device} motorControl={control}/>
  </Modal>
 </section>;
}
