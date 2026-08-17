import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { type GLTF } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";
import MotorBlock, { type BlockKind } from "../components/MotorBlock";
import PageHeader from "../components/PageHeader";
import SectionStatusStrip from "../components/SectionStatusStrip";
import StopDiscontinuityGlyph from "../components/StopDiscontinuityGlyph";
import TimelineRow from "../components/TimelineRow";
import TransportActionButton from "../components/TransportActionButton";
import type { Block, Dir, TrackKey } from "../types/MotorTypes";
import Modal from "../components/modal";
import SystemResetActions from "../components/SystemResetActions";
import ThemeModeToggleCard from "../components/ThemeModeToggleCard";
import HdAssetsSettingsCard from "../components/HdAssetsSettingsCard";
import HdModelQualityButton from "../components/HdModelQualityButton";
import { usePreferredModelUrl } from "../contexts/AssetQualityContext";
import { getSharedDracoLoader, ResilientGLTFLoader } from "../utils/dracoLoader";
import ModelLoadingScreen from "../components/ModelLoadingScreen";
import { useModelLoadingState } from "../hooks/useModelLoadingState";
import { useWebSocket } from "../hooks/useWebSocket";
import { useCarMode } from "../contexts/CarModeContext";
import {
 getEspConnectionDetail,
 getEspConnectionLabel,
 useEspWifiStatus,
} from "../contexts/EspWifiStatusContext";

const uid = () => Math.random().toString(36).slice(2);

const initialBlocks: Block[] = [
 {
 id: uid(),
 kind: "ramp",
 label: "Ramp UP",
 durationMs: 800,
 direction: 0 as Dir,
 } as any,
 {
 id: uid(),
 kind: "hold",
 label: "Hold",
 durationMs: 600,
 speed: 60,
 direction: 0 as Dir,
 } as any,
 {
 id: uid(),
 kind: "arc",
 label: "Arc L",
 durationMs: 700,
 speed: 55,
 direction: 0 as Dir,
 } as any,
 {
 id: uid(),
 kind: "pivot",
 label: "Pivot R",
 durationMs: 500,
 speed: 50,
 direction: 0 as Dir,
 } as any,
 {
 id: uid(),
 kind: "ramp",
 label: "Ramp DN",
 durationMs: 900,
 direction: 1 as Dir,
 } as any,
 {
 id: uid(),
 kind: "stop",
 label: "Stop",
 durationMs: 0,
 direction: 0 as Dir,
 } as any,
];

const kindColor: Record<BlockKind, string> = {
 ramp: "bg-amber-500/80",
 hold: "bg-emerald-500/80",
 pivot: "bg-sky-500/80",
 arc: "bg-indigo-500/80",
 stop: "bg-rose-500/80",
};

const labelES: Record<BlockKind, string> = {
 ramp: "RAMPA",
 hold: "CONSTANTE",
 pivot: "PIVOTE",
 arc: "CURVA",
 stop: "DETENER",
};

const TICK_MS = 50;
const SEGMENTED_BUTTON_CLASS =
 "min-w-[132px] rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40";

// Props persistidas por bloque + pairing para pivots en modo simple
type BlockProps = {
 durationMs: number;
 speed?: number;
 fromPct?: number;
 toPct?: number;
 arcSide?: 0 | 1;
 pivotBaseDir?: Dir;
 pivotPairId?: string; // <-- id de pareja de pivot
};

type MinimalBlockProps = { fromPct?: number; toPct?: number; speed?: number };

type ValidationIssue = {
 track: TrackKey;
 blockId?: string;
 severity: "error" | "warning";
 message: string;
};

type SimulationPose = {
 x: number;
 y: number;
 yawDeg: number;
 leftPct: number;
 rightPct: number;
 path: Array<{ x: number; y: number }>;
};

const INITIAL_SIM_POSE: SimulationPose = {
 x: 0,
 y: 0,
 yawDeg: -90,
 leftPct: 0,
 rightPct: 0,
 path: [{ x: 0, y: 0 }],
};

const PHYSICAL_EXECUTION_CAPABILITY = false;

