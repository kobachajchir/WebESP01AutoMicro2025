import { useEffect, useMemo, useRef } from "react";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  IR_EMITTER_HALF_ANGLE_DEG, IR_LINE_DIRECTION, IR_LINE_EMITTER_GEOMETRY,
  IR_MAX_RANGE_CM, WHITE_LED_GEOMETRY, WHITE_LED_HALF_ANGLE_DEG,
} from "../features/ir/irEmitterGeometry";

const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const FOOTPRINT_SEGMENTS = 32;
const BEAM_LENGTH_M = IR_MAX_RANGE_CM / 100;
const WHITE_FLOOR_HALO_RADIUS_M = 0.025;
const WHITE_BOUNCE_RANGE_M = 0.075;
// Fixed visual gain for the on state; the LED has no brightness control.
const WHITE_LIGHT_VISUAL_GAIN = 0.65;

function createWhiteGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    // RGB falloff lets additive light draw in the opaque/transmission capture.
    // Transparent alpha glows are otherwise missing behind the acrylic GLB.
    gradient.addColorStop(0, "rgb(255,255,255)");
    gradient.addColorStop(0.15, "rgb(242,242,242)");
    gradient.addColorStop(0.4, "rgb(160,160,160)");
    gradient.addColorStop(1, "rgb(0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function UnderbodySensorBeams({ lineEnabled, lightsEnabled, lineOpacity }: {
  lineEnabled: boolean | null;
  lightsEnabled: boolean;
  lineOpacity: number;
}) {
  const glowTexture = useMemo(createWhiteGlowTexture, []);
  useEffect(() => () => glowTexture.dispose(), [glowTexture]);
  return <group>
    {lineEnabled !== false && lineOpacity > 0 ? IR_LINE_EMITTER_GEOMETRY.map((sensor) => (
      <OpticalBeam key={sensor.key} positionM={sensor.positionM} direction={IR_LINE_DIRECTION}
        halfAngleDeg={IR_EMITTER_HALF_ANGLE_DEG} color="#22d3ee" opacity={lineOpacity} glowTexture={glowTexture} />
    )) : null}
    {lightsEnabled ? WHITE_LED_GEOMETRY.map((led) => (
      <OpticalBeam key={led.key} positionM={led.positionM} direction={[0, -1, 0]}
        halfAngleDeg={WHITE_LED_HALF_ANGLE_DEG} color="#ffffff" opacity={WHITE_LIGHT_VISUAL_GAIN} illuminate glowTexture={glowTexture} />
    )) : null}
  </group>;
}

