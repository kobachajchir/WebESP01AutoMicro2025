import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Modal from "../components/modal";
import PageHeader from "../components/PageHeader";
import SystemResetActions from "../components/SystemResetActions";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  WIFI_AP_CREDENTIALS_SET_COMMAND,
  WIFI_CREDENTIALS_RESULT_EVENT,
  WIFI_CREDENTIALS_SUBMIT_COMMAND,
  WIFI_NETWORK_DETAIL_COMMAND,
  WIFI_NETWORK_DETAIL_EVENT,
  WIFI_SCAN_RESULTS_EVENT,
  WIFI_SCAN_START_COMMAND,
  type WifiCredentialsResultStatus,
  type WifiNetworkDetail,
  type WifiSectionView,
} from "../types/WifiTypes";

type FeedbackTone = "info" | "success" | "error";

interface InlineFeedback {
  tone: FeedbackTone;
  text: string;
}

const STATION_SUBMIT_COMMANDS = new Set([
  WIFI_CREDENTIALS_SUBMIT_COMMAND,
  "esp.wifi.credentials.submit",
]);

const INITIAL_STATION_FEEDBACK: InlineFeedback = {
  tone: "info",
  text: "Elegi una red, cargá la clave y enviá las credenciales al ESP.",
};

const INITIAL_AP_FEEDBACK: InlineFeedback = {
  tone: "info",
  text: "Estas credenciales quedan para el arranque del ESP en modo AP.",
};

