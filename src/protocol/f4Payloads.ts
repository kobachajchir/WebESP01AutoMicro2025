export const F4_STREAM_LIMITS = {
  MIN_PERIOD_MS: 20,
  MAX_PERIOD_MS: 1000,
  DEFAULT_PERIOD_MS: 100,
} as const;

export const F4_MPU_FLAGS = {
  SAMPLE_VALID: 1 << 0,
  CALIBRATED: 1 << 1,
  MAG_VALID: 1 << 2,
  STATIONARY: 1 << 3,
  CALIBRATING: 1 << 4,
  ERROR: 1 << 5,
} as const;

export type Vector3 = { x: number; y: number; z: number };

export interface MpuSnapshot {
  status: number;
  flags: number;
  sampleValid: boolean;
  calibrated: boolean;
  magValid: boolean;
  stationary: boolean;
  calibrating: boolean;
  sensorError: boolean;
  sampleSeq: number;
  sampleDtUs: number;
  eulerDeg: Vector3 & { roll: number; pitch: number; yaw: number };
  accelG: Vector3;
  gyroDps: Vector3;
  valid: boolean;
}

export const IR_SENSOR_ORDER = [
  "lineCenter",
  "lineRight",
  "objectCenter",
  "lineLeft",
  "objectLeftCenter",
  "objectRightCenter",
  "objectLeft45",
  "objectRight45",
] as const;

export type IrSensorKey = (typeof IR_SENSOR_ORDER)[number];

export interface IrSnapshot {
  status: number;
  flags: number;
  sampleSeq: number;
  periodMs: number;
  tickMs: number;
  raw: Record<IrSensorKey, number>;
  norm: Record<IrSensorKey, number>;
  linePattern: number;
  lineAlignment: number;
  confidence: number;
  ambiguous: boolean;
  lineWidthMm: number;
  lateralErrorMm: number;
  lateralErrorNorm: number;
}

export interface StreamSetAck {
  status: number;
  active: boolean;
  periodMs: number;
}

export interface StreamStopAck {
  status: number;
}

export interface TelemetrySnapshot {
  status: number;
  backend: number;
  wifiMode: number;
  bridgeConnected: boolean;
  capabilityMask: number;
  i2cPolicy: number;
  motionArmed: boolean;
  balanceActive: boolean;
  commandActive: boolean;
  safetyStop: boolean;
  pitchMeasuredDeg: number;
  pitchSetpointDeg: number;
  balanceOutputPct: number;
  leftOutputPct: number;
  rightOutputPct: number;
  kp: number;
  ki: number;
  kd: number;
  rollDeg: number;
  pitchDeg: number;
  yawMagneticDeg: number;
  mpuStreamActive: boolean;
  mpuStreamPeriodMs: number;
  leftMinPwm: number;
  rightMinPwm: number;
  rawAdc: number[];
  pidErrorDeg: number;
  pidIntegralDegS: number;
  pidDerivativeDegS: number;
}

export const F4_BOOT_REPORT = {
  COMMAND_ID: 0x6f,
  EVENT_ID: 0x9f,
  SCHEMA: 1,
  PAYLOAD_BYTES: 22,
} as const;

export type F4BootHandoff = 0 | 1 | 2 | 3;
export type F4ExtensionProfileId = 0 | 1;

export interface F4BootReport {
  schema: number;
  status: number;
  mailboxValid: boolean;
  handoff: F4BootHandoff;
  resetFlags: number;
  appValidationFlags: number;
  extensionProfileId: F4ExtensionProfileId;
  bootloaderVersion: number;
  appVersion: number;
  appSize: number;
  appCrc32: number;
}

export interface ControlSnapshot {
  status: number;
  carMode: number;
  lineFsm: number;
  linePattern: number;
  lineConfidencePct: number;
  lineAmbiguous: boolean;
  lineRejectReason: number;
  lineWidthMm: number;
  lateralErrorMm: number;
  lateralErrorNorm: number;
  linearAccelerationMps2: number;
  estimatedVelocityMps: number;
  yawRateDps: number;
  estimatorConfidencePct: number;
  estimatorFlags: number;
  commonOutputPct: number;
  differentialOutputPct: number;
  turnLimitPct: number;
  saturationLimited: boolean;
}

