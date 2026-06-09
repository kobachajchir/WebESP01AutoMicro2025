// src/components/PinScreen.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { PinAuthResult, PinSubmitResult } from "../types/PinAuthTypes";

type PinScreenStatus = "idle" | "loading" | "error";

interface PinScreenProps {
  title?: string;
  subtitle?: string;
  kicker?: string;
  submitLabel?: string;
  digitsCount?: number;
  canClose?: boolean;
  onClose?: () => void;
  onSubmit: (pin: string) => Promise<PinSubmitResult> | PinSubmitResult;
  successAction?: () => void;
  idleMessage?: string;
  errorMessage?: string;
  loadingMessage?: string;
}

export default function PinScreen({
  title = "Ingresar PIN",
  subtitle = "Usa el PIN de 4 digitos guardado en el ESP.",
  kicker = "Acceso seguro",
  submitLabel = "Entrar",
  digitsCount = 4,
  canClose = false,
  onClose,
  onSubmit,
  successAction,
  idleMessage = "Escribi los digitos con el teclado.",
  errorMessage = "No se pudo validar el PIN.",
  loadingMessage = "Validando...",
}: PinScreenProps) {
  const pinRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<PinScreenStatus>("idle");
  const [failure, setFailure] = useState<PinAuthResult | null>(null);

  const safeDigitsCount = Math.max(1, digitsCount);
  const valid = useMemo(() => {
    const re = new RegExp(`^\\d{${safeDigitsCount}}$`);
    return re.test(pin);
  }, [pin, safeDigitsCount]);

  useEffect(() => {
    setPin("");
    setStatus("idle");
    setFailure(null);
    window.setTimeout(() => pinRef.current?.focus(), 50);
  }, [safeDigitsCount, title]);

  function handlePinChange(value: string) {
    setStatus("idle");
    setFailure(null);
    setPin(value.replace(/\D/g, "").slice(0, safeDigitsCount));
  }

  function resetAttempt() {
    setPin("");
    setStatus("idle");
    setFailure(null);
    window.setTimeout(() => pinRef.current?.focus(), 50);
  }

  async function sendAttempt() {
    if (!valid || status === "loading") return;

    setStatus("loading");
    setFailure(null);

    try {
      const result = normalizePinSubmitResult(await onSubmit(pin), errorMessage);
      setStatus(result.ok ? "idle" : "error");

      if (result.ok) {
        successAction?.();
        return;
      }

      setFailure(result);
    } catch (error) {
      console.error("[PinScreen] error ejecutando onSubmit", error);
      setStatus("error");
      setFailure({
        ok: false,
        reason: "transport-error",
        message: "No se pudo completar la validacion con la ESP.",
      });
    }
  }

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center p-6 relative
                 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100
                 selection:bg-cyan-500/30"
    >
      {canClose && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
          aria-label="Cerrar"
          title="Cerrar"
        >
          Cerrar
        </button>
      )}

      <div className="app-panel flex w-full max-w-md flex-col items-center p-6 sm:p-8">
        <div className="app-kicker mb-5">{kicker}</div>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="mb-4 size-20 drop-shadow-sm"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            className="text-cyan-300"
            fillRule="evenodd"
            d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3A5.25 5.25 0 0 0 12 1.5Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
            clipRule="evenodd"
          />
        </svg>

        <h1 className="app-title text-center text-3xl">{title}</h1>
        <p className="mt-3 max-w-sm text-center text-sm text-slate-300">
          {subtitle}
        </p>

        <form
          className="mt-8 flex w-full flex-col items-center gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            sendAttempt();
          }}
        >
          {failure ? (
            <div className="flex w-full flex-col items-center gap-5">
              <div
                className="w-full rounded-md border border-rose-300/30 bg-rose-500/10 p-4 text-center"
                role="alert"
              >
                <p className="text-lg font-black text-rose-100">
                  {failure.reason === "invalid-pin"
                    ? "PIN incorrecto"
                    : "No se pudo validar el PIN"}
                </p>
                <p className="mt-2 text-sm text-rose-100/90">
                  {failure.message ?? errorMessage}
                </p>
              </div>

              <button
                type="button"
                className="app-button w-full px-4 py-3 text-base font-bold"
                onClick={resetAttempt}
              >
                Volver a intentar
              </button>
            </div>
          ) : (
            <>
              <label htmlFor="pin" className="sr-only">
                PIN
              </label>

              <input
                ref={pinRef}
                id="pin"
                value={pin}
                onChange={(event) => handlePinChange(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={safeDigitsCount}
                autoComplete="one-time-code"
                autoFocus
                className="sr-only"
              />

              <button
                type="button"
                className="grid w-full gap-3"
                style={{
                  gridTemplateColumns: `repeat(${safeDigitsCount}, minmax(0, 1fr))`,
                }}
                onClick={() => pinRef.current?.focus()}
                aria-label="Editar PIN"
              >
                {Array.from({ length: safeDigitsCount }).map((_, index) => (
                  <span
                    key={index}
                    className={`app-panel-strong flex aspect-square items-center justify-center text-3xl font-black ${
                      pin[index] ? "text-cyan-200" : "text-slate-500"
                    }`}
                  >
                    {pin[index] ? "*" : index + 1}
                  </span>
                ))}
              </button>

              {status === "loading" ? (
                <p className="text-sm font-semibold text-cyan-200">
                  {loadingMessage}
                </p>
              ) : (
                <p className="text-sm text-slate-400">{idleMessage}</p>
              )}

              <button
                type="submit"
                disabled={!valid || status === "loading"}
                className="app-button w-full px-4 py-3 text-base font-bold"
              >
                {status === "loading" ? loadingMessage : submitLabel}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function normalizePinSubmitResult(
  result: PinSubmitResult,
  fallbackMessage: string,
): PinAuthResult {
  if (typeof result === "boolean") {
    return result
      ? { ok: true }
      : {
          ok: false,
          reason: "unknown",
          message: fallbackMessage,
        };
  }

  if (result.ok) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: result.reason ?? "unknown",
    message: result.message ?? fallbackMessage,
    code: result.code,
  };
}
