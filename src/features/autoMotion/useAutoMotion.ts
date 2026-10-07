import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useUser } from "../../contexts/UserContext";
export type AutoState={
 status:number;version:number;kind:number;state:number;reason:number;carMode:number;missionId:number;elapsedMs:number;
 mpuReady:boolean;mpuCalibrated:boolean;motorCalibrated:boolean;irCalibrated:boolean;balanceActive:boolean;balanceSettled:boolean;safetyStop:boolean;lineCalibrated:boolean;
 objectsEnabled:boolean;objectsFresh:boolean;lineFresh:boolean;xCm:number;yCm:number;goalXCm:number;goalYCm:number;yawDeg:number;speedCmS:number;
 percent:number;rampMs:number;measurementMs:number;pwmHz:number;leftDutyMean:number;rightDutyMean:number;leftDutyMax:number;rightDutyMax:number;
 leftDutySeconds:number;rightDutySeconds:number;leftPwmCycles:number;rightPwmCycles:number;
 leftForwardMs:number;leftReverseMs:number;rightForwardMs:number;rightReverseMs:number;pointCount:number;phase:number;resultValid:boolean;revision:number;yawErrorMax:number;
};
export type MotorPoint={percent:number;speedCmS:number;rampMs:number;runs:number};
export type MotorProfile={status:number;version:number;pointCount:number;revision:number;irCalibrated:boolean;points:MotorPoint[]};
export const autoReason=(n:number)=>["Disponible","Seleccioná GOTO (o IDLE para calibrar)","Calibrá el MPU y esperá una lectura reciente",
 "Activá el balance y esperá estabilidad","Falta calibrar los motores","Calibrá y transferí los IR de objetos",
 "Calibrá la línea, encendé sus emisores y colocá el centro sobre la primera marca","Otra operación controla los motores",
 "Parámetros inválidos","Obstáculo bloqueado o lectura fuera de calibración","Se agotó el tiempo",
 "Desactivá el balance antes de guardar el perfil; revisá la memoria si persiste","Recorrido cancelado","F4 rechazó el movimiento","El auto se desvió durante el ensayo"][n]??"Estado no reconocido";
function parse(value:unknown):AutoState {
 const s=value as AutoState;
 if(!s||s.version!==1||![0,1].includes(s.status)||!Number.isInteger(s.state)||
 !["mpuReady","mpuCalibrated","motorCalibrated","irCalibrated","balanceActive","balanceSettled","safetyStop"].every(k=>typeof (s as unknown as Record<string,unknown>)[k]==="boolean"))
 throw new Error("La F4 no confirmó GOTO/calibración. Actualizá F4 y ESP.");
 return s;
}
export function useAutoMotion(active=true) {
 const {request,connected,mockMode}=useWebSocket(),{remotePinAuthenticated}=useUser();
 const enabled=active&&connected&&!mockMode&&remotePinAuthenticated;
 const [state,setState]=useState<AutoState|null>(null),[profile,setProfile]=useState<MotorProfile|null>(null);
 const [pending,setPending]=useState(false),[error,setError]=useState("");
 const mutation=useRef(false),generation=useRef(0),revision=useRef(-1),readEpoch=useRef(0);
 const refresh=useCallback(async()=>{
  if(!enabled)return null;const g=generation.current,e=readEpoch.current;
  const s=parse(await request("stm.goto.get",{}, {timeoutMs:2000}));
  if(g===generation.current&&e===readEpoch.current){setState(s);setError("");}
  return g===generation.current?s:null;
 },[enabled,request]);
 const refreshProfile=useCallback(async()=>{
  if(!enabled)return null;const g=generation.current;
  const p=await request<MotorProfile>("stm.motorCalibration.profile.get",{}, {timeoutMs:2000});
  if(p.version!==1||!Array.isArray(p.points)||p.points.length>5)throw new Error("Perfil de motores sin confirmar");
  if(g===generation.current){setProfile(p);revision.current=p.revision;}return p;
 },[enabled,request]);
 useEffect(()=>{
  ++generation.current;revision.current=-1;mutation.current=false;setState(null);setProfile(null);setPending(false);
  let closed=false,timer:ReturnType<typeof setTimeout>;
  async function poll(){
   if(closed||!enabled)return;let delay=600;
   if(!mutation.current)try {const s=await refresh();if(!closed&&s&&s.revision!==revision.current)await refreshProfile();}
   catch(cause){if(!closed){setState(null);setError(cause instanceof Error?cause.message:"Sin respuesta");}delay=5000;}
   if(!closed)timer=setTimeout(()=>void poll(),delay);
  }
  void poll();return()=>{closed=true;++generation.current;clearTimeout(timer)};
 },[enabled,refresh,refreshProfile]);
 async function send(name:string,args:Record<string,unknown>={}) {
  if(!enabled||mutation.current)return null;const g=generation.current;
  mutation.current=true;++readEpoch.current;setPending(true);setError("");
  try{
   const response=await request(name,args,{timeoutMs:2000});
   if(g!==generation.current)return null;
   if(name.endsWith("profile.set")){
    const p=response as MotorProfile;setProfile(p);if(p.status)throw new Error(autoReason(11));
    await refresh();return null;
   }
   const next=parse(response);setState(next);
   if(next.status)setError(autoReason(next.reason));
   if(!next.status&&next.revision!==revision.current)await refreshProfile();
   return next;
  }catch(cause){if(g===generation.current){setState(null);setError(cause instanceof Error?cause.message:"Orden sin confirmar; consultá el estado antes de repetirla.");}return null;}
  finally{if(g===generation.current){mutation.current=false;setPending(false)}}
 }
 return {state,profile,enabled,pending,error,refresh,refreshProfile,send,busy:!!state&&[1,2].includes(state.state)};
}
export type AutoDevice=ReturnType<typeof useAutoMotion>;
