/* eslint-disable react-refresh/only-export-components */
import React, {
 createContext,
 useCallback,
 useEffect,
 useMemo,
 useRef,
 useState,
 type ReactNode,
} from "react";
import Modal from "../components/modal";
import { EspClient, type EspApiError } from "../protocol/espClient";
import {
 parseWsEnvelope,
 type CommandName,
 type EspHello,
 type WsEvent,
} from "../protocol/wsApi";

type WSMessageHandler = (data: unknown) => void;
type WSRawHandler = (data: ArrayBuffer | Uint8Array) => void;
type WSDataPacketMeta = Record<string, unknown>;

export type ConnectionPhase =
 | "idle"
 | "connecting"
 | "authenticating"
 | "ready"
 | "retry_wait"
 | "failed";

export type ConnectionHealth = "connecting" | "ready" | "degraded" | "offline";

interface HeartbeatConfig {
 intervalMs: number;
 maxRetries: number;
 isActive: boolean;
 remainingRetries: number;
}

interface WebSocketContextType {
 connected: boolean;
 setConnected: (state: boolean) => void;
 connectionPhase: ConnectionPhase;
 connectionHealth: ConnectionHealth;
 hello: EspHello | null;
 lastError: EspApiError | Error | null;
 mockMode: boolean;
 request: <T>(command: CommandName, args?: Record<string, unknown>, options?: { requestId?: string; timeoutMs?: number }) => Promise<T>;
 subscribeEvent: (event: string, handler: (event: WsEvent) => void) => () => void;
 reconnect: () => void;
 send: (type: string, payload?: unknown) => void;
 subscribe: (type: string, handler: WSMessageHandler) => () => void;
 sendRaw: (data: Uint8Array, meta?: WSDataPacketMeta) => void;
 subscribeRaw: (handler: WSRawHandler) => () => void;
 disconnect: () => void;
 mockMessage: (type: string, payload?: unknown) => void;
 mockRaw: (data: Uint8Array) => void;
 heartbeatConfig: HeartbeatConfig;
 lastHeartbeatAt: number | null;
 setHeartbeatInterval: (ms: number) => void;
 setHeartbeatMaxRetries: (retries: number) => void;
 toggleHeartbeatWatchdog: () => void;
 resetHeartbeatWatchdog: () => void;
 onHeartbeatReceived: () => void;
 retrying: boolean;
 setRetrying: (newVal: boolean) => void;
 setShowRetryModal: (newVal: boolean) => void;
 sensorRefreshInterval: number;
 setSensorRefreshInterval: (newVal: number) => void;
}

export const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
 url: string;
 children: ReactNode;
}

