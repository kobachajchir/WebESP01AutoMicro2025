import { useState } from "react";
import {
  buildEspRebootRequestFrame,
  buildStmResetFrame,
  type EspRebootMode,
  formatUnerFrameHex,
} from "../api/UnerFrameV2";
import { useWebSocket } from "../hooks/useWebSocket";

type ResetTarget = "esp" | "stm";

type ResetStatus = {
  tone: "idle" | "success" | "error";
  message: string;
  frame?: string;
};

export default function SystemResetActions() {
  const { connected, sendRaw } = useWebSocket();
  const [espRebootMode, setEspRebootMode] = useState<EspRebootMode>("normal");
  const [status, setStatus] = useState<ResetStatus>({
    tone: "idle",
    message: "Envia el pedido como paquete WebSocket con payload.data hacia la ESP.",
  });

  function sendReset(target: ResetTarget) {
    if (!connected) {
      setStatus({
        tone: "error",
        message: "No hay WebSocket activo para enviar el reinicio.",
      });
      return;
    }

    const frame =
      target === "esp"
        ? buildEspRebootRequestFrame(espRebootMode)
        : buildStmResetFrame();
    const frameHex = formatUnerFrameHex(frame);
    const label = target === "esp" ? "CMD_REBOOT_ESP" : "CMD_RESET_MCU";
    const eventName = target === "esp" ? "resetEsp" : "resetMcu";
    const espModeLabel =
      target === "esp"
        ? espRebootMode === "ap"
          ? "modo AP"
          : "modo normal"
        : null;

    try {
      sendRaw(frame, {
        action: eventName,
        cmd: label,
        ...(target === "esp" ? { bootMode: espRebootMode } : {}),
      });
      setStatus({
        tone: "success",
        message:
          target === "esp"
            ? `Paquete WebSocket ${eventName} enviado. La ESP debe reiniciar en ${espModeLabel}; es normal que el enlace se corte durante el reinicio.`
            : `Paquete WebSocket ${eventName} enviado. Es normal que el enlace se corte durante el reinicio del STM32.`,
        frame: frameHex,
      });
    } catch {
      setStatus({
        tone: "error",
        message:
          target === "esp"
            ? `No se pudo enviar el pedido de reinicio ESP en ${espModeLabel}.`
            : `No se pudo enviar el pedido de reinicio STM32.`,
        frame: frameHex,
      });
    }
  }

  return (
    <section className="app-panel-strong mt-4 p-4">
      <div className="mb-4">
        <h3 className="font-bold text-white">Reinicio de placas</h3>
        <p className="mt-1 text-sm text-slate-400">
          La web manda <code>stmPacket</code> con <code>data</code>. Para ESP el payload ahora incluye el modo de arranque; para STM32 se mantiene el reset directo.
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex flex-1 flex-col gap-3 rounded-md border border-white/10 bg-slate-950/30 p-4">
          <div>
            <h4 className="text-sm font-semibold uppercase text-white">
              ESP
            </h4>
            <p className="mt-1 text-sm text-slate-400">
              Elegi como debe volver a arrancar antes de reiniciar el modulo.
            </p>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            Modo de arranque
            <select
              className="app-input px-3 py-2 text-sm"
              value={espRebootMode}
              onChange={(event) =>
                setEspRebootMode(event.target.value as EspRebootMode)
              }
              disabled={!connected}
            >
              <option value="normal">Reiniciar</option>
              <option value="ap">Reiniciar en modo AP</option>
            </select>
          </label>

          <button
            type="button"
            className="app-button px-4 py-2 font-semibold"
            onClick={() => sendReset("esp")}
            disabled={!connected}
          >
            Reiniciar ESP
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 rounded-md border border-white/10 bg-slate-950/30 p-4">
          <div>
            <h4 className="text-sm font-semibold uppercase text-white">
              STM32
            </h4>
            <p className="mt-1 text-sm text-slate-400">
              Reinicio directo del microcontrolador principal.
            </p>
          </div>

          <button
            type="button"
            className="app-button app-button--danger mt-auto px-4 py-2 font-semibold"
            onClick={() => sendReset("stm")}
            disabled={!connected}
          >
            Reiniciar STM32
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
        : "border-white/10 bg-white/5 text-slate-300";

  return (
    <div className={`mt-4 rounded-md border p-3 text-sm ${toneClass}`} role="status">
      <p>{status.message}</p>
      {status.frame ? <code className="mt-2 block break-all">{status.frame}</code> : null}
    </div>
  );
}
