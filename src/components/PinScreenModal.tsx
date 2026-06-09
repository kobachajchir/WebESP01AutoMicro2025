// src/components/PinScreenModal.tsx
import { useEffect } from "react";
import { createPortal } from "react-dom";
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
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && canClose) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, canClose, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] h-screen w-screen">
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={canClose ? onClose : undefined}
        aria-hidden="true"
      />

      <div className="relative h-full w-full">
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
      </div>
    </div>,
    document.body,
  );
}
