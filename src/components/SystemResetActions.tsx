import { useState } from "react";
import {
  buildEspRebootRequestFrame,
  buildStmResetFrame,
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
  const [status, setStatus] = useState<ResetStatus>({
    tone: "idle",
    message: "Envia el pedido como paquete WebSocket con payload.data para la ESP.",
  });

  function sendReset(target: ResetTarget) {
    if (!connected) {
      setStatus({
        tone: "error",
        message: "No hay WebSocket activo para enviar el reinicio.",
      });
      return;
    }

    const frame = target === "esp" ? buildEspRebootRequestFrame() : buildStmResetFrame();
    const frameHex = formatUnerFrameHex(frame);
    const label = target === "esp" ? "CMD_REBOOT_ESP" : "CMD_RESET_MCU";
    const eventName = target === "esp" ? "resetEsp" : "resetMcu";

    try {
      sendRaw(frame, { action: eventName, cmd: label });
      setStatus({
        tone: "success",
        message: `Paquete WebSocket ${eventName} enviado. La ESP debe despachar ${label}; es normal que el enlace se corte durante el reinicio.`,
        frame: frameHex,
      });
    } catch {
      setStatus({
        tone: "error",
        message: `No se pudo enviar el paquete ${eventName} por WebSocket.`,
        frame: frameHex,
      });
    }
  }

  return (
    <section className="app-panel-strong mt-4 p-4">
      <div className="mb-4">
        <h3 className="font-bold text-white">Reinicio de placas</h3>
        <p className="mt-1 text-sm text-slate-400">
          La web manda <code>stmPacket</code> con <code>data</code>. La ESP reenvia UNER con <code>src=0x02</code>, <code>dst=0x01</code>, <code>route=0x21</code>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="app-button px-4 py-2 font-semibold"
          onClick={() => sendReset("esp")}
          disabled={!connected}
        >
          Reiniciar ESP
        </button>
        <button
          type="button"
          className="app-button app-button--danger px-4 py-2 font-semibold"
          onClick={() => sendReset("stm")}
          disabled={!connected}
        >
          Reiniciar STM32
        </button>
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