const WS_DATA_PACKET_TYPES = new Set(["stmPacket", "unerPacket", "rawBytes", "binaryData"]);
const MAX_RECONNECT_ATTEMPTS = 8;
const HANDSHAKE_TIMEOUT_MS = 5_000;

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ url, children }) => {
 const mockMode = url.startsWith("mock://");
 const wsRef = useRef<WebSocket | null>(null);
 const clientRef = useRef(new EspClient());
 const jsonListeners = useRef(new Map<string, Set<WSMessageHandler>>());
 const rawListeners = useRef(new Set<WSRawHandler>());
 const reconnectTimerRef = useRef<number | null>(null);
 const handshakeTimerRef = useRef<number | null>(null);
 const generationRef = useRef(0);
 const reconnectAttemptRef = useRef(0);
 const manuallyClosedRef = useRef(false);
 const connectRef = useRef<() => void>(() => undefined);

 const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>("idle");
 const [hello, setHello] = useState<EspHello | null>(null);
 const [lastError, setLastError] = useState<EspApiError | Error | null>(null);
 const [showRetryModal, setShowRetryModal] = useState(false);
 const [sensorRefreshInterval, setSensorRefreshInterval] = useState(20);
 const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
 const [heartbeatConfig, setHeartbeatConfig] = useState<HeartbeatConfig>({
 intervalMs: 1_000,
 maxRetries: 5,
 isActive: false,
 remainingRetries: 5,
 });

 const connected = connectionPhase === "ready";
 const retrying = connectionPhase === "retry_wait" || connectionPhase === "connecting";
 const connectionHealth: ConnectionHealth =
 connectionPhase === "ready"
 ? hello?.backend && hello.backend.f4Alive === false
 ? "degraded"
 : "ready"
 : connectionPhase === "connecting" || connectionPhase === "authenticating" || connectionPhase === "retry_wait"
 ? "connecting"
 : "offline";

 const clearTimer = useCallback((ref: React.MutableRefObject<number | null>) => {
 if (ref.current !== null) window.clearTimeout(ref.current);
 ref.current = null;
 }, []);

 const dispatchJson = useCallback((type: string, payload: unknown) => {
 jsonListeners.current.get(type)?.forEach((handler) => handler(payload));
 }, []);

 const handleTextMessage = useCallback((text: string, generation: number) => {
 if (generation !== generationRef.current) return;

 let decoded: unknown;
 try {
 decoded = JSON.parse(text);
 } catch {
 setLastError(new Error("El ESP envio JSON invalido"));
 return;
 }

 setLastHeartbeatAt(Date.now());
 setHeartbeatConfig((current) => ({ ...current, remainingRetries: current.maxRetries }));
 const envelope = parseWsEnvelope(decoded);
 if (envelope) {
 clientRef.current.accept(envelope);
 if (envelope.type === "event") {
 dispatchJson(envelope.event, envelope.data);
 dispatchJson("device.event", envelope);
 if (envelope.event === "hello") {
 const nextHello = envelope.data as EspHello;
 if (nextHello.apiVersion !== 1) {
 setLastError(new Error(`Version WS no soportada: ${nextHello.apiVersion}`));
 wsRef.current?.close(1002, "unsupported api");
 return;
 }
 clearTimer(handshakeTimerRef);
 setHello(nextHello);
 reconnectAttemptRef.current = 0;
 setConnectionPhase("ready");
 }
 } else if (envelope.type === "response") {
 dispatchJson("device.response", envelope);
 } else {
 dispatchJson("device.error", envelope);
 setLastError(new Error(`${envelope.code}: ${envelope.message}`));
 }
 return;
 }

 if (isRecord(decoded) && typeof decoded.type === "string") {
 const payload = "payload" in decoded ? decoded.payload : decoded;
 dispatchJson(decoded.type, payload);
 const packetBytes = decodeWsDataPacket(decoded);
 if (packetBytes) rawListeners.current.forEach((handler) => handler(packetBytes));
 }
 }, [clearTimer, dispatchJson]);

 const scheduleReconnect = useCallback(() => {
 if (manuallyClosedRef.current || mockMode) return;
 const attempt = reconnectAttemptRef.current;
 if (attempt >= MAX_RECONNECT_ATTEMPTS) {
 setConnectionPhase("failed");
 setShowRetryModal(true);
 return;
 }
 const base = Math.min(15_000, 500 * 2 ** attempt);
 const jitter = Math.round(base * (Math.random() * 0.4 - 0.2));
 reconnectAttemptRef.current += 1;
 setConnectionPhase("retry_wait");
 clearTimer(reconnectTimerRef);
 reconnectTimerRef.current = window.setTimeout(() => connectRef.current(), Math.max(250, base + jitter));
 }, [clearTimer, mockMode]);

 const connect = useCallback(() => {
 clearTimer(reconnectTimerRef);
 clearTimer(handshakeTimerRef);
 manuallyClosedRef.current = false;
 setHello(null);
 setLastError(null);

 if (mockMode) {
 clientRef.current.setSender(null);
 setHello({ apiVersion: 1, espVersion: "mock-explicito", features: {}, backend: { f4Alive: false } });
 setConnectionPhase("ready");
 return;
 }

 const generation = ++generationRef.current;
 setConnectionPhase("connecting");
 const ws = new WebSocket(url);
 ws.binaryType = "arraybuffer";
 wsRef.current = ws;

 ws.onopen = () => {
 if (generation !== generationRef.current) return;
 setConnectionPhase("authenticating");
 clientRef.current.setSender((text) => {
 if (ws.readyState !== WebSocket.OPEN) throw new Error("WebSocket desconectado");
 ws.send(text);
 });
 handshakeTimerRef.current = window.setTimeout(() => {
 setLastError(new Error("El ESP no envio hello API v1"));
 ws.close(1002, "hello timeout");
 }, HANDSHAKE_TIMEOUT_MS);
 };

 ws.onmessage = async (event) => {
 if (typeof event.data === "string") {
 handleTextMessage(event.data, generation);
 } else if (event.data instanceof ArrayBuffer) {
 rawListeners.current.forEach((handler) => handler(event.data));
 } else if (event.data instanceof Blob) {
 const bytes = await event.data.arrayBuffer();
 if (generation === generationRef.current) rawListeners.current.forEach((handler) => handler(bytes));
 }
 };

 ws.onerror = () => setLastError(new Error("Error de transporte WebSocket"));
 ws.onclose = () => {
 if (generation !== generationRef.current) return;
 clearTimer(handshakeTimerRef);
 wsRef.current = null;
 clientRef.current.setSender(null);
 setHello(null);
 scheduleReconnect();
 };
 }, [clearTimer, handleTextMessage, mockMode, scheduleReconnect, url]);

 connectRef.current = connect;

 useEffect(() => {
 const client = clientRef.current;
 const jsonListenerMap = jsonListeners.current;
 const rawListenerSet = rawListeners.current;
 connect();
 return () => {
 manuallyClosedRef.current = true;
 generationRef.current += 1;
 clearTimer(reconnectTimerRef);
 clearTimer(handshakeTimerRef);
 client.setSender(null);
 wsRef.current?.close(1000, "unmount");
 wsRef.current = null;
 jsonListenerMap.clear();
 rawListenerSet.clear();
 };
 }, [clearTimer, connect]);

 useEffect(() => {
 if (!heartbeatConfig.isActive || !connected || lastHeartbeatAt === null) return;
 const timeoutMs = heartbeatConfig.intervalMs * 1.5;
 const timer = window.setInterval(() => {
 if (Date.now() - lastHeartbeatAt < timeoutMs) return;
 setHeartbeatConfig((current) => {
 const remainingRetries = Math.max(0, current.remainingRetries - 1);
 if (remainingRetries === 0) {
 setLastError(new Error("El servidor dejo de emitir actividad WebSocket"));
 wsRef.current?.close(4000, "ws heartbeat timeout");
 }
 return { ...current, remainingRetries };
 });
 }, timeoutMs);
 return () => window.clearInterval(timer);
 }, [connected, heartbeatConfig.intervalMs, heartbeatConfig.isActive, lastHeartbeatAt]);

 const request = useCallback(<T,>(command: CommandName, args: Record<string, unknown> = {}, options?: { requestId?: string; timeoutMs?: number }) => {
 if (mockMode) return Promise.reject(new Error("El mock explicito no simula respuestas F4"));
 return clientRef.current.request<T>(command, args, options);
 }, [mockMode]);

 const subscribeEvent = useCallback((event: string, handler: (event: WsEvent) => void) => clientRef.current.subscribe(event, handler), []);

 const send = useCallback((type: string, payload?: unknown) => {
 if (type === "device.command" && isRecord(payload) && typeof payload.command === "string") {
 const args = isRecord(payload.args) ? payload.args : isRecord(payload.params) ? payload.params : {};
 void clientRef.current.request(payload.command, args, {
 requestId: typeof payload.requestId === "string" ? payload.requestId : undefined,
 }).catch(() => undefined);
 return;
 }
 const ws = wsRef.current;
 if (ws?.readyState !== WebSocket.OPEN) throw new Error("WebSocket desconectado");
 ws.send(JSON.stringify({ type, payload }));
 }, []);

 const subscribe = useCallback((type: string, handler: WSMessageHandler) => {
 const listeners = jsonListeners.current.get(type) ?? new Set<WSMessageHandler>();
 listeners.add(handler);
 jsonListeners.current.set(type, listeners);
 return () => {
 listeners.delete(handler);
 if (listeners.size === 0) jsonListeners.current.delete(type);
 };
 }, []);

 const sendRaw = useCallback((data: Uint8Array, meta?: WSDataPacketMeta) => {
 const ws = wsRef.current;
 if (ws?.readyState !== WebSocket.OPEN || !connected) throw new Error("WebSocket API v1 no esta listo");
 ws.send(JSON.stringify({ type: "stmPacket", payload: { ...meta, data: Array.from(data) } }));
 }, [connected]);

 const subscribeRaw = useCallback((handler: WSRawHandler) => {
 rawListeners.current.add(handler);
 return () => rawListeners.current.delete(handler);
 }, []);

 const disconnect = useCallback(() => {
 manuallyClosedRef.current = true;
 clearTimer(reconnectTimerRef);
 clearTimer(handshakeTimerRef);
 generationRef.current += 1;
 clientRef.current.setSender(null);
 wsRef.current?.close(1000, "user logout");
 wsRef.current = null;
 setConnectionPhase("idle");
 setHello(null);
 }, [clearTimer]);

 const reconnect = useCallback(() => {
 manuallyClosedRef.current = false;
 reconnectAttemptRef.current = 0;
 generationRef.current += 1;
 wsRef.current?.close(4001, "manual reconnect");
 wsRef.current = null;
 connectRef.current();
 }, []);

 const setConnected = useCallback((state: boolean) => state ? reconnect() : disconnect(), [disconnect, reconnect]);
 const setRetrying = useCallback((value: boolean) => { if (value) reconnect(); }, [reconnect]);
 const mockMessage = useCallback((type: string, payload?: unknown) => { if (mockMode) dispatchJson(type, payload); }, [dispatchJson, mockMode]);
 const mockRaw = useCallback((data: Uint8Array) => { if (mockMode) rawListeners.current.forEach((handler) => handler(data)); }, [mockMode]);
 const onHeartbeatReceived = useCallback(() => {
 setLastHeartbeatAt(Date.now());
 setHeartbeatConfig((current) => ({ ...current, remainingRetries: current.maxRetries }));
 }, []);
 const resetHeartbeatWatchdog = onHeartbeatReceived;
 const toggleHeartbeatWatchdog = useCallback(() => setHeartbeatConfig((current) => ({ ...current, isActive: !current.isActive, remainingRetries: current.maxRetries })), []);
 const setHeartbeatInterval = useCallback((intervalMs: number) => setHeartbeatConfig((current) => ({
 ...current,
 intervalMs: Math.min(10_000, Math.max(100, Math.round(intervalMs / 100) * 100)),
 })), []);
 const setHeartbeatMaxRetries = useCallback((maxRetries: number) => setHeartbeatConfig((current) => ({ ...current, maxRetries: Math.max(0, Math.round(maxRetries)), remainingRetries: Math.max(0, Math.round(maxRetries)) })), []);

 const value = useMemo<WebSocketContextType>(() => ({
 connected, setConnected, connectionPhase, connectionHealth, hello, lastError, mockMode,
 request, subscribeEvent, reconnect, send, subscribe, sendRaw, subscribeRaw, disconnect,
 mockMessage, mockRaw, heartbeatConfig, lastHeartbeatAt, setHeartbeatInterval,
 setHeartbeatMaxRetries, toggleHeartbeatWatchdog, resetHeartbeatWatchdog,
 onHeartbeatReceived, retrying, setRetrying, setShowRetryModal,
 sensorRefreshInterval, setSensorRefreshInterval,
 }), [connected, setConnected, connectionPhase, connectionHealth, hello, lastError, mockMode,
 request, subscribeEvent, reconnect, send, subscribe, sendRaw, subscribeRaw, disconnect,
 mockMessage, mockRaw, heartbeatConfig, lastHeartbeatAt, setHeartbeatInterval,
 setHeartbeatMaxRetries, toggleHeartbeatWatchdog, resetHeartbeatWatchdog,
 onHeartbeatReceived, retrying, setRetrying, sensorRefreshInterval]);

 return (
 <WebSocketContext.Provider value={value}>
 {children}
 {showRetryModal ? (
 <Modal isOpen onClose={() => setShowRetryModal(false)}>
 <div className="flex flex-col items-center justify-center">
 <h2 className="mb-4 text-4xl font-bold uppercase text-[var(--ui-ink)]">Conexion perdida</h2>
 <p className="mb-4 text-center">No se pudo completar el handshake API v1 con el ESP.</p>
 <button type="button" onClick={() => { setShowRetryModal(false); reconnect(); }} className="btn-danger rounded-2xl bg-red-600/80 px-4 py-2 font-semibold text-[var(--ui-text)]">
 Reintentar conectar
 </button>
 </div>
 </Modal>
 ) : null}
 </WebSocketContext.Provider>
 );
};

function decodeWsDataPacket(message: Record<string, unknown>): Uint8Array | null {
 if (!WS_DATA_PACKET_TYPES.has(String(message.type))) return null;
 const payload = isRecord(message.payload) ? message.payload : null;
 const data = Array.isArray(message.payload) ? message.payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(message.data) ? message.data : null;
 if (!data || data.some((value) => typeof value !== "number")) return null;
 return Uint8Array.from(data as number[], (value) => value & 0xff);
}

function isRecord(value: unknown): value is Record<string, unknown> {
 return typeof value === "object" && value !== null && !Array.isArray(value);
}
