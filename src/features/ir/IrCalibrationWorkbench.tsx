import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { IrSnapshot } from "../../api/UnerFrameV2";
import {
  IR_CALIBRATION_DISTANCES_CM,
  createEmptyIrCalibrationProfile,
  createIrCalibrationSensorPoint,
  exportIrCalibrationAsC,
  getIrCalibrationCoverage,
  parseIrCalibrationProfile,
  serializeIrCalibrationProfile,
  setIrCalibrationBaseline,
  upsertIrCalibrationPoint,
} from "./irCalibration";
import type {
  IrCalibrationProfile,
  IrCalibrationSample,
} from "./irCalibration";
import { IR_OBJECT_SENSOR_KEYS } from "./irObjectModel";
import type { IrObjectSensorKey } from "./irObjectModel";
import { IR_MAX_RANGE_CM } from "./irEmitterGeometry";
import MaterialPicker from "../calibration/MaterialPicker";

interface IrCalibrationWorkbenchProps {
  profile: IrCalibrationProfile;
  snapshot: IrSnapshot;
  captureAvailable: boolean;
  onProfileChange: (profile: IrCalibrationProfile) => void;
  onBusyChange?: (busy: boolean) => void;
}

interface CaptureState {
  kind: "baseline" | "point";
  distanceCm: number | null;
  sensorKey: IrObjectSensorKey | null;
  settleRemaining: number;
  samples: IrCalibrationSample[];
}

const SENSOR_LABELS: Record<IrObjectSensorKey, string> = {
  objectLeft45: "IZQ 45°",
  objectLeftCenter: "IZQ",
  objectCenter: "CENTRO",
  objectRightCenter: "DER",
  objectRight45: "DER 45°",
};

