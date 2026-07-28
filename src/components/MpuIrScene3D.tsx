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
} from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { type GLTF } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";
import type { IrSensorKey } from "../api/UnerFrameV2";
import { getSharedDracoLoader, ResilientGLTFLoader } from "../utils/dracoLoader";
import { useModelLoadingState } from "../hooks/useModelLoadingState";
import ModelLoadingScreen from "./ModelLoadingScreen";
import {
  IR_OBJECT_ADC_MAX,
  IR_OBJECT_CONE_HALF_ANGLE_DEG,
  IR_OBJECT_SENSOR_LAYOUT,
} from "../features/ir/irObjectModel";
import type {
  IrObjectPoint,
  IrObjectPositionEstimate,
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

export type SensorCameraPreset = "iso" | "top" | "front";
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
  showGrid: boolean;
  showBubble: boolean;
  showOrigin: boolean;
  sensorSensitivityCm: number;
  irSamplePeriodMs: number;
  renderLink: boolean;
  freezePose: boolean;
  irEmu: boolean;
  estimatedTarget: IrObjectPositionEstimate | null;
  onEmulatedTarget: (point: IrObjectPoint) => void;
}

const CAR_LENGTH_UNITS = 2.49;
const CAR_WIDTH_UNITS = 0.66;
const CAR_LENGTH_CM = 24.9;
const CAR_SENSOR_WALL_Z = -CAR_WIDTH_UNITS / 2;
const SCENE_UNITS_PER_CM = CAR_LENGTH_UNITS / CAR_LENGTH_CM;
const VEHICLE_VERTICAL_LIFT_UNITS = 1.5 * SCENE_UNITS_PER_CM;
const SENSOR_RELATIVE_LIFT_UNITS = 0.25 * SCENE_UNITS_PER_CM;
const SENSOR_MAX_RANGE_CM = 15;
const SENSOR_MIN_DISPLAY_RANGE_CM = 0.4;
const SENSOR_BEAM_VISUAL_SCALE = 1.25;
const SENSOR_ORIGIN_Y =
  0.32 + VEHICLE_VERTICAL_LIFT_UNITS + SENSOR_RELATIVE_LIFT_UNITS;
const VEHICLE_MODEL_Y_OFFSET = 0.24 + VEHICLE_VERTICAL_LIFT_UNITS;
const FALLBACK_VEHICLE_Y = 0.28 + VEHICLE_VERTICAL_LIFT_UNITS;
const SENSOR_EDGE_OFFSET_UNITS = 0;
const SENSOR_CONE_HALF_ANGLE_RAD = THREE.MathUtils.degToRad(
  IR_OBJECT_CONE_HALF_ANGLE_DEG,
);
const SENSOR_CONE_IDLE_OPACITY = 0.1;
const SENSOR_CONE_ACTIVE_OPACITY = 1;
const SENSOR_CONE_OPACITY_HOLD_MS = 500;
const SENSOR_CONE_OPACITY_FADE_MS = 500;
const SENSOR_ORIGIN: [number, number, number] = [
  0,
  SENSOR_ORIGIN_Y,
  CAR_SENSOR_WALL_Z - SENSOR_EDGE_OFFSET_UNITS,
];
const VEHICLE_RIG_PIVOT: IrScenePoint = [0, VEHICLE_MODEL_Y_OFFSET, 0];
const SENSOR_FRAME_PROJECTION: IrSensorFrameProjection = {
  pivotScene: VEHICLE_RIG_PIVOT,
  sensorOriginScene: SENSOR_ORIGIN,
  sceneUnitsPerCm: SCENE_UNITS_PER_CM,
  beamVisualScale: SENSOR_BEAM_VISUAL_SCALE,
};
const FLOOR_SENSOR_Z = SENSOR_ORIGIN[2];
const AUTO_ORIGIN: [number, number, number] = [0, 0.28, 0];

const FLOOR_SENSORS: Array<{
  key: IrSensorKey;
  label: string;
  objectSensorKey: (typeof IR_OBJECT_SENSOR_LAYOUT)[number]["key"];
}> = [
  {
    key: "lineLeft",
    label: "PISO IZQ.",
    objectSensorKey: "objectLeftCenter",
  },
  {
    key: "lineCenter",
    label: "PISO CENTRO",
    objectSensorKey: "objectCenter",
  },
  {
    key: "lineRight",
    label: "PISO DER.",
    objectSensorKey: "objectRightCenter",
  },
];