export function decodeMpuSnapshot(payload: Uint8Array): MpuSnapshot {
  const view = exactView(payload, 42, "MPU");
  const floats = [6, 10, 14, 18, 22, 26, 30, 34, 38].map((offset) =>
    view.getFloat32(offset, true),
  );
  ensureFinite(floats, "MPU");
  const [roll, pitch, yaw, ax, ay, az, gx, gy, gz] = floats;
  const status = view.getUint8(0);
  const flags = view.getUint8(1);

  return {
    status,
    flags,
    sampleValid: (flags & F4_MPU_FLAGS.SAMPLE_VALID) !== 0,
    calibrated: (flags & F4_MPU_FLAGS.CALIBRATED) !== 0,
    magValid: (flags & F4_MPU_FLAGS.MAG_VALID) !== 0,
    stationary: (flags & F4_MPU_FLAGS.STATIONARY) !== 0,
    calibrating: (flags & F4_MPU_FLAGS.CALIBRATING) !== 0,
    sensorError: (flags & F4_MPU_FLAGS.ERROR) !== 0,
    sampleSeq: view.getUint16(2, true),
    sampleDtUs: view.getUint16(4, true),
    eulerDeg: { x: roll, y: pitch, z: yaw, roll, pitch, yaw },
    accelG: { x: ax, y: ay, z: az },
    gyroDps: { x: gx, y: gy, z: gz },
    valid: status === 0,
  };
}

export function decodeIrSnapshot(payload: Uint8Array): IrSnapshot {
  const view = exactView(payload, 56, "IR");
  const raw = readSensorArray(view, 10);
  const norm = readSensorArray(view, 26);
  const lateralErrorMm = view.getFloat32(48, true);
  const lateralErrorNorm = view.getFloat32(52, true);
  ensureFinite([lateralErrorMm, lateralErrorNorm], "IR");

  return {
    status: view.getUint8(0),
    flags: view.getUint8(1),
    sampleSeq: view.getUint16(2, true),
    periodMs: view.getUint16(4, true),
    tickMs: view.getUint32(6, true),
    raw,
    norm,
    linePattern: view.getUint8(42),
    lineAlignment: view.getUint8(43),
    confidence: view.getUint8(44),
    ambiguous: view.getUint8(45) !== 0,
    lineWidthMm: view.getUint16(46, true),
    lateralErrorMm,
    lateralErrorNorm,
  };
}

export function decodeStreamSetAck(payload: Uint8Array): StreamSetAck {
  const view = exactView(payload, 4, "SET stream ACK");
  return {
    status: view.getUint8(0),
    active: view.getUint8(1) !== 0,
    periodMs: view.getUint16(2, true),
  };
}

export function decodeStreamStopAck(payload: Uint8Array): StreamStopAck {
  return { status: exactView(payload, 1, "STOP stream ACK").getUint8(0) };
}

export function decodeTelemetrySnapshot(payload: Uint8Array): TelemetrySnapshot {
  const view = exactView(payload, 92, "telemetria");
  const f = (offset: number) => view.getFloat32(offset, true);
  const floats = [13, 17, 21, 25, 29, 33, 37, 41, 45, 49, 53, 80, 84, 88].map(f);
  ensureFinite(floats, "telemetria");
  return {
    status: view.getUint8(0), backend: view.getUint8(1), wifiMode: view.getUint8(2),
    bridgeConnected: view.getUint8(3) !== 0, capabilityMask: view.getUint32(4, true),
    i2cPolicy: view.getUint8(8), motionArmed: view.getUint8(9) !== 0,
    balanceActive: view.getUint8(10) !== 0, commandActive: view.getUint8(11) !== 0,
    safetyStop: view.getUint8(12) !== 0, pitchMeasuredDeg: f(13), pitchSetpointDeg: f(17),
    balanceOutputPct: f(21), leftOutputPct: f(25), rightOutputPct: f(29), kp: f(33),
    ki: f(37), kd: f(41), rollDeg: f(45), pitchDeg: f(49), yawMagneticDeg: f(53),
    mpuStreamActive: view.getUint8(57) !== 0, mpuStreamPeriodMs: view.getUint16(58, true),
    leftMinPwm: view.getUint16(60, true), rightMinPwm: view.getUint16(62, true),
    rawAdc: Array.from({ length: 8 }, (_, index) => view.getUint16(64 + index * 2, true)),
    pidErrorDeg: f(80), pidIntegralDegS: f(84), pidDerivativeDegS: f(88),
  };
}