export default function IrCalibrationWorkbench({
  profile,
  snapshot,
  captureAvailable,
  onProfileChange,
  onBusyChange,
}: IrCalibrationWorkbenchProps) {
  const [selectedDistanceCm, setSelectedDistanceCm] = useState<number>(
    IR_CALIBRATION_DISTANCES_CM[0],
  );
  const [selectedSensorKey, setSelectedSensorKey] =
    useState<IrObjectSensorKey>("objectCenter");
  const [capture, setCapture] = useState<CaptureState | null>(null);
  const [feedback, setFeedback] = useState(
    "Colocá el blanco en una distancia fija y tomá un punto.",
  );
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const lastSampleTokenRef = useRef("");
  const [step, setStep] = useState<"prepare" | "capture" | "results">("prepare");
  useEffect(() => { onBusyChange?.(capture !== null); return () => onBusyChange?.(false); }, [capture, onBusyChange]);
  useEffect(() => {
    if (capture && !captureAvailable) { setCapture(null); setFeedback("Captura interrumpida: la lectura real dejó de estar disponible."); }
  }, [capture, captureAvailable]);

  useEffect(() => {
    if (!capture || !captureAvailable || snapshot.tickMs <= 0) {
      return;
    }

    const token = `${snapshot.sampleSeq}:${snapshot.tickMs}`;
    if (lastSampleTokenRef.current === token) {
      return;
    }
    lastSampleTokenRef.current = token;

    if (capture.settleRemaining > 0) {
      const settleRemaining = capture.settleRemaining - 1;
      setCapture({ ...capture, settleRemaining });
      setFeedback(
        `Estabilizando lectura: ${settleRemaining} muestra(s) por descartar.`,
      );
      return;
    }

    const samples = [...capture.samples, pickObjectSample(snapshot)];
    if (samples.length < profile.samplesPerPoint) {
      setCapture({ ...capture, samples });
      setFeedback(
        `Capturando ${samples.length}/${profile.samplesPerPoint} muestras útiles.`,
      );
      return;
    }

    if (capture.kind === "baseline") {
      onProfileChange(setIrCalibrationBaseline(profile, samples));
      setFeedback("Baseline sin objeto guardado.");
    } else if (capture.distanceCm !== null && capture.sensorKey !== null) {
      const point = createIrCalibrationSensorPoint(
        capture.distanceCm,
        capture.sensorKey,
        samples,
      );
      onProfileChange(upsertIrCalibrationPoint(profile, point));
      setFeedback(
        `${SENSOR_LABELS[capture.sensorKey]} a ${formatDistance(capture.distanceCm)} cm guardado.`,
      );
    }
    setCapture(null);
  }, [capture, captureAvailable, onProfileChange, profile, snapshot]);

  const progress = capture
    ? capture.settleRemaining > 0
      ? 0
      : Math.min(1, capture.samples.length / profile.samplesPerPoint)
    : 0;
  const isCapturing = capture !== null;
  const coverage = getIrCalibrationCoverage(profile);
  const hasUsableCurve = coverage.usable;

  function startCapture(kind: CaptureState["kind"]) {
    if (!profile.material.trim()) { setFeedback("Poné un nombre a la superficie personalizada antes de capturar."); return; }
    if (!captureAvailable) {
      setFeedback(
        "Para medir necesitás conexión real, stream IR activo y emulador IR apagado.",
      );
      return;
    }

    lastSampleTokenRef.current = "";
    setCapture({
      kind,
      distanceCm: kind === "point" ? selectedDistanceCm : null,
      sensorKey: kind === "point" ? selectedSensorKey : null,
      settleRemaining: profile.settleSamples,
      samples: [],
    });
    setFeedback(
      kind === "baseline"
        ? "Retirá el objeto: comenzando captura de baseline."
        : `Mantené el blanco fijo sobre el eje ${SENSOR_LABELS[selectedSensorKey]} a ${formatDistance(selectedDistanceCm)} cm.`,
    );
  }

  function updateProfile(patch: Partial<IrCalibrationProfile>) {
    onProfileChange({ ...profile, ...patch, createdAt: new Date().toISOString() });
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const parsed = parseIrCalibrationProfile(await file.text());
    if (!parsed.ok || !parsed.profile) {
      setImportErrors(parsed.errors);
      setFeedback("El perfil no pudo cargarse.");
      return;
    }

    setImportErrors([]);
    onProfileChange({
      ...parsed.profile,
      polarity: "higher-is-closer",
      source: "imported",
      createdAt: new Date().toISOString(),
    });
    setFeedback(`Perfil “${parsed.profile.name}” cargado y aplicado.`);
  }

  function removePoint(distanceCm: number) {
    updateProfile({
      points: profile.points.filter(
        (point) => Math.abs(point.distanceCm - distanceCm) > 1e-6,
      ),
    });
  }

  function resetProfile() {
    onProfileChange(
      createEmptyIrCalibrationProfile({
        name: profile.name,
        material: profile.material,
        polarity: profile.polarity,
      }),
    );
    setCapture(null);
    setFeedback("Se eliminaron los puntos de calibración.");
  }

  return (
    <section className="ir-calibration-workbench" aria-label="Calibración de sensores IR">
      <header className="ir-calibration-header">
        <div>
          <span className="home-kicker">IR · Objetos</span>
          <h2>{step === "prepare" ? "Prepará la medición" : step === "capture" ? "Registrá la respuesta" : "Compará los resultados"}</h2>
          <p>
            {step === "prepare" ? "Definí el perfil y mantené las mismas condiciones durante el ensayo." : step === "capture" ? "Elegí un sensor y una distancia. Mantené el blanco fijo durante la captura." : "Revisá la curva por sensor y conservá el perfil de la sesión."}
          </p>
        </div>
        <div
          className={`ir-calibration-state ${
            hasUsableCurve ? "ir-calibration-state--ready" : ""
          }`}
        >
          <strong>
            {hasUsableCurve
              ? "Perfil en uso"
              : coverage.baselineReady
                ? "Referencia lista"
                : "Sin referencia"}
          </strong>
          <span>
            {coverage.measurementCount}/{coverage.requiredMeasurementCount} puntos · {coverage.readySensorCount}/5 sensores
            {hasUsableCurve && coverage.measurementCount < coverage.requiredMeasurementCount
              ? " · extrapola"
              : ""}
          </span>
        </div>
      </header>

      <nav className="calibration-steps" aria-label="Pasos de calibración IR">
        {(["prepare", "capture", "results"] as const).map((value, i) => <button key={value} disabled={isCapturing} aria-current={step === value ? "step" : undefined} onClick={() => setStep(value)}><span>{String(i + 1).padStart(2, "0")}</span>{value === "prepare" ? "Preparar" : value === "capture" ? "Registrar" : "Resultados"}</button>)}
      </nav>
      <div className="calibration-stage" hidden={step !== "prepare"}>
      <div className="calibration-setup-layout">
      <div className="calibration-form-section">
        <div className="calibration-section-label"><span className="home-kicker">Configuración</span><h3>Un perfil para cada condición</h3><p>Identificá el blanco y la respuesta del sensor antes de registrar los puntos.</p></div>
      <div className="ir-calibration-meta-grid">
        <label>
          Nombre del perfil
          <input
            value={profile.name}
            placeholder="Ej. Cartón blanco · luz interior"
            onChange={(event) => updateProfile({ name: event.target.value })}
          />
        </label>
        <MaterialPicker value={profile.material} onChange={(material) => updateProfile({ material, polarity: "higher-is-closer" })} />
        <p className="ui-muted">Objetos · cinco canales. La polaridad se toma de la configuración del grupo en la F4.</p>
      </div>
      </div>
      <aside className="calibration-reference">
        <span className="home-kicker">Referencia de ensayo</span>
        <div className="calibration-range"><strong>{IR_MAX_RANGE_CM}</strong><span>cm<small>alcance configurado</small></span></div>
        <p>Usá el mismo material e iluminación durante toda la sesión. El alcance útil se confirma con las mediciones.</p>
        <dl><div><dt>Muestras por punto</dt><dd>{profile.samplesPerPoint}</dd></div><div><dt>Descartadas al inicio</dt><dd>{profile.settleSamples}</dd></div><div><dt>Canales de objetos</dt><dd>5</dd></div></dl>
      </aside>
      </div>
      <div className="calibration-stage-footer"><p>Comenzá con una referencia sin objeto.</p><button className="app-button calibration-button--primary" disabled={!profile.material.trim()} onClick={() => { if (profile.polarity !== "higher-is-closer") updateProfile({ polarity: "higher-is-closer" }); setStep("capture"); }}>Comenzar medición <span aria-hidden="true">→</span></button></div>
      </div>
      <div className="calibration-stage" hidden={step !== "capture"}>
      <div className="ir-calibration-capture-card">
        <div className="ir-calibration-capture-heading">
          <h3>Capturar una medición</h3>
          <span className={`ir-calibration-availability ${captureAvailable ? "ir-calibration-availability--ready" : ""}`} role="status">
            {captureAvailable ? "Lectura real disponible" : "Activá IR real para capturar"}
          </span>
        </div>
        <div className="ir-calibration-distance-picker">
          <label>
            Sensor ensayado
            <select
              value={selectedSensorKey}
              disabled={isCapturing}
              onChange={(event) =>
                setSelectedSensorKey(event.target.value as IrObjectSensorKey)
              }
            >
              {IR_OBJECT_SENSOR_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SENSOR_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Distancia fija
            <select
              value={selectedDistanceCm}
              disabled={isCapturing}
              onChange={(event) =>
                setSelectedDistanceCm(Number(event.target.value))
              }
            >
              {IR_CALIBRATION_DISTANCES_CM.map((distanceCm) => (
                <option key={distanceCm} value={distanceCm}>
                  {formatDistance(distanceCm)} cm
                </option>
              ))}
            </select>
          </label>
          <p>
            Medí desde el centro frontal de la lente emisora hasta la cara del
            blanco, siguiendo el eje del cono. Alinealo perpendicular a ese eje; la captura
            conserva sólo ese canal para no contaminar las otras curvas.
          </p>
        </div>
        <div className="ir-calibration-actions">
          <button
            type="button"
            className="calibration-button--primary"
            disabled={isCapturing || !captureAvailable}
            onClick={() => startCapture("point")}
          >
            Tomar punto
          </button>
          <button
            type="button"
            className="ir-calibration-button--secondary"
            disabled={isCapturing || !captureAvailable}
            onClick={() => startCapture("baseline")}
          >
            Tomar referencia sin objeto
          </button>
          {isCapturing ? (
            <button
              type="button"
              className="ir-calibration-button--danger"
              onClick={() => {
                setCapture(null);
                setFeedback("Captura cancelada.");
              }}
            >
              Cancelar
            </button>
          ) : null}
        </div>
        <div className="ir-calibration-progress" aria-live="polite">
          <div>
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <p>{feedback}</p>
        </div>
      </div>
      <div className="calibration-stage-footer"><p>Cada punto conserva únicamente el canal seleccionado.</p><button className="app-button" disabled={isCapturing} onClick={() => setStep("results")}>Ver resultados <span aria-hidden="true">→</span></button></div>
      </div>
      <div className="calibration-stage" hidden={step !== "results"}>
      <label className="calibration-curve-picker">Curva del sensor
        <select className="app-input" value={selectedSensorKey} onChange={(event) => setSelectedSensorKey(event.target.value as IrObjectSensorKey)}>
          {IR_OBJECT_SENSOR_KEYS.map((key) => <option key={key} value={key}>{SENSOR_LABELS[key]}</option>)}
        </select>
      </label>
      <IrCurve profile={profile} sensorKey={selectedSensorKey} />
      <div className="ir-calibration-table-wrap">
        <table className="ir-calibration-table">
          <caption>Resultados · mediana ADC por sensor</caption>
          <thead>
            <tr>
              <th>Distancia</th>
              {IR_OBJECT_SENSOR_KEYS.map((key) => (
                <th key={key}>{SENSOR_LABELS[key]}</th>
              ))}
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {profile.baseline ? (
              <tr>
                <td>Sin objeto</td>
                {IR_OBJECT_SENSOR_KEYS.map((key) => (
                  <td key={key}>{Math.round(profile.baseline?.[key].median ?? 0)}</td>
                ))}
                <td>Referencia</td>
              </tr>
            ) : null}
            {profile.points.map((point) => (
              <tr key={point.distanceCm}>
                <td>
                  {formatDistance(point.distanceCm)} cm
                  {point.distanceCm > IR_MAX_RANGE_CM ? (
                    <span className="ui-muted"> · Histórico, fuera del rango activo</span>
                  ) : null}
                </td>
                {IR_OBJECT_SENSOR_KEYS.map((key) => {
                  const stats = point.sensors[key];
                  return (
                    <td
                      key={key}
                      title={
                        stats
                          ? `p10 ${Math.round(stats.p10)} · p90 ${Math.round(stats.p90)}`
                          : `${SENSOR_LABELS[key]} todavía no fue medido a esta distancia`
                      }
                    >
                      {stats ? Math.round(stats.median) : "—"}
                    </td>
                  );
                })}
                <td>
                  <button type="button" onClick={() => removePoint(point.distanceCm)}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
            {profile.points.length === 0 && !profile.baseline ? (
              <tr>
                <td colSpan={7}>Todavía no hay mediciones cargadas.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {importErrors.length > 0 ? (
        <div className="ir-calibration-errors">
          {importErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <footer className="ir-calibration-footer">
        <label className="ir-calibration-file-button">
          Cargar JSON
          <input type="file" accept="application/json,.json" onChange={handleImport} />
        </label>
        <button
          type="button"
          onClick={() =>
            downloadText(
              `${safeFileName(profile.name)}.json`,
              serializeIrCalibrationProfile(profile),
              "application/json",
            )
          }
        >
          Exportar JSON
        </button>
        <button
          type="button"
          disabled={!coverage.usable}
          onClick={() =>
            downloadText(
              `${safeFileName(profile.name)}.h`,
              exportIrCalibrationAsC(profile),
              "text/x-c",
            )
          }
        >
          Exportar tabla C
        </button>
        <button
          type="button"
          className="ir-calibration-button--danger"
          onClick={resetProfile}
        >
          Limpiar perfil
        </button>
      </footer>
      <p className="ui-muted">El perfil se usa en la web al guardar cada medición. Exportar una tabla C no la instala en la F4. Los valores fuera de 5 cm se conservan como históricos.</p>
      </div>
    </section>
  );
}

function IrCurve({ profile, sensorKey }: { profile: IrCalibrationProfile; sensorKey: IrObjectSensorKey }) {
  const points = profile.points.filter((p) => p.distanceCm <= IR_MAX_RANGE_CM && p.sensors[sensorKey]);
  if (points.length < 2) return <p>Registrá al menos dos distancias de este sensor para ver su curva.</p>;
  const values = points.map((p) => ({ distance: p.distanceCm, stats: p.sensors[sensorKey]! }));
  const max = Math.max(1, ...values.map((p) => p.stats.p90));
  const x = (distance: number) => 45 + distance / IR_MAX_RANGE_CM * 700;
  const y = (adc: number) => 200 - adc / max * 175;
  const sign = profile.polarity === "higher-is-closer" ? -1 : 1;
  const ambiguous = values.slice(1).some((p, i) => (p.stats.median - values[i].stats.median) * sign < 0);
  return <figure className="calibration-chart"><svg viewBox="0 0 800 235" role="img" aria-label={`Curva de ${SENSOR_LABELS[sensorKey]} hasta 5 cm. Mediana y dispersión p10–p90 de la lectura normalizada.`}>
    {values.map((p) => <line key={p.distance} x1={x(p.distance)} x2={x(p.distance)} y1={y(p.stats.p10)} y2={y(p.stats.p90)} className="calibration-series-1" strokeWidth="4" />)}
    <polyline points={values.map((p) => `${x(p.distance)},${y(p.stats.median)}`).join(" ")} className="calibration-series-0" fill="none" strokeWidth="2" />
    <text x="45" y="228" fill="currentColor">0 cm</text><text x="700" y="228" fill="currentColor">5 cm</text><text x="45" y="16" fill="currentColor">Lectura normalizada · hasta {max.toFixed(0)}</text>
  </svg><figcaption>Mediana y dispersión p10–p90. {ambiguous ? "La curva no es monótona: una lectura puede corresponder a más de una distancia." : "La curva describe únicamente los puntos medidos y las condiciones del perfil."}</figcaption></figure>;
}

function pickObjectSample(snapshot: IrSnapshot): IrCalibrationSample {
  return Object.fromEntries(
    IR_OBJECT_SENSOR_KEYS.map((key) => [key, snapshot.norm[key] ?? 0]),
  ) as IrCalibrationSample;
}

function downloadText(fileName: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ir-calibration"
  );
}

function formatDistance(value: number) {
  if (Number.isInteger(value)) {
    return value.toFixed(0);
  }
  return Number.isInteger(value * 10) ? value.toFixed(1) : value.toFixed(2);
}
