// src/components/PinScreen.tsx
import { motion, AnimatePresence } from "framer-motion";
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
 const [retrySeconds, setRetrySeconds] = useState(0);

 const safeDigitsCount = Math.max(1, digitsCount);
 const valid = useMemo(() => {
 const re = new RegExp(`^\\d{${safeDigitsCount}}$`);
 return re.test(pin);
 }, [pin, safeDigitsCount]);

 useEffect(() => {
 setPin("");
 setStatus("idle");
 setFailure(null);
 setRetrySeconds(0);
 window.setTimeout(() => pinRef.current?.focus(), 50);
 }, [safeDigitsCount, title]);

 useEffect(() => {
 if (!failure?.blocked) {
 setRetrySeconds(0);
 return;
 }

 const retryAfterMs = Math.max(1000, failure.retryAfterMs ?? 60000);
 const retryAt = Date.now() + retryAfterMs;
 const updateCountdown = () => {
 setRetrySeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
 };

 updateCountdown();
 const countdownId = window.setInterval(updateCountdown, 1000);
 return () => window.clearInterval(countdownId);
 }, [failure]);

 function handlePinChange(value: string) {
 setStatus("idle");
 setFailure(null);
 setPin(value.replace(/\D/g, "").slice(0, safeDigitsCount));
 }

 function resetAttempt() {
 if (failure?.blocked && retrySeconds > 0) return;
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

 const failureTitle = failure
 ? getPinFailureTitle(failure)
 : "No se pudo validar el PIN";

 return (
 <div
 className="flex h-full w-full flex-col items-center justify-center p-6 relative
 bg-[var(--ui-bg-0)] text-[var(--ui-text)]
 selection:bg-cyan-500/30"
 >
 {canClose && onClose && (
 <motion.button
 whileTap={{ scale: 0.95 }}
 type="button"
 onClick={onClose}
 className="absolute right-4 top-4 rounded-md border border-[var(--ui-ring)] px-3 py-2 text-sm font-semibold text-[var(--ui-text)] transition hover:border-[var(--ui-ring)] hover:text-[var(--ui-text)]"
 aria-label="Cerrar"
 title="Cerrar"
 >
 Cerrar
 </motion.button>
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
 <p className="mt-3 max-w-sm text-center text-sm text-[var(--ui-muted)]">
 {subtitle}
 </p>

 <motion.form
 layout
 className="mt-8 flex w-full flex-col items-center gap-5"
 onSubmit={(event) => {
 event.preventDefault();
 sendAttempt();
 }}
 >
 <AnimatePresence mode="wait">
 {failure ? (
 <motion.div
 key="error-view"
 initial={{ opacity: 0, scale: 0.95, y: 10 }}
 animate={{ opacity: 1, scale: 1, y: 0, x: [-10, 10, -8, 8, -5, 5, 0] }}
 exit={{ opacity: 0, scale: 0.95, y: -10 }}
 transition={{ duration: 0.4 }}
 className="flex w-full flex-col items-center gap-5"
 >
 <div
 className="w-full rounded-md border border-rose-300/30 bg-rose-500/10 p-4"
 role="alert"
 aria-live="assertive"
 >
 <div className="flex items-start gap-3">
 <span
 className="flex size-9 shrink-0 items-center justify-center rounded-full border border-rose-200/30 bg-rose-300/10 text-lg font-black text-rose-100"
 aria-hidden="true"
 >
 !
 </span>
 <div className="min-w-0 text-left">
 <p className="text-lg font-black text-rose-100">
 {failureTitle}
 </p>
 <p className="mt-1 text-sm text-rose-100/90">
 {failure.message ?? errorMessage}
 </p>
 </div>
 </div>

 {failure.authSource === "stm32" && (
 <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
 <FeedbackStep label="WebSocket" value="Conectado" tone="ok" />
 <FeedbackStep label="ESP" value="Respondió" tone="ok" />
 <FeedbackStep label="STM32" value={failure.blocked ? "Bloqueado" : "Rechazó"} tone="error" />
 </div>
 )}

 {failure.attemptsLeft !== null && failure.attemptsLeft !== undefined && (
 <div className="mt-4 rounded-md border border-[var(--ui-ring)] bg-[var(--ui-panel-strong)] p-3">
 <div className="flex items-center justify-between gap-3 text-sm">
 <span className="text-[var(--ui-muted)]">Intentos restantes</span>
 <strong className={failure.attemptsLeft <= 1 ? "text-amber-200" : "text-[var(--ui-text)]"}>
 {failure.attemptsLeft} de 3
 </strong>
 </div>
 <div className="mt-2 grid grid-cols-3 gap-2" aria-hidden="true">
 {Array.from({ length: 3 }).map((_, index) => (
 <span
 key={index}
 className={`h-1.5 rounded-full ${index < (failure.attemptsLeft ?? 0) ? "bg-amber-300" : "bg-[var(--ui-bg-2)]"}`}
 />
 ))}
 </div>
 </div>
 )}

 {failure.blocked && (
 <p className="mt-4 rounded-md border border-amber-300/30 bg-amber-400/10 p-3 text-center text-sm font-semibold text-amber-100">
 {retrySeconds > 0
 ? `Esperá ${retrySeconds} s antes de volver a intentar.`
 : "El tiempo de espera terminó; ya podés volver a intentar."}
 </p>
 )}
 </div>

 <button
 type="button"
 className="app-button w-full px-4 py-3 text-base font-bold"
 onClick={resetAttempt}
 disabled={failure.blocked === true && retrySeconds > 0}
 >
 {failure.blocked && retrySeconds > 0
 ? `Reintentar en ${retrySeconds} s`
 : "Volver a intentar"}
 </button>
 </motion.div>
 ) : (
 <motion.div
 key="input-view"
 initial={{ opacity: 0, scale: 0.95, y: 10 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: -10 }}
 transition={{ duration: 0.3 }}
 className="flex w-full flex-col items-center gap-5"
 >
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

 <motion.button
 whileTap={{ scale: 0.98 }}
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
 pin[index] ? "text-cyan-200" : "text-[var(--ui-subtle)]"
 }`}
 >
 <AnimatePresence mode="popLayout">
 <motion.span
 key={pin[index] ? "filled" : "empty"}
 initial={{ scale: 0.5, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.5, opacity: 0 }}
 transition={{ type: "spring", bounce: 0.5, duration: 0.3 }}
 >
 {pin[index] ? "*" : index + 1}
 </motion.span>
 </AnimatePresence>
 </span>
 ))}
 </motion.button>

 <div
 className={`w-full rounded-md border p-3 text-left ${
 status === "loading"
 ? "border-cyan-300/30 bg-cyan-400/10"
 : "border-[var(--ui-ring)] bg-[var(--ui-panel)]"
 }`}
 role="status"
 aria-live="polite"
 >
 <div className="flex items-center gap-2">
 <span
 className={`size-2 rounded-full ${status === "loading" ? "animate-pulse bg-cyan-300" : "bg-emerald-300"}`}
 aria-hidden="true"
 />
 <strong className={status === "loading" ? "text-cyan-100" : "text-[var(--ui-text)]"}>
 {status === "loading" ? loadingMessage : "Listo para validar"}
 </strong>
 </div>
 <p className="mt-1 text-sm text-[var(--ui-muted)]">
 {status === "loading"
 ? "Enviando la solicitud al ESP y esperando la decisión del STM32/F4."
 : idleMessage}
 </p>
 </div>

 <button
 type="submit"
 disabled={!valid || status === "loading"}
 className="app-button w-full px-4 py-3 text-base font-bold"
 >
 {status === "loading" ? loadingMessage : submitLabel}
 </button>
 </motion.div>
 )}
 </AnimatePresence>
 </motion.form>
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
 ...result,
 ok: false,
 reason: result.reason ?? "unknown",
 message: result.message ?? fallbackMessage,
 };
}

function getPinFailureTitle(failure: PinAuthResult): string {
 if (failure.blocked) return "Acceso temporalmente bloqueado";

 switch (failure.reason) {
 case "invalid-pin":
 return failure.authSource === "stm32" ? "PIN rechazado por el STM32" : "PIN incorrecto";
 case "timeout":
 return "La validación agotó el tiempo";
 case "busy":
 return "El sistema está ocupado";
 case "transport-error":
 return "Sin comunicación con la placa";
 case "bad-request":
 return "Solicitud de PIN inválida";
 case "grant-rejected":
 return "Autorización no confirmada";
 default:
 return "No se pudo validar el PIN";
 }
}

function FeedbackStep({
 label,
 value,
 tone,
}: {
 label: string;
 value: string;
 tone: "ok" | "error";
}) {
 return (
 <div className="rounded-md border border-[var(--ui-ring)] bg-[var(--ui-panel-strong)] p-2">
 <span className="block text-[var(--ui-muted)]">{label}</span>
 <strong className={tone === "ok" ? "mt-1 block text-emerald-200" : "mt-1 block text-rose-200"}>
 {value}
 </strong>
 </div>
 );
}
