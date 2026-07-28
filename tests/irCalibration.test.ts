import assert from "node:assert/strict";
import test from "node:test";
import { decodeIrSnapshot } from "../src/api/UnerFrameV2.ts";
import {
  buildIrForwardCalibration,
  createEmptyIrCalibrationProfile,
  createIrCalibrationPoint,
  createIrCalibrationSensorPoint,
  exportIrCalibrationAsC,
  getIrCalibrationCoverage,
  parseIrCalibrationProfile,
  serializeIrCalibrationProfile,
  setIrCalibrationBaseline,
  summarizeIrCalibrationSamples,
  upsertIrCalibrationPoint,
} from "../src/features/ir/irCalibration.ts";
import {
  IR_OBJECT_SENSOR_KEYS,
  simulateIrObjectReadings,
} from "../src/features/ir/irObjectModel.ts";
import type { IrCalibrationSample } from "../src/features/ir/irCalibration.ts";

function sample(value: number): IrCalibrationSample {
  return Object.fromEntries(
    IR_OBJECT_SENSOR_KEYS.map((key) => [key, value]),
  ) as IrCalibrationSample;
}

test("la mediana resiste un valor atípico", () => {
  const stats = summarizeIrCalibrationSamples([
    sample(100),
    sample(102),
    sample(104),
    sample(4095),
    sample(106),
  ]);

  assert.equal(stats.objectCenter.median, 104);
  assert.equal(stats.objectCenter.count, 5);
  assert.ok(stats.objectCenter.mean > stats.objectCenter.median);
});

test("los puntos se reemplazan por distancia y quedan ordenados", () => {
  let profile = createEmptyIrCalibrationProfile();
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationPoint(5, [sample(900), sample(910)]),
  );
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationPoint(1, [sample(3000), sample(3010)]),
  );
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationPoint(5, [sample(800), sample(810)]),
  );

  assert.deepEqual(
    profile.points.map((point) => point.distanceCm),
    [1, 5],
  );
  assert.equal(profile.points[1].sensors.objectCenter?.median, 805);
});

test("las capturas por sensor se combinan sin pisar otros canales", () => {
  let profile = createEmptyIrCalibrationProfile();
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationSensorPoint(4, "objectCenter", [sample(1800)]),
  );
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationSensorPoint(4, "objectLeft45", [sample(900)]),
  );

  assert.equal(profile.points.length, 1);
  assert.equal(profile.points[0].sensors.objectCenter?.median, 1800);
  assert.equal(profile.points[0].sensors.objectLeft45?.median, 900);
  assert.equal(profile.points[0].sensors.objectRight45, undefined);
});

test("un perfil válido conserva formato al serializar e importar", () => {
  let profile = createEmptyIrCalibrationProfile({ name: "Banco A" });
  profile = setIrCalibrationBaseline(profile, [sample(90), sample(100)]);
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationPoint(1, [sample(3000), sample(3020)]),
  );
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationPoint(5, [sample(800), sample(820)]),
  );

  const parsed = parseIrCalibrationProfile(
    serializeIrCalibrationProfile(profile),
  );
  assert.equal(parsed.ok, true);
  assert.equal(parsed.profile?.name, "Banco A");
  assert.equal(parsed.profile?.points.length, 2);
  assert.equal(parsed.profile?.baseline?.objectCenter.median, 95);
});

test("el parser rechaza perfiles incompletos", () => {
  const parsed = parseIrCalibrationProfile(
    JSON.stringify({ schemaVersion: 1, polarity: "desconocida", points: [] }),
  );

  assert.equal(parsed.ok, false);
  assert.ok(parsed.errors.length > 0);
});

test("la curva medida reemplaza la caída ideal del simulador", () => {
  let profile = createEmptyIrCalibrationProfile();
  profile = setIrCalibrationBaseline(profile, [sample(100), sample(100)]);
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationPoint(1, [sample(3000), sample(3000)]),
  );
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationPoint(5, [sample(900), sample(900)]),
  );
  const calibration = buildIrForwardCalibration(profile);
  assert.ok(calibration);

  const near = simulateIrObjectReadings(
    { lateralCm: 0, forwardCm: 1 },
    15,
    { calibration },
  );
  const far = simulateIrObjectReadings(
    { lateralCm: 0, forwardCm: 5 },
    15,
    { calibration },
  );

  assert.ok(near.readings.objectCenter > far.readings.objectCenter);
  assert.ok(near.readings.objectCenter > 2500);
  assert.ok(far.readings.objectCenter >= 800);
});

test("el baseline y dos puntos por cada sensor son obligatorios", () => {
  let profile = createEmptyIrCalibrationProfile();
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationPoint(1, [sample(3000)]),
  );
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationPoint(5, [sample(900)]),
  );

  assert.equal(buildIrForwardCalibration(profile), null);
  assert.equal(getIrCalibrationCoverage(profile).usable, false);

  profile = setIrCalibrationBaseline(profile, [sample(100)]);
  assert.ok(buildIrForwardCalibration(profile));
  assert.equal(getIrCalibrationCoverage(profile).usable, true);
});

test("la curva extrapola linealmente fuera de los puntos medidos", () => {
  let profile = createEmptyIrCalibrationProfile();
  profile = setIrCalibrationBaseline(profile, [sample(100)]);
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationPoint(2, [sample(3000)]),
  );
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationPoint(4, [sample(2000)]),
  );
  const calibration = buildIrForwardCalibration(profile);
  assert.ok(calibration);

  const beforeFirstPoint = simulateIrObjectReadings(
    { lateralCm: 0, forwardCm: 1 },
    15,
    { calibration },
  );
  const atFirstPoint = simulateIrObjectReadings(
    { lateralCm: 0, forwardCm: 2 },
    15,
    { calibration },
  );

  assert.ok(
    beforeFirstPoint.readings.objectCenter >
      atFirstPoint.readings.objectCenter,
  );
});

test("la exportación C usa el orden espacial de cinco sensores", () => {
  let profile = createEmptyIrCalibrationProfile();
  profile = setIrCalibrationBaseline(profile, [sample(100)]);
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationPoint(1, [sample(1200)]),
  );
  profile = upsertIrCalibrationPoint(
    profile,
    createIrCalibrationPoint(2, [sample(700)]),
  );
  const source = exportIrCalibrationAsC(profile, "car_ir");

  assert.match(source, /#ifndef CAR_IR_H/);
  assert.match(source, /#include <stdint.h>/);
  assert.match(source, /CAR_IR_LOWER_ADC_MEANS_CLOSER 0u/);
  assert.match(source, /car_ir_sensor_0\[2\]/);
  assert.match(source, /\{ car_ir_sensor_4, 2u \}/);
  assert.match(source, /car_ir_baseline_adc\[CAR_IR_SENSOR_COUNT\]/);
});

test("el payload raw[8] se adapta al orden espacial antes de calibrar", () => {
  const payload = new Uint8Array(56);
  const view = new DataView(payload.buffer);
  view.setUint32(6, 1234, true);
  for (let index = 0; index < 8; index += 1) {
    view.setUint16(10 + index * 2, 1000 + index, true);
    view.setUint16(26 + index * 2, 2000 + index, true);
  }

  const snapshot = decodeIrSnapshot(payload);
  assert.ok(snapshot);
  assert.deepEqual(
    IR_OBJECT_SENSOR_KEYS.map((key) => snapshot.norm[key]),
    [2006, 2004, 2002, 2005, 2007],
  );
});
