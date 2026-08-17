import { BUTTON_CLASS, GHOST_BUTTON_CLASS, SMALL_LABEL_CLASS } from "../catalog";
import { Panel } from "../ui";
import type { BuilderData, CommandDefinition } from "../types";
import { FrameVisualizationShowcase } from "./FrameVisualizationShowcase";

interface OutputsColumnProps {
  builderData: BuilderData | null;
  builderError: string;
  commandKey: string;
  currentCommand?: CommandDefinition;
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
  const {
    builderData,
    builderError,
    commandKey,
    currentCommand,
    outputs,
    flashMessage,
    onCopyOutput,
    onValidateInTranslator,
  } = props;

  return (
    <div className="flex flex-col gap-6">
      <FrameVisualizationShowcase
        builderData={builderData}
        builderError={builderError}
        commandKey={commandKey}
        currentCommand={currentCommand}
      />

      <Panel title="Salidas">
        <div className="space-y-4">
          <div className="grid gap-4 2xl:grid-cols-2">
            <div className="rounded-2xl border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/35 p-4">
              <div className={SMALL_LABEL_CLASS}>Hex limpio</div>
              <div className="rounded-xl border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/50 p-3 font-mono text-sm text-[var(--ui-text)]">
                {outputs.plain || "-"}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/35 p-4">
              <div className={SMALL_LABEL_CLASS}>Formato RealTerm</div>
              <div className="rounded-xl border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/50 p-3 font-mono text-sm text-[var(--ui-text)]">
                {outputs.realterm || "-"}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/35 p-4">
              <div className={SMALL_LABEL_CLASS}>Array C / Arduino</div>
              <div className="rounded-xl border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/50 p-3 font-mono text-sm text-[var(--ui-text)]">
                {outputs.c || "-"}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/35 p-4">
              <div className={SMALL_LABEL_CLASS}>Python bytes literal</div>
              <div className="rounded-xl border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/50 p-3 font-mono text-sm text-[var(--ui-text)]">
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
        </div>
      </Panel>
    </div>
  );
}
