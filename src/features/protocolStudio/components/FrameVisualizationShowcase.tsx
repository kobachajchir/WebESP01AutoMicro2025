import { NODE_NAMES } from "../catalog";
import { bytesToHex, hx } from "../utils";
import { Panel } from "../ui";
import type { BuilderData, CommandDefinition } from "../types";

interface FrameVisualizationShowcaseProps {
  builderData: BuilderData | null;
  builderError: string;
  commandKey: string;
  currentCommand?: CommandDefinition;
}

export function FrameVisualizationShowcase({ builderData, builderError, commandKey, currentCommand }: FrameVisualizationShowcaseProps) {
  if (!builderData) return (
    <Panel title="Estructura del paquete">
      <div className="studio-empty-state">
        <span className="studio-eyebrow">UNER v2</span>
        <h3>Prepara el paquete</h3>
        <p>{builderError || "Elige un comando y completa sus parámetros para ver cada campo del protocolo."}</p>
      </div>
    </Panel>
  );
  const source = builderData.route >> 4;
  const destination = builderData.route & 15;
  const payloadEnd = 9 + builderData.payload.length;
  const segments = [
    { role: "header", label: "Cabecera", offset: "00–03", bytes: [0x55, 0x4e, 0x45, 0x52], note: "Firma UNER", detail: "Estos cuatro bytes identifican el inicio del paquete: U, N, E, R." },
    { role: "meta", label: "Longitud", offset: "04", bytes: [builderData.len], note: `${builderData.len} bytes de datos`, detail: "Indica el tamaño del payload, sin contar la cabecera ni el checksum." },
    { role: "meta", label: "Token · versión", offset: "05–06", bytes: [0x3a, 0x02], note: "UNER v2", detail: "Token fijo 3A seguido de la versión 02 del protocolo." },
    { role: "route", label: "Ruta", offset: "07", bytes: [builderData.route], note: `${hx(source)} → ${hx(destination)}`, detail: `Origen: ${NODE_NAMES[source] ?? hx(source)}. Destino: ${NODE_NAMES[destination] ?? hx(destination)}. El nibble alto es el origen y el bajo, el destino.` },
    { role: "command", label: "Comando", offset: "08", bytes: [builderData.cmd], note: currentCommand?.name ?? commandKey, detail: currentCommand?.desc ?? "Identifica la operación que representa este paquete." },
    { role: "payload", label: "Datos", offset: builderData.payload.length ? `09–${String(payloadEnd - 1).padStart(2,"0")}` : "Sin bytes", bytes: builderData.payload, note: `${builderData.payload.length} bytes`, detail: "Contenido de la solicitud, respuesta o evento. Su formato depende del comando y de la dirección de la comunicación." },
    { role: "checksum", label: "Checksum", offset: String(payloadEnd).padStart(2,"0"), bytes: [builderData.chk], note: "XOR", detail: "XOR de todos los bytes anteriores. Permite detectar errores en el paquete." },
  ];
  return (
    <Panel title="Estructura del paquete" headerRight={<span className="studio-badge">{builderData.frame.length} bytes</span>}>
      <div className="studio-packet-heading">
        <div><span className="studio-eyebrow">UNER v2 · {commandKey}</span><h3>{currentCommand?.name ?? "Paquete"}</h3></div>
        <p>Lee de izquierda a derecha. Abre un campo para ver su significado.</p>
      </div>
      <div className="studio-packet-grid">
        {segments.map(segment => (
          <details key={segment.role + segment.label} className={`studio-packet-field studio-packet-field--${segment.role}`}>
            <summary>
              <span className="studio-packet-field-heading"><span>{segment.label}</span><span className="studio-byte-offset">{segment.offset}</span></span>
              <span className="studio-packet-value">{segment.bytes.length ? bytesToHex(segment.bytes) : "Vacío"}</span>
              <span className="studio-packet-note">{segment.note}</span>
              <span className="studio-packet-disclosure">Detalles <span aria-hidden="true">⌄</span></span>
            </summary>
            <p className="studio-packet-description">{segment.detail}</p>
          </details>
        ))}
      </div>
      <p className="studio-caption">Los números de cada campo indican su posición en bytes, empezando en 0. Los colores agrupan campos; las etiquetas explican su función.</p>
    </Panel>
  );
}
