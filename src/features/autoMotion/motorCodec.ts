import { IR_OBJECT_SENSOR_KEYS } from "../ir/irObjectModel";
import { loadStoredIrCalibrationProfile } from "../ir/irCalibrationStorage";
import type { MotorProfile } from "./useAutoMotion";
export function packMotorProfile(p:MotorProfile):number[]{
 if(p.version!==1||!Array.isArray(p.points)||p.points.length>5)throw new Error("Perfil de motores inválido");
 const bytes=new Uint8Array(88),v=new DataView(bytes.buffer);bytes[1]=1;bytes[2]=p.points.length;
 p.points.forEach((point,n)=>{v.setFloat32(8+n*16,point.percent,true);v.setFloat32(12+n*16,point.speedCmS,true);v.setUint32(16+n*16,point.rampMs,true);v.setUint32(20+n*16,point.runs,true);});
 return Array.from(bytes);
}
export function packStoredIr():number[]{
 const profile=loadStoredIrCalibrationProfile();if(!profile.baseline)throw new Error("Primero calibrá el fondo de los cinco sensores de objetos.");
 const bytes=new Uint8Array(186),v=new DataView(bytes.buffer);bytes[0]=1;
 IR_OBJECT_SENSOR_KEYS.forEach((key,c)=>{
  const points=profile.points.filter(p=>p.sensors[key]).sort((a,b)=>a.distanceCm-b.distanceCm);
  if(points.length<2||points.length>8)throw new Error("El perfil de la F4 requiere entre 2 y 8 puntos por sensor. Ajustá los puntos en Objetos; no se descartan mediciones automáticamente.");
  const base=profile.baseline![key],offset=1+c*37;
  v.setUint16(offset,Math.round(base.median),true);v.setUint16(offset+2,Math.ceil(base.stdDev),true);bytes[offset+4]=points.length;
  points.forEach((p,n)=>{v.setUint16(offset+5+n*4,Math.round(p.distanceCm*10),true);v.setUint16(offset+7+n*4,Math.round(p.sensors[key]!.median),true);});
 });
 return Array.from(bytes);
}
export function downloadMotorJson(value:unknown){
 const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));
 const link=document.createElement("a");link.href=url;link.download="automicro-motores.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
