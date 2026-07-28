import React, { useEffect, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** opcional: cerrar con click en overlay (default true) */
  closeOnOverlayClick?: boolean;
  containerClassnames?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  closeOnOverlayClick = true,
  containerClassnames = ""
}) => {
  const [mounted, setMounted] = useState(isOpen);
  const [closing, setClosing] = useState(false);

  // Monta para abrir; inicia animación de cierre para desmontar luego
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
    }
  }, [isOpen, mounted]);

  // ESC para cerrar
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closing) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, closing, onClose]);

  // Al terminar la animación de salida, desmonta
  const handlePanelAnimationEnd = () => {
    if (closing) {
      setMounted(false);
      setClosing(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="app-modal-root fixed inset-0 flex items-center justify-center">
      {/* Overlay (fade in/out) */}
      <button
        aria-hidden="true"
        tabIndex={-1}
        type="button"
        onClick={closeOnOverlayClick ? onClose : undefined}
        className={[
          "app-dialog__overlay transition-opacity duration-300",
          closing ? "opacity-0" : "opacity-100",
        ].join(" ")}
      />

      {/* Panel (in/out) */}
      <div
        role="dialog"
        aria-modal="true"
        className={[
          "app-dialog relative z-10",
          "overflow-hidden flex flex-col",
          closing
            ? "motion-safe:animate-[modal-out_200ms_ease-in]"
            : "motion-safe:animate-[modal-in_220ms_ease-out]",
        ].join(" ")}
        onAnimationEnd={handlePanelAnimationEnd}
      >
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          className="app-dialog__close z-30 absolute top-3 right-3 flex items-center justify-center rounded-xl p-2 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
          aria-label="Cerrar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-6"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Contenido */}
        <div className={`app-dialog__content p-6 overflow-auto flex-grow ${containerClassnames}`}>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
