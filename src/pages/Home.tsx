// src/pages/Home.tsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useViewTransitionState } from "react-router-dom";
import { useWebSocket } from "../hooks/useWebSocket";
import { useUNERProtocol } from "../hooks/useUnerProtocol";
import { le16, readLe16 } from "../api/UnerProtocolUtils";
import PageHeader from "../components/PageHeader";
import useUser from "../contexts/UserContext";
import Modal from "../components/modal";
import SystemResetActions from "../components/SystemResetActions";
import ScreenDashboardPanel from "../components/ScreenDashboardPanel";
import {
  APP_PIN_ACTION,
  CMD,
  PayloadBuilder,
  SETTINGS_ACK_CODES,
} from "../types/UnerProtocolCMDTypes";
import {
  applyThemeColors,
  buildThemePayload,
  DEFAULT_THEME_COLORS,
  isHexColor,
  loadThemeColors,
  normalizeHexColor,
  saveThemeColors,
  type ThemeColors,
} from "../utils/theme";

type RequestStatus = {
  tone: "idle" | "loading" | "success" | "error";
  message: string;
};

type PinStep = "validate" | "change";

function DevModeToggle() {
  const { devMode, setDevMode } = useUser();

  return (
    <button
      type="button"
      onClick={() => setDevMode(!devMode)}
      className={`px-3 py-1 text-sm font-semibold ${
        devMode ? "btn-success" : "app-button--ghost"
      }`}
      aria-pressed={devMode}
      aria-label="Alternar modo desarrollador"
      title={devMode ? "Desactivar modo desarrollador" : "Activar modo desarrollador"}
    >
      {devMode ? "Activo" : "Inactivo"}
    </button>
  );
}

