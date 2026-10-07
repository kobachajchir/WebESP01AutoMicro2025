import { useMemo } from "react";
import ConditionStatus, { ConditionCheckbox } from "../../components/ConditionStatus";
import { formatScreenCodeHex } from "../../types/ScreenTypes";
import { OLED_CANVAS_SCREEN_CODE } from "./oledCanvasProtocol";
import {
 OLED_CANVAS_BYTES,
 OLED_CANVAS_HEIGHT,
 OLED_CANVAS_WIDTH,
 rasterizeOledDocument,
 unpackPageMajor,
} from "./oledCanvasRasterizer";
import type { EditorDocument } from "./types";
import { useOledCanvasTransfer } from "./useOledCanvasTransfer";

export default function OledCanvasTransferPanel({ document }: { document: EditorDocument }) {
 const raster = useMemo(() => rasterizeOledDocument(document), [document]);
 const transfer = useOledCanvasTransfer();
 const progress = Math.round((transfer.state.progressBytes * 100) / OLED_CANVAS_BYTES);
 const isTestMode = transfer.apiV1Ready && transfer.cachedMode === 0x02;
 const isOledCanvasScreen = transfer.apiV1Ready && transfer.cachedScreenCode === OLED_CANVAS_SCREEN_CODE;
 const readyCount = [transfer.apiV1Ready, transfer.canStart, isTestMode, isOledCanvasScreen].filter(Boolean).length;

 return (
 <section className="app-panel-strong mt-4 grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
 <div className="flex flex-col gap-4">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <div className="home-kicker">
 Pantalla del vehículo
 </div>
 <h3 className="mt-1 text-xl font-black text-[var(--ui-text)]">Enviar diseño al OLED</h3>
 <p className="mt-2 max-w-2xl text-sm text-[var(--ui-muted)]">
 Revisá los requisitos y enviá la vista previa. El envío se confirma cuando el vehículo termina de actualizar la pantalla.
 </p>
 </div>
 <span className="rounded-full border border-[var(--ui-ring)] bg-[var(--ui-panel)] px-3 py-1 font-mono text-xs text-[var(--ui-muted)]">
 CRC32 {raster.crc32Hex}
 </span>
 </div>

 <div className="oled-transfer-conditions">
 <div className="condition-summary mb-4">
 <div className="condition-summary__title">
 <ConditionCheckbox checked={readyCount === 4} />
 <div>
 <h4>Preparación del envío</h4>
 <p>Los estados se vuelven a comprobar al enviar.</p>
 </div>
 </div>
 <span className="condition-summary__count" role="status">{readyCount} de 4 listos</span>
 </div>

 <div className="condition-status-grid condition-status-grid--four" aria-label="Requisitos de envío al OLED">
 <ConditionStatus
 label="Conexión compatible"
 checked={transfer.apiV1Ready}
 detail={
 transfer.apiV1Ready
 ? "Vehículo conectado y envío disponible"
 : transfer.capabilityAvailable
 ? "Esperando conexión con el vehículo"
 : "Conectá un vehículo con soporte OLED Canvas"
 }
 />
 <ConditionStatus
 label="Sesión autorizada"
 checked={transfer.canStart}
 confirmed={transfer.apiV1Ready}
 detail={transfer.canStart ? "PIN confirmado por el vehículo" : transfer.apiV1Ready ? "Ingresá el PIN del vehículo" : "Esperando conexión con el vehículo"}
 />
 <ConditionStatus
 label="Modo TEST"
 checked={isTestMode}
 confirmed={transfer.apiV1Ready && transfer.cachedMode !== null}
 detail={
 isTestMode
 ? "Modo de prueba confirmado"
 : !transfer.apiV1Ready || transfer.cachedMode === null
 ? "Modo del vehículo sin confirmar"
 : `Seleccioná TEST · actual: ${formatCarModeValue(transfer.cachedMode)}`
 }
 />
 <ConditionStatus
 label="OLED Canvas abierto"
 checked={isOledCanvasScreen}
 confirmed={transfer.apiV1Ready && transfer.cachedScreenCode !== null}
 detail={
 isOledCanvasScreen
 ? "Pantalla de destino confirmada"
 : !transfer.apiV1Ready || transfer.cachedScreenCode === null
 ? "Pantalla del vehículo sin confirmar"
 : "Abrí Testeo > Pantalla > OLED Canvas"
 }
 />
 </div>
 </div>

 <div className="rounded-2xl border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/45 p-4">
 <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-[var(--ui-muted)]">
 <span>{transfer.state.message}</span>
 <span>{transfer.state.progressBytes}/{OLED_CANVAS_BYTES}</span>
 </div>
 <div className="h-2 overflow-hidden rounded-full bg-[var(--ui-panel)]">
 <div
 className={`h-full rounded-full ${transfer.state.phase === "error" ? "bg-rose-500" : "bg-cyan-400"}`}
 style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
 />
 </div>
 {transfer.state.error ? (
 <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
 {transfer.state.error}
 </p>
 ) : null}
 {!transfer.capabilityAvailable ? (
 <p className="mt-3 text-xs text-amber-200">
 El firmware del vehículo debe admitir el envío de diseños a OLED Canvas.
 </p>
 ) : null}
 <p className="mt-3 text-xs text-[var(--ui-subtle)]">
 El envío requiere una sesión autorizada, modo TEST y la pantalla OLED Canvas abierta en el vehículo.
 </p>
 </div>

 <div className="flex flex-wrap gap-3">
 <button
 type="button"
 className="app-button px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
 disabled={!transfer.canStart || transfer.active}
 onClick={() => { void transfer.send(raster).catch(() => undefined); }}
 >
 Enviar diseño
 </button>
 {transfer.active ? (
 <button
 type="button"
 className="app-button--ghost px-5 py-3 text-sm font-bold text-rose-100"
 onClick={() => { void transfer.cancel("Transferencia cancelada por el usuario"); }}
 >
 Cancelar
 </button>
 ) : null}
 </div>
 </div>

 <div className="grid gap-4">
 <FramebufferPreview title="Vista previa del diseño" framebuffer={raster.framebuffer} />
 {transfer.confirmedFramebuffer ? (
 <FramebufferPreview
 title={`Último envío confirmado · CRC ${transfer.confirmedCrc32 ?? "--------"}`}
 framebuffer={transfer.confirmedFramebuffer}
 confirmed
 />
 ) : null}
 <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-xs text-cyan-100">
 Destino: TEST / Testeo &gt; Pantalla &gt; OLED Canvas / {formatScreenCodeHex(OLED_CANVAS_SCREEN_CODE)}
 </div>
 </div>
 </section>
 );
}

