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

interface IrCalibrationWorkbenchProps {
  profile: IrCalibrationProfile;
  snapshot: IrSnapshot;
  captureAvailable: boolean;
  onProfileChange: (profile: IrCalibrationProfile) => void;
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
          <span className="home-kicker">Calibración desde el auto</span>
          <h2>Curva distancia → ADC</h2>
          <p>
            Cada punto descarta {profile.settleSamples} muestras y resume las
            siguientes {profile.samplesPerPoint} con mediana y dispersión.
          </p>
        </div>
        <div
          className={`ir-calibration-state ${
            hasUsableCurve ? "ir-calibration-state--ready" : ""
          }`}
        >
          <strong>
            {hasUsableCurve
              ? "CURVA APLICADA"
              : coverage.baselineReady
                ? "CALIBRANDO"
                : "FALTA BASELINE"}
          </strong>
          <span>
            {coverage.measurementCount}/{coverage.requiredMeasurementCount} puntos · {coverage.readySensorCount}/5 sensores
            {hasUsableCurve && coverage.measurementCount < coverage.requiredMeasurementCount
              ? " · extrapola"
              : ""}
          </span>
        </div>
      </header>

      <div className="ir-calibration-meta-grid">
        <label>
          Nombre del perfil
          <input
            value={profile.name}
            onChange={(event) => updateProfile({ name: event.target.value })}
          />
        </label>
        <label>
          Blanco o material
          <input
            value={profile.material}
            onChange={(event) => updateProfile({ material: event.target.value })}
          />
        </label>
        <label>
          Polaridad de cercanía
          <select
            value={profile.polarity}
            onChange={(event) =>
              updateProfile({
                polarity: event.target.value as IrCalibrationProfile["polarity"],
              })
            }
          >
            <option value="higher-is-closer">ADC mayor = más cerca</option>
            <option value="lower-is-closer">ADC menor = más cerca</option>
          </select>
        </label>
      </div>

      <div className="ir-calibration-capture-card">
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
            Medí desde el centro del sensor seleccionado hasta la cara del
            blanco. Alinealo sobre ese cono y perpendicular a su eje; la captura
            conserva sólo ese canal para no contaminar las otras curvas.
          </p>
        </div>
        <div className="ir-calibration-actions">
          <button
            type="button"
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
            Capturar sin objeto
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

      <div className="ir-calibration-table-wrap">
        <table className="ir-calibration-table">
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
                <td>Baseline</td>
              </tr>
            ) : null}
            {profile.points.map((point) => (
              <tr key={point.distanceCm}>
                <td>{formatDistance(point.distanceCm)} cm</td>
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
    </section>
  );
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