export function decodeControlSnapshot(payload: Uint8Array): ControlSnapshot {
  const view = exactView(payload, 64, "control");
  const f = (offset: number) => view.getFloat32(offset, true);
  ensureFinite([9, 13, 17, 21, 25, 31, 35, 39].map(f), "control");
  return {
    status: view.getUint8(0), carMode: view.getUint8(1), lineFsm: view.getUint8(2),
    linePattern: view.getUint8(3), lineConfidencePct: view.getUint8(4),
    lineAmbiguous: view.getUint8(5) !== 0, lineRejectReason: view.getUint8(6),
    lineWidthMm: view.getUint16(7, true), lateralErrorMm: f(9), lateralErrorNorm: f(13),
    linearAccelerationMps2: f(17), estimatedVelocityMps: f(21), yawRateDps: f(25),
    estimatorConfidencePct: view.getUint8(29), estimatorFlags: view.getUint8(30),
    commonOutputPct: f(31), differentialOutputPct: f(35), turnLimitPct: f(39),
    saturationLimited: view.getUint8(43) !== 0,
  };
}

export function decodeBootReport(payload: Uint8Array): F4BootReport {
  const view = exactView(payload, F4_BOOT_REPORT.PAYLOAD_BYTES, "reporte de arranque");
  const report: F4BootReport = {
    schema: view.getUint8(0),
    status: view.getUint8(1),
    mailboxValid: view.getUint8(1) === 0,
    handoff: view.getUint8(2) as F4BootHandoff,
    resetFlags: view.getUint8(3),
    appValidationFlags: view.getUint8(4),
    extensionProfileId: view.getUint8(5) as F4ExtensionProfileId,
    bootloaderVersion: view.getUint32(6, true),
    appVersion: view.getUint32(10, true),
    appSize: view.getUint32(14, true),
    appCrc32: view.getUint32(18, true),
  };
  validateBootReport(report);
  return report;
}

export function parseBootReportData(value: unknown): F4BootReport {
  const data = record(value, "reporte de arranque");
  if (Array.isArray(data.payload)) {
    const raw = numericArray(data.payload, F4_BOOT_REPORT.PAYLOAD_BYTES, "payload");
    if (raw.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 0xff)) {
      throw new TypeError("payload: contiene un byte invalido");
    }
    return decodeBootReport(Uint8Array.from(raw));
  }

  const report: F4BootReport = {
    schema: number(data.schema, "schema"),
    status: number(data.status, "status"),
    mailboxValid: data.mailboxValid === undefined
      ? number(data.status, "status") === 0
      : Boolean(data.mailboxValid),
    handoff: number(data.handoff, "handoff") as F4BootHandoff,
    resetFlags: number(data.resetFlags, "resetFlags"),
    appValidationFlags: number(data.appValidationFlags, "appValidationFlags"),
    extensionProfileId: number(data.extensionProfileId, "extensionProfileId") as F4ExtensionProfileId,
    bootloaderVersion: number(data.bootloaderVersion, "bootloaderVersion"),
    appVersion: number(data.appVersion, "appVersion"),
    appSize: number(data.appSize, "appSize"),
    appCrc32: number(data.appCrc32, "appCrc32"),
  };
  validateBootReport(report);
  return report;
}

export function formatF4PackedVersion(version: number): string {
  const value = version >>> 0;
  return `${(value >>> 16) & 0xff}.${(value >>> 8) & 0xff}.${value & 0xff}`;
}

export function formatF4BootHandoff(handoff: F4BootHandoff): string {
  return ["Sin handoff", "Aplicacion", "ROM STM32", "Recuperacion"][handoff];
}

export function formatF4ExtensionProfile(profile: F4ExtensionProfileId): string {
  return profile === 0 ? "NRF24 (SPI2)" : "Beeper (PB12)";
}

function validateBootReport(report: F4BootReport): void {
  if (report.schema !== F4_BOOT_REPORT.SCHEMA) {
    throw new RangeError(`reporte de arranque: schema ${report.schema} no soportado`);
  }
  if (report.status !== 0 && report.status !== 1) {
    throw new RangeError(`reporte de arranque: status ${report.status} invalido`);
  }
  if (!Number.isInteger(report.handoff) || report.handoff < 0 || report.handoff > 3) {
    throw new RangeError(`reporte de arranque: handoff ${report.handoff} invalido`);
  }
  if (report.extensionProfileId !== 0 && report.extensionProfileId !== 1) {
    throw new RangeError(`reporte de arranque: perfil ${report.extensionProfileId} invalido`);
  }
  for (const [name, value] of Object.entries({
    resetFlags: report.resetFlags,
    appValidationFlags: report.appValidationFlags,
    bootloaderVersion: report.bootloaderVersion,
    appVersion: report.appVersion,
    appSize: report.appSize,
    appCrc32: report.appCrc32,
  })) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
      throw new RangeError(`reporte de arranque: ${name} invalido`);
    }
  }
}