function formatCarModeValue(value: number): string {
 if (value === 0x00) return "IDLE";
 if (value === 0x01) return "FOLLOW";
 if (value === 0x02) return "TEST";
 return `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
}

function FramebufferPreview({
 title,
 framebuffer,
 confirmed = false,
}: {
 title: string;
 framebuffer: Uint8Array;
 confirmed?: boolean;
}) {
 const path = useMemo(() => framebufferPath(framebuffer), [framebuffer]);
 return (
 <figure className={`rounded-2xl border p-3 ${confirmed ? "border-emerald-400/25 bg-emerald-400/5" : "border-cyan-300/15 bg-[var(--ui-bg-0)]/55"}`}>
 <figcaption className="mb-2 text-xs font-semibold text-[var(--ui-muted)]">{title}</figcaption>
 <svg
 viewBox={`0 0 ${OLED_CANVAS_WIDTH} ${OLED_CANVAS_HEIGHT}`}
 role="img"
 aria-label={title}
 className="block aspect-[2/1] w-full rounded-md border border-cyan-300/20 bg-[var(--ui-bg-0)]"
 shapeRendering="crispEdges"
 >
 <path d={path} fill="#dffcff" />
 </svg>
 </figure>
 );
}

function framebufferPath(framebuffer: Uint8Array): string {
 const pixels = unpackPageMajor(framebuffer);
 const segments: string[] = [];
 for (let y = 0; y < OLED_CANVAS_HEIGHT; y += 1) {
 let runStart: number | null = null;
 for (let x = 0; x < OLED_CANVAS_WIDTH; x += 1) {
 const enabled = pixels[y * OLED_CANVAS_WIDTH + x] === 1;
 if (enabled && runStart === null) runStart = x;
 if ((!enabled || x === OLED_CANVAS_WIDTH - 1) && runStart !== null) {
 const end = enabled && x === OLED_CANVAS_WIDTH - 1 ? x + 1 : x;
 segments.push(`M${runStart} ${y}h${end - runStart}v1h-${end - runStart}z`);
 runStart = null;
 }
 }
 }
 return segments.join("");
}
