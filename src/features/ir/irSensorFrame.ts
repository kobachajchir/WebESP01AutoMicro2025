import * as THREE from "three";
import type { IrObjectPoint } from "./irObjectModel";

export interface IrSensorRigEulerDeg {
  yaw: number;
  pitch: number;
  roll: number;
}

export type IrScenePoint = [number, number, number];

export interface IrSensorFrameProjection {
  pivotScene: IrScenePoint;
  sensorOriginScene: IrScenePoint;
  sceneUnitsPerCm: number;
  beamVisualScale: number;
}

export function rotateScenePointAroundPivot(
  localScenePoint: readonly [number, number, number],
  eulerDeg: IrSensorRigEulerDeg,
  pivotScene: readonly [number, number, number],
): IrScenePoint {
  const pivot = new THREE.Vector3(...pivotScene);
  const rotated = new THREE.Vector3(...localScenePoint)
    .sub(pivot)
    .applyQuaternion(createRigQuaternion(eulerDeg))
    .add(pivot);
  return [rotated.x, rotated.y, rotated.z];
}

export function inverseRotateScenePointAroundPivot(
  worldScenePoint: readonly [number, number, number],
  eulerDeg: IrSensorRigEulerDeg,
  pivotScene: readonly [number, number, number],
): IrScenePoint {
  const pivot = new THREE.Vector3(...pivotScene);
  const local = new THREE.Vector3(...worldScenePoint)
    .sub(pivot)
    .applyQuaternion(createRigQuaternion(eulerDeg).invert())
    .add(pivot);
  return [local.x, local.y, local.z];
}

export function worldScenePointToIrObjectPoint(
  worldScenePoint: readonly [number, number, number],
  eulerDeg: IrSensorRigEulerDeg,
  projection: IrSensorFrameProjection,
): IrObjectPoint {
  const localScenePoint = inverseRotateScenePointAroundPivot(
    worldScenePoint,
    eulerDeg,
    projection.pivotScene,
  );
  const scaledUnit =
    projection.sceneUnitsPerCm * projection.beamVisualScale;

  return {
    lateralCm:
      (localScenePoint[0] - projection.sensorOriginScene[0]) /
      projection.sceneUnitsPerCm,
    verticalCm:
      (localScenePoint[1] - projection.sensorOriginScene[1]) / scaledUnit,
    forwardCm:
      (projection.sensorOriginScene[2] - localScenePoint[2]) / scaledUnit,
  };
}

export function irObjectPointToLocalScenePoint(
  point: IrObjectPoint,
  projection: IrSensorFrameProjection,
): IrScenePoint {
  const scaledUnit =
    projection.sceneUnitsPerCm * projection.beamVisualScale;
  return [
    projection.sensorOriginScene[0] +
      point.lateralCm * projection.sceneUnitsPerCm,
    projection.sensorOriginScene[1] +
      (point.verticalCm ?? 0) * scaledUnit,
    projection.sensorOriginScene[2] - point.forwardCm * scaledUnit,
  ];
}

export function relativeRigEulerDeg(
  current: IrSensorRigEulerDeg,
  zero: IrSensorRigEulerDeg,
): IrSensorRigEulerDeg {
  const relativeQuaternion = createRigQuaternion(zero)
    .invert()
    .multiply(createRigQuaternion(current));
  const relativeEuler = new THREE.Euler().setFromQuaternion(
    relativeQuaternion,
    "YXZ",
  );

  return {
    yaw: cleanAngle(THREE.MathUtils.radToDeg(relativeEuler.y)),
    pitch: cleanAngle(THREE.MathUtils.radToDeg(relativeEuler.x)),
    roll: cleanAngle(THREE.MathUtils.radToDeg(relativeEuler.z)),
  };
}

export function createRigQuaternion(eulerDeg: IrSensorRigEulerDeg) {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(eulerDeg.pitch || 0),
      THREE.MathUtils.degToRad(eulerDeg.yaw || 0),
      THREE.MathUtils.degToRad(eulerDeg.roll || 0),
      "YXZ",
    ),
  );
}

function cleanAngle(value: number) {
  return Math.abs(value) < 1e-10 ? 0 : value;
}
