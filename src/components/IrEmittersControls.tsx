import { useIrEmitters, type IrEmittersState } from "../contexts/IrEmittersContext";
export default function IrEmittersControls() {
  const { state, available, pending, error, refresh, setEnabled } = useIrEmitters();
  const groups: Array<[keyof IrEmittersState, string]> = [["objects", "Objetos"], ["line", "Línea"], ["lights", "Luces"]];
  return <section className="sensor-console" aria-label="Emisores infrarrojos">
    <h3>Emisores IR</h3>
    <p>{!available ? "Conectá el equipo e iniciá una sesión STM para consultar los emisores." : state ? "Estado confirmado por el equipo." : "Estado todavía no disponible."}</p>
    {groups.map(([key, label]) => <button key={key} type="button" disabled={!available || pending || !state} aria-pressed={state?.[key] ?? false} onClick={() => void setEnabled(key, !state?.[key])}>{label}: {state ? state[key] ? "encendido" : "apagado" : "sin datos"}</button>)}
    <button type="button" disabled={!available || pending} onClick={() => void refresh()}>{pending ? "Esperando al equipo…" : "Consultar"}</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}
