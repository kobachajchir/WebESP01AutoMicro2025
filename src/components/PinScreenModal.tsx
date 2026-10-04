// src/components/PinScreenModal.tsx
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useModalScrollLock } from "../hooks/useModalScrollLock";
import PinScreen from "./PinScreen";
import type { PinSubmitResult } from "../types/PinAuthTypes";

interface PinScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  kicker?: string;
  submitLabel?: string;
  digitsCount?: number;
  canClose?: boolean;
  onSubmit: (pin: string) => Promise<PinSubmitResult> | PinSubmitResult;
  successAction?: () => void;
  idleMessage?: string;
  errorMessage?: string;
  loadingMessage?: string;
}

export default function PinScreenModal({
  isOpen,
  onClose,
  title,
  subtitle,
  kicker,
  submitLabel,
  digitsCount = 4,
  canClose = true,
  onSubmit,
  successAction,
  idleMessage,
  errorMessage,
  loadingMessage,
}: PinScreenModalProps) {
  const reduceMotion = useReducedMotion();
  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && canClose) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, canClose, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="pin-modal fixed inset-0 z-[9999]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.2, ease: [0.23, 1, 0.32, 1] }}
        >
          <div
            className="absolute inset-0 bg-[var(--ui-bg-0)]/80 backdrop-blur-sm"
            onClick={canClose ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            className="relative h-full w-full"
            initial={{ transform: reduceMotion ? "none" : "translateY(8px) scale(0.99)" }}
            animate={{ transform: "translateY(0) scale(1)" }}
            exit={{ transform: reduceMotion ? "none" : "translateY(8px) scale(0.99)" }}
            transition={{ duration: reduceMotion ? 0.12 : 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            <PinScreen
              title={title}
              subtitle={subtitle}
              kicker={kicker}
              submitLabel={submitLabel}
              digitsCount={digitsCount}
              canClose={canClose}
              onClose={onClose}
              onSubmit={onSubmit}
              successAction={successAction}
              idleMessage={idleMessage}
              errorMessage={errorMessage}
              loadingMessage={loadingMessage}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
