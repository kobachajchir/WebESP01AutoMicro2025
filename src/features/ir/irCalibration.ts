import {
  IR_OBJECT_ADC_MAX,
  IR_OBJECT_SENSOR_KEYS,
} from "./irObjectModel.ts";
import type {
  IrObjectForwardCalibration,
  IrObjectSensorKey,
} from "./irObjectModel.ts";

export const IR_CALIBRATION_SCHEMA_VERSION = 2 as const;
const IR_CALIBRATION_LEGACY_SCHEMA_VERSION = 1;
export const IR_CALIBRATION_SAMPLES_PER_POINT = 32;
export const IR_CALIBRATION_SETTLE_SAMPLES = 8;
export const IR_CALIBRATION_DISTANCES_CM = [
  0.2,
  0.25,
  0.3,
  0.5,
  0.75,
  1,
  1.5,
  2,
  3,
  4,
  6.4,
  10,
  15,
] as const;

export type IrCalibrationPolarity = "higher-is-closer" | "lower-is-closer";

export type IrCalibrationSample = Record<IrObjectSensorKey, number>;

export interface IrCalibrationStats {
  median: number;
  mean: number;
  min: number;
  max: number;
  p10: number;
  p90: number;
  stdDev: number;
  count: number;
}

export type IrCalibrationSensorStats = Record<
  IrObjectSensorKey,
  IrCalibrationStats
>;

export type IrCalibrationPointSensorStats = Partial<
  Record<IrObjectSensorKey, IrCalibrationStats>
>;

export interface IrCalibrationPoint {
  distanceCm: number;
  sensors: IrCalibrationPointSensorStats;
}

export interface IrCalibrationProfile {
  schemaVersion: typeof IR_CALIBRATION_SCHEMA_VERSION;
  name: string;
  createdAt: string;
  source: "real-car" | "imported";
  polarity: IrCalibrationPolarity;
  material: string;
  notes: string;
  samplesPerPoint: number;
  settleSamples: number;
  baseline: IrCalibrationSensorStats | null;
  points: IrCalibrationPoint[];
}

export interface IrCalibrationParseResult {
  ok: boolean;
  profile: IrCalibrationProfile | null;
  errors: string[];
}

export interface IrCalibrationCoverage {
  baselineReady: boolean;
  measurementCount: number;
  requiredMeasurementCount: number;
  sensorPointCounts: Record<IrObjectSensorKey, number>;
  readySensorCount: number;
  usable: boolean;
}

export function createEmptyIrCalibrationProfile(
  overrides: Partial<
    Pick<
      IrCalibrationProfile,
      "name" | "polarity" | "material" | "notes" | "source"
    >
  > = {},
): IrCalibrationProfile {
  return {
    schemaVersion: IR_CALIBRATION_SCHEMA_VERSION,
    name: overrides.name ?? "Calibración IR del auto",
    createdAt: new Date().toISOString(),
    source: overrides.source ?? "real-car",
    polarity: overrides.polarity ?? "higher-is-closer",
    material: overrides.material ?? "Blanco de prueba",
    notes: overrides.notes ?? "",
    samplesPerPoint: IR_CALIBRATION_SAMPLES_PER_POINT,
    settleSamples: IR_CALIBRATION_SETTLE_SAMPLES,
    baseline: null,
    points: [],
  };
}

export function summarizeIrCalibrationSamples(
  samples: readonly IrCalibrationSample[],
): IrCalibrationSensorStats {
  if (samples.length === 0) {
    throw new Error("La captura IR necesita al menos una muestra.");
  }

  return IR_OBJECT_SENSOR_KEYS.reduce(
    (record, key) => {
      record[key] = summarizeValues(
        samples.map((sample) => clampAdc(sample[key])),
      );
      return record;
    },
    {} as IrCalibrationSensorStats,
  );
}

export function createIrCalibrationPoint(
  distanceCm: number,
  samples: readonly IrCalibrationSample[],
): IrCalibrationPoint {
  if (!Number.isFinite(distanceCm) || distanceCm <= 0) {
    throw new Error("La distancia de calibración debe ser mayor que cero.");
  }

  return {
    distanceCm: round(distanceCm, 3),
    sensors: summarizeIrCalibrationSamples(samples),
  };
}