export default function ControlSection() {
 const { connected } = useWebSocket();
 const { mode: carMode, isTestMode, status: carModeStatus } = useCarMode();

 // === BLOQUES POR TRACK ===
 const [blocksLeft, setBlocksLeft] = useState<Block[]>(() =>
 initialBlocks.map((b) => ({ ...(b as any), id: uid() }))
 );
 const [blocksRight, setBlocksRight] = useState<Block[]>(() =>
 initialBlocks.map((b) => ({ ...(b as any), id: uid() }))
 );
 const [blocksDual, setBlocksDual] = useState<Block[]>(() =>
 initialBlocks
 .filter((b) => b.kind !== "pivot")
 .map((b) => ({ ...(b as any), id: uid() }))
 );

 // === SELECCIÓN ÚNICA GLOBAL ===
 const [selection, setSelection] = useState<{
 track: TrackKey;
 id: string;
 } | null>(() => {
 const first = blocksLeft[0]?.id;
 return first ? { track: "left", id: first } : null;
 });

 // Par de pivot a resaltar (reactivo)
 const [pairSelected, setPairSelected] = useState<{
 track: TrackKey;
 id: string;
 } | null>(null);

 // Modo Dual
 const [dualMode, setDualMode] = useState(false);

 // === ESTADOS DE PLAYBACK POR TRACK ===
 const [activeIndexLeft, setActiveIndexLeft] = useState<number>(-1);
 const [activeIndexRight, setActiveIndexRight] = useState<number>(-1);
 const [activeIndexDual, setActiveIndexDual] = useState<number>(-1);

 const [activeProgressLeft, setActiveProgressLeft] = useState(0);
 const [activeProgressRight, setActiveProgressRight] = useState(0);
 const [activeProgressDual, setActiveProgressDual] = useState(0);

 const [isPlayingLeft, setIsPlayingLeft] = useState(false);
 const [isPlayingRight, setIsPlayingRight] = useState(false);
 const [isPlayingDual, setIsPlayingDual] = useState(false);

 const [openSettingsModal, setOpenSettingsModal] = useState(false);
 const [openInfoModal, setOpenInfoModal] = useState(false);
 const [validationRan, setValidationRan] = useState(false);
 const [lastLocalEvent, setLastLocalEvent] = useState("Listo para edición");
 const [simPose, setSimPose] = useState<SimulationPose>(INITIAL_SIM_POSE);

 // Timers
 const timerLeftRef = useRef<number | null>(null);
 const timerRightRef = useRef<number | null>(null);
 const timerDualRef = useRef<number | null>(null);

 // Timestamps
 const blockStartLeftRef = useRef<number>(0);
 const blockStartRightRef = useRef<number>(0);
 const blockStartDualRef = useRef<number>(0);
 const simulationRuntimeRef = useRef({
 dualMode,
 blocksLeft: [] as Block[],
 blocksRight: [] as Block[],
 blocksDual: [] as Block[],
 blockPropsLeft: {} as Record<string, MinimalBlockProps>,
 blockPropsRight: {} as Record<string, MinimalBlockProps>,
 blockPropsDual: {} as Record<string, MinimalBlockProps>,
 activeIndexLeft: -1,
 activeIndexRight: -1,
 activeIndexDual: -1,
 activeProgressLeft: 0,
 activeProgressRight: 0,
 activeProgressDual: 0,
 });

 // === MAPA DE PROPIEDADES POR BLOQUE (persistencia) ===
 const [blockProps, setBlockProps] = useState<Record<string, BlockProps>>({});

 // Defaults según tipo/rampa/dirección
 const getDefaultPropsFor = (b: Block): BlockProps => {
 const isRamp = b.kind === "ramp";
 const dir = (b as any).direction ?? 0; // 0=UP, 1=DN
 const rampFrom = dir === 1 ? 80 : 20; // DN: alto→bajo, UP: bajo→alto
 const rampTo = dir === 1 ? 20 : 80;

 return {
 durationMs: b.durationMs ?? 700,
 speed: (b as any).speed ?? 60,
 fromPct: isRamp ? rampFrom : 60,
 toPct: isRamp ? rampTo : 80,
 arcSide: 0,
 pivotBaseDir: 0,
 };
 };

 // === ESTADO DEL PANEL (se carga al seleccionar) ===
 const [durationMs, setDurationMs] = useState<number>(700);
 const [speed, setSpeed] = useState<number>(60);
 const [direction, setDirection] = useState<Dir>(0);
 const [fromPct, setFromPct] = useState<number>(60);
 const [toPct, setToPct] = useState<number>(80);
 const [arcSide, setArcSide] = useState<0 | 1>(0);
 const [pivotBaseDir, setPivotBaseDir] = useState<Dir>(0);

 // Precargar props para todos los bloques iniciales
 useEffect(() => {
 setBlockProps((prev) => {
 if (Object.keys(prev).length > 0) return prev;
 const acc: Record<string, BlockProps> = {};
 const fill = (list: Block[]) => {
 list.forEach((b) => {
 acc[b.id] = getDefaultPropsFor(b);
 });
 };
 fill(blocksLeft);
 fill(blocksRight);
 fill(blocksDual);
 return acc;
 });
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // Cargar props al seleccionar (incluye deps para evitar valores viejos)
 useEffect(() => {
 if (!selection) return;
 const list =
 selection.track === "left"
 ? blocksLeft
 : selection.track === "right"
 ? blocksRight
 : blocksDual;

 const blk = list.find((b) => b.id === selection.id);
 if (!blk) return;
 const p = blockProps[blk.id] ?? getDefaultPropsFor(blk);

 setDurationMs(p.durationMs ?? blk.durationMs ?? 700);
 setSpeed(p.speed ?? (blk as any).speed ?? 60);
 setDirection((blk as any).direction ?? 0);
 setFromPct(p.fromPct ?? 60);
 setToPct(p.toPct ?? 80);
 setArcSide((p.arcSide ?? 0) as 0 | 1);
 setPivotBaseDir(p.pivotBaseDir ?? 0);
 }, [
 selection?.id,
 selection?.track,
 blocksLeft,
 blocksRight,
 blocksDual,
 blockProps,
 ]);

 // === HELPERS DE TRACK ===
 const getBlocks = (t: TrackKey) =>
 t === "left" ? blocksLeft : t === "right" ? blocksRight : blocksDual;
 const setBlocks = (t: TrackKey) => (fn: (prev: Block[]) => Block[]) => {
 if (t === "left") setBlocksLeft(fn);
 else if (t === "right") setBlocksRight(fn);
 else setBlocksDual(fn);
 };
 const timerRef = (t: TrackKey) =>
 t === "left" ? timerLeftRef : t === "right" ? timerRightRef : timerDualRef;
 const blockStartRef = (t: TrackKey) =>
 t === "left"
 ? blockStartLeftRef
 : t === "right"
 ? blockStartRightRef
 : blockStartDualRef;

 const setActiveIndex = (t: TrackKey, idx: number) => {
 if (t === "left") setActiveIndexLeft(idx);
 else if (t === "right") setActiveIndexRight(idx);
 else setActiveIndexDual(idx);
 };
 const setActiveProgress = (t: TrackKey, prog: number) => {
 const p = Math.max(0, Math.min(1, prog));
 if (t === "left") setActiveProgressLeft(p);
 else if (t === "right") setActiveProgressRight(p);
 else setActiveProgressDual(p);
 };

 const clearTimer = (t: TrackKey) => {
 const ref = timerRef(t);
 if (ref.current) {
 window.clearTimeout(ref.current);
 ref.current = null;
 }
 };

 const stopTrack = (t: TrackKey) => {
 clearTimer(t);
 setActiveIndex(t, -1);
 setActiveProgress(t, 0);
 if (t === "left") setIsPlayingLeft(false);
 else if (t === "right") setIsPlayingRight(false);
 else setIsPlayingDual(false);
 };

 const stopAllTracks = () => {
 (["left", "right", "dual"] as TrackKey[]).forEach((t) => stopTrack(t));
 };

 useEffect(() => {
 return () => {
 (["left", "right", "dual"] as TrackKey[]).forEach(clearTimer);
 };
 }, []);

 // === PLAY / SCHEDULER ===
 const startTrack = (t: TrackKey) => {
 const list = getBlocks(t);
 if (!list.length) return;

 clearTimer(t);
 setLastLocalEvent(`Simulación local: ${trackLabel(t)}`);
 setActiveIndex(t, 0);
 setActiveProgress(t, 0);
 if (t === "left") setIsPlayingLeft(true);
 else if (t === "right") setIsPlayingRight(true);
 else setIsPlayingDual(true);
 runBlock(t, 0);
 };

 const runBlock = (t: TrackKey, i: number) => {
 const list = getBlocks(t);
 if (i >= list.length) {
 stopTrack(t);
 return;
 }
 const b = list[i] as any;
 const now = Date.now();
 blockStartRef(t).current = now;

 if (b.durationMs <= 0) {
 setActiveIndex(t, i);
 setActiveProgress(t, 1);
 timerRef(t).current = window.setTimeout(
 () => runBlock(t, i + 1),
 TICK_MS
 );
 return;
 }

 setActiveIndex(t, i);
 setActiveProgress(t, 0);

 const tick = () => {
 const elapsed = Date.now() - blockStartRef(t).current;
 const p = elapsed / b.durationMs;
 if (p >= 1) {
 setActiveProgress(t, 1);
 timerRef(t).current = window.setTimeout(
 () => runBlock(t, i + 1),
 TICK_MS
 );
 } else {
 setActiveProgress(t, p);
 timerRef(t).current = window.setTimeout(tick, TICK_MS);
 }
 };
 timerRef(t).current = window.setTimeout(tick, TICK_MS);
 };

 // Selección bloqueada si hay reproducción
 const selectionLocked = isPlayingLeft || isPlayingRight || isPlayingDual;

 const attemptSelect = (track: TrackKey, id: string | null) => {
 if (selectionLocked) return;

 // Limpiar highlight anterior
 setPairSelected(null);

 if (!id) {
 setSelection(null);
 return;
 }

 setSelection({ track, id });

 // Si es pivot en modo simple, buscar y marcar el par
 if (!dualMode) {
 const list = getBlocks(track);
 const block = list.find((b) => b.id === id);

 if (block && block.kind === "pivot") {
 const pairId = blockProps[id]?.pivotPairId;

 if (pairId) {
 const otherTrack: TrackKey = track === "left" ? "right" : "left";
 const otherList = getBlocks(otherTrack);
 const pairBlock = otherList.find(
 (b) => blockProps[b.id]?.pivotPairId === pairId
 );

 if (pairBlock) {
 setPairSelected({ track: otherTrack, id: pairBlock.id });
 }
 }
 }
 }
 };

 // Reordenamiento desde TimelineRow (Drag & Drop)
 const handleReorder = (track: TrackKey) => (newOrder: Block[]) => {
 if (track === "left") setBlocksLeft(newOrder);
 else if (track === "right") setBlocksRight(newOrder);
 else setBlocksDual(newOrder);
 };

 // === SELECCIÓN DE TIPO EN PALETA (no agrega ni selecciona timeline) ===
 const [paletteKind, setPaletteKind] = useState<BlockKind | null>(null);

 // === ALTAS/BAJAS ===
 const currentTrackForCreate: TrackKey =
 selection?.track ?? (dualMode ? "dual" : "left");

 const onAddBlock = () => {
 // agrega el tipo seleccionado en la paleta
 const k = paletteKind;
 if (!k) return; // no hay tipo seleccionado en la paleta
 // Caso especial: Pivot pareado en modo simple
 if (k === "pivot" && !dualMode) {
 createPairedPivot(); // crea par y selecciona el izquierdo
 return;
 }

 // En dual, pivot está oculto; si por alguna razón quedó, lo ignoramos
 if (dualMode && k === "pivot") return;

 const t = dualMode ? "dual" : currentTrackForCreate;
 const nb: Block = {
 id: uid(),
 kind: k,
 label: k ? k.charAt(0).toUpperCase() + k.slice(1) : "",
 durationMs: 500,
 direction: 0 as Dir,
 speed: k === "stop" ? undefined : 50,
 } as any;

 setBlocks(t)((prev) => [...prev, nb]);
 setBlockProps((prev) => ({ ...prev, [nb.id]: getDefaultPropsFor(nb) }));
 attemptSelect(t, nb.id);
 };

 // === Paleta: crear PIVOT pareado (simple mode) con dirección invertida ===
 const createPairedPivot = () => {
 if (selectionLocked) return;
 if (dualMode) return;

 const pairId = uid();
 const nbL: Block = {
 id: uid(),
 kind: "pivot",
 label: "Pivot",
 durationMs: 500,
 speed: 50,
 direction: 0 as Dir, // Izquierdo adelante
 } as any;
 const nbR: Block = {
 id: uid(),
 kind: "pivot",
 label: "Pivot",
 durationMs: 500,
 speed: 50,
 direction: 1 as Dir, // Derecho atrás (invertido)
 } as any;

 setBlocksLeft((prev) => [...prev, nbL]);
 setBlocksRight((prev) => [...prev, nbR]);

 setBlockProps((prev) => ({
 ...prev,
 [nbL.id]: {
 ...getDefaultPropsFor(nbL),
 pivotBaseDir: 0,
 pivotPairId: pairId,
 },
 [nbR.id]: {
 ...getDefaultPropsFor(nbR),
 pivotBaseDir: 1,
 pivotPairId: pairId,
 },
 }));

 attemptSelect("left", nbL.id);
 };

 const onRemoveSelected = () => {
 if (!selection) return;
 const { track, id } = selection;

 // Si es pivot y está pareado, también borramos el par
 thePivotPairCleanup: {
 const maybePairId = blockProps[id]?.pivotPairId;
 if (maybePairId && track !== "dual") {
 const otherTrack: TrackKey = track === "left" ? "right" : "left";
 setBlocks(otherTrack)((prev) =>
 prev.filter((b) => blockProps[b.id]?.pivotPairId !== maybePairId)
 );
 }
 }

 setBlocks(track)((prev) => prev.filter((b) => b.id !== id));
 setBlockProps((prev) => {
 const { [id]: _omit, ...rest } = prev;
 return rest;
 });
 setSelection(null);
 setPairSelected(null);
 };

 // === BLOQUE SELECCIONADO + IDS A RESALTAR (reactivo a pairSelected) ===
 const selected = selection
 ? getBlocks(selection.track).find((b) => b.id === selection.id) ?? null
 : null;

 const highlightLeft: string[] =
 pairSelected?.track === "left" ? [pairSelected.id] : [];
 const highlightRight: string[] =
 pairSelected?.track === "right" ? [pairSelected.id] : [];

 // ======= VISTA "LIVE" MIENTRAS EDITÁS =======
 // 1) Duración visible (ancho) del bloque seleccionado
 const visibleBlocksLeft = useMemo(
 () =>
 blocksLeft.map((b) =>
 selection?.track === "left" && selection.id === b.id
 ? ({ ...b, durationMs } as Block)
 : b
 ),
 [blocksLeft, selection?.track, selection?.id, durationMs]
 );
 const visibleBlocksRight = useMemo(
 () =>
 blocksRight.map((b) =>
 selection?.track === "right" && selection.id === b.id
 ? ({ ...b, durationMs } as Block)
 : b
 ),
 [blocksRight, selection?.track, selection?.id, durationMs]
 );
 const visibleBlocksDual = useMemo(
 () =>
 blocksDual.map((b) =>
 selection?.track === "dual" && selection.id === b.id
 ? ({ ...b, durationMs } as Block)
 : b
 ),
 [blocksDual, selection?.track, selection?.id, durationMs]
 );

 // 2) Totales visibles (para porcentajes de ancho)
 const totalMsLeft = useMemo(
 () =>
 visibleBlocksLeft.reduce((a, b) => a + Math.max(0, b.durationMs), 0) || 1,
 [visibleBlocksLeft]
 );
 const totalMsRight = useMemo(
 () =>
 visibleBlocksRight.reduce((a, b) => a + Math.max(0, b.durationMs), 0) ||
 1,
 [visibleBlocksRight]
 );
 const totalMsDual = useMemo(
 () =>
 visibleBlocksDual.reduce((a, b) => a + Math.max(0, b.durationMs), 0) || 1,
 [visibleBlocksDual]
 );

 // 3) Props mínimas por bloque para dibujar formas, con override en caliente del seleccionado
 const buildMinimalProps = (
 list: Block[],
 trackKey: TrackKey
 ): Record<string, MinimalBlockProps> => {
 const map: Record<string, MinimalBlockProps> = {};
 list.forEach((b) => {
 const saved = blockProps[b.id];
 map[b.id] = {
 fromPct: saved?.fromPct,
 toPct: saved?.toPct,
 speed: saved?.speed ?? (b as any).speed,
 };
 });
 if (selection && selection.track === trackKey) {
 map[selection.id] = {
 fromPct,
 toPct,
 speed,
 };
 }
 return map;
 };
 const blockPropsLeft = useMemo(
 () => buildMinimalProps(visibleBlocksLeft, "left"),
 [
 visibleBlocksLeft,
 selection?.id,
 selection?.track,
 fromPct,
 toPct,
 speed,
 blockProps,
 ]
 );
 const blockPropsRight = useMemo(
 () => buildMinimalProps(visibleBlocksRight, "right"),
 [
 visibleBlocksRight,
 selection?.id,
 selection?.track,
 fromPct,
 toPct,
 speed,
 blockProps,
 ]
 );
 const blockPropsDual = useMemo(
 () => buildMinimalProps(visibleBlocksDual, "dual"),
 [
 visibleBlocksDual,
 selection?.id,
 selection?.track,
 fromPct,
 toPct,
 speed,
 blockProps,
 ]
 );

 const isSimulating =
 isPlayingLeft || isPlayingRight || isPlayingDual;

 const validationIssues = useMemo<ValidationIssue[]>(() => {
 const tracks = dualMode
 ? [
 {
 track: "dual" as TrackKey,
 blocks: visibleBlocksDual,
 props: blockPropsDual,
 },
 ]
 : [
 {
 track: "left" as TrackKey,
 blocks: visibleBlocksLeft,
 props: blockPropsLeft,
 },
 {
 track: "right" as TrackKey,
 blocks: visibleBlocksRight,
 props: blockPropsRight,
 },
 ];

 return tracks.flatMap(({ track, blocks, props }) =>
 validateTrackSequence(track, blocks, props, dualMode),
 );
 }, [
 blockPropsDual,
 blockPropsLeft,
 blockPropsRight,
 dualMode,
 visibleBlocksDual,
 visibleBlocksLeft,
 visibleBlocksRight,
 ]);

 const validationErrorCount = validationIssues.filter(
 (issue) => issue.severity === "error",
 ).length;
 const validationWarningCount = validationIssues.filter(
 (issue) => issue.severity === "warning",
 ).length;
 const isSequenceValid = validationErrorCount === 0;

 const selectedHasUnsavedChanges = useMemo(() => {
 if (!selected) return false;
 const saved = blockProps[selected.id] ?? getDefaultPropsFor(selected);
 return (
 (selected.durationMs ?? 0) !== durationMs ||
 ((selected as any).speed ?? saved.speed ?? 0) !== speed ||
 ((selected as any).direction ?? 0) !== direction ||
 (saved.fromPct ?? 0) !== fromPct ||
 (saved.toPct ?? 0) !== toPct ||
 (saved.arcSide ?? 0) !== arcSide
 );
 }, [arcSide, blockProps, direction, durationMs, fromPct, selected, speed, toPct]);
 const selectedHasValidationError = selected
 ? validationIssues.some(
 (issue) =>
 issue.blockId === selected.id && issue.severity === "error",
 )
 : false;
 const selectedIssues = selected
 ? validationIssues.filter((issue) => issue.blockId === selected.id)
 : [];

 const physicalBlockedReason = !connected
 ? "STM32/ESP no conectado"
 : !isTestMode
 ? "Requiere modo TEST"
 : !PHYSICAL_EXECUTION_CAPABILITY
 ? "Comando/capability de motores no implementado"
 : "Listo";
 const safetyArmed =
 connected && isTestMode && PHYSICAL_EXECUTION_CAPABILITY;

 useEffect(() => {
 simulationRuntimeRef.current = {
 dualMode,
 blocksLeft: visibleBlocksLeft,
 blocksRight: visibleBlocksRight,
 blocksDual: visibleBlocksDual,
 blockPropsLeft,
 blockPropsRight,
 blockPropsDual,
 activeIndexLeft,
 activeIndexRight,
 activeIndexDual,
 activeProgressLeft,
 activeProgressRight,
 activeProgressDual,
 };
 }, [
 activeIndexDual,
 activeIndexLeft,
 activeIndexRight,
 activeProgressDual,
 activeProgressLeft,
 activeProgressRight,
 blockPropsDual,
 blockPropsLeft,
 blockPropsRight,
 dualMode,
 visibleBlocksDual,
 visibleBlocksLeft,
 visibleBlocksRight,
 ]);

 useEffect(() => {
 if (!isSimulating) return;

 let last = performance.now();
 const interval = window.setInterval(() => {
 const now = performance.now();
 const dt = Math.max(0.016, Math.min(0.12, (now - last) / 1000));
 last = now;

 const runtime = simulationRuntimeRef.current;
 const { leftPct, rightPct } = runtime.dualMode
 ? (() => {
 const speedPct = runtimeMotorPct(
 runtime.blocksDual,
 runtime.blockPropsDual,
 runtime.activeIndexDual,
 runtime.activeProgressDual,
 );
 return { leftPct: speedPct, rightPct: speedPct };
 })()
 : {
 leftPct: runtimeMotorPct(
 runtime.blocksLeft,
 runtime.blockPropsLeft,
 runtime.activeIndexLeft,
 runtime.activeProgressLeft,
 ),
 rightPct: runtimeMotorPct(
 runtime.blocksRight,
 runtime.blockPropsRight,
 runtime.activeIndexRight,
 runtime.activeProgressRight,
 ),
 };

 setSimPose((pose) => integrateSimulationPose(pose, leftPct, rightPct, dt));
 }, TICK_MS);

 return () => {
 window.clearInterval(interval);
 };
 }, [isSimulating]);

 const resetSimulationPose = () => {
 setSimPose(createInitialSimPose());
 };

 const changeSelectedDirection = (newDirection: Dir) => {
 setDirection(newDirection);

 if (
 selected &&
 selected.kind === "pivot" &&
 selection?.track !== "dual"
 ) {
 const pairId = blockProps[selected.id]?.pivotPairId;
 if (pairId) {
 const otherTrack: TrackKey =
 selection && selection.track === "left" ? "right" : "left";
 const invertedDirection = (newDirection === 0 ? 1 : 0) as Dir;

 setBlocks(otherTrack)((prev) =>
 prev.map((b) => {
 const p = blockProps[b.id];
 if (p?.pivotPairId === pairId && b.id !== selected.id) {
 return {
 ...(b as any),
 direction: invertedDirection,
 } as any;
 }
 return b;
 }),
 );
 }
 }
 };

 const runValidation = () => {
 setValidationRan(true);
 setLastLocalEvent(
 isSequenceValid
 ? "Validación local OK"
 : `Validación local con ${validationErrorCount} error(es)`,
 );
 return isSequenceValid;
 };

 const stopLocalSimulation = () => {
 stopAllTracks();
 setLastLocalEvent("Simulacion local detenida");
 };

 const resetLocalSimulation = () => {
 stopAllTracks();
 resetSimulationPose();
 setLastLocalEvent("Simulacion reiniciada a origen");
 };

 const startSimulationRun = (scope: "left" | "right" | "both") => {
 if (!runValidation()) return;

 stopAllTracks();
 resetSimulationPose();

 if (scope === "left") {
 if (!dualMode) startTrack("left");
 return;
 }

 if (scope === "right") {
 if (!dualMode) startTrack("right");
 return;
 }

 if (dualMode) {
 startTrack("dual");
 } else {
 startTrack("left");
 startTrack("right");
 }
 };

 const duplicateSelected = () => {
 if (!selection || !selected || selectionLocked) return;

 const clone: Block = {
 ...(selected as any),
 id: uid(),
 label: `${selected.label} copia`,
 } as Block;
 const props = {
 ...(blockProps[selected.id] ?? getDefaultPropsFor(selected)),
 pivotPairId: undefined,
 };

 setBlocks(selection.track)((prev) => {
 const index = prev.findIndex((b) => b.id === selected.id);
 if (index < 0) return [...prev, clone];
 return [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)];
 });
 setBlockProps((prev) => ({ ...prev, [clone.id]: props }));
 setSelection({ track: selection.track, id: clone.id });
 setLastLocalEvent("Bloque duplicado localmente");
 };

 const saveSelectedBlock = () => {
 if (!selection || !selected) return;
 const t = selection.track;
 const id = selection.id;

 setBlockProps((prev) => {
 const prevProps = prev[id] ?? getDefaultPropsFor(selected);
 const nextMap: Record<string, BlockProps> = {
 ...prev,
 [id]: {
 ...prevProps,
 durationMs,
 speed,
 fromPct,
 toPct,
 arcSide,
 pivotBaseDir,
 },
 };

 if (
 selected.kind === "pivot" &&
 t !== "dual" &&
 prevProps.pivotPairId
 ) {
 const pairId = prevProps.pivotPairId;
 const peerEntry = Object.entries(prev).find(
 ([key, val]) => key !== id && val.pivotPairId === pairId,
 );
 if (peerEntry) {
 const [peerId] = peerEntry;
 nextMap[peerId] = {
 ...(prev[peerId] ?? getDefaultPropsFor(selected)),
 durationMs,
 speed,
 pivotPairId: pairId,
 };
 }
 }
 return nextMap;
 });

 setBlocks(t)((prev) =>
 prev.map((b) =>
 b.id === id
 ? ({ ...(b as any), durationMs, speed, direction } as any)
 : b,
 ),
 );

 if (selected.kind === "pivot" && t !== "dual") {
 const pairId = blockProps[id]?.pivotPairId;
 if (pairId) {
 const otherTrack: TrackKey = t === "left" ? "right" : "left";
 setBlocks(otherTrack)((prev) =>
 prev.map((b) => {
 const p = blockProps[b.id];
 if (p?.pivotPairId === pairId && b.id !== id) {
 return {
 ...(b as any),
 durationMs,
 speed,
 direction: (direction === 0 ? 1 : 0) as Dir,
 } as any;
 }
 return b;
 }),
 );
 }
 }

 setLastLocalEvent("Bloque guardado localmente");
 };

 const updateBlockLabelAdvanced = useCallback(
 (blockId: string, newLabel: string) => {
 const trimmedLabel = newLabel.trim();
 if (!trimmedLabel) return;

 console.log(`Updating block ${blockId} label to: ${trimmedLabel}`);

 // Buscar en qué track está el bloque
 const leftBlockIndex = blocksLeft.findIndex((b) => b.id === blockId);
 const rightBlockIndex = blocksRight.findIndex((b) => b.id === blockId);
 const dualBlockIndex = blocksDual.findIndex((b) => b.id === blockId);

 // Función auxiliar para actualizar etiqueta
 const updateInTrack = (
 setter: React.Dispatch<React.SetStateAction<Block[]>>,
 blockIndex: number
 ) => {
 setter((prevBlocks) =>
 prevBlocks.map((block, index) =>
 index === blockIndex ? { ...block, label: trimmedLabel } : block
 )
 );
 };

 if (leftBlockIndex !== -1) {
 updateInTrack(setBlocksLeft, leftBlockIndex);

 // Si es un pivot pareado, también actualizar el par en el otro track
 const block = blocksLeft[leftBlockIndex];
 if (block.kind === "pivot" && !dualMode) {
 const pairId = blockProps[blockId]?.pivotPairId;
 if (pairId) {
 const rightPairIndex = blocksRight.findIndex(
 (b) => blockProps[b.id]?.pivotPairId === pairId
 );
 if (rightPairIndex !== -1) {
 updateInTrack(setBlocksRight, rightPairIndex);
 }
 }
 }
 } else if (rightBlockIndex !== -1) {
 updateInTrack(setBlocksRight, rightBlockIndex);

 // Si es un pivot pareado, también actualizar el par en el otro track
 const block = blocksRight[rightBlockIndex];
 if (block.kind === "pivot" && !dualMode) {
 const pairId = blockProps[blockId]?.pivotPairId;
 if (pairId) {
 const leftPairIndex = blocksLeft.findIndex(
 (b) => blockProps[b.id]?.pivotPairId === pairId
 );
 if (leftPairIndex !== -1) {
 updateInTrack(setBlocksLeft, leftPairIndex);
 }
 }
 }
 } else if (dualBlockIndex !== -1) {
 updateInTrack(setBlocksDual, dualBlockIndex);
 } else {
 console.warn(`Block with id ${blockId} not found in any track`);
 }
 },
 [blocksLeft, blocksRight, blocksDual, blockProps, dualMode]
 );

 const switchDualMode = useCallback(
 (nextDualMode: boolean) => {
 if (nextDualMode === dualMode) return;
 (["left", "right", "dual"] as TrackKey[]).forEach((t) => stopTrack(t));
 setPairSelected(null);
 setDualMode(nextDualMode);
 setPaletteKind("hold");
 },
 [dualMode]
 );

 // === UI ===
 return (
 <section
 className="control-dashboard-shell min-h-screen w-full overflow-x-hidden bg-[var(--ui-bg-0)] p-4 sm:p-6 text-[var(--ui-text)] selection:bg-cyan-500/30"
 >
 <div className="control-dashboard-frame mx-auto flex w-full max-w-[2400px] flex-col gap-4 sm:gap-6">
 <PageHeader
 className="app-page-header home-page-header control-page-header"
 titleOverride="Control de Motores"
 leadingSlot={<ControlBrandGlyph />}
 setOpenSettingsModal={setOpenSettingsModal}
 setOpenInfoModal={setOpenInfoModal}
 />

 <ControlHeaderStatus
 connected={connected}
 carMode={connected ? carMode : "--"}
 modeLabel="SIM"
 safetyArmed={safetyArmed}
 ackLabel="--"
 />

 <ExecutionStatusPanel
 compact
 connected={connected}
 carMode={connected ? carMode : "--"}
 carModeStatus={carModeStatus}
 safetyArmed={safetyArmed}
 physicalBlockedReason={physicalBlockedReason}
 isSimulating={isSimulating}
 lastLocalEvent={lastLocalEvent}
 validationRan={validationRan}
 validationErrorCount={validationErrorCount}
 validationWarningCount={validationWarningCount}
 />

 <section className="grid gap-5">
 <div className="flex min-w-0 flex-col gap-3">
 <MotionSimulationPanel
 variant="large"
 pose={simPose}
 isSimulating={isSimulating}
 dualMode={dualMode}
 totalMs={dualMode ? totalMsDual : Math.max(totalMsLeft, totalMsRight)}
 />

 <SimulationTransportControls
 dualMode={dualMode}
 isSimulating={isSimulating}
 isPlayingLeft={isPlayingLeft}
 isPlayingRight={isPlayingRight}
 isPlayingDual={isPlayingDual}
 canRunLeft={blocksLeft.length > 0}
 canRunRight={blocksRight.length > 0}
 canRunBoth={dualMode ? blocksDual.length > 0 : blocksLeft.length > 0 && blocksRight.length > 0}
 physicalEnabled={safetyArmed}
 physicalBlockedReason={physicalBlockedReason}
 onStop={stopLocalSimulation}
 onRunLeft={() => startSimulationRun("left")}
 onRunRight={() => startSimulationRun("right")}
 onRunBoth={() => startSimulationRun("both")}
 onReset={resetLocalSimulation}
 onExecutePhysical={() => {
 console.log("[motor-control] Ejecutar en STM32 pendiente de protocolo físico.");
 }}
 />
 </div>
 </section>

 <div className={`app-panel-strong relative overflow-hidden px-5 pb-5 pt-14 md:px-7 ${sectionToneClass("cyan")}`}>
 <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.08)_1px,transparent_1px)] [background-size:34px_34px]" />
 <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
 <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-cyan-300/20 bg-[var(--ui-bg-0)]/90 p-1 shadow-[0_24px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
 <button
 type="button"
 className={SEGMENTED_BUTTON_CLASS}
 style={sectionSegmentedButtonStyle(!dualMode, "cyan")}
 onClick={() => switchDualMode(false)}
 >
 Modo simple
 </button>
 <button
 type="button"
 className={SEGMENTED_BUTTON_CLASS}
 style={sectionSegmentedButtonStyle(dualMode, "emerald")}
 onClick={() => switchDualMode(true)}
 >
 Modo dual
 </button>
 </div>
 </div>

 <div className="relative">
 <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
 <div className="flex flex-col gap-2">
 <h2 className="text-2xl font-black text-[var(--ui-text)] md:text-3xl">
 Secuencias de motor
 </h2>
 <p className="max-w-3xl text-sm text-[var(--ui-muted)]">
 Los bloques se agregan desde la paleta y se insertan en la pista seleccionada. La simulacion fisica queda separada del simulador local.
 </p>
 </div>

 <div className="flex flex-wrap items-center gap-2">
 <StatusPill label="Modo" value={dualMode ? "Dual" : "Simple"} tone={dualMode ? "emerald" : "cyan"} />
 <StatusPill label="Destino" value={selection ? trackLabel(selection.track) : dualMode ? "ambos motores" : "motor izquierdo"} tone="muted" />
 <StatusPill label="Bloques" value={String(dualMode ? visibleBlocksDual.length : visibleBlocksLeft.length + visibleBlocksRight.length)} tone="cyan" />
 </div>
 </div>

 <BlockPalettePanel
 selection={selection}
 dualMode={dualMode}
 paletteKind={paletteKind}
 pairSelected={pairSelected}
 selectionLocked={selectionLocked}
 onAddBlock={onAddBlock}
 onSelectKind={(kind) => {
 if (selectionLocked) return;
 setPaletteKind((current) => (current === kind ? null : kind));
 }}
 />

 <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
 <div className="flex min-w-0 flex-col gap-4">
 {dualMode ? (
 <TimelineRow
 title="Ambos motores"
 track="dual"
 blocks={visibleBlocksDual}
 totalMs={totalMsDual}
 kindColor={kindColor}
 activeIndex={activeIndexDual}
 activeProgress={activeProgressDual}
 selectedId={selection?.track === "dual" ? selection.id : null}
 onSelect={(id) => {
 if (selectionLocked) return;
 if (id) attemptSelect("dual", id);
 else attemptSelect("dual", null);
 }}
 blockProps={blockPropsDual}
 onReorder={handleReorder("dual")}
 dndDisabled={isPlayingDual}
 onUpdateLabel={(blockId, newLabel) => {
 updateBlockLabelAdvanced(blockId, newLabel);
 }}
 />
 ) : (
 <>
 <TimelineRow
 title="Motor izquierdo"
 track="left"
 blocks={visibleBlocksLeft}
 totalMs={totalMsLeft}
 kindColor={kindColor}
 activeIndex={activeIndexLeft}
 activeProgress={activeProgressLeft}
 selectedId={selection?.track === "left" ? selection.id : null}
 onSelect={(id) => {
 if (selectionLocked) return;
 if (id) attemptSelect("left", id);
 else attemptSelect("left", null);
 }}
 highlightIds={highlightLeft}
 blockProps={blockPropsLeft}
 onReorder={handleReorder("left")}
 dndDisabled={isPlayingLeft}
 onUpdateLabel={(blockId, newLabel) => {
 updateBlockLabelAdvanced(blockId, newLabel);
 }}
 />

 <TimelineRow
 title="Motor derecho"
 track="right"
 blocks={visibleBlocksRight}
 totalMs={totalMsRight}
 kindColor={kindColor}
 activeIndex={activeIndexRight}
 activeProgress={activeProgressRight}
 selectedId={selection?.track === "right" ? selection.id : null}
 onSelect={(id) => {
 if (selectionLocked) return;
 if (id) attemptSelect("right", id);
 else attemptSelect("right", null);
 }}
 highlightIds={highlightRight}
 blockProps={blockPropsRight}
 onReorder={handleReorder("right")}
 dndDisabled={isPlayingRight}
 onUpdateLabel={(blockId, newLabel) => {
 updateBlockLabelAdvanced(blockId, newLabel);
 }}
 />
 </>
 )}
 </div>

 <BlockPropertiesPanel
 selected={selected}
 selection={selection}
 durationMs={durationMs}
 setDurationMs={setDurationMs}
 speed={speed}
 setSpeed={setSpeed}
 direction={direction}
 onDirectionChange={changeSelectedDirection}
 fromPct={fromPct}
 setFromPct={setFromPct}
 toPct={toPct}
 setToPct={setToPct}
 arcSide={arcSide}
 setArcSide={setArcSide}
 selectedHasValidationError={selectedHasValidationError}
 selectedHasUnsavedChanges={selectedHasUnsavedChanges}
 selectedIssues={selectedIssues}
 selectionLocked={selectionLocked}
 onSave={saveSelectedBlock}
 onDuplicate={duplicateSelected}
 onDelete={onRemoveSelected}
 />
 </div>
 </div>
 </div>

 {/* Motion Sequence Studio: disposición similar a la referencia */}
 <div className="hidden">
 <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
 <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-cyan-300/20 bg-[var(--ui-bg-0)]/90 p-1 shadow-[0_24px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
 <button
 type="button"
 className={SEGMENTED_BUTTON_CLASS}
 style={sectionSegmentedButtonStyle(!dualMode, "cyan")}
 onClick={() => switchDualMode(false)}
 >
 Modo simple
 </button>
 <button
 type="button"
 className={SEGMENTED_BUTTON_CLASS}
 style={sectionSegmentedButtonStyle(dualMode, "emerald")}
 onClick={() => switchDualMode(true)}
 >
 Modo dual
 </button>
 </div>
 </div>

 <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
 <div className={`app-panel-strong relative overflow-hidden px-5 pb-5 pt-14 md:px-7 ${sectionToneClass("cyan")}`}>
 <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.08)_1px,transparent_1px)] [background-size:34px_34px]" />
 <div className="relative">
 <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
 <div className="flex flex-col gap-2">
 <h2 className="text-2xl font-black text-[var(--ui-text)] md:text-3xl">
 Secuencias de motor
 </h2>
 <p className="max-w-3xl text-sm text-[var(--ui-muted)]">
 Diseña, ordena y simula bloques temporales de movimiento. La ejecución física requiere validación, carga a STM32, modo TEST activo y comandos de motor disponibles en firmware/protocolo.
 </p>
 </div>

 <div className="flex flex-wrap items-center gap-2">
 <StatusPill label="Modo" value="Simulación local" tone="cyan" />
 <StatusPill label="Studio" value="Motion Sequence" tone="muted" />
 <StatusPill
 label={dualMode ? "Dual" : "Simple"}
 value={dualMode ? "Colección separada" : "Tracks independientes"}
 tone={dualMode ? "emerald" : "cyan"}
 />
 </div>
 </div>

 <div className="mt-5 flex flex-col gap-4">
 {dualMode ? (
 <div className="flex flex-col gap-2">
 <TimelineRow
 title="Ambos motores"
 track="dual"
 blocks={visibleBlocksDual}
 totalMs={totalMsDual}
 kindColor={kindColor}
 activeIndex={activeIndexDual}
 activeProgress={activeProgressDual}
 selectedId={selection?.track === "dual" ? selection.id : null}
 onSelect={(id) => {
 if (selectionLocked) return;
 if (id) attemptSelect("dual", id);
 else attemptSelect("dual", null);
 }}
 blockProps={blockPropsDual}
 onReorder={handleReorder("dual")}
 dndDisabled={isPlayingDual}
 onUpdateLabel={(blockId, newLabel) => {
 updateBlockLabelAdvanced(blockId, newLabel);
 }}
 />
 <TrackSimButton
 isPlaying={isPlayingDual}
 disabled={blocksDual.length === 0}
 onClick={() =>
 isPlayingDual ? stopTrack("dual") : startTrack("dual")
 }
 />
 </div>
 ) : (
 <>
 <div className="flex flex-col gap-2">
 <TimelineRow
 title="Motor izquierdo"
 track="left"
 blocks={visibleBlocksLeft}
 totalMs={totalMsLeft}
 kindColor={kindColor}
 activeIndex={activeIndexLeft}
 activeProgress={activeProgressLeft}
 selectedId={selection?.track === "left" ? selection.id : null}
 onSelect={(id) => {
 if (selectionLocked) return;
 if (id) attemptSelect("left", id);
 else attemptSelect("left", null);
 }}
 highlightIds={highlightLeft}
 blockProps={blockPropsLeft}
 onReorder={handleReorder("left")}
 dndDisabled={isPlayingLeft}
 onUpdateLabel={(blockId, newLabel) => {
 updateBlockLabelAdvanced(blockId, newLabel);
 }}
 />
 <TrackSimButton
 isPlaying={isPlayingLeft}
 disabled={blocksLeft.length === 0}
 onClick={() =>
 isPlayingLeft ? stopTrack("left") : startTrack("left")
 }
 />
 </div>

 <div className="flex flex-col gap-2">
 <TimelineRow
 title="Motor derecho"
 track="right"
 blocks={visibleBlocksRight}
 totalMs={totalMsRight}
 kindColor={kindColor}
 activeIndex={activeIndexRight}
 activeProgress={activeProgressRight}
 selectedId={selection?.track === "right" ? selection.id : null}
 onSelect={(id) => {
 if (selectionLocked) return;
 if (id) attemptSelect("right", id);
 else attemptSelect("right", null);
 }}
 highlightIds={highlightRight}
 blockProps={blockPropsRight}
 onReorder={handleReorder("right")}
 dndDisabled={isPlayingRight}
 onUpdateLabel={(blockId, newLabel) => {
 updateBlockLabelAdvanced(blockId, newLabel);
 }}
 />
 <TrackSimButton
 isPlaying={isPlayingRight}
 disabled={blocksRight.length === 0}
 onClick={() =>
 isPlayingRight ? stopTrack("right") : startTrack("right")
 }
 />
 </div>
 </>
 )}
 </div>

 <MotionSimulationPanel
 pose={simPose}
 isSimulating={isSimulating}
 dualMode={dualMode}
 totalMs={dualMode ? totalMsDual : Math.max(totalMsLeft, totalMsRight)}
 />

 <BlockPalettePanel
 selection={selection}
 dualMode={dualMode}
 paletteKind={paletteKind}
 pairSelected={pairSelected}
 selectionLocked={selectionLocked}
 onAddBlock={onAddBlock}
 onSelectKind={(kind) => {
 if (selectionLocked) return;
 setPaletteKind((current) => (current === kind ? null : kind));
 }}
 />
 </div>
 </div>

 <aside className="flex flex-col gap-4">
 <BlockPropertiesPanel
 selected={selected}
 selection={selection}
 durationMs={durationMs}
 setDurationMs={setDurationMs}
 speed={speed}
 setSpeed={setSpeed}
 direction={direction}
 onDirectionChange={changeSelectedDirection}
 fromPct={fromPct}
 setFromPct={setFromPct}
 toPct={toPct}
 setToPct={setToPct}
 arcSide={arcSide}
 setArcSide={setArcSide}
 selectedHasValidationError={selectedHasValidationError}
 selectedHasUnsavedChanges={selectedHasUnsavedChanges}
 selectedIssues={selectedIssues}
 selectionLocked={selectionLocked}
 onSave={saveSelectedBlock}
 onDuplicate={duplicateSelected}
 onDelete={onRemoveSelected}
 />

 <ExecutionStatusPanel
 connected={connected}
 carMode={connected ? carMode : "--"}
 carModeStatus={carModeStatus}
 safetyArmed={safetyArmed}
 physicalBlockedReason={physicalBlockedReason}
 isSimulating={isSimulating}
 lastLocalEvent={lastLocalEvent}
 validationRan={validationRan}
 validationErrorCount={validationErrorCount}
 validationWarningCount={validationWarningCount}
 />
 </aside>
 </div>

 </div>

 {/* Timeline + controles legacy, oculto por el rediseño principal */}
 <div className="hidden">
 <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
 <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-cyan-300/20 bg-[var(--ui-bg-0)]/85 p-1 shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl">
 <button
 type="button"
 className={SEGMENTED_BUTTON_CLASS}
 style={sectionSegmentedButtonStyle(!dualMode, "cyan")}
 onClick={() => switchDualMode(false)}
 >
 Modo simple
 </button>
 <button
 type="button"
 className={SEGMENTED_BUTTON_CLASS}
 style={sectionSegmentedButtonStyle(dualMode, "emerald")}
 onClick={() => switchDualMode(true)}
 >
 Modo dual
 </button>
 </div>
 </div>

 <div className={`app-panel-strong relative overflow-hidden px-5 pb-6 pt-14 md:px-7 ${sectionToneClass("cyan")}`}>
 <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
 <div className="flex flex-col gap-2">
 <h2 className="text-2xl font-black text-[var(--ui-text)] md:text-3xl">
 Secuencias de motor
 </h2>
 <p className="max-w-3xl text-sm text-[var(--ui-muted)]">
 Diseña, ordena y simula bloques temporales de movimiento. La ejecución física requiere validación, carga a STM32, modo TEST activo y comandos de motor disponibles en firmware/protocolo.
 </p>
 </div>

 <div className="flex flex-wrap items-center gap-2">
 <StatusPill label="Modo" value="Simulación local" tone="cyan" />
 <StatusPill
 label="Studio"
 value="Motion Sequence"
 tone="muted"
 />
 <StatusPill
 label={dualMode ? "Dual" : "Simple"}
 value={
 dualMode
 ? "Colección separada"
 : "Tracks independientes"
 }
 tone={dualMode ? "emerald" : "cyan"}
 />
 </div>
 </div>

 <div className="my-8 flex flex-col gap-10">
 {dualMode ? (
 <>
 <TimelineRow
 title="Ambos motores"
 track="dual"
 blocks={visibleBlocksDual}
 totalMs={totalMsDual}
 kindColor={kindColor}
 activeIndex={activeIndexDual}
 activeProgress={activeProgressDual}
 selectedId={selection?.track === "dual" ? selection.id : null}
 onSelect={(id) => {
 if (selectionLocked) return;
 if (id) attemptSelect("dual", id);
 else attemptSelect("dual", null);
 }}
 blockProps={blockPropsDual}
 onReorder={handleReorder("dual")}
 dndDisabled={isPlayingDual}
 onUpdateLabel={(blockId, newLabel) => {
 updateBlockLabelAdvanced(blockId, newLabel);
 }}
 />
 <div className="flex justify-end -mt-1">
 <button
 onClick={() =>
 isPlayingDual ? stopTrack("dual") : startTrack("dual")
 }
 disabled={blocksDual.length === 0}
 className={actionButtonClass(isPlayingDual ? "rose" : "emerald", isPlayingDual)}
 title={
 isPlayingDual ? "Detener simulación (Ambos)" : "Simular (Ambos)"
 }
 >
 {isPlayingDual ? (
 <>
 <svg
 xmlns="http://www.w3.org/2000/svg"
 viewBox="0 0 24 24"
 fill="currentColor"
 className="size-5"
 >
 <path
 fillRule="evenodd"
 d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
 clipRule="evenodd"
 />
 </svg>
 Detener
 </>
 ) : (
 <>
 <svg
 xmlns="http://www.w3.org/2000/svg"
 className="size-5"
 viewBox="0 0 24 24"
 fill="currentColor"
 >
 <path d="M5.25 4.5a.75.75 0 0 1 1.125-.65l12 7.5a.75.75 0 0 1 0 1.3l-12 7.5A.75.75 0 0 1 4.5 19.5v-15a.75.75 0 0 1 .75-.75Z" />
 </svg>
 Simular
 </>
 )}
 </button>
 </div>
 </>
 ) : (
 <>
 <div className="flex flex-col gap-2">
 <TimelineRow
 title="Motor izquierdo"
 track="left"
 blocks={visibleBlocksLeft}
 totalMs={totalMsLeft}
 kindColor={kindColor}
 activeIndex={activeIndexLeft}
 activeProgress={activeProgressLeft}
 selectedId={selection?.track === "left" ? selection.id : null}
 onSelect={(id) => {
 if (selectionLocked) return;
 if (id) attemptSelect("left", id);
 else attemptSelect("left", null);
 }}
 highlightIds={highlightLeft}
 blockProps={blockPropsLeft}
 onReorder={handleReorder("left")}
 dndDisabled={isPlayingLeft}
 onUpdateLabel={(blockId, newLabel) => {
 updateBlockLabelAdvanced(blockId, newLabel);
 }}
 />
 <div className="flex justify-center lg:justify-end">
 <button
 onClick={() =>
 isPlayingLeft ? stopTrack("left") : startTrack("left")
 }
 disabled={blocksLeft.length === 0}
 className={actionButtonClass(isPlayingLeft ? "rose" : "emerald", isPlayingLeft)}
 title={
 isPlayingLeft
 ? "Detener (Izquierdo)"
 : "Simular (Izquierdo)"
 }
 >
 {isPlayingLeft ? (
 <>
 <svg
 xmlns="http://www.w3.org/2000/svg"
 viewBox="0 0 24 24"
 fill="currentColor"
 className="size-5"
 >
 <path
 fillRule="evenodd"
 d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
 clipRule="evenodd"
 />
 </svg>
 Detener
 </>
 ) : (
 <>
 <svg
 xmlns="http://www.w3.org/2000/svg"
 className="size-5"
 viewBox="0 0 24 24"
 fill="currentColor"
 >
 <path d="M5.25 4.5a.75.75 0 0 1 1.125-.65l12 7.5a.75.75 0 0 1 0 1.3l-12 7.5A.75.75 0 0 1 4.5 19.5v-15a.75.75 0 0 1 .75-.75Z" />
 </svg>
 Simular
 </>
 )}
 </button>
 </div>
 </div>

 <div className="flex flex-col gap-2">
 <TimelineRow
 title="Motor derecho"
 track="right"
 blocks={visibleBlocksRight}
 totalMs={totalMsRight}
 kindColor={kindColor}
 activeIndex={activeIndexRight}
 activeProgress={activeProgressRight}
 selectedId={
 selection?.track === "right" ? selection.id : null
 }
 onSelect={(id) => {
 if (selectionLocked) return;
 if (id) attemptSelect("right", id);
 else attemptSelect("right", null);
 }}
 highlightIds={highlightRight}
 blockProps={blockPropsRight}
 onReorder={handleReorder("right")}
 dndDisabled={isPlayingRight}
 onUpdateLabel={(blockId, newLabel) => {
 updateBlockLabelAdvanced(blockId, newLabel);
 }}
 />
 <div className="flex justify-center lg:justify-end">
 <button
 onClick={() =>
 isPlayingRight ? stopTrack("right") : startTrack("right")
 }
 disabled={blocksRight.length === 0}
 className={actionButtonClass(isPlayingRight ? "rose" : "emerald", isPlayingRight)}
 title={
 isPlayingRight
 ? "Detener (Derecho)"
 : "Simular (Derecho)"
 }
 >
 {isPlayingRight ? (
 <>
 <svg
 xmlns="http://www.w3.org/2000/svg"
 viewBox="0 0 24 24"
 fill="currentColor"
 className="size-5"
 >
 <path
 fillRule="evenodd"
 d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
 clipRule="evenodd"
 />
 </svg>
 Detener
 </>
 ) : (
 <>
 <svg
 xmlns="http://www.w3.org/2000/svg"
 className="size-5"
 viewBox="0 0 24 24"
 fill="currentColor"
 >
 <path d="M5.25 4.5a.75.75 0 0 1 1.125-.65l12 7.5a.75.75 0 0 1 0 1.3l-12 7.5A.75.75 0 0 1 4.5 19.5v-15a.75.75 0 0 1 .75-.75Z" />
 </svg>
 Simular
 </>
 )}
 </button>
 </div>
 </div>
 </>
 )}
 </div>
 </div>
 </div>

 <div className="hidden">
 <MotionSimulationPanel
 pose={simPose}
 isSimulating={isSimulating}
 dualMode={dualMode}
 totalMs={dualMode ? totalMsDual : Math.max(totalMsLeft, totalMsRight)}
 />

 <ExecutionStatusPanel
 connected={connected}
 carMode={connected ? carMode : "--"}
 carModeStatus={carModeStatus}
 safetyArmed={safetyArmed}
 physicalBlockedReason={physicalBlockedReason}
 isSimulating={isSimulating}
 lastLocalEvent={lastLocalEvent}
 validationRan={validationRan}
 validationErrorCount={validationErrorCount}
 validationWarningCount={validationWarningCount}
 />
 </div>

 {/* Selector + Propiedades */}
 <div className="hidden">
 {/* Selector */}
 <div className={`order-last flex-1 p-4 lg:p-6 lg:order-first ${sectionCardClass("emerald")}`}>
 <div className="mb-4 flex items-center justify-between gap-3">
 <div>
 <div className="text-xl font-bold uppercase text-[var(--ui-text)]">
 Paleta de bloques
 {selection
 ? selection.track === "dual"
 ? " (Dual)"
 : selection.track === "left"
 ? " (Izquierdo)"
 : " (Derecho)"
 : dualMode
 ? " (Dual)"
 : ""}
 </div>
 <p className="mt-1 text-sm text-[var(--ui-muted)]">
 Elegí el tipo y agregalo a la línea de tiempo actual.
 </p>
 </div>
 <div className="flex items-center gap-3">
 <button
 onClick={onAddBlock}
 className={actionButtonClass("emerald", Boolean(paletteKind))}
 title="Agregar bloque"
 >
 <svg
 xmlns="http://www.w3.org/2000/svg"
 className="size-5"
 viewBox="0 0 24 24"
 fill="currentColor"
 >
 <path
 fillRule="evenodd"
 d="M12 2.25a9.75 9.75 0 1 0 9.75 9.75A9.76 9.76 0 0 0 12 2.25Zm.75 6.75a.75.75 0 1 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25Z"
 clipRule="evenodd"
 />
 </svg>
 Agregar
 </button>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
 {(["ramp", "hold", "pivot", "arc", "stop"] as BlockKind[]).map(
 (k) => {
 const disabled = dualMode && k === "pivot";
 return (
 <div
 key={k}
 title={
 disabled
 ? "Pivote no disponible en modo dual"
 : labelES[k]
 }
 >
 <MotorBlock
 kind={k}
 selected={!disabled && paletteKind === k}
 disabled={disabled}
 pairSelected={
 Boolean(pairSelected) &&
 k === "pivot" &&
 selection?.track !== "dual"
 }
 onClick={() => {
 if (selectionLocked || disabled) return;
 if (k === paletteKind) {
 setPaletteKind(null);
 } else {
 setPaletteKind(k);
 }
 }}
 />
 </div>
 );
 },
 )}
 </div>
 </div>

 {/* Propiedades */}
 <div
 className={`w-full p-4 sm:p-6 ${sectionCardClass(selected ? toneFromKind(selected.kind) : "indigo")} ${
 !selected && "hidden lg:block"
 } ${!selection && "opacity-60"}`}
 >
 <div className="mb-4 flex items-start justify-between gap-3">
 <div>
 <div className="text-xl font-bold uppercase text-[var(--ui-text)]">
 Propiedades del bloque
 </div>
 <p className="mt-1 text-sm text-[var(--ui-muted)]">
 Ajustes finos para el bloque seleccionado.
 </p>
 </div>
 {selected ? (
 <div className="flex flex-col items-end gap-2">
 <span className={kindBadgeClass(selected.kind)}>
 {labelES[selected.kind]}
 </span>
 <span
 className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
 selectedHasValidationError
 ? "border-rose-300/40 bg-rose-500/15 text-rose-100"
 : selectedHasUnsavedChanges
 ? "border-amber-300/40 bg-amber-500/15 text-amber-100"
 : "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
 }`}
 >
 {selectedHasValidationError
 ? "Bloque inválido"
 : selectedHasUnsavedChanges
 ? "Cambios sin guardar"
 : "Bloque válido"}
 </span>
 </div>
 ) : null}
 </div>

 <div className="mb-2 text-sm text-[var(--ui-muted)]">
 Tipo:{" "}
 <span className="font-semibold text-[var(--ui-text)]">
 {selected ? labelES[selected.kind] : "—"}
 </span>
 </div>

 <div className="mb-4">
 <span className="mr-2 text-sm text-[var(--ui-muted)]">Track:</span>
 <span className="inline-flex items-center rounded-full border border-[var(--ui-ring)] bg-[var(--ui-panel)] px-2.5 py-1 text-xs font-semibold text-[var(--ui-text)]">
 {selection
 ? selection.track === "left"
 ? "Izquierdo"
 : selection.track === "right"
 ? "Derecho"
 : "Ambos"
 : "—"}
 </span>
 </div>

 {/* Duración */}
 <div className="mb-3">
 <label className="mb-1 block text-sm text-[var(--ui-muted)]">
 Duración (ms)
 </label>
 <input
 type="number"
 min={0}
 className="app-input w-full px-3 py-2.5 text-sm"
 value={selection ? durationMs : 0}
 onChange={(e) => setDurationMs(Number(e.target.value))}
 placeholder="Ej: 700"
 disabled={!selection}
 />
 </div>

 {/* Dirección (común, excepto stop) */}
 {selected && selected.kind !== "stop" && (
 <div className="mb-3">
 <label className="block mb-1 text-sm text-[var(--ui-muted)]">
 Dirección
 {selected.kind === "pivot" && selection?.track !== "dual" && (
 <span className="text-xs text-amber-300 ml-2">
 (se invierte automáticamente en el par)
 </span>
 )}
 </label>
 <select
 className="app-input w-full px-3 py-2.5 text-sm"
 value={direction}
 onChange={(e) => {
 const newDirection = Number(e.target.value) as Dir;
 setDirection(newDirection);

 // Si es pivot en modo simple y tiene par, actualizar dirección invertida del par
 if (
 selected &&
 selected.kind === "pivot" &&
 selection?.track !== "dual"
 ) {
 const pairId = blockProps[selected.id]?.pivotPairId;
 if (pairId) {
 const otherTrack: TrackKey =
 selection && selection.track === "left"
 ? "right"
 : "left";
 const invertedDirection = (
 newDirection === 0 ? 1 : 0
 ) as Dir;

 setBlocks(otherTrack)((prev) =>
 prev.map((b) => {
 const p = blockProps[b.id];
 if (
 p?.pivotPairId === pairId &&
 b.id !== selected.id
 ) {
 return {
 ...(b as any),
 direction: invertedDirection,
 } as any;
 }
 return b;
 })
 );
 }
 }
 }}
 >
 <option value={0}>Adelante</option>
 <option value={1}>Atrás</option>
 </select>
 </div>
 )}

 {/* Velocidad */}
 {selected &&
 (selected.kind === "hold" ||
 selected.kind === "pivot" ||
 selected.kind === "arc") && (
 <div className="mb-3">
 <label className="block mb-1 text-sm text-[var(--ui-muted)]">
 Velocidad (%)
 </label>
 <div className="flex items-center gap-3">
 <input
 type="range"
 min={0}
 max={100}
 className="flex-1"
 value={speed}
 onChange={(e) => setSpeed(Number(e.target.value))}
 />
 <input
 type="number"
 min={0}
 max={100}
 className="app-input w-20 px-2 py-2 text-sm"
 value={speed}
 onChange={(e) => setSpeed(Number(e.target.value))}
 />
 </div>
 </div>
 )}

 {/* RAMP */}
 {selected && selected.kind === "ramp" && (
 <>
 <div className="mb-3">
 <label className="block mb-1 text-sm text-[var(--ui-muted)]">
 Desde (%)
 </label>
 <div className="flex items-center gap-3">
 <input
 type="range"
 min={0}
 max={100}
 className="flex-1"
 value={fromPct}
 onChange={(e) => setFromPct(Number(e.target.value))}
 />
 <input
 type="number"
 min={0}
 max={100}
 className="app-input w-20 px-2 py-2 text-sm"
 value={fromPct}
 onChange={(e) => setFromPct(Number(e.target.value))}
 />
 </div>
 </div>

 <div className="mb-3">
 <label className="block mb-1 text-sm text-[var(--ui-muted)]">
 Hasta (%)
 </label>
 <div className="flex items-center gap-3">
 <input
 type="range"
 min={0}
 max={100}
 className="flex-1"
 value={Math.max(0, Math.min(100, toPct))}
 onChange={(e) => setToPct(Number(e.target.value))}
 />
 <input
 type="number"
 min={0}
 max={100}
 className="app-input w-20 px-2 py-2 text-sm"
 value={Math.max(0, Math.min(100, toPct))}
 onChange={(e) => setToPct(Number(e.target.value))}
 />
 </div>
 </div>
 </>
 )}

 {/* ARC (simple) */}
 {selected &&
 selected.kind === "arc" &&
 selection?.track !== "dual" && (
 <div className="mb-3">
 <label className="block mb-1 text-sm text-[var(--ui-muted)]">
 Lado del arco
 </label>
 <select
 className="app-input w-full px-3 py-2.5 text-sm"
 value={arcSide}
 onChange={(e) => setArcSide(Number(e.target.value) as 0 | 1)}
 >
 <option value={0}>Izquierda</option>
 <option value={1}>Derecha</option>
 </select>
 </div>
 )}

 {/* Guardar cambios */}
 <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
 <button
 className={actionButtonClass("indigo", true)}
 onClick={() => {
 if (!selection || !selected) return;
 const t = selection.track;
 const id = selection.id;

 // Actualizar props del bloque
 setBlockProps((prev) => {
 const prevProps = prev[id] ?? getDefaultPropsFor(selected);
 const nextMap: Record<string, BlockProps> = {
 ...prev,
 [id]: {
 ...prevProps,
 durationMs,
 speed,
 fromPct,
 toPct,
 arcSide,
 pivotBaseDir,
 },
 };

 // Si es pivot pareado (modo simple), replicar duración/velocidad y mantener pairId
 if (
 selected.kind === "pivot" &&
 t !== "dual" &&
 prevProps.pivotPairId
 ) {
 const pairId = prevProps.pivotPairId;
 const peerEntry = Object.entries(prev).find(
 ([key, val]) => key !== id && val.pivotPairId === pairId
 );
 if (peerEntry) {
 const [peerId] = peerEntry;
 nextMap[peerId] = {
 ...(prev[peerId] ?? getDefaultPropsFor(selected)),
 durationMs,
 speed,
 pivotPairId: pairId,
 };
 }
 }
 return nextMap;
 });

 // Actualizar el bloque seleccionado (duración / velocidad / dirección)
 setBlocks(t)((prev) =>
 prev.map((b) =>
 b.id === id
 ? ({ ...(b as any), durationMs, speed, direction } as any)
 : b
 )
 );

 // Si es pivot en modo simple y tiene par, invertir dirección del par
 if (selected.kind === "pivot" && t !== "dual") {
 const pairId = blockProps[id]?.pivotPairId;
 if (pairId) {
 const otherTrack: TrackKey =
 t === "left" ? "right" : "left";
 setBlocks(otherTrack)((prev) =>
 prev.map((b) => {
 const p = blockProps[b.id];
 if (p?.pivotPairId === pairId && b.id !== id) {
 return {
 ...(b as any),
 durationMs,
 speed,
 direction: (direction === 0 ? 1 : 0) as Dir,
 } as any;
 }
 return b;
 })
 );
 }
 }
 }}
 disabled={!selection}
 >
 Guardar
 </button>

 <button
 onClick={duplicateSelected}
 disabled={!selection || selectionLocked}
 className={actionButtonClass("indigo", false)}
 title="Duplicar bloque seleccionado"
 >
 Duplicar
 </button>

 {/* Borrar bloque seleccionado (opcional) */}
 <button
 onClick={onRemoveSelected}
 disabled={!selection}
 className={actionButtonClass("rose", true)}
 title="Eliminar bloque seleccionado"
 >
 Eliminar
 </button>
 </div>
 </div>
 </div>
 </div>
 <Modal
 isOpen={openInfoModal}
 onClose={() => setOpenInfoModal(false)}
 closeOnOverlayClick={false}
 >
 <div className="flex flex-col gap-4">
 <div>
 <div className="app-kicker mb-3">Info</div>
 <h2 className="text-2xl font-black text-[var(--ui-text)]">
 Control de motores
 </h2>
 </div>

 <p className="text-sm leading-relaxed text-[var(--ui-muted)]">
 Desde esta sección podés diseñar, validar y simular rutinas de
 movimiento para los motores. La línea de tiempo se compone de{" "}
 <strong>bloques</strong> que se recorren de izquierda a derecha y
 cada bloque mantiene sus propiedades propias.
 </p>

 <ul className="space-y-2 text-sm text-[var(--ui-muted)]">
 <li>
 <span className="font-semibold text-[var(--ui-text)]">Modos:</span> simple para
 editar cada motor por separado, y dual para editar una colección
 separada que representa ambos motores.
 </li>
 <li>
 <span className="font-semibold text-[var(--ui-text)]">Línea de tiempo:</span>{" "}
 cada bloque refleja su duración y progreso de simulación local.
 </li>
 <li>
 <span className="font-semibold text-[var(--ui-text)]">Ejecución física:</span>{" "}
 permanece bloqueada hasta tener conexión, modo TEST y comandos de
 motor implementados en el contrato ESP/STM32.
 </li>
 </ul>

 <div className="rounded-md border border-[var(--ui-ring)] bg-[var(--ui-panel)] p-3 text-xs text-[var(--ui-muted)]">
 <p className="m-0">
 <span className="font-semibold text-[var(--ui-text)]">Tip:</span> en
 bloques de tipo ramp conviene mantener cambios graduales, y en
 hold, arc o pivot usar la velocidad como referencia visual para
 validar la secuencia antes de ejecutar.
 </p>
 </div>
 </div>
 </Modal>

 <Modal
 isOpen={openSettingsModal}
 onClose={() => setOpenSettingsModal(false)}
 closeOnOverlayClick={false}
 containerClassnames="home-settings-dialog flex-col"
 >
 <div className="flex flex-col gap-4">
 <ThemeModeToggleCard />
 <HdAssetsSettingsCard />
 <div>
 <div className="app-kicker mb-3">Config</div>
 <h2 className="text-2xl font-black text-[var(--ui-text)]">Configuración</h2>
 </div>

 <SystemResetActions />

 <div className="my-2 flex w-full items-center justify-center gap-4 rounded-md border border-[var(--ui-ring)] bg-[var(--ui-panel)] p-4">
 <p className="text-sm text-[var(--ui-muted)]">Resetear configuración</p>
 <button
 className={actionButtonClass("rose", true)}
 onClick={() => console.log("Resetear configuracion")}
 >
 Enviar
 </button>
 </div>
 </div>
 </Modal>
 </section>
 );
}

function ControlHeaderStatus({
 connected,
 carMode,
 modeLabel,
 safetyArmed,
 ackLabel,
}: {
 connected: boolean;
 carMode: string;
 modeLabel: string;
 safetyArmed: boolean;
 ackLabel: string;
}) {
 const { status: espWifiStatus } = useEspWifiStatus();

 return (
 <SectionStatusStrip
 ariaLabel="Estado de control"
 className="control-status-strip"
 items={[
 {
 label: "Conn",
 value: connected ? getEspConnectionLabel(espWifiStatus) : "OFF",
 detail: connected ? getEspConnectionDetail(espWifiStatus) : undefined,
 tone: connected ? "ok" : "error",
 },
 {
 label: "STM32",
 value: carMode,
 tone: connected ? "info" : "muted",
 },
 { label: "Modo", value: modeLabel, tone: "info" },
 {
 label: "Safety",
 value: safetyArmed ? "ARMED" : "LOCKED",
 tone: safetyArmed ? "ok" : "warn",
 title: safetyArmed
 ? "La ejecucion fisica puede habilitarse."
 : "Bloquea la ejecucion fisica. La edicion y la simulacion local siguen disponibles.",
 },
 { label: "ACK", value: ackLabel, tone: "muted" },
 ]}
 />
 );
}

function StatusPill({
 label,
 value,
 tone,
}: {
 label: string;
 value: string;
 tone: "cyan" | "emerald" | "amber" | "rose" | "muted";
}) {
 const toneClass = {
 cyan: "border-cyan-300/35 bg-cyan-500/10 text-cyan-100",
 emerald: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100",
 amber: "border-amber-300/35 bg-amber-500/10 text-amber-100",
 rose: "border-rose-300/35 bg-rose-500/10 text-rose-100",
 muted: "border-[var(--ui-ring)] bg-[var(--ui-panel)] text-[var(--ui-text)]",
 }[tone];

 return (
 <span
 title={
 label === "Safety"
 ? value === "LOCKED"
 ? "Bloquea la ejecución física. La edición y la simulación local siguen disponibles."
 : "La ejecución física puede habilitarse."
 : undefined
 }
 className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${toneClass}`}
 >
 <span className="text-[var(--ui-muted)]">{label}:</span>
 <span>{value}</span>
 {tone === "emerald" ? (
 <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
 ) : null}
 {label === "Safety" && value === "LOCKED" ? (
 <span aria-hidden="true" className="text-amber-300">
 🔒
 </span>
 ) : null}
 </span>
 );
}

