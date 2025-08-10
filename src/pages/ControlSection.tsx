// src/pages/Control.tsx
import React, { use, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/modal";
import ToggleButton from "../components/toggleButton";
import MotorBlock from "../components/MotorBlock";

type Dir = 0 | 1;
type MotorTarget = "left" | "right" | "both";
type BlockKind = "ramp" | "hold" | "pivot" | "arc" | "stop";

interface Block {
  id: string;
  kind: BlockKind;
  label: string;
  durationMs: number;
  // Para demo: ancho relativo a la duración
  speed?: number; // 0..100 (hold/pivot/arc)
}

const uid = () => Math.random().toString(36).slice(2);

const initialBlocks: Block[] = [
  { id: uid(), kind: "ramp", label: "Ramp UP", durationMs: 800 },
  { id: uid(), kind: "hold", label: "Hold", durationMs: 600, speed: 60 },
  { id: uid(), kind: "arc", label: "Arc L", durationMs: 700, speed: 55 },
  { id: uid(), kind: "pivot", label: "Pivot R", durationMs: 500, speed: 50 },
  { id: uid(), kind: "ramp", label: "Ramp DN", durationMs: 900 },
  { id: uid(), kind: "stop", label: "Stop", durationMs: 0 },
];

const kindColor: Record<BlockKind, string> = {
  ramp: "bg-amber-500/80",
  hold: "bg-emerald-500/80",
  pivot: "bg-sky-500/80",
  arc: "bg-indigo-500/80",
  stop: "bg-rose-500/80",
};

const ControlSection: React.FC = () => {
  // Estado UI
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(
    blocks[0]?.id ?? null
  );

  const [openInfoModal, setOpenInfoModal] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);

  // Modo 1 o 2 motores
  const [dualMode, setDualMode] = useState(false);

  // “Progreso” demo: índice activo y progreso 0..1 del bloque activo
  const [activeIndex, setActiveIndex] = useState(2);
  const [activeProgress, setActiveProgress] = useState(0.45); // 45%

  // Propiedades (panel derecha)
  const [target, setTarget] = useState<MotorTarget>("both");
  const [dirL, setDirL] = useState<Dir>(0);
  const [dirR, setDirR] = useState<Dir>(0);
  const [durationMs, setDurationMs] = useState<number>(700);
  const [speed, setSpeed] = useState<number>(60);
  const [rampUp, setRampUp] = useState<number>(120);
  const [rampDn, setRampDn] = useState<number>(140);
  const [brake, setBrake] = useState<boolean>(false);

  // Cálculo de porcentajes de ancho por duración
  const totalMs = useMemo(
    () => blocks.reduce((acc, b) => acc + Math.max(0, b.durationMs), 0) || 1,
    [blocks]
  );

  const onAddBlock = () => {
    const b: Block = {
      id: uid(),
      kind: "hold",
      label: "Hold",
      durationMs: 500,
      speed: 50,
    };
    setBlocks((prev) => [...prev, b]);
    setSelectedId(b.id);
  };

  const onRemoveSelected = () => {
    if (!selectedId) return;
    setBlocks((prev) => prev.filter((b) => b.id !== selectedId));
    setSelectedId(null);
  };

  const selected = blocks.find((b) => b.id === selectedId) || null;

  const navigate = useNavigate();

  return (
    <div
      className="flex flex-col min-h-screen w-full items-center p-6 relative
                 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100
                 selection:bg-cyan-500/30"
    >
      <style>{`
        @keyframes gradient-move {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
      {/* Título */}
      <div className="flex flex-row items-center justify-between w-full mb-6">
        <h1 className="ml-6 text-4xl md:text-6xl font-extrabold uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400 bg-[length:200%_100%] motion-safe:animate-[gradient-move_6s_linear_infinite]">
          Control de Motores
        </h1>

        <div className="flex flex-row gap-2">
          <button
            aria-label="Ir a Home"
            className="toolbar-btn group flex items-center justify-center py-2 px-3 rounded-2xl transition-all duration-300 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            onClick={() => navigate("/home", { viewTransition: true })}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              className="size-6 transition-transform duration-300 group-hover:scale-110"
            >
              <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
              <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
            </svg>
          </button>
          <button
            aria-label="Configuración"
            className="toolbar-btn group flex items-center justify-center py-2 px-3 rounded-2xl transition-all duration-300 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            onClick={() => setOpenSettingsModal(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              className="size-6 transition-transform duration-300 group-hover:scale-110"
            >
              <path
                fillRule="evenodd"
                d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            aria-label="Información"
            className="toolbar-btn group flex items-center justify-center py-2 px-3 rounded-2xl transition-all duration-300 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            onClick={() => setOpenInfoModal(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              className="size-6 transition-transform duration-300 group-hover:scale-110"
            >
              <path
                fillRule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
      {/* Timeline (fila superior) */}
      <div className="w-full max-w-6xl rounded-2xl bg-white/5 backdrop-blur ring-1 ring-white/10 shadow-sm p-6 mb-6">
        {/* Encabezado: switch single/dual */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-xl font-semibold">Línea de tiempo</div>
          <label className="inline-flex items-center gap-3">
            <ToggleButton
              checked={dualMode}
              onChange={() => setDualMode((prev) => !prev)}
              ariaLabel="Activar modo dual"
              size="md"
              labels={true}
              labelOn="Modo Dual"
              labelOff="Modo Simple"
              labelClassName="text-lg"
            />
          </label>
        </div>

        {/* Track único para demo (si dual, podríamos duplicar la fila) */}
        <div className="flex flex-col gap-8 my-8">
          <div className="w-full overflow-x-auto items-center flex flex-row gap-4">
            <span className="w-24 text-center text-lg text-slate-200 uppercase font-semibold">
              {dualMode ? "Ambos" : "Izquierdo"}
            </span>
            <div className="relative w-full h-28 flex items-end gap-2">
              {blocks.map((b, i) => {
                const w = `${(Math.max(0, b.durationMs) / totalMs) * 100}%`;
                const isActive = i === activeIndex;
                const isPast = i < activeIndex;

                // Progreso barra inferior
                const fill = isPast
                  ? 1
                  : isActive
                  ? Math.max(0, Math.min(1, activeProgress))
                  : 0;

                return (
                  <div
                    key={b.id}
                    className="flex flex-col justify-between h-full"
                    style={{ width: w, minWidth: 48 }}
                  >
                    {/* Cabecera: etiqueta + duración arriba */}
                    <div className="flex flex-col items-center mb-1">
                      <div className="text-xs text-slate-300">{b.label}</div>
                      <div className="text-[11px] text-slate-400">
                        {b.durationMs} ms
                      </div>
                    </div>

                    {/* Bloque visual */}
                    <button
                      onClick={() => {
                        if (selectedId === b.id) {
                          setSelectedId(null);
                        } else {
                          setSelectedId(b.id);
                        }
                      }}
                      className={`relative h-16 ${
                        kindColor[b.kind]
                      } rounded-xl ring-1 ring-white/10 shadow-sm
                                transition-all duration-300 hover:-translate-y-1
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40
                                ${isActive ? "shadow-md" : ""} ${selectedId === b.id ? "bg-white" : ""}`}
                      title={`${b.kind} (${b.durationMs} ms)`}
                      aria-pressed={selectedId === b.id}
                    >
                      {/* Indicador activo */}
                      {isActive && (
                        <span className="absolute -top-2 right-2 text-[10px] px-2 py-[2px] rounded-full bg-yellow-400 text-slate-900 font-bold">
                          ACTIVO
                        </span>
                      )}
                    </button>

                    {/* Barra de progreso debajo */}
                    <div className="mt-1 h-2 w-full rounded-full bg-white/10 ring-1 ring-white/10 overflow-hidden">
                      <div
                        className={`h-full ${
                          isActive ? "bg-yellow-400" : "bg-cyan-400"
                        }`}
                        style={{ width: `${fill * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {!dualMode && (
            <div className="w-full overflow-x-auto items-center flex flex-row gap-4">
              <span className="w-24 text-center text-lg text-slate-200 uppercase font-semibold">
                {dualMode ? "Ambos" : "Derecho"}
              </span>
              <div className="relative w-full h-28 flex items-end gap-2">
                {blocks.map((b, i) => {
                  const w = `${(Math.max(0, b.durationMs) / totalMs) * 100}%`;
                  const isActive = i === activeIndex;
                  const isPast = i < activeIndex;

                  // Progreso barra inferior
                  const fill = isPast
                    ? 1
                    : isActive
                    ? Math.max(0, Math.min(1, activeProgress))
                    : 0;

                  return (
                    <div
                      key={b.id}
                      className="flex flex-col justify-between h-full"
                      style={{ width: w, minWidth: 48 }}
                    >
                      {/* Cabecera: etiqueta + duración arriba */}
                      <div className="flex flex-col items-center mb-1">
                        <div className="text-xs text-slate-300">{b.label}</div>
                        <div className="text-[11px] text-slate-400">
                          {b.durationMs} ms
                        </div>
                      </div>

                      {/* Bloque visual */}
                      <button
                        onClick={() => setSelectedId(b.id)}
                        className={`relative h-16 ${
                          kindColor[b.kind]
                        } rounded-xl ring-1 ring-white/10 shadow-sm
                                transition-all duration-300 hover:-translate-y-1
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40
                                ${isActive ? "shadow-md" : ""}`}
                        title={`${b.kind} (${b.durationMs} ms)`}
                        aria-pressed={selectedId === b.id}
                      >
                        {/* Indicador activo */}
                        {isActive && (
                          <span className="absolute -top-2 right-2 text-[10px] px-2 py-[2px] rounded-full bg-yellow-400 text-slate-900 font-bold">
                            ACTIVO
                          </span>
                        )}
                      </button>

                      {/* Barra de progreso debajo */}
                      <div className="mt-1 h-2 w-full rounded-full bg-white/10 ring-1 ring-white/10 overflow-hidden">
                        <div
                          className={`h-full ${
                            isActive ? "bg-yellow-400" : "bg-cyan-400"
                          }`}
                          style={{ width: `${fill * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Row inferior: selector (3/4) + propiedades (1/4) */}
      <div className="w-full max-w-6xl flex flex-row gap-6">
        {/* Selector (3/4) */}
        <div className="flex-1 rounded-2xl bg-white/5 backdrop-blur ring-1 ring-white/10 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xl font-semibold">Selector de bloques</div>
            <div className="flex items-center gap-3">
              <button
                onClick={onAddBlock}
                className="group relative inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:text-white hover:bg-blue-400/80"
                title="Agregar bloque"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-6"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V9Z"
                    clipRule="evenodd"
                  />
                </svg>
                Agregar
              </button>
              <button
                onClick={onRemoveSelected}
                disabled={!selectedId}
                className="group relative inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold
                           transition-all duration-300 text-white
                           hover:shadow-[inset_0_0_0_2px_theme('colors.rose.400')]
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40
                           disabled:opacity-50 disabled:cursor-not-allowed
                           hover:text-white hover:bg-red-400/80"
                title="Eliminar bloque seleccionado"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-6"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm3 10.5a.75.75 0 0 0 0-1.5H9a.75.75 0 0 0 0 1.5h6Z"
                    clipRule="evenodd"
                  />
                </svg>
                Eliminar
              </button>
            </div>
          </div>

          {/* Paleta simple (solo visual por ahora) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(["ramp", "hold", "pivot", "arc", "stop"] as BlockKind[]).map(
              (k) => (
                <MotorBlock
                  key={k}
                  kind={k}
                  selected={selected?.kind === k} // Compara si el bloque seleccionado es del mismo tipo
                  onClick={() => {
                    const existing = blocks.find((b) => b.kind === k);
                    if (existing) {
                      setSelectedId(existing.id);
                    } else {
                      const newBlock: Block = {
                        id: uid(),
                        kind: k,
                        label: k.charAt(0).toUpperCase() + k.slice(1),
                        durationMs: 500,
                      };
                      setBlocks((prev) => [...prev, newBlock]);
                      setSelectedId(newBlock.id);
                    }
                  }}
                />
              )
            )}
          </div>
        </div>

        {/* Propiedades (1/4) */}
        <div className="w-full max-w-sm rounded-2xl bg-white/5 backdrop-blur ring-1 ring-white/10 shadow-sm p-6">
          <div className="text-xl font-semibold mb-4">
            Propiedades del bloque
          </div>

          {/* Tipo seleccionado */}
          <div className="mb-2 text-sm text-slate-300">
            Tipo:{" "}
            <span className="font-semibold text-slate-100">
              {selected ? selected.kind.toUpperCase() : "—"}
            </span>
          </div>

          {/* Target (aplica a ramp/hold; en pivot/arc/stop es global) */}
          {selected &&
            (selected.kind === "ramp" || selected.kind === "hold") && (
              <div className="mb-3">
                <label className="block mb-1 text-sm text-slate-300">
                  Target
                </label>
                <select
                  className="w-full rounded-xl bg-white/10 text-slate-100 placeholder-slate-400 ring-1 ring-white/10 p-2.5
                   focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  value={target}
                  onChange={(e) => setTarget(e.target.value as MotorTarget)}
                >
                  <option value="both">Ambos</option>
                  <option value="left">Izquierdo</option>
                  <option value="right">Derecho</option>
                </select>
              </div>
            )}

          {/* Dirección por motor (solo cuando edita por-motor o ambos) */}
          {selected &&
            (selected.kind === "ramp" || selected.kind === "hold") && (
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-sm text-slate-300">
                    Dir Left
                  </label>
                  <select
                    className="w-full rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5
                     focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                    value={dirL}
                    onChange={(e) => setDirL(Number(e.target.value) as Dir)}
                  >
                    <option value={0}>Adelante</option>
                    <option value={1}>Atrás</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-sm text-slate-300">
                    Dir Right
                  </label>
                  <select
                    className="w-full rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5
                     focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                    value={dirR}
                    onChange={(e) => setDirR(Number(e.target.value) as Dir)}
                  >
                    <option value={0}>Adelante</option>
                    <option value={1}>Atrás</option>
                  </select>
                </div>
              </div>
            )}

          {/* DURACIÓN (común a todos) */}
          <div className="mb-3">
            <label className="block mb-1 text-sm text-slate-300">
              Duración (ms)
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl bg-white/10 text-slate-100 placeholder-slate-400 ring-1 ring-white/10 p-2.5
                 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
              value={durationMs}
              onChange={(e) => setDurationMs(Number(e.target.value))}
              placeholder="Ej: 700"
            />
          </div>

          {/* === PROPIEDADES ESPECÍFICAS SEGÚN TIPO === */}

          {/* RAMP: desde/hasta + ramp up/down como tiempos de rampa */}
          {selected && selected.kind === "ramp" && (
            <>
              {/* Desde/Hasta (usamos 'speed' como valor inicial y 'rampUp' como valor final para no agregar más estado por ahora) */}
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-sm text-slate-300">
                    Desde (%)
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
                      className="w-20 rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5
                         focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-sm text-slate-300">
                    Hasta (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      className="flex-1"
                      value={Math.max(0, Math.min(100, rampUp))}
                      onChange={(e) => setRampUp(Number(e.target.value))}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="w-20 rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5
                         focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                      value={Math.max(0, Math.min(100, rampUp))}
                      onChange={(e) => setRampUp(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* Curvas de rampa (rampUp/rampDn como tiempos de easing) */}
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-sm text-slate-300">
                    Ramp Up (ms)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5
                       focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                    value={rampUp}
                    onChange={(e) => setRampUp(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm text-slate-300">
                    Ramp Down (ms)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5
                       focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                    value={rampDn}
                    onChange={(e) => setRampDn(Number(e.target.value))}
                  />
                </div>
              </div>
            </>
          )}

          {/* HOLD: velocidad fija */}
          {selected && selected.kind === "hold" && (
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
                  className="w-20 rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5
                     focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* PIVOT: velocidad + lado (usamos dirL como “lado”: 0=izq,1=der) */}
          {selected && selected.kind === "pivot" && (
            <>
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
                    className="w-20 rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5
                       focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block mb-1 text-sm text-slate-300">
                  Lado
                </label>
                <select
                  className="w-full rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5
                     focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  value={dirL}
                  onChange={(e) => setDirL(Number(e.target.value) as Dir)}
                >
                  <option value={0}>Izquierda</option>
                  <option value={1}>Derecha</option>
                </select>
              </div>
            </>
          )}

          {/* ARC: base + ratio + lado + dirección */}
          {selected && selected.kind === "arc" && (
            <>
              <div className="mb-3">
                <label className="block mb-1 text-sm text-slate-300">
                  Velocidad base (%)
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
                    className="w-20 rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5
                       focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block mb-1 text-sm text-slate-300">
                  Ratio interno (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    className="flex-1"
                    value={Math.max(0, Math.min(100, rampUp))}
                    onChange={(e) => setRampUp(Number(e.target.value))}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-20 rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5
                       focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                    value={Math.max(0, Math.min(100, rampUp))}
                    onChange={(e) => setRampUp(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-sm text-slate-300">
                    Lado
                  </label>
                  <select
                    className="w-full rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5
                       focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                    value={dirL}
                    onChange={(e) => setDirL(Number(e.target.value) as Dir)}
                  >
                    <option value={0}>Izquierda</option>
                    <option value={1}>Derecha</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-sm text-slate-300">
                    Dirección
                  </label>
                  <select
                    className="w-full rounded-xl bg-white/10 text-slate-100 ring-1 ring-white/10 p-2.5
                       focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                    value={dirR}
                    onChange={(e) => setDirR(Number(e.target.value) as Dir)}
                  >
                    <option value={0}>Adelante</option>
                    <option value={1}>Atrás</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* STOP: solo freno */}
          {selected && selected.kind === "stop" && (
            <div className="mb-4 flex items-center gap-3">
              <input
                id="brake"
                type="checkbox"
                className="h-4 w-4 rounded-md"
                checked={brake}
                onChange={(e) => setBrake(e.target.checked)}
              />
              <label htmlFor="brake" className="text-sm text-slate-300">
                Aplicar freno al detener
              </label>
            </div>
          )}

          {/* Brake (común si no se mostró arriba) */}
          {selected && selected.kind !== "stop" && (
            <div className="mb-4 flex items-center gap-3">
              <input
                id="brake-common"
                type="checkbox"
                className="h-4 w-4 rounded-md"
                checked={brake}
                onChange={(e) => setBrake(e.target.checked)}
              />
              <label htmlFor="brake-common" className="text-sm text-slate-300">
                Aplicar freno al finalizar
              </label>
            </div>
          )}

          {/* Botones acción */}
          <div className="flex items-center justify-between mt-2">
            <button
              className="group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold
                 transition-all duration-300 hover:text-slate-900
                 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')]
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
              onClick={() => {
                if (!selected) return;
                // Guardar: aplicamos duración/velocidad (y algunos campos mapeados simples)
                setBlocks((prev) =>
                  prev.map((b) =>
                    b.id === selected.id
                      ? {
                          ...b,
                          label: b.label || "Bloque",
                          durationMs,
                          // Para esta maqueta: ‘speed’ como valor principal (hold/pivot/arc)
                          speed,
                        }
                      : b
                  )
                );
              }}
            >
              Guardar
            </button>

            <div className="flex items-center gap-3">
              <button
                className="rounded-xl px-3 py-2 font-medium transition-all duration-300
                   hover:text-slate-900 hover:shadow-[inset_0_0_0_1px_theme('colors.slate.400')]
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
                onClick={() => {
                  setActiveIndex((i) => (i + 1) % blocks.length);
                  setActiveProgress(0.1);
                }}
              >
                Siguiente bloque
              </button>
              <button
                className="rounded-xl px-3 py-2 font-medium transition-all duration-300
                   hover:text-slate-900 hover:shadow-[inset_0_0_0_1px_theme('colors.slate.400')]
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
                onClick={() =>
                  setActiveProgress((p) => Math.max(0, Math.min(1, p + 0.1)))
                }
              >
                + Progreso
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
          <h2 className="text-2xl font-bold mb-4 text-black">
            Información de control de motores
          </h2>
          <p className="mb-3 text-black">
            Esta sección te permite controlar los motores de tu robot utilizando
            bloques de comandos. Puedes agregar, eliminar y editar bloques para
            definir la secuencia de acciones que deseas que realice el robot.
          </p>
          <p className="text-black">
            En el modo STATION, puedes seleccionar una red disponible
            yconfigurar sus credenciales. Si seleccionas una red, el SSID
            serellenará automáticamente y la contraseña quedará vacía para que
            laingreses.
          </p>
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
              className="btn-indigo group relative inline-flex items-center gap-2 rounded-xl px-3 py-2 font-medium text-white transition-all duration-300 hover:text-slate-900 hover:shadow-[inset_0_0_0_1px_theme('colors.indigo.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 estado-btn px-5"
              onClick={() => console.log("Reiniciar ESP01")}
            >
              Enviar
            </button>
          </div>
          <div className="flex flex-row gap-4 text-black w-full items-center justify-center my-4">
            <p className="text-lg">Resetear configuración</p>
            <button
              className="btn-danger group relative inline-flex items-center gap-2 rounded-xl py-2 font-medium text-white transition-all duration-300 hover:text-slate-900 hover:shadow-[inset_0_0_0_1px_theme('colors.red.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 estado-btn px-5"
              onClick={() => console.log("Resetear configuracion")}
            >
              Enviar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ControlSection;