export default function WifiSection() {
  const { connected, send, subscribe } = useWebSocket();
  const [activeView, setActiveView] = useState<WifiSectionView>("WIFI");
  const [stationSsid, setStationSsid] = useState("");
  const [stationPassword, setStationPassword] = useState("");
  const [apSsid, setApSsid] = useState("AutoMicro");
  const [apPassword, setApPassword] = useState("");
  const [availableNetworks, setAvailableNetworks] = useState<WifiNetworkDetail[]>(
    [],
  );
  const [reportedNetworkCount, setReportedNetworkCount] = useState<number | null>(
    null,
  );
  const [selectedNetwork, setSelectedNetwork] = useState<WifiNetworkDetail | null>(
    null,
  );
  const [scanLoading, setScanLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stationPhase, setStationPhase] = useState<"idle" | "submitting" | "connecting">(
    "idle",
  );
  const [apSaving, setApSaving] = useState(false);
  const [stationFeedback, setStationFeedback] = useState<InlineFeedback>(
    INITIAL_STATION_FEEDBACK,
  );
  const [apFeedback, setApFeedback] = useState<InlineFeedback>(
    INITIAL_AP_FEEDBACK,
  );
  const [openInfoModal, setOpenInfoModal] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);

  const pendingStationSsidRef = useRef<string | null>(null);
  const pendingDetailNetworkRef = useRef<{
    key: string;
    ssid: string;
    bssid?: string;
  } | null>(null);
  const stationSsidInputRef = useRef<HTMLInputElement | null>(null);
  const scanRequestInFlightRef = useRef(false);
  const autoScanRequestedRef = useRef(false);

  const requestScan = useCallback(() => {
    if (!connected) {
      setStationFeedback({
        tone: "error",
        text: "No hay WebSocket activo para pedir el escaneo WiFi.",
      });
      return;
    }

    if (scanRequestInFlightRef.current) {
      console.log("[WiFi scan] pedido ignorado: ya hay un escaneo pendiente.");
      return;
    }

    scanRequestInFlightRef.current = true;
    setScanLoading(true);
    setStationFeedback({
      tone: "info",
      text: "Solicitando al ESP el listado de redes detectadas...",
    });

    const scanRequest = {
      requestId: createRequestId("wifi-scan"),
      target: "esp",
      command: WIFI_SCAN_START_COMMAND,
      params: {},
    };

    console.log("[WiFi scan] pidiendo redes:", scanRequest);
    send("device.command", scanRequest);
  }, [connected, send]);

  const requestNetworkDetail = useCallback(
    (network: WifiNetworkDetail) => {
      if (!connected) {
        return;
      }

      pendingDetailNetworkRef.current = {
        key: getWifiNetworkKey(network),
        ssid: network.ssid,
        bssid: network.bssid,
      };
      setDetailLoading(true);

      send("device.command", {
        requestId: createRequestId("wifi-detail"),
        target: "esp",
        command: WIFI_NETWORK_DETAIL_COMMAND,
        params: {
          ssid: network.ssid,
          ...(network.bssid ? { bssid: network.bssid } : {}),
        },
      });
    },
    [connected, send],
  );

  const handleNetworkPick = useCallback(
    (network: WifiNetworkDetail) => {
      const label = getWifiNetworkLabel(network);
      setSelectedNetwork(network);
      setStationSsid(network.ssid);
      setStationPassword((current) =>
        network.ssid === stationSsid ? current : "",
      );
      setStationFeedback({
        tone: "info",
        text: `Red seleccionada: ${network.ssid}. Completá la clave para conectar el ESP.`,
      });
      setStationFeedback({
        tone: "info",
        text: `Red seleccionada: ${label}. Completa la clave para conectar el ESP.`,
      });
      window.requestAnimationFrame(() => {
        stationSsidInputRef.current?.focus();
      });
      requestNetworkDetail(network);
    },
    [requestNetworkDetail, stationSsid],
  );

  const submitStationCredentials = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const validationError = validateStationCredentials(
        stationSsid,
        stationPassword,
      );

      if (validationError) {
        setStationFeedback({
          tone: "error",
          text: validationError,
        });
        return;
      }

      if (!connected) {
        setStationFeedback({
          tone: "error",
          text: "No hay WebSocket activo para enviar credenciales al ESP.",
        });
        return;
      }

      pendingStationSsidRef.current = stationSsid;
      setStationPhase("submitting");
      setStationFeedback({
        tone: "info",
        text: `Enviando credenciales de ${stationSsid} al ESP...`,
      });

      send("device.command", {
        requestId: createRequestId("wifi-submit"),
        target: "esp",
        command: WIFI_CREDENTIALS_SUBMIT_COMMAND,
        params: {
          ssid: stationSsid,
          password: stationPassword,
          ...(selectedNetwork?.bssid && selectedNetwork.ssid === stationSsid
            ? { bssid: selectedNetwork.bssid }
            : {}),
        },
      });
    },
    [connected, selectedNetwork, send, stationPassword, stationSsid],
  );

  const submitApCredentials = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const validationError = validateApCredentials(apSsid, apPassword);

      if (validationError) {
        setApFeedback({
          tone: "error",
          text: validationError,
        });
        return;
      }

      if (!connected) {
        setApFeedback({
          tone: "error",
          text: "No hay WebSocket activo para guardar credenciales AP.",
        });
        return;
      }

      setApSaving(true);
      setApFeedback({
        tone: "info",
        text: `Guardando la configuracion AP ${apSsid} en el ESP...`,
      });

      send("device.command", {
        requestId: createRequestId("wifi-ap"),
        target: "esp",
        command: WIFI_AP_CREDENTIALS_SET_COMMAND,
        params: {
          ssid: apSsid,
          password: apPassword,
        },
      });
    },
    [apPassword, apSsid, connected, send],
  );

  useEffect(() => {
    if (!connected) {
      scanRequestInFlightRef.current = false;
      autoScanRequestedRef.current = false;
      setScanLoading(false);
      setDetailLoading(false);
      setStationPhase("idle");
      setReportedNetworkCount(null);
      return;
    }

    if (!autoScanRequestedRef.current) {
      autoScanRequestedRef.current = true;
      requestScan();
    }
  }, [connected, requestScan]);

  useEffect(() => {
    const offDeviceEvent = subscribe("device.event", (message: unknown) => {
      const eventName = getDeviceEventName(message);
      const data = getDeviceEventData(message);

      if (eventName === WIFI_SCAN_RESULTS_EVENT) {
        const scanResult = readWifiScanResult(message);
        logWifiScanArrival("device.event", message, data, scanResult);
        scanRequestInFlightRef.current = false;
        setAvailableNetworks(scanResult.networks);
        setReportedNetworkCount(scanResult.reportedCount);
        setScanLoading(false);
        setStationFeedback({
          tone: "success",
          text: formatScanResultsFeedback(scanResult),
        });
        return;
      }

      if (eventName === WIFI_NETWORK_DETAIL_EVENT) {
        const pendingDetail = pendingDetailNetworkRef.current;
        const detail = normalizeWifiNetwork(
          data.network ?? data.detail ?? data,
          pendingDetail?.ssid,
          pendingDetail?.bssid,
        );

        if (!detail) {
          return;
        }

        if (
          pendingDetail &&
          getWifiNetworkKey(detail) !== pendingDetail.key
        ) {
          return;
        }

        pendingDetailNetworkRef.current = null;
        setDetailLoading(false);
        setSelectedNetwork(detail);
        const detailKey = getWifiNetworkKey(detail);
        setAvailableNetworks((current) =>
          current.map((item) =>
            getWifiNetworkKey(item) === detailKey ? detail : item,
          ),
        );
        return;
      }

      if (eventName === WIFI_CREDENTIALS_RESULT_EVENT) {
        const status = readWifiCredentialsStatus(data.status);
        const ssid = readString(data.ssid);
        const ip = readString(data.ip);
        const reason = readString(data.reason);

        if (!status) {
          return;
        }

        if (
          pendingStationSsidRef.current &&
          ssid &&
          ssid !== pendingStationSsidRef.current
        ) {
          return;
        }

        pendingStationSsidRef.current = null;
        setStationPhase("idle");
        setStationFeedback({
          tone: status === "success" ? "success" : "error",
          text: stationResultMessage(status, ssid ?? stationSsid, ip, reason),
        });
      }
    });

    const offDeviceResponse = subscribe("device.response", (message: unknown) => {
      const command = getResponseCommand(message);
      const ok = getResponseOk(message);
      const data = getResponseData(message);

      if (command === WIFI_SCAN_START_COMMAND) {
        console.log("[WiFi scan] respuesta recibida:", {
          ok,
          message,
          data,
        });

        if (!ok) {
          scanRequestInFlightRef.current = false;
          setScanLoading(false);
          setStationFeedback({
            tone: "error",
            text: `El ESP rechazo el pedido de escaneo: ${getResponseErrorCode(message)}.`,
          });
          return;
        }

        const scanResult = readWifiScanResult(message);
        logWifiScanArrival("device.response", message, data, scanResult);
        if (scanResult.hasExplicitList) {
          scanRequestInFlightRef.current = false;
          setAvailableNetworks(scanResult.networks);
          setReportedNetworkCount(scanResult.reportedCount);
          setScanLoading(false);
          setStationFeedback({
            tone: "success",
            text: formatScanResultsFeedback(scanResult),
          });
        }
        return;
      }

      if (command === WIFI_NETWORK_DETAIL_COMMAND) {
        setDetailLoading(false);

        if (!ok) {
          setStationFeedback({
            tone: "error",
            text: `No se pudo consultar el detalle de la red: ${getResponseErrorCode(message)}.`,
          });
          return;
        }

        const pendingDetail = pendingDetailNetworkRef.current;
        const detail = normalizeWifiNetwork(
          data.network ?? data.detail ?? data,
          pendingDetail?.ssid,
          pendingDetail?.bssid,
        );

        if (detail) {
          pendingDetailNetworkRef.current = null;
          setSelectedNetwork(detail);
          const detailKey = getWifiNetworkKey(detail);
          setAvailableNetworks((current) =>
            current.map((item) =>
              getWifiNetworkKey(item) === detailKey ? detail : item,
            ),
          );
        }
        return;
      }

      if (STATION_SUBMIT_COMMANDS.has(command ?? "")) {
        if (!ok) {
          pendingStationSsidRef.current = null;
          setStationPhase("idle");
          setStationFeedback({
            tone: "error",
            text: `El ESP rechazo las credenciales: ${getResponseErrorCode(message)}.`,
          });
          return;
        }

        const timeoutMs = readNumber(data.timeoutMs) ?? 15000;
        setStationPhase("connecting");
        setStationFeedback({
          tone: "info",
          text: `Credenciales aceptadas. Esperando conexion durante ${Math.round(
            timeoutMs / 1000,
          )}s...`,
        });
        return;
      }

      if (command === WIFI_AP_CREDENTIALS_SET_COMMAND) {
        setApSaving(false);

        if (!ok) {
          setApFeedback({
            tone: "error",
            text: `El ESP no pudo guardar la configuracion AP: ${getResponseErrorCode(message)}.`,
          });
          return;
        }

        setApFeedback({
          tone: "success",
          text:
            getResponseMessage(message) ??
            `Credenciales AP guardadas para ${apSsid}.`,
        });
      }
    });

    return () => {
      offDeviceEvent();
      offDeviceResponse();
    };
  }, [apSsid, stationSsid, subscribe]);

  const stationBusy =
    scanLoading || detailLoading || stationPhase === "submitting" || stationPhase === "connecting";

  const toggleButtonClass = useMemo(
    () =>
      "min-w-[120px] rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
    [],
  );

  return (
    <section className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          setOpenSettingsModal={setOpenSettingsModal}
          setOpenInfoModal={setOpenInfoModal}
        />

        {!connected ? (
          <FeedbackBanner
            feedback={{
              tone: "error",
              text: "La seccion WiFi esta cargada, pero no hay WebSocket activo con el ESP.",
            }}
          />
        ) : null}

        <div className="relative pt-7">
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-cyan-300/20 bg-slate-950/85 p-1 shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl">
              <button
                type="button"
                className={toggleButtonClass}
                style={segmentedButtonStyle(activeView === "WIFI")}
                onClick={() => setActiveView("WIFI")}
              >
                WIFI
              </button>
              <button
                type="button"
                className={toggleButtonClass}
                style={segmentedButtonStyle(activeView === "AP")}
                onClick={() => setActiveView("AP")}
              >
                AP
              </button>
            </div>
          </div>

          <div className="app-panel-strong relative overflow-hidden px-5 pb-6 pt-14 md:px-7">
            <div className="mb-6 flex flex-col gap-2">
              <h2 className="text-2xl font-black text-white md:text-3xl">
                {activeView === "WIFI"
                  ? "Conexion del ESP a una red"
                  : "Credenciales de arranque AP"}
              </h2>
              <p className="text-sm text-slate-300">
                {activeView === "WIFI"
                  ? "La seccion Web puede enviar credenciales reales al ESP sin pasar la clave por STM32. Si STM solicita una conexion, el modal global aparece sobre cualquier pantalla."
                  : "Estas credenciales se usan cuando el ESP levanta su propio Access Point. Combinan con el reinicio en modo AP desde Configuracion."}
              </p>
            </div>

            {activeView === "WIFI" ? (
              <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <form className="flex flex-col gap-5" onSubmit={submitStationCredentials}>
                  <div className="grid gap-4">
                    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-200">
                      SSID
                      <input
                        ref={stationSsidInputRef}
                        className="app-input px-3 py-2 text-sm"
                        value={stationSsid}
                        maxLength={32}
                        placeholder="Selecciona o escribi una red"
                        onChange={(event) => setStationSsid(event.target.value)}
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-200">
                      Password
                      <input
                        className="app-input px-3 py-2 text-sm"
                        type="password"
                        value={stationPassword}
                        maxLength={63}
                        autoComplete="new-password"
                        placeholder="8 a 63 caracteres"
                        onChange={(event) =>
                          setStationPassword(event.target.value)
                        }
                      />
                    </label>
                  </div>

                  {selectedNetwork ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <MetricChip
                        label="Senal"
                        value={
                          selectedNetwork.signalStrength !== null
                            ? `${selectedNetwork.signalStrength} dBm`
                            : "-"
                        }
                      />
                      <MetricChip
                        label="Encriptacion"
                        value={formatEncryption(selectedNetwork.encryptionType)}
                      />
                      <MetricChip
                        label="Canal"
                        value={
                          selectedNetwork.channel !== null
                            ? String(selectedNetwork.channel)
                            : detailLoading
                              ? "..."
                              : "-"
                        }
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      className="app-button px-4 py-2 text-sm font-semibold"
                      disabled={!connected || stationBusy}
                    >
                      {stationPhase === "submitting"
                        ? "Enviando..."
                        : stationPhase === "connecting"
                          ? "Conectando..."
                          : "Conectar ESP a esta red"}
                    </button>

                    <button
                      type="button"
                      className="app-button--ghost px-4 py-2 text-sm font-semibold"
                      onClick={requestScan}
                      disabled={!connected || scanLoading}
                    >
                      {scanLoading ? "Buscando..." : "Actualizar redes"}
                    </button>
                  </div>

                  <FeedbackBanner feedback={stationFeedback} />
                </form>

                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase text-slate-200">
                        Redes detectadas
                      </p>
                      <p className="text-sm text-slate-400">
                        {formatAvailableNetworksSummary(
                          availableNetworks.length,
                          reportedNetworkCount,
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="app-button--ghost px-3 py-2 text-sm font-semibold"
                      onClick={requestScan}
                      disabled={!connected || scanLoading}
                    >
                      Refrescar
                    </button>
                  </div>

                  <ul className="flex max-h-[420px] flex-col gap-2 overflow-auto pr-1">
                    {availableNetworks.map((network) => {
                      const key = getWifiNetworkKey(network);
                      const selected =
                        selectedNetwork !== null &&
                        getWifiNetworkKey(selectedNetwork) === key;
                      const label = getWifiNetworkLabel(network);
                      const detail = getWifiNetworkDetailText(network);

                      return (
                        <li key={key}>
                          <button
                            type="button"
                            className="w-full rounded-md border px-4 py-3 text-left transition-all duration-200"
                            style={networkRowStyle(selected)}
                            onClick={() => handleNetworkPick(network)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-white">
                                  {label}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {detail}
                                </p>
                                <p className="hidden">
                                  {network.signalStrength !== null
                                    ? `${network.signalStrength} dBm`
                                    : "senal sin dato"}{" "}
                                  · {formatEncryption(network.encryptionType)}
                                  {network.channel !== null
                                    ? ` · canal ${network.channel}`
                                    : ""}
                                </p>
                              </div>

                              <span className="text-xs font-semibold uppercase text-cyan-200">
                                {selected ? "Seleccionada" : "Usar"}
                              </span>
                            </div>
                          </button>
                        </li>
                      );
                    })}

                    {availableNetworks.length === 0 ? (
                      <li className="rounded-md border border-white/10 px-4 py-6 text-center text-sm text-slate-400">
                        {scanLoading ? (
                          <div className="flex flex-col items-center justify-center gap-3 text-cyan-100">
                            <span
                              className="h-9 w-9 animate-spin rounded-full border-2 border-cyan-300/25 border-t-cyan-200"
                              aria-hidden="true"
                            />
                            <span className="font-semibold">
                              Adquiriendo redes
                            </span>
                          </div>
                        ) : (
                          "No hay redes en memoria todavia. Usa Actualizar redes para pedir un nuevo barrido al ESP."
                        )}
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
            ) : (
              <form className="flex max-w-2xl flex-col gap-5" onSubmit={submitApCredentials}>
                <div className="grid gap-4">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-slate-200">
                    SSID AP
                    <input
                      className="app-input px-3 py-2 text-sm"
                      value={apSsid}
                      maxLength={32}
                      placeholder="Nombre del AP del ESP"
                      onChange={(event) => setApSsid(event.target.value)}
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-semibold text-slate-200">
                    Password AP
                    <input
                      className="app-input px-3 py-2 text-sm"
                      type="password"
                      value={apPassword}
                      maxLength={63}
                      autoComplete="new-password"
                      placeholder="8 a 63 caracteres"
                      onChange={(event) => setApPassword(event.target.value)}
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    className="app-button px-4 py-2 text-sm font-semibold"
                    disabled={!connected || apSaving}
                  >
                    {apSaving
                      ? "Guardando..."
                      : "Guardar credenciales AP en ESP"}
                  </button>
                </div>

                <FeedbackBanner feedback={apFeedback} />
              </form>
            )}
          </div>
        </div>
      </div>

      {openInfoModal ? (
        <Modal
          isOpen={openInfoModal}
          onClose={() => setOpenInfoModal(false)}
          closeOnOverlayClick={true}
        >
          <div className="flex flex-col gap-4">
            <div>
              <div className="app-kicker mb-3">Info</div>
              <h2 className="text-2xl font-black text-white">
                Flujo WiFi de la web
              </h2>
            </div>

            <p className="text-sm text-slate-300">
              En la vista <strong>WIFI</strong>, la web puede pedir un escaneo,
              solicitar detalle de una red y enviar credenciales reales al ESP
              para que se conecte.
            </p>

            <p className="text-sm text-slate-300">
              En la vista <strong>AP</strong>, la web guarda las credenciales
              del Access Point del ESP. Si luego reinicias el ESP en modo AP
              desde Configuracion, ese arranque usa esos datos.
            </p>

            <p className="text-sm text-slate-300">
              Si la solicitud de conexion viene desde STM32, el ESP emite
              <code>wifi.credentials.requested</code> y la app abre el modal
              global por encima de cualquier pantalla.
            </p>
          </div>
        </Modal>
      ) : null}

      {openSettingsModal ? (
        <Modal
          isOpen={openSettingsModal}
          onClose={() => setOpenSettingsModal(false)}
          closeOnOverlayClick={true}
        >
          <div className="flex flex-col gap-4">
            <div>
              <div className="app-kicker mb-3">Config</div>
              <h2 className="text-2xl font-black text-white">Configuracion</h2>
              <p className="mt-2 text-sm text-slate-300">
                Reinicios y herramientas auxiliares para ESP y STM32.
              </p>
            </div>

            <SystemResetActions />
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function FeedbackBanner({ feedback }: { feedback: InlineFeedback }) {
  const toneClass =
    feedback.tone === "success"
      ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
      : feedback.tone === "error"
        ? "border-rose-300/30 bg-rose-500/10 text-rose-100"
        : "border-cyan-300/25 bg-cyan-500/10 text-cyan-100";

  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${toneClass}`} role="status">
      {feedback.text}
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/35 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function segmentedButtonStyle(active: boolean) {
  return active
    ? {
        background: "var(--ui-accent)",
        color: "var(--ui-action-hover-ink)",
        boxShadow: "0 12px 28px rgba(34,211,238,0.28)",
      }
    : {
        background: "transparent",
        color: "var(--ui-text)",
      };
}

function networkRowStyle(selected: boolean) {
  return selected
    ? {
        borderColor: "var(--ui-accent)",
        background: "rgba(34,211,238,0.14)",
      }
    : {
        borderColor: "rgba(255,255,255,0.1)",
        background: "rgba(2,6,23,0.28)",
      };
}

function validateStationCredentials(ssid: string, password: string) {
  if (ssid.trim().length === 0) {
    return "El SSID no puede estar vacio.";
  }
  if (ssid.length > 32) {
    return "El SSID no puede superar 32 caracteres.";
  }
  if (password.length < 8) {
    return "La clave WiFi debe tener al menos 8 caracteres.";
  }
  if (password.length > 63) {
    return "La clave WiFi no puede superar 63 caracteres.";
  }
  return null;
}

function validateApCredentials(ssid: string, password: string) {
  if (ssid.trim().length === 0) {
    return "El SSID AP no puede estar vacio.";
  }
  if (ssid.length > 32) {
    return "El SSID AP no puede superar 32 caracteres.";
  }
  if (password.length < 8) {
    return "La clave AP debe tener al menos 8 caracteres.";
  }
  if (password.length > 63) {
    return "La clave AP no puede superar 63 caracteres.";
  }
  return null;
}

function stationResultMessage(
  status: WifiCredentialsResultStatus,
  ssid: string,
  ip?: string,
  reason?: string,
) {
  if (status === "success") {
    return ip
      ? `El ESP se conecto a ${ssid}. IP obtenida: ${ip}.`
      : `El ESP se conecto correctamente a ${ssid}.`;
  }

  if (status === "failed") {
    return reason === "auth_failed"
      ? `La autenticacion contra ${ssid} fallo. Revisá la clave.`
      : `El ESP no pudo completar la conexion a ${ssid}.`;
  }

  if (status === "timeout") {
    return `El intento de conexion a ${ssid} termino por timeout.`;
  }

  return `La solicitud de conexion a ${ssid} fue cancelada.`;
}

function formatEncryption(value: WifiNetworkDetail["encryptionType"]) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (value === 0) return "OPEN";
  if (value === 1) return "WEP";
  if (value === 2) return "WPA";
  if (value === 3) return "WPA2";
  if (value === 4) return "WPA3";
  if (value === 5) return "WPA/WPA2";

  return value === null ? "-" : String(value);
}

function readWifiCredentialsStatus(
  value: unknown,
): WifiCredentialsResultStatus | null {
  if (
    value === "success" ||
    value === "failed" ||
    value === "timeout" ||
    value === "cancelled"
  ) {
    return value;
  }

  return null;
}

function readWifiNetworks(value: unknown): WifiNetworkDetail[] {
  const bytePayload = readByteArray(value);
  if (bytePayload) {
    return readWifiNetworksFromBytes(bytePayload);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => normalizeWifiNetwork(item, undefined, undefined, index))
    .filter((item): item is WifiNetworkDetail => item !== null);
}

interface WifiScanResult {
  networks: WifiNetworkDetail[];
  reportedCount: number | null;
  hasExplicitList: boolean;
}

function readWifiScanResult(value: unknown): WifiScanResult {
  const record = toRecord(value);
  const payload = toRecord(record?.payload);
  const rawPayloadData = payload?.data;
  const rawData = record?.data;
  const payloadData = toRecord(payload?.data);
  const data = toRecord(record?.data);
  const networksValue =
    payloadData?.networks ??
    payloadData?.networkSsids ??
    payloadData?.ssids ??
    data?.networks ??
    data?.networkSsids ??
    data?.ssids ??
    record?.networks ??
    record?.networkSsids ??
    record?.ssids ??
    record?.items ??
    rawPayloadData ??
    rawData ??
    value;
  const countSource = payloadData ?? data ?? record;
  const hasExplicitList =
    Array.isArray(networksValue) ||
    Array.isArray(record?.networks) ||
    Array.isArray(record?.networkSsids) ||
    Array.isArray(record?.ssids) ||
    Array.isArray(record?.items);
  const networks = readWifiNetworks(networksValue);
  const reportedCount = readReportedNetworkCount(countSource, networks.length);

  return {
    networks,
    reportedCount,
    hasExplicitList,
  };
}

function logWifiScanArrival(
  source: "device.event" | "device.response",
  message: unknown,
  data: unknown,
  scanResult: WifiScanResult,
) {
  const label = scanResult.hasExplicitList
    ? "[WiFi scan] llegaron redes:"
    : "[WiFi scan] ACK sin lista, esperando wifi.scan.results:";

  console.log(label, {
    source,
    message,
    data,
    scanResult,
    networks: scanResult.networks,
  });
}

function readReportedNetworkCount(
  value: Record<string, unknown> | undefined,
  visibleCount: number,
) {
  const count =
    readNumber(value?.count) ??
    readNumber(value?.total) ??
    readNumber(value?.totalCount) ??
    readNumber(value?.networkCount) ??
    readNumber(value?.networksCount);

  if (count === undefined) {
    return visibleCount > 0 ? visibleCount : null;
  }

  return Math.max(count, visibleCount);
}

function formatScanResultsFeedback(scanResult: WifiScanResult) {
  const visibleCount = scanResult.networks.length;
  const reportedCount = scanResult.reportedCount;

  if (visibleCount === 0) {
    return "El escaneo termino sin redes visibles.";
  }

  if (reportedCount !== null && reportedCount > visibleCount) {
    return `El ESP detecto ${reportedCount} redes, pero esta tanda trae ${visibleCount}. La lista puede estar truncada por el cache del firmware.`;
  }

  return `Se recibieron ${visibleCount} redes desde el ESP.`;
}

function formatAvailableNetworksSummary(
  visibleCount: number,
  reportedCount: number | null,
) {
  if (visibleCount === 0) {
    return "Todavia no llegaron resultados desde el ESP.";
  }

  if (reportedCount !== null && reportedCount > visibleCount) {
    return `${visibleCount} red(es) visibles de ${reportedCount} detectadas.`;
  }

  return `${visibleCount} red(es) disponibles.`;
}

function getWifiNetworkKey(network: WifiNetworkDetail) {
  return (
    network.bssid ??
    (network.index !== undefined
      ? `scan-${network.index}-${network.ssid}-${network.channel}-${network.signalStrength}`
      : `${network.ssid}-${network.channel}-${network.signalStrength}`)
  );
}

function getWifiNetworkLabel(network: WifiNetworkDetail) {
  return network.ssid || "(red oculta)";
}

function getWifiNetworkDetailText(network: WifiNetworkDetail) {
  const bssid = network.bssid ?? "sin BSSID";
  const channel =
    network.channel !== null ? String(network.channel) : "sin dato";
  const signal =
    network.signalStrength !== null
      ? `${network.signalStrength} dBm`
      : "senal sin dato";
  const encryption = formatEncryption(network.encryptionType);

  return `${bssid} · canal ${channel} · ${signal} · ${encryption}`;
}

function normalizeWifiNetwork(
  value: unknown,
  fallbackSsid?: string | null,
  fallbackBssid?: string | null,
  fallbackIndex?: number,
): WifiNetworkDetail | null {
  if (typeof value === "string") {
    return {
      ssid: value,
      ...(fallbackBssid ? { bssid: fallbackBssid } : {}),
      signalStrength: null,
      encryptionType: null,
      channel: null,
      ...(fallbackIndex !== undefined ? { index: fallbackIndex } : {}),
    };
  }

  if (!isRecord(value)) {
    return fallbackSsid !== undefined || fallbackBssid
      ? {
          ssid: fallbackSsid ?? "",
          ...(fallbackBssid ? { bssid: fallbackBssid } : {}),
          signalStrength: null,
          encryptionType: null,
          channel: null,
          ...(fallbackIndex !== undefined ? { index: fallbackIndex } : {}),
        }
      : null;
  }

  const ssidBytes =
    readByteArray(value.ssidBytes) ??
    readByteArray(value.ssidRaw) ??
    readByteArray(value.ssid_bytes) ??
    readByteArray(value.ssid);
  const bssid =
    readString(value.bssid) ??
    readString(value.BSSID) ??
    readString(value.mac) ??
    readString(value.macAddress) ??
    fallbackBssid ??
    undefined;
  const ssid =
    decodeWifiSsid(ssidBytes) ??
    readAnyString(value.ssid) ??
    readAnyString(value.SSID) ??
    readAnyString(value.name) ??
    readAnyString(value.networkName) ??
    readAnyString(value.network_name) ??
    fallbackSsid;

  if (ssid === undefined && !bssid) {
    return null;
  }

  const rssi = readNumber(value.rssi);
  const security = readNumber(value.security);

  return {
    ssid: ssid ?? "",
    ...(ssidBytes ? { ssidBytes } : {}),
    ...(bssid ? { bssid } : {}),
    signalStrength:
      readNumber(value.signalStrength) ??
      rssi ??
      readNumber(value.rssiDbm) ??
      null,
    ...(rssi !== undefined ? { rssi } : {}),
    encryptionType:
      readString(value.encryptionType) ??
      readString(value.securityLabel) ??
      readNumber(value.encryptionType) ??
      security ??
      null,
    ...(security !== undefined ? { security } : {}),
    channel: readNumber(value.channel) ?? null,
    index: readNumber(value.index) ?? readNumber(value.scanIndex) ?? fallbackIndex,
  };
}

function getDeviceEventName(message: unknown) {
  if (!isRecord(message)) {
    return undefined;
  }

  return readString(message.event) ?? readString(toRecord(message.payload)?.event);
}

function getDeviceEventData(message: unknown): Record<string, unknown> {
  if (!isRecord(message)) {
    return {};
  }

  const payload = toRecord(message.payload);
  return toRecord(payload?.data) ?? toRecord(message.data) ?? message;
}

function getResponseCommand(message: unknown) {
  if (!isRecord(message)) {
    return undefined;
  }

  const payload = toRecord(message.payload);
  return (
    readString(message.command) ??
    readString(message.payloadCommand) ??
    readString(payload?.command)
  );
}

function getResponseOk(message: unknown) {
  if (!isRecord(message)) {
    return false;
  }

  const payload = toRecord(message.payload);
  const ok = message.ok ?? payload?.ok ?? message.success ?? payload?.success;
  return ok === true;
}

function getResponseData(message: unknown) {
  if (!isRecord(message)) {
    return {};
  }

  const payload = toRecord(message.payload);
  return toRecord(message.data) ?? toRecord(payload?.data) ?? {};
}

function getResponseMessage(message: unknown) {
  if (!isRecord(message)) {
    return undefined;
  }

  const payload = toRecord(message.payload);
  const data = getResponseData(message);

  return (
    readString(message.message) ??
    readString(payload?.message) ??
    readString(data.message)
  );
}

const wifiSsidDecoder = new TextDecoder();

function readByteArray(value: unknown): number[] | undefined {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "number" || !Number.isFinite(item))
  ) {
    return undefined;
  }

  return value.map((item) => Math.trunc(item) & 0xff);
}

function decodeWifiSsid(bytes: number[] | undefined): string | undefined {
  if (!bytes) {
    return undefined;
  }

  return wifiSsidDecoder.decode(Uint8Array.from(bytes)).replace(/\0/g, "");
}

function readWifiNetworksFromBytes(bytes: number[]): WifiNetworkDetail[] {
  const parse = (offset: number, count: number) => {
    const networks: WifiNetworkDetail[] = [];
    let cursor = offset;

    for (let index = 0; index < count && cursor < bytes.length; index += 1) {
      const ssidLen = bytes[cursor++] ?? 0;
      if (ssidLen < 0 || cursor + ssidLen > bytes.length) {
        return [];
      }

      const ssidBytes = bytes.slice(cursor, cursor + ssidLen);
      cursor += ssidLen;
      networks.push({
        ssid: decodeWifiSsid(ssidBytes) ?? "",
        ssidBytes,
        signalStrength: null,
        encryptionType: null,
        channel: null,
        index,
      });
    }

    return networks;
  };

  const countFirst = bytes[0] ?? 0;
  const statusThenCount = bytes[1] ?? 0;
  const candidates = [
    parse(1, countFirst),
    parse(2, statusThenCount),
  ].filter((items) => items.length > 0);

  return candidates.sort((a, b) => b.length - a.length)[0] ?? [];
}

function getResponseErrorCode(message: unknown) {
  if (!isRecord(message)) {
    return "ERR_INTERNAL";
  }

  const data = getResponseData(message);
  const payload = toRecord(message.payload);

  return (
    readString(message.error) ??
    readString(message.code) ??
    readString(message.reason) ??
    readString(payload?.error) ??
    readString(payload?.code) ??
    readString(data.error) ??
    readString(data.code) ??
    "ERR_INTERNAL"
  );
}

function createRequestId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readAnyString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }

  return undefined;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
