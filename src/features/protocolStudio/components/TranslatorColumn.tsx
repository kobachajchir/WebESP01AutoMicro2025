import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  INPUT_CLASS,
  NOTE_CLASS,
  SMALL_LABEL_CLASS,
} from "../catalog";
import { asciiPreview, bytesToHex, h2, shortHex } from "../utils";
import { ColoredFrame, DetailItem, Panel, StatusPill, ValidationRow } from "../ui";
import type { ScanBlockResult, TranslationResult, ValidFrameItem } from "../types";

interface StreamSegment {
  type: "gap" | "invalid" | "frame";
  order: number;
  label: string;
  bytes: number[];
  tone: string;
  frameOffset?: number;
  frameName?: string;
}

interface TranslatorColumnProps {
  translatorInput: string;
  translation: TranslationResult;
  scanResult: ScanBlockResult | null;
  translatorStatus: {
    tone: "ok" | "warn" | "bad";
    label: string;
    summary: string;
  };
  scanResultsPlaceholder: string;
  streamPlaceholder: string;
  streamSegments: StreamSegment[];
  onTranslatorInputChange: (value: string) => void;
  onTranslate: () => void;
  onLoadBuilderToTranslator: () => void;
  onResetTranslator: () => void;
}

interface FrameDetailCardProps {
  item: ValidFrameItem;
  frameIndex: number;
  onClose: () => void;
}

