// src/pages/Control.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import ToggleButton from "../components/toggleButton";
import MotorBlock, { type BlockKind } from "../components/MotorBlock";
import PageHeader from "../components/PageHeader";
import TimelineRow from "../components/TimelineRow";
import type { Block, Dir, TrackKey } from "../types/MotorTypes";

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

const TICK_MS = 50;

// Props persistidas por bloque + pairing para pivots en modo simple
type BlockProps = {
  durationMs: number;
  speed?: number;
  fromPct?: number;
  toPct?: number;
  rampDn?: number;
  arcSide?: 0 | 1;
  pivotBaseDir?: Dir;
  brake?: boolean;
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

  const getDefaultPropsFor = (b: Block): BlockProps => ({
    durationMs: b.durationMs ?? 700,
    speed: b.speed ?? 60,
    fromPct: 60,
    toPct: 80,
    rampDn: 140,
    arcSide: 0,
    pivotBaseDir: 0,
    brake: false,
  });

  // === ESTADO DEL PANEL (se carga al seleccionar) ===
  const [durationMs, setDurationMs] = useState<number>(700);
  const [speed, setSpeed] = useState<number>(60);
  const [direction, setDirection] = useState<Dir>(0);
  const [fromPct, setFromPct] = useState<number>(60);
  const [toPct, setToPct] = useState<number>(80);
  const [rampDn, setRampDn] = useState<number>(140);
  const [arcSide, setArcSide] = useState<0 | 1>(0);
  const [pivotBaseDir, setPivotBaseDir] = useState<Dir>(0);
  const [brake, setBrake] = useState<boolean>(false);

  // Cargar props al seleccionar
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
    setSpeed(p.speed ?? blk.speed ?? 60);
    setDirection((blk as any).direction ?? 0);
    setFromPct(p.fromPct ?? 60);
    setToPct(p.toPct ?? 80);
    setRampDn(p.rampDn ?? 140);
    setArcSide((p.arcSide ?? 0) as 0 | 1);
    setPivotBaseDir(p.pivotBaseDir ?? 0);
    setBrake(p.brake ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.id]);

  // === DURACIÓN TOTAL POR TRACK ===
  const totalMsLeft = useMemo(
    () => blocksLeft.reduce((a, b) => a + Math.max(0, b.durationMs), 0) || 1,
    [blocksLeft]
  );
  const totalMsRight = useMemo(
    () => blocksRight.reduce((a, b) => a + Math.max(0, b.durationMs), 0) || 1,
    [blocksRight]
  );
  const totalMsDual = useMemo(
    () => blocksDual.reduce((a, b) => a + Math.max(0, b.durationMs), 0) || 1,
    [blocksDual]
  );

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
    // Importante: NO tocamos selección al reproducir
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

    const nextId = list[i + 1]?.id ?? null;
    console.log(`[${t}] start block`, {
      id: b.id,
      index: i,
      durationMs: b.durationMs,
      direction: b.direction,
      speed: b.speed,
      startAt: now,
      nextId,
    });

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

  // === ALTAS/BAJAS ===
  const currentTrackForCreate: TrackKey =
    selection?.track ?? (dualMode ? "dual" : "left");

  const onAddBlock = () => {
    const t = dualMode ? "dual" : currentTrackForCreate;
    const b: Block = {
      id: uid(),
      kind: "hold",
      label: "Hold",
      durationMs: 500,
      speed: 50,
      direction: 0 as Dir,
    } as any;
    setBlocks(t)((prev) => [...prev, b]);
    setBlockProps((prev) => ({ ...prev, [b.id]: getDefaultPropsFor(b) }));
    attemptSelect(t, b.id);
  };

  // === Paleta: crear PIVOT pareado (simple mode) con dirección invertida ===
  const createPairedPivot = () => {
    // No permitir durante reproducción
    if (selectionLocked) return;
    if (dualMode) {
      // En dual sólo uno
      const nb: Block = {
        id: uid(),
        kind: "pivot",
        label: "Pivot",
        durationMs: 500,
        speed: 50,
        direction: 0 as Dir,
      } as any;
      setBlocks("dual")((prev) => [...prev, nb]);
      setBlockProps((prev) => ({ ...prev, [nb.id]: getDefaultPropsFor(nb) }));
      attemptSelect("dual", nb.id);
      return;
    }
    // Modo simple: insertar en ambos con direcciones opuestas y mismo pairId
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
    const maybePairId = blockProps[id]?.pivotPairId;
    if (maybePairId && track !== "dual") {
      const otherTrack: TrackKey = track === "left" ? "right" : "left";
      setBlocks(otherTrack)((prev) =>
        prev.filter((b) => blockProps[b.id]?.pivotPairId !== maybePairId)
      );
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

  const derivedTargetLabel = !selection
    ? "—"
    : selection.track === "left"
    ? "Izquierdo"
    : selection.track === "right"
    ? "Derecho"
    : "Ambos";

  // === UI ===
  return (
    <div
      className="flex flex-col min-h-screen w-full items-center p-6 relative
                    bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100
                    selection:bg-cyan-500/30"
    >
      <style>{`@keyframes gradient-move{0%{background-position:0% 50%}100%{background-position:200% 50%}}`}</style>

      <PageHeader setOpenSettingsModal={() => {}} setOpenInfoModal={() => {}} />

      {/* Timeline + controles */}
      <div className="w-full rounded-2xl bg-white/5 backdrop-blur ring-1 ring-white/10 shadow-sm p-6 mb-6 max-w-11/12">
        <div className="flex items-center justify-between mb-4">
          <div className="text-2xl font-bold uppercase">Linea de tiempo</div>

          <div className="flex items-center gap-3">
            <ToggleButton
              checked={dualMode}
              onChange={() => {
                // si cambio de modo, detengo todo y limpio activos
                ["left", "right", "dual"].forEach((t) =>
                  stopTrack(t as TrackKey)
                );
                setSelection(null);
                setPairSelected(null); // limpiar highlight pareado
                setDualMode((p) => !p);
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
                title="Ambos"
                track="dual"
                blocks={blocksDual}
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
                        ? "btn-danger text-slate-900 hover:text-white hover:shadow-[inset_0_0_0_2px_theme('colors.red.400')] hover:outline-none hover:ring-2 hover:ring-white bg-red-400"
                        : "btn-success text-slate-900 hover:text-white hover:shadow-[inset_0_0_0_2px_theme('colors.emerald.400')] hover:outline-none hover:ring-2 hover:ring-white bg-emerald-400"
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
                        className="size-5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M6.75 5.25A.75.75 0 0 0 6 6v12a.75.75 0 0 0 1.5 0V6a.75.75 0 0 0-.75-.75Z" />
                        <path d="M15 5.25a.75.75 0 0 1 .75.75v12a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Z" />
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
                  title="Izquierdo"
                  track="left"
                  blocks={blocksLeft}
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
                />
                <div className="flex justify-end">
                  <button
                    onClick={() =>
                      isPlayingLeft ? stopTrack("left") : startTrack("left")
                    }
                    disabled={blocksLeft.length === 0}
                    className={`group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold transition-all duration-300
                      ${
                        isPlayingLeft
                          ? "btn-danger text-slate-900 hover:text-white hover:shadow-[inset_0_0_0_2px_theme('colors.red.400')] hover:outline-none hover:ring-2 hover:ring-white bg-red-400"
                          : "btn-success text-slate-900 hover:text-white hover:shadow-[inset_0_0_0_2px_theme('colors.emerald.400')] hover:outline-none hover:ring-2 hover:ring-white bg-emerald-400"
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
                          className="size-5"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M6.75 5.25A.75.75 0 0 0 6 6v12a.75.75 0 0 0 1.5 0V6a.75.75 0 0 0-.75-.75Z" />
                          <path d="M15 5.25a.75.75 0 0 1 .75.75v12a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Z" />
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
                  title="Derecho"
                  track="right"
                  blocks={blocksRight}
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
                />
                <div className="flex justify-end">
                  <button
                    onClick={() =>
                      isPlayingRight ? stopTrack("right") : startTrack("right")
                    }
                    disabled={blocksRight.length === 0}
                    className={`group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold transition-all duration-300
                      ${
                        isPlayingRight
                          ? "btn-danger text-slate-900 hover:text-white hover:shadow-[inset_0_0_0_2px_theme('colors.red.400')] hover:outline-none hover:ring-2 hover:ring-white bg-red-400"
                          : "btn-success text-slate-900 hover:text-white hover:shadow-[inset_0_0_0_2px_theme('colors.emerald.400')] hover:outline-none hover:ring-2 hover:ring-white bg-emerald-400"
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
                          className="size-5"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M6.75 5.25A.75.75 0 0 0 6 6v12a.75.75 0 0 0 1.5 0V6a.75.75 0 0 0-.75-.75Z" />
                          <path d="M15 5.25a.75.75 0 0 1 .75.75v12a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Z" />
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
      <div className="w-full max-w-11/12 flex flex-row gap-6">
        {/* Selector */}
        <div className="flex-1 rounded-2xl bg-white/5 backdrop-blur ring-1 ring-white/10 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xl font-semibold">
              Selector de bloques (
              {selection
                ? selection.track === "dual"
                  ? "Dual"
                  : selection.track === "left"
                  ? "Izquierdo"
                  : "Derecho"
                : dualMode
                ? "Dual"
                : "Izquierdo"}
              )
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onAddBlock}
                className="btn-indigo group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white
                           transition-all duration-300 hover:text-slate-900
                           hover:shadow-[inset_0_0_0_2px_theme('colors.indigo.400')]
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
            {(["ramp", "hold", "pivot", "arc", "stop"] as BlockKind[]).map(
              (k) => (
                <MotorBlock
                  key={k}
                  kind={k}
                  selected={selected?.kind === k}
                  // Indicio visual en el tile "PIVOTE" si hay un par seleccionado en timeline
                  pairSelected={
                    Boolean(pairSelected) &&
                    k === "pivot" &&
                    selected?.kind === "pivot" &&
                    selection?.track !== "dual"
                  }
                  onClick={() => {
                    if (selectionLocked) return;

                    if (k === "pivot" && !dualMode) {
                      createPairedPivot();
                      return;
                    }

                    const t = selection?.track ?? (dualMode ? "dual" : "left");
                    const list = getBlocks(t);
                    const existing = list.find((b) => b.kind === k);
                    if (existing) {
                      attemptSelect(t, existing.id);
                    } else {
                      const nb: Block = {
                        id: uid(),
                        kind: k,
                        label: k.charAt(0).toUpperCase() + k.slice(1),
                        durationMs: 500,
                        direction: 0 as Dir,
                        speed: k === "stop" ? undefined : 50,
                      } as any;
                      setBlocks(t)((prev) => [...prev, nb]);
                      setBlockProps((prev) => ({
                        ...prev,
                        [nb.id]: getDefaultPropsFor(nb),
                      }));
                      attemptSelect(t, nb.id);
                    }
                  }}
                />
              )
            )}
          </div>
        </div>

        {/* Propiedades */}
        <div
          className={`w-full max-w-sm rounded-2xl bg-white/5 backdrop-blur ring-1 ring-white/10 shadow-sm p-6 ${
            !selection && "opacity-50"
          }`}
        >
          <div className="text-xl font-semibold mb-4">
            Propiedades del bloque
          </div>

          <div className="mb-2 text-sm text-slate-300">
            Track:{" "}
            <span className="font-semibold text-slate-100">
              {selection
                ? selection.track === "dual"
                  ? "Dual"
                  : selection.track === "left"
                  ? "Izquierdo"
                  : "Derecho"
                : "—"}
            </span>
          </div>

          <div className="mb-2 text-sm text-slate-300">
            Tipo:{" "}
            <span className="font-semibold text-slate-100">
              {selected ? selected.kind.toUpperCase() : "—"}
            </span>
          </div>

          <div className="mb-4">
            <span className="text-sm text-slate-300 mr-2">
              Target (derivado):
            </span>
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

                  // Si es pivot en modo simple y tiene par, actualizar inmediatamente la dirección invertida del par
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

              <div className="mb-3">
                <label className="block mb-1 text-sm text-slate-300">
                  Ramp Down (ms)
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                  value={rampDn}
                  onChange={(e) => setRampDn(Number(e.target.value))}
                />
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

          {/* Freno */}
          {selected && (
            <div className="mb-4 flex items-center gap-3">
              <input
                id="brake"
                type="checkbox"
                className="h-4 w-4 rounded-md"
                checked={brake}
                onChange={(e) => setBrake(e.target.checked)}
              />
              <label htmlFor="brake" className="text-sm text-slate-300">
                {selected.kind === "stop"
                  ? "Aplicar freno al detener"
                  : "Aplicar freno al finalizar"}
              </label>
            </div>
          )}

          {/* Guardar cambios */}
          <div className="flex items-center justify-between mt-2">
            <button
              className="group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold
                         transition-all duration-300 hover:text-slate-900
                         hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')]
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
                      rampDn,
                      arcSide,
                      pivotBaseDir,
                      brake,
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

                // Actualizar el bloque seleccionado
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
                         transition-all duration-300 hover:text-slate-900
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
    </div>
  );
}
