export default function MaterialPicker({ value, onChange, disabled = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const custom = value !== "Blanco" && value !== "Negro";
  return <div className="calibration-material-picker">
    <span>Superficie de calibración</span>
    <div className="calibration-actions" role="group" aria-label="Color de la superficie">
      {(["Blanco", "Negro"] as const).map((color) => <button key={color} type="button" className="app-button" aria-pressed={value === color} disabled={disabled} onClick={() => onChange(color)}><span className={`calibration-swatch calibration-swatch--${color === "Blanco" ? "white" : "black"}`} aria-hidden="true" />{color}</button>)}
    </div>
    <label className="calibration-checkbox"><input type="checkbox" checked={custom} disabled={disabled} onChange={(e) => onChange(e.target.checked ? "" : "Blanco")} />Personalizado</label>
    {custom && <label>Nombre de la superficie<input value={value} disabled={disabled} maxLength={160} placeholder="Ej. Cinta gris mate" onChange={(e) => onChange(e.target.value)} /></label>}
  </div>;
}
