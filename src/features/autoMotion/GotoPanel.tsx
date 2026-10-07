import { useRef,useState } from "react";
import { useNavigate } from "react-router-dom";
import ConditionStatus from "../../components/ConditionStatus";
import Modal from "../../components/modal";
import MotionReadiness from "./MotionReadiness";
import MotorCalibration from "./MotorCalibration";
import { autoReason,type AutoDevice } from "./useAutoMotion";
import type { MotionController } from "../motion/useMotionControl";
export default function GotoPanel({device,control}:{device:AutoDevice;control:MotionController}){
 const [x,setX]=useState(0),[y,setY]=useState(100),[calibration,setCalibration]=useState(false),xInput=useRef<HTMLInputElement>(null),navigate=useNavigate();
 const s=device.state,coordinates=Number.isFinite(x)&&Number.isFinite(y)&&Math.hypot(x,y)>=10&&Math.hypot(x,y)<=200;
 const ready=coordinates&&!!s&&s.carMode===3&&s.mpuReady&&s.mpuCalibrated&&s.motorCalibrated&&s.irCalibrated&&s.objectsEnabled&&s.objectsFresh&&s.balanceActive&&s.balanceSettled&&!s.safetyStop&&!device.busy;
 return <section className="auto-motion-panel">
  <header><h2>GOTO XY</h2><p>El origen se fija al comenzar: X a la derecha, Y hacia adelante. Posición estimada con rumbo MPU y respuesta calibrada.</p></header>
  <MotionReadiness auto={device} mode="GOTO" control={control} onMotors={()=>setCalibration(true)}/>
  <ConditionStatus label="Coordenadas configuradas" detail="Destino entre 10 y 200 cm del origen" checked={coordinates} onResolve={()=>xInput.current?.focus()}/>
  <div className="auto-motion-fields"><label>X (cm)<input ref={xInput} className="app-input" type="number" value={Number.isFinite(x)?x:""} disabled={device.busy} onChange={e=>setX(e.target.value===""?NaN:Number(e.target.value))}/></label><label>Y (cm)<input className="app-input" type="number" value={Number.isFinite(y)?y:""} disabled={device.busy} onChange={e=>setY(e.target.value===""?NaN:Number(e.target.value))}/></label></div>
  <div className="auto-motion-pill"><button className="app-button" disabled={!device.enabled||device.pending||!ready} onClick={()=>void device.send("stm.goto.start",{xCm:x,yCm:y})}>Comenzar</button>
   <button className="app-button" disabled={!device.enabled||device.pending||!device.busy} onClick={()=>void device.send("stm.goto.cancel")}>Cancelar recorrido</button>
   <button className="app-button" disabled={device.busy} onClick={()=>navigate("/control/calibracion")}>Calibración de motores</button></div>
  <p role="status">{!s?"Sin confirmar":s.kind===0&&s.state===3?"Destino estimado alcanzado":s.state===2?"Esquivando obstáculo":s.state===1?"En recorrido":autoReason(s.reason)}</p>
  {s&&<dl className="auto-motion-metrics"><div><dt>Posición estimada</dt><dd>X {s.xCm.toFixed(1)} · Y {s.yCm.toFixed(1)} cm</dd></div><div><dt>Tiempo</dt><dd>{(s.elapsedMs/1000).toFixed(1)} s</dd></div><div><dt>Rumbo relativo</dt><dd>{s.yawDeg.toFixed(1)}°</dd></div></dl>}
  {device.error&&<p role="alert" className="auto-motion-error">{device.error}</p>}
  <p>Al cancelar se conserva el balance. Si se pierde la conexión, la F4 continúa hasta terminar, detenerse por un bloqueo o agotar 30 segundos.</p>
  <Modal isOpen={calibration} onClose={()=>setCalibration(false)} containerClassnames="ir-calibration-modal-content"><MotorCalibration device={device}/></Modal>
 </section>;
}
