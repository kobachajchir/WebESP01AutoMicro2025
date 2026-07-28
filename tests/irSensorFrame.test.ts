import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  IR_OBJECT_SENSOR_LAYOUT,
  isPointInsideIrCone,
  simulateIrObjectReadings,
} from "../src/features/ir/irObjectModel.ts";
import {
  createRigQuaternion,
  irObjectPointToLocalScenePoint,
  relativeRigEulerDeg,
  rotateScenePointAroundPivot,
  worldScenePointToIrObjectPoint,
} from "../src/features/ir/irSensorFrame.ts";
import type {
  IrSensorFrameProjection,
  IrSensorRigEulerDeg,
} from "../src/features/ir/irSensorFrame.ts";

const projection: IrSensorFrameProjection = {
  pivotScene: [0, 1, 0],
  sensorOriginScene: [0, 1.2, -0.5],
  sceneUnitsPerCm: 0.1,
  beamVisualScale: 1.25,
};

test("la pose identidad conserva el punto en el marco de los sensores", () => {
  const expected = { lateralCm: 2, verticalCm: 0.5, forwardCm: 4 };
  const world = irObjectPointToLocalScenePoint(expected, projection);
  const actual = worldScenePointToIrObjectPoint(
    world,
    { yaw: 0, pitch: 0, roll: 0 },
    projection,
  );

  assertPointClose(actual, expected);
});

test("local a mundo y mundo a local conserva yaw, pitch y roll", () => {
  const expected = { lateralCm: -1.6, verticalCm: 0.8, forwardCm: 6.2 };
  const pose = { yaw: 37, pitch: -18, roll: 24 };
  const localScene = irObjectPointToLocalScenePoint(expected, projection);
  const worldScene = rotateScenePointAroundPivot(
    localScene,
    pose,
    projection.pivotScene,
  );
  const actual = worldScenePointToIrObjectPoint(
    worldScene,
    pose,
    projection,
  );

  assertPointClose(actual, expected);
});

test("el helper coincide con la jerarquia real de grupos Three", () => {
  const pose = { yaw: 31, pitch: -14, roll: 22 };
  const localScene: [number, number, number] = [0.42, 1.35, -1.18];
  const rig = new THREE.Group();
  rig.position.set(...projection.pivotScene);
  rig.rotation.order = "YXZ";
  rig.rotation.set(
    THREE.MathUtils.degToRad(pose.pitch),
    THREE.MathUtils.degToRad(pose.yaw),
    THREE.MathUtils.degToRad(pose.roll),
  );
  const localContent = new THREE.Group();
  localContent.position.set(0, -projection.pivotScene[1], 0);
  const point = new THREE.Object3D();
  point.position.set(...localScene);
  localContent.add(point);
  rig.add(localContent);
  rig.updateMatrixWorld(true);

  const actual = point.getWorldPosition(new THREE.Vector3());
  const expected = rotateScenePointAroundPivot(
    localScene,
    pose,
    projection.pivotScene,
  );

  assertScenePointClose([actual.x, actual.y, actual.z], expected);
});

test("poner a cero usa la orientacion relativa, no resta Euler por componente", () => {
  const zero = { yaw: 42, pitch: -17, roll: 28 };
  const current = { yaw: 73, pitch: 11, roll: -9 };
  const relative = relativeRigEulerDeg(current, zero);
  const expectedQuaternion = createRigQuaternion(zero)
    .invert()
    .multiply(createRigQuaternion(current));
  const actualQuaternion = createRigQuaternion(relative);

  assert.ok(actualQuaternion.angleTo(expectedQuaternion) < 1e-10);
  assert.deepEqual(relativeRigEulerDeg(zero, zero), {
    yaw: 0,
    pitch: 0,
    roll: 0,
  });
});

