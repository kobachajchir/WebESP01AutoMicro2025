import * as THREE from "three";
import { IR_EMITTER_GEOMETRY, IR_MAX_RANGE_CM } from "../features/ir/irEmitterGeometry";
import { IR_OBJECT_CONE_HALF_ANGLE_DEG, type IrObjectAxialDetection, type IrObjectAxialDetections } from "../features/ir/irObjectModel";

// Render inside the GLB's own normalization group so optical anchors match the model.
export default function IrObjectDetectionMarkers({ detections, sensitivityCm, opacity }: {
  detections: IrObjectAxialDetections;
  sensitivityCm: number;
  opacity: number;
}) {
  return <group>{IR_EMITTER_GEOMETRY.map((config) => <DetectionMarker key={config.key}
    config={config} detection={detections[config.key]} sensitivityCm={sensitivityCm} opacity={opacity} />)}</group>;
}

function DetectionMarker({ config, detection, sensitivityCm, opacity }: {
  config: (typeof IR_EMITTER_GEOMETRY)[number];
  detection: IrObjectAxialDetection;
  sensitivityCm: number;
  opacity: number;
}) {
  const active = detection.detected;
  const angle = THREE.MathUtils.degToRad(config.opticalYawDeg);
  const rangeCm = Number.isFinite(sensitivityCm) ? Math.min(IR_MAX_RANGE_CM, Math.max(0, sensitivityCm)) : IR_MAX_RANGE_CM;
  const beamLength = Math.max(0.4, rangeCm) / 100;
  const distanceM = detection.distanceCm === null ? null : detection.distanceCm / 100;
  const crossSectionRadius = distanceM === null ? 0 : distanceM * Math.tan(THREE.MathUtils.degToRad(IR_OBJECT_CONE_HALF_ANGLE_DEG));
  const bubbleRadius = Math.max(0.00015, Math.min(0.0025, crossSectionRadius * 0.35));

  return <group position={[...config.positionM]} rotation={[0, angle, 0]}>
    <mesh position={[0, 0, -beamLength / 2]}>
      <boxGeometry args={[active ? 0.0012 : 0.0007, 0.0002, beamLength]} />
      <meshBasicMaterial color={active ? "#fb7185" : "#334155"} opacity={opacity} transparent depthWrite={false} />
    </mesh>
    {active && distanceM !== null ? <group position={[0, 0, -distanceM]}>
      <mesh raycast={() => null}>
        <sphereGeometry args={[bubbleRadius, 20, 14]} />
        <meshBasicMaterial color="#fb7185" opacity={0.95} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {crossSectionRadius > 0.00015 ? <>
        <mesh raycast={() => null}>
          <circleGeometry args={[crossSectionRadius, 32]} />
          <meshBasicMaterial color="#fb7185" opacity={0.12} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <mesh raycast={() => null}>
          <ringGeometry args={[crossSectionRadius * 0.93, crossSectionRadius, 32]} />
          <meshBasicMaterial color="#fb7185" opacity={0.7} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </> : null}
    </group> : null}
  </group>;
}
