import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  IDLE_SUMMARY,
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

type DetailSectionKey = "analysis" | "payloads" | "validations" | "references";

const DEFAULT_DETAIL_SECTIONS: Record<DetailSectionKey, boolean> = {
  analysis: true,
  payloads: true,
  validations: false,
  references: false,
};

export function TranslatorColumn(props: TranslatorColumnProps) {
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

  const [showTranslationDetails, setShowTranslationDetails] = useState(false);
  const [showAnalysisCard, setShowAnalysisCard] = useState(false);
  const [selectedFrameOffset, setSelectedFrameOffset] = useState<number | null>(null);
  const [openSections, setOpenSections] = useState<Record<DetailSectionKey, boolean>>(DEFAULT_DETAIL_SECTIONS);
  const [copiedKey, setCopiedKey] = useState("");
  const copyTimerRef = useRef<number | null>(null);

  const selectedFrame = useMemo(() => {
    if (!scanResult || selectedFrameOffset === null) {
      return null;
    }

    return scanResult.validFrames.find((item) => item.offset === selectedFrameOffset) ?? null;
  }, [scanResult, selectedFrameOffset]);

  const detailAnalysis = selectedFrame?.analysis ?? translation;
  const detailFrame = selectedFrame?.frame ?? detailAnalysis.frameBytes;

  useEffect(() => {
    setShowTranslationDetails(!isTranslationIdle(translation));
  }, [translation]);

  useEffect(() => {
    if (isTranslationIdle(translation)) {
      setSelectedFrameOffset(null);
      setShowAnalysisCard(false);
      return;
    }

    if (!scanResult) {
      setSelectedFrameOffset(null);
      setShowAnalysisCard(true);
      return;
    }

    if (scanResult.validFrames.length === 1) {
      setSelectedFrameOffset(scanResult.validFrames[0].offset);
      setShowAnalysisCard(true);
      return;
    }

    setSelectedFrameOffset(null);
    setShowAnalysisCard(false);
  }, [scanResult, translation]);

  useEffect(() => {
    setOpenSections(DEFAULT_DETAIL_SECTIONS);
    setCopiedKey("");
  }, [selectedFrameOffset, translation]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  function toggleDetailSection(section: DetailSectionKey) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function selectFrame(frame: ValidFrameItem) {
    setSelectedFrameOffset(frame.offset);
    setShowAnalysisCard(true);
  }

  async function copyText(key: string, value: string) {
    if (!value) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopiedKey(key);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedKey("");
    }, 1400);
  }

  function handleResetTranslator() {
    setShowAnalysisCard(false);
    setSelectedFrameOffset(null);
    onResetTranslator();
  }

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
            <button className={GHOST_BUTTON_CLASS} type="button" onClick={handleResetTranslator}>
              Limpiar
            </button>
          </div>
          <div className={NOTE_CLASS}>
            Si el texto contiene multiples headers UNER, entra automaticamente en modo escaneo y lista frames validos,
            candidatos invalidos y bytes fuera de frame.
          </div>
        </div>
      </Panel>

      {showTranslationDetails ? (
        <>
          <Panel title="Estado">
            <div className="space-y-4">
              <StatusPill tone={translatorStatus.tone}>{translatorStatus.label}</StatusPill>
              <div className={NOTE_CLASS}>{translatorStatus.summary}</div>
            </div>
          </Panel>

          <Panel title="Mapa visual del bloque completo">
            {scanResult ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  {streamSegments.map((segment) => {
                    const currentFrame = scanResult.validFrames.find((item) => item.offset === segment.order) ?? null;
                    const isSelected = showAnalysisCard && selectedFrameOffset === segment.order;

                    if (segment.type === "frame" && currentFrame) {
                      return (
                        <button
                          key={`${segment.type}-${segment.order}-${segment.label}`}
                          type="button"
                          className={`group relative flex w-full min-w-0 flex-col gap-2 overflow-hidden rounded-xl p-3 text-left ring-1 transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 md:w-[calc(50%-0.375rem)] 2xl:w-[calc(33.333%-0.5rem)] ${segment.tone} ${
                            isSelected ? "outline outline-1 outline-rose-300/70" : ""
                          }`}
                          onClick={() => selectFrame(currentFrame)}
                        >
                          <StreamSegmentBody segment={segment} />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/75 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                            <span className="rounded-md border border-rose-200/40 bg-rose-500/20 px-3 py-1 text-xs font-bold uppercase text-rose-50 shadow-sm">
                              Ver detalles
                            </span>
                          </span>
                        </button>
                      );
                    }

                    return (
                      <div
                        key={`${segment.type}-${segment.order}-${segment.label}`}
                        className={`flex w-full min-w-0 flex-col gap-2 rounded-xl p-3 ring-1 md:w-[calc(50%-0.375rem)] 2xl:w-[calc(33.333%-0.5rem)] ${segment.tone}`}
                      >
                        <StreamSegmentBody segment={segment} />
                      </div>
                    );
                  })}
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

                {scanResult.validFrames.length > 1 && !showAnalysisCard ? (
                  <div className="rounded-xl border border-sky-300/25 bg-sky-500/10 p-3 text-sm text-sky-100">
                    Hay varios frames validos. Elegi uno del mapa para abrir su analisis a detalle.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200">
                {streamPlaceholder}
              </div>
            )}
          </Panel>

          {showAnalysisCard ? (
            <AnalysisDetailCard
              analysis={detailAnalysis}
              frame={detailFrame}
              offset={selectedFrame?.offset ?? null}
              openSections={openSections}
              copiedKey={copiedKey}
              onToggleSection={toggleDetailSection}
              onClose={() => setShowAnalysisCard(false)}
              onCopy={copyText}
            />
          ) : null}

          <Panel title="Resultados del escaneo de bloque">
            {scanResult ? (
              <div className="space-y-4">
                <article className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-white">Resumen del bloque</h3>
                    <span className="font-mono text-sm text-slate-400">{scanResult.totalBytes} bytes</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <SummaryMetric label="Frames validos" value={scanResult.validFrames.length} tone="emerald" />
                    <SummaryMetric label="Frames conocidos" value={scanResult.knownCount} tone="emerald" />
                    <SummaryMetric label="CMD desconocido" value={scanResult.unknownCount} tone="amber" />
                    <SummaryMetric label="Candidatos invalidos" value={scanResult.invalidCandidates.length} tone="rose" />
                    <SummaryMetric label="Fuera de frame" value={scanResult.gaps.length} tone="amber" />
                  </div>
                </article>

                {scanResult.validFrames.length > 0 ? (
                  <>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                      Frames validos encontrados
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {scanResult.validFrames.map((item, index) => {
                        const hasWarnings = item.analysis.validations.some((validation) => validation.tone !== "ok");

                        return (
                          <article key={`valid-${item.offset}`} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h3 className="font-semibold text-white">
                                #{index + 1} @ offset {item.offset}
                              </h3>
                              <div className="flex flex-wrap items-center gap-3">
                                <StatusPill tone={hasWarnings ? "warn" : "ok"}>
                                  {hasWarnings ? "Valido con advertencias" : "Valido"}
                                </StatusPill>
                                <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => selectFrame(item)}>
                                  Ver detalles
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 space-y-1 text-sm text-slate-300">
                              <p>
                                CMD: <span className="font-mono text-slate-100">{item.analysis.cmdHex}</span> -{" "}
                                <span className="font-semibold text-white">{item.analysis.name}</span>
                              </p>
                              <p>Ruta: {item.analysis.nodes}</p>
                              <p>LEN: {item.analysis.len}</p>
                            </div>
                            <div className="mt-4">
                              <div className={SMALL_LABEL_CLASS}>Frame</div>
                              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-sm text-slate-100">
                                {shortHex(item.frame, 48)}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                {scanResult.invalidCandidates.length > 0 ? (
                  <>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                      Candidatos con header pero invalidos
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {scanResult.invalidCandidates.map((item, index) => (
                        <article key={`invalid-${item.offset}`} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="font-semibold text-white">
                              Invalido #{index + 1} @ offset {item.offset}
                            </h3>
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
                        <article key={`gap-${gap.start}-${gap.end}`} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
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
        </>
      ) : null}
    </div>
  );
}

function isTranslationIdle(translation: TranslationResult) {
  return translation.summary === IDLE_SUMMARY;
}

function StreamSegmentBody({ segment }: { segment: StreamSegment }) {
  return (
    <>
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
    </>
  );
}

interface AnalysisDetailCardProps {
  analysis: TranslationResult;
  frame: number[];
  offset: number | null;
  openSections: Record<DetailSectionKey, boolean>;
  copiedKey: string;
  onToggleSection: (section: DetailSectionKey) => void;
  onClose: () => void;
  onCopy: (key: string, value: string) => void;
}

function AnalysisDetailCard({
  analysis,
  frame,
  offset,
  openSections,
  copiedKey,
  onToggleSection,
  onClose,
  onCopy,
}: AnalysisDetailCardProps) {
  const detailName = analysis.name && analysis.name !== "-" ? analysis.name : analysis.cmdHex !== "-" ? analysis.cmdHex : "la entrada";
  const frameHex = frame.length > 0 ? bytesToHex(frame) : "";
  const payloadBytes = getPayloadBytes(frame);
  const payloadHex = payloadBytes.length > 0 ? bytesToHex(payloadBytes) : "(vacio)";
  const payloadAscii = payloadBytes.length > 0 ? asciiPreview(payloadBytes, 140) : "(vacio)";
  const payloadDec = payloadBytes.length > 0 ? payloadBytes.join(" ") : "(vacio)";
  const hasWarnings = analysis.validations.some((validation) => validation.tone !== "ok");
  const statusTone = analysis.overall === "bad" ? "bad" : hasWarnings || analysis.overall === "warn" ? "warn" : "ok";
  const statusLabel = analysis.overall === "bad" ? "Invalido" : statusTone === "warn" ? "Valido con advertencias" : "Valido";
  const copyPrefix = offset !== null ? `frame-${offset}` : `frame-${analysis.cmdHex}`;

  return (
    <article className="relative overflow-hidden rounded-xl border border-sky-300/25 bg-slate-950/70 p-4 shadow-sm ring-1 ring-rose-300/10">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-300/70 via-rose-300/70 to-sky-300/70" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white">Analisis a detalle de {detailName}</h2>
          <p className="mt-1 text-sm text-slate-300">
            {offset !== null ? `Frame seleccionado en offset ${offset}. ` : ""}
            {analysis.summary}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-rose-200/30 bg-rose-500/10 p-2 text-rose-100 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/50"
          onClick={onClose}
          aria-label="Ocultar analisis a detalle"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
        {frameHex ? (
          <CopyPill copyKey={`${copyPrefix}-full`} value={frameHex} copiedKey={copiedKey} onCopy={onCopy} />
        ) : null}
      </div>

      <div className="mt-5 space-y-4">
        <CollapsibleDetailSection
          title="Datos del analisis"
          isOpen={openSections.analysis}
          onToggle={() => onToggleSection("analysis")}
        >
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            <DetailItem label="Tipo detectado" value={analysis.typeDetected} />
            <DetailItem label="CMD" value={analysis.cmdHex} />
            <DetailItem label="Nombre" value={analysis.name} />
            <DetailItem label="Route" value={analysis.route} />
            <DetailItem label="Origen -> Destino" value={analysis.nodes} />
            <DetailItem label="LEN" value={analysis.len} />
            <DetailItem label="Significado" value={analysis.meaning} className="md:col-span-2 2xl:col-span-4" />
          </div>
        </CollapsibleDetailSection>

        <CollapsibleDetailSection title="Payloads" isOpen={openSections.payloads} onToggle={() => onToggleSection("payloads")}>
          <div className="grid gap-3 xl:grid-cols-3">
            <PayloadValue label="Payload HEX" value={payloadHex} copyValue={payloadBytes.length > 0 ? payloadHex : ""} copyKey={`${copyPrefix}-payload-hex`} copiedKey={copiedKey} onCopy={onCopy} />
            <PayloadValue label="Payload ASCII" value={payloadAscii} copyValue={payloadBytes.length > 0 ? payloadAscii : ""} copyKey={`${copyPrefix}-payload-ascii`} copiedKey={copiedKey} onCopy={onCopy} />
            <PayloadValue label="Payload DEC" value={payloadDec} copyValue={payloadBytes.length > 0 ? payloadDec : ""} copyKey={`${copyPrefix}-payload-dec`} copiedKey={copiedKey} onCopy={onCopy} />
          </div>
        </CollapsibleDetailSection>

        <CollapsibleDetailSection
          title="Validaciones"
          isOpen={openSections.validations}
          onToggle={() => onToggleSection("validations")}
        >
          <div className="space-y-3">
            {analysis.validations.length > 0 ? (
              analysis.validations.map((item, index) => <ValidationRow key={`${item.message}-${index}`} item={item} />)
            ) : (
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200">
                Sin validaciones todavia.
              </div>
            )}
          </div>
        </CollapsibleDetailSection>

        <CollapsibleDetailSection
          title="Referencias del frame"
          isOpen={openSections.references}
          onToggle={() => onToggleSection("references")}
        >
          <div className="space-y-3">
            <ColoredFrame bytes={frame} />
            <div>
              <div className={SMALL_LABEL_CLASS}>Frame HEX</div>
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-sm text-slate-100">
                {frameHex || "Sin frame para mostrar."}
              </div>
            </div>
          </div>
        </CollapsibleDetailSection>
      </div>
    </article>
  );
}

function PayloadValue({
  label,
  value,
  copyValue,
  copyKey,
  copiedKey,
  onCopy,
}: {
  label: string;
  value: string;
  copyValue: string;
  copyKey: string;
  copiedKey: string;
  onCopy: (key: string, value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-200">{label}</div>
        <CopyPill copyKey={copyKey} value={copyValue} copiedKey={copiedKey} onCopy={onCopy} />
      </div>
      <div className="min-h-12 rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-sm text-slate-100">
        {value}
      </div>
    </div>
  );
}

function CollapsibleDetailSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-bold uppercase text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <ChevronIcon isOpen={isOpen} />
      </button>
      {isOpen ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

function CopyPill({
  copyKey,
  value,
  copiedKey,
  onCopy,
  label = "Copiar",
}: {
  copyKey: string;
  value: string;
  copiedKey: string;
  onCopy: (key: string, value: string) => void;
  label?: string;
}) {
  const copied = copiedKey === copyKey;

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md border border-rose-200/40 bg-rose-500/15 px-3 py-1 text-xs font-bold uppercase text-rose-50 transition hover:bg-rose-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/50 disabled:cursor-not-allowed disabled:opacity-40"
      onClick={() => onCopy(copyKey, value)}
      disabled={!value}
    >
      <CopyIcon />
      {copied ? "Copiado" : label}
    </button>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : "text-amber-300";

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-200">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function getPayloadBytes(frame: number[]) {
  if (frame.length < 10) {
    return [];
  }
  return frame.slice(9, -1);
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`size-5 shrink-0 text-rose-100 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M7 2.75A1.75 1.75 0 0 1 8.75 1h6.5A1.75 1.75 0 0 1 17 2.75v8.5A1.75 1.75 0 0 1 15.25 13h-6.5A1.75 1.75 0 0 1 7 11.25v-8.5Z" />
      <path d="M3 6.75A1.75 1.75 0 0 1 4.75 5H5.5a.75.75 0 0 1 0 1.5h-.75a.25.25 0 0 0-.25.25v8.5c0 .14.11.25.25.25h6.5c.14 0 .25-.11.25-.25v-.75a.75.75 0 0 1 1.5 0v.75A1.75 1.75 0 0 1 11.25 17h-6.5A1.75 1.75 0 0 1 3 15.25v-8.5Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}