export function createIrCalibrationSensorPoint(
  distanceCm: number,
  sensorKey: IrObjectSensorKey,
  samples: readonly IrCalibrationSample[],
): IrCalibrationPoint {
  if (!Number.isFinite(distanceCm) || distanceCm <= 0) {
    throw new Error("La distancia de calibración debe ser mayor que cero.");
  }

  return {
    distanceCm: round(distanceCm, 3),
    sensors: {
      [sensorKey]: summarizeIrCalibrationSamples(samples)[sensorKey],
    },
  };
}

export function upsertIrCalibrationPoint(
  profile: IrCalibrationProfile,
  point: IrCalibrationPoint,
): IrCalibrationProfile {
  const existing = profile.points.find(
    (candidate) => Math.abs(candidate.distanceCm - point.distanceCm) <= 1e-6,
  );
  const mergedPoint: IrCalibrationPoint = {
    distanceCm: point.distanceCm,
    sensors: {
      ...(existing?.sensors ?? {}),
      ...point.sensors,
    },
  };
  const points = profile.points
    .filter((candidate) => Math.abs(candidate.distanceCm - point.distanceCm) > 1e-6)
    .concat(mergedPoint)
    .sort((left, right) => left.distanceCm - right.distanceCm);

  return {
    ...profile,
    createdAt: new Date().toISOString(),
    points,
  };
}

export function setIrCalibrationBaseline(
  profile: IrCalibrationProfile,
  samples: readonly IrCalibrationSample[],
): IrCalibrationProfile {
  return {
    ...profile,
    createdAt: new Date().toISOString(),
    baseline: summarizeIrCalibrationSamples(samples),
  };
}

export function parseIrCalibrationProfile(json: string): IrCalibrationParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      ok: false,
      profile: null,
      errors: ["El archivo no contiene JSON válido."],
    };
  }

  return validateIrCalibrationProfile(parsed);
}

export function validateIrCalibrationProfile(
  value: unknown,
): IrCalibrationParseResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, profile: null, errors: ["El perfil debe ser un objeto."] };
  }

  if (
    value.schemaVersion !== IR_CALIBRATION_SCHEMA_VERSION &&
    value.schemaVersion !== IR_CALIBRATION_LEGACY_SCHEMA_VERSION
  ) {
    errors.push(
      `schemaVersion debe ser ${IR_CALIBRATION_LEGACY_SCHEMA_VERSION} o ${IR_CALIBRATION_SCHEMA_VERSION}.`,
    );
  }

  const polarity = value.polarity;
  if (polarity !== "higher-is-closer" && polarity !== "lower-is-closer") {
    errors.push("polarity debe indicar si una lectura mayor o menor significa cerca.");
  }

  const points = Array.isArray(value.points) ? value.points : [];
  if (!Array.isArray(value.points)) {
    errors.push("points debe ser una lista.");
  }
  if (points.length > 128) {
    errors.push("El perfil no puede contener más de 128 puntos.");
  }

  const validatedPoints = points
    .map((point, index) => validatePoint(point, index, errors))
    .filter((point): point is IrCalibrationPoint => point !== null)
    .sort((left, right) => left.distanceCm - right.distanceCm);
  const duplicateDistance = validatedPoints.some(
    (point, index) =>
      index > 0 &&
      Math.abs(point.distanceCm - validatedPoints[index - 1].distanceCm) <= 1e-6,
  );
  if (duplicateDistance) {
    errors.push("No puede haber dos puntos con la misma distancia.");
  }

  const baseline =
    value.baseline === null || value.baseline === undefined
      ? null
      : validateSensorStats(value.baseline, "baseline", errors);

  if (errors.length > 0) {
    return { ok: false, profile: null, errors };
  }

  return {
    ok: true,
    errors: [],
    profile: {
      schemaVersion: IR_CALIBRATION_SCHEMA_VERSION,
      name: safeText(value.name, "Calibración IR importada"),
      createdAt: safeText(value.createdAt, new Date().toISOString()),
      source: value.source === "real-car" ? "real-car" : "imported",
      polarity: polarity as IrCalibrationPolarity,
      material: safeText(value.material, "Sin especificar"),
      notes: safeText(value.notes, ""),
      samplesPerPoint: positiveInteger(
        value.samplesPerPoint,
        IR_CALIBRATION_SAMPLES_PER_POINT,
      ),
      settleSamples: nonNegativeInteger(
        value.settleSamples,
        IR_CALIBRATION_SETTLE_SAMPLES,
      ),
      baseline,
      points: validatedPoints,
    },
  };
}

export function serializeIrCalibrationProfile(
  profile: IrCalibrationProfile,
): string {
  return JSON.stringify(profile, null, 2);
}

