import { useEffect } from "react";
import TransportActionButton from "../../components/TransportActionButton";
import { lineReason, useLineDevice } from "./useLineDevice";
import type { LineDevice } from "./useLineDevice";
import "./lineFollow.css";

const phases = ["IR apagados · luces apagadas", "IR encendidos · luces apagadas", "IR encendidos · luces encendidas", "IR apagados · luces encendidas"];
export default function LineDeviceCalibration({ device }: { device: LineDevice }) {
  const { state: s, pending, busy, enabled, ownsCalibration } = device;
  const ready = enabled && !!s && !pending && !busy;
  return <section className="line-device-panel" aria-label="Calibrar sensores infrarrojos de línea">
    <header><span className="home-kicker">Sensores infrarrojos · Calibrar</span><h2>Referencias del vehículo</h2>
      <p>Las dos calibraciones se guardan en el auto y se comparten entre OLED, Web y Qt.</p></header>
    <div className="line-device-status" role="status">
      <span>Blanco: <strong>{!s ? "Sin confirmar" : s.whiteValid ? "Calibrado" : "Pendiente"}</strong></span>
      <span>Sobre pista: <strong>{!s ? "Sin confirmar" : s.trackValid ? "Calibrado" : "Pendiente"}</strong></span>
    </div>
    <div className="line-device-actions">
      <TransportActionButton label="Calibrar blanco" detail="Los tres sensores sobre blanco" icon="1" tone="cyan"
        disabled={!ready} onClick={() => { void device.calibrate(0); }} />
      <TransportActionButton label="Calibrar sobre pista" detail="Izquierda blanca · centro negro · derecha blanca" icon="2" tone="cyan"
        disabled={!ready || !s?.whiteValid} onClick={() => { void device.calibrate(1); }} />
    </div>
    {s?.calibrationState === 1 && <div className="line-device-instructions" role="status">
      <h3>{s.target === 0 ? "Preparar blanco" : "Preparar sobre pista"}</h3>
      <p>{s.target === 0 ? "Colocá los tres sensores sobre una superficie blanca." : "Alineá el auto con la pista: centro sobre la cinta negra y ambos laterales sobre blanco."} Mantenelo vertical y quieto, a la altura habitual.</p>
      <p>Al seleccionar OK, el auto mide automáticamente las cuatro combinaciones de IR y luces blancas, con los motores desactivados.</p>
      <button className="app-button" disabled={pending || !ownsCalibration} onClick={() => { void device.calibrate(2); }}>OK · iniciar medición</button>
    </div>}
    {s && s.calibrationState >= 2 && s.calibrationState <= 4 && <div className="line-device-instructions" role="status" aria-live="polite">
      <strong>{s.calibrationState === 2 ? "Esperando que el auto esté quieto" : s.calibrationState === 4 ? "Guardando en el vehículo" : phases[Math.min(s.phase, 3)]}</strong>
      <progress max={100} value={s.progress} aria-label="Progreso de calibración" />
      <span>{s.progress}% · {s.usefulScans.toLocaleString()} lecturas útiles por sensor</span>
    </div>}
    {busy && <button className="app-button" disabled={pending || !ownsCalibration} onClick={() => { void device.calibrate(3); }}>Cancelar calibración</button>}
    {busy && !ownsCalibration && <p className="line-device-warning" role="status">Hay una calibración iniciada desde otra interfaz. Podés observar su progreso.</p>}
    {s?.calibrationState === 5 && <p role="status">Calibración guardada. Recalibrar blanco deja pendiente la referencia sobre pista.</p>}
    {s?.calibrationState === 6 && <p className="line-device-warning" role="alert">{lineReason(s.calibrationReason)}. La referencia anterior se conserva.</p>}
    <p>Aproximadamente 2,3 segundos por opción: 1.280 lecturas útiles por fase y sensor, 5.120 en total. Mantené el auto quieto hasta que confirme el guardado.</p>
    {device.error && <p className="line-device-warning" role="alert">{device.error}</p>}
    {!s && <button className="app-button" disabled={!enabled || pending} onClick={() => { void device.refresh().catch(() => {}); }}>Consultar calibración</button>}
    {!enabled && <p role="status">Conectá el vehículo e iniciá sesión para calibrar.</p>}
    {s?.trackValid && <details><summary>Valores calibrados</summary>
      {[s.white, s.track].map((profile, index) => <div key={index}>
        <strong>{index === 0 ? "Blanco" : "Sobre pista"}</strong>
        {profile.means.map((values, phase) => <p key={phase}>{phases[phase]}: {values.join(" / ")}</p>)}
      </div>)}
    </details>}
  </section>;
}

export function LineDeviceCalibrationPanel({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) {
  const device = useLineDevice();
  useEffect(() => { onBusyChange?.(device.busy || device.pending); return () => onBusyChange?.(false); }, [device.busy, device.pending, onBusyChange]);
  return <LineDeviceCalibration device={device} />;
}
