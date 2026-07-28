/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { ESP_COMMANDS } from "../protocol/wsApi";

export interface EspWifiStatus {
  mode: string;
  apActive: boolean;
  staConnected: boolean;
  apIp: string;
  staIp: string;
  networkSsid: string;
  rssiDbm: number | null;
  raw: Record<string, unknown>;
}

interface EspWifiStatusContextValue {
  status: EspWifiStatus | null;
  statusKnown: boolean;
  loading: boolean;
  error: string | null;
  lastCheckedAt: number | null;
  isApProvisioning: boolean;
  refresh: () => Promise<EspWifiStatus | null>;
}

const EspWifiStatusContext = createContext<EspWifiStatusContextValue | null>(null);
const WIFI_STATUS_POLL_MS = 5_000;
const WIFI_STATUS_REFRESH_EVENTS = new Set([
  "wifi.mode.changed",
  "wifi.sta.connected",
  "wifi.sta.statusChanged",
  "wifi.ap.clientJoined",
  "wifi.ap.clientLeft",
  "wifi.credentials.result",
  "wifi.ap.credentials.result",
]);

export function EspWifiStatusProvider({ children }: { children: ReactNode }) {
  const { connected, request, subscribe } = useWebSocket();
  const [status, setStatus] = useState<EspWifiStatus | null>(null);
  const [statusKnown, setStatusKnown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const inFlightRef = useRef<Promise<EspWifiStatus | null> | null>(null);

  const refresh = useCallback(() => {
    if (!connected) return Promise.resolve(null);
    if (inFlightRef.current) return inFlightRef.current;

    setLoading(true);
    const pending = request<Record<string, unknown>>(
      ESP_COMMANDS.GET_STATUS,
      {},
      { timeoutMs: 4_000 },
    )
      .then((data) => {
        const next = normalizeWifiStatus(data);
        setStatus(next);
        setStatusKnown(true);
        setError(null);
        setLastCheckedAt(Date.now());
        return next;
      })
      .catch((cause) => {
        setStatusKnown(true);
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo consultar el estado WiFi del ESP.",
        );
        return null;
      })
      .finally(() => {
        setLoading(false);
        inFlightRef.current = null;
      });

    inFlightRef.current = pending;
    return pending;
  }, [connected, request]);

  useEffect(() => {
    if (!connected) {
      setStatus(null);
      setStatusKnown(false);
      setLoading(false);
      setError(null);
      setLastCheckedAt(null);
      inFlightRef.current = null;
      return;
    }
    void refresh();
  }, [connected, refresh]);

  useEffect(() =>
    subscribe("device.event", (message: unknown) => {
      const event = readEventName(message);
      if (event && WIFI_STATUS_REFRESH_EVENTS.has(event)) {
        void refresh();
      }
    }),
  [refresh, subscribe]);

  const isApProvisioning =
    connected &&
    status !== null &&
    status.apActive &&
    !status.staConnected;

  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(() => void refresh(), WIFI_STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [connected, refresh]);

  const value = useMemo<EspWifiStatusContextValue>(() => ({
    status,
    statusKnown,
    loading,
    error,
    lastCheckedAt,
    isApProvisioning,
    refresh,
  }), [error, isApProvisioning, lastCheckedAt, loading, refresh, status, statusKnown]);

  return (
    <EspWifiStatusContext.Provider value={value}>
      {children}
    </EspWifiStatusContext.Provider>
  );
}

export function useEspWifiStatus() {
  const context = useContext(EspWifiStatusContext);
  if (!context) {
    throw new Error("useEspWifiStatus debe usarse dentro de EspWifiStatusProvider");
  }
  return context;
}

export function isEspApOnly(status: EspWifiStatus | null) {
  return status !== null && status.apActive && !status.staConnected;
}

export function getEspConnectionLabel(status: EspWifiStatus | null) {
  if (isEspApOnly(status)) return "AP OK";
  if (status?.apActive && status.staConnected) return "WiFi + AP OK";
  return "WiFi OK";
}

export function getEspConnectionDetail(status: EspWifiStatus | null) {
  if (isEspApOnly(status)) return "ESP emitiendo su propia red WiFi";
  if (status?.apActive && status.staConnected) return "STA conectada y AP activo";
  return "ESP conectado como estación";
}

export function getEspNetworkLabel(status: EspWifiStatus | null) {
  if (!status) return "Consultando...";
  if (isEspApOnly(status)) return `Red propia · ${status.apIp}`;
  if (status.apActive && status.staConnected) {
    return `AP + STA · ${status.staIp}`;
  }
  return `${status.mode} · ${status.staIp}`;
}

function normalizeWifiStatus(data: Record<string, unknown>): EspWifiStatus {
  const mode = readString(data.mode) ?? "UNKNOWN";
  const apActive = data.apActive === true || mode === "AP" || mode === "AP_STA";
  const staConnected = data.staConnected === true;
  const connectedSsid = readString(data.connectedSsid);
  const staSsid = readString(data.staSsid) ?? readString(data.ssid) ?? "";
  const apSsid = readString(data.apSsid) ?? "";
  const reportedRssi = readNumber(data.rssi) ?? readNumber(data.staRssi);
  return {
    mode,
    apActive,
    staConnected,
    apIp: readString(data.apIp) ?? "0.0.0.0",
    staIp: readString(data.staIp) ?? "0.0.0.0",
    networkSsid: staConnected
      ? connectedSsid ?? staSsid
      : apActive
        ? apSsid
        : staSsid,
    rssiDbm: staConnected && data.rssiAvailable !== false && reportedRssi !== undefined
      ? Math.round(reportedRssi)
      : null,
    raw: data,
  };
}

function readEventName(message: unknown) {
  if (!isRecord(message)) return undefined;
  if (typeof message.event === "string") return message.event;
  const payload = isRecord(message.payload) ? message.payload : undefined;
  return typeof payload?.event === "string" ? payload.event : undefined;
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
