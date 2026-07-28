import { useMemo } from "react";
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
  const isTestMode = transfer.cachedMode === 0x02;
  const isOledCanvasScreen = transfer.cachedScreenCode === OLED_CANVAS_SCREEN_CODE;

  return (
    <section className="app-panel-strong mt-4 grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
              OLED Canvas transaccional
            </div>
            <h3 className="mt-1 text-xl font-black text-white">Enviar a OLED</h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Se rasteriza el documento vivo completo. La confirmacion aparece solo cuando F4 informa
              que termino las ocho paginas por I2C/DMA.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs text-slate-300">
            CRC32 {raster.crc32Hex}
          </span>
        </div>

        <div className="rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/[0.08] via-slate-950/45 to-slate-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
              <OledConditionGlyph />
            </span>
            <div>
              <h4 className="text-sm font-black text-white">Condiciones para enviar</h4>
              <p className="mt-0.5 text-xs text-slate-400">
                Cada marca refleja el estado cacheado actual antes del preflight final.
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <TransferCondition
              label="API v1"
              checked={transfer.apiV1Ready}
              detail={
                transfer.apiV1Ready
                  ? "Conectada y compatible con OLED Canvas"
                  : transfer.capabilityAvailable
                    ? "Esperando conexión WebSocket"
                    : "Capability OLED Canvas no disponible"
              }
            />
            <TransferCondition
              label="Modo TEST"
              checked={isTestMode}
              detail={
                isTestMode
                  ? "Modo actual confirmado: TEST"
                  : transfer.cachedMode === null
                    ? "Sin modo recibido desde la F4"
                    : `Modo actual: ${formatCarModeValue(transfer.cachedMode)}`
              }
            />
            <TransferCondition
              label="Pantalla actual OLED Canvas"
              checked={isOledCanvasScreen}
              detail={
                isOledCanvasScreen
                  ? formatScreenCodeHex(OLED_CANVAS_SCREEN_CODE)
                  : transfer.cachedScreenCode === null
                    ? "Sin pantalla recibida desde la F4"
                    : `Actual: ${formatScreenCodeHex(transfer.cachedScreenCode)}`
              }
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-300">
            <span>{transfer.state.message}</span>
            <span>{transfer.state.progressBytes}/{OLED_CANVAS_BYTES}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${transfer.state.phase === "error" ? "bg-rose-500" : "bg-cyan-400"}`}
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
              El ESP debe anunciar <code>hello.features.oledCanvas=true</code>.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">
            Al enviar se consultan de nuevo <code>getCarMode</code> y <code>getCurrentScreen</code>;
            estos indicadores cacheados son solo informativos.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="app-button px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!transfer.canStart || transfer.active}
            onClick={() => { void transfer.send(raster).catch(() => undefined); }}
          >
            Enviar a OLED
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
        <FramebufferPreview title="Framebuffer a enviar" framebuffer={raster.framebuffer} />
        {transfer.confirmedFramebuffer ? (
          <FramebufferPreview
            title={`Ultima mostrada - CRC ${transfer.confirmedCrc32 ?? "--------"}`}
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

function TransferCondition({
  label,
  checked,
  detail,
}: {
  label: string;
  checked: boolean;
  detail: string;
}) {
  return (
    <div
      className={`flex min-h-[76px] items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
        checked
          ? "border-emerald-300/25 bg-emerald-400/[0.07]"
          : "border-amber-300/20 bg-amber-400/[0.05]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        readOnly
        aria-label={`${label}: ${checked ? "cumplida" : "pendiente"}`}
        className="size-5 shrink-0 cursor-default accent-emerald-400"
      />
      <div className="min-w-0">
        <div className="text-xs font-black text-slate-100">{label}</div>
        <div className={`mt-1 text-[11px] leading-snug ${checked ? "text-emerald-200" : "text-amber-100/80"}`}>
          {detail}
        </div>
      </div>
    </div>
  );
}

function OledConditionGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 20h8M12 16v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="m8 10 2 2 5-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
    <figure className={`rounded-2xl border p-3 ${confirmed ? "border-emerald-400/25 bg-emerald-400/5" : "border-cyan-300/15 bg-slate-950/55"}`}>
      <figcaption className="mb-2 text-xs font-semibold text-slate-300">{title}</figcaption>
      <svg
        viewBox={`0 0 ${OLED_CANVAS_WIDTH} ${OLED_CANVAS_HEIGHT}`}
        role="img"
        aria-label={title}
        className="block aspect-[2/1] w-full rounded-md border border-cyan-300/20 bg-slate-950"
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
