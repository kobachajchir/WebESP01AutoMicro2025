import { Link } from "react-router-dom";
import MotorCalibration from "../features/autoMotion/MotorCalibration";
export default function MotorCalibrationSection(){return <main className="control-dashboard-shell min-h-screen p-4 sm:p-6"><Link className="app-button" to="/control">Volver a Control</Link><MotorCalibration/></main>;}
