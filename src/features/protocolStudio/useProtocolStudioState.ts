import { useEffect, useMemo, useRef, useState } from "react";
import { FRAME_COMMANDS, FRAME_SEGMENT_COLORS, IDLE_SUMMARY } from "./catalog";
import {
  analyzeCommandOnly,
  analyzeFrame,
  buildFrameData,
  bytesToHex,
  bytesToRealTerm,
  countHeaders,
  createDefaultFieldValues,
  createEmptyBlockTranslation,
  createErrorTranslation,
  createIdleTranslation,
  detectInput,
  hx,
  scanBlock,
} from "./utils";
import type { ScanBlockResult, TranslationResult, TranslatorViewMode } from "./types";

export function useProtocolStudioState() {
  const [source, setSource] = useState("2");
  const [destination, setDestination] = useState("2");
  const [commandKey, setCommandKey] = useState("0x31");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [manualPayload, setManualPayload] = useState("");
  const [translatorInput, setTranslatorInput] = useState("");
  const [translation, setTranslation] = useState<TranslationResult>(createIdleTranslation());
  const [scanResult, setScanResult] = useState<ScanBlockResult | null>(null);
  const [viewMode, setViewMode] = useState<TranslatorViewMode>("idle");
  const [openInfoModal, setOpenInfoModal] = useState(false);
  const [flashMessage, setFlashMessage] = useState("");
  const flashTimerRef = useRef<number | null>(null);

  const currentCommand = FRAME_COMMANDS[commandKey];
  const nonHexFields = currentCommand?.fields.filter((field) => field.type !== "hex1") ?? [];
  const hexFields = currentCommand?.fields.filter((field) => field.type === "hex1") ?? [];

  useEffect(() => {
    setFieldValues(createDefaultFieldValues(currentCommand));
  }, [currentCommand]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  const builderState = useMemo(() => {
    try {
      return {
        data: buildFrameData(source, destination, commandKey, manualPayload, fieldValues),
        error: "",
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "No se pudo construir el frame.",
      };
    }
  }, [commandKey, destination, fieldValues, manualPayload, source]);

  const outputs = useMemo(() => {
    if (!builderState.data) {
      return { plain: "", realterm: "", c: "", py: "" };
    }

    const { frame } = builderState.data;
    return {
      plain: bytesToHex(frame),
      realterm: bytesToRealTerm(frame),
      c: `uint8_t frame[] = { ${frame.map(hx).join(", ")} };`,
      py: `frame = bytes([${frame.map(hx).join(", ")}])`,
    };
  }, [builderState.data]);

  const translatorStatus = useMemo(() => {
    if (viewMode === "idle") {
      return { tone: "warn" as const, label: "Sin analizar", summary: IDLE_SUMMARY };
    }
    if (viewMode === "block") {
      const validFrames = scanResult?.validFrames.length ?? 0;
      const invalidFrames = scanResult?.invalidCandidates.length ?? 0;
      const gaps = scanResult?.gaps.length ?? 0;

      return {
        tone: validFrames > 0 ? ("ok" as const) : ("warn" as const),
        label: validFrames > 0 ? "Bloque analizado" : "Sin frames validos",
        summary: `Bloque escaneado: ${scanResult?.totalBytes ?? 0} bytes. Se encontraron ${validFrames} frame(s) validos, ${invalidFrames} candidato(s) invalidos y ${gaps} segmento(s) fuera de frame.`,
      };
    }
    if (viewMode === "error") {
      return { tone: "bad" as const, label: "Error", summary: translation.summary };
    }

    return {
      tone: translation.overall,
      label:
        translation.overall === "ok" ? "Correcto" : translation.overall === "bad" ? "Incorrecto" : "Parcial / advertencia",
      summary: translation.summary,
    };
  }, [scanResult, translation.overall, translation.summary, viewMode]);

  const scanResultsPlaceholder =
    viewMode === "idle"
      ? "Todavia no se escaneo ningun bloque."
      : viewMode === "singleCommand"
      ? "Entrada interpretada como comando simple; no se realizo escaneo de bloque."
      : viewMode === "singleFrame"
      ? "Entrada interpretada como frame unico; no se realizo escaneo de bloque."
      : viewMode === "error"
      ? "No se pudo escanear el bloque por un error de parseo."
      : "";

  const streamPlaceholder =
    viewMode === "idle"
      ? "Todavia no se escaneo ningun bloque."
      : viewMode === "singleCommand"
      ? "Entrada interpretada como comando simple; no se genero mapa visual de bloque."
      : viewMode === "singleFrame"
      ? "Entrada interpretada como frame unico; no se genero mapa visual de bloque."
      : viewMode === "error"
      ? "No se pudo generar el mapa visual del bloque."
      : "";

  const streamSegments = useMemo(() => {
    if (!scanResult) {
      return [];
    }

    return [
      ...scanResult.gaps.map((gap, index) => ({
        type: "gap" as const,
        order: gap.start,
        label:
          gap.kind === "boot_reset"
            ? `Reinicio ESP ${index + 1} @${gap.start}-${gap.end}`
            : `Fuera de frame ${index + 1} @${gap.start}-${gap.end}`,
        bytes: gap.bytes,
        tone:
          gap.kind === "boot_reset"
            ? "bg-amber-500/10 ring-amber-400/45 text-amber-100"
            : "bg-slate-500/10 ring-slate-400/35 text-slate-200",
      })),
      ...scanResult.invalidCandidates.map((candidate, index) => ({
        type: "invalid" as const,
        order: candidate.offset,
        label: `Header invalido ${index + 1} @${candidate.offset}`,
        bytes: candidate.preview,
        tone: "bg-rose-500/10 ring-rose-400/45 text-rose-100",
      })),
      ...scanResult.validFrames.map((item, index) => ({
        type: "frame" as const,
        order: item.offset,
        label: `Frame ${index + 1} @${item.offset} - ${item.analysis.cmdHex} ${item.analysis.name}`,
        bytes: item.frame,
        frameOffset: item.offset,
        frameName: item.analysis.name,
        tone: FRAME_SEGMENT_COLORS[index % FRAME_SEGMENT_COLORS.length],
      })),
    ].sort((left, right) => left.order - right.order);
  }, [scanResult]);

  function setFieldValue(id: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [id]: value }));
  }

  function showFlash(text: string) {
    setFlashMessage(text);
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = window.setTimeout(() => {
      setFlashMessage("");
    }, 2000);
  }

  async function copyOutput(format: keyof typeof outputs) {
    const value = outputs[format];
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      showFlash("Copiado al portapapeles.");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      showFlash("Copiado con fallback.");
    }
  }

  function resetTranslator() {
    setTranslatorInput("");
    setTranslation(createIdleTranslation());
    setScanResult(null);
    setViewMode("idle");
  }

  function handleTranslate(rawValue = translatorInput) {
    const trimmed = rawValue.trim();

    if (!trimmed) {
      resetTranslator();
      return;
    }

    try {
      const detected = detectInput(trimmed);

      if (detected.mode === "frame") {
        const headerCount = countHeaders(detected.bytes);
        if (headerCount > 1 || detected.forceBlockScan) {
          const nextScanResult = scanBlock(detected.bytes, detected.sourceLabel);
          setScanResult(nextScanResult);
          setViewMode("block");
          setTranslation(nextScanResult.validFrames[0]?.analysis ?? createEmptyBlockTranslation());
          return;
        }

        setTranslation(analyzeFrame(detected.bytes, detected.sourceLabel));
        setScanResult(null);
        setViewMode("singleFrame");
        return;
      }

      setTranslation(analyzeCommandOnly(detected.cmd, detected.sourceLabel));
      setScanResult(null);
      setViewMode("singleCommand");
    } catch (error) {
      setTranslation(createErrorTranslation(error instanceof Error ? error.message : "No se pudo analizar la entrada."));
      setScanResult(null);
      setViewMode("error");
    }
  }

  function loadBuilderToTranslator() {
    if (!outputs.plain) {
      return;
    }
    setTranslatorInput(outputs.plain);
    handleTranslate(outputs.plain);
  }

  return {
    source,
    setSource,
    destination,
    setDestination,
    commandKey,
    setCommandKey,
    fieldValues,
    setFieldValue,
    manualPayload,
    setManualPayload,
    translatorInput,
    setTranslatorInput,
    translation,
    scanResult,
    viewMode,
    openInfoModal,
    setOpenInfoModal,
    currentCommand,
    nonHexFields,
    hexFields,
    builderState,
    outputs,
    translatorStatus,
    scanResultsPlaceholder,
    streamPlaceholder,
    streamSegments,
    copyOutput,
    resetTranslator,
    handleTranslate,
    loadBuilderToTranslator,
    flashMessage,
  };
}
