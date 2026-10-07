import {
  forwardRef,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type ComponentRef,
} from "react";
import { useLoader, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { type GLTF } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";
import type { IrSensorKey } from "../api/UnerFrameV2";
import { getSharedDracoLoader, ResilientGLTFLoader } from "../utils/dracoLoader";
import ModelLoadingScreen from "./ModelLoadingScreen";
import ModelLoadBoundary from "./ModelLoadBoundary";
import WebGLCanvas from "./WebGLCanvas";
import UnderbodySensorBeams from "./UnderbodySensorBeams";
import IrObjectDetectionMarkers from "./IrObjectDetectionMarkers";
import { useIrEmitters } from "../contexts/IrEmittersContext";
import type { BeamOpacities } from "../features/ir/beamVisualSettings";
import {
  IR_OBJECT_ADC_MAX,
  IR_OBJECT_CONE_HALF_ANGLE_DEG,
  IR_OBJECT_SENSOR_LAYOUT,
} from "../features/ir/irObjectModel";
import type {
  IrObjectPoint,
  IrObjectPositionEstimate,
  IrObjectAxialDetections,
} from "../features/ir/irObjectModel";
import {
  irObjectPointToLocalScenePoint,
  worldScenePointToIrObjectPoint,
} from "../features/ir/irSensorFrame";
import type {
  IrScenePoint,
  IrSensorFrameProjection,
  IrSensorRigEulerDeg,
} from "../features/ir/irSensorFrame";
import {
  IR_CENTRAL_EMITTER_M,
  IR_EMITTER_GEOMETRY,
  IR_MODEL_CENTER_M,
  IR_MODEL_MAX_DIM_M,
  IR_MAX_RANGE_CM,
  MODEL_CENTER_HEIGHT_M,
  MODEL_GROUND_Y_M,
} from "../features/ir/irEmitterGeometry";

import { SENSOR_CAMERA_VIEWS, type SensorCameraPreset } from "../features/ir/sensorCameraViews";
export type { SensorCameraPreset } from "../features/ir/sensorCameraViews";
export type EulerDeg = IrSensorRigEulerDeg;

export interface MpuIrScene3DHandle {
  resetCamera: () => void;
  setCameraPreset: (preset: SensorCameraPreset) => void;
  clearIrTarget: () => void;
}

interface MpuIrScene3DProps {
  modelUrl: string;
  eulerDeg: EulerDeg;
  irNorm: Record<IrSensorKey, number>;
  objectDetections: IrObjectAxialDetections;
  showGrid: boolean;
  showObjectAxes: boolean;
  showLineAxes: boolean;
  beamOpacities: BeamOpacities;
  showOrigin: boolean;
  sensorSensitivityCm: number;
  irSamplePeriodMs: number;
  renderLink: boolean;
  irEmu: boolean;
  irAutoMotion?: boolean;
  estimatedTarget: IrObjectPositionEstimate | null;
  onEmulatedTarget: (point: IrObjectPoint) => void;
  onManualCameraChange: () => void;
}

const CAR_LENGTH_UNITS = 2.49;
const CAR_WIDTH_UNITS = 0.66;
const CAR_LENGTH_CM = IR_MODEL_MAX_DIM_M * 100;
const SCENE_UNITS_PER_CM = CAR_LENGTH_UNITS / CAR_LENGTH_CM;
const SENSOR_MAX_RANGE_CM = IR_MAX_RANGE_CM;
const SENSOR_MIN_DISPLAY_RANGE_CM = 0.4;
const SENSOR_BEAM_VISUAL_SCALE = 1;
const VEHICLE_MODEL_Y_OFFSET = MODEL_CENTER_HEIGHT_M * SCENE_UNITS_PER_CM * 100;
const SENSOR_CONE_HALF_ANGLE_RAD = THREE.MathUtils.degToRad(
  IR_OBJECT_CONE_HALF_ANGLE_DEG,
);
const SENSOR_ORIGIN: [number, number, number] = [
  (IR_CENTRAL_EMITTER_M[0] - IR_MODEL_CENTER_M[0]) * SCENE_UNITS_PER_CM * 100,
  (IR_CENTRAL_EMITTER_M[1] - IR_MODEL_CENTER_M[1]) * SCENE_UNITS_PER_CM * 100 + VEHICLE_MODEL_Y_OFFSET,
  (IR_CENTRAL_EMITTER_M[2] - IR_MODEL_CENTER_M[2]) * SCENE_UNITS_PER_CM * 100,
];
const VEHICLE_RIG_PIVOT: IrScenePoint = [0, VEHICLE_MODEL_Y_OFFSET, 0];
const SENSOR_FRAME_PROJECTION: IrSensorFrameProjection = {
  pivotScene: VEHICLE_RIG_PIVOT,
  sensorOriginScene: SENSOR_ORIGIN,
  sceneUnitsPerCm: SCENE_UNITS_PER_CM,
  beamVisualScale: SENSOR_BEAM_VISUAL_SCALE,
};
const AUTO_ORIGIN: [number, number, number] = [0, 0.28, 0];

const MpuIrScene3D = forwardRef<MpuIrScene3DHandle, MpuIrScene3DProps>(
  function MpuIrScene3D(
    {
      modelUrl,
      eulerDeg,
      irNorm,
      objectDetections,
      showGrid,
      showObjectAxes,
      showLineAxes,
      beamOpacities,
      showOrigin,
      sensorSensitivityCm,
      irSamplePeriodMs,
      renderLink,
      irEmu,
      irAutoMotion = false,
      estimatedTarget,
      onEmulatedTarget,
      onManualCameraChange,
    },
    ref,
  ) {
    const cameraControllerRef = useRef<SceneCameraControllerHandle>(null);
    const { state: emitters, available: emittersAvailable } = useIrEmitters();
    const [worldTarget, setWorldTarget] = useState<IrScenePoint | null>(null);
    const localEmulatedTarget = useMemo(
      () =>
        worldTarget
          ? worldScenePointToIrObjectPoint(
              worldTarget,
              {
                yaw: eulerDeg.yaw,
                pitch: eulerDeg.pitch,
                roll: eulerDeg.roll,
              },
              SENSOR_FRAME_PROJECTION,
            )
          : null,
      [eulerDeg.pitch, eulerDeg.roll, eulerDeg.yaw, worldTarget],
    );
    const localEmulatedTargetRef = useRef<IrObjectPoint | null>(
      localEmulatedTarget,
    );
    const hasWorldTarget = worldTarget !== null;

    useEffect(() => {
      localEmulatedTargetRef.current = localEmulatedTarget;
    }, [localEmulatedTarget]);

    useEffect(() => {
      if (!irEmu) {
        setWorldTarget(null);
      }
    }, [irEmu]);

    useEffect(() => {
      if (!irEmu || !irAutoMotion) return;
      const startedAt = performance.now();
      const moveTarget = () => {
        const phase = ((performance.now() - startedAt) / 7000) * Math.PI * 2;
        const rangeCm = Math.max(0.4, sensorSensitivityCm);
        // La trayectoria pertenece al mundo; la pose del auto modifica las lecturas IR.
        setWorldTarget(irObjectPointToLocalScenePoint({
          lateralCm: rangeCm * 0.7 * Math.sin(phase),
          forwardCm: rangeCm * (0.55 + 0.2 * Math.cos(phase)),
          verticalCm: 0,
        }, SENSOR_FRAME_PROJECTION));
      };
      moveTarget();
      const intervalId = window.setInterval(moveTarget, 50);
      return () => window.clearInterval(intervalId);
    }, [irEmu, irAutoMotion, sensorSensitivityCm]);

    useEffect(() => {
      if (!irEmu || !hasWorldTarget) {
        return;
      }

      const sampleTarget = () => {
        const target = localEmulatedTargetRef.current;
        if (target) {
          onEmulatedTarget(target);
        }
      };
      sampleTarget();
      const intervalId = window.setInterval(
        sampleTarget,
        Math.max(16, Math.round(irSamplePeriodMs)),
      );
      return () => window.clearInterval(intervalId);
    }, [
      irEmu,
      irSamplePeriodMs,
      onEmulatedTarget,
      hasWorldTarget,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        resetCamera: () => cameraControllerRef.current?.resetCamera(),
        setCameraPreset: (preset) =>
          cameraControllerRef.current?.setCameraPreset(preset),
        clearIrTarget: () => setWorldTarget(null),
      }),
      [],
    );

    return (
      <div className="sensor-scene-shell">
        <WebGLCanvas
          camera={{ position: [2.7, 2.0, 3.05], fov: 40, near: 0.1, far: 80 }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
            gl.localClippingEnabled = true;
          }}
        >
          <color attach="background" args={["#03070d"]} />
          <fog attach="fog" args={["#04101c", 4.5, 10]} />
          <SceneCameraController ref={cameraControllerRef} onManualCameraChange={onManualCameraChange} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[2.5, 4, 3]} intensity={4.5} />
          <directionalLight position={[-4, 2, -2]} intensity={2.2} color="#67e8f9" />
          <pointLight position={[0, 1.4, -2]} intensity={6} color="#22d3ee" />
          <SceneFloor />
          {showGrid ? <TechnicalGrid /> : null}
          {irEmu && !irAutoMotion ? (
            <IrEmulationSurface
              sensitivityCm={sensorSensitivityCm}
              onTargetChange={setWorldTarget}
            />
          ) : null}
          <VehicleSensorRig eulerDeg={eulerDeg}>
            <group position={[0, -VEHICLE_MODEL_Y_OFFSET, 0]}>
              {showOrigin ? <AxisGuides /> : null}
              {irEmu && worldTarget && estimatedTarget?.detected ? (
                <IrEstimatedTargetMarker estimate={estimatedTarget} />
              ) : null}
            </group>
            <ModelLoadBoundary modelUrl={modelUrl}>
            <Suspense fallback={<><FallbackVehicle /><ModelLoadingScreen visible /></>}>
              <VehicleModel
                modelUrl={modelUrl}
              >
                {showObjectAxes && beamOpacities.objects > 0 && (irEmu || emitters?.objects !== false) ? (
                  <SensorCones
                    irNorm={irNorm}
                    renderLink={renderLink}
                    sensitivityCm={sensorSensitivityCm}
                    opacity={beamOpacities.objects}
                  />
                ) : null}
                <UnderbodySensorBeams
                  lineEnabled={showLineAxes ? emittersAvailable ? emitters?.line ?? null : null : false}
                  lightsEnabled={emittersAvailable && emitters?.lights === true}
                  lineOpacity={beamOpacities.line} />
                {showObjectAxes && (irEmu || emitters?.objects !== false) ? <IrObjectDetectionMarkers
                  detections={objectDetections}
                  sensitivityCm={sensorSensitivityCm}
                  opacity={beamOpacities.objects}
                /> : null}
              </VehicleModel>
            </Suspense>
            </ModelLoadBoundary>
          </VehicleSensorRig>
          {irEmu && worldTarget ? (
            <IrWorldTargetMarker worldPosition={worldTarget} />
          ) : null}
        </WebGLCanvas>
        <div className="sensor-scene-reticle" aria-hidden="true" />
      </div>
    );
  },
);