const MpuIrScene3D = forwardRef<MpuIrScene3DHandle, MpuIrScene3DProps>(
  function MpuIrScene3D(
    {
      modelUrl,
      eulerDeg,
      irNorm,
      showGrid,
      showBubble,
      showOrigin,
      sensorSensitivityCm,
      irSamplePeriodMs,
      renderLink,
      freezePose,
      irEmu,
      estimatedTarget,
      onEmulatedTarget,
    },
    ref,
  ) {
    const cameraControllerRef = useRef<SceneCameraControllerHandle>(null);
    const { isModelLoading, markModelLoaded } = useModelLoadingState(modelUrl);
    const [worldTarget, setWorldTarget] = useState<IrScenePoint | null>(null);
    const sensorConeOpacity = useTransientSensorConeOpacity(
      sensorSensitivityCm,
    );
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
        <ModelLoadingScreen visible={isModelLoading} />
        <Canvas
          camera={{ position: [2.7, 2.0, 3.05], fov: 40, near: 0.1, far: 80 }}
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
            gl.localClippingEnabled = true;
          }}
        >
          <color attach="background" args={["#03070d"]} />
          <fog attach="fog" args={["#04101c", 4.5, 10]} />
          <SceneCameraController ref={cameraControllerRef} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[2.5, 4, 3]} intensity={4.5} />
          <directionalLight position={[-4, 2, -2]} intensity={2.2} color="#67e8f9" />
          <pointLight position={[0, 1.4, -2]} intensity={6} color="#22d3ee" />
          {showGrid ? <TechnicalGrid /> : null}
          {irEmu ? (
            <IrEmulationSurface
              sensitivityCm={sensorSensitivityCm}
              onTargetChange={setWorldTarget}
            />
          ) : null}
          <VehicleSensorRig eulerDeg={eulerDeg}>
            <group position={[0, -VEHICLE_MODEL_Y_OFFSET, 0]}>
              {showBubble ? (
                <SensorCones
                  irNorm={irNorm}
                  renderLink={renderLink}
                  freezePose={freezePose}
                  sensitivityCm={sensorSensitivityCm}
                  opacity={sensorConeOpacity}
                />
              ) : null}
              {showOrigin ? <AxisGuides /> : null}
              <FloorSensorPlates irNorm={irNorm} />
              <ObstacleRays
                irNorm={irNorm}
                sensitivityCm={sensorSensitivityCm}
              />
              {irEmu && worldTarget && estimatedTarget?.detected ? (
                <IrEstimatedTargetMarker estimate={estimatedTarget} />
              ) : null}
            </group>
            <Suspense fallback={<FallbackVehicle />}>
              <VehicleModel
                modelUrl={modelUrl}
                onLoaded={markModelLoaded}
              />
            </Suspense>
          </VehicleSensorRig>
          {irEmu && worldTarget ? (
            <IrWorldTargetMarker worldPosition={worldTarget} />
          ) : null}
        </Canvas>
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

const SceneCameraController = forwardRef<SceneCameraControllerHandle>(
  function SceneCameraController(_, ref) {
    const { camera } = useThree();

    const moveTo = useCallback((position: [number, number, number]) => {
      camera.position.set(...position);
      camera.lookAt(0, 0.18, 0);
      camera.updateProjectionMatrix();
    }, [camera]);

    useImperativeHandle(
      ref,
      () => ({
        resetCamera: () => moveTo([2.7, 2.0, 3.05]),
        setCameraPreset: (preset) => {
          if (preset === "top") {
            moveTo([0, 4.15, 0.05]);
            return;
          }

          if (preset === "front") {
            moveTo([0, 1.1, -4.15]);
            return;
          }

          moveTo([2.7, 2.0, 3.05]);
        },
      }),
      [moveTo],
    );

    useEffect(() => {
      moveTo([2.7, 2.0, 3.05]);
    }, [moveTo]);

    return (
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableRotate
        enableZoom
        maxDistance={7}
        minDistance={1.7}
        target={[0, 0.18, 0]}
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
  onLoaded,
}: {
  modelUrl: string;
  onLoaded: () => void;
}) {
  const { scene } = useLoader(ResilientGLTFLoader, modelUrl, (loader) => {
    const base = import.meta.env.BASE_URL || "/";
    loader.setDRACOLoader(getSharedDracoLoader(base));
  }) as GLTF;

  useEffect(() => {
    onLoaded();
  }, [onLoaded, scene]);

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
    const normalizedRoot = new THREE.Group();
    clonedScene.position.sub(center);
    normalizedRoot.add(clonedScene);
    normalizedRoot.scale.setScalar(scale);
    return normalizedRoot;
  }, [scene]);

  return <primitive object={normalizedModel} />;
}