function ControlBrandGlyph() {
 return (
 <span className="home-brand-glyph control-brand-glyph" aria-hidden="true">
 <svg viewBox="0 0 24 24">
 <path d="M7 9h10c2.1 0 3.5 1.5 4 4.2l.45 2.4c.22 1.25-.86 2.3-2.05 1.88l-2.1-.74a4.2 4.2 0 0 0-1.4-.24H8.1c-.48 0-.95.08-1.4.24l-2.1.74c-1.2.42-2.27-.63-2.05-1.88L3 13.2C3.5 10.5 4.9 9 7 9Z" />
 <path d="M7 12v3M5.5 13.5h3M16 12.5h.01M18.5 14.5h.01" />
 </svg>
 </span>
 );
}

function TrackSimButton({
 isPlaying,
 disabled,
 onClick,
}: {
 isPlaying: boolean;
 disabled: boolean;
 onClick: () => void;
}) {
 return (
 <div className="-mt-1 flex justify-end">
 <button
 type="button"
 onClick={onClick}
 disabled={disabled}
 className={`inline-flex min-w-[126px] items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
 isPlaying
 ? "border-rose-300/60 bg-rose-500/15 text-rose-100 hover:bg-rose-500/22"
 : "border-cyan-300/45 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/18"
 }`}
 >
 <span>{isPlaying ? "■" : "▶"}</span>
 {isPlaying ? "Detener" : "Simular"}
 </button>
 </div>
 );
}

