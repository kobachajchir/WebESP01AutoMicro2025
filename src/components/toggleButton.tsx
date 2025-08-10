import React, { useCallback, useMemo, useState } from "react";

type Size = "sm" | "md" | "lg";

interface ToggleButtonProps {
  /** Estado controlado (si lo pasás, el componente no maneja su estado interno) */
  checked?: boolean;
  /** Estado inicial en modo no controlado */
  defaultChecked?: boolean;
  /** Notifica cambios (se llama en ambos modos) */
  onChange?: (checked: boolean) => void;
  /** Callbacks legacy (se disparan junto a onChange) */
  onActivate?: () => void;
  onDeactivate?: () => void;

  /** Deshabilita interacción */
  disabled?: boolean;
  /** Tamaño visual */
  size?: Size;
  /** Clase extra para el contenedor */
  className?: string;
  /** Accesibilidad: etiqueta del switch si no hay label visible */
  ariaLabel?: string;
  labels?: boolean; // Si se quieren mostrar etiquetas de "On" y "Off"
  labelOn?: string; // Texto para el estado "On"
  labelOff?: string; // Texto para el estado "Off"
  labelClassName?: string; // Clase extra para las etiquetas
}

/** Toggle con estilo de la app (slate/cyan), accesible y animado */
export default function ToggleButton({
  checked,
  defaultChecked = false,
  onChange,
  onActivate,
  onDeactivate,
  disabled = false,
  size = "md",
  className = "",
  ariaLabel = "Alternar",
  labels = false, // Si se quieren mostrar etiquetas de "On" y "Off"
  labelOn = "On",
  labelOff = "Off",
  labelClassName = "",
}: ToggleButtonProps) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(defaultChecked);
  const isOn = isControlled ? !!checked : internal;

  const setIsOn = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
      next ? onActivate?.() : onDeactivate?.();
    },
    [isControlled, onChange, onActivate, onDeactivate]
  );

  const toggle = useCallback(() => {
    if (disabled) return;
    setIsOn(!isOn);
  }, [disabled, isOn, setIsOn]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
    [disabled, toggle]
  );

  // Dimensiones por tamaño
  const cfg = useMemo(() => {
    switch (size) {
      case "sm":
        return {
          track: "w-10 h-5",
          thumb: "size-4",
          thumbOn: "translate-x-5",
          thumbOff: "translate-x-1",
        };
      case "lg":
        return {
          track: "w-14 h-8",
          thumb: "size-7",
          thumbOn: "translate-x-7",
          thumbOff: "translate-x-1",
        };
      case "md":
      default:
        return {
          track: "w-11 h-6",
          thumb: "size-5",
          thumbOn: "translate-x-5",
          thumbOff: "translate-x-0",
        };
    }
  }, [size]);

  return (
    <div className="flex flex-row gap-2 items-center">
      {labels && (
        <span
          className={`text-sm font-medium ${
            !isOn ? "text-cyan-400" : "text-slate-400"
          } ${labelClassName}`}
        >
          {labelOff}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className={[
          "inline-flex items-center rounded-full p-0.5",
          "transition-colors duration-300 ease-out",
          "ring-1 ring-white/10",
          cfg.track,
          isOn
            ? "bg-cyan-600/90 hover:bg-cyan-600"
            : "bg-slate-700/70 hover:bg-slate-700",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          // enfoque accesible en nuestra app
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
          className,
        ].join(" ")}
        data-state={isOn ? "on" : "off"}
      >
        <span
          className={[
            "rounded-full shadow-md",
            // animación de movimiento y leve escala/blur para “punch”
            "motion-safe:transition-all motion-safe:duration-300",
            isOn
              ? `${cfg.thumb} ${cfg.thumbOn} bg-white`
              : `${cfg.thumb} ${cfg.thumbOff} bg-slate-200`,
          ].join(" ")}
          // micro-anim extra opcional con data-state (si querés tunear en CSS global)
        />
      </button>
      {labels && (
        <span
          className={`text-sm font-medium ${
            isOn ? "text-cyan-400" : "text-slate-400"
          } ${labelClassName}`}
        >
          {labelOn}
        </span>
      )}
    </div>
  );
}
