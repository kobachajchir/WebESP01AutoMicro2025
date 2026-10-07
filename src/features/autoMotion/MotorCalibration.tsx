import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../../components/modal";
import SegmentedControl from "../../components/SegmentedControl";
import MotionReadiness from "./MotionReadiness";
import { useAutoMotion,autoReason,type AutoDevice,type AutoState,type MotorProfile } from "./useAutoMotion";
import { useMotionControl,type MotionController } from "../motion/useMotionControl";
import { downloadMotorJson,packMotorProfile,packStoredIr } from "./motorCodec";
import "./autoMotion.css";
const HISTORY_KEY="automicro.motor-calibration.history.v1";
type Run={date:string;notes:string;state:AutoState};
function history():Run[]{try{const p=JSON.parse(localStorage.getItem(HISTORY_KEY)??"[]");return Array.isArray(p)?p:[]}catch{return[]}}
type MotorDraft={percent:number;ramp:number;timeout:number;notes:string;curve:boolean;levels:string;repeats:number;trial:number};
function motorDraft():MotorDraft{const defaults={percent:12,ramp:500,timeout:30000,notes:"",curve:false,levels:"5,10,15",repeats:3,trial:0};try{const saved=JSON.parse(sessionStorage.getItem("automicro.motor-calibration.draft.v1")??"null");if(!saved||typeof saved!=="object"||!["percent","ramp","timeout","repeats","trial"].every(key=>typeof saved[key]==="number"&&Number.isFinite(saved[key]))||typeof saved.notes!=="string"||typeof saved.curve!=="boolean"||typeof saved.levels!=="string")return defaults;return {...defaults,...saved}}catch{return defaults}}
export default function MotorCalibration({device,motorControl}:{device?:AutoDevice;motorControl?:MotionController}){
 const own=useAutoMotion(!device),auto=device??own,ownControl=useMotionControl(!motorControl),control=motorControl??ownControl,navigate=useNavigate();
 const [draft]=useState(motorDraft);
 const [percent,setPercent]=useState(draft.percent),[ramp,setRamp]=useState(draft.ramp),[timeout,setTimeoutMs]=useState(draft.timeout),[notes,setNotes]=useState(draft.notes);
 const [prepare,setPrepare]=useState(false),[curve,setCurve]=useState(draft.curve),[levels,setLevels]=useState(draft.levels),[repeats,setRepeats]=useState(draft.repeats),[trial,setTrial]=useState(draft.trial);
 const [runs,setRuns]=useState<Run[]>(history),[feedback,setFeedback]=useState(""),seen=useRef<number|null>(null);
 const [samples,setSamples]=useState<AutoState[]>([]);const s=auto.state;
 useEffect(()=>{try{sessionStorage.setItem("automicro.motor-calibration.draft.v1",JSON.stringify({percent,ramp,timeout,notes,curve,levels,repeats,trial}))}catch{}},[percent,ramp,timeout,notes,curve,levels,repeats,trial]);
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
 const ready=!!s&&auto.enabled&&!auto.pending&&!auto.busy&&[0,3].includes(s.carMode)&&s.mpuReady&&s.mpuCalibrated&&s.irCalibrated&&s.objectsEnabled&&s.objectsFresh&&s.lineCalibrated&&s.lineFresh&&s.balanceActive&&s.balanceSettled&&!s.safetyStop;
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
  
  <MotionReadiness auto={auto} mode="GOTO" calibration control={control} onLine={()=>navigate("/seguidor-pista?resolve=line")}/>
  <div className="auto-motion-task-grid"><section className="auto-motion-card"><header><span className="home-kicker">1 · Configurar</span><h3>Ensayo de un metro</h3><p>Usá la batería, carga y superficie que querés calibrar.</p></header>
  <SegmentedControl label="Tipo de calibración" value={curve?"curve":"basic"} options={[{value:"basic",label:"Ensayo básico",disabled:auto.busy},{value:"curve",label:"Curva de respuesta",disabled:auto.busy}]} onChange={value=>{setCurve(value==="curve");setTrial(0)}}/>
  <div className="auto-motion-fields">
   {curve?<><label>Niveles (%)<input className="app-input" value={levels} disabled={auto.busy} onChange={e=>{setLevels(e.target.value);setTrial(0)}}/></label><label>Repeticiones por nivel<input className="app-input" type="number" min={1} max={5} value={repeats} disabled={auto.busy} onChange={e=>{setRepeats(Number(e.target.value));setTrial(0)}}/></label></>:
    <label>Intensidad (%)<input className="app-input" type="number" min={1} max={20} value={percent} disabled={auto.busy} onChange={e=>setPercent(Number(e.target.value))}/></label>}
   </div><details className="auto-motion-disclosure"><summary>Rampa y tiempo máximo</summary><div className="auto-motion-fields"><label>Rampa (ms)<input className="app-input" type="number" min={0} max={5000} value={ramp} disabled={auto.busy} onChange={e=>setRamp(Number(e.target.value))}/></label>
   <label>Tiempo máximo (ms)<input className="app-input" type="number" min={1000} max={30000} value={timeout} disabled={auto.busy} onChange={e=>setTimeoutMs(Number(e.target.value))}/></label>
   </div></details><div className="auto-motion-fields"><label>Condiciones · batería, carga y superficie<input className="app-input" value={notes} disabled={auto.busy} onChange={e=>setNotes(e.target.value)}/></label>
  </div>
  {curve&&<p>Ensayo {trial+1} de {curveLevels.length*repeats} · intensidad {targetPercent}% · repetición {trial%repeats+1}. Cada repetición requiere reposicionar el auto.</p>}
  {curve&&trial>=curveLevels.length*repeats&&<button type="button" className="app-button" disabled={auto.busy} onClick={()=>{setTrial(0);setFeedback("")}}>Comenzar una nueva serie</button>}
  <div className="auto-motion-setup"><span className="home-kicker">2 · Preparar el metro</span><ol><li>Dos franjas iguales, separadas 100 cm entre bordes equivalentes.</li><li>Sensor central sobre la primera franja.</li><li>Recorrido libre y balance estable.</li></ol></div>
  <div className="auto-motion-actions">
   <button className="app-button control-button--primary" disabled={!ready||(curve&&(!curveValid||!Number.isInteger(repeats)||repeats<1||repeats>5||trial>=curveLevels.length*repeats))||!Number.isFinite(targetPercent)||targetPercent<1||targetPercent>20||!Number.isInteger(ramp)||ramp<0||ramp>5000||!Number.isInteger(timeout)||timeout<1000||timeout>30000} onClick={()=>setPrepare(true)}>Preparar ensayo</button>
   <button className="app-button" disabled={!auto.enabled||auto.pending||!auto.busy} onClick={()=>void auto.send("stm.goto.cancel")}>Cancelar recorrido</button>
   
  </div>
  </section><section className="auto-motion-card"><header><span className="home-kicker">3 · Resultado</span><h3>Medición del metro</h3></header>
  <p className="auto-motion-status" role="status">{!s?"Estado sin confirmar":s.kind===1&&auto.busy?["Saliendo de la primera marca","Recorriendo el metro","Cruzando la segunda marca"][s.phase]:s.kind===1&&s.state===3?"Ensayo completado":autoReason(s.reason)}</p>
  {s?.kind===1&&<dl className="auto-motion-metrics">
   {([["Tiempo del metro",`${s.measurementMs} ms`],["Velocidad media",`${s.speedCmS.toFixed(2)} cm/s`],["PWM medio izq. / der.",`${s.leftDutyMean.toFixed(1)} / ${s.rightDutyMean.toFixed(1)} %`],["Ciclos PWM izq. / der.",`${s.leftPwmCycles.toFixed(1)} / ${s.rightPwmCycles.toFixed(1)}`],["Frecuencia PWM",`${s.pwmHz.toFixed(2)} Hz`],["Desvío de rumbo",`${s.yawErrorMax.toFixed(1)}°`]] as const).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>}
  <button type="button" className="app-button control-button--primary" disabled={!s?.resultValid||auto.pending||auto.busy||!control.ready||control.pending} onClick={()=>void save()}>Desactivar balance y guardar ensayo</button><p>Guardar desactiva el balance. Después, reposicioná y activalo para continuar.</p>
  <p>Los ciclos PWM son estimaciones eléctricas, no vueltas de rueda. La curva expresa velocidad media para cada intensidad y rampa.</p>
  {auto.error&&<p className="auto-motion-error" role="alert">{auto.error}</p>}{feedback&&<p className={feedback.startsWith("Ensayo guardado")?"auto-motion-feedback":"auto-motion-error"} role="status">{feedback}</p>}
  </section></div><section className="auto-motion-card"><header><span className="home-kicker">Perfil guardado</span><h3>Respuesta de los motores</h3><p>Recalibrá cuando cambien las condiciones; el perfil no caduca automáticamente.</p></header>
  {auto.profile?.points.length?<>
   <h3>Perfil activo · {auto.profile.points.length===1?"calibración básica":"curva"}</h3>
   <svg viewBox="0 0 400 160" className="auto-motion-curve" role="img" aria-label="Velocidad media según intensidad calibrada"><path d="M30 10V135H390" fill="none" stroke="var(--ui-muted)"/><polyline fill="none" stroke="currentColor" strokeWidth="2" points={auto.profile.points.map(p=>`${30+p.percent/20*350},${135-p.speedCmS/Math.max(...auto.profile!.points.map(p=>p.speedCmS),1)*110}`).join(" ")}/>{auto.profile.points.map(p=><circle key={p.percent} r="4" fill="currentColor" cx={30+p.percent/20*350} cy={135-p.speedCmS/Math.max(...auto.profile!.points.map(p=>p.speedCmS),1)*110}><title>{p.percent}%: {p.speedCmS.toFixed(2)} cm/s</title></circle>)}</svg>
   <div className="auto-motion-table-scroll"><table><caption>Velocidad media por intensidad</caption><thead><tr><th>Intensidad</th><th>Velocidad media</th><th>Rampa</th><th>Ensayos</th></tr></thead><tbody>{auto.profile.points.map(p=><tr key={p.percent}><td>{p.percent}%</td><td>{p.speedCmS.toFixed(2)} cm/s</td><td>{p.rampMs} ms</td><td>{p.runs}</td></tr>)}</tbody></table></div>
  </>:<p className="auto-motion-empty">Todavía no hay un perfil confirmado. Completá y guardá tu primer ensayo.</p>}
  <details className="auto-motion-disclosure"><summary>Repeticiones con estas condiciones</summary><p>Mediana y desvío estándar de velocidad media para las mismas notas de batería, carga y superficie.</p>{statistics.map(p=><p key={p.percent}>{p.percent}% · {p.n} ensayos · mediana {p.median.toFixed(2)} cm/s · desvío {p.dispersion.toFixed(2)} cm/s</p>)}</details>
  <details className="auto-motion-disclosure"><summary>Exportar, importar y gestionar perfiles</summary>
   <p>Transferir perfiles requiere balance desactivado. El historial conserva {runs.length} ensayos en este navegador.</p>
   <button className="app-button" disabled={!auto.profile} onClick={()=>downloadMotorJson({schema:"automicro.motor-calibration.v1",profile:auto.profile,history:runs,samples,notes})}>Exportar perfil e historial</button>
   <label>Importar perfil<input type="file" accept=".json,application/json" disabled={!auto.enabled||auto.pending||auto.busy||!!s?.balanceActive} onChange={e=>void importFile(e.target.files?.[0])}/></label>
   <button className="app-button" disabled={!auto.enabled||auto.pending||auto.busy||!!s?.balanceActive} onClick={()=>void transferIr()}>Transferir calibración de objetos a F4</button>
   <button className="app-button" onClick={()=>navigate("/statics?resolve=objects")}>Calibrar objetos</button>
  </details>
  </section>
  <Modal isOpen={prepare} onClose={()=>setPrepare(false)} containerClassnames="line-device-modal control-task-dialog">
   <h2>Comenzar un metro</h2><p>Usá dos franjas iguales, separadas 100 cm entre bordes equivalentes. Colocá el sensor inferior central sobre la primera franja y dejá libre el recorrido.</p>
   <p>El balance permanecerá activo. Se mide desde la salida de la primera franja hasta la salida de la segunda; el auto frena después.</p>
   <div className="auto-motion-actions"><button type="button" className="app-button control-button--primary" disabled={!ready||auto.pending} onClick={()=>{setPrepare(false);setSamples([]);void auto.send("stm.motorCalibration.control",{operation:0,percent:targetPercent,rampMs:ramp,timeoutMs:timeout})}}>Comenzar ensayo a {targetPercent}%</button><button type="button" className="app-button" onClick={()=>setPrepare(false)}>Volver a preparar</button></div>
  </Modal>
 </section>;
}