function BlockPalettePanel({
 selection,
 dualMode,
 paletteKind,
 pairSelected,
 selectionLocked,
 onAddBlock,
 onSelectKind,
}: {
 selection: { track: TrackKey; id: string } | null;
 dualMode: boolean;
 paletteKind: BlockKind | null;
 pairSelected: { track: TrackKey; id: string } | null;
 selectionLocked: boolean;
 onAddBlock: () => void;
 onSelectKind: (kind: BlockKind) => void;
}) {
 return (
 <section className="mt-5 rounded-lg border border-cyan-300/18 bg-[var(--ui-bg-0)]/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
 <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
 <div>
 <div className="text-sm font-black uppercase tracking-wide text-cyan-200">
 Paleta de bloques
 </div>
 <p className="mt-0.5 text-xs text-[var(--ui-muted)]">
 {selection
 ? `Destino: ${trackLabel(selection.track)}`
 : dualMode
 ? "Destino: ambos motores"
 : "Destino: motor izquierdo"}
 </p>
 </div>
 <button
 type="button"
 onClick={onAddBlock}
 disabled={!paletteKind || selectionLocked}
 className="inline-flex items-center justify-center gap-2 rounded-md border border-cyan-300/45 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-100 transition-all hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-50"
 >
 <span className="text-lg leading-none">＋</span>
 Agregar bloque
 </button>
 </div>

 <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
 {(["ramp", "hold", "pivot", "arc", "stop"] as BlockKind[]).map((kind) => {
 const disabled = dualMode && kind === "pivot";
 return (
 <PaletteToolButton
 key={kind}
 kind={kind}
 selected={!disabled && paletteKind === kind}
 pairSelected={Boolean(pairSelected) && kind === "pivot"}
 disabled={disabled || selectionLocked}
 onClick={() => {
 if (!disabled) onSelectKind(kind);
 }}
 />
 );
 })}
 </div>
 </section>
 );
}