export default MpuIrScene3D;

interface SceneCameraControllerHandle {
  resetCamera: () => void;
  setCameraPreset: (preset: SensorCameraPreset) => void;
}

const SceneCameraController = forwardRef<SceneCameraControllerHandle, { onManualCameraChange: () => void }>(
  function SceneCameraController({ onManualCameraChange }, ref) {
    const { camera } = useThree();
    const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
    const manualControlRef = useRef(false);

    const moveTo = useCallback((preset: SensorCameraPreset) => {
      manualControlRef.current = false;
      const view = SENSOR_CAMERA_VIEWS.find((entry) => entry.key === preset) ?? SENSOR_CAMERA_VIEWS[6];
      const controls = controlsRef.current;
      if (controls) {
        const damping = controls.enableDamping;
        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = damping;
        controls.target.set(0, VEHICLE_MODEL_Y_OFFSET, 0);
      }
      camera.position.set(view.position[0], view.position[1] + VEHICLE_MODEL_Y_OFFSET, view.position[2]);
      camera.up.set(view.up?.[0] ?? 0, view.up?.[1] ?? 1, view.up?.[2] ?? 0);
      camera.lookAt(0, VEHICLE_MODEL_Y_OFFSET, 0);
      camera.updateProjectionMatrix();
      controls?.update();
    }, [camera]);

    useImperativeHandle(
      ref,
      () => ({
        resetCamera: () => moveTo("iso"),
        setCameraPreset: moveTo,
      }),
      [moveTo],
    );

    useEffect(() => {
      moveTo("iso");
    }, [moveTo]);

    return (
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        enablePan
        screenSpacePanning
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        enableRotate
        enableZoom
        maxDistance={7}
        minDistance={1.7}
        onStart={() => { manualControlRef.current = true; }}
        onChange={() => { if (manualControlRef.current) onManualCameraChange(); }}
        onEnd={() => { manualControlRef.current = false; }}
      />
    );
  },
);

