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
import ThemeModeToggleCard from "../components/ThemeModeToggleCard";
import HdAssetsSettingsCard from "../components/HdAssetsSettingsCard";
import { toast } from "sonner";
import { useWebSocket } from "../hooks/useWebSocket";
import {
 getEspConnectionDetail,
 getEspConnectionLabel,
 isEspApOnly,
 useEspWifiStatus,
} from "../contexts/EspWifiStatusContext";
import { ESP_COMMANDS } from "../protocol/wsApi";
import { EspApiError } from "../protocol/espClient";
import {
 WIFI_AP_CREDENTIALS_SET_COMMAND,
 WIFI_AP_CLIENTS_LIST_COMMAND,
 WIFI_AP_CLIENT_DISCONNECT_COMMAND,
 WIFI_CREDENTIALS_RESULT_EVENT,
 WIFI_CREDENTIALS_SUBMIT_COMMAND,
 WIFI_NETWORK_DETAIL_COMMAND,
 WIFI_NETWORK_DETAIL_EVENT,
 WIFI_SCAN_RESULTS_EVENT,
 WIFI_SCAN_START_COMMAND,
 WIFI_SCAN_STOP_COMMAND,
 type WifiCredentialsResultStatus,
 type WifiApClient,
 type WifiNetworkDetail,
 type WifiSectionView,
} from "../types/WifiTypes";
import {
 resolveEspOperatingMode,
 resolveOppositeModeDestination,
 type WifiModeDestination,
} from "../utils/wifiModeSwitch";

type FeedbackTone = "info" | "success" | "error";

interface InlineFeedback {
 tone: FeedbackTone;
 text: string;
}

interface PersistedWifiConfig {
 loaded: boolean;
 stationSsid: string;
 stationIp: string;
 stationGateway: string;
 stationSubnet: string;
 apSsid: string;
 apIp: string;
}

type ModeSwitchPhase = "idle" | "submitting" | "scheduled";

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

const WIFI_SCAN_RECOVERY_TIMEOUT_MS = 20_000;

interface WifiSectionProps {
 provisioning?: boolean;
}

