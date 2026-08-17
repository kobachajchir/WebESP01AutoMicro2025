import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMediaQuery } from "../hooks/useMediaQuery";

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
  const isMobile = useMediaQuery("(max-width: 640px)");

  // ESC para cerrar
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="app-modal-root fixed inset-0 z-50 flex items-center justify-center sm:items-center">
          {/* Overlay (fade in/out) */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            aria-hidden="true"
            tabIndex={-1}
            type="button"
            onClick={closeOnOverlayClick ? onClose : undefined}
            className="app-dialog__overlay absolute inset-0 cursor-default"
          />

          {/* Panel (Drawer en mobile, Dialog en desktop) */}
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={
              isMobile
                ? { opacity: 0, y: "100%", scale: 1, filter: "blur(0px)" }
                : { opacity: 0, scale: 0.96, y: 12, filter: "blur(8px)" }
            }
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={
              isMobile
                ? { opacity: 0, y: "100%", scale: 1, filter: "blur(0px)" }
                : { opacity: 0, scale: 0.96, y: 12, filter: "blur(8px)" }
            }
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className={`app-dialog relative z-10 overflow-hidden flex flex-col ${containerClassnames}`}
          >
            {/* Pill visual de arrastre (solo en mobile, estético) */}
            <div className="flex h-6 w-full items-center justify-center sm:hidden shrink-0" aria-hidden="true">
              <div className="h-1.5 w-10 rounded-full bg-[var(--ui-panel-hover)] dark:bg-[var(--ui-panel-strong)]" />
            </div>

            {/* Botón cerrar */}
            <button
              type="button"
              onClick={onClose}
              className="app-dialog__close z-30 absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-100 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
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
            <div className="app-dialog__content p-4 sm:p-6 overflow-auto flex-grow h-full w-full">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
