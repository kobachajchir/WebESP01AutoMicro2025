import {
  DOC_FIRMWARE_PROFILES,
  type DocFirmwareTarget,
} from "./docsContent";

const TARGETS: DocFirmwareTarget[] = ["web", "f4"];

interface DocsFirmwareSelectorProps {
  activeTarget: DocFirmwareTarget;
  onChange: (target: DocFirmwareTarget) => void;
}

export default function DocsFirmwareSelector({
  activeTarget,
  onChange,
}: DocsFirmwareSelectorProps) {
  return (
    <div
      className="docs-firmware-switcher flex items-center gap-1 rounded-full p-1"
      role="group"
      aria-label="Seleccionar perspectiva de documentación"
    >
      {TARGETS.map((target) => {
        const profile = DOC_FIRMWARE_PROFILES[target];
        const active = activeTarget === target;

        return (
          <button
            key={target}
            type="button"
            className="docs-firmware-toggle min-w-[150px] rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            style={segmentedButtonStyle(active)}
            aria-pressed={active}
            onClick={() => onChange(target)}
          >
            {profile.label}
          </button>
        );
      })}
    </div>
  );
}

function segmentedButtonStyle(active: boolean) {
  return active
    ? {
        background: "var(--ui-accent)",
        color: "var(--ui-action-hover-ink)",
        boxShadow: "0 12px 28px rgba(34,211,238,0.28)",
      }
    : {
        background: "transparent",
        color: "var(--ui-text)",
      };
}
