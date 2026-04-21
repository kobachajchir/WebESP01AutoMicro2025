import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MotorBlock, { type BlockKind } from "../components/MotorBlock";
import PageHeader from "../components/PageHeader";
import TimelineRow from "../components/TimelineRow";
import type { Block, Dir, TrackKey } from "../types/MotorTypes";
import Modal from "../components/modal";
import SystemResetActions from "../components/SystemResetActions";

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

export default function ControlSection() {
  // === BLOQUES POR TRACK ===
  const [blocksLeft, setBlocksLeft] = useState<Block[]>(() =>
    initialBlocks.map((b) => ({ ...(b as any), id: uid() }))
  );
  const [blocksRight, setBlocksRight] = useState<Block[]>(() =>
    initialBlocks.map((b) => ({ ...(b as any), id: uid() }))
  );
  const [blocksDual, setBlocksDual] = useState<Block[]>(() =>
    initialBlocks.map((b) => ({ ...(b as any), id: uid() }))
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

  // Timers
  const timerLeftRef = useRef<number | null>(null);
  const timerRightRef = useRef<number | null>(null);
  const timerDualRef = useRef<number | null>(null);

  // Timestamps
  const blockStartLeftRef = useRef<number>(0);
  const blockStartRightRef = useRef<number>(0);
  const blockStartDualRef = useRef<number>(0);

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
  type MinimalBlockProps = { fromPct?: number; toPct?: number; speed?: number };
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
      className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-slate-100 selection:bg-cyan-500/30"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          setOpenSettingsModal={setOpenSettingsModal}
          setOpenInfoModal={setOpenInfoModal}
        />

        {/* Timeline + controles */}
        <div className="relative pt-7">
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-cyan-300/20 bg-slate-950/85 p-1 shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl">
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
                <h2 className="text-2xl font-black text-white md:text-3xl">
                  Secuencias de motor
                </h2>
                <p className="max-w-3xl text-sm text-slate-300">
                  Diseña, ordena y reproduce bloques de movimiento con la misma identidad visual de la sección WiFi. La edición sigue siendo la misma, pero ahora cada capa tiene un lenguaje más claro.
                </p>
              </div>

              <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200">
                {dualMode ? "Ambos motores sincronizados" : "Motores independientes"}
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
                        isPlayingDual ? "Detener (Ambos)" : "Reproducir (Ambos)"
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
                          Reproducir
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
                            : "Reproducir (Izquierdo)"
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
                            Reproducir
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
                            : "Reproducir (Derecho)"
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
                            Reproducir
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

        {/* Selector + Propiedades */}
        <div className="grid w-full gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.6fr)]">
          {/* Selector */}
          <div className={`order-last flex-1 p-6 lg:order-first ${sectionCardClass("emerald")}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xl font-bold uppercase text-white">
                  Selector de bloques
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
                <p className="mt-1 text-sm text-slate-300">
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
              {(
                (dualMode
                  ? (["ramp", "hold", "arc", "stop"] as BlockKind[])
                  : ([
                      "ramp",
                      "hold",
                      "pivot",
                      "arc",
                      "stop",
                    ] as BlockKind[])) as BlockKind[]
              ).map((k) => (
                <MotorBlock
                  key={k}
                  kind={k}
                  selected={paletteKind === k}
                  pairSelected={
                    Boolean(pairSelected) &&
                    k === "pivot" &&
                    selection?.track !== "dual"
                  }
                  onClick={() => {
                    if (selectionLocked) return;
                    if (k === paletteKind) {
                      setPaletteKind(null);
                    } else {
                      setPaletteKind(k);
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {/* Propiedades */}
          <div
            className={`w-full p-6 ${sectionCardClass(selected ? toneFromKind(selected.kind) : "indigo")} ${
              !selected && "hidden lg:block"
            } ${!selection && "opacity-60"}`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-bold uppercase text-white">
                  Propiedades del bloque
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  Ajustes finos para el bloque seleccionado.
                </p>
              </div>
              {selected ? (
                <span className={kindBadgeClass(selected.kind)}>
                  {labelES[selected.kind]}
                </span>
              ) : null}
            </div>

            <div className="mb-2 text-sm text-slate-300">
              Tipo:{" "}
              <span className="font-semibold text-slate-100">
                {selected ? labelES[selected.kind] : "—"}
              </span>
            </div>

            <div className="mb-4">
              <span className="mr-2 text-sm text-slate-300">Track:</span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-xs font-semibold text-slate-100">
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
              <label className="mb-1 block text-sm text-slate-300">
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
              <label className="block mb-1 text-sm text-slate-300">
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
                <label className="block mb-1 text-sm text-slate-300">
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
                <label className="block mb-1 text-sm text-slate-300">
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
                <label className="block mb-1 text-sm text-slate-300">
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
                <label className="block mb-1 text-sm text-slate-300">
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
            <div className="mt-4 flex items-center justify-between gap-3">
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
      {openInfoModal && (
        <Modal
          isOpen={openInfoModal}
          onClose={() => setOpenInfoModal(false)}
          closeOnOverlayClick={false}
        >
          <div className="flex flex-col gap-4">
            <div>
              <div className="app-kicker mb-3">Info</div>
              <h2 className="text-2xl font-black text-white">
                Control de motores
              </h2>
            </div>

            <p className="text-sm leading-relaxed text-slate-300">
              Desde esta sección podés diseñar y probar rutinas de movimiento para
              los motores. La línea de tiempo se compone de <strong>bloques</strong>{" "}
              que se reproducen de izquierda a derecha y cada bloque mantiene sus
              propiedades propias.
            </p>

            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <span className="font-semibold text-white">Modos:</span> simple para
                editar cada motor por separado, y dual para ejecutar una única
                secuencia sincronizada.
              </li>
              <li>
                <span className="font-semibold text-white">Línea de tiempo:</span>{" "}
                cada bloque refleja su duración y progreso de reproducción.
              </li>
              <li>
                <span className="font-semibold text-white">Edición:</span> podés
                reordenar, renombrar y ajustar propiedades sin perder la vista en
                vivo de la secuencia.
              </li>
            </ul>

            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              <p className="m-0">
                <span className="font-semibold text-white">Tip:</span> en
                bloques de tipo ramp conviene mantener cambios graduales, y en
                hold, arc o pivot usar la velocidad como referencia visual para
                validar la secuencia antes de ejecutar.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {openSettingsModal && (
        <Modal
          isOpen={openSettingsModal}
          onClose={() => setOpenSettingsModal(false)}
          closeOnOverlayClick={false}
        >
          <div className="flex flex-col gap-4">
            <div>
              <div className="app-kicker mb-3">Config</div>
              <h2 className="text-2xl font-black text-white">Configuración</h2>
            </div>

            <SystemResetActions />

            <div className="my-2 flex w-full items-center justify-center gap-4 rounded-md border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-slate-300">Resetear configuración</p>
              <button
                className={actionButtonClass("rose", true)}
                onClick={() => console.log("Resetear configuracion")}
              >
                Enviar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
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
          "border-emerald-300/70 bg-emerald-500 text-white shadow-[0_14px_34px_rgba(16,185,129,0.24)] focus-visible:ring-emerald-300/40",
        rose:
          "border-rose-300/70 bg-rose-500 text-white shadow-[0_14px_34px_rgba(244,63,94,0.24)] focus-visible:ring-rose-300/40",
        indigo:
          "border-indigo-300/70 bg-indigo-500 text-white shadow-[0_14px_34px_rgba(99,102,241,0.24)] focus-visible:ring-indigo-300/40",
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
