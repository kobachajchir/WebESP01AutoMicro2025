import React, { useEffect, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** opcional: cerrar con click en overlay (default true) */
  closeOnOverlayClick?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  closeOnOverlayClick = true,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay (fade in/out) */}
      <button
        aria-hidden="true"
        onClick={closeOnOverlayClick ? onClose : undefined}
        className={[
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          closing ? "opacity-0" : "opacity-100",
        ].join(" ")}
      />

      {/* Panel (in/out) */}
      <div
        role="dialog"
        aria-modal="true"
        className={[
          "relative z-10 w-11/12 md:w-1/2 max-w-2xl max-h-[80vh]",
          "rounded-2xl bg-white/90 backdrop-blur ring-1 ring-black/10 shadow-xl",
          "overflow-hidden flex flex-col",
          closing
            ? "motion-safe:animate-[modal-out_200ms_ease-in]"
            : "motion-safe:animate-[modal-in_220ms_ease-out]",
        ].join(" ")}
        onAnimationEnd={handlePanelAnimationEnd}
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 rounded-xl p-2 text-slate-500 transition-all duration-300 hover:text-red-400 hover:shadow-[inset_0_0_0_1px_theme('colors.red.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 flex items-center justify-center"
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
        <div className="p-6 overflow-auto flex-grow">{children}</div>
      </div>

      {/* Keyframes locales */}
      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); filter: blur(6px); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    filter: blur(0); }
        }
        @keyframes modal-out {
          from { opacity: 1; transform: translateY(0)   scale(1);    filter: blur(0); }
          to   { opacity: 0; transform: translateY(8px) scale(0.98); filter: blur(6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .motion-safe\\:animate-\\[modal-in_220ms_ease-out\\],
          .motion-safe\\:animate-\\[modal-out_200ms_ease-in\\] { animation: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Modal;