function PaletteToolButton({
 kind,
 selected,
 pairSelected,
 disabled,
 onClick,
}: {
 kind: BlockKind;
 selected: boolean;
 pairSelected: boolean;
 disabled: boolean;
 onClick: () => void;
}) {
 const tone = paletteTone(kind, selected);
 return (
 <button
 type="button"
 disabled={disabled}
 onClick={disabled ? undefined : onClick}
 title={disabled && kind === "pivot" ? "Pivote no disponible en modo dual" : labelES[kind]}
 className={`group relative flex min-h-[58px] items-center gap-3 overflow-hidden rounded-md border px-3 py-2 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 ${tone} ${
 pairSelected ? "shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_0_4px_rgba(56,189,248,0.10)]" : ""
 }`}
 >
 <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-current/30 bg-[var(--ui-panel)]">
 <BlockMiniShape kind={kind} />
 </span>
 <span>
 <span className="block text-sm font-black text-[var(--ui-text)]">
 {labelES[kind]}
 </span>
 <span className="block text-[11px] text-current/70">
 {kind === "ramp"
 ? "Pendiente"
 : kind === "hold"
 ? "Constante"
 : kind === "pivot"
 ? "Giro"
 : kind === "arc"
 ? "Curva"
 : "Parada"}
 </span>
 </span>
 </button>
 );
}