function VehicleSensorRig({
  eulerDeg,
  children,
}: {
  eulerDeg: EulerDeg;
  children: ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.order = "YXZ";
    groupRef.current.rotation.y = THREE.MathUtils.degToRad(eulerDeg.yaw || 0);
    groupRef.current.rotation.x = THREE.MathUtils.degToRad(eulerDeg.pitch || 0);
    groupRef.current.rotation.z = THREE.MathUtils.degToRad(eulerDeg.roll || 0);
  }, [eulerDeg.pitch, eulerDeg.roll, eulerDeg.yaw]);

  return (
    <group ref={groupRef} position={VEHICLE_RIG_PIVOT}>
      {children}
    </group>
  );
}

function VehicleModel({
  modelUrl,
  children,
}: {
  modelUrl: string;
  children: ReactNode;
}) {
  const { scene } = useLoader(ResilientGLTFLoader, modelUrl, (loader) => {
    loader.setDRACOLoader(getSharedDracoLoader());
  }) as GLTF;

  const normalizedModel = useMemo(() => {
    const clonedScene = scene.clone(true);
    clonedScene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = CAR_LENGTH_UNITS / maxDim;
    return { scene: clonedScene, center, scale, groundOffset: (center.y - MODEL_GROUND_Y_M) * scale };
  }, [scene]);

  // Model and emitter anchors share the same exact normalization and MPU pose.
  return (
    <group position={[0, normalizedModel.groundOffset - VEHICLE_MODEL_Y_OFFSET, 0]} scale={normalizedModel.scale}>
      <group position={[
        -normalizedModel.center.x,
        -normalizedModel.center.y,
        -normalizedModel.center.z,
      ]}>
        <primitive object={normalizedModel.scene} />
        {children}
      </group>
    </group>
  );
}

