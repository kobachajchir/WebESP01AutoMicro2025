import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type PresetKey =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "isoNE"
  | "isoNW";

export interface CameraRigHandle {
  goTo: (preset: PresetKey) => void;
}

interface CameraRigProps {
  target?: [number, number, number] | THREE.Vector3; // foco (default 0,0,0)
  durationMs?: number; // duración tween
}

/** Vive DENTRO del <Canvas>. Expone goTo(preset) por ref. */
const CameraRig = forwardRef<CameraRigHandle, CameraRigProps>(
  ({ target = [0, 0, 0], durationMs = 450 }, ref) => {
    const { camera } = useThree();

    const tgt = useMemo(
      () =>
        Array.isArray(target) ? new THREE.Vector3(...target) : target.clone(),
      [target]
    );

    // tween state
    const fromPos = useRef(new THREE.Vector3());
    const toPos = useRef(new THREE.Vector3());
    const tStart = useRef(0);
    const anim = useRef(false);

    const startTweenTo = (to: THREE.Vector3) => {
      fromPos.current.copy(camera.position);
      toPos.current.copy(to);
      tStart.current = performance.now();
      anim.current = true;
    };

    const dirFor = (k: PresetKey): THREE.Vector3 => {
      switch (k) {
        case "front":
          return new THREE.Vector3(0, 0, -1); // era (0, 0, 1)
        case "back":
          return new THREE.Vector3(0, 0, 1); // era (0, 0, -1)
        case "left":
          return new THREE.Vector3(1, 0, 0); // era (-1, 0, 0)
        case "right":
          return new THREE.Vector3(-1, 0, 0); // era (1, 0, 0)
        case "top":
          return new THREE.Vector3(0, 1, 0); // sin cambio
        case "bottom":
          return new THREE.Vector3(0, -1, 0); // sin cambio
        case "isoNE":
          return new THREE.Vector3(-1, 1, -1); // era (1, 1, 1)
        case "isoNW":
          return new THREE.Vector3(1, 1, -1); // era (-1, 1, 1)
        default:
          return new THREE.Vector3(0, 0, -1); // era (0, 0, 1)
      }
    };

    // API pública
    useImperativeHandle(
      ref,
      () => ({
        goTo: (preset: PresetKey) => {
          const dir = dirFor(preset);
          const distRaw = camera.position.clone().sub(tgt).length();
          const dist = Math.max(distRaw || 0, 0.2); // evita 0
          const dest = dir.normalize().multiplyScalar(dist).add(tgt);
          startTweenTo(dest);
        },
      }),
      [camera, tgt]
    );

    useFrame(() => {
      if (!anim.current) return;
      const t = Math.min(1, (performance.now() - tStart.current) / durationMs);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
      camera.position.lerpVectors(fromPos.current, toPos.current, e);
      camera.lookAt(tgt);
      if (t >= 1) anim.current = false;
    });

    return null;
  }
);

CameraRig.displayName = "CameraRig";
export default CameraRig;
