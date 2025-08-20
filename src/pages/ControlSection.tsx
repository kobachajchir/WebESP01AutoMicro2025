// src/pages/Control.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ToggleButton from "../components/toggleButton";
import MotorBlock, { type BlockKind } from "../components/MotorBlock";
import PageHeader from "../components/PageHeader";
import TimelineRow from "../components/TimelineRow";
import type { Block, Dir, TrackKey } from "../types/MotorTypes";
import Modal from "../components/modal";

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

  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState("");

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

  // === UI ===
  return (
    <div
      className="flex flex-col min-h-screen w-full items-center p-6 relative
                    bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100
                    selection:bg-cyan-500/30"
    >
      <style>{`@keyframes gradient-move{0%{background-position:0% 50%}100%{background-position:200% 50%}}`}</style>

      <PageHeader
        setOpenSettingsModal={setOpenSettingsModal}
        setOpenInfoModal={setOpenInfoModal}
      />

      {/* Timeline + controles */}
      <div className="rounded-2xl bg-white/5 backdrop-blur ring-1 ring-white/10 shadow-sm p-6 mb-6 w-full lg:max-w-10/12">
        <div className="flex items-center justify-between mb-4">
          <div className="text-2xl font-bold uppercase">Linea de tiempo</div>

          <div className="flex items-center gap-3">
            <ToggleButton
              checked={dualMode}
              onChange={() => {
                // si cambio de modo, detengo todo y limpio activos
                (["left", "right", "dual"] as TrackKey[]).forEach((t) =>
                  stopTrack(t)
                );
                // NO limpiar la selección (para no resetear el panel)
                setPairSelected(null); // limpiar highlight pareado
                setDualMode((p) => !p);
                // resetear tipo seleccionado (y pivot queda oculto en dual)
                setPaletteKind("hold");
              }}
              ariaLabel="Activar modo dual"
              size="md"
              labels
              labelOn="Modo Dual"
              labelOff="Modo Simple"
              labelClassName="text-lg"
            />
          </div>
        </div>

        <div className="flex flex-col gap-10 my-8">
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
                  // Actualizar el bloque en tu estado
                  updateBlockLabelAdvanced(blockId, newLabel);
                }}
              />
              <div className="flex justify-end -mt-2">
                <button
                  onClick={() =>
                    isPlayingDual ? stopTrack("dual") : startTrack("dual")
                  }
                  disabled={blocksDual.length === 0}
                  className={`group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold transition-all duration-300
                    ${
                      isPlayingDual
                        ? "btn-danger hover:text-slate-900 text-white hover:shadow-[inset_0_0_0_2px_theme('colors.red.400')] hover:outline-none hover:ring-2 hover:ring-slate-900 bg-red-400"
                        : "btn-success hover:text-slate-900 text-white hover:shadow-[inset_0_0_0_2px_theme('colors.emerald.400')] hover:outline-none hover:ring-2 hover:ring-slate-900 bg-emerald-400/20 hover:bg-emerald-400"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed`}
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
                        className="size-6"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Stop
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
                      Play
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
                    // Actualizar el bloque en tu estado
                    updateBlockLabelAdvanced(blockId, newLabel);
                  }}
                />
                <div className="flex justify-center lg:justify-end">
                  <button
                    onClick={() =>
                      isPlayingLeft ? stopTrack("left") : startTrack("left")
                    }
                    disabled={blocksLeft.length === 0}
                    className={`group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold transition-all duration-300
                      ${
                        isPlayingLeft
                          ? "btn-danger hover:text-slate-900 text-white hover:shadow-[inset_0_0_0_2px_theme('colors.red.400')] hover:outline-none hover:ring-2 hover:ring-slate-900 bg-red-400"
                          : "btn-success hover:text-slate-900 text-white hover:shadow-[inset_0_0_0_2px_theme('colors.emerald.400')] hover:outline-none hover:ring-2 hover:ring-slate-900 bg-emerald-400/20 hover:bg-emerald-400"
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed`}
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
                          className="size-6"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Stop
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
                        Play
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
                    // Actualizar el bloque en tu estado
                    updateBlockLabelAdvanced(blockId, newLabel);
                  }}
                />
                <div className="flex justify-center lg:justify-end">
                  <button
                    onClick={() =>
                      isPlayingRight ? stopTrack("right") : startTrack("right")
                    }
                    disabled={blocksRight.length === 0}
                    className={`group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold transition-all duration-300
                      ${
                        isPlayingRight
                          ? "btn-danger hover:text-slate-900 text-white hover:shadow-[inset_0_0_0_2px_theme('colors.red.400')] hover:outline-none hover:ring-2 hover:ring-slate-900 bg-red-400"
                          : "btn-success hover:text-slate-900 text-white hover:shadow-[inset_0_0_0_2px_theme('colors.emerald.400')] hover:outline-none hover:ring-2 hover:ring-slate-900 bg-emerald-400/20 hover:bg-emerald-400"
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed`}
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
                          className="size-6"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Stop
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
                        Play
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Selector + Propiedades */}
      <div className="w-full lg:max-w-10/12 flex flex-col lg:flex-row gap-6">
        {/* Selector */}
        <div className="order-last lg:order-first flex-1 rounded-2xl bg-white/5 backdrop-blur ring-1 ring-white/10 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xl font-bold uppercase">
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
            <div className="flex items-center gap-3">
              <button
                onClick={onAddBlock}
                className="btn-green group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white
                           transition-all duration-300 hover:text-slate-900 bg-green-400/50
                           hover:shadow-[inset_0_0_0_2px_theme('colors.green.400')]
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
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

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(
              (dualMode
                ? (["ramp", "hold", "arc", "stop"] as BlockKind[]) // sin pivot en dual
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
                // Solo marca tipo seleccionado en la paleta
                selected={paletteKind === k}
                // Indicio visual (pivot puede estar oculto en dual)
                pairSelected={
                  Boolean(pairSelected) &&
                  k === "pivot" &&
                  selection?.track !== "dual"
                }
                onClick={() => {
                  if (selectionLocked) return;
                  if (k === paletteKind) {
                    setPaletteKind(null); // desmarcar y dejar vacio
                  } else {
                    setPaletteKind(k); // sólo marcar, no agregar ni seleccionar timeline
                  }
                }}
              />
            ))}
          </div>
        </div>

        {/* Propiedades */}
        <div
          className={`w-full ${
            !selected && "hidden lg:block"
          } lg:max-w-sm rounded-2xl bg-white/5 backdrop-blur ring-1 ring-white/10 shadow-sm p-6 ${
            !selection && "opacity-50"
          }`}
        >
          <div className="text-xl font-bold mb-4 uppercase">
            Propiedades del bloque
          </div>

          <div className="mb-2 text-sm text-slate-300">
            Tipo:{" "}
            <span className="font-semibold text-slate-100">
              {selected ? labelES[selected.kind] : "—"}
            </span>
          </div>

          <div className="mb-4">
            <span className="text-sm text-slate-300 mr-2">Track:</span>
            <span className="inline-flex items-center rounded-xl px-2 py-1 bg-white/10 ring-1 ring-white/10 text-slate-100 text-xs">
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
            <label className="block mb-1 text-sm text-slate-300">
              Duración (ms)
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl bg-white/10 text-slate-100 placeholder-slate-400 ring-1 ring-white/10 p-2.5
                         focus:outline-none focus:ring-2 focus:ring-slate-400/40"
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
                className="w-full rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
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
                    className="w-20 rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
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
                    className="w-20 rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
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
                    className="w-20 rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
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
                  className="w-full rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  value={arcSide}
                  onChange={(e) => setArcSide(Number(e.target.value) as 0 | 1)}
                >
                  <option value={0}>Izquierda</option>
                  <option value={1}>Derecha</option>
                </select>
              </div>
            )}

          {/* Guardar cambios */}
          <div className="flex items-center justify-between mt-2">
            <button
              className="group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold
                         transition-all duration-300 hover:text-slate-900 bg-indigo-600 hover:ring-indigo-400 hover:ring-2
                         hover:shadow-[inset_0_0_0_2px_theme('colors.white.400')]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
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
              className="btn-danger group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white
                         transition-all duration-300 hover:text-slate-900 bg-red-600 hover:ring-red-400 hover:ring-2
                         hover:shadow-[inset_0_0_0_2px_theme('colors.red.400')]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40
                         disabled:opacity-50 disabled:cursor-not-allowed"
              title="Eliminar bloque seleccionado"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
      {openInfoModal && (
        <Modal
          isOpen={openInfoModal}
          onClose={() => setOpenInfoModal(false)}
          closeOnOverlayClick={false}
        >
          <h2 className="text-2xl font-bold mb-4 text-slate-900">
            Control de Motores
          </h2>

          <p className="mb-3 text-black leading-relaxed">
            Desde esta sección podés diseñar y probar rutinas de movimiento para
            los motores. La línea de tiempo se compone de{" "}
            <strong>bloques</strong> (Ramp, Hold, Arc, Pivot, Stop) que se
            reproducen de izquierda a derecha. Cada bloque tiene propiedades
            propias (duración, velocidad, dirección y parámetros específicos)
            que podés ajustar en el panel lateral.
          </p>

          <ul className="mb-4 space-y-2 text-black">
            <li>
              <span className="font-semibold">Modos:</span>{" "}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs
                     bg-indigo-500 text-white ring-1 ring-indigo-500/20"
              >
                Simple
              </span>{" "}
              control independiente (izquierdo / derecho), y{" "}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs
                     bg-emerald-600 text-white ring-1 ring-emerald-500/20"
              >
                Dual
              </span>{" "}
              para accionar ambos motores con la misma secuencia.
            </li>
            <li>
              <span className="font-semibold">Línea de tiempo:</span> cada
              bloque muestra su duración relativa como ancho. El progreso de
              reproducción se visualiza con una barra inferior y un indicador en
              el bloque activo.
            </li>
            <li>
              <span className="font-semibold">Edición de bloques:</span>{" "}
              seleccioná un bloque para editar sus propiedades. La vista se
              actualiza en vivo (ancho por duración y altura por
              velocidad/forma).
            </li>
            <li>
              <span className="font-semibold">Selector de tipos:</span> elegí el
              tipo en la paleta; el botón <em>Agregar</em> inserta un nuevo
              bloque del tipo seleccionado. En modo Dual no se muestran opciones
              no compatibles (p. ej. Pivot pareado).
            </li>
            <li>
              <span className="font-semibold">Reordenar:</span> arrastrá y soltá
              bloques para reordenarlos en la línea de tiempo. El ancho relativo
              se conserva según la duración actual de cada bloque.
            </li>
            <li>
              <span className="font-semibold">Reproducción:</span> podés
              reproducir por track (Izquierdo, Derecho) o en Dual. Cambiar de
              modo detiene la reproducción activa para evitar estados
              inconsistentes.
            </li>
          </ul>

          <div
            className="rounded-xl bg-white/70 dark:bg-neutral-900/50
             ring-1 ring-black/5 dark:ring-white/10 shadow-sm backdrop-blur p-3
             text-xs text-black"
          >
            <p className="m-0">
              <span className="font-semibold">Tip:</span> usá valores de
              duración razonables para mantener la vista fluida (p. ej. 300 -
              1500&nbsp;ms por bloque). Si editás “Ramp”, definí <em>Desde</em>{" "}
              y <em>Hasta</em> en % (0 - 100). En “Hold/Arc/Pivot”, la velocidad
              escala la altura del bloque.
            </p>
          </div>
        </Modal>
      )}

      {openSettingsModal && (
        <Modal
          isOpen={openSettingsModal}
          onClose={() => setOpenSettingsModal(false)}
          closeOnOverlayClick={false}
        >
          <h2 className="text-2xl font-bold mb-4 text-black">Configuración</h2>

          <div className="flex flex-row gap-4 text-black w-full items-center justify-center my-4">
            <p className="text-lg">Reiniciar ESP01</p>
            <button
              className="btn-indigo group relative inline-flex items-center gap-2 rounded-xl py-2 font-medium text-white
                               transition-all duration-300 hover:text-slate-900
                               hover:shadow-[inset_0_0_0_1px_theme('colors.indigo.400')]
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 estado-btn px-5"
              onClick={() => console.log("Reiniciar ESP01")}
            >
              Enviar
            </button>
          </div>

          <div className="flex flex-row gap-4 text-black w-full items-center justify-center my-4">
            <p className="text-lg">Resetear configuración</p>
            <button
              className="btn-danger group relative inline-flex items-center gap-2 rounded-xl py-2 font-medium text-white
                               transition-all duration-300 hover:text-slate-900
                               hover:shadow-[inset_0_0_0_1px_theme('colors.red.400')]
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 estado-btn px-5"
              onClick={() => console.log("Resetear configuracion")}
            >
              Enviar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
