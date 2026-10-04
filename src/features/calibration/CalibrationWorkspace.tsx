import { useCallback, useState } from "react";
import IrCalibrationWorkbench from "../ir/IrCalibrationWorkbench";
import type { IrCalibrationProfile } from "../ir/irCalibration";
import type { IrSnapshot } from "../../api/UnerFrameV2";
import BalanceWorkbench from "../balanceCalibration/BalanceWorkbench";
import { useWebSocket } from "../../hooks/useWebSocket";
import BrandMark from "../../components/BrandMark";
import "./calibration.css";
import LineWorkbench from "./LineWorkbench";
export default function CalibrationWorkspace(props: {
  profile: IrCalibrationProfile; snapshot: IrSnapshot; captureAvailable: boolean;
  onProfileChange: (profile: IrCalibrationProfile) => void;
}) {
  const [tab, setTab] = useState<"ir" | "line" | "balance">("ir");
  const [busy, setBusy] = useState(false); const onBusyChange = useCallback((value: boolean) => setBusy(value), []);
  const { connected, mockMode } = useWebSocket();
  return <div className="calibration-workspace">
    <header className="calibration-workspace-header">
      <div className="calibration-brand"><BrandMark /><div><span className="home-kicker">AutoMicro · instrumentos</span><h1>Calibración</h1><p>Medí, compará y ajustá con una referencia clara.</p></div></div>
      <span className={`calibration-link-state ${connected && !mockMode ? "calibration-link-state--ready" : ""}`} role="status"><span aria-hidden="true" />{connected ? mockMode ? "Modo simulado" : "Dispositivo conectado" : "Sin conexión"}</span>
    </header>
    <nav className="calibration-tabs" aria-label="Procedimiento de calibración">
      <button className="app-button" disabled={busy} aria-pressed={tab === "ir"} onClick={() => setTab("ir")}><span className="calibration-tab-symbol" aria-hidden="true">◎</span><span>Objetos<small>Distancia y respuesta óptica</small></span></button>
      <button className="app-button" disabled={busy} aria-pressed={tab === "line"} onClick={() => setTab("line")}><span className="calibration-tab-symbol" aria-hidden="true">≋</span><span>Línea<small>Referencias de blanco y negro</small></span></button>
      <button className="app-button" disabled={busy} aria-pressed={tab === "balance"} onClick={() => setTab("balance")}><span className="calibration-tab-symbol" aria-hidden="true">↔</span><span>Balance<small>Registro y análisis del PID</small></span></button>
    </nav>
    {tab === "ir" ? <IrCalibrationWorkbench {...props} captureAvailable={props.captureAvailable && !mockMode} onBusyChange={onBusyChange} /> : tab === "line" ? <LineWorkbench snapshot={props.snapshot} captureAvailable={props.captureAvailable && !mockMode} onBusyChange={onBusyChange} /> : <BalanceWorkbench onBusyChange={onBusyChange} />}
  </div>;
}