function OpticalBeam({ positionM, direction, halfAngleDeg, color, opacity, illuminate = false, glowTexture }: {
  positionM: readonly [number, number, number];
  direction: readonly [number, number, number];
  halfAngleDeg: number;
  color: string;
  opacity: number;
  illuminate?: boolean;
  glowTexture: THREE.Texture;
}) {
  const beamRef = useRef<THREE.Group>(null);
  const footprintRef = useRef<THREE.Mesh>(null);
  const floorGlowRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  const bounceLightRef = useRef<THREE.PointLight>(null);
  const scene = useThree((state) => state.scene);
  const halfAngleRad = THREE.MathUtils.degToRad(halfAngleDeg);
  const slope = Math.tan(halfAngleRad);
  const whiteLightColor = useMemo(() => new THREE.Color().setRGB(opacity, opacity, opacity), [opacity]);
  const beamColor = illuminate ? whiteLightColor : color;
  const orientation = useMemo(() => new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(...direction).normalize(),
  ), [direction]);
  const lightTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, -BEAM_LENGTH_M, 0);
    return target;
  }, []);
  const footprint = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(FOOTPRINT_SEGMENTS * 9);
    const colors = new Float32Array(FOOTPRINT_SEGMENTS * 9);
    for (let i = 0; i < FOOTPRINT_SEGMENTS; i++) colors.fill(1, i * 9, i * 9 + 3);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return {
      geometry, positions, origin: new THREE.Vector3(), worldScale: new THREE.Vector3(),
      rotation: new THREE.Quaternion(), ray: new THREE.Vector3(),
      points: Array.from({ length: FOOTPRINT_SEGMENTS + 1 }, () => new THREE.Vector3()),
    };
  }, []);
  useEffect(() => () => footprint.geometry.dispose(), [footprint]);

  // Intersect the transformed cone with the world floor; glow and light share
  // the CAD source and current MPU pose. Light distance is in world units.
  useFrame(() => {
    const beam = beamRef.current;
    const mesh = footprintRef.current;
    if (!beam || !mesh) return;
    beam.updateWorldMatrix(true, false);
    beam.getWorldPosition(footprint.origin);
    beam.getWorldQuaternion(footprint.rotation);
    beam.getWorldScale(footprint.worldScale);
    const modelScale = Math.abs(footprint.worldScale.x);
    const maxDistance = BEAM_LENGTH_M * modelScale;
    if (lightRef.current) {
      lightRef.current.distance = maxDistance;
      // Compensate inverse-square attenuation for the normalized scene scale.
      // This is a visualization gain, not the installed LED's luminous power.
      lightRef.current.intensity = 160 * footprint.origin.y ** 2 * opacity;
    }
    const floorY = 0.0003;
    mesh.visible = false;
    if (floorGlowRef.current) floorGlowRef.current.visible = false;
    if (bounceLightRef.current) bounceLightRef.current.intensity = 0;
    if (footprint.origin.y <= floorY) return;
    for (let i = 0; i <= FOOTPRINT_SEGMENTS; i++) {
      const angle = (i - 1) * 2 * Math.PI / FOOTPRINT_SEGMENTS;
      footprint.ray.set(i === 0 ? 0 : Math.cos(angle) * slope, -1, i === 0 ? 0 : Math.sin(angle) * slope)
        .normalize().applyQuaternion(footprint.rotation);
      if (footprint.ray.y >= -0.00001) return;
      const distance = (floorY - footprint.origin.y) / footprint.ray.y;
      if (distance > maxDistance) return;
      footprint.points[i].copy(footprint.ray).multiplyScalar(distance).add(footprint.origin);
    }
    let radius = 0;
    for (let i = 0; i < FOOTPRINT_SEGMENTS; i++) {
      const next = (i + 1) % FOOTPRINT_SEGMENTS;
      footprint.points[0].toArray(footprint.positions, i * 9);
      footprint.points[i + 1].toArray(footprint.positions, i * 9 + 3);
      footprint.points[next + 1].toArray(footprint.positions, i * 9 + 6);
      radius = Math.max(radius, footprint.points[0].distanceTo(footprint.points[i + 1]));
    }
    footprint.geometry.attributes.position.needsUpdate = true;
    mesh.visible = true;
    if (floorGlowRef.current) {
      floorGlowRef.current.position.copy(footprint.points[0]);
      floorGlowRef.current.position.y += 0.00015;
      // Reflected spill stays visible beyond the small direct LED footprint.
      // The optical cone and its source-to-floor intersection keep their size.
      const haloRadius = Math.max(radius * 3, WHITE_FLOOR_HALO_RADIUS_M * modelScale);
      floorGlowRef.current.scale.set(haloRadius * 2, haloRadius * 2, 1);
      floorGlowRef.current.visible = true;
      if (bounceLightRef.current) {
        bounceLightRef.current.position.copy(footprint.points[0]);
        bounceLightRef.current.position.y += 0.001 * modelScale;
        bounceLightRef.current.distance = WHITE_BOUNCE_RANGE_M * modelScale;
        bounceLightRef.current.intensity = 4 * haloRadius ** 2 * opacity;
      }
    }
  });

  return <>
    <group ref={beamRef} position={[...positionM]} quaternion={orientation}>
      {!illuminate ? <mesh position={[0, -BEAM_LENGTH_M / 2, 0]}>
        <coneGeometry args={[BEAM_LENGTH_M * slope, BEAM_LENGTH_M, 32, 1, true]} />
        <meshBasicMaterial color={color} opacity={opacity} transparent side={THREE.DoubleSide}
          depthWrite={false} clippingPlanes={[FLOOR]} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh> : null}
      <mesh renderOrder={illuminate ? 1 : 0}>
        <sphereGeometry args={[illuminate ? 0.00065 : 0.00022, 12, 8]} />
        <meshBasicMaterial color={beamColor} opacity={opacity} transparent={!illuminate} depthWrite={false}
          blending={illuminate ? THREE.AdditiveBlending : THREE.NormalBlending} toneMapped={false} fog={!illuminate} />
      </mesh>
      {illuminate ? <>
        <sprite scale={[0.008, 0.008, 0.008]} renderOrder={1}>
          <spriteMaterial map={glowTexture} color={whiteLightColor} transparent={false}
            depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
        </sprite>
        <primitive object={lightTarget} />
        <spotLight ref={lightRef} target={lightTarget} color="#ffffff" intensity={0}
          angle={halfAngleRad} penumbra={0.45} decay={2} distance={1} castShadow={false} />
      </> : null}
    </group>
    {createPortal(<>
      <mesh ref={footprintRef} geometry={footprint.geometry} frustumCulled={false} renderOrder={illuminate ? 1 : 0}>
        <meshBasicMaterial color={beamColor} vertexColors opacity={opacity} transparent={!illuminate}
          side={THREE.DoubleSide} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} fog={!illuminate} />
      </mesh>
      {illuminate ? <mesh ref={floorGlowRef} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={glowTexture} color={whiteLightColor} transparent={false}
          side={THREE.DoubleSide} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} fog={false} />
      </mesh> : null}
      {illuminate ? <pointLight ref={bounceLightRef} color="#ffffff" intensity={0} decay={2} distance={1} castShadow={false} /> : null}
    </>, scene)}
  </>;
}
