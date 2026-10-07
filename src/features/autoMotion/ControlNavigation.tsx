import { useNavigate } from "react-router-dom";
import SegmentedControl from "../../components/SegmentedControl";
export type ControlView = "free" | "goto" | "calibration";
export default function ControlNavigation({ view, onModeChange }: {
  view: ControlView; onModeChange?: (view: "free" | "goto") => void;
}) {
  const navigate = useNavigate();
  return <section className="control-workspace-heading" aria-label="Navegación de Control">
    <div><span className="home-kicker">Motores</span><h2>{view === "calibration" ? "Calibración" : view === "goto" ? "Ir a un destino" : "Control libre"}</h2>
      <p>{view === "calibration" ? "Medí un metro y guardá la respuesta del vehículo." : view === "goto" ? "Prepará el auto, elegí las coordenadas y comenzá." : "Prepará el balance y ajustá el movimiento."}</p></div>
    <SegmentedControl label="Herramientas de Control" value={view} options={[
      {value:"free",label:"Libre"},{value:"goto",label:"GOTO XY"},{value:"calibration",label:"Calibración"}
    ]} onChange={value => {
      if (value === "calibration") navigate("/control/calibracion?volver="+(view === "goto" ? "goto" : "free"));
      else if (value === "free" || value === "goto") {
        if (onModeChange) onModeChange(value); else navigate("/control?modo="+value);
      }
    }}/>
  </section>;
}