test("un objetivo mundial fijo deja de estar al frente tras yaw de 90 grados", () => {
  const flatProjection: IrSensorFrameProjection = {
    pivotScene: [0, 0, 0],
    sensorOriginScene: [0, 0, 0],
    sceneUnitsPerCm: 1,
    beamVisualScale: 1,
  };
  const fixedWorld = irObjectPointToLocalScenePoint(
    { lateralCm: 0, verticalCm: 0, forwardCm: 5 },
    flatProjection,
  );
  const localAfterTurn = worldScenePointToIrObjectPoint(
    fixedWorld,
    { yaw: 90, pitch: 0, roll: 0 },
    flatProjection,
  );

  assert.equal(simulateIrObjectReadings(localAfterTurn, 15).supportCount, 0);
});

test("un pitch mayor a la semiapertura saca un objetivo fijo del cono", () => {
  const flatProjection: IrSensorFrameProjection = {
    pivotScene: [0, 0, 0],
    sensorOriginScene: [0, 0, 0],
    sceneUnitsPerCm: 1,
    beamVisualScale: 1,
  };
  const fixedWorld = irObjectPointToLocalScenePoint(
    { lateralCm: 0, verticalCm: 0, forwardCm: 5 },
    flatProjection,
  );
  const localAfterPitch = worldScenePointToIrObjectPoint(
    fixedWorld,
    { yaw: 0, pitch: 20, roll: 0 },
    flatProjection,
  );
  const center = IR_OBJECT_SENSOR_LAYOUT.find(
    (sensor) => sensor.key === "objectCenter",
  );
  assert.ok(center);

  assert.equal(isPointInsideIrCone(localAfterPitch, center, 15), false);
});

test("rotar auto y objetivo juntos conserva las cinco lecturas", () => {
  const target = { lateralCm: 1.75, verticalCm: 0, forwardCm: 8 };
  const pose: IrSensorRigEulerDeg = { yaw: 42, pitch: 12, roll: -17 };
  const before = simulateIrObjectReadings(target, 15).readings;
  const localScene = irObjectPointToLocalScenePoint(target, projection);
  const rotatedWorld = rotateScenePointAroundPivot(
    localScene,
    pose,
    projection.pivotScene,
  );
  const recoveredLocal = worldScenePointToIrObjectPoint(
    rotatedWorld,
    pose,
    projection,
  );
  const after = simulateIrObjectReadings(recoveredLocal, 15).readings;

  assert.deepEqual(after, before);
});

test("la apertura vertical del cono también es de 15 grados", () => {
  const center = IR_OBJECT_SENSOR_LAYOUT.find(
    (sensor) => sensor.key === "objectCenter",
  );
  assert.ok(center);
  const forwardCm = 5;
  const verticalEdgeCm = Math.tan((15 * Math.PI) / 180) * forwardCm;

  assert.equal(
    isPointInsideIrCone(
      { lateralCm: 0, verticalCm: verticalEdgeCm, forwardCm },
      center,
      15,
    ),
    true,
  );
  assert.equal(
    isPointInsideIrCone(
      { lateralCm: 0, verticalCm: verticalEdgeCm + 0.05, forwardCm },
      center,
      15,
    ),
    false,
  );
});

function assertPointClose(
  actual: { lateralCm: number; verticalCm?: number; forwardCm: number },
  expected: { lateralCm: number; verticalCm?: number; forwardCm: number },
) {
  assert.ok(Math.abs(actual.lateralCm - expected.lateralCm) < 1e-9);
  assert.ok(
    Math.abs((actual.verticalCm ?? 0) - (expected.verticalCm ?? 0)) < 1e-9,
  );
  assert.ok(Math.abs(actual.forwardCm - expected.forwardCm) < 1e-9);
}

function assertScenePointClose(
  actual: readonly [number, number, number],
  expected: readonly [number, number, number],
) {
  actual.forEach((value, index) => {
    assert.ok(Math.abs(value - expected[index]) < 1e-9);
  });
}
