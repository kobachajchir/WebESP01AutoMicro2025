import { useId, useState } from "react";
import MotionControlActions from "./MotionControlActions";
import MotionControlIcon from "./MotionControlIcon";
import { useMotionControl, type MotionController } from "./useMotionControl";
import { ESP_COMMANDS } from "../../protocol/wsApi";
import "./motion.css";

export function MotionBalanceStatus({ control }: { control: MotionController }) {
  const tone = !control.state ? "unknown" : control.balanceEnabled ? "enabled" : "disabled";
  return <span className={`motion-balance-status motion-balance-status--${tone}`}
    role="status" title={control.statusText}>
    <MotionControlIcon name="balance" />
    {!control.state ? "Balance sin confirmar" : control.balanceEnabled ? "Balance activado" : "Balance desactivado"}
  </span>;
}

function MotionValueControl({ label, value, min, max, step = 1, unit, hint, disabled, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  unit: string; hint: string; disabled: boolean; onChange: (value: number) => void;
}) {
  const inputId = useId();
  const hintId = useId();
  const formatted = Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value}${unit}` : "—";
  return <div className="motion-value-control">
    <div className="motion-value-control__heading"><label htmlFor={inputId}>{label}</label><output>{formatted}</output></div>
    <input type="range" aria-label={`Ajustar ${label.toLowerCase()}`} aria-describedby={hintId}
      min={min} max={max} step={step} value={Number.isFinite(value) ? value : 0}
      disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
    <div className="motion-value-control__scale" aria-hidden="true"><span>{min}{unit}</span><span>0{unit}</span><span>+{max}{unit}</span></div>
    <div className="motion-value-control__input"><input id={inputId} className="app-input" type="number"
      aria-describedby={hintId} min={min} max={max} step={step}
      value={Number.isFinite(value) ? value : ""} disabled={disabled}
      onChange={(event) => onChange(event.target.value === "" ? NaN : Number(event.target.value))} /><span>{unit}</span></div>
    <p id={hintId}>{hint}</p>
  </div>;
}

export function MotionBalancePanel({ control, showStatus = false, defaultExpanded = false, title = "Balance" }: { control: MotionController; showStatus?: boolean; defaultExpanded?: boolean; title?: string }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [angle, setAngle] = useState(0);
  const [turn, setTurn] = useState(0);
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const panelId = useId();
  const { state, real, ready, driveReady, telemetry, run } = control;
  const driveValuesValid = Number.isFinite(angle) && Math.abs(angle) <= 6 && Number.isFinite(turn) && Math.abs(turn) <= 100;
  const testReady = ready && state?.carMode === 2 && !state.motionArmed;
  function display(key: string, suffix: string) {
    const value = telemetry?.[key];
    return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : "—";
  }

  return <section className="motion-control-panel" aria-label="Ajustes de balance y motores">
    <div className="motion-control-heading">
      <button type="button" className="motion-balance-disclosure" aria-expanded={expanded} aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}>
        <MotionControlIcon name="balance" /><span>{title}</span>
        <small>{expanded ? "Ocultar ajustes" : "Mostrar ajustes"}</small>
        <svg className={`home-dropdown-chevron ${expanded ? "home-dropdown-chevron--open" : ""}`}
          viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {showStatus && <MotionBalanceStatus control={control} />}
    </div>
    <div id={panelId} className="motion-control-body" hidden={!expanded}>
      <p className="motion-control-help">Activá el balance con el auto apoyado. Ajustá la inclinación y el giro; la placa mantiene la compensación durante el movimiento.</p>
      <div className="motion-control-grid">
        <MotionValueControl label="Inclinación objetivo" unit="°" value={angle} min={-6} max={6} step={0.1}
          hint="Negativa para retroceder, positiva para avanzar." disabled={!real} onChange={setAngle} />
        <MotionValueControl label="Giro" unit="%" value={turn} min={-100} max={100}
          hint="0 % mantiene el rumbo; el balance tiene prioridad." disabled={!real} onChange={setTurn} />
      </div>
      <div className="motion-control-command">
        <p>Un pulso dura 750 ms. Después, el objetivo vuelve a 0° y el balance continúa.</p>
        <button type="button" className="app-button motion-control-button" disabled={!driveReady || !driveValuesValid}
          onClick={() => { void run(ESP_COMMANDS.SET_MOTION, { forwardPercent: angle / 6 * 100, turnPercent: turn, durationMs: 750 }); }}>
          <MotionControlIcon name="move" />Mover · 750 ms
        </button>
      </div>
      <details className="motion-motor-test"><summary><MotionControlIcon name="test" />Prueba directa de motores en TEST</summary>
        <p className="motion-control-help">Requiere modo TEST y balance desactivado. Cada pulso termina después de 750 ms.</p>
        <div className="motion-control-grid">
          <MotionValueControl label="Motor izquierdo" unit="%" value={left} min={-100} max={100}
            hint="Esfuerzo del motor izquierdo." disabled={!testReady} onChange={setLeft} />
          <MotionValueControl label="Motor derecho" unit="%" value={right} min={-100} max={100}
            hint="Esfuerzo del motor derecho." disabled={!testReady} onChange={setRight} />
        </div>
        <div className="motion-control-command"><p>Los valores indican esfuerzo aplicado, sin medición de velocidad.</p>
          <button type="button" className="app-button motion-control-button"
            disabled={!testReady || ![left, right].every((value) => Number.isFinite(value) && Math.abs(value) <= 100)}
            onClick={() => { void run(ESP_COMMANDS.SET_MOTOR_TEST, { leftPercent: left, rightPercent: right, durationMs: 750 }); }}>
            <MotionControlIcon name="test" />Probar · 750 ms
          </button>
        </div>
      </details>
      <div className="motion-control-readings" aria-label="Lecturas de la placa">
        {[["Inclinación", "pitchMeasuredDeg", "°"], ["Objetivo", "pitchSetpointDeg", "°"],
          ["Motor izquierdo", "leftOutputPercent", "%"], ["Motor derecho", "rightOutputPercent", "%"]].map(([label, key, unit]) =>
          <div key={key}><span>{label}</span><strong>{display(key, unit)}</strong></div>)}
      </div>
    </div>
    <MotionControlFeedback control={control} />
  </section>;
}

export function MotionControlFeedback({ control }: { control: MotionController }) {
  if (control.error) return <p className="motion-control-feedback motion-control-feedback--error" role="alert">{control.error}</p>;
  if (!control.real || !control.state || control.state.safetyStop) {
    return <p className="motion-control-feedback" role="status">{control.statusText}</p>;
  }
  return null;
}

// The calibration workbench keeps its own controller and the same action components.
export default function MotionControlPanel() {
  const control = useMotionControl();
  return <div className="motion-control-workspace">
    <MotionBalancePanel control={control} showStatus />
    <div className="motion-control-actions"><MotionControlActions control={control} /></div>
  </div>;
}