function BlockMiniShape({ kind }: { kind: BlockKind }) {
 if (kind === "ramp") {
 return <span className="h-0 w-0 border-b-[20px] border-l-[30px] border-b-amber-300 border-l-transparent" />;
 }
 if (kind === "hold") {
 return <span className="h-4 w-8 rounded-sm border border-emerald-300 bg-emerald-400/25" />;
 }
 if (kind === "pivot") {
 return <span className="text-2xl leading-none text-sky-200">↻</span>;
 }
 if (kind === "arc") {
 return <span className="h-6 w-9 rounded-t-full border border-b-0 border-indigo-300 bg-indigo-400/20" />;
 }
 return <StopDiscontinuityGlyph className="text-rose-200" />;
}

function BlockPropertiesPanel({
 selected,
 selection,
 durationMs,
 setDurationMs,
 speed,
 setSpeed,
 direction,
 onDirectionChange,
 fromPct,
 setFromPct,
 toPct,
 setToPct,
 arcSide,
 setArcSide,
 selectedHasValidationError,
 selectedHasUnsavedChanges,
 selectedIssues,
 selectionLocked,
 onSave,
 onDuplicate,
 onDelete,
}: {
 selected: Block | null;
 selection: { track: TrackKey; id: string } | null;
 durationMs: number;
 setDurationMs: (value: number) => void;
 speed: number;
 setSpeed: (value: number) => void;
 direction: Dir;
 onDirectionChange: (value: Dir) => void;
 fromPct: number;
 setFromPct: (value: number) => void;
 toPct: number;
 setToPct: (value: number) => void;
 arcSide: 0 | 1;
 setArcSide: (value: 0 | 1) => void;
 selectedHasValidationError: boolean;
 selectedHasUnsavedChanges: boolean;
 selectedIssues: ValidationIssue[];
 selectionLocked: boolean;
 onSave: () => void;
 onDuplicate: () => void;
 onDelete: () => void;
}) {
 return (
 <aside
 className={`w-full p-5 ${sectionCardClass(selected ? toneFromKind(selected.kind) : "indigo")} ${
 !selection ? "opacity-70" : ""
 }`}
 >
 <div className="mb-4 flex items-start justify-between gap-3 border-b border-[var(--ui-ring)] pb-3">
 <div>
 <h3 className="text-lg font-black text-cyan-200">
 Bloque seleccionado
 </h3>
 <p className="mt-1 text-xs text-[var(--ui-muted)]">
 Propiedades editables del bloque activo.
 </p>
 </div>
 <span className="text-cyan-300">⌃</span>
 </div>

 {selected ? (
 <div className="space-y-3">
 <div className="flex items-center justify-between gap-3">
 <span className={kindBadgeClass(selected.kind)}>
 {labelES[selected.kind]}
 </span>
 <span
 className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
 selectedHasValidationError
 ? "border-rose-300/40 bg-rose-500/15 text-rose-100"
 : selectedHasUnsavedChanges
 ? "border-amber-300/40 bg-amber-500/15 text-amber-100"
 : "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
 }`}
 >
 {selectedHasValidationError
 ? "Inválido"
 : selectedHasUnsavedChanges
 ? "Sin guardar"
 : "Válido"}
 </span>
 </div>

 <PropertyReadOnly label="Track" value={selection ? trackLabel(selection.track) : "--"} icon="⇆" />

 <PropertyNumber
 label="Duración"
 suffix="ms"
 value={durationMs}
 min={0}
 onChange={setDurationMs}
 icon="◷"
 />

 {selected.kind !== "stop" ? (
 <PropertySelect
 label="Dirección"
 value={String(direction)}
 onChange={(value) => onDirectionChange(Number(value) as Dir)}
 options={[
 ["0", "Adelante"],
 ["1", "Atrás"],
 ]}
 icon="↔"
 />
 ) : null}

 {(selected.kind === "hold" ||
 selected.kind === "pivot" ||
 selected.kind === "arc") ? (
 <PropertyRange
 label="Velocidad"
 value={speed}
 onChange={setSpeed}
 icon="◴"
 />
 ) : null}

 {selected.kind === "ramp" ? (
 <>
 <PropertyRange
 label="Desde"
 value={fromPct}
 onChange={setFromPct}
 icon="◇"
 />
 <PropertyRange
 label="Hasta"
 value={toPct}
 onChange={setToPct}
 icon="◇"
 />
 </>
 ) : null}

 {selected.kind === "arc" && selection?.track !== "dual" ? (
 <PropertySelect
 label="Curva"
 value={String(arcSide)}
 onChange={(value) => setArcSide(Number(value) as 0 | 1)}
 options={[
 ["0", "Izquierda"],
 ["1", "Derecha"],
 ]}
 icon="⌁"
 />
 ) : null}

 {selectedIssues.length > 0 ? (
 <div className="rounded-md border border-amber-300/20 bg-amber-500/10 p-3 text-xs text-amber-100">
 {selectedIssues.map((issue) => (
 <div key={`${issue.track}-${issue.message}`}>
 {issue.severity === "error" ? "Error" : "Aviso"}: {issue.message}
 </div>
 ))}
 </div>
 ) : null}

 <div className="grid grid-cols-3 gap-2 pt-2">
 <button
 type="button"
 onClick={onSave}
 disabled={!selection}
 className={panelActionClass("cyan")}
 >
 <PanelActionIcon name="save" />
 Guardar
 </button>
 <button
 type="button"
 onClick={onDuplicate}
 disabled={!selection || selectionLocked}
 className={panelActionClass("muted")}
 >
 <PanelActionIcon name="copy" />
 Duplicar
 </button>
 <button
 type="button"
 onClick={onDelete}
 disabled={!selection}
 className={panelActionClass("rose")}
 >
 <PanelActionIcon name="trash" />
 Eliminar
 </button>
 </div>
 </div>
 ) : (
 <div className="rounded-md border border-[var(--ui-ring)] bg-white/[0.04] p-4 text-sm text-[var(--ui-muted)]">
 Seleccioná un bloque de la línea de tiempo para editarlo.
 </div>
 )}
 </aside>
 );
}

function PropertyReadOnly({
 label,
 value,
 icon,
}: {
 label: string;
 value: string;
 icon: string;
}) {
 return (
 <div className="grid grid-cols-[24px_1fr_1.25fr] items-center gap-3 text-sm">
 <span className="text-cyan-300">{icon}</span>
 <span className="text-[var(--ui-muted)]">{label}</span>
 <span className="rounded-md border border-[var(--ui-ring)] bg-white/[0.04] px-3 py-2 text-[var(--ui-text)]">
 {value}
 </span>
 </div>
 );
}

function PropertyNumber({
 label,
 value,
 min,
 suffix,
 icon,
 onChange,
}: {
 label: string;
 value: number;
 min?: number;
 suffix: string;
 icon: string;
 onChange: (value: number) => void;
}) {
 return (
 <div className="grid grid-cols-[24px_1fr_1.25fr] items-center gap-3 text-sm">
 <span className="text-cyan-300">{icon}</span>
 <span className="text-[var(--ui-muted)]">{label}</span>
 <div className="flex items-center gap-2">
 <input
 type="number"
 min={min}
 className="app-input w-full px-3 py-2 text-sm"
 value={value}
 onChange={(event) => onChange(Number(event.target.value))}
 />
 <span className="text-xs text-[var(--ui-muted)]">{suffix}</span>
 </div>
 </div>
 );
}

function PropertyRange({
 label,
 value,
 icon,
 onChange,
}: {
 label: string;
 value: number;
 icon: string;
 onChange: (value: number) => void;
}) {
 return (
 <div className="grid grid-cols-[24px_1fr_1.25fr] items-center gap-3 text-sm">
 <span className="text-cyan-300">{icon}</span>
 <span className="text-[var(--ui-muted)]">{label}</span>
 <div className="flex items-center gap-2">
 <input
 type="range"
 min={0}
 max={100}
 value={value}
 onChange={(event) => onChange(Number(event.target.value))}
 className="min-w-0 flex-1"
 />
 <input
 type="number"
 min={0}
 max={100}
 className="app-input w-16 px-2 py-2 text-sm"
 value={Math.max(0, Math.min(100, value))}
 onChange={(event) => onChange(Number(event.target.value))}
 />
 <span className="text-xs text-[var(--ui-muted)]">%</span>
 </div>
 </div>
 );
}

function PropertySelect({
 label,
 value,
 options,
 icon,
 onChange,
}: {
 label: string;
 value: string;
 options: Array<[string, string]>;
 icon: string;
 onChange: (value: string) => void;
}) {
 return (
 <div className="grid grid-cols-[24px_1fr_1.25fr] items-center gap-3 text-sm">
 <span className="text-cyan-300">{icon}</span>
 <span className="text-[var(--ui-muted)]">{label}</span>
 <select
 className="app-input w-full px-3 py-2 text-sm"
 value={value}
 onChange={(event) => onChange(event.target.value)}
 >
 {options.map(([optionValue, labelText]) => (
 <option key={optionValue} value={optionValue}>
 {labelText}
 </option>
 ))}
 </select>
 </div>
 );
}

function MotionSimulationPanel({
 pose,
 isSimulating,
 dualMode,
 totalMs,
 variant = "compact",
}: {
 pose: SimulationPose;
 isSimulating: boolean;
 dualMode: boolean;
 totalMs: number;
 variant?: "compact" | "large";
}) {
 const isLarge = variant === "large";
 const base = import.meta.env.BASE_URL || "/";
 const modelUrl = usePreferredModelUrl(`${base}models/auto_micro.glb`);
 const pathPoints = pose.path
 .map((p) => `${clamp(p.x, -118, 118).toFixed(1)},${clamp(p.y, -78, 78).toFixed(1)}`)
 .join(" ");

 return (
 <section className={`${isLarge ? "" : "mb-4"} overflow-hidden rounded-lg border border-cyan-300/20 bg-[var(--ui-bg-0)]/55 ${isLarge ? "p-4" : "p-3"} shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}>
 <div className={`grid gap-3 ${isLarge ? "lg:grid-cols-[minmax(0,1fr)_250px]" : "lg:grid-cols-[minmax(0,1fr)_190px]"}`}>
 <div className={`relative overflow-hidden rounded-lg border border-cyan-300/20 bg-[var(--ui-bg-0)]/70 ${isLarge ? "min-h-[340px] md:min-h-[430px]" : "min-h-[150px]"}`}>
 <MotorTopView3D
 modelUrl={modelUrl}
 pose={pose}
 isSimulating={isSimulating}
 />
 <div className="pointer-events-none absolute inset-0">
 <div className="absolute left-3 top-3 z-10 flex items-center gap-2 pointer-events-auto">
 <HdModelQualityButton />
 <div className="rounded-md border border-amber-300/40 bg-[var(--ui-bg-0)]/85 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-amber-200 shadow-[0_0_18px_rgba(245,158,11,0.16)] backdrop-blur-sm">
 Frente físico: lado TCRT
 </div>
 </div>
 <svg
 viewBox="-140 -95 280 190"
 className="absolute inset-0 h-full w-full"
 aria-hidden="true"
 >
 <line x1="-130" x2="130" y1="0" y2="0" stroke="rgba(148,163,184,0.22)" strokeDasharray="4 6" />
 <line x1="0" x2="0" y1="-85" y2="85" stroke="rgba(148,163,184,0.22)" strokeDasharray="4 6" />
 {pathPoints.length > 0 ? (
 <polyline
 points={pathPoints}
 fill="none"
 stroke="#22d3ee"
 strokeWidth="2.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 opacity="0.78"
 />
 ) : null}
 </svg>
 </div>
 </div>

 <div className="grid content-start gap-2">
 <div>
 <div className="app-kicker mb-1">Simulación local</div>
 <h3 className={isLarge ? "text-xl font-black text-[var(--ui-text)]" : "text-base font-black text-[var(--ui-text)]"}>
 Vista superior 3D
 </h3>
 <p className="mt-1 text-[11px] leading-snug text-[var(--ui-muted)]">
 Solo simulado
 </p>
 </div>
 <StatusPill
 label="Estado"
 value={isSimulating ? "RUNNING" : "READY"}
 tone={isSimulating ? "emerald" : "muted"}
 />
 <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
 <MetricCard label="Track" value={dualMode ? "Dual" : "L + R"} />
 <MetricCard label="Duración" value={`${formatMs(totalMs)}`} />
 <MetricCard label="L / R" value={`${Math.round(pose.leftPct)} / ${Math.round(pose.rightPct)} %`} tone={pose.leftPct === 0 && pose.rightPct === 0 ? "muted" : "cyan"} />
 <MetricCard label="Yaw" value={`${Math.round(pose.yawDeg)}°`} />
 </div>
 </div>
 </div>
 </section>
 );
}

