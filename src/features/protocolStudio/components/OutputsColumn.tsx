import { BUTTON_CLASS, SMALL_LABEL_CLASS } from "../catalog";
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
          <div className="studio-output-grid">
            {([
              { key: "plain", label: "Hexadecimal" },
              { key: "realterm", label: "RealTerm" },
              { key: "c", label: "C / Arduino" },
              { key: "py", label: "Python" },
            ] as const).map(({ key, label }) => (
              <div key={key} className="studio-output-card">
                <div className="studio-output-heading">
                  <span className={SMALL_LABEL_CLASS}>{label}</span>
                  <button type="button" className="studio-copy-button" onClick={() => onCopyOutput(key)} disabled={!outputs[key]} aria-label={`Copiar ${label}`}>Copiar</button>
                </div>
                <pre className="studio-code-output" tabIndex={0} aria-label={`Salida ${label}`}><code>{outputs[key] || "Completa el paquete para generar esta salida."}</code></pre>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button className={`refresh-btn ${BUTTON_CLASS}`} type="button" onClick={onValidateInTranslator} disabled={!outputs.plain}>
              Abrir en el traductor
            </button>
          </div>

          {flashMessage ? <p role="status" className="studio-success-message">{flashMessage}</p> : null}
        </div>
      </Panel>
    </div>
  );
}