export function buildIrForwardCalibration(
  profile: IrCalibrationProfile,
): IrObjectForwardCalibration | null {
  const coverage = getIrCalibrationCoverage(profile);
  if (!coverage.usable || !profile.baseline) {
    return null;
  }

  const baselineAdc = IR_OBJECT_SENSOR_KEYS.reduce(
    (record, key) => {
      record[key] = profile.baseline?.[key].median ?? 0;
      return record;
    },
    {} as Record<IrObjectSensorKey, number>,
  );
  const curves = IR_OBJECT_SENSOR_KEYS.reduce(
    (record, key) => {
      record[key] = profile.points.flatMap((point) => {
        const stats = point.sensors[key];
        return stats
          ? [{ distanceCm: point.distanceCm, adc: stats.median }]
          : [];
      });
      return record;
    },
    {} as IrObjectForwardCalibration["curves"],
  );

  return {
    polarity: profile.polarity,
    baselineAdc,
    curves,
  };
}

export function getIrCalibrationCoverage(
  profile: IrCalibrationProfile,
): IrCalibrationCoverage {
  const sensorPointCounts = IR_OBJECT_SENSOR_KEYS.reduce(
    (record, key) => {
      record[key] = profile.points.filter((point) => point.sensors[key]).length;
      return record;
    },
    {} as Record<IrObjectSensorKey, number>,
  );
  const measurementCount = IR_OBJECT_SENSOR_KEYS.reduce(
    (sum, key) => sum + sensorPointCounts[key],
    0,
  );
  const readySensorCount = IR_OBJECT_SENSOR_KEYS.filter(
    (key) => sensorPointCounts[key] >= 2,
  ).length;
  const baselineReady = profile.baseline !== null;

  return {
    baselineReady,
    measurementCount,
    requiredMeasurementCount:
      IR_CALIBRATION_DISTANCES_CM.length * IR_OBJECT_SENSOR_KEYS.length,
    sensorPointCounts,
    readySensorCount,
    usable: baselineReady && readySensorCount === IR_OBJECT_SENSOR_KEYS.length,
  };
}

export function exportIrCalibrationAsC(
  profile: IrCalibrationProfile,
  symbolPrefix = "g_ir_object_cal",
): string {
  const calibration = buildIrForwardCalibration(profile);
  if (!calibration) {
    throw new Error(
      "La tabla C necesita baseline y al menos dos distancias por sensor.",
    );
  }

  const normalizedPrefix = normalizeCSymbol(symbolPrefix);
  const macroPrefix = normalizedPrefix.toUpperCase();
  const includeGuard = `${macroPrefix}_H`;
  const lines = [
    `#ifndef ${includeGuard}`,
    `#define ${includeGuard}`,
    "",
    "#include <stdint.h>",
    "",
    `#define ${macroPrefix}_SENSOR_COUNT 5u`,
    `#define ${macroPrefix}_LOWER_ADC_MEANS_CLOSER ${
      profile.polarity === "lower-is-closer" ? 1 : 0
    }u`,
    "",
    "typedef struct {",
    "    uint16_t distance_mm;",
    "    uint16_t adc;",
    `} ${normalizedPrefix}_point_t;`,
    "",
    "typedef struct {",
    `    const ${normalizedPrefix}_point_t *points;`,
    "    uint8_t point_count;",
    `} ${normalizedPrefix}_curve_t;`,
    "",
  ];

  IR_OBJECT_SENSOR_KEYS.forEach((key, sensorIndex) => {
    const curve = calibration.curves[key];
    lines.push(
      `static const ${normalizedPrefix}_point_t ${normalizedPrefix}_sensor_${sensorIndex}[${curve.length}] = {`,
    );
    curve.forEach((point) => {
      lines.push(
        `    { ${Math.round(point.distanceCm * 10)}u, ${Math.round(point.adc)}u },`,
      );
    });
    lines.push("};", "");
  });

  lines.push(
    `static const ${normalizedPrefix}_curve_t ${normalizedPrefix}_curves[${macroPrefix}_SENSOR_COUNT] = {`,
  );
  IR_OBJECT_SENSOR_KEYS.forEach((key, sensorIndex) => {
    lines.push(
      `    { ${normalizedPrefix}_sensor_${sensorIndex}, ${calibration.curves[key].length}u },`,
    );
  });
  lines.push("};", "");
  lines.push(
    `static const uint16_t ${normalizedPrefix}_baseline_adc[${macroPrefix}_SENSOR_COUNT] = { ${IR_OBJECT_SENSOR_KEYS.map(
      (key) => Math.round(calibration.baselineAdc[key]),
    ).join(", ")} };`,
    "",
    `#endif /* ${includeGuard} */`,
  );
  return lines.join("\n");
}

