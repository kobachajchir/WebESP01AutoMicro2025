import React, { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";

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
 /** Título/tooltip del control */
 title?: string;
 /** Contenido opcional para mostrar dentro del thumb (ico/text) */
 thumbContent?: (checked: boolean) => React.ReactNode;
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
 title = "",
 thumbContent,
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
 thumbOn: 20,
 thumbOff: 4,
 };
 case "lg":
 return {
 track: "w-14 h-8",
 thumb: "size-7",
 thumbOn: 28,
 thumbOff: 4,
 };
 case "md":
 default:
 return {
 track: "w-11 h-6",
 thumb: "size-5",
 thumbOn: 20,
 thumbOff: 0,
 };
 }
 }, [size]);

 return (
 <div className="flex flex-row gap-2 items-center">
 {labels && (
 <span
 className={`text-sm font-medium ${
 !isOn ? "text-cyan-400" : "text-[var(--ui-muted)]"
 } ${labelClassName}`}
 >
 {labelOff}
 </span>
 )}
 <motion.button
 type="button"
 role="switch"
 aria-checked={isOn}
 aria-label={ariaLabel}
 title={title}
 aria-disabled={disabled || undefined}
 disabled={disabled}
 onClick={toggle}
 onKeyDown={onKeyDown}
 whileTap={disabled ? {} : { scale: 0.93 }}
 initial={false}
 animate={{
 backgroundColor: isOn ? "rgba(8, 145, 178, 0.9)" : "rgba(51, 65, 85, 0.7)",
 }}
 transition={{ type: "spring", bounce: 0, duration: 0.4 }}
 className={[
 "inline-flex items-center rounded-full p-0.5 relative",
 "ring-1 ring-[var(--ui-ring)]",
 cfg.track,
 disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
 // enfoque accesible en nuestra app
 "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ui-bg-0)]",
 className,
 ].join(" ")}
 data-state={isOn ? "on" : "off"}
 >
 <motion.span
 initial={false}
 animate={{
 x: isOn ? cfg.thumbOn : cfg.thumbOff,
 backgroundColor: isOn ? "#ffffff" : "#e2e8f0",
 }}
 transition={{ type: "spring", bounce: 0, duration: 0.4 }}
 className={[
 "rounded-full shadow-md",
 cfg.thumb
 ].join(" ")}
 />
 {thumbContent ? (
 <span className="absolute pointer-events-none select-none">
 {thumbContent(isOn)}
 </span>
 ) : null}
 </motion.button>
 {labels && (
 <span
 className={`text-sm font-medium ${
 isOn ? "text-cyan-400" : "text-[var(--ui-muted)]"
 } ${labelClassName}`}
 >
 {labelOn}
 </span>
 )}
 </div>
 );
}
