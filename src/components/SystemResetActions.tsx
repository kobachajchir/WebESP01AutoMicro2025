import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { EspRebootMode } from "../api/UnerFrameV2";
import { useUser } from "../contexts/UserContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { ESP_COMMANDS } from "../protocol/wsApi";

type ResetTarget = "esp" | "stm";
type PendingAction = ResetTarget | "profile";
type ExtensionProfileId = 0 | 1;

type ExtensionProfileResponse = {
 success?: boolean;
 profileId?: number;
 profile?: string;
 rebootRequired?: boolean;
 rebooting?: boolean;
 reconnectDelayMs?: number;
};

const EXTENSION_PROFILES: ReadonlyArray<{
 id: ExtensionProfileId;
 label: string;
 description: string;
}> = [
 { id: 0, label: "NRF24", description: "Habilita SPI2 y control para el transceptor NRF24L01." },
 { id: 1, label: "Beeper", description: "Reserva PB12 para el zumbador y mantiene NRF deshabilitado." },
];

function isExtensionProfileId(value: unknown): value is ExtensionProfileId {
 return value === 0 || value === 1;
}

function profileLabel(profileId: ExtensionProfileId | null) {
 return EXTENSION_PROFILES.find((profile) => profile.id === profileId)?.label ?? "Sin confirmar";
}

type ResetStatus = {
 tone: "idle" | "loading" | "success" | "error";
 message: string;
 frame?: string;
};

