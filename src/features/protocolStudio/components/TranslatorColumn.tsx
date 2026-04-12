import { useEffect, useState } from "react";
import {
  BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  IDLE_SUMMARY,
  INPUT_CLASS,
  NOTE_CLASS,
  SMALL_LABEL_CLASS,
} from "../catalog";
import { asciiPreview, bytesToHex, createIdleTranslation, h2, shortHex } from "../utils";
import { ColoredFrame, DetailItem, Panel, StatusPill, ValidationRow } from "../ui";
import type { ScanBlockResult, TranslationResult } from "../types";

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

export function TranslatorColumn(props: TranslatorColumnProps) {
  const [expandedWarnings, setExpandedWarnings] = useState<Record<string, boolean>>({});
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

  useEffect(() => {
    if(!isTranslationIdle()) {
      setShowTranslationDetails(true);
    } else {
      setShowTranslationDetails(false);
    }
  }, [translation]);

  function isTranslationIdle() {
    return translation.summary === IDLE_SUMMARY;
  }

  function toggleWarnings(key: string) {
    setExpandedWarnings((current) => ({
      ...current,
      [key]: !current[key],
    }));
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
            <button
              className={`refresh-btn ${BUTTON_CLASS}`}
              type="button"
              onClick={onTranslate}
            >
              Traducir / escanear
            </button>
            <button
              className={GHOST_BUTTON_CLASS}
              type="button"
              onClick={onLoadBuilderToTranslator}
            >
              Cargar frame generado
            </button>
            <button
              className={GHOST_BUTTON_CLASS}
              type="button"
              onClick={onResetTranslator}
            >
              Limpiar
            </button>
          </div>
          <div className={NOTE_CLASS}>
            Si el texto contiene multiples headers UNER, entra automaticamente
            en modo escaneo y lista frames validos, candidatos invalidos y bytes
            fuera de frame.
          </div>
        </div>
      </Panel>
      {showTranslationDetails && ( <>
        <Panel title="Estado">
          <div className="space-y-4">
            <StatusPill tone={translatorStatus.tone}>
              {translatorStatus.label}
            </StatusPill>
            <div className={NOTE_CLASS}>{translatorStatus.summary}</div>
          </div>
        </Panel>

        <Panel title="Detalle interpretado">
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            <DetailItem
              label="Tipo detectado"
              value={translation.typeDetected}
            />
            <DetailItem label="CMD" value={translation.cmdHex} />
            <DetailItem label="Nombre" value={translation.name} />
            <DetailItem label="Route" value={translation.route} />
            <DetailItem label="Origen -> Destino" value={translation.nodes} />
            <DetailItem label="LEN" value={translation.len} />
            <DetailItem
              label="Significado"
              value={translation.meaning}
              className="md:col-span-2 2xl:col-span-4"
            />
            <DetailItem
              label="Payload"
              value={translation.payload}
              className="md:col-span-2 2xl:col-span-4"
            />
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
              Si la entrada es un bloque o solo un CMD, esta vista puede quedar
              vacia o mostrar solo el primer frame relevante.
            </p>
          </div>
        </Panel>

        <Panel title="Mapa visual del bloque completo">
          {scanResult ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {streamSegments.map((segment) => (
                  <div
                    key={`${segment.type}-${segment.label}`}
                    className={`flex w-full min-w-0 flex-col gap-2 rounded-2xl p-3 ring-1 md:w-[calc(50%-0.375rem)] 2xl:w-[calc(33.333%-0.5rem)] ${segment.tone}`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em]">
                      {segment.label}
                    </div>
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
                  </div>
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
                  <h3 className="font-semibold text-white">
                    Resumen del bloque
                  </h3>
                  <span className="font-mono text-sm text-slate-400">
                    {scanResult.totalBytes} bytes
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-200">
                      Frames validos
                    </div>
                    <div className="mt-2 text-2xl font-bold text-emerald-300">
                      {scanResult.validFrames.length}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-200">
                      Frames conocidos
                    </div>
                    <div className="mt-2 text-2xl font-bold text-emerald-300">
                      {scanResult.knownCount}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-200">
                      CMD desconocido
                    </div>
                    <div className="mt-2 text-2xl font-bold text-amber-300">
                      {scanResult.unknownCount}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-200">
                      Candidatos invalidos
                    </div>
                    <div className="mt-2 text-2xl font-bold text-rose-300">
                      {scanResult.invalidCandidates.length}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-200">
                      Fuera de frame
                    </div>
                    <div className="mt-2 text-2xl font-bold text-amber-300">
                      {scanResult.gaps.length}
                    </div>
                  </div>
                </div>
              </article>

              {scanResult.validFrames.length > 0 ? (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                    Frames validos encontrados
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {scanResult.validFrames.map((item, index) => {
                      const cardKey = `valid-${item.offset}`;
                      const payloadBytes = item.frame.slice(9, -1);
                      const payloadHex =
                        payloadBytes.length > 0
                          ? bytesToHex(payloadBytes)
                          : "(vacio)";
                      const payloadAscii =
                        payloadBytes.length > 0
                          ? asciiPreview(payloadBytes, 120)
                          : "(vacio)";
                      const payloadDec =
                        payloadBytes.length > 0
                          ? payloadBytes.join(" ")
                          : "(vacio)";
                      const warningItems = item.analysis.validations.filter(
                        (validation) => validation.tone !== "ok",
                      );
                      const hasWarnings = warningItems.length > 0;
                      const warningsExpanded =
                        expandedWarnings[cardKey] ?? false;

                      return (
                        <article
                          key={cardKey}
                          className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="font-semibold text-white">
                              #{index + 1} @ offset {item.offset}
                            </h3>
                            <div className="flex flex-wrap items-center gap-3">
                              <StatusPill tone={hasWarnings ? "warn" : "ok"}>
                                {hasWarnings
                                  ? "Valido con advertencias"
                                  : "Valido"}
                              </StatusPill>
                              {hasWarnings ? (
                                <button
                                  type="button"
                                  className={GHOST_BUTTON_CLASS}
                                  onClick={() => toggleWarnings(cardKey)}
                                >
                                  {warningsExpanded
                                    ? "Ocultar advertencias"
                                    : "Ver advertencias"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-3 space-y-1 text-sm text-slate-300">
                            <p>
                              CMD:{" "}
                              <span className="font-mono text-slate-100">
                                {item.analysis.cmdHex}
                              </span>{" "}
                              -{" "}
                              <span className="font-semibold text-white">
                                {item.analysis.name}
                              </span>
                            </p>
                            <p>Tipo: {item.analysis.typeDetected}</p>
                            <p>Ruta: {item.analysis.nodes}</p>
                            <p>LEN: {item.analysis.len}</p>
                            <p>Significado: {item.analysis.meaning}</p>
                          </div>
                          <div className="mt-4 grid gap-3 xl:grid-cols-3">
                            <div>
                              <div className={SMALL_LABEL_CLASS}>
                                Payload HEX
                              </div>
                              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-sm text-slate-100">
                                {payloadHex}
                              </div>
                            </div>
                            <div>
                              <div className={SMALL_LABEL_CLASS}>
                                Payload ASCII
                              </div>
                              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-sm text-slate-100">
                                {payloadAscii}
                              </div>
                            </div>
                            <div>
                              <div className={SMALL_LABEL_CLASS}>
                                Payload DEC
                              </div>
                              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-sm text-slate-100">
                                {payloadDec}
                              </div>
                            </div>
                          </div>
                          {hasWarnings && warningsExpanded ? (
                            <div className="mt-4 space-y-3">
                              <div className={SMALL_LABEL_CLASS}>
                                Advertencias
                              </div>
                              {warningItems.map((warning, warningIndex) => (
                                <ValidationRow
                                  key={`${cardKey}-warning-${warningIndex}`}
                                  item={warning}
                                />
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-4">
                            <div className={SMALL_LABEL_CLASS}>Frame</div>
                            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-sm text-slate-100">
                              {bytesToHex(item.frame)}
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
                      <article
                        key={`invalid-${item.offset}`}
                        className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="font-semibold text-white">
                            Invalido #{index + 1} @ offset {item.offset}
                          </h3>
                          <StatusPill tone="bad">Fallo verificacion</StatusPill>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                          Motivo: {item.reason}
                        </p>
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
                      <article
                        key={`gap-${gap.start}-${gap.end}`}
                        className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="font-semibold text-white">
                            {gap.title} #{index + 1} @ {gap.start}..{gap.end}
                          </h3>
                          <StatusPill tone="warn">
                            {gap.bytes.length} bytes
                          </StatusPill>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                          {gap.note}
                        </p>
                        <p className="mt-3 text-sm text-slate-300">
                          ASCII aprox:{" "}
                          <span className="font-mono text-slate-100">
                            {asciiPreview(gap.bytes, 100)}
                          </span>
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
      </>) }
    </div>
  );
}
