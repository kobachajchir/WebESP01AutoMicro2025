import { useEffect, useRef, useState } from "react";
import type { IrSnapshot } from "../../api/UnerFrameV2";
import MaterialPicker from "./MaterialPicker";
const channels = ["lineLeft", "lineCenter", "lineRight"] as const;
const labels = ["Izquierdo", "Centro", "Derecho"];
const storageKey = "automicro.ir-line-calibration.v1";
interface LineRecord { id: string; name: string; material: string; createdAt: string; count: number; raw: number[]; normalized: number[] }
function load(): LineRecord[] {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(values)) return [];
    return values.filter((v): v is LineRecord => v && typeof v.id === "string" && typeof v.name === "string" &&
      typeof v.material === "string" && typeof v.createdAt === "string" && Number.isInteger(v.count) && v.count > 0 &&
      [v.raw, v.normalized].every((a) => Array.isArray(a) && a.length === 3 && a.every((n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 4095))).slice(0, 100);
  } catch { return []; }
}
export default function LineWorkbench({ snapshot, captureAvailable, onBusyChange }: {
  snapshot: IrSnapshot; captureAvailable: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const [material, setMaterial] = useState("Blanco"); const [name, setName] = useState("Línea · referencia");
  const [history, setHistory] = useState(load); const [capturing, setCapturing] = useState(false);
  const [count, setCount] = useState(0); const [feedback, setFeedback] = useState("Colocá la superficie bajo los tres sensores y mantené la altura del montaje.");
  const samples = useRef<{ raw: number[]; norm: number[] }[]>([]); const token = useRef(""); const settle = useRef(8);
  useEffect(() => { onBusyChange(capturing); return () => onBusyChange(false); }, [capturing, onBusyChange]);
  useEffect(() => {
    if (!capturing) return;
    if (!captureAvailable) { setCapturing(false); setFeedback("La lectura real dejó de estar disponible."); return; }
    const nextToken = `${snapshot.sampleSeq}:${snapshot.tickMs}`;
    if (snapshot.tickMs <= 0 || token.current === nextToken) return;
    token.current = nextToken;
    if (settle.current > 0) { settle.current--; return; }
    const raw = channels.map((key) => snapshot.raw[key]); const norm = channels.map((key) => snapshot.norm[key]);
    if ([...raw, ...norm].some((v) => !Number.isFinite(v))) { setCapturing(false); setFeedback("La muestra no es válida."); return; }
    samples.current.push({ raw, norm }); setCount(samples.current.length);
    if (samples.current.length < 32) return;
    const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return (sorted[15] + sorted[16]) / 2; };
    const value: LineRecord = { id: crypto.randomUUID(), name: name.trim(), material, createdAt: new Date().toISOString(), count: 32,
      raw: channels.map((_, i) => median(samples.current.map((s) => s.raw[i]))), normalized: channels.map((_, i) => median(samples.current.map((s) => s.norm[i]))) };
    setFeedback("Referencia capturada. Podés registrar la otra superficie.");
    setHistory((old) => {
      const next = [value, ...old].slice(0, 100);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { setFeedback("Referencia capturada en memoria. Exportá los datos: no se pudo guardar en este navegador."); }
      return next;
    });
    setCapturing(false);
  }, [capturing, captureAvailable, snapshot, material, name]);
  function exportRecords() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ schema: "automicro.ir-line-calibration", version: 1, group: "line", electricalPolarity: "pull-up", records: history }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "ir-line-calibration.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="ir-calibration-workbench" aria-label="Calibración de línea">
    <header className="ir-calibration-header"><div><span className="home-kicker">IR · Línea</span><h2>Medí blanco y negro</h2><p>Calibrá los tres sensores de piso a la altura real del montaje. La F4 ya normaliza su polaridad de grupo.</p></div></header>
    <div className="calibration-stage"><div className="calibration-form-section">
      <div className="ir-calibration-meta-grid"><label>Nombre del registro<input value={name} disabled={capturing} onChange={(e) => setName(e.target.value)} maxLength={160} /></label><MaterialPicker value={material} disabled={capturing} onChange={setMaterial} /></div>
      <p className="ui-muted">Línea usa pull-up; la lectura normalizada invierte el ADC crudo. Blanco y negro son referencias separadas, sin selector manual de polaridad ni distancia de objetos.</p>
      <div className="calibration-actions"><button className="app-button calibration-button--primary" disabled={capturing || !captureAvailable || !material.trim() || !name.trim()} onClick={() => { samples.current = []; token.current = `${snapshot.sampleSeq}:${snapshot.tickMs}`; settle.current = 8; setCount(0); setCapturing(true); setFeedback("Capturando referencia de línea: 8 muestras de asentamiento y 32 útiles."); }}>Capturar {material || "superficie"}</button>
        {capturing && <button className="app-button" onClick={() => { setCapturing(false); setFeedback("Captura cancelada."); }}>Cancelar</button>}</div>
      <p role="status">{capturing ? `${count}/32 muestras · ${material}` : feedback}</p>
      {!captureAvailable && <p>Activá el stream IR real para capturar.</p>}
    </div>
    <div className="ir-calibration-table-wrap"><table className="ir-calibration-table"><caption>Referencias de línea · mediana normalizada</caption><thead><tr><th>Registro</th><th>Superficie</th>{labels.map((l) => <th key={l}>{l}</th>)}</tr></thead><tbody>
      {history.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.material}</td>{r.normalized.map((n, i) => <td key={i} title={`ADC crudo: ${r.raw[i]}`}>{n.toFixed(0)}</td>)}</tr>)}
      {!history.length && <tr><td colSpan={5}>Todavía no hay referencias capturadas.</td></tr>}</tbody></table></div>
    <footer className="ir-calibration-footer"><button className="app-button" disabled={!history.length || capturing} onClick={exportRecords}>Exportar referencias</button><p>Las referencias se guardan en la Web; no modifican los umbrales del firmware.</p></footer></div>
  </section>;
}
