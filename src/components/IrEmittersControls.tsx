import { useId, type ReactNode } from "react";
import { useIrEmitters } from "../contexts/IrEmittersContext";
import { WHITE_LED_HALF_ANGLE_DEG } from "../features/ir/irEmitterGeometry";
import ToggleButton from "./ToggleButton";

export default function IrEmittersControls({ icon }: {
  icon?: ReactNode;
}) {
  const { state, available, pending, error, refresh, setEnabled } = useIrEmitters();
  const statusId = useId();
  const disabled = !available || pending || !state;
  return <div className="sensor-light-tools" aria-busy={pending}>
    <div className="sensor-light-tools__control" role="group" aria-label="LED blancos" aria-describedby={statusId}>
      <span className="sensor-light-tools__label">{icon}<span>LED blancos</span></span>
      <ToggleButton checked={state?.lights ?? false} disabled={disabled}
        ariaLabel="Encender o apagar LED blancos" className="sensor-emission-switch"
        onChange={(enabled) => void setEnabled("lights", enabled)} />
    </div>
    <p className="sensor-light-tools__angle">Apertura fija: ±{WHITE_LED_HALF_ANGLE_DEG}° desde el eje del LED.</p>
    <p id={statusId} className="sensor-light-tools__status" role="status">
      {!available ? "Requiere conexión y sesión STM." : pending ? "Esperando al equipo…"
        : state ? `Estado confirmado: ${state.lights ? "encendidos" : "apagados"}.` : "Estado todavía no disponible."}
    </p>
    {error ? <p className="sensor-emission-panel__error" role="alert">{error}</p> : null}
    {available && (error || !state) ? <button type="button" className="sensor-console-secondary"
      disabled={pending} onClick={() => void refresh()}>Consultar emisores</button> : null}
  </div>;
}
