import assert from "node:assert/strict";
import test from "node:test";
import {
  IR_OBJECT_SENSOR_LAYOUT,
  estimateIrObjectPosition,
  isPointInsideIrCone,
  simulateIrObjectReadings,
} from "../src/features/ir/irObjectModel.ts";
import type { IrObjectForwardCalibration } from "../src/features/ir/irObjectModel.ts";

test("un punto fuera del alcance no activa sensores", () => {
  const result = simulateIrObjectReadings(
    { lateralCm: 0, forwardCm: 18 },
    15,
  );

  assert.equal(result.activeMask, 0);
  assert.equal(result.supportCount, 0);
  assert.deepEqual(new Set(Object.values(result.readings)), new Set([0]));
});

test("el límite angular usa una semiapertura de 15 grados", () => {
  const center = IR_OBJECT_SENSOR_LAYOUT.find(
    (sensor) => sensor.key === "objectCenter",
  );
  assert.ok(center);
  const forwardCm = 5;
  const edgeX = Math.tan((15 * Math.PI) / 180) * forwardCm;

  assert.equal(
    isPointInsideIrCone(
      { lateralCm: edgeX, forwardCm },
      center,
      15,
    ),
    true,
  );
  assert.equal(
    isPointInsideIrCone(
      { lateralCm: edgeX + 0.05, forwardCm },
      center,
      15,
    ),
    false,
  );
});

test("la respuesta es simétrica entre izquierda y derecha", () => {
  const left = simulateIrObjectReadings(
    { lateralCm: -3.5, forwardCm: 5 },
    15,
  );
  const right = simulateIrObjectReadings(
    { lateralCm: 3.5, forwardCm: 5 },
    15,
  );

  assert.equal(
    left.readings.objectLeftCenter,
    right.readings.objectRightCenter,
  );
  assert.equal(left.readings.objectCenter, right.readings.objectCenter);
  assert.equal(left.readings.objectLeft45, right.readings.objectRight45);
});

test("un único cono activo produce una estimación ambigua", () => {
  const simulated = simulateIrObjectReadings(
    { lateralCm: 0, forwardCm: 5 },
    15,
  );
  const estimated = estimateIrObjectPosition(simulated.readings, 15);

  assert.equal(simulated.supportCount, 1);
  assert.equal(estimated.detected, true);
  assert.equal(estimated.ambiguous, true);
  assert.ok(estimated.confidence <= 0.42);
});

test("dos conos superpuestos permiten recuperar una posición aproximada", () => {
  const target = { lateralCm: 1.75, forwardCm: 8 };
  const simulated = simulateIrObjectReadings(target, 15);
  const estimated = estimateIrObjectPosition(simulated.readings, 15);

  assert.ok(simulated.supportCount >= 2);
  assert.equal(estimated.detected, true);
  assert.ok(Math.abs(estimated.lateralCm - target.lateralCm) < 1.2);
  assert.ok(Math.abs(estimated.forwardCm - target.forwardCm) < 1.6);
});

test("la reflectividad cambia amplitud sin desplazar fuertemente la posición", () => {
  const target = { lateralCm: -1.75, forwardCm: 8 };
  const bright = estimateIrObjectPosition(
    simulateIrObjectReadings(target, 15, { reflectivity: 1 }).readings,
    15,
  );
  const dark = estimateIrObjectPosition(
    simulateIrObjectReadings(target, 15, { reflectivity: 0.45 }).readings,
    15,
  );

  assert.equal(bright.detected, true);
  assert.equal(dark.detected, true);
  assert.ok(Math.abs(bright.lateralCm - dark.lateralCm) < 0.8);
  assert.ok(Math.abs(bright.forwardCm - dark.forwardCm) < 1.2);
});

test("la detección calibrada descuenta el baseline antes de activar sensores", () => {
  const calibration = calibrationWithPolarity("higher-is-closer", 600, 2600);
  const baselineReadings = Object.fromEntries(
    Object.keys(calibration.baselineAdc).map((key) => [key, 600]),
  ) as Record<keyof typeof calibration.baselineAdc, number>;

  const estimated = estimateIrObjectPosition(baselineReadings, 15, {
    calibration,
  });

  assert.equal(estimated.detected, false);
  assert.equal(estimated.supportCount, 0);
});

test("la polaridad ADC menor igual detecta una presencia cercana", () => {
  const calibration = calibrationWithPolarity("lower-is-closer", 3600, 700);
  const target = { lateralCm: 1.75, forwardCm: 8 };
  const simulated = simulateIrObjectReadings(target, 15, { calibration });
  const estimated = estimateIrObjectPosition(simulated.readings, 15, {
    calibration,
  });

  assert.ok(simulated.supportCount >= 2);
  assert.equal(estimated.detected, true);
  assert.ok(estimated.supportCount >= 2);
});

test("una curva más débil que el umbral no informa conos activos", () => {
  const calibration = calibrationWithPolarity("higher-is-closer", 1000, 1080);
  const simulated = simulateIrObjectReadings(
    { lateralCm: 0, forwardCm: 1 },
    15,
    { calibration },
  );
  const estimated = estimateIrObjectPosition(simulated.readings, 15, {
    calibration,
  });

  assert.equal(simulated.supportCount, 0);
  assert.equal(simulated.activeMask, 0);
  assert.equal(estimated.detected, false);
});

function calibrationWithPolarity(
  polarity: IrObjectForwardCalibration["polarity"],
  baseline: number,
  near: number,
): IrObjectForwardCalibration {
  const keys = [
    "objectLeft45",
    "objectLeftCenter",
    "objectCenter",
    "objectRightCenter",
    "objectRight45",
  ] as const;

  return {
    polarity,
    baselineAdc: Object.fromEntries(keys.map((key) => [key, baseline])) as IrObjectForwardCalibration["baselineAdc"],
    curves: Object.fromEntries(
      keys.map((key) => [
        key,
        [
          { distanceCm: 1, adc: near },
          { distanceCm: 15, adc: baseline },
        ],
      ]),
    ) as IrObjectForwardCalibration["curves"],
  };
}
