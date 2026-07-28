// src/components/TimelineRow.tsx
import React, { useState } from "react";
import type { Block, TrackKey } from "../types/MotorTypes";
import type { BlockKind } from "./MotorBlock";

import {
  DndContext,
  closestCenter,
  pointerWithin,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type MinimalBlockProps = {
  fromPct?: number;
  toPct?: number;
  speed?: number;
};

interface TimelineRowProps {
  title: string;
  track: TrackKey;
  blocks: Block[];
  totalMs: number;
  kindColor: Record<BlockKind, string>;
  activeIndex: number;
  activeProgress: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** IDs a resaltar (ej: par de pivot en el otro track) */
  highlightIds?: string[];
  /** Props por bloque para dibujar formas (from/to/speed). Opcional. */
  blockProps?: Record<string, MinimalBlockProps>;
  /** Callback al soltar para persistir nuevo orden en el track */
  onReorder: (newOrder: Block[]) => void;
  /** Deshabilita DnD (ej: cuando se está reproduciendo) */
  dndDisabled?: boolean;
  /** Callback para actualizar el label de un bloque */
  onUpdateLabel?: (blockId: string, newLabel: string) => void;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clampPct = (v: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, v));
const MIN_SCALE = 0.3; // altura mínima como fracción para que no desaparezcan

function timelineToneClass(kind: BlockKind, highlighted: boolean, active: boolean) {
  const selected = active
    ? {
        ramp: "border-amber-200 bg-amber-500 text-white shadow-[0_0_0_2px_rgba(251,191,36,0.22),0_14px_30px_rgba(245,158,11,0.28)]",
        hold: "border-emerald-200 bg-emerald-500 text-white shadow-[0_0_0_2px_rgba(52,211,153,0.22),0_14px_30px_rgba(16,185,129,0.26)]",
        pivot: "border-sky-200 bg-sky-500 text-white shadow-[0_0_0_2px_rgba(56,189,248,0.22),0_14px_30px_rgba(14,165,233,0.26)]",
        arc: "border-indigo-200 bg-indigo-500 text-white shadow-[0_0_0_2px_rgba(129,140,248,0.22),0_14px_30px_rgba(99,102,241,0.28)]",
        stop: "border-rose-200 bg-rose-500 text-white shadow-[0_0_0_2px_rgba(251,113,133,0.22),0_14px_30px_rgba(244,63,94,0.28)]",
      }
    : {
        ramp: "border-amber-400 bg-amber-700 text-amber-50",
        hold: "border-emerald-400 bg-emerald-700 text-emerald-50",
        pivot: "border-sky-400 bg-sky-700 text-sky-50",
        arc: "border-indigo-400 bg-indigo-700 text-indigo-50",
        stop: "border-rose-400 bg-rose-700 text-rose-50",
      };

  const highlight = highlighted
    ? "shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_0_0_4px_rgba(56,189,248,0.10)]"
    : "";

  return `${selected[kind]} ${highlight}`;
}

// Formas por tipo
function getBlockStyles(
  block: Block,
  p?: MinimalBlockProps
): React.CSSProperties {
  switch (block.kind) {
    case "ramp": {
      // Altura: usamos el mayor entre from/to para que respete escala general
      const from = clampPct(p?.fromPct ?? 60);
      const to = clampPct(p?.toPct ?? 80);
      const scale = Math.max(from, to) / 100;
      const topLeft = 100 - from; // y=0 arriba
      const topRight = 100 - to;

      return {
        clipPath: `polygon(0% ${topLeft}%, 100% ${topRight}%, 100% 100%, 0% 100%)`,
        borderRadius: "0",
        height: `${clamp01(Math.max(scale, MIN_SCALE)) * 100}%`,
      };
    }

    case "arc": {
      const sp = p?.speed ?? (block as any).speed ?? 70;
      const scale = clamp01(Math.max(sp / 100, 0.05));
      const arcIntensity = Math.min(sp / 100, 1);
      const borderRadiusValue = `${50 + arcIntensity * 50}% ${
        50 + arcIntensity * 50
      }% 0% 0%`;
      return {
        borderRadius: borderRadiusValue,
        clipPath: "none",
        height: `${scale * 100}%`,
      };
    }

    case "hold": {
      const sp = p?.speed ?? (block as any).speed ?? 80;
      const scale = clamp01(Math.max(sp / 100, 0.05));
      return {
        clipPath: "none",
        height: `${scale * 100}%`,
      };
    }

    case "pivot": {
      // Visual rectangular, escalada por velocidad (igual a hold)
      const sp = p?.speed ?? (block as any).speed ?? 60;
      const scale = clamp01(Math.max(sp / 100, 0.05));
      return {
        clipPath: "none",
        height: `${scale * 100}%`,
      };
    }

    case "stop": {
      // Marca una discontinuidad: segmentos ascendentes sin continuidad física.
      return {
        clipPath: "none",
        borderRadius: "0.2rem",
        height: "54%",
        opacity: 0.84,
        backgroundColor: "rgba(244, 63, 94, 0.18)",
        backgroundImage:
          "repeating-linear-gradient(to top, rgba(251, 113, 133, 0.92) 0 8px, transparent 8px 14px)",
      };
    }

    default:
      return {
        clipPath: "none",
        borderRadius: "0.75rem 0.75rem 0 0",
        height: "100%",
      };
  }
}

/* ================= Sortable item ================= */
function SortableBlock({
  b,
  wPct,
  isActive,
  isPast,
  isSelected,
  isHighlighted,
  fill,
  onSelect,
  shapeStyles,
  title,
  disabled,
  onUpdateLabel,
}: {
  b: Block;
  wPct: string;
  isActive: boolean;
  isPast: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  fill: number;
  onSelect: (id: string | null) => void;
  shapeStyles: React.CSSProperties;
  title: string;
  disabled: boolean;
  onUpdateLabel?: (newLabel: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: b.id, disabled });

  // Estado local para la edición de labels
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editValue, setEditValue] = useState("");
  const isReverse = b.direction === 1;
  const directionLabel = isReverse ? "ATRÁS" : "ADELANTE";

  const wrapperStyle: React.CSSProperties = {
    width: wPct,
    flex: `0 0 ${wPct}`,
    minWidth: 92,
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.22 : 1,
    zIndex: isDragging ? 10 : undefined,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100%",
  };

  const handleStartEdit = () => {
    setEditValue(b.label);
    setIsEditingLabel(true);
  };

  const handleFinishEdit = () => {
    if (editValue !== b.label) {
      onUpdateLabel?.(editValue);
    }
    setIsEditingLabel(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFinishEdit();
    } else if (e.key === "Escape") {
      setEditValue(b.label); // Revertir cambios
      setIsEditingLabel(false);
    }
  };

  return (
    <div ref={setNodeRef} style={wrapperStyle} className="group">
      {/* Cabecera */}
      <div className="mb-2 flex flex-col items-center select-none">
        {isEditingLabel ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleFinishEdit}
            onKeyDown={handleKeyDown}
            className="app-input w-full rounded-md px-1 py-0.5 text-center text-xs text-white"
            autoFocus
          />
        ) : (
          <div
            className="w-full truncate rounded-md px-1 text-center text-sm font-semibold text-slate-100 transition-colors hover:bg-white/8"
            onClick={handleStartEdit}
          >
            {b.label}
          </div>
        )}
        <div className="flex w-full items-center justify-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400">
            {b.durationMs} ms
          </span>
          {b.kind !== "stop" ? (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[9px] font-black tracking-wide ${
                isReverse
                  ? "border-rose-300/45 bg-rose-500/15 text-rose-200"
                  : "border-emerald-300/45 bg-emerald-500/15 text-emerald-200"
              }`}
              title={`Movimiento hacia ${directionLabel.toLocaleLowerCase("es-AR")}`}
            >
              <span aria-hidden="true">{isReverse ? "↓" : "↑"}</span>
              {directionLabel}
            </span>
          ) : null}
        </div>
      </div>

      {/* Bloque */}
      <button
        {...attributes}
        {...listeners}
        className="relative flex h-20 touch-none items-end hover:cursor-grab active:cursor-grabbing"
        onClick={() => onSelect(isSelected ? null : b.id)}
        aria-pressed={isSelected}
        title={title}
      >
        <div
          className={`relative flex w-full items-center justify-center overflow-hidden border transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 ${timelineToneClass(
            b.kind,
            isHighlighted,
            isSelected || isActive,
          )}`}
          style={shapeStyles}
          data-kind={b.kind}
        >
          {b.kind === "pivot" ? (
            b.direction === 1 ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-4"
              >
                <path
                  fillRule="evenodd"
                  d="M9.53 2.47a.75.75 0 0 1 0 1.06L4.81 8.25H15a6.75 6.75 0 0 1 0 13.5h-3a.75.75 0 0 1 0-1.5h3a5.25 5.25 0 1 0 0-10.5H4.81l4.72 4.72a.75.75 0 1 1-1.06 1.06l-6-6a.75.75 0 0 1 0-1.06l6-6a.75.75 0 0 1 1.06 0Z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-4"
              >
                <path
                  fillRule="evenodd"
                  d="M14.47 2.47a.75.75 0 0 1 1.06 0l6 6a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 1 1-1.06-1.06l4.72-4.72H9a5.25 5.25 0 1 0 0 10.5h3a.75.75 0 0 1 0 1.5H9a6.75 6.75 0 0 1 0-13.5h10.19l-4.72-4.72a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            )
          ) : null}

        </div>

        {isActive && (
          <div className="absolute inset-x-1 top-1 z-20 flex items-center justify-between gap-1 rounded-md border border-cyan-200/70 bg-slate-950/90 px-2 py-1 text-[9px] font-black text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.45)] backdrop-blur-sm">
            <span className="flex min-w-0 items-center gap-1">
              <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.95)]" />
              <span className="truncate">EN EJECUCIÓN</span>
            </span>
            <span className="shrink-0 tabular-nums text-white">
              {Math.round(clamp01(fill) * 100)}%
            </span>
          </div>
        )}
      </button>

      {/* Progreso (SIEMPRE visible, también para stop) */}
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
        <div
          className={`h-full transition-all duration-300 ${
            isPast || isActive ? "bg-cyan-300" : "bg-white/20"
          }`}
          style={{ width: `${fill * 100}%` }}
        />
      </div>
    </div>
  );
}

function TrackBadge({ track }: { track: TrackKey }) {
  const label = track === "left" ? "L" : track === "right" ? "R" : "D";
  return (
    <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-cyan-200/55 bg-cyan-500/18 text-2xl font-black text-cyan-100 shadow-[0_0_26px_rgba(34,211,238,0.28),inset_0_1px_0_rgba(255,255,255,0.18)]">
      {label}
    </span>
  );
}

function TrackMetric({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="min-w-[112px] rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className={active ? "text-sm font-black text-cyan-200" : "text-sm font-black text-slate-100"}>
        {value}
      </div>
    </div>
  );
}

/* ================= Componente principal (con DnD) ================= */
function TimelineRow({
  title,
  track,
  blocks,
  totalMs,
  kindColor,
  activeIndex,
  activeProgress,
  selectedId,
  onSelect,
  highlightIds = [],
  blockProps = {},
  onReorder,
  dndDisabled = false,
  onUpdateLabel,
}: TimelineRowProps) {
  void kindColor;
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 }, // empieza a arrastrar tras 8px
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 }, // long-press 150ms, tolerancia 5px
    })
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overlaySize, setOverlaySize] = useState<{
    w: number;
    h: number;
  } | null>(null);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const newOrder = arrayMove(blocks, oldIndex, newIndex);
    onReorder(newOrder);
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
        selectedId && blocks.some((b) => b.id === selectedId)
          ? "border-cyan-300/40 bg-cyan-500/10 shadow-[0_0_34px_rgba(34,211,238,0.10)]"
          : ""
      } ${
        !selectedId || !blocks.some((b) => b.id === selectedId)
          ? "border-cyan-300/16 bg-slate-950/42"
          : ""
      }`}
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <TrackBadge track={track} />
          <div>
            <h3 className="text-lg font-black uppercase tracking-wide text-white">
              {title}
            </h3>
            <p className="text-xs text-slate-400">
              Bloques temporales proporcionales a duración.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <TrackMetric label="Duración total" value={`${totalMs.toLocaleString("es-AR")} ms`} />
          <TrackMetric label="Bloques" value={`${blocks.length}`} />
          <TrackMetric
            label="Estado actual"
            value={activeIndex >= 0 ? "SIMULANDO" : selectedId ? "EDITANDO" : "LISTO"}
            active={activeIndex >= 0}
          />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          const pointerHits = pointerWithin(args);
          return pointerHits.length > 0 ? pointerHits : closestCenter(args);
        }}
        autoScroll={false}
        onDragStart={(e) => {
          setActiveId(String(e.active.id));
          const r = e.active.rect.current?.initial;
          if (r) setOverlaySize({ w: r.width, h: r.height });
          handleDragStart?.(e);
        }}
        onDragEnd={(e) => {
          setActiveId(null);
          setOverlaySize(null);
          handleDragEnd?.(e);
        }}
        onDragCancel={() => {
          setActiveId(null);
          setOverlaySize(null);
        }}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={horizontalListSortingStrategy}
        >
            <div className="relative flex h-36 w-full items-end gap-2 overflow-x-auto rounded-md border border-white/10 bg-black/20 px-6 pb-2 pt-3">
            {/* Marcadores absolutos 100% / 0% a la izquierda */}
            <div className="pointer-events-none absolute left-1 top-12 text-[10px] text-slate-400">
              100%
            </div>
            <div className="pointer-events-none absolute left-6 right-3 top-[4.75rem] border-t border-dashed border-slate-200/10" />
            <div className="pointer-events-none absolute left-1 bottom-4 text-[10px] text-slate-400">
              0%
            </div>

            {blocks.map((b, i) => {
              const w = `${(Math.max(0, b.durationMs) / totalMs) * 100}%`;
              const isActive = i === activeIndex;
              const isPast = i < activeIndex;
              const isSelected = selectedId === b.id;
              const isHighlighted = (highlightIds || []).includes(b.id);
              const fill = isPast ? 1 : isActive ? clamp01(activeProgress) : 0;
              const p = blockProps[b.id];

              return (
                <SortableBlock
                  key={b.id}
                  b={b}
                  wPct={w}
                  isActive={isActive}
                  isPast={isPast}
                  isSelected={isSelected}
                  isHighlighted={isHighlighted}
                  fill={fill}
                  onSelect={onSelect}
                  shapeStyles={getBlockStyles(b, p)}
                  title={`${b.kind} (${b.durationMs} ms)${
                    b.kind === "stop"
                      ? ""
                      : ` · ${b.direction === 1 ? "Atrás" : "Adelante"}`
                  }`}
                  disabled={!!dndDisabled}
                  onUpdateLabel={(newLabel: string) =>
                    onUpdateLabel?.(b.id, newLabel)
                  }
                />
              );
            })}
          </div>
        </SortableContext>

        {/* Ghost fijo al tamaño original durante el drag */}
        <DragOverlay dropAnimation={null}>
          {activeId
            ? (() => {
                const ab = blocks.find((x) => x.id === activeId);
                if (!ab) return null;
                return (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border border-cyan-200/70 bg-slate-950/95 px-3 py-2 text-xs text-white shadow-[0_20px_50px_rgba(0,0,0,0.55),0_0_24px_rgba(34,211,238,0.28)]"
                    style={{
                      width: overlaySize?.w ?? 140,
                      minWidth: 92,
                      height: Math.min(overlaySize?.h ?? 72, 86),
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-black">{ab.label}</span>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {ab.durationMs} ms
                      </span>
                    </span>
                    {ab.kind !== "stop" ? (
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-black ${
                          ab.direction === 1
                            ? "border-rose-300/45 text-rose-200"
                            : "border-emerald-300/45 text-emerald-200"
                        }`}
                      >
                        {ab.direction === 1 ? "ATRÁS" : "ADELANTE"}
                      </span>
                    ) : null}
                  </div>
                );
              })()
            : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default TimelineRow;