function MotorTopView3D({
 modelUrl,
 pose,
 isSimulating,
}: {
 modelUrl: string;
 pose: SimulationPose;
 isSimulating: boolean;
}) {
 const { isModelLoading, markModelLoaded } = useModelLoadingState(modelUrl);

 return (
 <>
 <ModelLoadingScreen visible={isModelLoading} />
 <Canvas
 camera={{ position: [0, 5.2, 0.01], fov: 42, near: 0.1, far: 80 }}
 dpr={[1, 2]}
 gl={{ alpha: true, antialias: true }}
 onCreated={({ camera, gl }) => {
 camera.lookAt(0, 0, 0);
 camera.updateProjectionMatrix();
 gl.outputColorSpace = THREE.SRGBColorSpace;
 gl.toneMapping = THREE.ACESFilmicToneMapping;
 gl.toneMappingExposure = 1.1;
 }}
 >
 <color attach="background" args={["#020617"]} />
 <fog attach="fog" args={["#020617", 6, 11]} />
 <ambientLight intensity={0.9} />
 <directionalLight position={[2, 5, 2]} intensity={3.5} />
 <pointLight position={[0, 2, 0]} intensity={4} color="#22d3ee" />
 <TopCameraController />
 <TechnicalTopGrid />
 <SimulationPath3D path={pose.path} />
 <Suspense fallback={<TopFallbackVehicle pose={pose} />}>
 <TopVehicleModel
 modelUrl={modelUrl}
 pose={pose}
 isSimulating={isSimulating}
 onLoaded={markModelLoaded}
 />
 </Suspense>
 <OrbitControls
 enableDamping
 dampingFactor={0.08}
 enableRotate={false}
 enablePan={false}
 enableZoom
 minDistance={3.2}
 maxDistance={7.2}
 target={[0, 0, 0]}
 />
 </Canvas>
 </>
 );
}

function TopCameraController() {
 const { camera } = useThree();

 useEffect(() => {
 camera.position.set(0, 5.2, 0.01);
 camera.lookAt(0, 0, 0);
 camera.updateProjectionMatrix();
 }, [camera]);

 return null;
}

function TechnicalTopGrid() {
 const grid = useMemo(() => {
 const helper = new THREE.GridHelper(8, 32, "#0891b2", "#12334a");
 const material = helper.material as THREE.Material;
 material.transparent = true;
 material.opacity = 0.45;
 return helper;
 }, []);

 return (
 <group>
 <primitive object={grid} position={[0, -0.02, 0]} />
 <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
 <planeGeometry args={[8, 8]} />
 <meshBasicMaterial color="#020617" opacity={0.36} transparent />
 </mesh>
 </group>
 );
}

function SimulationPath3D({ path }: { path: SimulationPose["path"] }) {
 const line = useMemo(() => {
 const points = path.map((point) => {
 const x = clamp(point.x / 34, -3.4, 3.4);
 const z = clamp(point.y / 34, -3.4, 3.4);
 return new THREE.Vector3(x, 0.04, z);
 });

 if (points.length < 2) {
 points.push(new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(0.001, 0.04, 0.001));
 }

 const geometry = new THREE.BufferGeometry().setFromPoints(points);
 const material = new THREE.LineBasicMaterial({
 color: "#22d3ee",
 transparent: true,
 opacity: 0.86,
 });

 return new THREE.Line(geometry, material);
 }, [path]);

 return <primitive object={line} />;
}

function TopVehicleModel({
 modelUrl,
 pose,
 isSimulating,
 onLoaded,
}: {
 modelUrl: string;
 pose: SimulationPose;
 isSimulating: boolean;
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
 // Se mide una copia todavía desacoplada de la pose móvil. Así el centro del
 // GLB queda expresado en coordenadas locales y nunca incorpora x/z/yaw del auto.
 const object = scene.clone(true);
 object.updateMatrixWorld(true);
 const box = new THREE.Box3().setFromObject(object);
 const size = new THREE.Vector3();
 const center = new THREE.Vector3();
 box.getSize(size);
 box.getCenter(center);
 const maxDim = Math.max(size.x, size.y, size.z) || 1;
 return {
 object,
 center: center.toArray() as [number, number, number],
 scale: 1.9 / maxDim,
 };
 }, [scene]);

 const x = clamp(pose.x / 34, -3.4, 3.4);
 const z = clamp(pose.y / 34, -3.4, 3.4);
 // El frente físico del modelo apunta a -Z: es el extremo donde están los TCRT.
 // Esta transformación alinea ese frente con el heading usado para integrar el path.
 const yaw = THREE.MathUtils.degToRad(-pose.yawDeg - 90);

 return (
 <group position={[x, 0.08, z]} rotation={[0, yaw, 0]}>
 <group scale={normalizedModel.scale}>
 <group
 position={[
 -normalizedModel.center[0],
 -normalizedModel.center[1],
 -normalizedModel.center[2],
 ]}
 >
 <primitive object={normalizedModel.object} />
 </group>
 </group>
 <group position={[0, 0.08, -0.56]}>
 <mesh rotation={[-Math.PI / 2, 0, 0]}>
 <coneGeometry args={[0.09, 0.24, 3]} />
 <meshBasicMaterial color={isSimulating ? "#fbbf24" : "#a16207"} />
 </mesh>
 <mesh position={[-0.12, 0, 0.08]}>
 <boxGeometry args={[0.07, 0.04, 0.1]} />
 <meshBasicMaterial color="#22d3ee" />
 </mesh>
 <mesh position={[0, 0, 0.08]}>
 <boxGeometry args={[0.07, 0.04, 0.1]} />
 <meshBasicMaterial color="#22d3ee" />
 </mesh>
 <mesh position={[0.12, 0, 0.08]}>
 <boxGeometry args={[0.07, 0.04, 0.1]} />
 <meshBasicMaterial color="#22d3ee" />
 </mesh>
 </group>
 </group>
 );
}

function TopFallbackVehicle({ pose }: { pose: SimulationPose }) {
 const x = clamp(pose.x / 34, -3.4, 3.4);
 const z = clamp(pose.y / 34, -3.4, 3.4);
 const yaw = THREE.MathUtils.degToRad(-pose.yawDeg - 90);

 return (
 <group position={[x, 0.08, z]} rotation={[0, yaw, 0]}>
 <mesh>
 <boxGeometry args={[0.9, 0.24, 1.65]} />
 <meshStandardMaterial color="#38bdf8" metalness={0.2} roughness={0.35} />
 </mesh>
 <mesh position={[0, 0.1, -0.72]} rotation={[-Math.PI / 2, 0, 0]}>
 <coneGeometry args={[0.18, 0.38, 3]} />
 <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.4} />
 </mesh>
 </group>
 );
}

function MetricCard({
 label,
 value,
 tone = "cyan",
}: {
 label: string;
 value: string;
 tone?: "cyan" | "muted";
}) {
 return (
 <div className="rounded-md border border-[var(--ui-ring)] bg-white/[0.04] p-2">
 <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
 {label}
 </div>
 <div className={tone === "cyan" ? "mt-0.5 text-sm font-black text-cyan-200" : "mt-0.5 text-sm font-black text-[var(--ui-text)]"}>
 {value}
 </div>
 </div>
 );
}

function ExecutionStatusPanel({
 compact = false,
 connected,
 carMode,
 carModeStatus,
 safetyArmed,
 physicalBlockedReason,
 isSimulating,
 lastLocalEvent,
 validationRan,
 validationErrorCount,
 validationWarningCount,
}: {
 compact?: boolean;
 connected: boolean;
 carMode: string;
 carModeStatus: string;
 safetyArmed: boolean;
 physicalBlockedReason: string;
 isSimulating: boolean;
 lastLocalEvent: string;
 validationRan: boolean;
 validationErrorCount: number;
 validationWarningCount: number;
}) {
 const validationValue = !validationRan
 ? "Pendiente"
 : validationErrorCount > 0
 ? `${validationErrorCount} error(es)`
 : validationWarningCount > 0
 ? `${validationWarningCount} warning(s)`
 : "OK";

 return (
 <aside className={`${sectionCardClass("indigo")} px-4 py-4 md:px-5`}>
 <div className="mb-3 flex items-start justify-between gap-3">
 <div>
 <div className="app-kicker mb-2">Diagnóstico</div>
 <h3 className="text-xl font-black text-[var(--ui-text)]">Estado de ejecución</h3>
 </div>
 <StatusPill
 label="Física"
 value={safetyArmed ? "Habilitable" : "Bloqueada"}
 tone={safetyArmed ? "emerald" : "rose"}
 />
 </div>

 <div className={compact ? "grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4" : "grid gap-2 text-sm"}>
 <DiagnosticRow
 label="Reproducción"
 value={isSimulating ? "Simulación local activa" : "Simulación local lista"}
 tone={isSimulating ? "emerald" : "cyan"}
 />
 <DiagnosticRow
 label="Ejecución física"
 value={safetyArmed ? "Disponible" : "Bloqueada"}
 tone={safetyArmed ? "emerald" : "rose"}
 />
 <DiagnosticRow label="Motivo" value={physicalBlockedReason} tone={safetyArmed ? "emerald" : "amber"} />
 <DiagnosticRow label="Conexión" value={connected ? "WebSocket conectado" : "Sin conexión"} tone={connected ? "emerald" : "rose"} />
 <DiagnosticRow label="Modo STM32" value={connected ? `${carMode} (${carModeStatus})` : "--"} tone={connected ? "cyan" : "muted"} />
 <DiagnosticRow label="Validación" value={validationValue} tone={validationErrorCount > 0 ? "rose" : validationRan ? "emerald" : "amber"} />
 <DiagnosticRow label="Último comando" value={lastLocalEvent} tone="muted" />
 <DiagnosticRow label="Telemetría" value="Pendiente de protocolo motor" tone="amber" />
 </div>
 </aside>
 );
}

