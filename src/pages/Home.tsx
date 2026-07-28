// src/pages/Home.tsx
import React, { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate, useViewTransitionState } from "react-router-dom";
import { useWebSocket } from "../hooks/useWebSocket";
import PageHeader from "../components/PageHeader";
import useUser from "../contexts/UserContext";
import Modal from "../components/modal";
import SystemResetActions from "../components/SystemResetActions";
import ThemeModeToggleCard from "../components/ThemeModeToggleCard";
import HdAssetsSettingsCard from "../components/HdAssetsSettingsCard";
import AboutProjectPanel from "../components/AboutProjectPanel";
import ToggleButton from "../components/ToggleButton";
import { useScreenStreamModal } from "../contexts/ScreenStreamModalContext";
import { useScreen } from "../contexts/ScreenContext";
import { useCarMode, type SelectableCarMode } from "../contexts/CarModeContext";
import {
  getEspConnectionLabel,
  getEspNetworkLabel,
  isEspApOnly,
  useEspWifiStatus,
} from "../contexts/EspWifiStatusContext";
import { ESP_COMMANDS } from "../protocol/wsApi";
import {
  SCREEN_CODE_CONNECTIVITY_USB_CONNECTED,
  SCREEN_CODE_CONNECTIVITY_USB_DISCONNECTED,
} from "../screens/screenCodes";
import logoControl from "../assets/LogoControl.webp";
import logoMpuIr from "../assets/LogoMPUIR.webp";
import logoSeguidor from "../assets/LogoSeguidor.webp";
import logoWifiAp from "../assets/LogoWifiAP.webp";

type RequestStatus = {
  tone: "idle" | "loading" | "success" | "error";
  message: string;
};

type PinStep = "validate" | "change";
type SettingsTab = "settings" | "about";

type QtUsbDiagnostics = {
  connectedSince: number | null;
  connectedSinceEstimated: boolean;
  alivePeriodMs: number | null;
  aliveCount: number | null;
  rxOverflowCount: number | null;
  txQueueFullCount: number | null;
  queuedTxCount: number | null;
  txDropCount: number | null;
  updatedAt: number | null;
};

const PORT_FORWARDING_FIELD_MASK = 1 << 9;
const WEB_ALIVE_FIELD_MASK = 1 << 13;
const WEB_ALIVE_MIN_MS = 100;
const WEB_ALIVE_MAX_MS = 10_000;
const WEB_ALIVE_SAVE_DEBOUNCE_MS = 350;

function DevModeToggle() {
  const { devMode, setDevMode } = useUser();
  return (
    <ToggleButton
      checked={devMode}
      onChange={(next) => setDevMode(next)}
      className="app-mode-toggle app-mode-toggle--dev"
      labelClassName="app-mode-toggle__label"
      labels={true}
      size="lg"
      labelOn="Activo"
      labelOff="Inactivo"
      ariaLabel="Alternar modo desarrollador"
      title={devMode ? "Desactivar modo desarrollador" : "Activar modo desarrollador"}
    />
  );
}

