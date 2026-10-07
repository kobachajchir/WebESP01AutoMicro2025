import { useId, type ReactNode } from "react";
import Modal from "../../components/modal";
import "./motorDialog.css";

export type MotorDialogIcon = "mode" | "balance" | "mpu" | "objects" | "connection" | "line" | "security" | "calibration" | "info" | "settings";
const glyphs: Record<MotorDialogIcon,string> = {
 mode:"M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4",
 balance:"M12 3v18M4 8h16M5 8l-3 7h6L5 8Zm14 0-3 7h6l-3-7ZM8 21h8",
 mpu:"M8 3v3M16 3v3M8 18v3M16 18v3M3 8h3M3 16h3M18 8h3M18 16h3M6 6h12v12H6ZM9 12h6M12 9v6",
 objects:"M3 20h18M5 16V8M12 16V4M19 16V8M3 8h4M10 4h4M17 8h4",
 connection:"M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0M12 20h.01",
 line:"M4 20V4M20 20V4M12 20v-4c0-4 4-4 4-8s-4-4-4-4",
 security:"M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3ZM8 12l3 3 5-6",
 calibration:"M3 7h18v10H3ZM7 7v4M11 7v6M15 7v4M19 7v6",
 info:"M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
 settings:"M4 7h16M4 17h16M8 4v6M16 14v6",
};
export default function MotorDialog({isOpen,onClose,title,description,icon,kicker="Control · AutoMicro",badge,footer,children,size="compact",closeDisabled=false,closeOnOverlayClick=true}:{
 isOpen:boolean;onClose:()=>void;title:string;description:string;icon:MotorDialogIcon;kicker?:string;
 badge?:ReactNode;footer?:ReactNode;children:ReactNode;size?:"compact"|"wide";closeDisabled?:boolean;closeOnOverlayClick?:boolean;
}) {
 const id=useId();
 return <Modal isOpen={isOpen} onClose={onClose} closeDisabled={closeDisabled} closeOnOverlayClick={closeOnOverlayClick}
  motionPreset="motor" ariaLabelledBy={id+"-title"} ariaDescribedBy={id+"-description"} containerClassnames={"motor-dialog motor-dialog--"+size}>
  <header className="motor-dialog__header">
   <span className="motor-dialog__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={glyphs[icon]}/></svg></span>
   <div className="motor-dialog__heading"><span className="motor-dialog__kicker">{kicker}</span><h2 id={id+"-title"}>{title}</h2><p id={id+"-description"}>{description}</p>{badge&&<div className="motor-dialog__badge">{badge}</div>}</div>
  </header>
  <div className="motor-dialog__body">{children}</div>
  {footer&&<footer className="motor-dialog__footer">{footer}</footer>}
 </Modal>;
}
