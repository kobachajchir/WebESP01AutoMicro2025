import type { IrSensorKey } from "../../api/UnerFrameV2";

export const IR_OBJECT_ADC_MAX = 4095;
export const IR_OBJECT_DETECTION_THRESHOLD = 130;
export const IR_OBJECT_CONE_APERTURE_DEG = 30;
export const IR_OBJECT_CONE_HALF_ANGLE_DEG = IR_OBJECT_CONE_APERTURE_DEG / 2;

export const IR_OBJECT_SENSOR_KEYS = [
  "objectLeft45",
  "objectLeftCenter",
  "objectCenter",
  "objectRightCenter",
  "objectRight45",
] as const satisfies readonly IrSensorKey[];

export type IrObjectSensorKey = (typeof IR_OBJECT_SENSOR_KEYS)[number];

export interface IrObjectPoint {
  lateralCm: number;
  forwardCm: number;
  verticalCm?: number;
}

export interface IrObjectSensorGeometry {
  key: IrObjectSensorKey;
  label: string;
  offsetCm: number;
  bearingDeg: number;
}

export interface IrObjectCalibrationCurvePoint {
  distanceCm: number;
  adc: number;
}

export interface IrObjectForwardCalibration {
  polarity: "higher-is-closer" | "lower-is-closer";
  baselineAdc: Record<IrObjectSensorKey, number>;
  curves: Record<
    IrObjectSensorKey,
    readonly IrObjectCalibrationCurvePoint[]
  >;
}

export interface IrObjectForwardOptions {
  reflectivity?: number;
  ambientAdc?: number;
  gain?: number;
  distanceExponent?: number;
  angularExponent?: number;
  detectionThreshold?: number;
  calibration?: IrObjectForwardCalibration | null;
}

export interface IrObjectForwardResult {
  readings: Record<IrObjectSensorKey, number>;
  strengths: Record<IrObjectSensorKey, number>;
  activeMask: number;
  supportCount: number;
}

export interface IrObjectPositionEstimate extends IrObjectPoint {
  detected: boolean;
  rangeCm: number;
  bearingDeg: number;
  confidence: number;
  ambiguous: boolean;
  supportCount: number;
  activeMask: number;
  activeSensors: IrObjectSensorKey[];
  estimatedReflectivity: number;
  residual: number;
  uncertaintyCm: number;
}

export const IR_OBJECT_SENSOR_LAYOUT: readonly IrObjectSensorGeometry[] = [
  {
    key: "objectLeft45",
    label: "DIAGONAL IZQUIERDA",
    offsetCm: -8,
    bearingDeg: -45,
  },
  {
    key: "objectLeftCenter",
    label: "FRENTE IZQUIERDO",
    offsetCm: -3.5,
    bearingDeg: 0,
  },
  {
    key: "objectCenter",
    label: "FRENTE CENTRAL",
    offsetCm: 0,
    bearingDeg: 0,
  },
  {
    key: "objectRightCenter",
    label: "FRENTE DERECHO",
    offsetCm: 3.5,
    bearingDeg: 0,
  },
  {
    key: "objectRight45",
    label: "DIAGONAL DERECHA",
    offsetCm: 8,
    bearingDeg: 45,
  },
];

const DEFAULT_DISTANCE_EXPONENT = 1.6;
const DEFAULT_ANGULAR_EXPONENT = 20;
const EPSILON = 1e-9;

export function isPointInsideIrCone(
  point: IrObjectPoint,
  sensor: IrObjectSensorGeometry,
  sensitivityCm: number,
): boolean {
  return sensorResponseAtPoint(point, sensor, sensitivityCm).inside;
}