function validatePoint(
  value: unknown,
  index: number,
  errors: string[],
): IrCalibrationPoint | null {
  if (!isRecord(value)) {
    errors.push(`points[${index}] debe ser un objeto.`);
    return null;
  }

  const distanceCm = Number(value.distanceCm);
  if (!Number.isFinite(distanceCm) || distanceCm <= 0 || distanceCm > 100) {
    errors.push(`points[${index}].distanceCm está fuera de rango.`);
    return null;
  }

  const sensors = validatePointSensorStats(
    value.sensors,
    `points[${index}].sensors`,
    errors,
  );
  return sensors ? { distanceCm, sensors } : null;
}

function validatePointSensorStats(
  value: unknown,
  path: string,
  errors: string[],
): IrCalibrationPointSensorStats | null {
  if (!isRecord(value)) {
    errors.push(`${path} debe contener al menos un sensor.`);
    return null;
  }

  const result: IrCalibrationPointSensorStats = {};
  IR_OBJECT_SENSOR_KEYS.forEach((key) => {
    if (value[key] === undefined) {
      return;
    }
    const stats = validateStats(value[key], `${path}.${key}`, errors);
    if (stats) {
      result[key] = stats;
    }
  });

  if (Object.keys(result).length === 0) {
    errors.push(`${path} debe contener al menos un sensor válido.`);
    return null;
  }

  return result;
}

function validateSensorStats(
  value: unknown,
  path: string,
  errors: string[],
): IrCalibrationSensorStats | null {
  if (!isRecord(value)) {
    errors.push(`${path} debe contener los cinco sensores.`);
    return null;
  }

  const result = {} as IrCalibrationSensorStats;

  IR_OBJECT_SENSOR_KEYS.forEach((key) => {
    const stats = validateStats(value[key], `${path}.${key}`, errors);
    if (stats) {
      result[key] = stats;
    }
  });

  return result;
}

function validateStats(
  value: unknown,
  path: string,
  errors: string[],
): IrCalibrationStats | null {
  if (!isRecord(value)) {
    errors.push(`${path} no contiene estadísticas.`);
    return null;
  }

  const numericFields = [
    "median",
    "mean",
    "min",
    "max",
    "p10",
    "p90",
    "stdDev",
    "count",
  ] as const;
  const invalidField = numericFields.find(
    (field) => !Number.isFinite(Number(value[field])),
  );
  if (invalidField) {
    errors.push(`${path}.${invalidField} no es numérico.`);
    return null;
  }

  return {
    median: clampAdc(Number(value.median)),
    mean: clampAdc(Number(value.mean)),
    min: clampAdc(Number(value.min)),
    max: clampAdc(Number(value.max)),
    p10: clampAdc(Number(value.p10)),
    p90: clampAdc(Number(value.p90)),
    stdDev: Math.max(0, Number(value.stdDev)),
    count: positiveInteger(value.count, 1),
  };
}

function summarizeValues(values: readonly number[]): IrCalibrationStats {
  const sorted = [...values].sort((left, right) => left - right);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance =
    sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    sorted.length;

  return {
    median: percentile(sorted, 0.5),
    mean,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p10: percentile(sorted, 0.1),
    p90: percentile(sorted, 0.9),
    stdDev: Math.sqrt(variance),
    count: sorted.length,
  };
}

function percentile(sorted: readonly number[], percentileValue: number) {
  if (sorted.length === 1) {
    return sorted[0];
  }

  const position = clamp(percentileValue, 0, 1) * (sorted.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const fraction = position - lowerIndex;
  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * fraction;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeText(value: unknown, fallback: string) {
  return typeof value === "string" ? value.slice(0, 240) : fallback;
}

function clampAdc(value: number) {
  return Math.round(clamp(Number(value) || 0, 0, IR_OBJECT_ADC_MAX));
}

function positiveInteger(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0
    ? Math.max(1, Math.round(numeric))
    : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0
    ? Math.max(0, Math.round(numeric))
    : fallback;
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeCSymbol(value: string) {
  const normalized = value.replace(/[^a-zA-Z0-9_]/g, "_") || "ir_cal";
  return /^[0-9]/.test(normalized) ? `_${normalized}` : normalized;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