export function normalizeStreamPeriodMs(value: number): number {
  if (!Number.isFinite(value)) return F4_STREAM_LIMITS.DEFAULT_PERIOD_MS;
  return Math.min(F4_STREAM_LIMITS.MAX_PERIOD_MS, Math.max(F4_STREAM_LIMITS.MIN_PERIOD_MS, Math.round(value)));
}

export function parseMpuData(value: unknown): MpuSnapshot {
  const data = record(value, "MPU");
  const accel = record(data.accel, "MPU.accel");
  const gyro = record(data.gyro, "MPU.gyro");
  const status = number(data.status, "status");
  const roll = number(data.roll, "roll");
  const pitch = number(data.pitch, "pitch");
  const yaw = number(data.yaw, "yaw");
  const flags = number(data.flags, "flags");
  const flagValue = (key: string, mask: number): boolean =>
    typeof data[key] === "boolean"
      ? data[key] as boolean
      : (flags & mask) !== 0;
  return {
    status,
    flags,
    sampleValid: flagValue("sampleValid", F4_MPU_FLAGS.SAMPLE_VALID),
    calibrated: flagValue("calibrated", F4_MPU_FLAGS.CALIBRATED),
    magValid: flagValue("magValid", F4_MPU_FLAGS.MAG_VALID),
    stationary: flagValue("stationary", F4_MPU_FLAGS.STATIONARY),
    calibrating: flagValue("calibrating", F4_MPU_FLAGS.CALIBRATING),
    sensorError: flagValue("sensorError", F4_MPU_FLAGS.ERROR),
    sampleSeq: number(data.sampleSeq, "sampleSeq"),
    sampleDtUs: number(data.sampleDtUs, "sampleDtUs"),
    eulerDeg: { x: roll, y: pitch, z: yaw, roll, pitch, yaw },
    accelG: { x: number(accel.x, "accel.x"), y: number(accel.y, "accel.y"), z: number(accel.z, "accel.z") },
    gyroDps: { x: number(gyro.x, "gyro.x"), y: number(gyro.y, "gyro.y"), z: number(gyro.z, "gyro.z") },
    valid: status === 0,
  };
}

export function parseIrData(value: unknown): IrSnapshot {
  const data = record(value, "IR");
  const rawValues = numericArray(data.raw, 8, "raw");
  const normValues = numericArray(data.normalized, 8, "normalized");
  const raw = Object.fromEntries(IR_SENSOR_ORDER.map((key, index) => [key, rawValues[index]])) as Record<IrSensorKey, number>;
  const norm = Object.fromEntries(IR_SENSOR_ORDER.map((key, index) => [key, normValues[index]])) as Record<IrSensorKey, number>;
  return {
    status: number(data.status, "status"), flags: number(data.flags, "flags"),
    sampleSeq: number(data.sampleSeq, "sampleSeq"), periodMs: number(data.periodMs, "periodMs"),
    tickMs: number(data.tickMs, "tickMs"), raw, norm,
    linePattern: number(data.linePattern, "linePattern"),
    lineAlignment: number(data.routeAlignment, "routeAlignment"),
    confidence: number(data.confidence, "confidence"), ambiguous: Boolean(data.ambiguous),
    lineWidthMm: number(data.lineWidthMm, "lineWidthMm"),
    lateralErrorMm: number(data.lateralErrorMm, "lateralErrorMm"),
    lateralErrorNorm: number(data.normalizedLateralError, "normalizedLateralError"),
  };
}

function exactView(payload: Uint8Array, length: number, label: string): DataView {
  if (payload.byteLength !== length) throw new RangeError(`${label}: payload ${payload.byteLength}/${length} bytes`);
  return new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
}

function ensureFinite(values: number[], label: string): void {
  if (values.some((value) => !Number.isFinite(value))) throw new RangeError(`${label}: contiene float no finito`);
}

function readSensorArray(view: DataView, offset: number): Record<IrSensorKey, number> {
  return IR_SENSOR_ORDER.reduce((result, key, index) => {
    result[key] = view.getUint16(offset + index * 2, true);
    return result;
  }, {} as Record<IrSensorKey, number>);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`${label}: objeto invalido`);
  return value as Record<string, unknown>;
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label}: numero invalido`);
  return value;
}

function numericArray(value: unknown, length: number, label: string): number[] {
  if (!Array.isArray(value) || value.length !== length || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    throw new TypeError(`${label}: vector invalido`);
  }
  return value as number[];
}