export function simulateIrObjectReadings(
  point: IrObjectPoint,
  sensitivityCm: number,
  options: IrObjectForwardOptions = {},
): IrObjectForwardResult {
  const reflectivity = clamp(options.reflectivity ?? 1, 0, 1.25);
  const ambientAdc = clamp(options.ambientAdc ?? 0, 0, IR_OBJECT_ADC_MAX);
  const gain = Math.max(0, options.gain ?? 1);
  const distanceExponent = Math.max(0.1, options.distanceExponent ?? DEFAULT_DISTANCE_EXPONENT);
  const angularExponent = Math.max(0.1, options.angularExponent ?? DEFAULT_ANGULAR_EXPONENT);
  const threshold = clamp(
    options.detectionThreshold ?? IR_OBJECT_DETECTION_THRESHOLD,
    0,
    IR_OBJECT_ADC_MAX,
  );
  const readings = createObjectSensorRecord();
  const strengths = createObjectSensorRecord();

  IR_OBJECT_SENSOR_LAYOUT.forEach((sensor) => {
    const response = sensorResponseAtPoint(
      point,
      sensor,
      sensitivityCm,
      distanceExponent,
      angularExponent,
      options.calibration,
    );
    const strength = response.strength;
    const adc = options.calibration
      ? calibratedAdcForResponse(
          sensor.key,
          response,
          reflectivity * gain,
          options.calibration,
        )
      : Math.round(
          clamp(
            ambientAdc + strength * reflectivity * gain * IR_OBJECT_ADC_MAX,
            0,
            IR_OBJECT_ADC_MAX,
          ),
        );
    strengths[sensor.key] = strength;
    readings[sensor.key] = adc;

  });

  let activeMask = 0;
  let supportCount = 0;
  IR_OBJECT_SENSOR_LAYOUT.forEach((sensor, index) => {
    const signalAdc = signalAdcAboveBaseline(
      sensor.key,
      readings[sensor.key],
      options.calibration,
      ambientAdc,
    );
    if (signalAdc >= threshold) {
      activeMask |= 1 << index;
      supportCount += 1;
    }
  });

  return { readings, strengths, activeMask, supportCount };
}

export function estimateIrObjectPosition(
  readings: Readonly<Record<IrObjectSensorKey, number>>,
  sensitivityCm: number,
  options: Pick<
    IrObjectForwardOptions,
    | "ambientAdc"
    | "distanceExponent"
    | "angularExponent"
    | "detectionThreshold"
    | "calibration"
  > = {},
): IrObjectPositionEstimate {
  const rangeCm = Math.max(0, sensitivityCm);
  const ambient = options.calibration
    ? 0
    : clamp(options.ambientAdc ?? 0, 0, IR_OBJECT_ADC_MAX) /
      IR_OBJECT_ADC_MAX;
  const distanceExponent = Math.max(0.1, options.distanceExponent ?? DEFAULT_DISTANCE_EXPONENT);
  const angularExponent = Math.max(0.1, options.angularExponent ?? DEFAULT_ANGULAR_EXPONENT);
  const threshold = clamp(
    options.detectionThreshold ?? IR_OBJECT_DETECTION_THRESHOLD,
    0,
    IR_OBJECT_ADC_MAX,
  );
  const observed = IR_OBJECT_SENSOR_KEYS.map((key) =>
    normalizeObservedReading(
      key,
      readings[key],
      options.calibration,
      ambient,
    ),
  );
  const activeSensors = IR_OBJECT_SENSOR_KEYS.filter(
    (key) =>
      signalAdcAboveBaseline(
        key,
        readings[key],
        options.calibration,
        options.ambientAdc ?? 0,
      ) >= threshold,
  );
  const detectionThresholdNormalized = IR_OBJECT_SENSOR_KEYS.map((key) =>
    normalizedDetectionThreshold(key, threshold, options.calibration),
  );
  const activeMask = activeSensors.reduce(
    (mask, key) => mask | (1 << IR_OBJECT_SENSOR_KEYS.indexOf(key)),
    0,
  );
  const supportCount = activeSensors.length;
  const maxObserved = Math.max(...observed);

  if (rangeCm <= 0 || supportCount === 0) {
    return emptyEstimate(activeMask, activeSensors);
  }

  const minSensorX = Math.min(...IR_OBJECT_SENSOR_LAYOUT.map((sensor) => sensor.offsetCm));
  const maxSensorX = Math.max(...IR_OBJECT_SENSOR_LAYOUT.map((sensor) => sensor.offsetCm));
  const coarseStep = Math.max(0.5, rangeCm / 24);
  const coarseBest = searchBestCandidate({
    minX: minSensorX - rangeCm,
    maxX: maxSensorX + rangeCm,
    minForward: 0,
    maxForward: rangeCm,
    step: coarseStep,
    observed,
    ambient,
    rangeCm,
    distanceExponent,
    angularExponent,
    activeSensors,
    detectionThresholdNormalized,
    calibration: options.calibration,
  });

  if (!coarseBest) {
    return emptyEstimate(activeMask, activeSensors);
  }

  const fineStep = Math.max(0.1, coarseStep / 5);
  const fineRadius = coarseStep * 1.5;
  const fineCandidates = collectCandidates({
    minX: coarseBest.point.lateralCm - fineRadius,
    maxX: coarseBest.point.lateralCm + fineRadius,
    minForward: Math.max(0, coarseBest.point.forwardCm - fineRadius),
    maxForward: Math.min(rangeCm, coarseBest.point.forwardCm + fineRadius),
    step: fineStep,
    observed,
    ambient,
    rangeCm,
    distanceExponent,
    angularExponent,
    activeSensors,
    detectionThresholdNormalized,
    calibration: options.calibration,
  }).sort((left, right) => left.score - right.score);
  const best = fineCandidates[0] ?? coarseBest;
  const runnerUp = fineCandidates.find(
    (candidate) =>
      Math.hypot(
        candidate.point.lateralCm - best.point.lateralCm,
        candidate.point.forwardCm - best.point.forwardCm,
      ) >= fineStep * 3,
  );
  const fit = clamp01(1 - Math.sqrt(best.score) / 0.36);
  const separation = runnerUp
    ? clamp01((runnerUp.score - best.score) / Math.max(0.015, runnerUp.score))
    : 1;
  const supportFactor = supportCount >= 3 ? 1 : supportCount === 2 ? 0.78 : 0.42;
  let confidence = fit * (0.45 + 0.55 * maxObserved) * supportFactor * (0.65 + 0.35 * separation);

  if (supportCount === 1) {
    confidence = Math.min(confidence, 0.42);
  }

  confidence = clamp01(confidence);
  const ambiguous = supportCount < 2 || confidence < 0.5 || separation < 0.06;
  const estimatedRange = Math.hypot(best.point.lateralCm, best.point.forwardCm);

  return {
    ...best.point,
    detected: true,
    rangeCm: estimatedRange,
    bearingDeg: radToDeg(Math.atan2(best.point.lateralCm, best.point.forwardCm)),
    confidence,
    ambiguous,
    supportCount,
    activeMask,
    activeSensors,
    estimatedReflectivity: best.reflectivity,
    residual: Math.sqrt(best.score),
    uncertaintyCm: Math.max(
      fineStep,
      rangeCm * (1 - confidence) * (ambiguous ? 0.42 : 0.2),
    ),
  };
}

