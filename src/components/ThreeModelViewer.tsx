import { Suspense, useRef, useEffect } from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as THREE from "three";
import { getSharedDracoLoader, ResilientGLTFLoader } from "../utils/dracoLoader";
import { useModelLoadingState } from "../hooks/useModelLoadingState";
import ModelLoadingScreen from "./ModelLoadingScreen";

// Extender JSX para incluir OrbitControls usando la nueva sintaxis v9
declare module "@react-three/fiber" {
  interface ThreeElements {
    orbitControls: ThreeElements["primitive"] & {
      args: ConstructorParameters<typeof OrbitControls>;
    };
  }
}

export interface ThreeModelViewerProps {
  /** Ruta al archivo .glb/.gltf */
  modelUrl: string;

  /** Orientación en grados: yaw (Y), pitch (X), roll (Z) */
  eulerDeg: {
    yaw: number;
    pitch: number;
    roll: number;
  };

  /** Habilita OrbitControls (por defecto: true) */
  allowControls?: boolean;

  /** Exposición del tone mapping (por defecto: 1.0) */
  exposure?: number;

  /** Color de fondo en formato CSS (por defecto: "#101014") */
  background?: string;
  classNames?: string;
  childrenInsideCanvas?: React.ReactNode;
}

interface ModelProps {
  url: string;
  onLoaded: () => void;
  eulerDeg: {
    yaw: number;
    pitch: number;
    roll: number;
  };
}

function Model({ url, eulerDeg, onLoaded }: ModelProps) {
  // useLoader v9 acepta instancias de loader para mejor control y pooling
  const { scene } = useLoader(ResilientGLTFLoader, url, (loader) => {
    const base = import.meta.env.BASE_URL || "/";
    loader.setDRACOLoader(getSharedDracoLoader(base));
  }) as GLTF;
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    onLoaded();
  }, [onLoaded, scene]);

  useEffect(() => {
    if (!groupRef.current || !scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    // Detectar si está en "lg" usando una media query
    const isLg = window.matchMedia("(min-width: 1024px)").matches;
    // Puedes usar isLg para ajustar el modelo o exponerlo como variable
    // Ejemplo: console.log("¿Está en lg?", isLg);
    // Aumentamos el scale para hacer el modelo más grande
    const scale = isLg ? 6 / maxDim : 8 / maxDim; // era 2, ahora es 4
    groupRef.current.scale.setScalar(scale);
    const center = new THREE.Vector3();
    box.getCenter(center);
    groupRef.current.position.copy(center.multiplyScalar(-scale));

    // Almacenar el centro escalado del modelo en el grupo para uso del CameraRig
    (groupRef.current as any).modelCenter = new THREE.Vector3(0, 0, 0);
  }, [scene]);

  // Aplicar rotaciones cuando cambien los valores
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.order = "YXZ";
    groupRef.current.rotation.y = THREE.MathUtils.degToRad(eulerDeg.yaw || 0);
    groupRef.current.rotation.x = THREE.MathUtils.degToRad(eulerDeg.pitch || 0);
    groupRef.current.rotation.z = THREE.MathUtils.degToRad(eulerDeg.roll || 0);
  }, [eulerDeg.yaw, eulerDeg.pitch, eulerDeg.roll]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

function FallbackModel({ eulerDeg }: { eulerDeg: ModelProps["eulerDeg"] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.rotation.order = "YXZ";
    meshRef.current.rotation.y = THREE.MathUtils.degToRad(eulerDeg.yaw || 0);
    meshRef.current.rotation.x = THREE.MathUtils.degToRad(eulerDeg.pitch || 0);
    meshRef.current.rotation.z = THREE.MathUtils.degToRad(eulerDeg.roll || 0);
  }, [eulerDeg.yaw, eulerDeg.pitch, eulerDeg.roll]);

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ff8844" />
    </mesh>
  );
}

function Controls() {
  // Obtener la cámara y el domElement del contexto de Three.js
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls>(null);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enablePan = true;
      controlsRef.current.enableZoom = true;
      controlsRef.current.enableRotate = true;
      // Limitamos el zoom para que no se pueda alejar demasiado
      controlsRef.current.minDistance = 0.5;
      controlsRef.current.maxDistance = 10;
      // Configurar el target en el origen (centro del modelo)
      controlsRef.current.target.set(0, 0, 0);

      // CONFIGURACIÓN PARA CONTROLES MÁS SUAVES
      controlsRef.current.enableDamping = true; // Habilita amortiguación
      controlsRef.current.dampingFactor = 0.08; // Factor de suavizado (0.05-0.15)
      controlsRef.current.rotateSpeed = 0.8; // Velocidad de rotación (más bajo = más lento)
      controlsRef.current.zoomSpeed = 1.2; // Velocidad de zoom
      controlsRef.current.panSpeed = 0.8; // Velocidad de paneo

      // Suavizado adicional para zoom con rueda del ratón
      controlsRef.current.screenSpacePanning = false; // Paneo en espacio 3D
    }
  }, []);

  return (
    <primitive
      ref={controlsRef}
      object={new OrbitControls(camera, gl.domElement)}
    />
  );
}

export interface ThreeModelViewerProps {
  modelUrl: string;
  eulerDeg: { yaw: number; pitch: number; roll: number };
  allowControls?: boolean;
  exposure?: number;
  background?: string; // ignorado si usamos transparente
  className?: string;
  childrenInsideCanvas?: React.ReactNode;
}

export default function ThreeModelViewer({
  modelUrl,
  eulerDeg,
  allowControls = true,
  exposure = 1.0,
  className = "",
  childrenInsideCanvas = null,
}: ThreeModelViewerProps) {
  const { isModelLoading, markModelLoaded } = useModelLoadingState(modelUrl);

  return (
    <div
      className={[
        "relative w-full h-full",
        "transition-[opacity,transform,box-shadow] duration-300",
        className,
      ].join(" ")}
    >
      <ModelLoadingScreen visible={isModelLoading} />
      <Canvas
        gl={(props) => {
          const renderer = new THREE.WebGLRenderer({
            ...props,
            antialias: true,
            alpha: true, // transparente
          });
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = exposure;
          return renderer;
        }}
        scene={{ background: null }} // fondo transparente (usa el del contenedor)
        dpr={Math.min(window.devicePixelRatio, 2)}
      >
        {/* Cámara más cerca y con FOV más amplio para mejor visualización */}
        <perspectiveCamera
          position={[0.3, 0.2, 0.4]} // vista frontal: Z positivo
          fov={45} // FOV más amplio: era 25
          near={1} // near plane más cerca
          far={100}
        />

        {/* Controles */}
        {allowControls && <Controls />}

        {/* Luces */}
        <ambientLight intensity={1} color="#ffffff" />
        <directionalLight
          position={[-3, 5, 4]}
          intensity={3}
          color="#ffffff"
        />
        <directionalLight
          position={[3, 2, -2]}
          intensity={6}
          color="#ffffff"
        />

        {/* Modelo con Suspense */}
        <Suspense fallback={<FallbackModel eulerDeg={eulerDeg} />}>
          <Model
            url={modelUrl}
            eulerDeg={eulerDeg}
            onLoaded={markModelLoaded}
          />
        </Suspense>

        {/* Extra dentro del Canvas (p.ej. <CameraRig ref=... />) */}
        {childrenInsideCanvas}
      </Canvas>
    </div>
  );
}