function DiagnosticRow({
 label,
 value,
 tone,
}: {
 label: string;
 value: string;
 tone: "cyan" | "emerald" | "amber" | "rose" | "muted";
}) {
 const dotClass = {
 cyan: "bg-cyan-300",
 emerald: "bg-emerald-300",
 amber: "bg-amber-300",
 rose: "bg-rose-300",
 muted: "bg-[var(--ui-bg-2)]",
 }[tone];

 return (
 <div className="flex min-h-[48px] items-center justify-between gap-3 rounded-md border border-[var(--ui-ring)] bg-white/[0.025] px-3 py-2">
 <span className="text-[var(--ui-muted)]">{label}</span>
 <span className="flex items-center gap-2 text-right font-semibold text-[var(--ui-text)]">
 {value}
 <span className={`size-2 rounded-full ${dotClass}`} />
 </span>
 </div>
 );
}

function SimulationTransportControls({
 dualMode,
 isSimulating,
 isPlayingLeft,
 isPlayingRight,
 isPlayingDual,
 canRunLeft,
 canRunRight,
 canRunBoth,
 physicalEnabled,
 physicalBlockedReason,
 onStop,
 onRunLeft,
 onRunRight,
 onRunBoth,
 onReset,
 onExecutePhysical,
}: {
 dualMode: boolean;
 isSimulating: boolean;
 isPlayingLeft: boolean;
 isPlayingRight: boolean;
 isPlayingDual: boolean;
 canRunLeft: boolean;
 canRunRight: boolean;
 canRunBoth: boolean;
 physicalEnabled: boolean;
 physicalBlockedReason: string;
 onStop: () => void;
 onRunLeft: () => void;
 onRunRight: () => void;
 onRunBoth: () => void;
 onReset: () => void;
 onExecutePhysical: () => void;
}) {
 const bothActive = dualMode ? isPlayingDual : isPlayingLeft && isPlayingRight;

 return (
 <section className={`${sectionCardClass("cyan")} grid gap-2 p-3 md:grid-cols-6`}>
 <TransportButton
 label="Stop"
 detail="Pausa timers"
 icon="■"
 tone="rose"
 disabled={!isSimulating}
 onClick={onStop}
 />
 <TransportButton
 label="Play L"
 detail={dualMode ? "Modo simple" : "Motor izquierdo"}
 icon="▶ L"
 tone="cyan"
 active={isPlayingLeft}
 disabled={dualMode || !canRunLeft}
 onClick={onRunLeft}
 />
 <TransportButton
 label="Play R"
 detail={dualMode ? "Modo simple" : "Motor derecho"}
 icon="▶ R"
 tone="cyan"
 active={isPlayingRight}
 disabled={dualMode || !canRunRight}
 onClick={onRunRight}
 />
 <TransportButton
 label={dualMode ? "Play dual" : "Play ambas"}
 detail={dualMode ? "Pista dual" : "L + R"}
 icon="▶"
 tone="emerald"
 active={bothActive}
 disabled={!canRunBoth}
 onClick={onRunBoth}
 />
 <TransportButton
 label="Reset"
 detail="Origen + path"
 icon="↺"
 tone="muted"
 onClick={onReset}
 />
 <TransportButton
 label="Ejecutar STM"
 detail={physicalEnabled ? "Secuencia real" : physicalBlockedReason}
 icon="✦"
 tone="muted"
 disabled={!physicalEnabled}
 onClick={onExecutePhysical}
 />
 </section>
 );
}

function TransportButton({
 label,
 detail,
 icon,
 tone,
 active = false,
 disabled = false,
 onClick,
}: {
 label: string;
 detail: string;
 icon: string;
 tone: "cyan" | "emerald" | "rose" | "muted";
 active?: boolean;
 disabled?: boolean;
 onClick: () => void;
}) {
 return (
 <TransportActionButton
 label={label}
 detail={detail}
 icon={icon}
 tone={tone}
 active={active}
 disabled={disabled}
 onClick={onClick}
 />
 );
}

function paletteTone(kind: BlockKind, selected: boolean) {
 const active = {
 ramp: "border-amber-300/70 bg-amber-500/20 text-amber-100 shadow-[0_12px_28px_rgba(245,158,11,0.18)]",
 hold: "border-emerald-300/70 bg-emerald-500/20 text-emerald-100 shadow-[0_12px_28px_rgba(16,185,129,0.18)]",
 pivot: "border-sky-300/70 bg-sky-500/20 text-sky-100 shadow-[0_12px_28px_rgba(14,165,233,0.18)]",
 arc: "border-indigo-300/70 bg-indigo-500/20 text-indigo-100 shadow-[0_12px_28px_rgba(99,102,241,0.18)]",
 stop: "border-rose-300/70 bg-rose-500/20 text-rose-100 shadow-[0_12px_28px_rgba(244,63,94,0.18)]",
 };
 const inactive = {
 ramp: "border-amber-300/35 bg-amber-500/8 text-amber-100",
 hold: "border-emerald-300/35 bg-emerald-500/8 text-emerald-100",
 pivot: "border-sky-300/35 bg-sky-500/8 text-sky-100",
 arc: "border-indigo-300/35 bg-indigo-500/8 text-indigo-100",
 stop: "border-rose-300/35 bg-rose-500/8 text-rose-100",
 };

 return selected ? active[kind] : inactive[kind];
}

function panelActionClass(tone: "cyan" | "muted" | "rose") {
 const toneClass = {
 cyan: "border-cyan-300/55 bg-cyan-500/14 text-cyan-100 hover:bg-cyan-500/22",
 muted: "border-[var(--ui-ring)] bg-white/[0.04] text-[var(--ui-text)] hover:bg-[var(--ui-panel-hover)]/[0.08]",
 rose: "border-rose-300/55 bg-rose-500/14 text-rose-100 hover:bg-rose-500/22",
 }[tone];

 return `inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`;
}

function PanelActionIcon({ name }: { name: "save" | "copy" | "trash" }) {
 if (name === "save") {
 return (
 <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
 <path fill="currentColor" d="M5 3h12l2 2v16H5V3Zm2 2v5h9V5H7Zm1 10v4h8v-4H8Zm8-10v3h1V6l-1-1Z" />
 </svg>
 );
 }

 if (name === "copy") {
 return (
 <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
 <path fill="currentColor" d="M8 7a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-1v-2h1a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v1H8V7Z" />
 <path fill="currentColor" d="M3 11a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7Zm3-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H6Z" />
 </svg>
 );
 }

 return (
 <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
 <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm3 2 .45 8h1.7l-.35-8H9Zm4.2 0-.35 8h1.7L15 11h-1.8Z" />
 </svg>
 );
}

function createInitialSimPose(): SimulationPose {
 return {
 ...INITIAL_SIM_POSE,
 path: [...INITIAL_SIM_POSE.path],
 };
}

function validateTrackSequence(
 track: TrackKey,
 blocks: Block[],
 props: Record<string, MinimalBlockProps>,
 dualMode: boolean,
): ValidationIssue[] {
 const issues: ValidationIssue[] = [];

 if (blocks.length === 0) {
 issues.push({
 track,
 severity: "error",
 message: `${trackLabel(track)} no tiene bloques`,
 });
 }

 blocks.forEach((block) => {
 const durationMs = Number(block.durationMs);
 if (!Number.isFinite(durationMs) || durationMs < 0) {
 issues.push({
 track,
 blockId: block.id,
 severity: "error",
 message: `${block.label}: duración inválida`,
 });
 }

 if (block.kind !== "stop" && durationMs <= 0) {
 issues.push({
 track,
 blockId: block.id,
 severity: "error",
 message: `${block.label}: duración debe ser mayor a 0 ms`,
 });
 }

 if (dualMode && block.kind === "pivot") {
 issues.push({
 track,
 blockId: block.id,
 severity: "error",
 message: `${block.label}: pivote no aplica en modo dual`,
 });
 }

 const p = props[block.id];
 const speed = p?.speed ?? block.speed;
 if (
 (block.kind === "hold" || block.kind === "pivot" || block.kind === "arc") &&
 (!Number.isFinite(speed) || speed === undefined || speed < 0 || speed > 100)
 ) {
 issues.push({
 track,
 blockId: block.id,
 severity: "error",
 message: `${block.label}: velocidad fuera de rango`,
 });
 }

 if (block.kind === "ramp") {
 const from = p?.fromPct ?? 20;
 const to = p?.toPct ?? 80;
 if (from < 0 || from > 100 || to < 0 || to > 100) {
 issues.push({
 track,
 blockId: block.id,
 severity: "error",
 message: `${block.label}: rampa fuera de 0..100 %`,
 });
 }
 if (durationMs === 0) {
 issues.push({
 track,
 blockId: block.id,
 severity: "warning",
 message: `${block.label}: rampa instantánea`,
 });
 }
 }
 });

 return issues;
}

function runtimeMotorPct(
 blocks: Block[],
 props: Record<string, MinimalBlockProps>,
 activeIndex: number,
 activeProgress: number,
) {
 if (activeIndex < 0 || activeIndex >= blocks.length) return 0;
 const block = blocks[activeIndex];
 return blockRuntimePct(block, props[block.id], activeProgress);
}

function blockRuntimePct(
 block: Block,
 props: MinimalBlockProps | undefined,
 progress: number,
) {
 if (block.kind === "stop") return 0;

 const sign = block.direction === 1 ? -1 : 1;
 const safeProgress = clamp(progress, 0, 1);

 if (block.kind === "ramp") {
 const from = props?.fromPct ?? 20;
 const to = props?.toPct ?? 80;
 return clamp(from + (to - from) * safeProgress, 0, 100) * sign;
 }

 return clamp(props?.speed ?? block.speed ?? 0, 0, 100) * sign;
}

function integrateSimulationPose(
 pose: SimulationPose,
 leftPct: number,
 rightPct: number,
 dt: number,
): SimulationPose {
 const avgPct = (leftPct + rightPct) / 2;
 // Robot balancín de tracción diferencial: si la rueda izquierda avanza
 // más que la derecha, el frente TCRT gira hacia la derecha.
 const turnDeltaDeg = ((leftPct - rightPct) / 100) * 155 * dt;
 const nextYaw = normalizeDeg(pose.yawDeg + turnDeltaDeg);
 const yawRad = (nextYaw * Math.PI) / 180;
 const distance = avgPct * 0.72 * dt;
 const x = pose.x + Math.cos(yawRad) * distance;
 const y = pose.y + Math.sin(yawRad) * distance;
 const lastPoint = pose.path[pose.path.length - 1];
 const shouldAppend =
 !lastPoint || Math.hypot(x - lastPoint.x, y - lastPoint.y) > 1.8;
 const path = shouldAppend
 ? [...pose.path.slice(-80), { x, y }]
 : pose.path;

 return {
 x,
 y,
 yawDeg: nextYaw,
 leftPct,
 rightPct,
 path,
 };
}

function normalizeDeg(value: number) {
 let next = value % 360;
 if (next > 180) next -= 360;
 if (next < -180) next += 360;
 return next;
}

function clamp(value: number, min: number, max: number) {
 return Math.max(min, Math.min(max, value));
}

function formatMs(value: number) {
 if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
 return `${Math.round(value)} ms`;
}

function trackLabel(track: TrackKey) {
 return track === "left"
 ? "motor izquierdo"
 : track === "right"
 ? "motor derecho"
 : "ambos motores";
}

function sectionSegmentedButtonStyle(
 active: boolean,
 tone: "cyan" | "emerald",
): React.CSSProperties {
 if (!active) {
 return {
 background: "transparent",
 color: "var(--ui-text)",
 };
 }

 return tone === "emerald"
 ? {
 background: "#10b981",
 color: "#ffffff",
 boxShadow: "0 12px 28px rgba(16,185,129,0.28)",
 }
 : {
 background: "var(--ui-accent)",
 color: "#061016",
 boxShadow: "0 12px 28px rgba(34,211,238,0.28)",
 };
}

function sectionToneClass(
 tone: "cyan" | "emerald" | "indigo" | "amber" | "rose" | "sky",
) {
 return {
 cyan: "border-cyan-300/18",
 emerald: "border-emerald-300/18",
 indigo: "border-indigo-300/18",
 amber: "border-amber-300/18",
 rose: "border-rose-300/18",
 sky: "border-sky-300/18",
 }[tone];
}

function sectionCardClass(
 tone: "cyan" | "emerald" | "indigo" | "amber" | "rose" | "sky",
) {
 return `app-panel-strong rounded-md ${sectionToneClass(tone)}`;
}

function toneFromKind(kind: BlockKind) {
 return {
 ramp: "amber",
 hold: "emerald",
 pivot: "sky",
 arc: "indigo",
 stop: "rose",
 }[kind] as "amber" | "emerald" | "sky" | "indigo" | "rose";
}

function kindBadgeClass(kind: BlockKind) {
 return {
 ramp: "inline-flex items-center rounded-full border border-amber-300/40 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-100",
 hold: "inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100",
 pivot: "inline-flex items-center rounded-full border border-sky-300/40 bg-sky-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sky-100",
 arc: "inline-flex items-center rounded-full border border-indigo-300/40 bg-indigo-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-100",
 stop: "inline-flex items-center rounded-full border border-rose-300/40 bg-rose-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-rose-100",
 }[kind];
}

function actionButtonClass(
 tone: "emerald" | "rose" | "indigo",
 active = false,
) {
 const base =
 "inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

 const toneClass = active
 ? {
 emerald:
 "border-emerald-300/70 bg-emerald-500 text-[var(--ui-text)] shadow-[0_14px_34px_rgba(16,185,129,0.24)] focus-visible:ring-emerald-300/40",
 rose:
 "border-rose-300/70 bg-rose-500 text-[var(--ui-text)] shadow-[0_14px_34px_rgba(244,63,94,0.24)] focus-visible:ring-rose-300/40",
 indigo:
 "border-indigo-300/70 bg-indigo-500 text-[var(--ui-text)] shadow-[0_14px_34px_rgba(99,102,241,0.24)] focus-visible:ring-indigo-300/40",
 }
 : {
 emerald:
 "border-emerald-300/35 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/18 focus-visible:ring-emerald-300/35",
 rose:
 "border-rose-300/35 bg-rose-500/10 text-rose-100 hover:bg-rose-500/18 focus-visible:ring-rose-300/35",
 indigo:
 "border-indigo-300/35 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/18 focus-visible:ring-indigo-300/35",
 };

 return `${base} ${toneClass[tone]}`;
}