function FallbackVehicle() {
  return (
    <mesh position={[0, FALLBACK_VEHICLE_Y - VEHICLE_MODEL_Y_OFFSET, 0]}>
      <boxGeometry args={[CAR_WIDTH_UNITS, 0.18, CAR_LENGTH_UNITS]} />
      <meshStandardMaterial color="#38bdf8" metalness={0.2} roughness={0.35} />
    </mesh>
  );
}

function TechnicalGrid() {
  const grid = useMemo(() => {
    const helper = new THREE.GridHelper(8, 32, "#0ea5e9", "#12334a");
    const material = helper.material as THREE.Material;
    material.transparent = true;
    material.opacity = 0.42;
    return helper;
  }, []);

  return <primitive object={grid} position={[0, -0.01, 0]} />;
}

function SensorCones({
  irNorm,
  renderLink,
  freezePose,
  sensitivityCm,
  opacity,
}: {
  irNorm: Record<IrSensorKey, number>;
  renderLink: boolean;
  freezePose: boolean;
  sensitivityCm: number;
  opacity: number;
}) {
  const rangeUnits = sensorCmToSceneUnits(sensitivityCm);
  const coneRadiusUnits = rangeUnits * Math.tan(SENSOR_CONE_HALF_ANGLE_RAD);
  const coneOpacity = clamp01(opacity);
  const floorClippingPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    [],
  );

  return (
    <group>
      {IR_OBJECT_SENSOR_LAYOUT.map((sensor) => {
        const intensity = clamp01(irNorm[sensor.key] / IR_OBJECT_ADC_MAX);
        const active = intensity >= 0.03;
        const color = freezePose
          ? "#fbbf24"
          : active
            ? "#fb7185"
            : renderLink
              ? "#22d3ee"
              : "#64748b";

        return (
          <group
            key={sensor.key}
            position={[
              sensor.offsetCm * SCENE_UNITS_PER_CM,
              SENSOR_ORIGIN[1],
              SENSOR_ORIGIN[2],
            ]}
            rotation={[0, -THREE.MathUtils.degToRad(sensor.bearingDeg), 0]}
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
            <mesh
              position={[0, 0, -rangeUnits / 2]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <coneGeometry args={[coneRadiusUnits, rangeUnits, 40, 1, true]} />
              <meshBasicMaterial
                color={color}
                opacity={coneOpacity}
                transparent
                wireframe
                depthWrite={false}
                side={THREE.DoubleSide}
                clippingPlanes={[floorClippingPlane]}
                toneMapped={false}
              />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.022, 14, 10]} />
              <meshBasicMaterial color={color} toneMapped={false} />
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

function ObstacleRays({
  irNorm,
  sensitivityCm,
}: {
  irNorm: Record<IrSensorKey, number>;
  sensitivityCm: number;
}) {
  return (
    <group>
      {IR_OBJECT_SENSOR_LAYOUT.map((ray) => (
        <ObstacleRay
          key={ray.key}
          config={ray}
          norm={irNorm[ray.key]}
          sensitivityCm={sensitivityCm}
        />
      ))}
    </group>
  );
}

function ObstacleRay({
  config,
  norm,
  sensitivityCm,
}: {
  config: (typeof IR_OBJECT_SENSOR_LAYOUT)[number];
  norm: number;
  sensitivityCm: number;
}) {
  const intensity = clamp01(norm / IR_OBJECT_ADC_MAX);
  const active = intensity > 0.08;
  const angle = THREE.MathUtils.degToRad(config.bearingDeg);
  const beamLength = sensorCmToSceneUnits(sensitivityCm);
  const visualDistance = beamLength * (0.22 + (1 - intensity) * 0.78);
  const originX = config.offsetCm * SCENE_UNITS_PER_CM;
  const originZ = SENSOR_ORIGIN[2];

  return (
    <group
      position={[originX, SENSOR_ORIGIN[1], originZ]}
      rotation={[0, -angle, 0]}
    >
      <mesh position={[0, 0, -beamLength / 2]}>
        <boxGeometry args={[active ? 0.14 : 0.08, 0.025, beamLength]} />
        <meshBasicMaterial
          color={active ? "#fb7185" : "#334155"}
          opacity={active ? 0.28 + intensity * 0.32 : 0.1}
          transparent
          depthWrite={false}
        />
      </mesh>
      {active ? (
        <mesh
          position={[
            0,
            0,
            -visualDistance,
          ]}
        >
          <sphereGeometry args={[0.026 + intensity * 0.03, 20, 14]} />
          <meshStandardMaterial
            color="#fb7185"
            emissive="#fb7185"
            emissiveIntensity={0.55 + intensity * 0.9}
            opacity={0.46 + intensity * 0.3}
            transparent
            roughness={0.35}
          />
        </mesh>
      ) : null}
    </group>
  );
}

function FloorSensorPlates({ irNorm }: { irNorm: Record<IrSensorKey, number> }) {
  return (
    <group>
      {FLOOR_SENSORS.map((sensor) => {
        const intensity = clamp01(irNorm[sensor.key] / 4095);
        const sourceSensor = IR_OBJECT_SENSOR_LAYOUT.find(
          (candidate) => candidate.key === sensor.objectSensorKey,
        );
        const sensorX = (sourceSensor?.offsetCm ?? 0) * SCENE_UNITS_PER_CM;
        return (
          <mesh
            key={sensor.key}
            position={[sensorX, 0.015, FLOOR_SENSOR_Z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[CAR_WIDTH_UNITS * 0.28, 0.24]} />
            <meshBasicMaterial
              color={intensity > 0.08 ? "#22d3ee" : "#164e63"}
              opacity={0.16 + intensity * 0.54}
              transparent
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function useTransientSensorConeOpacity(sensitivityCm: number) {
  const [opacity, setOpacity] = useState(SENSOR_CONE_IDLE_OPACITY);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    let fadeFrameId: number | null = null;
    setOpacity(SENSOR_CONE_ACTIVE_OPACITY);

    const holdTimerId = window.setTimeout(() => {
      const fadeStartedAt = performance.now();

      const updateOpacity = (now: number) => {
        const progress = clamp01(
          (now - fadeStartedAt) / SENSOR_CONE_OPACITY_FADE_MS,
        );
        setOpacity(
          THREE.MathUtils.lerp(
            SENSOR_CONE_ACTIVE_OPACITY,
            SENSOR_CONE_IDLE_OPACITY,
            progress,
          ),
        );

        if (progress < 1) {
          fadeFrameId = window.requestAnimationFrame(updateOpacity);
        }
      };

      fadeFrameId = window.requestAnimationFrame(updateOpacity);
    }, SENSOR_CONE_OPACITY_HOLD_MS);

    return () => {
      window.clearTimeout(holdTimerId);
      if (fadeFrameId !== null) {
        window.cancelAnimationFrame(fadeFrameId);
      }
    };
  }, [sensitivityCm]);

  return opacity;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function sensorCmToSceneUnits(valueCm: number) {
  const clampedCm = Number.isFinite(valueCm)
    ? Math.min(SENSOR_MAX_RANGE_CM, Math.max(0, valueCm))
    : SENSOR_MAX_RANGE_CM;
  const visibleCm = Math.max(SENSOR_MIN_DISPLAY_RANGE_CM, clampedCm);
  return visibleCm * SCENE_UNITS_PER_CM * SENSOR_BEAM_VISUAL_SCALE;
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
