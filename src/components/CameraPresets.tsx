import { useCallback, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type PresetKey =
 | "front"
 | "back"
 | "left"
 | "right"
 | "top"
 | "bottom"
 | "isoNE"
 | "isoNW";

interface CameraPresetsProps {
 /** Punto a mirar (target). Si tu modelo está centrado, dejalo en [0,0,0] */
 target?: THREE.Vector3 | [number, number, number];
 /** Duración de transición en ms */
 durationMs?: number;
 /** Clase para el panel (tailwind o css) */
 className?: string;
}

export default function CameraPresets({
 target = [0, 0, 0],
 durationMs = 450,
 className = "",
}: CameraPresetsProps) {
 const { camera } = useThree();
 const tgt = useMemo(() => {
 return Array.isArray(target)
 ? new THREE.Vector3(...target)
 : target.clone();
 }, [target]);

 // tween state
 const fromPos = useRef(new THREE.Vector3());
 const toPos = useRef(new THREE.Vector3());
 const tStart = useRef(0);
 const animating = useRef(false);

 const startTweenTo = useCallback(
 (to: THREE.Vector3) => {
 fromPos.current.copy(camera.position);
 toPos.current.copy(to);
 tStart.current = performance.now();
 animating.current = true;
 },
 [camera.position]
 );

 useFrame(() => {
 if (!animating.current) return;
 const elapsed = performance.now() - tStart.current;
 const t = Math.min(1, elapsed / durationMs);
 // easeInOutQuad
 const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
 camera.position.lerpVectors(fromPos.current, toPos.current, e);
 camera.lookAt(tgt);
 if (t >= 1) animating.current = false;
 });

 // calcula un destino con misma distancia actual a target
 const go = useCallback(
 (dir: THREE.Vector3) => {
 const dist = camera.position.clone().sub(tgt).length() || 3;
 const dest = dir.clone().normalize().multiplyScalar(dist).add(tgt);
 startTweenTo(dest);
 },
 [camera, tgt, startTweenTo]
 );

 // presets (ejes de mundo Y-up)
 const handlers: Record<PresetKey, () => void> = {
 front: () => go(new THREE.Vector3(0, 0, 1)),
 back: () => go(new THREE.Vector3(0, 0, -1)),
 left: () => go(new THREE.Vector3(-1, 0, 0)),
 right: () => go(new THREE.Vector3(1, 0, 0)),
 top: () => go(new THREE.Vector3(0, 1, 0)),
 bottom: () => go(new THREE.Vector3(0, -1, 0)),
 // diagonales superiores (isométricas “NE” y “NW”)
 isoNE: () => go(new THREE.Vector3(1, 1, 1)),
 isoNW: () => go(new THREE.Vector3(-1, 1, 1)),
 };

 const Btn = (p: { onClick: () => void; label: string }) => (
 <button
 onClick={p.onClick}
 className="inline-flex items-center justify-center gap-2
 rounded-xl px-3 py-2 text-xs font-medium
 bg-[var(--ui-panel-hover)] dark:bg-[var(--ui-panel)]
 ring-1 ring-[var(--ui-ring)] dark:ring-[var(--ui-ring)]
 text-[var(--ui-text)] dark:text-[var(--ui-text)]
 shadow-sm hover:shadow-md active:shadow
 hover:bg-[var(--ui-panel-hover)] dark:hover:bg-[var(--ui-panel)]
 transition-all duration-200
 focus:outline-none focus:ring-2 focus:ring-indigo-500/40
 data-[state=idle]:opacity-100"
 data-state="idle"
 >
 {p.label}
 </button>
 );

 return (
 <div
 className={[
 "rounded-2xl bg-[var(--ui-panel-hover)] dark:bg-[var(--ui-panel)]",
 "ring-1 ring-[var(--ui-ring)] shadow-sm backdrop-blur p-4",
 "transition-shadow hover:shadow-md",
 className,
 ].join(" ")}
 >
 <h3 className="m-0 mb-2 text-[var(--ui-text)] text-sm font-semibold">Vistas</h3>

 <div className="grid grid-cols-3 gap-2">
 <Btn onClick={handlers.front} label="Frente" />
 <Btn onClick={handlers.back} label="Atrás" />
 <Btn onClick={handlers.top} label="Arriba" />
 <Btn onClick={handlers.bottom} label="Abajo" />
 <Btn onClick={handlers.left} label="Izq." />
 <Btn onClick={handlers.right} label="Der." />
 <Btn onClick={handlers.isoNE} label="ISO NE" />
 <Btn onClick={handlers.isoNW} label="ISO NW" />
 </div>

 <p className="text-[11px] text-[var(--ui-muted)] mt-3">
 Posiciona la cámara y mantiene el foco en el origen (0,0,0).
 </p>
 </div>
 );
}
