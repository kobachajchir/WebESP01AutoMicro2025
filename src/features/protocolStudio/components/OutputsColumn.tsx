import { BUTTON_CLASS, GHOST_BUTTON_CLASS, SMALL_LABEL_CLASS } from "../catalog";
import { hx } from "../utils";
import { ColoredFrame, InfoCell, Panel } from "../ui";
import type { BuilderData } from "../types";

interface OutputsColumnProps {
  builderData: BuilderData | null;
  builderError: string;
  outputs: {
    plain: string;
    realterm: string;
    c: string;
    py: string;
  };
  flashMessage: string;
  onCopyOutput: (format: "plain" | "realterm" | "c" | "py") => void;
  onValidateInTranslator: () => void;
}

export function OutputsColumn(props: OutputsColumnProps) {
  const { builderData, builderError, outputs, flashMessage, onCopyOutput, onValidateInTranslator } = props;

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Informacion del frame">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCell label="CMD" value={builderData ? hx(builderData.cmd) : "-"} tone="cyan" />
          <InfoCell
            label="LEN"
            value={builderData ? `${builderData.len} ${builderData.len === 1 ? "byte" : "bytes"}` : "-"}
            tone="emerald"
          />
          <InfoCell label="ROUTE" value={builderData ? hx(builderData.route) : "-"} tone="violet" />
          <InfoCell label="CHK" value={builderData ? hx(builderData.chk) : "-"} tone="rose" />
        </div>
      </Panel>

      <Panel title="Frame - visualizacion">
        <div className="space-y-4">
          <ColoredFrame bytes={builderData?.frame ?? []} />
          <div className="flex flex-wrap gap-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-sm border border-cyan-400/30 bg-cyan-500/20" />
              Header
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-sm border border-emerald-400/30 bg-emerald-500/20" />
              LEN
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-sm border border-amber-400/30 bg-amber-500/20" />
              TOKEN / VER
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-sm border border-violet-400/30 bg-violet-500/20" />
              ROUTE
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-sm border border-rose-400/30 bg-rose-500/20" />
              CMD
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-sm border border-sky-400/30 bg-sky-500/20" />
              Payload
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-sm border border-slate-400/30 bg-slate-500/20" />
              CHK (XOR)
            </span>
          </div>
        </div>
      </Panel>

      <Panel title="Salidas">
        <div className="space-y-4">
          <div className="grid gap-4 2xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className={SMALL_LABEL_CLASS}>Hex limpio</div>
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 font-mono text-sm text-slate-100">
                {outputs.plain || "-"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className={SMALL_LABEL_CLASS}>Formato RealTerm</div>
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 font-mono text-sm text-slate-100">
                {outputs.realterm || "-"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className={SMALL_LABEL_CLASS}>Array C / Arduino</div>
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 font-mono text-sm text-slate-100">
                {outputs.c || "-"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className={SMALL_LABEL_CLASS}>Python bytes literal</div>
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 font-mono text-sm text-slate-100">
                {outputs.py || "-"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className={`refresh-btn ${BUTTON_CLASS}`} type="button" onClick={onValidateInTranslator} disabled={!outputs.plain}>
              Validar en traductor
            </button>
            <button className={`refresh-btn ${BUTTON_CLASS}`} type="button" onClick={() => onCopyOutput("plain")} disabled={!outputs.plain}>
              Copiar hex
            </button>
            <button className={GHOST_BUTTON_CLASS} type="button" onClick={() => onCopyOutput("realterm")} disabled={!outputs.realterm}>
              Copiar RealTerm
            </button>
            <button className={GHOST_BUTTON_CLASS} type="button" onClick={() => onCopyOutput("c")} disabled={!outputs.c}>
              Copiar C/Arduino
            </button>
            <button className={GHOST_BUTTON_CLASS} type="button" onClick={() => onCopyOutput("py")} disabled={!outputs.py}>
              Copiar Python
            </button>
          </div>

          {flashMessage ? <p className="text-sm font-medium text-emerald-300">{flashMessage}</p> : null}
          {builderError ? <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{builderError}</div> : null}
        </div>
      </Panel>
    </div>
  );
}
