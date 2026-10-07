import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../../components/modal";
import MotionReadiness from "./MotionReadiness";
import { useAutoMotion,autoReason,type AutoDevice,type AutoState,type MotorProfile } from "./useAutoMotion";
import { useMotionControl } from "../motion/useMotionControl";
import { downloadMotorJson,packMotorProfile,packStoredIr } from "./motorCodec";
import "./autoMotion.css";
const HISTORY_KEY="automicro.motor-calibration.history.v1";
type Run={date:string;notes:string;state:AutoState};
function history():Run[]{try{const p=JSON.parse(localStorage.getItem(HISTORY_KEY)??"[]");return Array.isArray(p)?p:[]}catch{return[]}}
export default function MotorCalibration({device}:{device?:AutoDevice}){
 const own=useAutoMotion(!device),auto=device??own,control=useMotionControl(),navigate=useNavigate();
 const [percent,setPercent]=useState(12),[ramp,setRamp]=useState(500),[timeout,setTimeoutMs]=useState(30000),[notes,setNotes]=useState("");
 const [prepare,setPrepare]=useState(false),[curve,setCurve]=useState(false),[levels,setLevels]=useState("5,10,15"),[repeats,setRepeats]=useState(3),[trial,setTrial]=useState(0);
 const [runs,setRuns]=useState<Run[]>(history),[feedback,setFeedback]=useState(""),seen=useRef<number|null>(null);
 const [samples,setSamples]=useState<AutoState[]>([]);const s=auto.state;
 const curveLevels=levels.split(",").map(Number),curveValid=curveLevels.length>0&&curveLevels.length<=5&&curveLevels.every((n,i)=>Number.isFinite(n)&&n>=1&&n<=20&&(i===0||n>curveLevels[i-1]));
 const statistics=(auto.profile?.points??[]).map(p=>{
  const values=runs.filter(r=>r.notes===notes&&r.state.percent===p.percent&&r.state.rampMs===p.rampMs&&r.state.measurementMs>0).map(r=>100000/r.state.measurementMs).sort((a,b)=>a-b);
  const n=values.length,mean=n?values.reduce((a,b)=>a+b,0)/n:0;
  return {percent:p.percent,n,median:n?(values[Math.floor((n-1)/2)]+values[Math.floor(n/2)])/2:0,dispersion:n?Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/n):0};
 });
 const targetPercent=curve?curveLevels[Math.floor(trial/repeats)%curveLevels.length]:percent;
 useEffect(()=>{
  if(!s||s.kind!==1)return;
  if([1,2].includes(s.state))setSamples(old=>[...old,s].slice(-100));
  if(s.state===3&&s.resultValid&&seen.current!==s.missionId){
   seen.current=s.missionId;setRuns(old=>{const next=[...old,{date:new Date().toISOString(),notes,state:s}].slice(-200);try{localStorage.setItem(HISTORY_KEY,JSON.stringify(next))}catch{}return next});
  }
 },[s,notes]);
 const ready=!!s&&auto.enabled&&!auto.pending&&!auto.busy&&[0,3].includes(s.carMode)&&s.mpuReady&&s.mpuCalibrated&&s.irCalibrated&&s.objectsEnabled&&s.objectsFresh&&s.lineCalibrated&&s.lineFresh&&s.balanceSettled&&!s.safetyStop;
 async function save(){
  setFeedback("");const stopped=await control.run("stm.balance.setEnabled",{enabled:false});
  if(!stopped)return;
  const response=await auto.send("stm.motorCalibration.control",{operation:curve&&trial%repeats!==0?2:3,percent:targetPercent,rampMs:ramp,timeoutMs:timeout});
  if(response?.status===0){setTrial(n=>n+1);setFeedback("Ensayo guardado. Reposicioná el auto y activá el balance para el siguiente.");}
 }
 async function transferIr(){
  setFeedback("");try{await auto.send("stm.goto.irCalibration.set",{payload:packStoredIr()})}catch(cause){setFeedback(cause instanceof Error?cause.message:"Perfil inválido")}
 }
 async function importFile(file:File|undefined){
  if(!file)return;setFeedback("");
  try{
   if(file.size>1000000)throw new Error("El archivo es demasiado grande");
   const value=JSON.parse(await file.text()) as {schema:string;profile:MotorProfile;history?:Run[]};
   if(value.schema!=="automicro.motor-calibration.v1")throw new Error("Formato de calibración incompatible");
   await auto.send("stm.motorCalibration.profile.set",{payload:packMotorProfile(value.profile)});
  }catch(cause){setFeedback(cause instanceof Error?cause.message:"No se pudo importar")}
 }
 return <section className="auto-motion-panel" aria-label="Calibración de motores">
  <header><span className="home-kicker">Motores · Calibración</span><h2>Recorrido de un metro</h2><p>Medí la respuesta del vehículo con su batería, carga y superficie actuales. Recalibrá cuando lo decidas.</p></header>
  <MotionReadiness auto={auto} mode="GOTO" calibration control={control} onLine={()=>navigate("/seguidor-pista?resolve=line")}/>
  <div className="auto-motion-pill"><button className="app-button" aria-pressed={!curve} disabled={auto.busy} onClick={()=>setCurve(false)}>Ensayo básico</button><button className="app-button" aria-pressed={curve} disabled={auto.busy} onClick={()=>{setCurve(true);setTrial(0)}}>Curva de respuesta</button></div>
  <div className="auto-motion-fields">
   {curve?<><label>Niveles (%)<input className="app-input" value={levels} disabled={auto.busy} onChange={e=>{setLevels(e.target.value);setTrial(0)}}/></label><label>Repeticiones por nivel<input className="app-input" type="number" min={1} max={5} value={repeats} disabled={auto.busy} onChange={e=>{setRepeats(Number(e.target.value));setTrial(0)}}/></label></>:
    <label>Intensidad (%)<input className="app-input" type="number" min={1} max={20} value={percent} disabled={auto.busy} onChange={e=>setPercent(Number(e.target.value))}/></label>}
   <label>Rampa (ms)<input className="app-input" type="number" min={0} max={5000} value={ramp} disabled={auto.busy} onChange={e=>setRamp(Number(e.target.value))}/></label>
   <label>Tiempo máximo (ms)<input className="app-input" type="number" min={1000} max={30000} value={timeout} disabled={auto.busy} onChange={e=>setTimeoutMs(Number(e.target.value))}/></label>
   <label>Batería, carga y superficie<input className="app-input" value={notes} disabled={auto.busy} onChange={e=>setNotes(e.target.value)}/></label>
  </div>
  {curve&&<p>Ensayo {trial+1} de {curveLevels.length*repeats} · intensidad {targetPercent}% · repetición {trial%repeats+1}. Cada repetición requiere reposicionar el auto.</p>}
  <div className="auto-motion-pill">
   <button className="app-button" disabled={!ready||(curve&&(!curveValid||!Number.isInteger(repeats)||repeats<1||repeats>5||trial>=curveLevels.length*repeats))||!Number.isFinite(targetPercent)||targetPercent<1||targetPercent>20||!Number.isInteger(ramp)||ramp<0||ramp>5000||!Number.isInteger(timeout)||timeout<1000||timeout>30000} onClick={()=>setPrepare(true)}>Preparar ensayo</button>
   <button className="app-button" disabled={!auto.enabled||auto.pending||!auto.busy} onClick={()=>void auto.send("stm.goto.cancel")}>Cancelar recorrido</button>
   <button className="app-button" disabled={!s?.resultValid||auto.pending||auto.busy||!control.ready} onClick={()=>void save()}>Desactivar balance y guardar ensayo</button>
  </div>
  <p>{!s?"Estado sin confirmar":s.kind===1&&auto.busy?["Saliendo de la primera marca","Recorriendo el metro","Cruzando la segunda marca"][s.phase]:s.state===3?"Ensayo completado":autoReason(s.reason)}</p>
  {s?.kind===1&&<dl className="auto-motion-metrics">
   {([["Tiempo del metro",`${s.measurementMs} ms`],["Velocidad media",`${s.speedCmS.toFixed(2)} cm/s`],["PWM medio izq. / der.",`${s.leftDutyMean.toFixed(1)} / ${s.rightDutyMean.toFixed(1)} %`],["Ciclos PWM izq. / der.",`${s.leftPwmCycles.toFixed(1)} / ${s.rightPwmCycles.toFixed(1)}`],["Frecuencia PWM",`${s.pwmHz.toFixed(2)} Hz`],["Desvío de rumbo",`${s.yawErrorMax.toFixed(1)}°`]] as const).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>}
  <p>Los ciclos PWM son estimaciones eléctricas, no vueltas de rueda. La curva expresa velocidad media para cada intensidad y rampa.</p>
  {auto.profile?.points.length?<>
   <h3>Perfil activo · {auto.profile.points.length===1?"calibración básica":"curva"}</h3>
   <svg viewBox="0 0 400 160" className="auto-motion-curve" role="img" aria-label="Velocidad media según intensidad calibrada"><path d="M30 10V135H390" fill="none" stroke="var(--ui-muted)"/><polyline fill="none" stroke="currentColor" strokeWidth="2" points={auto.profile.points.map(p=>`${30+p.percent/20*350},${135-p.speedCmS/Math.max(...auto.profile!.points.map(p=>p.speedCmS),1)*110}`).join(" ")}/>{auto.profile.points.map(p=><circle key={p.percent} r="4" fill="currentColor" cx={30+p.percent/20*350} cy={135-p.speedCmS/Math.max(...auto.profile!.points.map(p=>p.speedCmS),1)*110}><title>{p.percent}%: {p.speedCmS.toFixed(2)} cm/s</title></circle>)}</svg>
   <table><thead><tr><th>Intensidad</th><th>Velocidad media</th><th>Rampa</th><th>Ensayos</th></tr></thead><tbody>{auto.profile.points.map(p=><tr key={p.percent}><td>{p.percent}%</td><td>{p.speedCmS.toFixed(2)} cm/s</td><td>{p.rampMs} ms</td><td>{p.runs}</td></tr>)}</tbody></table>
  </>:null}
  <details><summary>Repeticiones con estas condiciones</summary><p>Mediana y desvío estándar de velocidad media para las mismas notas de batería, carga y superficie.</p>{statistics.map(p=><p key={p.percent}>{p.percent}% · {p.n} ensayos · mediana {p.median.toFixed(2)} cm/s · desvío {p.dispersion.toFixed(2)} cm/s</p>)}</details>
  <details><summary>Perfil, historial y calibración de objetos</summary>
   <p>Transferir perfiles requiere balance desactivado. El historial conserva {runs.length} ensayos en este navegador.</p>
   <button className="app-button" disabled={!auto.profile} onClick={()=>downloadMotorJson({schema:"automicro.motor-calibration.v1",profile:auto.profile,history:runs,samples,notes})}>Exportar perfil e historial</button>
   <label>Importar perfil<input type="file" accept=".json,application/json" disabled={!auto.enabled||auto.pending||auto.busy||!!s?.balanceActive} onChange={e=>void importFile(e.target.files?.[0])}/></label>
   <button className="app-button" disabled={!auto.enabled||auto.pending||auto.busy||!!s?.balanceActive} onClick={()=>void transferIr()}>Transferir calibración de objetos a F4</button>
   <button className="app-button" onClick={()=>navigate("/statics?resolve=objects")}>Calibrar objetos</button>
  </details>
  {(auto.error||feedback)&&<p className="auto-motion-error" role="status">{auto.error||feedback}</p>}
  <Modal isOpen={prepare} onClose={()=>setPrepare(false)} containerClassnames="line-device-modal">
   <h2>Preparar un metro</h2><p>Usá dos franjas iguales, separadas 100 cm entre bordes equivalentes. Colocá el sensor inferior central sobre la primera franja y dejá libre el recorrido.</p>
   <p>El balance permanecerá activo. Se mide desde la salida de la primera franja hasta la salida de la segunda; el auto frena después.</p>
   <button className="app-button" disabled={!ready||auto.pending} onClick={()=>{setPrepare(false);setSamples([]);void auto.send("stm.motorCalibration.control",{operation:0,percent:targetPercent,rampMs:ramp,timeoutMs:timeout})}}>Comenzar ensayo a {targetPercent}%</button>
  </Modal>
 </section>;
}
