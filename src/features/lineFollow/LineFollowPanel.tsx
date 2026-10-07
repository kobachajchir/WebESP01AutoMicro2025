import { useState } from "react";
import { useAutoMotion } from "../autoMotion/useAutoMotion";
import MotionReadiness from "../autoMotion/MotionReadiness";
import CarModeSelectorModal from "../../components/CarModeSelectorModal";
import Modal from "../../components/modal";
import TransportActionButton from "../../components/TransportActionButton";
import { ConditionCheckbox } from "../../components/ConditionStatus";
import { useLineDevice, lineReason } from "./useLineDevice";
import LineDeviceCalibration from "./LineDeviceCalibration";
import "./lineFollow.css";

export default function LineFollowPanel() {
  const device = useLineDevice(); const s = device.state;
  const auto=useAutoMotion(); const [modeModal,setModeModal]=useState(false);
  const [missingModal, setMissingModal] = useState(false);
  const [calibrationModal, setCalibrationModal] = useState(new URLSearchParams(window.location.search).get("resolve")==="line");
  const [feedback, setFeedback] = useState("");
  const calibrationReady = !!(s?.whiteValid && s.trackValid);
  const balanceReady = !!(s?.motionArmed && s.balanceActive && s.balanceSettled && !s.safetyStop);
  const following = !!s?.following;
  const missing = s ? [!s.whiteValid ? "Calibrar blanco: los tres sensores sobre blanco" : null,
    !s.trackValid ? "Calibrar sobre pista: blanco, negro, blanco" : null].filter(Boolean) : [];
  async function toggleFollowing() {
    setFeedback("");
    if (s?.following) { await device.follow(false); return; }
    try {
      const current = await device.refresh();
      if (!current) return;
      if (!current.whiteValid || !current.trackValid) { setMissingModal(true); return; }
      if (current.carMode !== 1) { setModeModal(true); return; }
      if (!current.motionArmed || !current.balanceActive || !current.balanceSettled) {
        setFeedback("Activá el balance y esperá a que se estabilice antes de seguir."); return;
      }
      const confirmed = await device.follow(true);
      if (confirmed && (!confirmed.whiteValid || !confirmed.trackValid)) setMissingModal(true);
      else if (confirmed && confirmed.status !== 0) setFeedback(lineReason(confirmed.followReason));
    } catch { setFeedback("No se pudo consultar el vehículo. Consultá el estado antes de seguir."); }
  }
  return <section className="line-device-panel line-follow-panel" aria-label="Seguimiento real de línea">
    <header className="line-follow-panel__header">
      <div>
        <span className="home-kicker">Control del vehículo</span>
        <h2>Seguimiento de línea</h2>
        <p className="line-follow-panel__intro">Calibrá los sensores y estabilizá el auto antes de iniciar.</p>
      </div>
      <span className="line-follow-panel__mode" data-ready={s?.carMode === 1}>
        {!s ? "Modo sin confirmar" : s.carMode === 1 ? "Modo FOLLOW" : "Seleccioná FOLLOW"}
      </span>
    </header>
    <MotionReadiness auto={auto} mode="FOLLOW" line={s} onLine={()=>setCalibrationModal(true)}/>
    <CarModeSelectorModal open={modeModal} recommended="FOLLOW" onClose={()=>setModeModal(false)}/>
    <div className="line-device-actions" aria-label="Seguimiento, balance y calibración">
      <TransportActionButton label={device.pending && ["Iniciando", "Deteniendo"].includes(device.action) ? `${device.action}…` : following ? "Detener seguimiento" : "Iniciar seguimiento"}
        detail={!s ? "Seguimiento sin confirmar" : following ? "Siguiendo la línea" : "Seguimiento detenido"} icon={<ConditionCheckbox checked={following} />}
        tone={s?.following ? "rose" : "cyan"} active={!!s?.following} pressed={s ? s.following : undefined}
        disabled={!device.enabled || device.pending || device.busy || (!following && (!auto.state?.mpuCalibrated || !auto.state.mpuReady || !calibrationReady || !balanceReady || !s?.routeValid || s.pattern!==2 || s.carMode!==1 || auto.busy))} onClick={() => { void toggleFollowing(); }} />
      <TransportActionButton label={s?.motionArmed ? "Desactivar balance" : "Activar balance"}
        detail={!s ? "Balance sin confirmar" : s.safetyStop ? "Parada de seguridad" : balanceReady ? "Balance estabilizado" : s.balanceActive || s.motionArmed ? "Estabilizando el vehículo" : "Balance desactivado"} icon={<ConditionCheckbox checked={balanceReady} />} tone="emerald" active={!!s?.motionArmed}
        disabled={!device.enabled || !s || device.pending || device.busy || s.carMode === 2}
        onClick={() => { void device.balance(!s?.motionArmed); }} />
      <TransportActionButton label="Calibrar sensores" detail={!s ? "Calibración sin confirmar" : calibrationReady ? "Blanco y pista calibrados" : !s.whiteValid ? "Falta calibrar blanco" : "Falta calibrar sobre pista"} icon={<ConditionCheckbox checked={calibrationReady} />} tone="muted"
        disabled={!device.enabled || device.pending} onClick={() => setCalibrationModal(true)} />
    </div>
    {(feedback || device.error) && <p className="line-device-warning" role="alert">{feedback || device.error}</p>}
    {s && !s.following && s.followReason > 0 && <p className="line-device-warning" role="status">{lineReason(s.followReason)}</p>}
    <p className="line-follow-panel__footnote">Al detener el seguimiento, el auto deja de avanzar y girar; el balance permanece activo.</p>
    {missingModal && <Modal isOpen onClose={() => setMissingModal(false)} containerClassnames="line-device-modal">
      <h2>Calibraciones pendientes</h2><p>Completá las referencias del vehículo antes de seguir la línea.</p>
      <ul>{missing.map(item => <li key={item}>{item}</li>)}</ul>
      <div className="line-device-actions">
        <button className="app-button" onClick={() => { setMissingModal(false); setCalibrationModal(true); }}>Ir a calibración</button>
        <button className="app-button" onClick={() => setMissingModal(false)}>Cerrar</button>
      </div>
    </Modal>}
    {calibrationModal && <Modal isOpen onClose={() => setCalibrationModal(false)} closeOnOverlayClick={!device.busy} containerClassnames="line-device-modal">
      <LineDeviceCalibration device={device} />
      <button className="app-button" onClick={() => setCalibrationModal(false)}>Cerrar</button>
    </Modal>}
  </section>;
}
