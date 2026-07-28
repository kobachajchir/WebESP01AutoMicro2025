import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCarMode } from "../../contexts/CarModeContext";
import { useUser } from "../../contexts/UserContext";
import { useScreen } from "../../hooks/useScreen";
import { useWebSocket } from "../../hooks/useWebSocket";
import { ESP_COMMANDS } from "../../protocol/wsApi";
import { normalizeScreenReport } from "../../types/ScreenTypes";
import {
  OLED_CANVAS_SCREEN_CODE,
  buildOledCanvasBeginArgs,
  buildOledCanvasCancelArgs,
  buildOledCanvasChunkArgs,
  buildOledCanvasCommitArgs,
  shouldCancelOledCanvasForMode,
  shouldCancelOledCanvasForScreen,
  splitOledCanvasChunks,
  validateOledCanvasBeginResponse,
  validateOledCanvasCancelResponse,
  validateOledCanvasChunkResponse,
  validateOledCanvasCommitResponse,
  type OledCanvasCommitResponse,
} from "./oledCanvasProtocol";
import { OLED_CANVAS_BYTES, type OledCanvasRaster } from "./oledCanvasRasterizer";

export type OledCanvasTransferPhase =
  | "idle"
  | "preparing"
  | "uploading"
  | "waiting_f4"
  | "rendered"
  | "canceling"
  | "canceled"
  | "error";

export interface OledCanvasTransferState {
  phase: OledCanvasTransferPhase;
  progressBytes: number;
  message: string;
  error: string | null;
  transferId: number | null;
}

const INITIAL_STATE: OledCanvasTransferState = {
  phase: "idle",
  progressBytes: 0,
  message: "Listo para verificar y enviar",
  error: null,
  transferId: null,
};

class LocalCancellation extends Error {}

