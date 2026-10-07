import { useId } from "react";
import type { BeamGroup, BeamOpacities, BeamVisibility } from "../features/ir/beamVisualSettings";
import SensorDisclosure from "./SensorDisclosure";

const GROUPS: Array<{ key: BeamGroup; label: string }> = [
  { key: "objects", label: "Haz objetos" },
  { key: "line", label: "Haz líneas" },
];

export default function SensorBeamControls({ opacities, visibility, onOpacityChange, onVisibilityChange }: {
  opacities: BeamOpacities;
  visibility: BeamVisibility;
  onOpacityChange: (group: BeamGroup, opacity: number) => void;
  onVisibilityChange: (group: BeamGroup, visible: boolean) => void;
}) {
  const id = useId();
  return <SensorDisclosure title="Haces" detail="Configuración visual" defaultExpanded={false} className="sensor-beam-controls">
    <div className="sensor-beam-controls__grid">
      {GROUPS.map(({ key, label }) => <div className="sensor-beam-control" key={key}>
        <div className="sensor-beam-control__header">
          <label htmlFor={`${id}-${key}`}>{label}</label>
          <label className="sensor-beam-control__visibility">
            <input type="checkbox" checked={visibility[key]} aria-label={`Mostrar ${label.toLowerCase()}`}
              onChange={(event) => onVisibilityChange(key, event.target.checked)} />
            Mostrar
          </label>
        </div>
        <div className="sensor-beam-control__slider">
          <input id={`${id}-${key}`} type="range" min={0} max={100} step={1}
            value={Math.round(opacities[key] * 100)} aria-valuetext={`${Math.round(opacities[key] * 100)} por ciento de opacidad`}
            onChange={(event) => onOpacityChange(key, Number(event.target.value) / 100)} />
          <output htmlFor={`${id}-${key}`}>{Math.round(opacities[key] * 100)}%</output>
        </div>
      </div>)}
    </div>
    <p className="sensor-beam-controls__help">Estos controles ajustan el dibujo de los haces IR.</p>
  </SensorDisclosure>;
}
