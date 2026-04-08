import {
  COMMAND_GROUPS,
  FRAME_COMMANDS,
  INPUT_CLASS,
  NODE_OPTIONS,
  NOTE_CLASS,
  SMALL_LABEL_CLASS,
} from "../catalog";
import { Panel } from "../ui";
import type { CommandDefinition } from "../types";

interface BuilderColumnProps {
  source: string;
  destination: string;
  commandKey: string;
  currentCommand?: CommandDefinition;
  fieldValues: Record<string, string>;
  nonHexFields: CommandDefinition["fields"];
  hexFields: CommandDefinition["fields"];
  manualPayload: string;
  onSourceChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onCommandChange: (value: string) => void;
  onFieldValueChange: (id: string, value: string) => void;
  onManualPayloadChange: (value: string) => void;
}

export function BuilderColumn(props: BuilderColumnProps) {
  const {
    source,
    destination,
    commandKey,
    currentCommand,
    fieldValues,
    nonHexFields,
    hexFields,
    manualPayload,
    onSourceChange,
    onDestinationChange,
    onCommandChange,
    onFieldValueChange,
    onManualPayloadChange,
  } = props;

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Routing">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div>
            <label htmlFor="protocol-src" className={SMALL_LABEL_CLASS}>Origen (src)</label>
            <select id="protocol-src" className={INPUT_CLASS} value={source} onChange={(event) => onSourceChange(event.target.value)}>
              {NODE_OPTIONS.map((option) => (
                <option key={`src-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="protocol-dst" className={SMALL_LABEL_CLASS}>Destino (dst)</label>
            <select id="protocol-dst" className={INPUT_CLASS} value={destination} onChange={(event) => onDestinationChange(event.target.value)}>
              {NODE_OPTIONS.map((option) => (
                <option key={`dst-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </Panel>

      <Panel
        title="Comando"
        headerRight={
          <span
            className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
              currentCommand?.fields.length ? "bg-amber-500/15 text-amber-200" : "bg-cyan-500/15 text-cyan-200"
            }`}
          >
            {currentCommand?.fields.length ? "Con payload" : "Sin payload"}
          </span>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="protocol-command" className={SMALL_LABEL_CLASS}>Seleccionar comando</label>
            <select id="protocol-command" className={INPUT_CLASS} value={commandKey} onChange={(event) => onCommandChange(event.target.value)}>
              {COMMAND_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.commands
                    .filter((key) => Boolean(FRAME_COMMANDS[key]))
                    .map((key) => (
                      <option key={key} value={key}>
                        {key} {FRAME_COMMANDS[key].name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className={NOTE_CLASS}>
            <p className="font-medium text-slate-200">{currentCommand?.name}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">{currentCommand?.desc}</p>
          </div>
        </div>
      </Panel>

      {currentCommand?.fields.length ? (
        <Panel title="Parametros">
          <div className="space-y-4">
            {nonHexFields.map((field) => (
              <div key={field.id}>
                <label htmlFor={`field-${field.id}`} className={SMALL_LABEL_CLASS}>{field.label}</label>
                {field.type === "select" ? (
                  <select
                    id={`field-${field.id}`}
                    className={INPUT_CLASS}
                    value={fieldValues[field.id] ?? ""}
                    onChange={(event) => onFieldValueChange(field.id, event.target.value)}
                  >
                    {field.options?.map((option) => (
                      <option key={`${field.id}-${option.value}`} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : field.type === "u8" ? (
                  <input
                    id={`field-${field.id}`}
                    className={INPUT_CLASS}
                    type="number"
                    min={0}
                    max={255}
                    value={fieldValues[field.id] ?? ""}
                    onChange={(event) => onFieldValueChange(field.id, event.target.value)}
                  />
                ) : (
                  <input
                    id={`field-${field.id}`}
                    className={INPUT_CLASS}
                    type="text"
                    placeholder={field.placeholder}
                    value={fieldValues[field.id] ?? ""}
                    onChange={(event) => onFieldValueChange(field.id, event.target.value)}
                  />
                )}
              </div>
            ))}

            {hexFields.length > 0 ? (
              <div className={`grid gap-4 ${hexFields.length === 4 ? "grid-cols-2 2xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"}`}>
                {hexFields.map((field) => (
                  <div key={field.id}>
                    <label htmlFor={`field-${field.id}`} className={SMALL_LABEL_CLASS}>{field.label}</label>
                    <input
                      id={`field-${field.id}`}
                      className={INPUT_CLASS}
                      type="text"
                      placeholder={field.placeholder}
                      value={fieldValues[field.id] ?? ""}
                      onChange={(event) => onFieldValueChange(field.id, event.target.value)}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <Panel title="Payload manual (avanzado)">
        <div className="space-y-3">
          <div>
            <label htmlFor="manual-payload" className={SMALL_LABEL_CLASS}>Bytes hex separados por espacio</label>
            <input
              id="manual-payload"
              type="text"
              className={INPUT_CLASS}
              placeholder="Ej: 01 4D 0A"
              value={manualPayload}
              onChange={(event) => onManualPayloadChange(event.target.value)}
            />
          </div>
          <div className={NOTE_CLASS}>
            Si completas este campo, sobreescribe el payload construido a partir de los parametros del comando seleccionado.
          </div>
        </div>
      </Panel>
    </div>
  );
}
