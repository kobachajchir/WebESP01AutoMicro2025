import { useEffect, useMemo, useState, type FormEvent } from "react";
import Modal from "./modal";
import type { WifiCredentialsStatus } from "../types/WifiTypes";

const BUSY_STATUSES = new Set(["submitting", "connecting", "cancelling"]);

interface WifiCredentialsModalProps {
 isOpen: boolean;
 status: WifiCredentialsStatus;
 ssid: string | null;
 error: string | null;
 ip: string | null;
 timeoutMs: number | null;
 onSubmit: (ssid: string, password: string) => boolean;
 onCancel: () => boolean;
 onDismiss: () => void;
}

export default function WifiCredentialsModal({
 isOpen,
 status,
 ssid,
 error,
 ip,
 timeoutMs,
 onSubmit,
 onCancel,
 onDismiss,
}: WifiCredentialsModalProps) {
 const [password, setPassword] = useState("");

 useEffect(() => {
 if (isOpen) {
 setPassword("");
 }
 }, [isOpen, ssid]);

 const isBusy = BUSY_STATUSES.has(status);
 const canSubmit =
 Boolean(ssid) &&
 (status === "requested" || status === "failed" || status === "timeout");
 const canCancel =
 Boolean(ssid) &&
 status !== "success" &&
 status !== "cancelled" &&
 status !== "cancelling";

 const feedback = useMemo(
 () => getFeedback(status, error, ip, timeoutMs),
 [error, ip, status, timeoutMs],
 );

 const handleClose = () => {
 if (canCancel && !isBusy) {
 onCancel();
 return;
 }

 if (status === "success" || status === "failed" || status === "timeout") {
 onDismiss();
 }
 };

 const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
 event.preventDefault();

 if (!ssid || !canSubmit) {
 return;
 }

 onSubmit(ssid, password);
 };

 const handleCancel = () => {
 if (canCancel) {
 onCancel();
 return;
 }

 onDismiss();
 };

 return (
 <Modal
 isOpen={isOpen}
 onClose={handleClose}
 closeOnOverlayClick={!isBusy}
 containerClassnames="w-full"
 >
 <form className="flex w-full flex-col gap-5" onSubmit={handleSubmit}>
 <div>
 <div className="app-kicker mb-3">WiFi</div>
 <h2 className="text-2xl font-black text-[var(--ui-text)] md:text-3xl">
 Credenciales solicitadas
 </h2>
 <p className="mt-2 text-sm text-[var(--ui-muted)]">
 El ESP pidio la clave para continuar con la conexion.
 </p>
 </div>

 <div className="grid gap-4 md:grid-cols-2">
 <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--ui-text)]">
 SSID
 <input
 className="app-input px-3 py-2 text-sm"
 value={ssid ?? ""}
 readOnly
 aria-readonly="true"
 />
 </label>

 <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--ui-text)]">
 Password
 <input
 className="app-input px-3 py-2 text-sm"
 type="password"
 value={password}
 autoComplete="new-password"
 minLength={8}
 maxLength={63}
 disabled={!canSubmit || isBusy}
 placeholder="8 a 63 caracteres"
 onChange={(event) => setPassword(event.target.value)}
 />
 </label>
 </div>

 <div
 className={`rounded-md border px-3 py-2 text-sm ${
 feedback.tone === "success"
 ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
 : feedback.tone === "error"
 ? "border-rose-300/30 bg-rose-500/10 text-rose-100"
 : "border-cyan-300/25 bg-cyan-500/10 text-cyan-100"
 }`}
 role={feedback.tone === "error" ? "alert" : "status"}
 >
 {feedback.text}
 </div>

 <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
 <button
 type="button"
 className="app-button--ghost px-4 py-2 text-sm font-semibold"
 onClick={handleCancel}
 disabled={status === "cancelling" || status === "submitting"}
 >
 {status === "success" ? "Cerrar" : "Cancelar"}
 </button>

 {status !== "success" && status !== "cancelled" ? (
 <button
 type="submit"
 className="app-button px-4 py-2 text-sm font-semibold"
 disabled={!canSubmit || isBusy}
 >
 {status === "submitting"
 ? "Enviando..."
 : status === "connecting"
 ? "Conectando..."
 : "Setear credenciales"}
 </button>
 ) : null}
 </div>
 </form>
 </Modal>
 );
}

function getFeedback(
 status: string,
 error: string | null,
 ip: string | null,
 timeoutMs: number | null,
) {
 if (status === "requested") {
 return {
 tone: "info" as const,
 text: "Ingresa la clave real de la red solicitada.",
 };
 }

 if (status === "submitting") {
 return {
 tone: "info" as const,
 text: "Enviando credenciales al ESP...",
 };
 }

 if (status === "connecting") {
 return {
 tone: "info" as const,
 text: `Credenciales aceptadas. Esperando conexion${
 timeoutMs ? ` durante ${Math.round(timeoutMs / 1000)}s` : ""
 }...`,
 };
 }

 if (status === "success") {
 return {
 tone: "success" as const,
 text: ip ? `Conexion establecida. IP: ${ip}.` : "Conexion establecida.",
 };
 }

 if (status === "cancelling") {
 return {
 tone: "info" as const,
 text: "Cancelando solicitud en el ESP...",
 };
 }

 if (status === "cancelled") {
 return {
 tone: "error" as const,
 text: "Solicitud cancelada.",
 };
 }

 if (status === "timeout") {
 return {
 tone: "error" as const,
 text: error ?? "El ESP no pudo conectar antes del timeout.",
 };
 }

 if (status === "failed") {
 return {
 tone: "error" as const,
 text: error ?? "No se pudieron aplicar las credenciales.",
 };
 }

 return {
 tone: "info" as const,
 text: "Esperando solicitud del ESP.",
 };
}