const Home: React.FC = () => {
  const {
    connected,
    heartbeatConfig,
    setHeartbeatInterval,
    setHeartbeatMaxRetries,
    toggleHeartbeatWatchdog,
    onHeartbeatReceived,
    lastHeartbeatAt,
  } = useWebSocket();

  const { send, subscribe } = useUNERProtocol();
  const navigate = useNavigate();
  const [on, setOn] = useState(false);
  const [openInfoModal, setOpenInfoModal] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [openPinModal, setOpenPinModal] = useState(false);
  const [pinStep, setPinStep] = useState<PinStep>("validate");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinStatus, setPinStatus] = useState<RequestStatus>({
    tone: "idle",
    message: "Primero validamos el PIN actual contra el ESP.",
  });
  const [themeDraft, setThemeDraft] = useState<ThemeColors>(() => loadThemeColors());
  const [themeStatus, setThemeStatus] = useState<RequestStatus>({
    tone: "idle",
    message: "Elegí color base y acento, y guardalos en el ESP.",
  });

  // Refs para el timer del parpadeo
  const blinkIntervalRef = useRef<number | null>(null);
  const activePinRequestRef = useRef<PinStep | null>(null);
  const activeThemeRequestRef = useRef(false);
  const pendingThemeRequestRef = useRef<ThemeColors | null>(null);
  const pinAckTimeoutRef = useRef<number | null>(null);
  const themeAckTimeoutRef = useRef<number | null>(null);

  const CMD_HEARTBEAT = 0xa2;

  // Suscribirse a heartbeats recibidos
  useEffect(() => {
    const off = subscribe(CMD.HEARTBEAT_BEAT, (p) => {
      const ms = readLe16(p.payload);
      console.log("[UNER] RX heartbeat:", ms, "ms");

      // Notificar al contexto que se recibió un heartbeat
      onHeartbeatReceived();
    });
    return off;
  }, [subscribe, onHeartbeatReceived]);

  useEffect(() => {
    const off = subscribe(CMD.APP_PIN_CONFIG, (p) => {
      const payload = p.payload;
      const activeRequest = activePinRequestRef.current;
      if (!activeRequest || payload.length === 0) return;

      if (payload.length === 2) {
        const [action, code] = payload;
        const isOk = code === SETTINGS_ACK_CODES.OK;

        if (
          action === APP_PIN_ACTION.VALIDATE_SCREEN &&
          activeRequest === "validate"
        ) {
          clearPinAckTimeout();
          activePinRequestRef.current = null;
          if (isOk) {
            setPinStep("change");
            setPinStatus({
              tone: "success",
              message: "PIN validado. Ahora elegí el nuevo PIN y confirmalo.",
            });
          } else {
            setPinStatus({ tone: "error", message: settingsAckMessage(code) });
          }
        }

        if (action === APP_PIN_ACTION.CHANGE && activeRequest === "change") {
          clearPinAckTimeout();
          activePinRequestRef.current = null;
          if (isOk) {
            setPinStatus({
              tone: "success",
              message: "Cambio de PIN enviado y confirmado por el ESP.",
            });
            setCurrentPin("");
            setNewPin("");
            setConfirmPin("");
          } else {
            setPinStatus({ tone: "error", message: settingsAckMessage(code) });
          }
        }
        return;
      }

      // En modo mock, el transporte hace eco del paquete original. Lo tratamos como OK
      // para poder probar la interfaz sin firmware conectado.
      if (activeRequest === "validate" && payload.length === 5) {
        clearPinAckTimeout();
        activePinRequestRef.current = null;
        setPinStep("change");
        setPinStatus({
          tone: "success",
          message: "PIN validado en modo mock. El firmware real debe responder [0x01, code].",
        });
      }

      if (activeRequest === "change" && payload.length === 9) {
        clearPinAckTimeout();
        activePinRequestRef.current = null;
        setPinStatus({
          tone: "success",
          message: "Cambio de PIN enviado en modo mock. Esperar ACK real del ESP en firmware.",
        });
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
      }
    });

    return off;
  }, [subscribe]);

  useEffect(() => {
    const off = subscribe(CMD.APP_THEME_CONFIG, (p) => {
      if (!activeThemeRequestRef.current || p.payload.length === 0) return;

      if (p.payload.length === 1) {
        clearThemeAckTimeout();
        activeThemeRequestRef.current = false;
        const code = p.payload[0];
        const pendingTheme = pendingThemeRequestRef.current;
        pendingThemeRequestRef.current = null;
        if (code === SETTINGS_ACK_CODES.OK && pendingTheme) {
          saveThemeColors(pendingTheme);
        }
        setThemeStatus({
          tone: code === SETTINGS_ACK_CODES.OK ? "success" : "error",
          message:
            code === SETTINGS_ACK_CODES.OK
              ? "Tema guardado en NVS por el ESP."
              : settingsAckMessage(code),
        });
        return;
      }

      if (p.payload.length === 6) {
        clearThemeAckTimeout();
        activeThemeRequestRef.current = false;
        if (pendingThemeRequestRef.current) {
          saveThemeColors(pendingThemeRequestRef.current);
          pendingThemeRequestRef.current = null;
        }
        setThemeStatus({
          tone: "success",
          message: "Tema aplicado en modo mock. El firmware real debe responder [code].",
        });
      }
    });

    return off;
  }, [subscribe]);

  const toControl = useViewTransitionState("/control");

  useEffect(() => {
    if (toControl) console.log("VT → /control activa");
  }, [toControl]);

  // Efecto para el parpadeo del LED
  useEffect(() => {
    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current);
    }

    if (!connected) return; // si no hay conexión → no titila

    setOn(true); // arranca encendido
    blinkIntervalRef.current = setInterval(
      () => setOn((v) => !v),
      heartbeatConfig.intervalMs
    );

    return () => {
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
      }
    };
  }, [connected, heartbeatConfig.intervalMs]);

  // Cleanup cuando se desmonta el componente
  useEffect(() => {
    return () => {
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
      }
      if (pinAckTimeoutRef.current) {
        window.clearTimeout(pinAckTimeoutRef.current);
      }
      if (themeAckTimeoutRef.current) {
        window.clearTimeout(themeAckTimeoutRef.current);
      }
    };
  }, []);

  // Manejar envío de heartbeat manual
  const handleSendHeartbeat = async () => {
    await send(CMD_HEARTBEAT, le16(heartbeatConfig.intervalMs)).then(() => {
      // Si el contador está en 0, resetear el watchdog
      if (heartbeatConfig.remainingRetries === 0) {
        onHeartbeatReceived();
      }
    });
  };

  const normalizedThemeDraft: ThemeColors = {
    base: normalizeHexColor(themeDraft.base, DEFAULT_THEME_COLORS.base),
    accent: normalizeHexColor(themeDraft.accent, DEFAULT_THEME_COLORS.accent),
  };
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [accentBorder30, setAccentBorder30] = useState<string>(
    "rgba(34,211,238,0.3)",
  );

  useEffect(() => {
    try {
      const raw =
        getComputedStyle(document.documentElement).getPropertyValue(
          "--ui-accent",
        ) || "#22d3ee";
      const hex = raw.trim();
      const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
      if (m) {
        const hh = m[1];
        const r = parseInt(hh.slice(0, 2), 16);
        const g = parseInt(hh.slice(2, 4), 16);
        const b = parseInt(hh.slice(4, 6), 16);
        setAccentBorder30(`rgba(${r}, ${g}, ${b}, 0.3)`);
      }
    } catch (e) {
      // ignore
    }
  }, []);
  // Preset themes para seleccionar rápidamente
  // Presets invertidos: por defecto base/acento intercambiados
  const PRESET_THEMES: Array<ThemeColors & { label: string }> = [
    { base: "#C21121", accent: "#B3E6FB", label: "Berry Red / Icy Blue" },
    {
      base: "#700143",
      accent: "#CFD78C",
      label: "Crimson Violet / Pale Amber",
    },
    { base: "#3D2E2B", accent: "#E1D0C9", label: "Deep Mocha / Powder Petal" },
    { base: "#2D3E50", accent: "#F4F8F9", label: "Charcoal Blue / Platinum" },
    {
      base: "#2E1E1F",
      accent: "#E30B5C",
      label: "Raspberry Red / Coffee Bean",
    },
    { base: "#3E2723", accent: "#F4C9D6", label: "Espresso / Peony" },
    {
      base: "#35393C",
      accent: "#A4D8FF",
      label: "Gunmetal / Icy Blue Variant",
    },
  ];

  const isSameTheme = (a: ThemeColors, b: ThemeColors) => {
    return (
      normalizeHexColor(a.base, DEFAULT_THEME_COLORS.base) ===
        normalizeHexColor(b.base, DEFAULT_THEME_COLORS.base) &&
      normalizeHexColor(a.accent, DEFAULT_THEME_COLORS.accent) ===
        normalizeHexColor(b.accent, DEFAULT_THEME_COLORS.accent)
    );
  };
  const themeDraftIsValid =
    isHexColor(toHexCandidate(themeDraft.base)) &&
    isHexColor(toHexCandidate(themeDraft.accent));
  const missedHeartbeatCount = Math.max(
    0,
    heartbeatConfig.maxRetries - heartbeatConfig.remainingRetries
  );
  const shouldShowLastHeartbeat =
    missedHeartbeatCount >= 2 || heartbeatConfig.remainingRetries === 0;

  function clearPinAckTimeout() {
    if (pinAckTimeoutRef.current) {
      window.clearTimeout(pinAckTimeoutRef.current);
      pinAckTimeoutRef.current = null;
    }
  }

  function clearThemeAckTimeout() {
    if (themeAckTimeoutRef.current) {
      window.clearTimeout(themeAckTimeoutRef.current);
      themeAckTimeoutRef.current = null;
    }
  }

  function updateThemeDraft(key: keyof ThemeColors, value: string) {
    setThemeStatus({ tone: "idle", message: "Cambios listos para guardar." });
    setThemeDraft((prev) => ({ ...prev, [key]: toHexCandidate(value).slice(0, 7) }));
  }

  async function handleSaveTheme() {
    if (!themeDraftIsValid) {
      setThemeStatus({
        tone: "error",
        message: "Usa valores hexadecimales completos, por ejemplo #22d3ee.",
      });
      return;
    }

    const nextTheme = {
      base: normalizeHexColor(themeDraft.base, DEFAULT_THEME_COLORS.base),
      accent: normalizeHexColor(themeDraft.accent, DEFAULT_THEME_COLORS.accent),
    };

    applyThemeColors(nextTheme);
    activeThemeRequestRef.current = true;
    pendingThemeRequestRef.current = nextTheme;
    setThemeStatus({ tone: "loading", message: "Enviando tema al ESP..." });
    clearThemeAckTimeout();
    themeAckTimeoutRef.current = window.setTimeout(() => {
      activeThemeRequestRef.current = false;
      pendingThemeRequestRef.current = null;
      setThemeStatus({
        tone: "error",
        message: "El ESP no respondio el ACK de APP_THEME_CONFIG.",
      });
    }, 10000);

    try {
      await send(CMD.APP_THEME_CONFIG, buildThemePayload(nextTheme));
    } catch {
      clearThemeAckTimeout();
      activeThemeRequestRef.current = false;
      pendingThemeRequestRef.current = null;
      setThemeStatus({ tone: "error", message: "No se pudo enviar APP_THEME_CONFIG." });
    }
  }

  function resetThemeDraft() {
    clearThemeAckTimeout();
    activeThemeRequestRef.current = false;
    pendingThemeRequestRef.current = null;
    setThemeDraft(DEFAULT_THEME_COLORS);
    saveThemeColors(DEFAULT_THEME_COLORS);
    applyThemeColors(DEFAULT_THEME_COLORS);
    setThemeStatus({
      tone: "idle",
      message: "Tema restaurado localmente. Guardalo para persistirlo en el ESP.",
    });
  }

  function openPinEditor() {
    clearPinAckTimeout();
    activePinRequestRef.current = null;
    setOpenPinModal(true);
    setPinStep("validate");
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setPinStatus({
      tone: "idle",
      message: "Ingresa el PIN actual para pedir validacion al ESP.",
    });
  }

  async function requestPinValidation() {
    if (!/^\d{4}$/.test(currentPin)) {
      setPinStatus({ tone: "error", message: "El PIN actual debe tener 4 digitos." });
      return;
    }

    activePinRequestRef.current = "validate";
    setPinStatus({ tone: "loading", message: "Validando PIN actual con el ESP..." });
    clearPinAckTimeout();
    pinAckTimeoutRef.current = window.setTimeout(() => {
      activePinRequestRef.current = null;
      setPinStatus({
        tone: "error",
        message: "El ESP no respondio la validacion de PIN.",
      });
    }, 10000);

    try {
      await send(
        CMD.APP_PIN_CONFIG,
        PayloadBuilder.appPinConfig(APP_PIN_ACTION.VALIDATE_SCREEN, currentPin),
      );
    } catch {
      clearPinAckTimeout();
      activePinRequestRef.current = null;
      setPinStatus({ tone: "error", message: "No se pudo enviar la validacion de PIN." });
    }
  }

  async function requestPinChange() {
    if (!/^\d{4}$/.test(newPin)) {
      setPinStatus({ tone: "error", message: "El nuevo PIN debe tener 4 digitos." });
      return;
    }
    if (newPin !== confirmPin) {
      setPinStatus({ tone: "error", message: "La confirmacion no coincide con el nuevo PIN." });
      return;
    }

    activePinRequestRef.current = "change";
    setPinStatus({ tone: "loading", message: "Enviando cambio de PIN al ESP..." });
    clearPinAckTimeout();
    pinAckTimeoutRef.current = window.setTimeout(() => {
      activePinRequestRef.current = null;
      setPinStatus({
        tone: "error",
        message: "El ESP no respondio el ACK de cambio de PIN.",
      });
    }, 10000);

    try {
      await send(
        CMD.APP_PIN_CONFIG,
        PayloadBuilder.appPinConfig(APP_PIN_ACTION.CHANGE, currentPin, newPin)
      );
    } catch {
      clearPinAckTimeout();
      activePinRequestRef.current = null;
      setPinStatus({ tone: "error", message: "No se pudo enviar el cambio de PIN." });
    }
  }

  return (
    <div
      className="flex flex-col h-full w-full items-center p-6 relative
                 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100
                 selection:bg-cyan-500/30"
    >
      {/* Header */}
      <div className="flex w-full flex-col items-center justify-center p-4">
        <PageHeader
          setOpenSettingsModal={setOpenSettingsModal}
          setOpenInfoModal={setOpenInfoModal}
          titleOverride="Auto Microcontroladores 2025"
        />

        <div className="flex flex-col xl:flex-row justify-evenly items-center w-full max-w-6xl mt-8 gap-6">
          {/* Estado y Watchdog */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-row items-center gap-3">
              <p className="text-lg md:text-xl font-semibold text-slate-200">
                MPU + IR:
              </p>
              <span
                aria-live="polite"
                className={`inline-flex items-center gap-2 text-lg md:text-xl font-bold
                  ${connected ? "text-emerald-400" : "text-rose-400"}`}
              >
                <span
                  className={`h-[14px] w-[14px] rounded-full shadow transition-colors duration-${
                    heartbeatConfig.intervalMs > 500 ? "500" : "100"
                  } ${
                    connected
                      ? on
                        ? "bg-emerald-400"
                        : "bg-transparent border border-emerald-400"
                      : "bg-rose-400"
                  }`}
                />
                {connected ? "Conectado" : "Desconectado"}
              </span>
            </div>
            {shouldShowLastHeartbeat ? (
              <p className="max-w-sm text-center text-xs font-medium text-amber-200">
                Ultimo heartbeat: {formatHeartbeatTime(lastHeartbeatAt)}.
                Watchdog sin respuesta: {missedHeartbeatCount} de{" "}
                {heartbeatConfig.maxRetries}.
              </p>
            ) : null}
          </div>

          {/* Configuraciones */}
          {!connected && (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleSendHeartbeat}
                className="refresh-btn group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white transition-all duration-300 hover:text-slate-900 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-6 transition-transform duration-300 group-hover:rotate-180"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.30-.918Z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-xl">Enviar heartbeat</p>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 flex w-full max-w-6xl justify-center px-2">
        <ScreenDashboardPanel />
      </div>

      {/* Accesos */}
      <div className="flex flex-col md:flex-row flex-1 min-h-[18rem] w-full md:w-11/12 max-w-6xl items-center justify-between gap-6">
        {/* 1) Estado — cyan → indigo */}
        <button
          className={`group relative w-3/4 md:w-1/3 h-3/5 rounded-2xl transition-all duration-300 text-slate-900`}
          style={
            connected
              ? hoveredBtn === "estado"
                ? ({
                    borderColor: "white",
                    color: "white",
                    borderStyle: "solid",
                    borderWidth: "2px",
                  } as React.CSSProperties)
                : ({
                    borderColor: accentBorder30,
                    borderStyle: "solid",
                    borderWidth: "2px",
                  } as React.CSSProperties)
              : undefined
          }
          onMouseEnter={() => connected && setHoveredBtn("estado")}
          onMouseLeave={() => connected && setHoveredBtn(null)}
          onClick={() => navigate("/statics", { viewTransition: true })}
          aria-label="Ir a MPU e IR"
          disabled={!connected}
        >
          <div
            className={`flex flex-col justify-center items-center h-full w-full rounded-2xl bg-transparent text-slate-100 transition-all duration-300`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-24 md:size-32 transition-transform duration-300 group-hover:rotate-12"
            >
              <path
                fillRule="evenodd"
                d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm14.25 6a.75.75 0 0 1-.22.53l-2.25 2.25a.75.75 0 1 1-1.06-1.06L15.44 12l-1.72-1.72a.75.75 0 1 1 1.06-1.06l2.25 2.25c.141.14.22.331.22.53Zm-10.28-.53a.75.75 0 0 0 0 1.06l2.25 2.25a.75.75 0 1 0 1.06-1.06L8.56 12l1.72-1.72a.75.75 0 1 0-1.06-1.06l-2.25 2.25Z"
                clipRule="evenodd"
              />
            </svg>
            <p className="-mt-2 text-2xl md:text-2xl font-extrabold uppercase">
              MPU + IR
            </p>
          </div>
        </button>

        {/* 2) Control — indigo → fuchsia */}
        <button
          className={`group relative w-3/4 md:w-1/3 h-3/5 rounded-2xl transition-all duration-300 text-slate-900`}
          style={
            connected
              ? hoveredBtn === "control"
                ? ({
                    borderColor: "white",
                    color: "white",
                    borderStyle: "solid",
                    borderWidth: "2px",
                  } as React.CSSProperties)
                : ({
                    borderColor: accentBorder30,
                    borderStyle: "solid",
                    borderWidth: "2px",
                  } as React.CSSProperties)
              : undefined
          }
          onMouseEnter={() => connected && setHoveredBtn("control")}
          onMouseLeave={() => connected && setHoveredBtn(null)}
          onClick={(e) => {
            e.preventDefault();
            navigate("/control", { viewTransition: true });
          }}
          disabled={!connected}
          aria-label="Ir a Control"
        >
          <div
            className={`flex flex-col justify-center items-center h-full w-full rounded-2xl bg-transparent text-slate-100 transition-all duration-300`}
          >
            <svg
              width="800px"
              height="800px"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              className="size-24 md:size-32 transition-transform duration-300"
              fill="currentColor"
            >
              <path d="M19.444 9.361c-.882-4.926-2.854-6.379-3.903-6.379-1.637 0-2.057 1.217-5.541 1.258-3.484-.041-3.904-1.258-5.541-1.258-1.049 0-3.022 1.453-3.904 6.379-.503 2.812-1.049 7.01.252 7.514 1.619.627 2.168-.941 3.946-2.266C6.558 13.266 7.424 12.95 10 12.95s3.442.316 5.247 1.659c1.778 1.324 2.327 2.893 3.946 2.266 1.301-.504.755-4.701.251-7.514zM6 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm7 0a1 1 0 1 1 0-2 1 1 0 1 1 0 2zm2-2a1 1 0 1 1 0-2 1 1 0 1 1 0 2z" />
            </svg>
            <p className="-mt-2 text-2xl md:text-2xl font-extrabold uppercase">
              Control
            </p>
          </div>
        </button>

        {/* 3) Wi-Fi — fuchsia → teal */}
        <button
          className={`group relative w-3/4 md:w-1/3 h-3/5 rounded-2xl transition-all duration-300 text-slate-900`}
          style={
            connected
              ? hoveredBtn === "wifi"
                ? ({
                    borderColor: "white",
                    color: "white",
                    borderStyle: "solid",
                    borderWidth: "2px",
                  } as React.CSSProperties)
                : ({
                    borderColor: accentBorder30,
                    borderStyle: "solid",
                    borderWidth: "2px",
                  } as React.CSSProperties)
              : undefined
          }
          onClick={() => navigate("/wifi", { viewTransition: true })}
          aria-label="Ir a Wi-Fi"
          disabled={!connected}
          onMouseEnter={() => connected && setHoveredBtn("wifi")}
          onMouseLeave={() => connected && setHoveredBtn(null)}
        >
          <div
            className={`flex flex-col justify-center items-center h-full w-full rounded-2xl bg-transparent text-slate-100 transition-all duration-300`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-24 md:size-32 transition-transform duration-300 group-hover:-rotate-12"
            >
              <path
                fillRule="evenodd"
                d="M1.371 8.143c5.858-5.857 15.356-5.857 21.213 0a.75.75 0 0 1 0 1.061l-.53.53a.75.75 0 0 1-1.06 0c-4.98-4.979-13.053-4.979-18.032 0a.75.75 0 0 1-1.06 0l-.53-.53a.75.75 0 0 1 0-1.06Zm3.182 3.182c4.1-4.1 10.749-4.1 14.85 0a.75.75 0 0 1 0 1.061l-.53.53a.75.75 0 0 1-1.062 0 8.25 8.25 0 0 0-11.667 0 .75.75 0 0 1-1.06 0l-.53-.53a.75.75 0 0 1 0-1.06Zm3.204 3.182a6 6 0 0 1 8.486 0 .75.75 0 0 1 0 1.061l-.53.53a.75.75 0 0 1-1.061 0 3.75 3.75 0 0 0-5.304 0 .75.75 0 0 1-1.06 0l-.53-.53a.75.75 0 0 1 0-1.06Zm3.182 3.182a1.5 1.5 0 0 1 2.122 0 .75.75 0 0 1 0 1.061l-.53.53a.75.75 0 0 1-1.061 0l-.53-.53a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
            <p className="-mt-2 text-2xl md:text-2xl font-extrabold uppercase">
              Wifi
            </p>
          </div>
        </button>
      </div>
      {openInfoModal && (
        <Modal
          isOpen={openInfoModal}
          onClose={() => setOpenInfoModal(false)}
          closeOnOverlayClick={false}
        >
          <h2 className="text-2xl font-bold mb-4 text-black">
            Pantalla de Inicio
          </h2>
          <p className="mb-3 text-black">
            La pantalla de inicio muestra el estado actual de la conexión con el
            dispositivo y permite enviar el comando <em>heartbeat</em> para
            verificar la comunicación. También indica visualmente si el enlace
            con la placa está activo o no mediante un indicador que titila al
            ritmo configurado.
          </p>
          <p className="text-black">
            Es el punto de partida para acceder al resto de funciones de la
            aplicación.
          </p>
        </Modal>
      )}
      {openSettingsModal && (
        <Modal
          isOpen={openSettingsModal}
          onClose={() => setOpenSettingsModal(false)}
          closeOnOverlayClick={false}
          containerClassnames="flex-col"
        >
          <div className="mb-6">
            <div className="app-kicker mb-3">Configuracion</div>
            <h2 className="text-3xl font-black text-white">
              Centro de ajustes
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Personaliza la interfaz y envia los cambios persistentes al ESP.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="app-panel-strong p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-white">Enlace y watchdog</h3>
                  <p className="text-sm text-slate-400">
                    Supervision de heartbeat.
                  </p>
                </div>
                <button
                  onClick={toggleHeartbeatWatchdog}
                  className={`px-3 py-1 text-sm font-semibold ${
                    heartbeatConfig.isActive
                      ? "btn-success"
                      : "app-button--ghost"
                  }`}
                  disabled={!connected}
                >
                  {heartbeatConfig.isActive ? "Activo" : "Inactivo"}
                </button>
              </div>
              <div className="app-panel mb-4 p-3 text-sm text-slate-300">
                Intentos restantes:{" "}
                <span className="font-bold text-emerald-300">
                  {heartbeatConfig.remainingRetries} de{" "}
                  {heartbeatConfig.maxRetries}
                </span>
              </div>

              <label
                htmlFor="hb-slider"
                className="mb-2 block text-sm text-slate-200"
              >
                {`Intervalo heartbeat (${heartbeatConfig.intervalMs} ms)`}
              </label>
              <input
                id="hb-slider"
                type="range"
                min={50}
                max={10000}
                step={50}
                value={heartbeatConfig.intervalMs}
                onChange={(e) => setHeartbeatInterval(Number(e.target.value))}
                className="mb-4 w-full"
              />

              <label
                htmlFor="retry-slider"
                className="mb-2 block text-sm text-slate-200"
              >
                {`Intentos maximos (${heartbeatConfig.maxRetries})`}
              </label>
              <input
                id="retry-slider"
                type="range"
                min={1}
                max={10}
                step={1}
                value={heartbeatConfig.maxRetries}
                onChange={(e) => setHeartbeatMaxRetries(Number(e.target.value))}
                className="w-full"
              />
            </section>

            <section className="app-panel-strong p-4">
              <div className="mb-4">
                <h3 className="font-bold text-white">Personalizar tema</h3>
                <p className="text-sm text-slate-400">
                  El base tiñe la atmósfera. El acento guía foco, botones y
                  estados activos.
                </p>
              </div>
              {/* Preset themes - burbujas seleccionables */}
              <div className="mb-4">
                <div className="mb-2 flex items-center gap-3">
                  <h4 className="text-sm font-semibold text-slate-200">
                    Temas rápidos
                  </h4>
                  <p className="text-sm text-slate-400">
                    Elige un preset o personaliza abajo.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {PRESET_THEMES.map((t, i) => {
                    const selected = isSameTheme(normalizedThemeDraft, {
                      base: normalizeHexColor(
                        t.base,
                        DEFAULT_THEME_COLORS.base,
                      ),
                      accent: normalizeHexColor(
                        t.accent,
                        DEFAULT_THEME_COLORS.accent,
                      ),
                    });
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`Seleccionar tema ${i + 1}: ${t.label}`}
                        title={t.label}
                        onClick={() => {
                          setThemeDraft({ base: t.base, accent: t.accent });
                          setThemeStatus({
                            tone: "idle",
                            message: "Tema seleccionado (no guardado).",
                          });
                        }}
                        className={`w-8 h-8 md:w-9 md:h-9 rounded-full shadow-sm focus:outline-none transition-transform duration-150 ${
                          selected ? "scale-105 border-2" : "border-0"
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${t.base} 50%, ${t.accent} 50%)`,
                          borderColor: selected ? t.accent : undefined,
                          boxShadow: selected
                            ? `0 0 0 4px ${t.accent}33`
                            : "none",
                        }}
                      />
                    );
                  })}
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md text-sm font-medium bg-slate-700 text-white"
                    onClick={() => {
                      // no hace nada: permite al usuario usar el picker manualmente
                      setThemeStatus({
                        tone: "idle",
                        message: "Personaliza el tema abajo.",
                      });
                    }}
                  >
                    Personalizar
                  </button>
                </div>
              </div>

              <div
                className="theme-role-preview mb-4"
                style={
                  {
                    "--theme-base": normalizedThemeDraft.base,
                    "--theme-accent": normalizedThemeDraft.accent,
                  } as React.CSSProperties
                }
              >
                <div className="theme-role-preview__surface">
                  <span
                    className="theme-role-preview__signal"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Base
                    </p>
                    <p className="font-mono text-sm text-white">
                      {normalizedThemeDraft.base}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="theme-role-preview__button"
                    >
                      Acento
                    </button>
                    <button
                      type="button"
                      aria-label="Intercambiar base y acento"
                      title="Intercambiar base y acento"
                      onClick={() => {
                        setThemeDraft((prev) => ({
                          base: prev.accent,
                          accent: prev.base,
                        }));
                        setThemeStatus({
                          tone: "idle",
                          message: "Base y acento intercambiados.",
                        });
                      }}
                      className="px-2 py-1 rounded-md text-sm font-medium bg-slate-700 text-white"
                    >
                      ⇄
                    </button>
                  </div>
                </div>
                <p className="mt-3 font-mono text-xs text-slate-400">
                  Acento: {normalizedThemeDraft.accent}
                </p>
              </div>

              <ColorPickerRow
                id="base-color"
                label="Color base"
                value={themeDraft.base}
                fallback={DEFAULT_THEME_COLORS.base}
                onChange={(value) => updateThemeDraft("base", value)}
              />
              <ColorPickerRow
                id="accent-color"
                label="Color acento"
                value={themeDraft.accent}
                fallback={DEFAULT_THEME_COLORS.accent}
                onChange={(value) => updateThemeDraft("accent", value)}
              />

              <StatusNote status={themeStatus} />

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="app-button px-4 py-2 font-semibold"
                  onClick={handleSaveTheme}
                  disabled={
                    !themeDraftIsValid || themeStatus.tone === "loading"
                  }
                >
                  Guardar tema
                </button>
                <button
                  type="button"
                  className="app-button--ghost px-4 py-2 font-semibold"
                  onClick={resetThemeDraft}
                >
                  Restaurar tema
                </button>
              </div>
            </section>
          </div>
          <section className="app-panel-strong p-4 mt-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-bold text-white">Modo desarrollador</h3>
                <p className="text-sm text-slate-400">
                  Este modo permite entrar el hub de desarrollo mostrando el
                  icono en la barra de navegación.
                </p>
              </div>
              <DevModeToggle />
            </div>
          </section>
          <section className="app-panel-strong mt-4 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-bold text-white">PIN de acceso</h3>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                  Para cambiarlo se valida primero el PIN actual con el ESP.
                  Despues se envia el nuevo PIN y se espera ACK de guardado en
                  NVS.
                </p>
              </div>
              <button
                type="button"
                className="app-button px-4 py-2 font-semibold"
                onClick={openPinEditor}
              >
                Modificar PIN
              </button>
            </div>
          </section>

          <SystemResetActions />
        </Modal>
      )}
      {openPinModal && (
        <Modal
          isOpen={openPinModal}
          onClose={() => setOpenPinModal(false)}
          closeOnOverlayClick={false}
          containerClassnames="flex-col"
        >
          <div className="mb-6">
            <div className="app-kicker mb-3">PIN</div>
            <h2 className="text-3xl font-black text-white">
              {pinStep === "validate"
                ? "Validar PIN actual"
                : "Confirmar nuevo PIN"}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {pinStep === "validate"
                ? "El ESP debe confirmar que el PIN actual es correcto antes de permitir el cambio."
                : "Ingresa el nuevo PIN dos veces. El cambio se envia al ESP y debe volver con ACK."}
            </p>
          </div>

          {pinStep === "validate" ? (
            <div className="space-y-5">
              <PinDigitField
                label="PIN actual"
                value={currentPin}
                onChange={setCurrentPin}
                autoFocus
              />
              <StatusNote status={pinStatus} />
              <button
                type="button"
                className="app-button w-full px-4 py-3 font-bold"
                onClick={requestPinValidation}
                disabled={
                  !/^\d{4}$/.test(currentPin) || pinStatus.tone === "loading"
                }
              >
                {pinStatus.tone === "loading" ? "Validando..." : "Validar PIN"}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <PinDigitField
                label="Nuevo PIN"
                value={newPin}
                onChange={setNewPin}
                autoFocus
              />
              <PinDigitField
                label="Confirmar nuevo PIN"
                value={confirmPin}
                onChange={setConfirmPin}
              />
              <StatusNote status={pinStatus} />
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="app-button--ghost px-4 py-3 font-bold"
                  onClick={() => {
                    setPinStep("validate");
                    setNewPin("");
                    setConfirmPin("");
                    setPinStatus({
                      tone: "idle",
                      message: "Volvemos a validar el PIN actual.",
                    });
                  }}
                >
                  Volver
                </button>
                <button
                  type="button"
                  className="app-button px-4 py-3 font-bold"
                  onClick={requestPinChange}
                  disabled={
                    !/^\d{4}$/.test(newPin) ||
                    newPin !== confirmPin ||
                    pinStatus.tone === "loading"
                  }
                >
                  {pinStatus.tone === "loading"
                    ? "Enviando..."
                    : "Confirmar cambio"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

function toHexCandidate(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function formatHeartbeatTime(timestamp: number | null) {
  if (!timestamp) {
    return "sin heartbeat recibido";
  }

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function settingsAckMessage(code: number) {
  switch (code) {
    case SETTINGS_ACK_CODES.OK:
      return "Operacion confirmada por el ESP.";
    case SETTINGS_ACK_CODES.INVALID_PIN:
      return "PIN incorrecto. El ESP rechazo la validacion.";
    case SETTINGS_ACK_CODES.ARG:
      return "Argumentos invalidos para el firmware.";
    case SETTINGS_ACK_CODES.SAVE_FAIL:
      return "El ESP no pudo guardar el cambio en NVS.";
    case SETTINGS_ACK_CODES.BUSY:
      return "El ESP esta ocupado. Intenta nuevamente.";
    default:
      return `ACK desconocido del ESP: ${code}`;
  }
}

function StatusNote({ status }: { status: RequestStatus }) {
  const toneClass =
    status.tone === "success"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : status.tone === "error"
      ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
      : status.tone === "loading"
      ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
      : "border-white/10 bg-white/5 text-slate-300";

  return (
    <p className={`mt-4 rounded-xl border p-3 text-sm ${toneClass}`}>
      {status.message}
    </p>
  );
}

function ColorPickerRow({
  id,
  label,
  value,
  fallback,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const safeValue = normalizeHexColor(value, fallback);

  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
      <label htmlFor={id} className="text-sm font-semibold text-slate-200">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="px-3 py-2 font-mono text-sm"
        aria-label={`${label} hexadecimal`}
      />
      <input
        type="color"
        value={safeValue}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full cursor-pointer p-1 sm:w-14"
        aria-label={`${label} selector`}
      />
    </div>
  );
}

function PinDigitField({
  label,
  value,
  onChange,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [autoFocus]);

  function handleChange(nextValue: string) {
    onChange(nextValue.replace(/\D/g, "").slice(0, 4));
  }

  return (
    <div>
      <label className="mb-3 block text-sm font-semibold text-slate-200">
        {label}
      </label>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete="one-time-code"
        className="sr-only"
      />
      <button
        type="button"
        className="grid w-full grid-cols-4 gap-3"
        onClick={() => inputRef.current?.focus()}
        aria-label={label}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            key={index}
            className={`app-panel-strong flex aspect-square items-center justify-center text-3xl font-black ${
              value[index] ? "text-cyan-200" : "text-slate-500"
            }`}
          >
            {value[index] ? "•" : index + 1}
          </span>
        ))}
      </button>
    </div>
  );
}

export default Home;