export function createObjectSensorRecord(
  value = 0,
): Record<IrObjectSensorKey, number> {
  return IR_OBJECT_SENSOR_KEYS.reduce(
    (record, key) => {
      record[key] = value;
      return record;
    },
    {} as Record<IrObjectSensorKey, number>,
  );
}

export function normalizeIrObjectReading(
  key: IrObjectSensorKey,
  adc: number,
  calibration?: IrObjectForwardCalibration | null,
) {
  return normalizeObservedReading(key, adc, calibration, 0);
}

interface SearchOptions {
  minX: number;
  maxX: number;
  minForward: number;
  maxForward: number;
  step: number;
  observed: number[];
  ambient: number;
  rangeCm: number;
  distanceExponent: number;
  angularExponent: number;
  activeSensors: IrObjectSensorKey[];
  detectionThresholdNormalized: number[];
  calibration?: IrObjectForwardCalibration | null;
}

interface Candidate {
  point: IrObjectPoint;
  score: number;
  reflectivity: number;
}

function searchBestCandidate(options: SearchOptions): Candidate | null {
  const candidates = collectCandidates(options);
  return candidates.reduce<Candidate | null>(
    (best, candidate) => (!best || candidate.score < best.score ? candidate : best),
    null,
  );
}

function collectCandidates(options: SearchOptions): Candidate[] {
  const candidates: Candidate[] = [];

  for (
    let forwardCm = options.minForward;
    forwardCm <= options.maxForward + EPSILON;
    forwardCm += options.step
  ) {
    for (
      let lateralCm = options.minX;
      lateralCm <= options.maxX + EPSILON;
      lateralCm += options.step
    ) {
      const candidate = evaluateCandidate(
        { lateralCm, forwardCm },
        options,
      );
      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

function evaluateCandidate(
  point: IrObjectPoint,
  options: Pick<
    SearchOptions,
    | "observed"
    | "ambient"
    | "rangeCm"
    | "distanceExponent"
    | "angularExponent"
    | "activeSensors"
    | "detectionThresholdNormalized"
    | "calibration"
  >,
): Candidate | null {
  const predicted = IR_OBJECT_SENSOR_LAYOUT.map((sensor) =>
    sensorResponseAtPoint(
      point,
      sensor,
      options.rangeCm,
      options.distanceExponent,
      options.angularExponent,
      options.calibration,
    ).strength,
  );
  const energy = predicted.reduce((sum, value) => sum + value * value, 0);

  if (energy <= EPSILON) {
    return null;
  }

  const centeredObserved = options.observed.map((value) => Math.max(0, value - options.ambient));
  const reflectivity = clamp(
    centeredObserved.reduce((sum, value, index) => sum + value * predicted[index], 0) / energy,
    0.05,
    1.25,
  );
  let squaredError = 0;
  let mismatchPenalty = 0;

  predicted.forEach((value, index) => {
    const expected = options.ambient + value * reflectivity;
    const residual = options.observed[index] - expected;
    squaredError += residual * residual;
    const sensor = IR_OBJECT_SENSOR_LAYOUT[index];
    const observedActive = options.activeSensors.includes(sensor.key);
    const predictedActive =
      Math.max(0, expected - options.ambient) >=
      options.detectionThresholdNormalized[index];
    if (observedActive !== predictedActive) {
      mismatchPenalty += observedActive ? 0.08 : 0.025;
    }
  });

  return {
    point,
    score: squaredError / IR_OBJECT_SENSOR_LAYOUT.length + mismatchPenalty,
    reflectivity,
  };
}

interface SensorResponse {
  inside: boolean;
  distanceCm: number;
  angularGain: number;
  strength: number;
}

function sensorResponseAtPoint(
  point: IrObjectPoint,
  sensor: IrObjectSensorGeometry,
  sensitivityCm: number,
  distanceExponent = DEFAULT_DISTANCE_EXPONENT,
  angularExponent = DEFAULT_ANGULAR_EXPONENT,
  calibration?: IrObjectForwardCalibration | null,
): SensorResponse {
  const rangeCm = Math.max(0, sensitivityCm);

  if (rangeCm <= 0) {
    return { inside: false, distanceCm: 0, angularGain: 0, strength: 0 };
  }

  const bearingRad = degToRad(sensor.bearingDeg);
  const directionX = Math.sin(bearingRad);
  const directionForward = Math.cos(bearingRad);
  const deltaX = point.lateralCm - sensor.offsetCm;
  const deltaForward = point.forwardCm;
  const deltaVertical = point.verticalCm ?? 0;
  const distance = Math.hypot(deltaX, deltaForward, deltaVertical);

  if (distance > rangeCm + EPSILON) {
    return { inside: false, distanceCm: distance, angularGain: 0, strength: 0 };
  }

  if (distance <= EPSILON) {
    return { inside: true, distanceCm: 0, angularGain: 1, strength: 1 };
  }

  const axial = deltaX * directionX + deltaForward * directionForward;
  const lateralHorizontal =
    deltaX * directionForward - deltaForward * directionX;
  const radialOffset = Math.hypot(
    lateralHorizontal,
    deltaVertical,
  );
  const halfAngleRad = degToRad(IR_OBJECT_CONE_HALF_ANGLE_DEG);

  if (
    axial < 0 ||
    radialOffset > axial * Math.tan(halfAngleRad) + EPSILON
  ) {
    return { inside: false, distanceCm: distance, angularGain: 0, strength: 0 };
  }

  const angularCosine = clamp01(axial / distance);
  const angularGain = Math.pow(angularCosine, angularExponent);
  const distanceGain = calibration
    ? calibratedDistanceStrength(sensor.key, distance, calibration)
    : Math.pow(clamp01(1 - distance / rangeCm), distanceExponent);
  return {
    inside: true,
    distanceCm: distance,
    angularGain,
    strength: clamp01(angularGain * distanceGain),
  };
}

function calibratedAdcForResponse(
  key: IrObjectSensorKey,
  response: SensorResponse,
  amplitude: number,
  calibration: IrObjectForwardCalibration,
) {
  const baseline = clamp(
    calibration.baselineAdc[key],
    0,
    IR_OBJECT_ADC_MAX,
  );

  if (!response.inside) {
    return Math.round(baseline);
  }

  const axialAdc = interpolateCalibrationCurve(
    calibration.curves[key],
    response.distanceCm,
  );
  const signedSignal =
    calibration.polarity === "higher-is-closer"
      ? Math.max(0, axialAdc - baseline)
      : -Math.max(0, baseline - axialAdc);
  return Math.round(
    clamp(
      baseline + signedSignal * response.angularGain * Math.max(0, amplitude),
      0,
      IR_OBJECT_ADC_MAX,
    ),
  );
}

function calibratedDistanceStrength(
  key: IrObjectSensorKey,
  distanceCm: number,
  calibration: IrObjectForwardCalibration,
) {
  const baseline = calibration.baselineAdc[key];
  const curve = calibration.curves[key];
  const axialAdc = interpolateCalibrationCurve(curve, distanceCm);
  const maximumSignal = calibrationMaximumSignal(key, calibration);
  const signal =
    calibration.polarity === "higher-is-closer"
      ? axialAdc - baseline
      : baseline - axialAdc;
  return maximumSignal > EPSILON
    ? clamp01(signal / maximumSignal)
    : 0;
}

function normalizeObservedReading(
  key: IrObjectSensorKey,
  adc: number,
  calibration: IrObjectForwardCalibration | null | undefined,
  ambient: number,
) {
  if (!calibration) {
    return clamp(adc, 0, IR_OBJECT_ADC_MAX) / IR_OBJECT_ADC_MAX;
  }

  const baseline = calibration.baselineAdc[key];
  const maximumSignal = calibrationMaximumSignal(key, calibration);
  const signal =
    calibration.polarity === "higher-is-closer"
      ? adc - baseline
      : baseline - adc;
  return maximumSignal > EPSILON
    ? clamp01(signal / maximumSignal)
    : ambient;
}

function signalAdcAboveBaseline(
  key: IrObjectSensorKey,
  adc: number,
  calibration: IrObjectForwardCalibration | null | undefined,
  ambientAdc: number,
) {
  if (!calibration) {
    return Math.max(0, adc - clamp(ambientAdc, 0, IR_OBJECT_ADC_MAX));
  }

  const baseline = calibration.baselineAdc[key];
  return calibration.polarity === "higher-is-closer"
    ? Math.max(0, adc - baseline)
    : Math.max(0, baseline - adc);
}

function normalizedDetectionThreshold(
  key: IrObjectSensorKey,
  thresholdAdc: number,
  calibration: IrObjectForwardCalibration | null | undefined,
) {
  if (!calibration) {
    return thresholdAdc / IR_OBJECT_ADC_MAX;
  }

  const maximumSignal = calibrationMaximumSignal(key, calibration);
  return maximumSignal > EPSILON
    ? thresholdAdc / maximumSignal
    : Number.POSITIVE_INFINITY;
}

function calibrationMaximumSignal(
  key: IrObjectSensorKey,
  calibration: IrObjectForwardCalibration,
) {
  const baseline = calibration.baselineAdc[key];
  return calibration.curves[key].reduce((maximum, point) => {
    const signal =
      calibration.polarity === "higher-is-closer"
        ? point.adc - baseline
        : baseline - point.adc;
    return Math.max(maximum, signal);
  }, 0);
}

function interpolateCalibrationCurve(
  curve: readonly IrObjectCalibrationCurvePoint[],
  distanceCm: number,
) {
  if (curve.length === 0) {
    return 0;
  }

  const sorted = [...curve].sort(
    (left, right) => left.distanceCm - right.distanceCm,
  );
  if (sorted.length === 1) {
    return sorted[0].adc;
  }
  if (distanceCm <= sorted[0].distanceCm) {
    return linearCurveValue(sorted[0], sorted[1], distanceCm);
  }
  const last = sorted[sorted.length - 1];
  if (distanceCm >= last.distanceCm) {
    return linearCurveValue(sorted[sorted.length - 2], last, distanceCm);
  }

  for (let index = 1; index < sorted.length; index += 1) {
    const right = sorted[index];
    const left = sorted[index - 1];
    if (distanceCm <= right.distanceCm) {
      const span = Math.max(EPSILON, right.distanceCm - left.distanceCm);
      const ratio = (distanceCm - left.distanceCm) / span;
      return left.adc + (right.adc - left.adc) * ratio;
    }
  }

  return last.adc;
}

function linearCurveValue(
  left: IrObjectCalibrationCurvePoint,
  right: IrObjectCalibrationCurvePoint,
  distanceCm: number,
) {
  const span = Math.max(EPSILON, right.distanceCm - left.distanceCm);
  const ratio = (distanceCm - left.distanceCm) / span;
  return left.adc + (right.adc - left.adc) * ratio;
}

function emptyEstimate(
  activeMask: number,
  activeSensors: IrObjectSensorKey[],
): IrObjectPositionEstimate {
  return {
    detected: false,
    lateralCm: 0,
    forwardCm: 0,
    rangeCm: 0,
    bearingDeg: 0,
    confidence: 0,
    ambiguous: true,
    supportCount: activeSensors.length,
    activeMask,
    activeSensors,
    estimatedReflectivity: 0,
    residual: 1,
    uncertaintyCm: 0,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

function radToDeg(value: number) {
  return (value * 180) / Math.PI;
}