export default function WifiSection({ provisioning = false }: WifiSectionProps) {
 const { connected, hello, lastHeartbeatAt, request, send, subscribe } = useWebSocket();
 const {
 status: espWifiStatus,
 lastCheckedAt: wifiStatusCheckedAt,
 } = useEspWifiStatus();
 const [activeView, setActiveView] = useState<WifiSectionView>(() =>
 !provisioning && isEspApOnly(espWifiStatus) ? "AP" : "WIFI",
 );
 const [stationSsid, setStationSsid] = useState("");
 const [stationPassword, setStationPassword] = useState("");
 const [stationIp, setStationIp] = useState("0.0.0.0");
 const [stationGateway, setStationGateway] = useState("0.0.0.0");
 const [stationSubnet, setStationSubnet] = useState("255.255.255.0");
 const [apSsid, setApSsid] = useState("AutoMicro");
 const [apPassword, setApPassword] = useState("");
 const [apIp, setApIp] = useState("0.0.0.0");
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
 const [apClients, setApClients] = useState<WifiApClient[]>([]);
 const [apClientsLoading, setApClientsLoading] = useState(false);
 const [disconnectingApClient, setDisconnectingApClient] = useState<string | null>(null);
 const [configurationLoading, setConfigurationLoading] = useState(false);
 const [stationFeedback, setStationFeedback] = useState<InlineFeedback>(
 INITIAL_STATION_FEEDBACK,
 );
 const [apFeedback, setApFeedback] = useState<InlineFeedback>(
 INITIAL_AP_FEEDBACK,
 );
 const [openInfoModal, setOpenInfoModal] = useState(false);
 const [openSettingsModal, setOpenSettingsModal] = useState(false);
 const [persistedWifiConfig, setPersistedWifiConfig] =
 useState<PersistedWifiConfig>({
 loaded: false,
 stationSsid: "",
 stationIp: "0.0.0.0",
 stationGateway: "0.0.0.0",
 stationSubnet: "255.255.255.0",
 apSsid: "AutoMicro",
 apIp: "0.0.0.0",
 });
 const [modeSwitchDestination, setModeSwitchDestination] =
 useState<WifiModeDestination | null>(null);
 const [modeSwitchPhase, setModeSwitchPhase] =
 useState<ModeSwitchPhase>("idle");
 const [modeSwitchError, setModeSwitchError] = useState<string | null>(null);

 const pendingStationSsidRef = useRef<string | null>(null);
 const pendingDetailNetworkRef = useRef<{
 key: string;
 ssid: string;
 bssid?: string;
 } | null>(null);
 const stationSsidInputRef = useRef<HTMLInputElement | null>(null);
 const scanRequestInFlightRef = useRef(false);
 const scanResultTimeoutRef = useRef<number | null>(null);
 const scanRequestIdRef = useRef<string | null>(null);
 const loadedStationSsidRef = useRef("");
 const initialViewResolvedRef = useRef(provisioning || espWifiStatus !== null);

 useEffect(() => () => {
 if (scanResultTimeoutRef.current !== null) {
 window.clearTimeout(scanResultTimeoutRef.current);
 scanResultTimeoutRef.current = null;
 }
 scanRequestInFlightRef.current = false;
 scanRequestIdRef.current = null;
 }, []);

 useEffect(() => {
 if (initialViewResolvedRef.current || provisioning || !espWifiStatus) return;
 initialViewResolvedRef.current = true;
 setActiveView(isEspApOnly(espWifiStatus) ? "AP" : "WIFI");
 }, [espWifiStatus, provisioning]);

 const requestScan = useCallback(() => {
    if (activeView !== "WIFI") {
      return;
    }

    if (!connected) {
      toast.error("No hay WebSocket activo para pedir el escaneo WiFi.");
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
    toast.loading("Buscando redes WiFi cercanas...", { id: "wifi-scan" });

    const scanRequest = {
      requestId: createRequestId("wifi-scan"),
      target: "esp",
      command: WIFI_SCAN_START_COMMAND,
      params: {},
    };
    scanRequestIdRef.current = scanRequest.requestId;
    if (scanResultTimeoutRef.current !== null) {
      window.clearTimeout(scanResultTimeoutRef.current);
    }
    scanResultTimeoutRef.current = window.setTimeout(() => {
      scanResultTimeoutRef.current = null;
      scanRequestInFlightRef.current = false;
      scanRequestIdRef.current = null;
      setScanLoading(false);
      setStationFeedback({
        tone: "error",
        text: "El escaneo WiFi no entrego resultados dentro de 20 segundos.",
      });
      toast.error("El escaneo WiFi no entregó resultados dentro de 20 segundos.", {
        id: "wifi-scan",
      });
    }, WIFI_SCAN_RECOVERY_TIMEOUT_MS);

    console.log("[WiFi scan] pidiendo redes:", scanRequest);
    void request<Record<string, unknown>>(
      WIFI_SCAN_START_COMMAND,
      {},
      { requestId: scanRequest.requestId, timeoutMs: 7_000 },
    ).then((data) => {
      const scanResult = readWifiScanResult(data);
      if (scanResult.hasExplicitList) {
        if (scanResultTimeoutRef.current !== null) {
          window.clearTimeout(scanResultTimeoutRef.current);
          scanResultTimeoutRef.current = null;
        }
        scanRequestInFlightRef.current = false;
        scanRequestIdRef.current = null;
        setAvailableNetworks(scanResult.networks);
        setReportedNetworkCount(scanResult.reportedCount);
        setScanLoading(false);
        const feedbackText = formatScanResultsFeedback(scanResult);
        setStationFeedback({ tone: "success", text: feedbackText });
        toast.success(feedbackText, { id: "wifi-scan" });
        return;
      }

      setStationFeedback({ tone: "info", text: "Escaneo iniciado en la ESP; esperando wifi.scan.results..." });
    }).catch((cause) => {
      const recoverableDisconnect =
        cause instanceof EspApiError &&
        (cause.code === "connection_lost" ||
          cause.code === "offline" ||
          cause.code === "timeout");
      if (recoverableDisconnect && scanRequestInFlightRef.current) {
        setScanLoading(true);
        setStationFeedback({
          tone: "info",
          text: "El enlace se interrumpio durante el barrido. Esperando hasta 20 segundos a que el ESP reconecte y entregue las redes...",
        });
        return;
      }
      if (scanResultTimeoutRef.current !== null) {
        window.clearTimeout(scanResultTimeoutRef.current);
        scanResultTimeoutRef.current = null;
      }
      scanRequestInFlightRef.current = false;
      scanRequestIdRef.current = null;
      setScanLoading(false);
      const errorMsg = cause instanceof Error ? cause.message : "El ESP rechazo el escaneo WiFi.";
      setStationFeedback({
        tone: "error",
        text: errorMsg,
      });
      toast.error(errorMsg, { id: "wifi-scan" });
    });
  }, [activeView, connected, request]);

 const refreshApClients = useCallback(async () => {
 if (!connected) {
 setApClients([]);
 return;
 }
 setApClientsLoading(true);
 try {
 const data = await request<Record<string, unknown>>(
 WIFI_AP_CLIENTS_LIST_COMMAND,
 {},
 { requestId: createRequestId("wifi-ap-clients"), timeoutMs: 4_000 },
 );
 setApClients(readApClients(data));
 } catch (cause) {
 setApFeedback({
 tone: "error",
 text: cause instanceof Error
 ? cause.message
 : "No se pudo leer la lista de clientes del AP.",
 });
 } finally {
 setApClientsLoading(false);
 }
 }, [connected, request]);

 const disconnectApClient = useCallback(async (client: WifiApClient) => {
 if (!connected || disconnectingApClient !== null) return;
 setDisconnectingApClient(client.mac);
 try {
 await request<Record<string, unknown>>(
 WIFI_AP_CLIENT_DISCONNECT_COMMAND,
 { mac: client.mac },
 { requestId: createRequestId("wifi-ap-disconnect"), timeoutMs: 4_000 },
 );
 setApFeedback({
 tone: "success",
 text: `Desconexion solicitada para ${client.name} (${client.mac}).`,
 });
 window.setTimeout(() => void refreshApClients(), 500);
 } catch (cause) {
 setApFeedback({
 tone: "error",
 text: cause instanceof Error
 ? cause.message
 : "No se pudo desconectar el cliente del AP.",
 });
 } finally {
 setDisconnectingApClient(null);
 }
 }, [connected, disconnectingApClient, refreshApClients, request]);

 useEffect(() => {
 if (!connected) {
 setApClients([]);
 setApClientsLoading(false);
 return;
 }
 if (activeView === "AP") void refreshApClients();
 }, [activeView, connected, refreshApClients]);

 useEffect(() => subscribe("device.event", (message: unknown) => {
 const eventName = getDeviceEventName(message);
 if (activeView === "AP" &&
 (eventName === "wifi.ap.clientJoined" || eventName === "wifi.ap.clientLeft")) {
 void refreshApClients();
 }
 }), [activeView, refreshApClients, subscribe]);

 const handleActiveViewChange = useCallback(
 (nextView: WifiSectionView) => {
 initialViewResolvedRef.current = true;
 setActiveView(nextView);
 if (nextView !== "AP" || !connected) {
 return;
 }

 const hadPendingScan = scanRequestInFlightRef.current || scanLoading;
 if (scanResultTimeoutRef.current !== null) {
 window.clearTimeout(scanResultTimeoutRef.current);
 scanResultTimeoutRef.current = null;
 }
 scanRequestInFlightRef.current = false;
 scanRequestIdRef.current = null;
 setScanLoading(false);

 void request<Record<string, unknown>>(
 WIFI_SCAN_STOP_COMMAND,
 {},
 { requestId: createRequestId("wifi-scan-stop"), timeoutMs: 4_000 },
 )
 .then(() => {
 if (hadPendingScan) {
 setApFeedback({
 tone: "success",
 text: "La búsqueda WiFi se detuvo al entrar en la vista AP.",
 });
 }
 })
 .catch((cause) => {
 if (hadPendingScan) {
 setApFeedback({
 tone: "error",
 text:
 cause instanceof Error
 ? cause.message
 : "No se pudo detener la búsqueda WiFi en el ESP.",
 });
 }
 });
 },
 [connected, request, scanLoading],
 );

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

 const reusePassword =
 stationPassword.length === 0 &&
 stationSsid === loadedStationSsidRef.current;
 const validationError = validateStationCredentials(
 stationSsid,
 stationPassword,
 reusePassword,
 stationIp,
 stationGateway,
 stationSubnet,
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
 ...(reusePassword ? { reusePassword: true } : {}),
 ip: stationIp,
 gateway: stationGateway,
 subnet: stationSubnet,
 ...(selectedNetwork?.bssid && selectedNetwork.ssid === stationSsid
 ? { bssid: selectedNetwork.bssid }
 : {}),
 },
 });
 },
 [
 connected,
 selectedNetwork,
 send,
 stationGateway,
 stationIp,
 stationPassword,
 stationSsid,
 stationSubnet,
 ],
 );

 const submitApCredentials = useCallback(
 async (event: FormEvent<HTMLFormElement>) => {
 event.preventDefault();

 const validationError = validateApCredentials(
 apSsid,
 apPassword,
 apIp,
 );

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
 text: `Guardando la configuracion AP ${apSsid} en la F4...`,
 });

 try {
 const data = await request<Record<string, unknown>>(
 WIFI_AP_CREDENTIALS_SET_COMMAND,
 {
 target: "stm",
 ssid: apSsid,
 password: apPassword,
 protected: apPassword.length > 0,
 ip: apIp,
 },
 { timeoutMs: 5000 }
 );
 
 const success = data.status === 0 || data.status === "success";
 
 if (success) {
 setApPassword("");
 setPersistedWifiConfig((current) => ({
 ...current,
 loaded: true,
 apSsid: apSsid,
 apIp: apIp,
 }));
 }
 setApFeedback({
 tone: success ? "success" : "error",
 text: success
 ? `Configuración AP guardada para ${apSsid}. Usa el botón de cambio de modo para reiniciar como AP.`
 : `F4 rechazo la configuración AP.`,
 });
 } catch (cause) {
 setApFeedback({
 tone: "error",
 text: cause instanceof Error ? cause.message : "Fallo al enviar configuración AP.",
 });
 } finally {
 setApSaving(false);
 }
 },
 [apIp, apPassword, apSsid, connected, request],
 );

 useEffect(() => {
 let disposed = false;

 if (!connected) {
 if (scanRequestInFlightRef.current) {
 setScanLoading(true);
 setStationFeedback({
 tone: "info",
 text: "WebSocket temporalmente desconectado. El pedido de redes sigue activo durante 20 segundos y se aplicara cuando el ESP vuelva.",
 });
 } else {
 setScanLoading(false);
 }
 setDetailLoading(false);
 setStationPhase("idle");
 setConfigurationLoading(false);
 loadedStationSsidRef.current = "";
 return;
 }

 setConfigurationLoading(true);
 if (scanRequestInFlightRef.current) {
 setScanLoading(true);
 setStationFeedback({
 tone: "info",
 text: "WebSocket restablecido. Esperando que el ESP entregue el resultado del escaneo pendiente...",
 });
 } else {
 setStationFeedback({
 tone: "info",
 text: "Solicitando al ESP la configuración de red guardada...",
 });
 }

 Promise.allSettled([
 request<Record<string, unknown>>(
 ESP_COMMANDS.GET_STATUS,
 {},
 { requestId: createRequestId("wifi-status"), timeoutMs: 5_000 },
 ),
 request<Record<string, unknown>>(
 "stm.apConfig.get",
 { target: "stm" },
 { requestId: createRequestId("wifi-ap-get"), timeoutMs: 5_000 },
 )
 ])
 .then(([statusResult, apConfigResult]) => {
 if (disposed) return;

 let savedStationSsid = "";
 let savedStationIp = "0.0.0.0";
 let savedStationGateway = "0.0.0.0";
 let savedStationSubnet = "255.255.255.0";
 
 let savedApSsid = "AutoMicro";
 let savedApIp = "0.0.0.0";

 if (statusResult.status === "fulfilled") {
 const data = statusResult.value;
 savedStationSsid = readAnyString(data.staSsid) ?? readAnyString(data.ssid) ?? "";
 savedStationIp = readAnyString(data.staConfiguredIp) ?? "0.0.0.0";
 savedStationGateway = readAnyString(data.staGateway) ?? "0.0.0.0";
 savedStationSubnet = readAnyString(data.staSubnet) ?? "255.255.255.0";
 }

 if (apConfigResult.status === "fulfilled") {
 const data = apConfigResult.value;
 savedApSsid = readAnyString(data.ssid) ?? savedApSsid;
 savedApIp = readAnyString(data.ip) ?? savedApIp;
 } else if (statusResult.status === "fulfilled") {
 // Fallback to ESP status if STM fails
 const data = statusResult.value;
 savedApSsid = readAnyString(data.apSsid) ?? "AutoMicro";
 savedApIp = readAnyString(data.apConfiguredIp) ?? "0.0.0.0";
 }

 loadedStationSsidRef.current = savedStationSsid;
 setStationSsid(savedStationSsid);
 setStationPassword("");
 setStationIp(savedStationIp);
 setStationGateway(savedStationGateway);
 setStationSubnet(savedStationSubnet);
 setApSsid(savedApSsid);
 setApPassword("");
 setApIp(savedApIp);
 setPersistedWifiConfig({
 loaded: true,
 stationSsid: savedStationSsid,
 stationIp: savedStationIp,
 stationGateway: savedStationGateway,
 stationSubnet: savedStationSubnet,
 apSsid: savedApSsid,
 apIp: savedApIp,
 });
 if (!scanRequestInFlightRef.current) {
 setStationFeedback({
 tone: "success",
 text:
 "Configuración cargada. La búsqueda de redes sólo comienza al pulsar Actualizar redes.",
 });
 }
 setApFeedback({
 tone: "info",
 text: "Configuración AP cargada. La clave guardada no se expone en la Web.",
 });
 })
 .catch((cause) => {
 if (disposed) return;
 if (!scanRequestInFlightRef.current) {
 setStationFeedback({
 tone: "error",
 text:
 cause instanceof Error
 ? cause.message
 : "No se pudo leer la configuración WiFi del ESP.",
 });
 }
 })
 .finally(() => {
 if (!disposed) setConfigurationLoading(false);
 });

 return () => {
 disposed = true;
 };
 }, [connected, request]);

 useEffect(() => {
 const offDeviceEvent = subscribe("device.event", (message: unknown) => {
 const eventName = getDeviceEventName(message);
 const data = getDeviceEventData(message);

 if (eventName === "wifi.scan.resumed" && scanRequestInFlightRef.current) {
 setScanLoading(true);
 setStationFeedback({
 tone: "info",
 text: "La conexion volvio y el ESP retomo la entrega del escaneo pendiente...",
 });
 return;
 }

 if (eventName === WIFI_SCAN_RESULTS_EVENT) {
 if (scanResultTimeoutRef.current !== null) {
 window.clearTimeout(scanResultTimeoutRef.current);
 scanResultTimeoutRef.current = null;
 }
 const scanResult = readWifiScanResult(message);
 logWifiScanArrival("device.event", message, data, scanResult);
 scanRequestInFlightRef.current = false;
 scanRequestIdRef.current = null;
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
 if (status === "success") {
 const persistedStationSsid = ssid ?? stationSsid;
 loadedStationSsidRef.current = persistedStationSsid;
 setStationPassword("");
 setPersistedWifiConfig((current) => ({
 ...current,
 loaded: true,
 stationSsid: persistedStationSsid,
 stationIp,
 stationGateway,
 stationSubnet,
 }));
 }
 setStationFeedback({
 tone: status === "success" ? "success" : "error",
 text: stationResultMessage(status, ssid ?? stationSsid, ip, reason),
 });
 return;
 }

 // El evento de credenciales AP fue reemplazado por respuesta directa de stm.apConfig.set
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
 scanRequestIdRef.current = null;
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
 scanRequestIdRef.current = null;
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
 if (!ok) {
 setApSaving(false);
 setApFeedback({
 tone: "error",
 text: `El ESP no pudo guardar la configuracion AP: ${getResponseErrorCode(message)}.`,
 });
 return;
 }

 setApFeedback({
 tone: "info",
 text:
 getResponseMessage(message) ??
 `Configuración AP aceptada para ${apSsid}; esperando confirmación de aplicación.`,
 });
 }
 });

 return () => {
 offDeviceEvent();
 offDeviceResponse();
 };
 }, [
 apIp,
 apSsid,
 stationGateway,
 stationIp,
 stationSsid,
 stationSubnet,
 subscribe,
 ]);

 const stationBusy =
 scanLoading || detailLoading || stationPhase === "submitting" || stationPhase === "connecting";

 const currentOperatingMode = resolveEspOperatingMode(espWifiStatus);
 const oppositeModeDestination = useMemo(
 () =>
 resolveOppositeModeDestination(currentOperatingMode, {
 apSsid: persistedWifiConfig.apSsid,
 apIp: persistedWifiConfig.apIp,
 stationSsid: persistedWifiConfig.stationSsid,
 stationIp: persistedWifiConfig.stationIp,
 }),
 [currentOperatingMode, persistedWifiConfig],
 );
 const targetConfigurationHasUnsavedChanges =
 oppositeModeDestination.mode === "AP"
 ? apSsid !== persistedWifiConfig.apSsid ||
 apIp !== persistedWifiConfig.apIp ||
 apPassword.length > 0
 : stationSsid !== persistedWifiConfig.stationSsid ||
 stationIp !== persistedWifiConfig.stationIp ||
 stationGateway !== persistedWifiConfig.stationGateway ||
 stationSubnet !== persistedWifiConfig.stationSubnet ||
 stationPassword.length > 0;
 const modalTargetHasUnsavedChanges = modeSwitchDestination
 ? modeSwitchDestination.mode === "AP"
 ? apSsid !== persistedWifiConfig.apSsid ||
 apIp !== persistedWifiConfig.apIp ||
 apPassword.length > 0
 : stationSsid !== persistedWifiConfig.stationSsid ||
 stationIp !== persistedWifiConfig.stationIp ||
 stationGateway !== persistedWifiConfig.stationGateway ||
 stationSubnet !== persistedWifiConfig.stationSubnet ||
 stationPassword.length > 0
 : false;

 function openModeSwitchConfirmation() {
 setModeSwitchError(null);
 setModeSwitchPhase("idle");
 setModeSwitchDestination(oppositeModeDestination);
 }

 function closeModeSwitchConfirmation() {
 if (modeSwitchPhase === "submitting") return;
 setModeSwitchDestination(null);
 setModeSwitchError(null);
 setModeSwitchPhase("idle");
 }

 async function confirmModeSwitch() {
 const destination = modeSwitchDestination;
 if (!destination || modeSwitchPhase !== "idle") return;
 if (!connected) {
 setModeSwitchError("No hay WebSocket activo para cambiar el modo del ESP.");
 return;
 }
 if (!destination.ssid) {
 setModeSwitchError(
 destination.mode === "AP"
 ? "Primero guarda un SSID para el Access Point."
 : "Primero guarda y verifica las credenciales de una red WiFi.",
 );
 return;
 }

 setModeSwitchError(null);
 setModeSwitchPhase("submitting");
 try {
 const data = await request<Record<string, unknown>>(
 ESP_COMMANDS.REBOOT_ESP,
 { mode: destination.bootMode },
 {
 requestId: createRequestId("wifi-mode-switch"),
 timeoutMs: 4_000,
 },
 );
 const targetIp = readAnyString(data.targetIp);
 const targetSsid = readAnyString(data.targetSsid);
 const targetIpSource = readAnyString(data.targetIpSource);
 setModeSwitchDestination((current) =>
 current
 ? {
 ...current,
 ssid: targetSsid ?? current.ssid,
 ip: targetIp ?? current.ip,
 ipSource:
 targetIpSource === "fixed" ||
 targetIpSource === "default" ||
 targetIpSource === "dhcp"
 ? targetIpSource
 : current.ipSource,
 url: targetIp ? `http://${targetIp}/` : current.url,
 }
 : current,
 );
 setModeSwitchPhase("scheduled");
 } catch (cause) {
 setModeSwitchPhase("idle");
 setModeSwitchError(
 cause instanceof Error
 ? cause.message
 : "El ESP no confirmó el cambio de modo.",
 );
 }
 }

 const toggleButtonClass = useMemo(
 () =>
 "min-w-[120px] rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
 [],
 );

 return (
 <section className="wifi-dashboard-shell">
 <div className="wifi-dashboard-grid-bg" aria-hidden="true" />
 <div className="wifi-dashboard-frame">
 <PageHeader
 className="app-page-header home-page-header wifi-page-header"
 titleOverride={provisioning ? "Conectar el ESP a una red" : "WiFi + AP"}
 leadingSlot={<WifiGlyph />}
 setOpenSettingsModal={setOpenSettingsModal}
 setOpenInfoModal={setOpenInfoModal}
 showSettings={!provisioning}
 showLogout={!provisioning}
 showHome={!provisioning}
 />

 <WifiHeaderStatus
 connected={connected}
 activeView={activeView}
 scanLoading={scanLoading}
 networksCount={availableNetworks.length}
 stationPhase={stationPhase}
 apSaving={apSaving}
 provisioning={provisioning}
 mode={espWifiStatus?.mode ?? "--"}
 apIp={espWifiStatus?.apIp ?? "0.0.0.0"}
 connectionLabel={
 connected ? getEspConnectionLabel(espWifiStatus) : "Sin enlace"
 }
 connectionDetail={
 connected ? getEspConnectionDetail(espWifiStatus) : undefined
 }
 aliveAt={lastHeartbeatAt ?? wifiStatusCheckedAt}
 />

 {provisioning ? (
 <div className="mb-4 rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
 <strong>Modo de aprovisionamiento AP.</strong>{" "}
 Elegí una red, ingresá su clave y conectá el ESP. La búsqueda sólo
 comienza al pulsar Actualizar redes.
 </div>
 ) : null}

 {!connected ? (
 <FeedbackBanner
 feedback={{
 tone: "error",
 text: "La seccion WiFi esta cargada, pero no hay WebSocket activo con el ESP.",
 }}
 />
 ) : null}

 <WifiModeSwitchCard
 currentMode={currentOperatingMode}
 destination={oppositeModeDestination}
 connected={connected}
 busy={
 configurationLoading ||
 apSaving ||
 stationPhase !== "idle" ||
 modeSwitchPhase !== "idle"
 }
 configurationLoaded={persistedWifiConfig.loaded}
 hasUnsavedChanges={targetConfigurationHasUnsavedChanges}
 onOpen={openModeSwitchConfirmation}
 />

 <div className={`relative ${provisioning ? "pt-0" : "pt-7"}`}>
 {!provisioning ? (
 <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
 <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-cyan-300/20 bg-[var(--ui-bg-0)]/85 p-1 shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl">
 <button
 type="button"
 className={toggleButtonClass}
 style={segmentedButtonStyle(activeView === "WIFI")}
 onClick={() => handleActiveViewChange("WIFI")}
 >
 WIFI
 </button>
 <button
 type="button"
 className={toggleButtonClass}
 style={segmentedButtonStyle(activeView === "AP")}
 onClick={() => handleActiveViewChange("AP")}
 >
 AP
 </button>
 </div>
 </div>
 ) : null}

 <div className={`wifi-panel relative overflow-hidden px-5 pb-6 md:px-7 ${provisioning ? "pt-8" : "pt-14"}`}>
 <div className="mb-6 flex flex-col gap-2">
 <h2 className="text-2xl font-black text-[var(--ui-text)] md:text-3xl">
 {provisioning
 ? "Elegí la red para salir del modo AP"
 : activeView === "WIFI"
 ? "Conexion del ESP a una red"
 : "Credenciales de arranque AP"}
 </h2>
 <p className="text-sm text-[var(--ui-muted)]">
 {provisioning
 ? "Esta vista aparece únicamente mientras el ESP mantiene su Access Point de configuración y todavía no está conectado como estación."
 : activeView === "WIFI"
 ? "La seccion Web puede enviar credenciales reales al ESP sin pasar la clave por STM32. Si STM solicita una conexion, el modal global aparece sobre cualquier pantalla."
 : "Estas credenciales se usan cuando el ESP levanta su propio Access Point. Combinan con el reinicio en modo AP desde Configuracion."}
 </p>
 </div>

 {provisioning || activeView === "WIFI" ? (
 <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
 <form className="wifi-form-card flex flex-col gap-5" onSubmit={submitStationCredentials}>
 <div className="wifi-card-heading">
 <WifiIcon />
 <div>
 <h3>Conexión STA</h3>
 <p>Seleccioná una red y enviá las credenciales al ESP.</p>
 </div>
 </div>

 <div className="grid gap-4">
 <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--ui-text)]">
 SSID
 <input
 ref={stationSsidInputRef}
 className="app-input wifi-input"
 value={stationSsid}
 maxLength={32}
 placeholder="Selecciona o escribi una red"
 onChange={(event) => setStationSsid(event.target.value)}
 />
 </label>

 <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--ui-text)]">
 Password
 <input
 className="app-input wifi-input"
 type="password"
 value={stationPassword}
 maxLength={63}
 autoComplete="new-password"
 placeholder="Vacía conserva la clave del SSID cargado"
 onChange={(event) =>
 setStationPassword(event.target.value)
 }
 />
 </label>

 <div className="grid gap-4 sm:grid-cols-2">
 <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--ui-text)]">
 IP fija STA
 <input
 className="app-input wifi-input"
 inputMode="decimal"
 value={stationIp}
 maxLength={15}
 placeholder="0.0.0.0 = DHCP"
 onChange={(event) => setStationIp(event.target.value)}
 />
 </label>

 <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--ui-text)]">
 Gateway
 <input
 className="app-input wifi-input"
 inputMode="decimal"
 value={stationGateway}
 maxLength={15}
 placeholder="192.168.1.1"
 onChange={(event) => setStationGateway(event.target.value)}
 />
 </label>
 </div>

 <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--ui-text)]">
 Máscara de red
 <input
 className="app-input wifi-input"
 inputMode="decimal"
 value={stationSubnet}
 maxLength={15}
 placeholder="255.255.255.0"
 onChange={(event) => setStationSubnet(event.target.value)}
 />
 </label>
 <p className="text-xs text-[var(--ui-muted)]">
 Usa 0.0.0.0 en IP fija para mantener DHCP. Con una IP fija,
 gateway y máscara son obligatorios.
 </p>
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
 className="app-button wifi-action-button text-sm font-semibold"
 disabled={!connected || configurationLoading || stationBusy}
 >
 {stationPhase === "submitting"
 ? "Enviando..."
 : stationPhase === "connecting"
 ? "Conectando..."
 : provisioning
 ? "Conectar y salir del modo AP"
 : "Conectar ESP a esta red"}
 </button>

 <button
 type="button"
 className="app-button--ghost wifi-action-button text-sm font-semibold"
 onClick={requestScan}
 disabled={!connected || configurationLoading || scanLoading}
 >
 {scanLoading ? "Buscando..." : "Actualizar redes"}
 </button>
 </div>

 <FeedbackBanner feedback={stationFeedback} />
 </form>

 <div className="wifi-networks-card flex flex-col gap-4">
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-sm font-semibold uppercase text-[var(--ui-text)]">
 Redes detectadas
 </p>
 <p className="text-sm text-[var(--ui-muted)]">
 {formatAvailableNetworksSummary(
 availableNetworks.length,
 reportedNetworkCount,
 )}
 </p>
 </div>

 <button
 type="button"
 className="app-button--ghost wifi-action-button text-sm font-semibold"
 onClick={requestScan}
 disabled={!connected || configurationLoading || scanLoading}
 >
 Refrescar
 </button>
 </div>

 <ul className="wifi-network-list">
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
 className={`wifi-network-card ${selected ? "wifi-network-card--selected" : ""}`}
 style={networkRowStyle(selected)}
 onClick={() => handleNetworkPick(network)}
 >
 <div className="flex items-start gap-3">
 <span className="wifi-network-card__icon">
 <WifiSignalIcon signal={network.signalStrength} />
 </span>
 <div>
 <p className="font-semibold text-[var(--ui-text)]">
 {label}
 </p>
 <p className="mt-1 text-xs text-[var(--ui-muted)]">
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

 <span className="wifi-network-card__strength">
 <span>
 {network.signalStrength !== null
 ? `${network.signalStrength} dBm`
 : "--"}
 </span>
 <i>
 <b style={{ width: `${formatSignalPercent(network.signalStrength)}%` }} />
 </i>
 </span>
 <span className="wifi-network-card__action">
 {selected ? "Seleccionada" : "Usar"}
 </span>
 </div>
 </button>
 </li>
 );
 })}

 {availableNetworks.length === 0 ? (
 <li className="rounded-md border border-[var(--ui-ring)] px-4 py-6 text-center text-sm text-[var(--ui-muted)]">
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
 <div className="wifi-ap-layout">
 <article className="wifi-ap-summary-card wifi-ap-overview-card">
 <div className="wifi-card-heading">
 <ApIcon />
 <div>
 <h3>Access Point del ESP</h3>
 <p>Credenciales usadas cuando el ESP arranca como AP.</p>
 </div>
 </div>
 <div className="grid gap-3 sm:grid-cols-2">
 <MetricChip label="Estado AP" value={connected ? "Listo" : "Sin enlace"} />
 <MetricChip label="SSID" value={apSsid || "--"} />
 <MetricChip label="IP fija" value={apIp === "0.0.0.0" ? "Predeterminada" : apIp} />
 <MetricChip label="Clientes" value={String(apClients.length)} />
 </div>
 <section className="wifi-ap-clients-section">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <p className="text-sm font-semibold uppercase text-[var(--ui-text)]">
 Clientes conectados al AP
 </p>
 <p className="text-sm text-[var(--ui-muted)]">
 El ESP informa IP y MAC. El nombre visible es estable y se genera desde la MAC porque el SDK no entrega hostname DHCP.
 </p>
 </div>
 <button
 type="button"
 className="app-button--ghost wifi-action-button text-sm font-semibold"
 onClick={() => void refreshApClients()}
 disabled={!connected || apClientsLoading}
 >
 {apClientsLoading ? "Consultando..." : "Actualizar clientes"}
 </button>
 </div>

 <ul className="wifi-network-list wifi-ap-client-list">
 {apClients.map((client) => {
 const isCurrentDevice = isSameIpv4(client.ip, hello?.clientIp);
 return (
 <li
 key={client.mac}
 className={`flex flex-col gap-3 rounded-lg border bg-[var(--ui-bg-0)]/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${isCurrentDevice ? "border-cyan-300/45" : "border-[var(--ui-ring)]"}`}
 >
 <div className="min-w-0">
 <p className="truncate font-semibold text-[var(--ui-text)]">
 {isCurrentDevice ? "Este dispositivo" : client.name}
 </p>
 <p className="mt-1 break-all font-mono text-xs text-cyan-100">{client.mac}</p>
 <p className="mt-1 text-xs text-[var(--ui-muted)]">
 IP {client.ip}{isCurrentDevice ? " · visor actual" : ""}
 </p>
 </div>
 <button
 type="button"
 className="app-button--ghost shrink-0 px-4 py-2 text-sm font-semibold text-rose-100"
 onClick={() => void disconnectApClient(client)}
 disabled={!connected || disconnectingApClient !== null || isCurrentDevice}
 >
 {isCurrentDevice
 ? "En uso"
 : disconnectingApClient === client.mac
 ? "Desconectando..."
 : "Desconectar"}
 </button>
 </li>
 );
 })}
 {apClients.length === 0 ? (
 <li className="rounded-md border border-[var(--ui-ring)] px-4 py-6 text-center text-sm text-[var(--ui-muted)]">
 {apClientsLoading
 ? "Consultando estaciones asociadas..."
 : "No hay dispositivos conectados al Access Point."}
 </li>
 ) : null}
 </ul>
 </section>
 </article>

 <form className="wifi-form-card wifi-ap-form-card flex flex-col gap-5" onSubmit={submitApCredentials}>
 <div className="wifi-card-heading">
 <WifiIcon />
 <div>
 <h3>Configurar AP</h3>
 <p>Guardá SSID y clave en el ESP para el próximo arranque AP.</p>
 </div>
 </div>

 <div className="grid gap-4">
 <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--ui-text)]">
 SSID AP
 <input
 className="app-input wifi-input"
 value={apSsid}
 maxLength={32}
 placeholder="Nombre del AP del ESP"
 onChange={(event) => setApSsid(event.target.value)}
 />
 </label>

 <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--ui-text)]">
 Password AP
 <input
 className="app-input wifi-input"
 type="password"
 value={apPassword}
 maxLength={63}
 autoComplete="new-password"
 placeholder="Si se deja vacía, se creará una red abierta"
 onChange={(event) => setApPassword(event.target.value)}
 />
 </label>

 <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--ui-text)]">
 IP fija AP
 <input
 className="app-input wifi-input"
 inputMode="decimal"
 value={apIp}
 maxLength={15}
 placeholder="0.0.0.0 = 192.168.4.1"
 onChange={(event) => setApIp(event.target.value)}
 />
 </label>
 <p className="text-xs text-[var(--ui-muted)]">
 Usa 0.0.0.0 para la dirección predeterminada 192.168.4.1/24.
 </p>
 </div>

 <div className="flex flex-col gap-3 sm:flex-row">
 <button
 type="submit"
 className="app-button wifi-action-button text-sm font-semibold"
 disabled={!connected || configurationLoading || apSaving}
 >
 {apSaving
 ? "Guardando..."
 : "Guardar configuración AP en ESP"}
 </button>
 </div>

 <FeedbackBanner feedback={apFeedback} />
 </form>
 </div>
 )}
 </div>
 </div>
 </div>

 {modeSwitchDestination ? (
 <Modal
 isOpen
 onClose={closeModeSwitchConfirmation}
 closeOnOverlayClick={modeSwitchPhase !== "submitting"}
 >
 <div className="flex flex-col gap-5">
 <div>
 <div className="app-kicker mb-3">Cambio de modo ESP</div>
 <h2 className="pr-10 text-2xl font-black text-[var(--ui-text)]">
 {modeSwitchDestination.mode === "AP" ? "RED" : "AP"} →{" "}
 {modeSwitchDestination.mode}
 </h2>
 <p className="mt-2 text-sm text-[var(--ui-muted)]">
 La selección se guardará en la ESP y se aplicará mediante un
 reinicio controlado.
 </p>
 </div>

 <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-4 text-sm text-amber-50">
 <strong>La conexión actual se va a perder.</strong> El WebSocket
 se cerrará mientras la ESP reinicia y tu equipo deberá conectarse
 a la red de destino antes de volver a abrir la Web.
 </div>

 <div className="grid gap-3 sm:grid-cols-3">
 <MetricChip label="Nuevo modo" value={modeSwitchDestination.mode} />
 <MetricChip
 label="Red de destino"
 value={modeSwitchDestination.ssid || "Sin configurar"}
 />
 <MetricChip
 label="Nueva IP"
 value={formatDestinationIp(modeSwitchDestination)}
 />
 </div>

 {modeSwitchDestination.url ? (
 <p className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
 Después de conectarte a <strong>{modeSwitchDestination.ssid}</strong>,
 abrí{" "}
 <a
 className="font-bold underline decoration-cyan-300/60 underline-offset-4"
 href={modeSwitchDestination.url}
 >
 {modeSwitchDestination.url}
 </a>
 .
 </p>
 ) : (
 <p className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
 La red <strong>{modeSwitchDestination.ssid || "STA"}</strong> usa
 DHCP. La IP final la asignará el router al reconectar; consultala
 en su lista de clientes DHCP.
 </p>
 )}

 {modalTargetHasUnsavedChanges ? (
 <FeedbackBanner
 feedback={{
 tone: "info",
 text: "Hay cambios sin guardar en el formulario de destino. El reinicio usará la última configuración persistida que se muestra en este diálogo.",
 }}
 />
 ) : null}

 {!modeSwitchDestination.ssid ? (
 <FeedbackBanner
 feedback={{
 tone: "error",
 text:
 modeSwitchDestination.mode === "AP"
 ? "No hay un SSID AP guardado. Guarda la configuración AP antes de cambiar de modo."
 : "No hay una red STA guardada. Conecta y verifica una red antes de salir del modo AP.",
 }}
 />
 ) : null}

 {modeSwitchError ? (
 <FeedbackBanner feedback={{ tone: "error", text: modeSwitchError }} />
 ) : null}

 {modeSwitchPhase === "scheduled" ? (
 <FeedbackBanner
 feedback={{
 tone: "success",
 text: `Cambio confirmado. La ESP está reiniciando en modo ${modeSwitchDestination.mode}; el corte del enlace es esperado.`,
 }}
 />
 ) : null}

 <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
 <button
 type="button"
 className="app-button--ghost px-4 py-2 text-sm font-semibold"
 onClick={closeModeSwitchConfirmation}
 disabled={modeSwitchPhase === "submitting"}
 >
 {modeSwitchPhase === "scheduled" ? "Cerrar" : "Cancelar"}
 </button>
 <button
 type="button"
 className="app-button px-4 py-2 text-sm font-semibold"
 onClick={() => void confirmModeSwitch()}
 disabled={
 !connected ||
 !modeSwitchDestination.ssid ||
 modeSwitchPhase !== "idle"
 }
 >
 {modeSwitchPhase === "submitting"
 ? "Confirmando reinicio..."
 : modeSwitchPhase === "scheduled"
 ? "Reinicio confirmado"
 : `Reiniciar en modo ${modeSwitchDestination.mode}`}
 </button>
 </div>
 </div>
 </Modal>
 ) : null}

 {openInfoModal ? (
 <Modal
 isOpen={openInfoModal}
 onClose={() => setOpenInfoModal(false)}
 closeOnOverlayClick={true}
 >
 <div className="flex flex-col gap-4">
 <div>
 <div className="app-kicker mb-3">Info</div>
 <h2 className="text-2xl font-black text-[var(--ui-text)]">
 Flujo WiFi de la web
 </h2>
 </div>

 <p className="text-sm text-[var(--ui-muted)]">
 En la vista <strong>WIFI</strong>, la web puede pedir un escaneo,
 solicitar detalle de una red y enviar credenciales reales al ESP
 para que se conecte.
 </p>

 <p className="text-sm text-[var(--ui-muted)]">
 En la vista <strong>AP</strong>, la web guarda las credenciales
 del Access Point del ESP. El botón de cambio de modo muestra la
 red/IP persistida, pide confirmación y reinicia la placa en AP.
 </p>

 <p className="text-sm text-[var(--ui-muted)]">
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
 containerClassnames="home-settings-dialog flex-col"
 >
 <div className="flex flex-col gap-4">
 <ThemeModeToggleCard />
 <HdAssetsSettingsCard />
 <div>
 <div className="app-kicker mb-3">Config</div>
 <h2 className="text-2xl font-black text-[var(--ui-text)]">Configuracion</h2>
 <p className="mt-2 text-sm text-[var(--ui-muted)]">
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

function WifiModeSwitchCard({
 currentMode,
 destination,
 connected,
 busy,
 configurationLoaded,
 hasUnsavedChanges,
 onOpen,
}: {
 currentMode: "AP" | "RED";
 destination: WifiModeDestination;
 connected: boolean;
 busy: boolean;
 configurationLoaded: boolean;
 hasUnsavedChanges: boolean;
 onOpen: () => void;
}) {
 return (
 <section className="mb-5 mt-4 rounded-xl border border-cyan-300/20 bg-[var(--ui-bg-0)]/45 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
 <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
 <div className="flex min-w-0 items-start gap-3">
 <span className="home-brand-glyph wifi-brand-glyph shrink-0" aria-hidden="true">
 {destination.mode === "AP" ? <ApIcon /> : <WifiIcon />}
 </span>
 <div>
 <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
 Modo físico actual: {currentMode}
 </p>
 <h2 className="mt-1 text-lg font-black text-[var(--ui-text)]">
 Cambiar ESP a modo {destination.mode}
 </h2>
 <p className="mt-1 text-sm text-[var(--ui-muted)]">
 Usará la red guardada <strong>{destination.ssid || "sin configurar"}</strong>
 {" · "}{formatDestinationIp(destination)}.
 </p>
 {hasUnsavedChanges ? (
 <p className="mt-2 text-xs font-semibold text-amber-200">
 Hay datos editados sin guardar; no se aplicarán al reinicio.
 </p>
 ) : null}
 </div>
 </div>

 <button
 type="button"
 className="app-button shrink-0 px-5 py-2.5 text-sm font-semibold"
 onClick={onOpen}
 disabled={!connected || !configurationLoaded || busy}
 >
 {!configurationLoaded
 ? "Leyendo configuración..."
 : busy
 ? "Operación en curso..."
 : `Cambiar de ${currentMode} a ${destination.mode}`}
 </button>
 </div>
 </section>
 );
}

function formatDestinationIp(destination: WifiModeDestination) {
 if (destination.ipSource === "dhcp") return "IP asignada por DHCP";
 if (destination.ipSource === "default") {
 return `${destination.ip ?? "192.168.4.1"} (predeterminada)`;
 }
 return destination.ip ?? "IP fija sin dato";
}

function FeedbackBanner({ feedback }: { feedback: InlineFeedback }) {
 const toneClass =
 feedback.tone === "success"
 ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
 : feedback.tone === "error"
 ? "border-rose-300/30 bg-rose-500/10 text-rose-100"
 : "border-cyan-300/25 bg-cyan-500/10 text-cyan-100";

 return (
 <div className={`wifi-feedback rounded-md border px-3 py-2 text-sm ${toneClass}`} role="status">
 {feedback.text}
 </div>
 );
}

function WifiGlyph() {
 return (
 <span className="home-brand-glyph wifi-brand-glyph" aria-hidden="true">
 <WifiIcon />
 </span>
 );
}

function WifiHeaderStatus({
 connected,
 activeView,
 scanLoading,
 networksCount,
 stationPhase,
 apSaving,
 provisioning,
 mode,
 apIp,
 connectionLabel,
 connectionDetail,
 aliveAt,
}: {
 connected: boolean;
 activeView: WifiSectionView;
 scanLoading: boolean;
 networksCount: number;
 stationPhase: "idle" | "submitting" | "connecting";
 apSaving: boolean;
 provisioning: boolean;
 mode: string;
 apIp: string;
 connectionLabel: string;
 connectionDetail?: string;
 aliveAt: number | null;
}) {
 const operation =
 activeView === "AP"
 ? apSaving
 ? "Guardando AP"
 : "AP listo"
 : stationPhase === "submitting"
 ? "Enviando STA"
 : stationPhase === "connecting"
 ? "Conectando STA"
 : scanLoading
 ? "Escaneando"
 : "STA lista";

 return (
 <section className="section-status-strip wifi-status-strip" aria-label="Estado WiFi">
 {provisioning ? (
 <>
 <WifiStatusPill
 label="Alive"
 value={connected ? formatAliveLabel(aliveAt) : "Sin respuesta"}
 tone={connected ? "ok" : "error"}
 />
 <WifiStatusPill label="Modo ESP" value={mode} tone="info" />
 <WifiStatusPill label="IP AP" value={apIp} tone="info" />
 <WifiStatusPill
 label="Acción"
 value={operation}
 tone={scanLoading || stationPhase !== "idle" ? "info" : "muted"}
 />
 <WifiStatusPill
 label="Redes"
 value={String(networksCount)}
 tone={networksCount > 0 ? "ok" : "muted"}
 />
 </>
 ) : (
 <>
 <WifiStatusPill
 label="Conexión"
 value={connectionLabel}
 detail={connectionDetail}
 tone={connected ? "ok" : "error"}
 />
 <WifiStatusPill label="Vista" value={activeView} tone="info" />
 <WifiStatusPill
 label="Operación"
 value={operation}
 tone={scanLoading || apSaving || stationPhase !== "idle" ? "info" : "muted"}
 />
 <WifiStatusPill
 label="Redes"
 value={String(networksCount)}
 tone={networksCount > 0 ? "ok" : "muted"}
 />
 <WifiStatusPill label="FW" value="ESP/UNER" tone="info" />
 </>
 )}
 </section>
 );
}

function formatAliveLabel(timestamp: number | null) {
 if (timestamp === null) return "Esperando";
 const ageSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
 return ageSeconds < 2 ? "Ahora" : `Hace ${ageSeconds}s`;
}

function WifiStatusPill({
 label,
 value,
 detail,
 tone,
}: {
 label: string;
 value: string;
 detail?: string;
 tone: "ok" | "error" | "info" | "muted";
}) {
 return (
 <div className={`section-status-row section-status-row--${tone}`}>
 <span className={`home-status-dot home-status-dot--${tone}`} />
 <span className="section-status-row__label">{label}</span>
 <span className="section-status-row__valueWrap">
 <strong className="section-status-row__value">{value}</strong>
 {detail ? <small className="section-status-row__detail">{detail}</small> : null}
 </span>
 </div>
 );
}

function WifiIcon() {
 return (
 <svg viewBox="0 0 24 24" aria-hidden="true">
 <path d="M3 8.5a14 14 0 0 1 18 0" />
 <path d="M6.5 12a9 9 0 0 1 11 0" />
 <path d="M10 15.5a4 4 0 0 1 4 0" />
 <circle cx="12" cy="19" r="1" />
 </svg>
 );
}

function ApIcon() {
 return (
 <svg viewBox="0 0 24 24" aria-hidden="true">
 <rect x="5" y="9" width="14" height="9" rx="2" />
 <path d="M8 9V7a4 4 0 0 1 8 0v2" />
 <path d="M9 14h.01M12 14h.01M15 14h.01" />
 </svg>
 );
}

function WifiSignalIcon({ signal }: { signal: number | null }) {
 const percent = formatSignalPercent(signal);
 return (
 <span className="wifi-signal-icon" aria-hidden="true">
 <WifiIcon />
 <i style={{ height: `${Math.max(18, percent)}%` }} />
 </span>
 );
}

function MetricChip({ label, value }: { label: string; value: string }) {
 return (
 <div className="rounded-md border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/35 px-3 py-2">
 <p className="text-[11px] font-semibold uppercase text-[var(--ui-muted)]">
 {label}
 </p>
 <p className="mt-1 text-sm font-semibold text-[var(--ui-text)]">{value}</p>
 </div>
 );
}

function formatSignalPercent(signal: number | null) {
 if (signal === null || !Number.isFinite(signal)) {
 return 12;
 }

 return Math.max(8, Math.min(100, Math.round(((signal + 95) / 60) * 100)));
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

function validateStationCredentials(
 ssid: string,
 password: string,
 reusePassword: boolean,
 ip: string,
 gateway: string,
 subnet: string,
) {
 if (ssid.trim().length === 0) {
 return "El SSID no puede estar vacio.";
 }
 if (ssid.length > 32) {
 return "El SSID no puede superar 32 caracteres.";
 }
 if (!reusePassword && password.length < 8) {
 return "La clave WiFi debe tener al menos 8 caracteres.";
 }
 if (password.length > 63) {
 return "La clave WiFi no puede superar 63 caracteres.";
 }
 if (!isValidIpv4(ip) || !isValidIpv4(gateway) || !isValidIpv4(subnet)) {
 return "IP, gateway y máscara deben usar un formato IPv4 válido.";
 }
 if (ip !== "0.0.0.0" && (gateway === "0.0.0.0" || subnet === "0.0.0.0")) {
 return "Una IP fija STA requiere gateway y máscara distintos de 0.0.0.0.";
 }
 return null;
}

function validateApCredentials(
 ssid: string,
 password: string,
 ip: string,
) {
 if (ssid.trim().length === 0) {
 return "El SSID AP no puede estar vacio.";
 }
 if (ssid.length > 32) {
 return "El SSID AP no puede superar 32 caracteres.";
 }
 if (password.length > 0 && password.length < 8) {
 return "La clave AP debe tener al menos 8 caracteres.";
 }
 if (password.length > 63) {
 return "La clave AP no puede superar 63 caracteres.";
 }
 if (!isValidIpv4(ip)) {
 return "La IP fija AP debe usar un formato IPv4 válido.";
 }
 return null;
}

function isValidIpv4(value: string) {
 const parts = value.split(".");
 return (
 parts.length === 4 &&
 parts.every(
 (part) =>
 /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255,
 )
 );
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

function readApClients(value: unknown): WifiApClient[] {
 const record = toRecord(value);
 const clients = Array.isArray(record?.clients) ? record.clients : [];
 return clients.flatMap((entry) => {
 const client = toRecord(entry);
 const mac = readString(client?.mac)?.toUpperCase();
 if (!mac || !/^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$/.test(mac)) return [];
 return [{
 name: readString(client?.name) ?? `Dispositivo ${mac.slice(-5).replace(":", "")}`,
 nameSource: readString(client?.nameSource) ?? "generated-from-mac",
 mac,
 ip: readString(client?.ip) ?? "0.0.0.0",
 }];
 });
}

function isSameIpv4(left: string | undefined, right: string | undefined): boolean {
 if (!left || !right) return false;
 const normalize = (value: string) => value.trim().replace(/^::ffff:/i, "");
 const normalizedLeft = normalize(left);
 const normalizedRight = normalize(right);
 return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalizedLeft) &&
 normalizedLeft === normalizedRight;
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
