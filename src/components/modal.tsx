import React, { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useModalScrollLock } from "../hooks/useModalScrollLock";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** opcional: cerrar con click en overlay (default true) */
  closeOnOverlayClick?: boolean;
  /** Desactiva el foco inicial en controles y su navegación por teclado. */
  keyboardNavigationEnabled?: boolean;
  keyboardScopeRef?: React.RefObject<HTMLDivElement | null>;
  containerClassnames?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  closeOnOverlayClick = true,
  keyboardNavigationEnabled = true,
  keyboardScopeRef,
  containerClassnames = ""
}) => {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const reduceMotion = useReducedMotion();
  const internalDialogRef = useRef<HTMLDivElement>(null);
  const dialogRef = keyboardScopeRef ?? internalDialogRef;
  const onCloseRef = useRef(onClose);
  const closedPanel = {
    opacity: 0,
    transform: reduceMotion ? "translateY(0) scale(1)" : isMobile ? "translateY(100%)" : "translateY(12px) scale(0.97)",
  };
  useModalScrollLock(isOpen);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // El foco permanece dentro del diálogo y vuelve al disparador al cerrarlo.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!keyboardNavigationEnabled && dialog) {
      const previousTabIndexes = new Map<HTMLElement, string | null>();
      const removeControlFocus = () => {
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex], [contenteditable], summary, audio[controls], video[controls]',
        ).forEach((element) => {
          if (!previousTabIndexes.has(element)) {
            previousTabIndexes.set(element, element.getAttribute("tabindex"));
          }
          element.setAttribute("tabindex", "-1");
        });
      };
      const keepDialogFocus = () => dialog.focus({ preventScroll: true });
      const onFocusIn = (event: FocusEvent) => {
        if (event.target !== dialog) keepDialogFocus();
      };
      const onPointerDown = (event: PointerEvent) => {
        event.preventDefault();
        keepDialogFocus();
      };
      removeControlFocus();
      document.getSelection()?.removeAllRanges();
      keepDialogFocus();
      const observer = new MutationObserver(removeControlFocus);
      observer.observe(dialog, { childList: true, subtree: true });
      dialog.addEventListener("focusin", onFocusIn);
      dialog.addEventListener("pointerdown", onPointerDown, true);
      return () => {
        observer.disconnect();
        dialog.removeEventListener("focusin", onFocusIn);
        dialog.removeEventListener("pointerdown", onPointerDown, true);
        previousTabIndexes.forEach((value, element) => {
          if (value === null) element.removeAttribute("tabindex");
          else element.setAttribute("tabindex", value);
        });
        previousFocus?.focus({ preventScroll: true });
      };
    }
    const getFocusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((element) => element.getClientRects().length > 0);
    (getFocusables()[0] ?? dialog)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key !== "Tab") return;
      const focusables = getFocusables();
      if (!focusables.length) {
        e.preventDefault();
        dialog?.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (dialog && !dialog.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [isOpen, keyboardNavigationEnabled, dialogRef]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="dialog-layer"
          className="app-shell app-modal-root fixed inset-0 z-50 flex items-center justify-center sm:items-center"
          variants={{ closed: { opacity: 0 }, open: { opacity: 1 } }}
          initial="closed"
          animate="open"
          exit="closed"
          transition={{ duration: reduceMotion ? 0.12 : 0.24, ease: [0.23, 1, 0.32, 1] }}
        >
          {/* Overlay (fade in/out) */}
          <button
            aria-hidden="true"
            tabIndex={-1}
            type="button"
            onClick={closeOnOverlayClick ? onClose : undefined}
            className="app-dialog__overlay absolute inset-0 cursor-default"
          />

          {/* Panel (Drawer en mobile, Dialog en desktop) */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            variants={{ closed: closedPanel, open: { opacity: 1, transform: "translateY(0) scale(1)" } }}
            transition={{ duration: reduceMotion ? 0.12 : 0.24, ease: [0.23, 1, 0.32, 1] }}
            className={`app-dialog relative z-10 overflow-hidden flex flex-col ${containerClassnames}`}
          >
            {/* Botón cerrar */}
            <button
              type="button"
              onClick={onClose}
              tabIndex={keyboardNavigationEnabled ? undefined : -1}
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
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default Modal;