export default function SystemResetActions() {
 const { connected, request } = useWebSocket();
 const { logout } = useUser();
 const [espRebootMode, setEspRebootMode] = useState<EspRebootMode>("normal");
 const [pendingTarget, setPendingTarget] = useState<PendingAction | null>(null);
 const [selectedProfile, setSelectedProfile] = useState<ExtensionProfileId>(0);
 const [currentProfile, setCurrentProfile] = useState<ExtensionProfileId | null>(null);
 const [profileLoading, setProfileLoading] = useState(false);
 const [profileError, setProfileError] = useState<string | null>(null);
 const [status, setStatus] = useState<ResetStatus>({
 tone: "idle",
 message: "Envia el pedido como paquete WebSocket con payload.data hacia la ESP.",
 });

 useEffect(() => {
 if (!connected) {
 setCurrentProfile(null);
 return;
 }

 let cancelled = false;
 setProfileLoading(true);
 setProfileError(null);
 void request<ExtensionProfileResponse>(
 ESP_COMMANDS.GET_EXTENSION_PROFILE,
 {},
 { timeoutMs: 2_500 },
 )
 .then((response) => {
 if (cancelled) return;
 if (!isExtensionProfileId(response.profileId)) {
 throw new Error("La F4 respondió un perfil de extensión inválido.");
 }
 setCurrentProfile(response.profileId);
 setSelectedProfile(response.profileId);
 })
 .catch((cause) => {
 if (cancelled) return;
 setProfileError(
 cause instanceof Error
 ? cause.message
 : "No se pudo consultar el perfil activo de la F4.",
 );
 })
 .finally(() => {
 if (!cancelled) setProfileLoading(false);
 });

 return () => {
 cancelled = true;
 };
 }, [connected, request]);

 async function sendReset(target: ResetTarget) {
    if (!connected) {
      toast.error("No hay WebSocket activo para enviar el reinicio.");
      setStatus({
        tone: "error",
        message: "No hay WebSocket activo para enviar el reinicio.",
      });
      return;
    }

    const espModeLabel =
      target === "esp"
        ? espRebootMode === "ap"
          ? "modo AP"
          : "modo red / STA"
        : null;

    setPendingTarget(target);
    const loadingMessage =
      target === "esp"
        ? `Solicitando reinicio ESP en ${espModeLabel}...`
        : "Solicitando reinicio del STM32...";
    setStatus({
      tone: "loading",
      message: loadingMessage,
    });
    const toastId = toast.loading(loadingMessage);

    try {
      await request(
        target === "esp" ? ESP_COMMANDS.REBOOT_ESP : ESP_COMMANDS.REBOOT_STM,
        target === "esp" ? { mode: espRebootMode } : {},
        { timeoutMs: 3_500 },
      );
      if (target === "stm") logout();
      const successMessage =
        target === "esp"
          ? `Reinicio ESP confirmado (${espModeLabel}).`
          : "RESET_MCU confirmado por el STM32.";
      setStatus({
        tone: "success",
        message:
          target === "esp"
            ? `Reinicio ESP confirmado para ${espModeLabel}; es normal que el enlace se corte.`
            : "RESET_MCU confirmado por el STM32. La sesion PIN se cerrara durante el reinicio.",
      });
      toast.success(successMessage, { id: toastId });
    } catch (cause) {
      const errorMessage =
        cause instanceof Error
          ? cause.message
          : target === "esp"
            ? `El ESP no confirmo el reinicio en ${espModeLabel}.`
            : "El STM32 no confirmo rebootStm.";
      setStatus({
        tone: "error",
        message: errorMessage,
      });
      toast.error(errorMessage, { id: toastId });
    } finally {
      setPendingTarget(null);
    }
  }

  async function applyExtensionProfile() {
    if (!connected) {
      toast.error("No hay WebSocket activo para cambiar el perfil de hardware.");
      setStatus({
        tone: "error",
        message: "No hay WebSocket activo para cambiar el perfil de hardware.",
      });
      return;
    }

    setPendingTarget("profile");
    setProfileError(null);
    const label = profileLabel(selectedProfile);
    const loadingMessage = `Guardando perfil ${label} y reiniciando F4...`;
    setStatus({
      tone: "loading",
      message: loadingMessage,
    });
    const toastId = toast.loading(loadingMessage);

    try {
      const response = await request<ExtensionProfileResponse>(
        ESP_COMMANDS.REBOOT_INTO_PROFILE,
        { profileId: selectedProfile },
        { timeoutMs: 5_000 },
      );
      if (response.success !== true || response.rebooting !== true) {
        throw new Error("La F4 rechazó el cambio de perfil y no se reinició.");
      }

      const confirmedProfile = isExtensionProfileId(response.profileId)
        ? response.profileId
        : selectedProfile;
      const reconnectDelayMs =
        typeof response.reconnectDelayMs === "number" &&
        Number.isFinite(response.reconnectDelayMs)
          ? Math.min(10_000, Math.max(1_000, response.reconnectDelayMs))
          : 3_000;

      setCurrentProfile(confirmedProfile);
      setStatus({
        tone: "loading",
        message: `Perfil ${profileLabel(confirmedProfile)} guardado. Esperando que la F4 vuelva a iniciar...`,
      });

      await new Promise((resolve) => window.setTimeout(resolve, reconnectDelayMs));
      setStatus({
        tone: "success",
        message: "La F4 debe volver con el perfil nuevo. Iniciá sesión nuevamente para verificarlo.",
      });
      toast.success(`Perfil ${profileLabel(confirmedProfile)} guardado. F4 reiniciada.`, {
        id: toastId,
      });
      logout();
    } catch (cause) {
      const errorMessage =
        cause instanceof Error
          ? cause.message
          : "No se pudo aplicar el perfil de extensión.";
      setStatus({
        tone: "error",
        message: errorMessage,
      });
      toast.error(errorMessage, { id: toastId });
    } finally {
      setPendingTarget(null);
    }
  }

 return (
 <section className="app-panel-strong mt-4 p-4">
 <div className="mb-4">
 <h3 className="font-bold text-[var(--ui-text)]">Reinicio de placas</h3>
 <p className="mt-1 text-sm text-[var(--ui-muted)]">
 La web usa comandos API v1 y espera la confirmacion del destino antes de informar el reinicio.
 </p>
 </div>

 <div className="flex flex-col gap-4 md:flex-row">
 <div className="flex flex-1 flex-col gap-3 rounded-md border border-[var(--ui-ring)] bg-[var(--ui-panel-strong)] p-4">
 <div>
 <h4 className="text-sm font-semibold uppercase text-[var(--ui-text)]">
 ESP
 </h4>
 <p className="mt-1 text-sm text-[var(--ui-muted)]">
 Elegi como debe volver a arrancar antes de reiniciar el modulo.
 </p>
 </div>

 <label className="flex flex-col gap-2 text-sm font-medium text-[var(--ui-text)]">
 Modo de arranque
 <select
 className="app-input px-3 py-2 text-sm"
 value={espRebootMode}
 onChange={(event) =>
 setEspRebootMode(event.target.value as EspRebootMode)
 }
 disabled={!connected}
 >
 <option value="normal">Modo red / STA (con fallback configurado)</option>
 <option value="ap">Modo AP</option>
 </select>
 </label>

 <button
 type="button"
 className="app-button px-4 py-2 font-semibold"
 onClick={() => sendReset("esp")}
 disabled={!connected || pendingTarget !== null}
 >
 {pendingTarget === "esp" ? "Reiniciando ESP..." : "Reiniciar ESP"}
 </button>
 </div>

 <div className="flex flex-1 flex-col gap-3 rounded-md border border-[var(--ui-ring)] bg-[var(--ui-panel-strong)] p-4">
 <div>
 <h4 className="text-sm font-semibold uppercase text-[var(--ui-text)]">
 STM32
 </h4>
 <p className="mt-1 text-sm text-[var(--ui-muted)]">
 Envia rebootStm a la ESP; la ESP lo traduce a RESET_MCU 0x19 y espera ACK del F4.
 </p>
 </div>

 <button
 type="button"
 className="app-button app-button--danger mt-auto px-4 py-2 font-semibold"
 onClick={() => sendReset("stm")}
 disabled={!connected || pendingTarget !== null}
 >
 {pendingTarget === "stm" ? "Reiniciando STM32..." : "Reiniciar STM32"}
 </button>
 </div>
 </div>

 <div className="mt-4 rounded-md border border-cyan-300/15 bg-cyan-950/10 p-4">
 <div className="flex flex-col gap-4 md:flex-row md:items-end">
 <div className="flex-1">
 <div className="flex flex-wrap items-center gap-2">
 <h4 className="text-sm font-semibold uppercase text-[var(--ui-text)]">
 Perfil de hardware F4
 </h4>
 <span className="rounded-full border border-[var(--ui-ring)] bg-[var(--ui-panel)] px-2 py-1 text-xs text-[var(--ui-muted)]">
 Activo: {profileLoading ? "Consultando..." : profileLabel(currentProfile)}
 </span>
 </div>
 <p className="mt-2 text-sm text-[var(--ui-muted)]">
 Seleccioná la asignación de pines. La F4 guarda el perfil y se reinicia
 para inicializar los periféricos correspondientes.
 </p>

 <label className="mt-3 flex flex-col gap-2 text-sm font-medium text-[var(--ui-text)]">
 Módulo conectado
 <select
 className="app-input px-3 py-2 text-sm"
 value={selectedProfile}
 onChange={(event) =>
 setSelectedProfile(Number(event.target.value) as ExtensionProfileId)
 }
 disabled={!connected || profileLoading || pendingTarget !== null}
 >
 {EXTENSION_PROFILES.map((profile) => (
 <option key={profile.id} value={profile.id}>
 {profile.label} — {profile.description}
 </option>
 ))}
 </select>
 </label>

 {profileError ? (
 <p className="mt-2 text-sm text-rose-300">{profileError}</p>
 ) : null}
 </div>

 <button
 type="button"
 className="app-button min-w-48 px-4 py-2 font-semibold"
 onClick={applyExtensionProfile}
 disabled={!connected || profileLoading || pendingTarget !== null}
 >
 {pendingTarget === "profile" ? (
 <span className="inline-flex items-center gap-2">
 <span
 className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-100/30 border-t-cyan-100"
 aria-hidden="true"
 />
 Aplicando perfil...
 </span>
 ) : (
 "Aplicar y reiniciar F4"
 )}
 </button>
 </div>
 </div>

 <ResetStatusNote status={status} />
 </section>
 );
}

function ResetStatusNote({ status }: { status: ResetStatus }) {
 const toneClass =
 status.tone === "success"
 ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
 : status.tone === "error"
 ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
 : status.tone === "loading"
 ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
 : "border-[var(--ui-ring)] bg-[var(--ui-panel)] text-[var(--ui-muted)]";

 return (
 <div className={`mt-4 rounded-md border p-3 text-sm ${toneClass}`} role="status">
 <p>{status.message}</p>
 {status.frame ? <code className="mt-2 block break-all">{status.frame}</code> : null}
 </div>
 );
}