function FallbackVehicle() {
  return (
    <mesh position={[0, 0.09 - VEHICLE_MODEL_Y_OFFSET, 0]}>
      <boxGeometry args={[CAR_WIDTH_UNITS, 0.18, CAR_LENGTH_UNITS]} />
      <meshStandardMaterial color="#38bdf8" metalness={0.2} roughness={0.35} />
    </mesh>
  );
}

function SceneFloor() {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0002, 0]}>
    <planeGeometry args={[8, 8]} />
    <meshStandardMaterial color="#07111d" roughness={1} metalness={0} side={THREE.FrontSide} />
  </mesh>;
}

function TechnicalGrid() {
  const grid = useMemo(() => {
    const helper = new THREE.GridHelper(8, 32, "#0ea5e9", "#12334a");
    const material = helper.material as THREE.Material;
    material.transparent = true;
    material.opacity = 0.42;
    return helper;
  }, []);

  return <primitive object={grid} position={[0, 0, 0]} />;
}

function SensorCones({
  irNorm,
  renderLink,
  sensitivityCm,
  opacity,
}: {
  irNorm: Record<IrSensorKey, number>;
  renderLink: boolean;
  sensitivityCm: number;
  opacity: number;
}) {
  const rangeUnits = sensorCmToModelMeters(sensitivityCm);
  const coneRadiusUnits = rangeUnits * Math.tan(SENSOR_CONE_HALF_ANGLE_RAD);
  const coneOpacity = clamp01(opacity);
  const floorClippingPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    [],
  );

  return (
    <group>
      {IR_EMITTER_GEOMETRY.map((sensor) => {
        const intensity = clamp01(irNorm[sensor.key] / IR_OBJECT_ADC_MAX);
        const active = intensity >= 0.03;
        const color = active
            ? "#fb7185"
            : renderLink
              ? "#22d3ee"
              : "#64748b";

        return (
          <group
            key={sensor.key}
            position={[...sensor.positionM]}
            rotation={[0, THREE.MathUtils.degToRad(sensor.opticalYawDeg), 0]}
          >
            <mesh
              position={[0, 0, -rangeUnits / 2]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <coneGeometry args={[coneRadiusUnits, rangeUnits, 40, 1, true]} />
              <meshBasicMaterial
                color={color}
                opacity={coneOpacity}
                transparent
                depthWrite={false}
                side={THREE.DoubleSide}
                clippingPlanes={[floorClippingPlane]}
                blending={THREE.AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.0003, 14, 10]} />
              <meshBasicMaterial color={color} transparent opacity={coneOpacity} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function IrEmulationSurface({
  sensitivityCm,
  onTargetChange,
}: {
  sensitivityCm: number;
  onTargetChange: (point: IrScenePoint) => void;
}) {
  const rangeUnits = sensorCmToSceneUnits(sensitivityCm);
  const maxSensorOffset = Math.max(
    ...IR_OBJECT_SENSOR_LAYOUT.map(
      (sensor) => Math.abs(sensor.offsetCm) * SCENE_UNITS_PER_CM,
    ),
  );
  const planeSize = (maxSensorOffset + rangeUnits + 0.3) * 2;

  function updateTarget(event: ThreeEvent<PointerEvent>) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.stopPropagation();
    onTargetChange([event.point.x, event.point.y, event.point.z]);
  }

  return (
    <mesh
      position={[
        0,
        SENSOR_ORIGIN[1] - 0.012,
        0,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={updateTarget}
      onPointerDown={updateTarget}
    >
      <planeGeometry args={[planeSize, planeSize]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        colorWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function IrWorldTargetMarker({
  worldPosition,
}: {
  worldPosition: IrScenePoint;
}) {
  return (
    <group>
      <mesh
        position={[worldPosition[0], worldPosition[1] + 0.035, worldPosition[2]]}
        raycast={() => null}
      >
        <sphereGeometry args={[0.055, 20, 14]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#f59e0b"
          emissiveIntensity={0.9}
          roughness={0.28}
        />
      </mesh>
      <mesh
        position={[worldPosition[0], worldPosition[1] + 0.002, worldPosition[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <ringGeometry args={[0.072, 0.086, 32]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function IrEstimatedTargetMarker({
  estimate,
}: {
  estimate: IrObjectPositionEstimate;
}) {
  const estimatePosition = scenePositionForObjectPoint(estimate, 0.045);
  const uncertaintyUnits = Math.max(
    0.045,
    estimate.uncertaintyCm * SCENE_UNITS_PER_CM * SENSOR_BEAM_VISUAL_SCALE,
  );

  return (
    <group>
      <mesh position={estimatePosition} raycast={() => null}>
        <octahedronGeometry args={[0.052, 0]} />
        <meshStandardMaterial
          color={estimate.ambiguous ? "#fb7185" : "#22d3ee"}
          emissive={estimate.ambiguous ? "#e11d48" : "#0891b2"}
          emissiveIntensity={0.85}
          roughness={0.3}
        />
      </mesh>
      <mesh
        position={[
          estimatePosition[0],
          estimatePosition[1] - 0.041,
          estimatePosition[2],
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <ringGeometry args={[uncertaintyUnits * 0.82, uncertaintyUnits, 44]} />
        <meshBasicMaterial
          color={estimate.ambiguous ? "#fb7185" : "#22d3ee"}
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function AxisGuides() {
  return (
    <group>
      <AxisArrow color="#fb7185" direction={[1, 0, 0]} labelPosition={[0.55, AUTO_ORIGIN[1], AUTO_ORIGIN[2]]} />
      <AxisArrow color="#4ade80" direction={[0, 0, -1]} labelPosition={[0, AUTO_ORIGIN[1], AUTO_ORIGIN[2] - 0.55]} />
      <AxisArrow color="#38bdf8" direction={[0, 1, 0]} labelPosition={[0.08, AUTO_ORIGIN[1] + 0.55, AUTO_ORIGIN[2]]} />
    </group>
  );
}

function AxisArrow({
  color,
  direction,
  labelPosition,
}: {
  color: string;
  direction: [number, number, number];
  labelPosition: [number, number, number];
}) {
  const object = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    return new THREE.ArrowHelper(
      dir,
      new THREE.Vector3(...AUTO_ORIGIN),
      0.52,
      color,
      0.08,
      0.035,
    );
  }, [color, direction]);

  return (
    <>
      <primitive object={object} />
      <mesh position={labelPosition}>
        <sphereGeometry args={[0.035, 12, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </>
  );
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function sensorCmToSceneUnits(valueCm: number) {
  return sensorCmToModelMeters(valueCm) * SCENE_UNITS_PER_CM * 100;
}

function sensorCmToModelMeters(valueCm: number) {
  const clampedCm = Number.isFinite(valueCm)
    ? Math.min(SENSOR_MAX_RANGE_CM, Math.max(0, valueCm))
    : SENSOR_MAX_RANGE_CM;
  const visibleCm = Math.max(SENSOR_MIN_DISPLAY_RANGE_CM, clampedCm);
  return visibleCm / 100;
}

function scenePositionForObjectPoint(
  point: IrObjectPoint,
  yOffset = 0,
): [number, number, number] {
  const localScenePoint = irObjectPointToLocalScenePoint(
    point,
    SENSOR_FRAME_PROJECTION,
  );
  return [
    localScenePoint[0],
    localScenePoint[1] + yOffset,
    localScenePoint[2],
  ];
}