interface DetailSectionCardProps {
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={`size-5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function DetailSectionCard(props: DetailSectionCardProps) {
  const { title, subtitle, open, onToggle, children } = props;

  return (
    <section className="rounded-2xl border border-sky-300/15 bg-gradient-to-br from-slate-950/85 via-slate-900/70 to-rose-950/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-100">
            {title}
          </h4>
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex size-10 items-center justify-center rounded-2xl border border-sky-300/15 bg-white/5 text-slate-200 transition-all duration-300 hover:border-rose-300/25 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/35"
          aria-expanded={open}
          aria-label={`${open ? "Ocultar" : "Mostrar"} ${title.toLowerCase()}`}
        >
          <ChevronIcon open={open} />
        </button>
      </div>

      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

function FrameDetailCard(props: FrameDetailCardProps) {
  const { item, frameIndex, onClose } = props;
  const frameHex = bytesToHex(item.frame);
  const payloadBytes = item.frame.slice(9, -1);
  const payloadHex = payloadBytes.length > 0 ? bytesToHex(payloadBytes) : "(vacio)";
  const payloadAscii = payloadBytes.length > 0 ? asciiPreview(payloadBytes, 120) : "(vacio)";
  const payloadDec = payloadBytes.length > 0 ? payloadBytes.join(" ") : "(vacio)";
  const warningItems = item.analysis.validations.filter((validation) => validation.tone !== "ok");
  const hasWarnings = warningItems.length > 0;
  const [copied, setCopied] = useState(false);
  const [openSections, setOpenSections] = useState({
    analysis: true,
    payloads: true,
    validations: true,
    references: false,
  });

  useEffect(() => {
    setOpenSections({
      analysis: true,
      payloads: true,
      validations: true,
      references: false,
    });
  }, [item.offset]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopied(false);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);

  function toggleSection(section: keyof typeof openSections) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  async function copyFrameHex() {
    try {
      await navigator.clipboard.writeText(frameHex);
      setCopied(true);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = frameHex;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
    }
  }

  return (
    <article className="rounded-[1.6rem] border border-sky-300/15 bg-gradient-to-br from-slate-950 via-slate-900/95 to-rose-950/40 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/90">
            Analisis seleccionado
          </p>
          <h3 className="mt-2 text-base font-semibold uppercase tracking-[0.18em] text-white">
            Analisis a detalle de {item.analysis.name}
          </h3>
          <p className="mt-2 text-sm text-slate-300">
            Bloque #{frameIndex + 1} @ offset {item.offset}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex rounded-full border border-sky-300/15 bg-sky-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-100">
            {item.analysis.cmdHex}
          </span>
          <StatusPill tone={hasWarnings ? "warn" : "ok"}>
            {hasWarnings ? "Valido con advertencias" : "Valido"}
          </StatusPill>
          <button
            type="button"
            onClick={() => void copyFrameHex()}
            className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-400/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-rose-100 transition-all duration-300 hover:border-rose-300/35 hover:bg-rose-400/18 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/35"
            title="Copiar frame en HEX"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="size-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 17.25h3a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 18.75 3.75h-9A2.25 2.25 0 0 0 7.5 6v3m8.25 8.25h-9A2.25 2.25 0 0 1 4.5 15v-9a2.25 2.25 0 0 1 2.25-2.25h9A2.25 2.25 0 0 1 18 6v9a2.25 2.25 0 0 1-2.25 2.25Z"
              />
            </svg>
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button
            type="button"
            aria-label="Ocultar analisis detallado"
            title="Ocultar analisis detallado"
            className="group inline-flex size-10 items-center justify-center rounded-2xl border border-rose-300/15 bg-white/5 text-slate-300 transition-all duration-300 hover:border-rose-300/30 hover:bg-rose-300/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/35"
            onClick={onClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="size-5 transition-transform duration-300 group-hover:scale-110"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <DetailSectionCard
          title="Datos del analisis"
          subtitle="Identidad del comando, ruta y lectura funcional del frame."
          open={openSections.analysis}
          onToggle={() => toggleSection("analysis")}
        >
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            <DetailItem label="Tipo detectado" value={item.analysis.typeDetected} />
            <DetailItem label="CMD" value={item.analysis.cmdHex} />
            <DetailItem label="Nombre" value={item.analysis.name} />
            <DetailItem label="Route" value={item.analysis.route} />
            <DetailItem label="Origen -> Destino" value={item.analysis.nodes} />
            <DetailItem label="LEN" value={item.analysis.len} />
            <DetailItem
              label="Significado"
              value={item.analysis.meaning}
              className="md:col-span-2 2xl:col-span-4"
            />
            <DetailItem
              label="Payload interpretado"
              value={item.analysis.payload}
              className="md:col-span-2 2xl:col-span-4"
            />
          </div>
        </DetailSectionCard>

        <DetailSectionCard
          title="Payloads"
          subtitle="Misma carga util vista en hexadecimal, ASCII y decimal."
          open={openSections.payloads}
          onToggle={() => toggleSection("payloads")}
        >
          <div className="grid gap-3 xl:grid-cols-3">
            <div className="rounded-2xl border border-sky-300/12 bg-slate-950/70 p-3">
              <div className={SMALL_LABEL_CLASS}>Payload HEX</div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-sm text-slate-100">
                {payloadHex}
              </div>
            </div>
            <div className="rounded-2xl border border-sky-300/12 bg-slate-950/70 p-3">
              <div className={SMALL_LABEL_CLASS}>Payload ASCII</div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-sm text-slate-100">
                {payloadAscii}
              </div>
            </div>
            <div className="rounded-2xl border border-sky-300/12 bg-slate-950/70 p-3">
              <div className={SMALL_LABEL_CLASS}>Payload DEC</div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-sm text-slate-100">
                {payloadDec}
              </div>
            </div>
          </div>
        </DetailSectionCard>

        <DetailSectionCard
          title="Validaciones"
          subtitle="Chequeos de transporte, tabla de comandos y advertencias del analizador."
          open={openSections.validations}
          onToggle={() => toggleSection("validations")}
        >
          <div className="space-y-3">
            {item.analysis.validations.length > 0 ? (
              item.analysis.validations.map((validation, validationIndex) => (
                <ValidationRow
                  key={`${item.offset}-validation-${validationIndex}`}
                  item={validation}
                />
              ))
            ) : (
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200">
                Sin validaciones para este bloque.
              </div>
            )}
            {hasWarnings ? (
              <div className="rounded-xl border border-rose-300/15 bg-rose-400/10 p-3 text-sm text-rose-100">
                Este frame contiene {warningItems.length} advertencia(s) ademas de los chequeos exitosos.
              </div>
            ) : null}
          </div>
        </DetailSectionCard>

        <DetailSectionCard
          title="Referencias del frame"
          subtitle="Ubicacion en el bloque, resumen textual y bytes exactos enviados."
          open={openSections.references}
          onToggle={() => toggleSection("references")}
        >
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            <DetailItem label="Offset" value={String(item.offset)} />
            <DetailItem label="Bytes totales" value={String(item.frame.length)} />
            <DetailItem label="Bytes de payload" value={String(payloadBytes.length)} />
            <DetailItem label="Estado global" value={item.analysis.overall} />
            <DetailItem
              label="Resumen del analisis"
              value={item.analysis.summary}
              className="md:col-span-2 2xl:col-span-4"
            />
          </div>
          <div className="mt-4">
            <div className={SMALL_LABEL_CLASS}>Frame coloreado</div>
            <ColoredFrame bytes={item.frame} />
          </div>
          <div className="mt-4">
            <div className={SMALL_LABEL_CLASS}>Frame HEX completo</div>
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-sm text-slate-100">
              {frameHex}
            </div>
          </div>
        </DetailSectionCard>
      </div>
    </article>
  );
}

export function TranslatorColumn(props: TranslatorColumnProps) {
  const [selectedFrameOffset, setSelectedFrameOffset] = useState<number | null>(null);
  const {
    translatorInput,
    translation,
    scanResult,
    translatorStatus,
    scanResultsPlaceholder,
    streamPlaceholder,
    streamSegments,
    onTranslatorInputChange,
    onTranslate,
    onLoadBuilderToTranslator,
    onResetTranslator,
  } = props;

  useEffect(() => {
    if (!scanResult) {
      setSelectedFrameOffset(null);
      return;
    }

    if (scanResult.validFrames.length === 1) {
      setSelectedFrameOffset(scanResult.validFrames[0].offset);
      return;
    }

    setSelectedFrameOffset(null);
  }, [scanResult]);

  const selectedFrame = useMemo(() => {
    if (!scanResult || selectedFrameOffset === null) {
      return null;
    }

    return (
      scanResult.validFrames.find((item) => item.offset === selectedFrameOffset) ?? null
    );
  }, [scanResult, selectedFrameOffset]);

  const selectedFrameIndex = useMemo(() => {
    if (!scanResult || !selectedFrame) {
      return -1;
    }

    return scanResult.validFrames.findIndex((item) => item.offset === selectedFrame.offset);
  }, [scanResult, selectedFrame]);

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Traductor / validador">
        <div className="space-y-4">
          <div>
            <label htmlFor="translator-input" className={SMALL_LABEL_CLASS}>
              Pega un comando o un bloque largo
            </label>
            <textarea
              id="translator-input"
              className={`${INPUT_CLASS} min-h-40 resize-y font-mono leading-6`}
              value={translatorInput}
              onChange={(event) => onTranslatorInputChange(event.target.value)}
              placeholder={`Ejemplos:
55 4E 45 52 00 3A 02 12 31 17
0x55 0x4E 0x45 0x52 0x00 0x3A 0x02 0x12 0x31 0x17
uint8_t frame[] = { 0x55, 0x4E, 0x45, 0x52, 0x00, 0x3A, 0x02, 0x12, 0x31, 0x17 };
frame = bytes([0x55, 0x4E, 0x45, 0x52, 0x00, 0x3A, 0x02, 0x12, 0x31, 0x17])
0x31
PING`}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button className={`refresh-btn ${BUTTON_CLASS}`} type="button" onClick={onTranslate}>
              Traducir / escanear
            </button>
            <button className={GHOST_BUTTON_CLASS} type="button" onClick={onLoadBuilderToTranslator}>
              Cargar frame generado
            </button>
            <button className={GHOST_BUTTON_CLASS} type="button" onClick={onResetTranslator}>
              Limpiar
            </button>
          </div>
          <div className={NOTE_CLASS}>
            Si el texto contiene multiples headers UNER, entra automaticamente en modo escaneo y lista frames validos,
            candidatos invalidos y bytes fuera de frame.
          </div>
        </div>
      </Panel>

      <Panel title="Estado">
        <div className="space-y-4">
          <StatusPill tone={translatorStatus.tone}>{translatorStatus.label}</StatusPill>
          <div className={NOTE_CLASS}>{translatorStatus.summary}</div>
        </div>
      </Panel>

      {scanResult ? (
        selectedFrame && selectedFrameIndex >= 0 ? (
          <Panel title="Analisis detallado">
            <FrameDetailCard
              item={selectedFrame}
              frameIndex={selectedFrameIndex}
              onClose={() => setSelectedFrameOffset(null)}
            />
          </Panel>
        ) : (
          <Panel title="Analisis detallado">
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
              {scanResult.validFrames.length > 1
                ? "El bloque contiene multiples frames validos. Selecciona uno en el mapa visual para ver su analisis a detalle."
                : scanResult.validFrames.length === 1
                ? "Analisis detallado oculto. Selecciona el bloque en el mapa visual para volver a abrirlo."
                : "No hay frames validos para mostrar en el analisis detallado."}
            </div>
          </Panel>
        )
      ) : (
        <>
          <Panel title="Detalle interpretado">
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              <DetailItem label="Tipo detectado" value={translation.typeDetected} />
              <DetailItem label="CMD" value={translation.cmdHex} />
              <DetailItem label="Nombre" value={translation.name} />
              <DetailItem label="Route" value={translation.route} />
              <DetailItem label="Origen -> Destino" value={translation.nodes} />
              <DetailItem label="LEN" value={translation.len} />
              <DetailItem label="Significado" value={translation.meaning} className="md:col-span-2 2xl:col-span-4" />
              <DetailItem label="Payload" value={translation.payload} className="md:col-span-2 2xl:col-span-4" />
            </div>
          </Panel>

          <Panel title="Validaciones">
            <div className="space-y-3">
              {translation.validations.length > 0 ? (
                translation.validations.map((item, index) => (
                  <ValidationRow key={`${item.message}-${index}`} item={item} />
                ))
              ) : (
                <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200">
                  Sin validaciones todavia.
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Frame parseado">
            <div className="space-y-3">
              <ColoredFrame bytes={translation.frameBytes} />
              <p className="text-sm text-slate-200">
                Si la entrada es un bloque o solo un CMD, esta vista puede quedar vacia o mostrar solo el primer frame
                relevante.
              </p>
            </div>
          </Panel>
        </>
      )}

      <Panel title="Mapa visual del bloque completo">
        {scanResult ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {streamSegments.map((segment) => (
                <button
                  key={`${segment.type}-${segment.label}`}
                  type="button"
                  disabled={segment.type !== "frame"}
                  onClick={() => {
                    if (segment.type === "frame" && typeof segment.frameOffset === "number") {
                      setSelectedFrameOffset(segment.frameOffset);
                    }
                  }}
                  className={`group relative flex w-full min-w-0 flex-col gap-2 rounded-2xl p-3 text-left ring-1 transition-all duration-300 md:w-[calc(50%-0.375rem)] 2xl:w-[calc(33.333%-0.5rem)] ${segment.tone} ${
                    segment.type === "frame"
                      ? "cursor-pointer hover:-translate-y-1 hover:shadow-[inset_0_0_0_1px_theme('colors.white')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                      : "cursor-default"
                  } ${
                    segment.type === "frame" &&
                    selectedFrameOffset !== null &&
                    segment.frameOffset === selectedFrameOffset
                      ? "shadow-[inset_0_0_0_1px_theme('colors.white')] ring-cyan-300/70"
                      : ""
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em]">{segment.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {segment.bytes.map((byte, index) => (
                      <span
                        key={`${segment.label}-${byte}-${index}`}
                        className="inline-flex min-w-9 items-center justify-center rounded-md border border-white/10 bg-black/20 px-2 py-1 font-mono text-xs font-semibold"
                      >
                        {h2(byte)}
                      </span>
                    ))}
                  </div>
                  {segment.type === "frame" ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-950/75 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                      <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-white">
                        Ver detalles
                      </span>
                    </div>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2">
                <span className="size-3 rounded-sm border border-slate-400/30 bg-slate-500/20" />
                Bytes fuera de frame
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-3 rounded-sm border border-rose-400/30 bg-rose-500/20" />
                Header invalido
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-3 rounded-sm border border-cyan-400/30 bg-cyan-500/20" />
                Frame valido
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200">
            {streamPlaceholder}
          </div>
        )}
      </Panel>

      <Panel title="Resultados del escaneo de bloque">
        {scanResult ? (
          <div className="space-y-4">
            <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-white">Resumen del bloque</h3>
                <span className="font-mono text-sm text-slate-400">{scanResult.totalBytes} bytes</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-200">Frames validos</div>
                  <div className="mt-2 text-2xl font-bold text-emerald-300">{scanResult.validFrames.length}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-200">Frames conocidos</div>
                  <div className="mt-2 text-2xl font-bold text-emerald-300">{scanResult.knownCount}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-200">CMD desconocido</div>
                  <div className="mt-2 text-2xl font-bold text-amber-300">{scanResult.unknownCount}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-200">Candidatos invalidos</div>
                  <div className="mt-2 text-2xl font-bold text-rose-300">{scanResult.invalidCandidates.length}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-200">Fuera de frame</div>
                  <div className="mt-2 text-2xl font-bold text-amber-300">{scanResult.gaps.length}</div>
                </div>
              </div>
            </article>
            {scanResult.validFrames.length > 1 ? (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                El bloque contiene {scanResult.validFrames.length} frames validos. Usa el mapa visual para elegir uno y abrir su analisis a detalle.
              </div>
            ) : null}

            {scanResult.invalidCandidates.length > 0 ? (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                  Candidatos con header pero invalidos
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {scanResult.invalidCandidates.map((item, index) => (
                    <article key={`invalid-${item.offset}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="font-semibold text-white">Invalido #{index + 1} @ offset {item.offset}</h3>
                        <StatusPill tone="bad">Fallo verificacion</StatusPill>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">Motivo: {item.reason}</p>
                      <div className="mt-4">
                        <div className={SMALL_LABEL_CLASS}>Preview</div>
                        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-sm text-slate-100">
                          {shortHex(item.preview, 40)}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : null}

            {scanResult.gaps.length > 0 ? (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                  Bytes fuera de frame
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {scanResult.gaps.map((gap, index) => (
                    <article key={`gap-${gap.start}-${gap.end}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="font-semibold text-white">
                          {gap.title} #{index + 1} @ {gap.start}..{gap.end}
                        </h3>
                        <StatusPill tone="warn">{gap.bytes.length} bytes</StatusPill>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">{gap.note}</p>
                      <p className="mt-3 text-sm text-slate-300">
                        ASCII aprox: <span className="font-mono text-slate-100">{asciiPreview(gap.bytes, 100)}</span>
                      </p>
                      <div className="mt-4">
                        <div className={SMALL_LABEL_CLASS}>Hex</div>
                        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-sm text-slate-100">
                          {shortHex(gap.bytes, 48)}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200">
            {scanResultsPlaceholder}
          </div>
        )}
      </Panel>
    </div>
  );
}