const Home: React.FC = () => {
  const {
    connected,
    hello,
    heartbeatConfig,
    setHeartbeatInterval,
    setHeartbeatMaxRetries,
    toggleHeartbeatWatchdog,
    onHeartbeatReceived,
    lastHeartbeatAt,
    request,
    subscribeEvent,
  } = useWebSocket();
  const {
    status: espWifiStatus,
    refresh: refreshWifiStatus,
  } = useEspWifiStatus();

  const navigate = useNavigate();
  const { devMode, login, changePin, remotePinAuthenticated } = useUser();
  const {
    isOpen: isScreenStreamOpen,
    toggle: toggleScreenStreamModal,
  } = useScreenStreamModal();
  const { currentScreen } = useScreen();
  const { mode: carMode, status: carModeStatus, setCarMode } = useCarMode();
  const [on, setOn] = useState(false);
  const [openInfoModal, setOpenInfoModal] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("settings");
  const [openHeartbeatSettingsModal, setOpenHeartbeatSettingsModal] =
    useState(false);
  const [openQtDiagnosticsModal, setOpenQtDiagnosticsModal] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [openPinModal, setOpenPinModal] = useState(false);
  const [pinStep, setPinStep] = useState<PinStep>("validate");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinStatus, setPinStatus] = useState<RequestStatus>({
    tone: "idle",
    message: "Primero validamos el PIN actual contra el ESP.",
  });
  const [webAliveStatus, setWebAliveStatus] = useState<RequestStatus>({
    tone: "idle",
    message: "El intervalo se sincroniza con el alive exclusivo de la interfaz Web en F4.",
  });
  const [modeChangeMessage, setModeChangeMessage] = useState(
    "",
  );
  const [qtUsbConnected, setQtUsbConnected] = useState(false);
  const [qtUsbStateKnown, setQtUsbStateKnown] = useState(false);
  const [qtAliveReceivedAt, setQtAliveReceivedAt] = useState<number | null>(null);
  const [portForwardingEnabled, setPortForwardingEnabled] =
    useState<boolean | null>(null);
  const [portForwardingStatus, setPortForwardingStatus] = useState<RequestStatus>({
    tone: "idle",
    message: "El estado se consulta directamente a las preferencias persistidas de la F4.",
  });
  const [qtDiagnosticsLoading, setQtDiagnosticsLoading] = useState(false);
  const [qtDiagnostics, setQtDiagnostics] = useState<QtUsbDiagnostics>(() =>
    createEmptyQtUsbDiagnostics(),
  );

  // Refs para el timer del parpadeo
  const blinkIntervalRef = useRef<number | null>(null);
  const webAliveSaveTimerRef = useRef<number | null>(null);
  const preferencesLoadedRef = useRef(false);
  const modeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isModeMenuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!modeMenuRef.current?.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsModeMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isModeMenuOpen]);

  const applyPreferencesSnapshot = useCallback((data: Record<string, unknown>) => {
    const persisted = readWebAlivePeriodMs(data);
    if (persisted !== null) {
      setHeartbeatInterval(persisted);
      setWebAliveStatus({
        tone: "success",
        message: `Alive Web cargado desde F4: ${normalizeWebAlivePeriodMs(persisted)} ms.`,
      });
    }

    const forwarding = readPortForwardingEnabled(data);
    if (forwarding === null) {
      throw new Error("La F4 no devolvio unerRouterForwardingEnabled.");
    }
    setPortForwardingEnabled(forwarding);
    return forwarding;
  }, [setHeartbeatInterval]);

  const refreshF4Preferences = useCallback(async () => {
    const data = await request<Record<string, unknown>>(
      ESP_COMMANDS.GET_PREFERENCES,
      {},
      { timeoutMs: 3_000 },
    );
    return applyPreferencesSnapshot(data);
  }, [applyPreferencesSnapshot, request]);

  const refreshQtControlSnapshot = useCallback(async () => {
    const data = await request<Record<string, unknown>>(
      ESP_COMMANDS.GET_CONTROL,
      {},
      { timeoutMs: 3_000 },
    );
    const usbActive = data.usbActive;
    if (typeof usbActive !== "boolean") {
      throw new Error("La F4 no devolvio el estado QT/USB.");
    }

    const now = Date.now();
    const alivePeriodMs = readNonNegativeInteger(data.usbAlivePeriodMs);
    const aliveCount = readNonNegativeInteger(data.usbAliveAcceptedCount);
    setQtUsbConnected(usbActive);
    setQtUsbStateKnown(true);
    setQtDiagnostics((previous) => {
      const needsConnectionStart = usbActive && previous.connectedSince === null;
      return {
        connectedSince: usbActive
          ? previous.connectedSince ?? estimateQtConnectionStart(now, alivePeriodMs, aliveCount)
          : null,
        connectedSinceEstimated: usbActive
          ? needsConnectionStart || previous.connectedSinceEstimated
          : false,
        alivePeriodMs: alivePeriodMs ?? previous.alivePeriodMs,
        aliveCount: aliveCount ?? previous.aliveCount,
        rxOverflowCount: readNonNegativeInteger(data.usbRxOverflowCount) ?? previous.rxOverflowCount,
        txQueueFullCount: readNonNegativeInteger(data.usbTxQueueFullCount) ?? previous.txQueueFullCount,
        queuedTxCount: readNonNegativeInteger(data.usbQueuedTxCount) ?? previous.queuedTxCount,
        txDropCount: readNonNegativeInteger(data.usbTxDropCount) ?? previous.txDropCount,
        updatedAt: now,
      };
    });
    return data;
  }, [request]);

  useEffect(() => {
    if (!connected || !remotePinAuthenticated) {
      preferencesLoadedRef.current = false;
      setPortForwardingEnabled(null);
      return;
    }
    if (preferencesLoadedRef.current) return;
    preferencesLoadedRef.current = true;

    void refreshF4Preferences()
      .catch((cause) => {
        preferencesLoadedRef.current = false;
        setPortForwardingStatus({
          tone: "error",
          message: cause instanceof Error ? cause.message : "No se pudo consultar port forwarding.",
        });
        setWebAliveStatus({
          tone: "error",
          message: cause instanceof Error ? cause.message : "No se pudo leer el alive Web de F4.",
        });
      });
  }, [connected, refreshF4Preferences, remotePinAuthenticated]);

  useEffect(() => {
    if (!connected || !remotePinAuthenticated) {
      setQtUsbConnected(false);
      setQtUsbStateKnown(false);
      setQtAliveReceivedAt(null);
      setQtDiagnostics(createEmptyQtUsbDiagnostics());
      return;
    }

    let canceled = false;
    void refreshQtControlSnapshot().catch((cause) => {
      if (canceled) return;
      console.warn("[qt-usb] no se pudo leer el estado inicial", cause);
    });

    return () => {
      canceled = true;
    };
  }, [connected, refreshQtControlSnapshot, remotePinAuthenticated]);

  useEffect(() => {
    const offQtUsbState = subscribeEvent("qtUsbStateChanged", ({ data }) => {
      if (typeof data !== "object" || data === null) return;
      const connectedValue = (data as Record<string, unknown>).connected;
      if (typeof connectedValue !== "boolean") return;
      setQtUsbConnected(connectedValue);
      setQtUsbStateKnown(true);
      setQtDiagnostics((previous) => ({
        ...previous,
        connectedSince: connectedValue ? previous.connectedSince ?? Date.now() : null,
        connectedSinceEstimated: connectedValue,
        updatedAt: Date.now(),
      }));
    });

    const offUsbScreenFallback = subscribeEvent("screen.changed", ({ data }) => {
      if (typeof data !== "object" || data === null) return;
      const record = data as Record<string, unknown>;
      const screenCode = record.screenCode ?? record.screen_code;
      if (screenCode === SCREEN_CODE_CONNECTIVITY_USB_CONNECTED) {
        setQtUsbConnected(true);
        setQtUsbStateKnown(true);
        setQtDiagnostics((previous) => ({
          ...previous,
          connectedSince: previous.connectedSince ?? Date.now(),
          connectedSinceEstimated: true,
          updatedAt: Date.now(),
        }));
      } else if (screenCode === SCREEN_CODE_CONNECTIVITY_USB_DISCONNECTED) {
        setQtUsbConnected(false);
        setQtUsbStateKnown(true);
        setQtDiagnostics((previous) => ({
          ...previous,
          connectedSince: null,
          connectedSinceEstimated: false,
          updatedAt: Date.now(),
        }));
      }
    });

    const offQtAlive = subscribeEvent("qtAlive", ({ data }) => {
      if (typeof data !== "object" || data === null) return;
      const record = data as Record<string, unknown>;
      if (record.cmd !== 0x31 || record.src !== 0x02 ||
          record.dst !== 0x03 || record.route !== 0x23) return;
      setQtAliveReceivedAt(Date.now());
    });

    return () => {
      offQtUsbState();
      offUsbScreenFallback();
      offQtAlive();
    };
  }, [subscribeEvent]);

  const scheduleWebAliveUpdate = useCallback((rawValue: number) => {
    const periodMs = normalizeWebAlivePeriodMs(rawValue);
    setHeartbeatInterval(periodMs);
    setWebAliveStatus({ tone: "loading", message: `Guardando alive Web de ${periodMs} ms en F4...` });

    if (webAliveSaveTimerRef.current !== null) {
      window.clearTimeout(webAliveSaveTimerRef.current);
    }
    webAliveSaveTimerRef.current = window.setTimeout(() => {
      webAliveSaveTimerRef.current = null;
      if (!connected || !remotePinAuthenticated) {
        setWebAliveStatus({ tone: "error", message: "Se necesita una sesion PIN activa para guardar el alive Web." });
        return;
      }

      const values = [periodMs & 0xff, (periodMs >>> 8) & 0xff];
      void request<Record<string, unknown>>(
        ESP_COMMANDS.SET_PREFERENCES,
        { fieldMask: WEB_ALIVE_FIELD_MASK, values },
        { timeoutMs: 3_500 },
      ).then((data) => {
        if (typeof data.status === "number" && data.status !== 0) {
          throw new Error(`F4 rechazo webAlivePeriodMs (status ${data.status}).`);
        }
        setWebAliveStatus({ tone: "success", message: `Alive Web aplicado en F4: ${periodMs} ms.` });
      }).catch((cause) => {
        setWebAliveStatus({
          tone: "error",
          message: cause instanceof Error ? cause.message : "No se pudo guardar el alive Web en F4.",
        });
      });
    }, WEB_ALIVE_SAVE_DEBOUNCE_MS);
  }, [connected, remotePinAuthenticated, request, setHeartbeatInterval]);

  // Suscribirse a heartbeats recibidos
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
      if (webAliveSaveTimerRef.current !== null) {
        clearTimeout(webAliveSaveTimerRef.current);
      }
    };
  }, []);

  // Manejar envío de heartbeat manual
  const handleSendHeartbeat = async () => {
    await refreshWifiStatus();
    onHeartbeatReceived();
  };

  const missedHeartbeatCount = Math.max(
    0,
    heartbeatConfig.maxRetries - heartbeatConfig.remainingRetries
  );
  const shouldShowLastHeartbeat =
    missedHeartbeatCount >= 2 || heartbeatConfig.remainingRetries === 0;
  const apOnly = isEspApOnly(espWifiStatus);
  const connectionLabel = connected
    ? getEspConnectionLabel(espWifiStatus)
    : "Desconectado";
  const connectionTone = connected ? "ok" : "error";
  const canUseActions = connected || devMode;
  const realLinkActive = connected && hello?.backend?.f4Alive === true;
  const currentScreenTitle = currentScreen?.title ?? "Sin pantalla sincronizada";
  const heartbeatLabel = formatHeartbeatTime(lastHeartbeatAt);
  const qtAliveLabel = qtAliveReceivedAt
    ? formatHeartbeatTime(qtAliveReceivedAt)
    : "Sin recibir";
  const portForwardingLabel = portForwardingEnabled === null
    ? "--"
    : portForwardingEnabled
      ? "ON"
      : "OFF";
  const qtUsbPortForwardingLabel = `${qtUsbConnected ? "Conectado" : "Desconectado"} · ${portForwardingLabel}`;
  const qtUsbPortForwardingTone: HomeTone = !qtUsbStateKnown || portForwardingEnabled === null
    ? "muted"
    : !qtUsbConnected
      ? "error"
      : portForwardingEnabled
        ? "ok"
        : "info";
  const watchdogLabel = `${heartbeatConfig.remainingRetries}/${heartbeatConfig.maxRetries}`;
  const wifiNetworkLabel = espWifiStatus?.networkSsid || "--";
  const wifiRssiLabel = espWifiStatus?.rssiDbm !== null && espWifiStatus?.rssiDbm !== undefined
    ? `${espWifiStatus.rssiDbm} dBm`
    : "N/D";
  const systemStateLabel = apOnly
    ? "ESP emitiendo su red WiFi"
    : connected
      ? "Sistema en espera"
      : "Listo para conectar";
  const networkLabel = connected
    ? getEspNetworkLabel(espWifiStatus)
    : "Sin red";

  function openPinEditor() {
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

    setPinStatus({ tone: "loading", message: "Validando PIN actual con el ESP..." });
    const result = await login(currentPin);
    if (result.ok) {
      setPinStep("change");
      setPinStatus({ tone: "success", message: "PIN validado por STM32. Ahora elegi el nuevo PIN." });
    } else {
      setPinStatus({ tone: "error", message: result.message ?? "PIN rechazado por STM32." });
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

    setPinStatus({ tone: "loading", message: "Enviando cambio de PIN al ESP..." });
    const result = await changePin(currentPin, newPin);
    if (!result.ok) {
      setPinStatus({ tone: "error", message: result.message ?? "STM32 rechazo el cambio de PIN." });
      return;
    }
    setPinStatus({ tone: "success", message: "PIN cambiado y confirmado por STM32." });
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
  }

  async function handleCarModeChange(nextMode: SelectableCarMode) {
    setIsModeMenuOpen(false);
    setModeChangeMessage(`Cambiando a ${formatCarMode(nextMode)}`);
    const changed = await setCarMode(nextMode);
    setModeChangeMessage(changed
      ? `Modo ${formatCarMode(nextMode)} cambiado.`
      : "Error al cambiar modo");
  }

  async function refreshQtDiagnostics() {
    if (!connected || !remotePinAuthenticated) {
      setPortForwardingStatus({
        tone: "error",
        message: "Se necesita conexion API v1 y sesion PIN para consultar la F4.",
      });
      return;
    }

    setQtDiagnosticsLoading(true);
    try {
      await Promise.all([refreshQtControlSnapshot(), refreshF4Preferences()]);
      setPortForwardingStatus({
        tone: "success",
        message: "Estado QT/USB y port forwarding actualizados desde la F4.",
      });
    } catch (cause) {
      setPortForwardingStatus({
        tone: "error",
        message: cause instanceof Error ? cause.message : "No se pudieron actualizar los datos QT/USB.",
      });
    } finally {
      setQtDiagnosticsLoading(false);
    }
  }

  function openQtDiagnostics() {
    setOpenQtDiagnosticsModal(true);
    void refreshQtDiagnostics();
  }

  async function handlePortForwardingChange(nextEnabled: boolean) {
    if (!connected || !remotePinAuthenticated) {
      setPortForwardingStatus({
        tone: "error",
        message: "No se puede cambiar PF sin conexion y sesion PIN activa.",
      });
      return;
    }

    setPortForwardingStatus({
      tone: "loading",
      message: `${nextEnabled ? "Activando" : "Desactivando"} port forwarding en la F4...`,
    });
    try {
      const data = await request<Record<string, unknown>>(
        ESP_COMMANDS.SET_PREFERENCES,
        { fieldMask: PORT_FORWARDING_FIELD_MASK, values: [nextEnabled ? 1 : 0] },
        { timeoutMs: 3_500 },
      );
      if (typeof data.status === "number" && data.status !== 0) {
        throw new Error(`F4 rechazo el cambio de port forwarding (status ${data.status}).`);
      }
      const confirmed = await refreshF4Preferences();
      if (confirmed !== nextEnabled) {
        throw new Error("La F4 respondio, pero el estado PF releido no coincide.");
      }
      setPortForwardingStatus({
        tone: "success",
        message: `Port forwarding ${nextEnabled ? "activo" : "desactivado"} y persistido en la F4.`,
      });
    } catch (cause) {
      setPortForwardingStatus({
        tone: "error",
        message: cause instanceof Error ? cause.message : "No se pudo cambiar port forwarding.",
      });
      try {
        await refreshF4Preferences();
      } catch {
        setPortForwardingEnabled(null);
      }
    }
  }

  return (
    <div className="home-command-shell">
      <div className="home-grid-bg" aria-hidden="true" />
      <div className="home-dashboard-frame">
        <PageHeader
          className="app-page-header home-page-header"
          titleOverride="Auto Microcontroladores 2025"
          leadingSlot={<BrandGlyph />}
          setOpenSettingsModal={setOpenSettingsModal}
          setOpenInfoModal={setOpenInfoModal}
        />

        <HomeSystemStatusStrip
          connected={connected}
          connectionLabel={connectionLabel}
          connectionTone={connectionTone}
          systemStateLabel={systemStateLabel}
          networkLabel={networkLabel}
          qtUsbConnected={qtUsbConnected}
          qtUsbStateKnown={qtUsbStateKnown}
          qtUsbPortForwardingLabel={qtUsbPortForwardingLabel}
          qtUsbPortForwardingTone={qtUsbPortForwardingTone}
          onOpenQtDiagnostics={openQtDiagnostics}
        />

        {shouldShowLastHeartbeat ? (
          <div className="home-watchdog-alert">
            Ultimo heartbeat: {heartbeatLabel}. Watchdog sin respuesta:{" "}
            {missedHeartbeatCount} de {heartbeatConfig.maxRetries}.
          </div>
        ) : null}

        <div className="home-top-row">
          <section className="home-tech-panel home-mode-panel" aria-label="Selector de modo del auto">
            <span className="home-panel-icon home-panel-icon--mode" aria-hidden="true">
              <HomeIcon name="chip" />
            </span>
            <div className="home-mode-copy">
              <span className="home-kicker">Modo actual</span>
              <h2>{formatCarMode(carMode)}</h2>
            </div>
            <div className="home-mode-action">
              <div className="home-mode-dropdown" ref={modeMenuRef}>
                <HomeDropdownButton
                  label="Cambiar"
                  open={isModeMenuOpen}
                  ariaLabel="Mostrar modos disponibles"
                  disabled={!connected || !remotePinAuthenticated || carModeStatus === "loading"}
                  onClick={() => setIsModeMenuOpen((current) => !current)}
                />
                {isModeMenuOpen ? (
                  <div className="home-mode-options" role="menu" aria-label="Modos disponibles">
                    {(["IDLE", "FOLLOW", "TEST"] as SelectableCarMode[])
                      .filter((candidate) => candidate !== carMode)
                      .map((candidate) => (
                        <button
                          key={candidate}
                          type="button"
                          role="menuitem"
                          className="home-mode-option"
                          disabled={!connected || !remotePinAuthenticated || carModeStatus === "loading"}
                          onClick={() => void handleCarModeChange(candidate)}
                        >
                          {formatCarMode(candidate)}
                        </button>
                      ))}
                  </div>
                ) : null}
              </div>
              <span
                className={`home-mode-message home-mode-message--${carModeStatus}`}
                aria-live="polite"
                title={modeChangeMessage}
              >
                {modeChangeMessage}
              </span>
            </div>
          </section>

          <section className="home-tech-panel home-oled-panel">
            <span className="home-panel-icon home-panel-icon--danger" aria-hidden="true">
              <HomeIcon name="oled" />
            </span>
            <div className="home-oled-copy">
              <span className="home-kicker">Pantalla actual</span>
              <h2>{currentScreenTitle}</h2>
            </div>
            <div className="home-oled-action">
              <HomeDropdownButton
                label="Abrir visor"
                open={isScreenStreamOpen}
                ariaLabel="Abrir visor OLED global"
                onClick={toggleScreenStreamModal}
              />
              <span className={`home-inline-status home-inline-status--${connected ? "ok" : "muted"}`}>
                <span className={`home-status-dot home-status-dot--${connected ? "ok" : "muted"}`} />
                Sincronizando en segundo plano
              </span>
            </div>
          </section>

          <section className="home-health-panel" aria-label="Heartbeat y watchdog">
            <button
              type="button"
              className="home-heartbeat-card"
              onClick={handleSendHeartbeat}
              disabled={!canUseActions}
            >
              <span className="home-heartbeat-icon" aria-hidden="true">
                <HomeIcon name="pulse" />
              </span>
              <span>
                <span className="home-heartbeat-title">Enviar heartbeat</span>
                <span className="home-heartbeat-subtitle">Sincronizar sistema</span>
              </span>
            </button>

            <button
              type="button"
              className="home-health-status home-health-status--config"
              onClick={() => setOpenHeartbeatSettingsModal(true)}
              aria-label="Abrir configuracion de heartbeat y watchdog"
            >
              <span
                className={`home-status-dot home-health-status__pulse home-status-dot--${connectionTone} ${
                  connected && on ? "home-status-dot--live" : ""
                }`}
                aria-hidden="true"
              />
              <span className="home-health-status__stack">
                <span className="home-health-status__line">
                  <span className="home-health-status__icon" aria-hidden="true">
                    <HomeIcon name="pulse" />
                  </span>
                  <span>
                    <strong>{heartbeatConfig.isActive ? "Watchdog activo" : "Watchdog en espera"}</strong>
                    <small>{watchdogLabel} reintentos</small>
                  </span>
                </span>
                <span className="home-health-status__line">
                  <span className="home-health-status__icon" aria-hidden="true">
                    <HomeIcon name="clock" />
                  </span>
                  <span>
                    <strong>Intervalo</strong>
                    <small>{heartbeatConfig.intervalMs} ms</small>
                  </span>
                </span>
                <span className="home-health-status__line">
                  <span className="home-health-status__icon" aria-hidden="true">
                    <HomeIcon name="pulse" />
                  </span>
                  <span>
                    <strong>Ultimo pulso</strong>
                    <small>{heartbeatLabel}</small>
                  </span>
                </span>
              </span>
              <ChevronDownIcon open={openHeartbeatSettingsModal} />
            </button>
          </section>
        </div>

        <div className="home-modules-grid">
          <NavigationModuleCard
            title="MPU + IR"
            backgroundImage={logoMpuIr}
            description="Dashboard 3D, telemetria y diagnostico del sistema."
            status={realLinkActive ? "Conectado" : "No conectado"}
            statusTone={realLinkActive ? "ok" : "error"}
            metaLeft="UNER v2"
            metaRight={realLinkActive ? "Real" : "Offline"}
            icon="chip"
            primary
            onClick={() => navigate("/statics", { viewTransition: true })}
          />
          <NavigationModuleCard
            title="Control"
            backgroundImage={logoControl}
            description="Comandos, pruebas y operacion del vehiculo."
            status={realLinkActive ? "Conectado" : "No conectado"}
            statusTone={realLinkActive ? "ok" : "error"}
            metaLeft="Modo manual"
            metaRight={realLinkActive ? "Listo" : "Offline"}
            icon="gamepad"
            onClick={() => navigate("/control", { viewTransition: true })}
          />
          <NavigationModuleCard
            title="Seguidor"
            backgroundImage={logoSeguidor}
            description="Mapa de pista, replay local y diagnostico de linea."
            status="Simulado"
            statusTone="info"
            metaLeft="IR/TCRT"
            metaRight="Replay"
            icon="track"
            onClick={() => navigate("/seguidor-pista", { viewTransition: true })}
          />
          <NavigationModuleCard
            title="WiFi"
            backgroundImage={logoWifiAp}
            description="Conectividad, red y enlace de datos."
            status={realLinkActive ? "Conectada" : "No conectada"}
            statusTone={realLinkActive ? "ok" : "error"}
            metaLeft={`Red: ${wifiNetworkLabel}`}
            metaRight={`RSSI: ${wifiRssiLabel}`}
            icon="wifi"
            onClick={() => navigate("/wifi", { viewTransition: true })}
          />
        </div>

      </div>
      {openInfoModal && (
        <Modal
          isOpen={openInfoModal}
          onClose={() => setOpenInfoModal(false)}
          closeOnOverlayClick={false}
          containerClassnames="home-info-dialog flex-col"
        >
          <div className="dashboard-modal-heading">
            <div className="app-kicker">Informacion</div>
            <h2>Pantalla de Inicio</h2>
            <p>
              Centro de acceso al estado de conexion, heartbeat, watchdog y
              modulos principales del sistema.
            </p>
          </div>
          <div className="info-dashboard-grid">
            <section className="info-dashboard-card">
              <span className="info-dashboard-card__icon">
                <HomeIcon name="signal" />
              </span>
              <div>
                <h3>Estado visible</h3>
                <p>
                  Muestra si el enlace esta activo, el ultimo heartbeat recibido
                  y la condicion general antes de entrar a control, MPU o WiFi.
                </p>
              </div>
            </section>
            <section className="info-dashboard-card">
              <span className="info-dashboard-card__icon">
                <HomeIcon name="pulse" />
              </span>
              <div>
                <h3>Heartbeat y watchdog</h3>
                <p>
                  Permite enviar un pulso manual y ajustar la supervision de
                  vida del enlace sin mezclarlo con acciones de control fisico.
                </p>
              </div>
            </section>
            <section className="info-dashboard-card info-dashboard-card--wide">
              <span className="info-dashboard-card__icon">
                <HomeIcon name="cube" />
              </span>
              <div>
                <h3>Navegacion principal</h3>
                <p>
                  Desde aca se accede a las secciones operativas. Las tarjetas
                  mantienen estados compactos para evitar repetir informacion en
                  cada pantalla.
                </p>
              </div>
            </section>
          </div>
        </Modal>
      )}
      {openQtDiagnosticsModal && (
        <Modal
          isOpen={openQtDiagnosticsModal}
          onClose={() => setOpenQtDiagnosticsModal(false)}
          closeOnOverlayClick={true}
          containerClassnames="home-settings-dialog flex-col"
        >
          <div className="dashboard-modal-heading">
            <div className="app-kicker">QT / USB · Port forwarding</div>
            <h2>Diagnostico del enlace QT</h2>
            <p>
              Estado autoritativo de USB CDC informado por la F4 y ultimo Alive
              que completo el recorrido QT → F4 → ESP → Web.
            </p>
          </div>

          <section className="settings-dashboard-card qt-forwarding-modal-control">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-bold text-white">Port forwarding UNER</h3>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                  Controla el reenvio QT → F4 → ESP. Los comandos Web dirigidos
                  a la propia F4 siguen disponibles cuando PF esta desactivado.
                </p>
              </div>
              <div className="settings-forwarding-control">
                <strong>{portForwardingEnabled === null ? "--" : portForwardingEnabled ? "ON" : "OFF"}</strong>
                <ToggleButton
                  checked={portForwardingEnabled ?? false}
                  onChange={(next) => void handlePortForwardingChange(next)}
                  disabled={!connected || !remotePinAuthenticated || portForwardingEnabled === null || portForwardingStatus.tone === "loading"}
                  labels
                  labelOn="ON"
                  labelOff="OFF"
                  size="lg"
                  ariaLabel="Activar o desactivar port forwarding UNER en la F4"
                />
              </div>
            </div>
            <StatusNote status={portForwardingStatus} />
          </section>

          <div className="qt-diagnostics-summary">
            <article className={`qt-diagnostics-card qt-diagnostics-card--${qtUsbConnected ? "ok" : "error"}`}>
              <span>Conexion QT / USB</span>
              <strong>{qtUsbConnected ? "Activa" : "Desconectada"}</strong>
              <small>{qtUsbStateKnown ? "Confirmada por la F4" : "Pendiente de consulta"}</small>
            </article>
            <article className={`qt-diagnostics-card qt-diagnostics-card--${portForwardingEnabled ? "ok" : portForwardingEnabled === false ? "warning" : "muted"}`}>
              <span>Port forwarding</span>
              <strong>{portForwardingEnabled === null ? "Sin consultar" : portForwardingEnabled ? "PF ON" : "PF OFF"}</strong>
              <small>Preferencia persistida en F4</small>
            </article>
            <article className={`qt-diagnostics-card qt-diagnostics-card--${qtAliveReceivedAt ? "ok" : "muted"}`}>
              <span>Ultimo Alive Qt → Web</span>
              <strong>{qtAliveLabel}</strong>
              <small>Route 0x23 · PING 0x31</small>
            </article>
          </div>

          <section className="settings-dashboard-card mt-4">
            <dl className="qt-diagnostics-table">
              <QtDiagnosticRow
                label="Inicio de conexion"
                value={qtDiagnostics.connectedSince
                  ? `${formatLocalDateTime(qtDiagnostics.connectedSince)}${qtDiagnostics.connectedSinceEstimated ? " (estimado)" : ""}`
                  : "Sin conexion activa"}
              />
              <QtDiagnosticRow
                label="Ultimo Alive Qt → Web"
                value={qtAliveReceivedAt ? formatLocalDateTime(qtAliveReceivedAt) : "Nunca recibido"}
              />
              <QtDiagnosticRow
                label="Alive USB generado por F4"
                value={qtDiagnostics.aliveCount === null ? "Sin datos" : `${qtDiagnostics.aliveCount} tramas`}
              />
              <QtDiagnosticRow
                label="Periodo Alive USB"
                value={qtDiagnostics.alivePeriodMs === null ? "Sin datos" : `${qtDiagnostics.alivePeriodMs} ms`}
              />
              <QtDiagnosticRow
                label="RX overflow / TX descartadas"
                value={`${formatDiagnosticCounter(qtDiagnostics.rxOverflowCount)} / ${formatDiagnosticCounter(qtDiagnostics.txDropCount)}`}
              />
              <QtDiagnosticRow
                label="Cola TX llena / pendientes"
                value={`${formatDiagnosticCounter(qtDiagnostics.txQueueFullCount)} / ${formatDiagnosticCounter(qtDiagnostics.queuedTxCount)}`}
              />
              <QtDiagnosticRow
                label="Datos actualizados"
                value={qtDiagnostics.updatedAt ? formatLocalDateTime(qtDiagnostics.updatedAt) : "Sin consultar"}
              />
            </dl>
            <div className="qt-diagnostics-actions">
              <button
                type="button"
                className="app-button--ghost px-4 py-2 font-semibold"
                onClick={() => void refreshQtDiagnostics()}
                disabled={qtDiagnosticsLoading}
              >
                {qtDiagnosticsLoading ? "Actualizando..." : "Actualizar datos"}
              </button>
            </div>
          </section>
        </Modal>
      )}
      {openHeartbeatSettingsModal && (
        <Modal
          isOpen={openHeartbeatSettingsModal}
          onClose={() => setOpenHeartbeatSettingsModal(false)}
          closeOnOverlayClick={true}
          containerClassnames="home-settings-dialog flex-col"
        >
          <div className="dashboard-modal-heading">
            <div className="app-kicker">Heartbeat</div>
            <h2>Configuracion de enlace</h2>
            <p>
              Ajusta el intervalo del pulso y la tolerancia del watchdog. Esta
              configuracion queda separada del centro general porque afecta la
              supervision de comunicacion.
            </p>
          </div>

          <section className="settings-dashboard-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-white">Watchdog de heartbeat</h3>
                <p className="text-sm text-slate-400">
                  Define cada cuanto se espera actividad y cuantos reintentos se
                  toleran antes de marcar el enlace como caido.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleHeartbeatWatchdog}
                className={`px-3 py-1 text-sm font-semibold ${
                  heartbeatConfig.isActive ? "btn-success" : "app-button--ghost"
                }`}
                disabled={!canUseActions || heartbeatConfig.maxRetries === 0}
              >
                {heartbeatConfig.maxRetries === 0
                  ? "Desactivado"
                  : heartbeatConfig.isActive
                    ? "Activo"
                    : "Inactivo"}
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
              htmlFor="heartbeat-settings-interval"
              className="mb-2 block text-sm text-slate-200"
            >
              {`Intervalo heartbeat (${heartbeatConfig.intervalMs} ms)`}
            </label>
            <input
              id="heartbeat-settings-interval"
              type="range"
              min={WEB_ALIVE_MIN_MS}
              max={WEB_ALIVE_MAX_MS}
              step={100}
              value={heartbeatConfig.intervalMs}
              onChange={(e) => scheduleWebAliveUpdate(Number(e.target.value))}
              className="mb-4 w-full"
            />
            <StatusNote status={webAliveStatus} />

            <label
              htmlFor="heartbeat-settings-retries"
              className="mb-2 block text-sm text-slate-200"
            >
              {`Intentos maximos (${heartbeatConfig.maxRetries})`}
            </label>
            <input
              id="heartbeat-settings-retries"
              type="range"
              min={0}
              max={10}
              step={1}
              value={heartbeatConfig.maxRetries}
              onChange={(e) => setHeartbeatMaxRetries(Number(e.target.value))}
              className="w-full"
            />
            <p className="mt-2 text-xs text-slate-400">
              0 reintentos desactiva el watchdog y permite usar la interfaz sin supervision permanente del enlace.
            </p>
          </section>
        </Modal>
      )}
      {openSettingsModal && (
        <Modal
          isOpen={openSettingsModal}
          onClose={() => setOpenSettingsModal(false)}
          closeOnOverlayClick={false}
          containerClassnames="home-settings-dialog flex-col"
        >
          <div className="settings-modal-tab-shell">
            <div
              className="settings-modal-tab-group"
              role="tablist"
              aria-label="Secciones de configuración"
            >
              <button
                id="settings-general-tab"
                type="button"
                role="tab"
                aria-selected={settingsTab === "settings"}
                aria-controls="settings-general-panel"
                className={settingsTab === "settings" ? "settings-modal-tab settings-modal-tab--active" : "settings-modal-tab"}
                onClick={() => setSettingsTab("settings")}
              >
                Configuración
              </button>
              <button
                id="settings-about-tab"
                type="button"
                role="tab"
                aria-selected={settingsTab === "about"}
                aria-controls="settings-about-panel"
                className={settingsTab === "about" ? "settings-modal-tab settings-modal-tab--active" : "settings-modal-tab"}
                onClick={() => setSettingsTab("about")}
              >
                Acerca de
              </button>
            </div>
          </div>

          <div className="dashboard-modal-heading">
            <div className="app-kicker">Configuracion</div>
            <h2>{settingsTab === "settings" ? "Centro de ajustes" : "Acerca del proyecto"}</h2>
            <p>
              {settingsTab === "settings"
                ? "Ajustes locales de interfaz, accesos de seguridad y herramientas auxiliares. El modo visual se aplica a toda la app."
                : "Identidad, compilaciones confirmadas por la placa y repositorios que forman Auto Microcontroladores."}
            </p>
          </div>

          {settingsTab === "settings" ? (
            <div
              id="settings-general-panel"
              role="tabpanel"
              aria-labelledby="settings-general-tab"
            >
              <div className="settings-dashboard-grid">
                <ThemeModeToggleCard className="settings-appearance-card--wide" />
                <HdAssetsSettingsCard />
              </div>
              <section className="settings-dashboard-card mt-4">
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
              <section className="settings-dashboard-card mt-4">
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
            </div>
          ) : (
            <div
              id="settings-about-panel"
              role="tabpanel"
              aria-labelledby="settings-about-tab"
            >
              <AboutProjectPanel />
            </div>
          )}
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

function formatHeartbeatTime(timestamp: number | null) {
  if (!timestamp) {
    return "sin heartbeat";
  }

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function formatLocalDateTime(timestamp: number) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function createEmptyQtUsbDiagnostics(): QtUsbDiagnostics {
  return {
    connectedSince: null,
    connectedSinceEstimated: false,
    alivePeriodMs: null,
    aliveCount: null,
    rxOverflowCount: null,
    txQueueFullCount: null,
    queuedTxCount: null,
    txDropCount: null,
    updatedAt: null,
  };
}

function readNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function estimateQtConnectionStart(
  now: number,
  alivePeriodMs: number | null,
  aliveCount: number | null,
) {
  if (alivePeriodMs === null || aliveCount === null) return now;
  const completedPeriods = Math.max(0, aliveCount - 1);
  return Math.max(0, now - completedPeriods * alivePeriodMs);
}

function formatDiagnosticCounter(value: number | null) {
  return value === null ? "--" : String(value);
}

function formatCarMode(mode: string): string {
  switch (mode) {
    case "IDLE": return "Espera";
    case "FOLLOW": return "Seguidor";
    case "TEST": return "Testeo";
    default: return "Sin sincronizar";
  }
}

type HomeTone = "ok" | "error" | "info" | "muted";
type HomeIconName =
  | "oled"
  | "pulse"
  | "clock"
  | "eye"
  | "eyeOff"
  | "cube"
  | "signal"
  | "chip"
  | "gamepad"
  | "track"
  | "wifi";

function BrandGlyph() {
  return (
    <span className="home-brand-glyph" aria-hidden="true">
      <HomeIcon name="cube" />
    </span>
  );
}

function normalizeWebAlivePeriodMs(value: number): number {
  if (!Number.isFinite(value)) return 1_000;
  return Math.min(
    WEB_ALIVE_MAX_MS,
    Math.max(WEB_ALIVE_MIN_MS, Math.round(value / 100) * 100),
  );
}

function readWebAlivePeriodMs(data: Record<string, unknown>): number | null {
  const nested = typeof data.preferences === "object" && data.preferences !== null
    ? data.preferences as Record<string, unknown>
    : null;
  const candidate = data.webAlivePeriodMs ?? nested?.webAlivePeriodMs;
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? normalizeWebAlivePeriodMs(candidate)
    : null;
}

function readPortForwardingEnabled(data: Record<string, unknown>): boolean | null {
  const nested = typeof data.preferences === "object" && data.preferences !== null
    ? data.preferences as Record<string, unknown>
    : null;
  const candidate = data.unerRouterForwardingEnabled ?? nested?.unerRouterForwardingEnabled;
  return typeof candidate === "boolean" ? candidate : null;
}

function HomeDropdownButton({
  label,
  open,
  ariaLabel,
  disabled = false,
  onClick,
}: {
  label: string;
  open: boolean;
  ariaLabel: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="home-floating-dropdown"
      aria-label={ariaLabel}
      aria-expanded={open}
      disabled={disabled}
      onClick={onClick}
    >
      <span>{label}</span>
      <ChevronDownIcon open={open} />
    </button>
  );
}

function SystemMetricRow({
  label,
  value,
  tone = "muted",
  onClick,
  ariaLabel,
}: {
  label: string;
  value: string;
  tone?: HomeTone;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const content = (
    <>
      <span className={`home-system-row__dot home-system-row__dot--${tone}`} />
      <span className="home-system-row__label">{label}</span>
      <span className={`home-system-row__value home-system-row__value--${tone}`}>
        {value}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="home-system-row home-system-row--interactive"
        onClick={onClick}
        aria-label={ariaLabel ?? label}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="home-system-row">
      {content}
    </div>
  );
}

function QtDiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="qt-diagnostics-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function HomeSystemStatusStrip({
  connected,
  connectionLabel,
  connectionTone,
  systemStateLabel,
  networkLabel,
  qtUsbConnected,
  qtUsbStateKnown,
  qtUsbPortForwardingLabel,
  qtUsbPortForwardingTone,
  onOpenQtDiagnostics,
}: {
  connected: boolean;
  connectionLabel: string;
  connectionTone: HomeTone;
  systemStateLabel: string;
  networkLabel: string;
  qtUsbConnected: boolean;
  qtUsbStateKnown: boolean;
  qtUsbPortForwardingLabel: string;
  qtUsbPortForwardingTone: HomeTone;
  onOpenQtDiagnostics: () => void;
}) {
  return (
    <section className="home-system-strip" aria-label="Estado general del sistema">
      <SystemMetricRow
        label="Estado"
        value={systemStateLabel}
        tone={connected ? "ok" : "muted"}
      />
      <SystemMetricRow
        label="Conexión"
        value={connectionLabel}
        tone={connectionTone}
      />
      <SystemMetricRow label="Red ESP" value={networkLabel} tone="info" />
      <SystemMetricRow
        label="QT / USB · PF"
        value={qtUsbPortForwardingLabel}
        tone={qtUsbPortForwardingTone}
        onClick={onOpenQtDiagnostics}
        ariaLabel={`Abrir diagnostico QT USB y port forwarding. ${qtUsbConnected ? "QT conectado" : "QT desconectado"}. ${qtUsbStateKnown ? qtUsbPortForwardingLabel : "Estado pendiente"}`}
      />
    </section>
  );
}

function NavigationModuleCard({
  title,
  backgroundImage,
  eyebrow,
  description,
  status,
  statusTone,
  metaLeft,
  metaRight,
  icon,
  primary = false,
  disabled = false,
  onClick,
}: {
  title: string;
  backgroundImage: string;
  eyebrow?: string;
  description: string;
  status: string;
  statusTone: HomeTone;
  metaLeft: string;
  metaRight: string;
  icon: HomeIconName;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`home-module-card ${primary ? "home-module-card--primary" : ""}`}
      style={{ "--home-module-image": `url("${backgroundImage}")` } as React.CSSProperties}
      onClick={onClick}
      disabled={disabled}
    >
      {eyebrow ? <span className="home-module-card__eyebrow">{eyebrow}</span> : null}
      <span className="home-module-card__icon">
        <HomeIcon name={icon} />
      </span>
      <span className="home-module-card__content">
        <span className="home-module-card__title">{title}</span>
        <span className="home-module-card__description">{description}</span>
      </span>
      <span className="home-module-card__arrow" aria-hidden="true">
        <ChevronRightIcon />
      </span>
      <span className="home-module-card__meta">
        <span className={`home-inline-status home-inline-status--${statusTone}`}>
          <span className={`home-status-dot home-status-dot--${statusTone}`} />
          {status}
        </span>
        <span title={metaLeft}>{metaLeft}</span>
        <span title={metaRight}>{metaRight}</span>
      </span>
    </button>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function ChevronDownIcon({ open = false }: { open?: boolean }) {
  return (
    <svg
      className={`home-dropdown-chevron ${open ? "home-dropdown-chevron--open" : ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function HomeIcon({ name }: { name: HomeIconName }) {
  if (name === "pulse") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 8.48 12h-2.16A7 7 0 1 1 19 12h-3l4 4 4-4h-3a9 9 0 0 0-9-9Z" />
        <path d="M3.5 12h3l1.35-3.25 2.9 7.5L13.5 10l1.25 2H20" />
      </svg>
    );
  }

  if (name === "oled") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="11" rx="1.5" />
        <path d="M8 20h8M10 16v4M14 16v4M7 8h10M7 11h6" />
      </svg>
    );
  }

  if (name === "clock") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (name === "eye" || name === "eyeOff") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 12s3.2-6 9-6 9 6 9 6-3.2 6-9 6-9-6-9-6Z" />
        <circle cx="12" cy="12" r="2.4" />
        {name === "eyeOff" ? <path d="M4 4l16 16" /> : null}
      </svg>
    );
  }

  if (name === "chip") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="7" y="7" width="10" height="10" rx="1.5" />
        <rect x="10" y="10" width="4" height="4" rx="0.5" />
        <path d="M4 9h3M4 12h3M4 15h3M17 9h3M17 12h3M17 15h3M9 4v3M12 4v3M15 4v3M9 17v3M12 17v3M15 17v3" />
      </svg>
    );
  }

  if (name === "gamepad") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 9h10c2.1 0 3.5 1.5 4 4.2l.45 2.4c.22 1.25-.86 2.3-2.05 1.88l-2.1-.74a4.2 4.2 0 0 0-1.4-.24H8.1c-.48 0-.95.08-1.4.24l-2.1.74c-1.2.42-2.27-.63-2.05-1.88L3 13.2C3.5 10.5 4.9 9 7 9Z" />
        <path d="M7 12v3M5.5 13.5h3M16 12.5h.01M18.5 14.5h.01" />
      </svg>
    );
  }

  if (name === "wifi") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 8.5a14 14 0 0 1 18 0M6.5 12a9 9 0 0 1 11 0M10 15.5a4 4 0 0 1 4 0" />
        <circle cx="12" cy="19" r="1" />
      </svg>
    );
  }

  if (name === "track") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17c3.4-7.2 5.8-9.5 8-9.5s4.6 2.3 8 9.5" />
        <path d="M5 18.5h14" />
        <path d="M8 14.5c1.25-1.9 2.55-2.8 4-2.8s2.75.9 4 2.8" />
        <path d="M12 3.5v4M8.5 5.5 12 7.5l3.5-2" />
      </svg>
    );
  }

  if (name === "signal") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 18h2v2H4zM9 14h2v6H9zM14 10h2v10h-2zM19 6h2v14h-2z" />
        <path d="M4 11l5-4 4 3 7-6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 4.5 7.25v9.5L12 21l7.5-4.25v-9.5L12 3Z" />
      <path d="m4.5 7.25 7.5 4.25 7.5-4.25M12 11.5V21" />
    </svg>
  );
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