export function useOledCanvasTransfer() {
  const { connected, hello, request, subscribeEvent } = useWebSocket();
  const { remotePinAuthenticated } = useUser();
  const { rawMode } = useCarMode();
  const { currentScreen } = useScreen();
  const [state, setState] = useState<OledCanvasTransferState>(INITIAL_STATE);
  const [confirmedFramebuffer, setConfirmedFramebuffer] = useState<Uint8Array | null>(null);
  const [confirmedCrc32, setConfirmedCrc32] = useState<string | null>(null);
  const activeRef = useRef<{ operation: number; transferId: number } | null>(null);
  const operationRef = useRef(0);
  const runningRef = useRef(false);
  const lastModeRef = useRef(rawMode);
  const lastScreenCodeRef = useRef(currentScreen?.screenCode ?? null);

  const capabilityAvailable = hello?.features?.oledCanvas === true;
  const apiV1Ready = connected && capabilityAvailable;
  const canStart = connected && remotePinAuthenticated && capabilityAvailable;
  const active = isActivePhase(state.phase);

  const bestEffortCancel = useCallback(async (transferId: number) => {
    try {
      validateOledCanvasCancelResponse(
        await request(
          ESP_COMMANDS.OLED_CANVAS_CANCEL,
          buildOledCanvasCancelArgs(transferId),
          { timeoutMs: 3_000 },
        ),
        transferId,
      );
    } catch {
      // F4/ESP tambien limpian por timeout o desconexion. Nunca se inventa un exito.
    }
  }, [request]);

  const cancel = useCallback(async (reason = "Transferencia cancelada") => {
    operationRef.current += 1;
    runningRef.current = false;
    const activeTransfer = activeRef.current;
    activeRef.current = null;
    setState((current) => ({
      ...current,
      phase: activeTransfer ? "canceling" : "canceled",
      message: reason,
      error: null,
    }));
    if (activeTransfer) await bestEffortCancel(activeTransfer.transferId);
    setState((current) => ({ ...current, phase: "canceled", message: reason }));
  }, [bestEffortCancel]);

  const send = useCallback(async (raster: OledCanvasRaster): Promise<OledCanvasCommitResponse> => {
    if (raster.framebuffer.length !== OLED_CANVAS_BYTES) {
      throw new Error(`El raster debe tener ${OLED_CANVAS_BYTES} bytes`);
    }
    if (runningRef.current) throw new Error("Ya hay una transferencia OLED Canvas activa");
    runningRef.current = true;
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    activeRef.current = null;

    setState({
      phase: "preparing",
      progressBytes: 0,
      message: "Verificando F4, sesion, modo TEST y pantalla OLED Canvas",
      error: null,
      transferId: null,
    });

    try {
      if (!connected) throw new Error("WebSocket API v1 no esta listo");
      if (!remotePinAuthenticated) throw new Error("La sesion PIN de la F4 no esta autenticada");
      if (!capabilityAvailable) throw new Error("El ESP conectado no anuncia hello.features.oledCanvas");

      const modeData = await request<Record<string, unknown>>(
        ESP_COMMANDS.GET_CAR_MODE,
        {},
        { timeoutMs: 3_000 },
      );
      if (operationRef.current !== operation) throw new LocalCancellation();
      if (readCarMode(modeData) !== 0x02) throw new Error(canvasNavigationMessage());

      const screenData = await request<Record<string, unknown>>(
        ESP_COMMANDS.GET_CURRENT_SCREEN,
        {},
        { timeoutMs: 3_000 },
      );
      if (operationRef.current !== operation) throw new LocalCancellation();
      if (normalizeScreenReport(screenData)?.screenCode !== OLED_CANVAS_SCREEN_CODE) {
        throw new Error(canvasNavigationMessage());
      }

      const begin = validateOledCanvasBeginResponse(
        await request(
          ESP_COMMANDS.OLED_CANVAS_BEGIN,
          buildOledCanvasBeginArgs(raster),
          { timeoutMs: 5_000 },
        ),
      );
      if (operationRef.current !== operation) {
        await bestEffortCancel(begin.transferId);
        throw new LocalCancellation();
      }
      activeRef.current = { operation, transferId: begin.transferId };
      setState({
        phase: "uploading",
        progressBytes: 0,
        message: `Transfiriendo 0/${OLED_CANVAS_BYTES} bytes`,
        error: null,
        transferId: begin.transferId,
      });

      for (const chunk of splitOledCanvasChunks(raster.framebuffer)) {
        const nextOffset = chunk.offset + chunk.bytes.length;
        const response = await request(
          ESP_COMMANDS.OLED_CANVAS_CHUNK,
          buildOledCanvasChunkArgs(begin.transferId, chunk),
          { timeoutMs: 5_000 },
        );
        if (operationRef.current !== operation) throw new LocalCancellation();
        validateOledCanvasChunkResponse(response, begin.transferId, nextOffset);
        setState({
          phase: "uploading",
          progressBytes: nextOffset,
          message: `Transfiriendo ${nextOffset}/${OLED_CANVAS_BYTES} bytes`,
          error: null,
          transferId: begin.transferId,
        });
      }

      setState({
        phase: "waiting_f4",
        progressBytes: OLED_CANVAS_BYTES,
        message: "Esperando que la F4 complete las ocho paginas por I2C/DMA",
        error: null,
        transferId: begin.transferId,
      });
      const result = validateOledCanvasCommitResponse(
        await request(
          ESP_COMMANDS.OLED_CANVAS_COMMIT,
          buildOledCanvasCommitArgs(begin.transferId),
          { timeoutMs: 20_000 },
        ),
        begin.transferId,
        raster.crc32Hex,
      );
      if (operationRef.current !== operation) throw new LocalCancellation();
      activeRef.current = null;
      runningRef.current = false;
      setConfirmedFramebuffer(raster.framebuffer.slice());
      setConfirmedCrc32(result.crc32);
      setState({
        phase: "rendered",
        progressBytes: OLED_CANVAS_BYTES,
        message: "Mostrada con \u00e9xito",
        error: null,
        transferId: begin.transferId,
      });
      return result;
    } catch (cause) {
      const pending = activeRef.current;
      if (pending?.operation === operation) {
        activeRef.current = null;
        await bestEffortCancel(pending.transferId);
      }
      if (operationRef.current === operation) runningRef.current = false;
      if (cause instanceof LocalCancellation || operationRef.current !== operation) throw cause;
      const message = cause instanceof Error ? cause.message : "Fallo al enviar OLED Canvas";
      setState({
        phase: "error",
        progressBytes: 0,
        message,
        error: message,
        transferId: pending?.transferId ?? null,
      });
      throw cause;
    }
  }, [bestEffortCancel, capabilityAvailable, connected, remotePinAuthenticated, request]);

  useEffect(() => {
    if (active && (!connected || !remotePinAuthenticated || !capabilityAvailable)) {
      void cancel("Transferencia cancelada por cambio de conexion o sesion");
    }
  }, [active, cancel, capabilityAvailable, connected, remotePinAuthenticated]);

  useEffect(() => subscribeEvent("screen.changed", ({ data }) => {
    const screenCode = normalizeScreenReport(data)?.screenCode;
    if (shouldCancelOledCanvasForScreen(runningRef.current, screenCode)) {
      void cancel("Transferencia cancelada: la F4 salio de OLED Canvas");
    }
  }), [cancel, subscribeEvent]);

  useEffect(() => subscribeEvent("carModeChanged", ({ data }) => {
    if (shouldCancelOledCanvasForMode(runningRef.current, readCarMode(data))) {
      void cancel("Transferencia cancelada: la F4 salio del modo TEST");
    }
  }), [cancel, subscribeEvent]);

  useEffect(() => {
    const changed = lastModeRef.current !== rawMode;
    lastModeRef.current = rawMode;
    if (changed && shouldCancelOledCanvasForMode(runningRef.current, rawMode)) {
      void cancel("Transferencia cancelada: la F4 salio del modo TEST");
    }
  }, [cancel, rawMode]);

  useEffect(() => {
    const screenCode = currentScreen?.screenCode ?? null;
    const changed = lastScreenCodeRef.current !== screenCode;
    lastScreenCodeRef.current = screenCode;
    if (changed && shouldCancelOledCanvasForScreen(runningRef.current, screenCode)) {
      void cancel("Transferencia cancelada: la F4 salio de OLED Canvas");
    }
  }, [cancel, currentScreen?.screenCode]);

  return useMemo(() => ({
    state,
    active,
    canStart,
    apiV1Ready,
    capabilityAvailable,
    cachedMode: rawMode,
    cachedScreenCode: currentScreen?.screenCode ?? null,
    confirmedFramebuffer,
    confirmedCrc32,
    send,
    cancel,
  }), [
    active,
    apiV1Ready,
    canStart,
    capabilityAvailable,
    cancel,
    confirmedCrc32,
    confirmedFramebuffer,
    currentScreen?.screenCode,
    rawMode,
    send,
    state,
  ]);
}

function readCarMode(value: unknown): number | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return parseMode(record.mode ?? record.carMode ?? record.value);
  }
  return parseMode(value);
}

function parseMode(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value) & 0xff;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "TEST") return 0x02;
  const parsed = normalized.startsWith("0X")
    ? Number.parseInt(normalized.slice(2), 16)
    : Number(normalized);
  return Number.isFinite(parsed) ? Math.trunc(parsed) & 0xff : null;
}

function canvasNavigationMessage(): string {
  return "En la F4 entra a Testeo > Pantalla > OLED Canvas";
}

function isActivePhase(phase: OledCanvasTransferPhase): boolean {
  return phase === "preparing" || phase === "uploading" || phase === "waiting_f4" || phase === "canceling";
}
