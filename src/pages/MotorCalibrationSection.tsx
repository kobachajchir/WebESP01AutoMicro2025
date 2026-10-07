import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import MotorCalibration from "../features/autoMotion/MotorCalibration";
import ControlNavigation from "../features/autoMotion/ControlNavigation";
import ControlToolbar from "../features/autoMotion/ControlToolbar";
import { useAutoMotion } from "../features/autoMotion/useAutoMotion";
import { useMotionControl } from "../features/motion/useMotionControl";
import "../features/autoMotion/autoMotion.css";
export default function MotorCalibrationSection(){
 const auto=useAutoMotion(),control=useMotionControl(),[search]=useSearchParams();
 const returnMode=search.get("volver")==="goto"?"goto":"free";
 return <main className="control-dashboard-shell min-h-screen p-4 sm:p-6"><div className="control-dashboard-frame control-calibration-frame">
  <PageHeader className="app-page-header home-page-header control-page-header" titleOverride="Control de Motores" showInfo={false} showSettings={false}/>
  <ControlNavigation view="calibration"/>
  <ControlToolbar control={control} recommended="GOTO"/>
  <Link className="control-back-link" to={"/control?modo="+returnMode}>← Volver a {returnMode==="goto"?"GOTO XY":"Control libre"}</Link>
  <MotorCalibration device={auto} motorControl={control}/>
 </div></main>;
}
