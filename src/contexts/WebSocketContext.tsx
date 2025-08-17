// src/contexts/WebSocketContext.tsx
import React, {
  createContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import Modal from "../components/modal";

type WSMessageHandler = (data: any) => void;
type WSRawHandler = (data: ArrayBuffer | Uint8Array) => void;

interface HeartbeatConfig {
  intervalMs: number;
  maxRetries: number;
  isActive: boolean;
  remainingRetries: number;
}

interface WebSocketContextType {
  connected: boolean;
  setConnected: (state: boolean) => void;

  send: (type: string, payload?: any) => void;
  subscribe: (type: string, handler: WSMessageHandler) => () => void;

  sendRaw: (data: Uint8Array) => void;
  subscribeRaw: (handler: WSRawHandler) => () => void;

  disconnect: () => void;
  mockMessage: (type: string, payload?: any) => void;
  mockRaw: (data: Uint8Array) => void;

  // Heartbeat watchdog
  heartbeatConfig: HeartbeatConfig;
  setHeartbeatInterval: (ms: number) => void;
  setHeartbeatMaxRetries: (retries: number) => void;
  toggleHeartbeatWatchdog: () => void;
  resetHeartbeatWatchdog: () => void;
  onHeartbeatReceived: () => void;
  retrying: boolean;
  setRetrying: (newVal: boolean) => void;
  setShowRetryModal: (newVal: boolean) => void;
}

export const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

interface WebSocketProviderProps {
  /** Endpoint completo, p.ej. `ws://mi-servidor/ws` */
  url: string;
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  url,
  children,
}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [showRetryModal, setShowRetryModal] = useState<boolean>(false);

  // Estados del heartbeat watchdog
  const [heartbeatConfig, setHeartbeatConfig] = useState<HeartbeatConfig>({
    intervalMs: 500,
    maxRetries: 5,
    isActive: false,
    remainingRetries: 5,
  });

  const jsonListeners = useRef(new Map<string, Set<WSMessageHandler>>());
  const rawListeners = useRef(new Set<WSRawHandler>());

  // Refs para los timers del heartbeat
  const heartbeatTimeoutRef = useRef<number | null>(null);

  // Función que se ejecuta cuando se agotan los intentos
  const onHeartbeatTimeout = useCallback(() => {
    console.log(
      "⚠️ [HEARTBEAT WATCHDOG] Se terminaron los intentos de heartbeat!"
    );
    console.log(
      `💀 [HEARTBEAT WATCHDOG] No se recibió heartbeat después de ${heartbeatConfig.maxRetries} intentos`
    );

    // Desconectar automáticamente
    setConnected(false);

    // Desactivar watchdog
    setHeartbeatConfig((prev) => ({
      ...prev,
      isActive: false,
      remainingRetries: 0,
    }));

    // Limpiar timeout
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }

    setShowRetryModal(true)
  }, [heartbeatConfig.maxRetries]);

  // Función para iniciar el watchdog
  const startHeartbeatWatchdog = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }

    if (connected && heartbeatConfig.isActive) {
      heartbeatTimeoutRef.current = setTimeout(() => {
        setHeartbeatConfig((prev) => {
          const newRetries = prev.remainingRetries - 1;
          console.log(
            `⏰ [WATCHDOG] Timeout! Decrementando contador: ${prev.remainingRetries} -> ${newRetries}`
          );

          if (newRetries <= 0) {
            onHeartbeatTimeout();
            return {
              ...prev,
              remainingRetries: 0,
              isActive: false,
            };
          } else {
            // Continuar con el siguiente timeout
            setTimeout(startHeartbeatWatchdog, 0);
            return {
              ...prev,
              remainingRetries: newRetries,
            };
          }
        });
      }, heartbeatConfig.intervalMs * 1.5); // Dar un margen del 50% sobre el intervalo esperado
    }
  }, [
    connected,
    heartbeatConfig.isActive,
    heartbeatConfig.intervalMs,
    onHeartbeatTimeout,
  ]);

  // Función para resetear el watchdog cuando llega un heartbeat
  const resetHeartbeatWatchdog = useCallback(() => {
    console.log(
      `🔄 [WATCHDOG] Heartbeat recibido! Reseteando contador a ${heartbeatConfig.maxRetries}`
    );

    // Limpiar timeout anterior si existe
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }

    // Resetear contador
    setHeartbeatConfig((prev) => ({
      ...prev,
      remainingRetries: prev.maxRetries,
    }));

    // Iniciar nuevo ciclo de watchdog si está activo
    if (heartbeatConfig.isActive && connected) {
      setTimeout(startHeartbeatWatchdog, 0);
    }
  }, [
    heartbeatConfig.maxRetries,
    heartbeatConfig.isActive,
    connected,
    startHeartbeatWatchdog,
  ]);

  // Función pública para notificar que se recibió un heartbeat
  const onHeartbeatReceived = useCallback(() => {
    if (heartbeatConfig.isActive) {
      resetHeartbeatWatchdog();
    }
  }, [heartbeatConfig.isActive, resetHeartbeatWatchdog]);

  // Función para activar/desactivar el watchdog
  const toggleHeartbeatWatchdog = useCallback(() => {
    if (!connected) return;

    setHeartbeatConfig((prev) => {
      const newIsActive = !prev.isActive;

      if (newIsActive) {
        // Activar watchdog
        console.log("🟢 [WATCHDOG] Activando watchdog");
        setTimeout(startHeartbeatWatchdog, 0);
        return {
          ...prev,
          isActive: true,
          remainingRetries: prev.maxRetries,
        };
      } else {
        // Desactivar watchdog
        console.log("🔴 [WATCHDOG] Desactivando watchdog");
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
          heartbeatTimeoutRef.current = null;
        }
        return {
          ...prev,
          isActive: false,
          remainingRetries: prev.maxRetries,
        };
      }
    });
  }, [connected, startHeartbeatWatchdog]);

  // Función para cambiar el intervalo de heartbeat
  const setHeartbeatInterval = useCallback((ms: number) => {
    console.log(`⚙️ [WATCHDOG] Cambiando intervalo a ${ms}ms`);
    setHeartbeatConfig((prev) => ({
      ...prev,
      intervalMs: ms,
    }));
  }, []);

  // Función para cambiar el máximo de reintentos
  const setHeartbeatMaxRetries = useCallback((retries: number) => {
    console.log(`⚙️ [WATCHDOG] Cambiando máximo reintentos a ${retries}`);
    setHeartbeatConfig((prev) => ({
      ...prev,
      maxRetries: retries,
      remainingRetries: prev.isActive ? retries : prev.remainingRetries,
    }));
  }, []);

  // Efecto para reiniciar watchdog cuando cambian parámetros
  useEffect(() => {
    if (heartbeatConfig.isActive && connected) {
      console.log(
        `⚙️ [WATCHDOG] Reiniciando por cambio de parámetros: interval=${heartbeatConfig.intervalMs}ms, maxRetries=${heartbeatConfig.maxRetries}`
      );

      // Limpiar timeout anterior
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }

      // Resetear contador y reiniciar
      setHeartbeatConfig((prev) => ({
        ...prev,
        remainingRetries: prev.maxRetries,
      }));

      setTimeout(startHeartbeatWatchdog, 0);
    }
  }, [
    heartbeatConfig.intervalMs,
    heartbeatConfig.maxRetries,
    heartbeatConfig.isActive,
    connected,
    startHeartbeatWatchdog,
  ]);

  // Efecto para limpiar watchdog cuando se desconecta
  useEffect(() => {
    if (!connected && heartbeatTimeoutRef.current) {
      console.log("🔌 [WATCHDOG] Desconexión detectada, limpiando watchdog");
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
      setHeartbeatConfig((prev) => ({
        ...prev,
        isActive: false,
        remainingRetries: prev.maxRetries,
      }));
    }
  }, [connected]);

  // 1) Abrir WS al montar conexión
  useEffect(() => {
    const mockMode = url.includes("mock");

    if (mockMode) {
      setConnected(true);
      wsRef.current = null; // no abrimos un WS real
      return () => {
        jsonListeners.current.clear();
        rawListeners.current.clear();
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
      };
    }

    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = async (evt) => {
      if (typeof evt.data === "string") {
        let msg: any;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }
        const { type, payload } = msg ?? {};
        jsonListeners.current.get(type)?.forEach((h) => h(payload));
        return;
      }
      if (evt.data instanceof ArrayBuffer) {
        rawListeners.current.forEach((h) => h(evt.data as ArrayBuffer));
        return;
      }
      if (evt.data instanceof Blob) {
        try {
          const buf = await (evt.data as Blob).arrayBuffer();
          rawListeners.current.forEach((h) => h(buf));
        } catch {}
      }
    };

    return () => {
      try {
        ws.close();
      } catch {}
      jsonListeners.current.clear();
      rawListeners.current.clear();
      wsRef.current = null;
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
    };
  }, [url]);

  // 2) Enviar JSON
  const send = useCallback((type: string, payload?: any) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    } else {
      // modo mock: solo log
      if (!ws) console.log("[WS mock] send JSON:", { type, payload });
    }
  }, []);

  // 3) Suscribirse a tipo JSON
  const subscribe = useCallback((type: string, handler: WSMessageHandler) => {
    if (!jsonListeners.current.has(type)) {
      jsonListeners.current.set(type, new Set());
    }
    jsonListeners.current.get(type)!.add(handler);
    return () => {
      jsonListeners.current.get(type)!.delete(handler);
      if (jsonListeners.current.get(type)!.size === 0) {
        jsonListeners.current.delete(type);
      }
    };
  }, []);

  // 4) Enviar binario
  const sendRaw = useCallback((data: Uint8Array) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data);
    } else {
      // MODO MOCK: registrar log y simular recepción (eco)
      console.log("[WS mock] sendRaw bytes:", data);
      // ⬇️ inyecta hacia todos los suscriptores binarios:
      rawListeners.current.forEach((h) => h(data));
    }
  }, []);

  // 5) Suscribirse a binario
  const subscribeRaw = useCallback((handler: WSRawHandler) => {
    rawListeners.current.add(handler);
    return () => {
      rawListeners.current.delete(handler);
    };
  }, []);

  // 6) Cerrar
  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  // 7) Mock JSON (no binario)
  const mockMessage = useCallback((type: string, payload?: any) => {
    jsonListeners.current.get(type)?.forEach((handler) => handler(payload));
  }, []);

  const mockRaw = useCallback((data: Uint8Array) => {
    rawListeners.current.forEach((h) => h(data));
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        connected,
        setConnected,
        send,
        subscribe,
        sendRaw,
        subscribeRaw,
        disconnect,
        mockMessage,
        mockRaw,
        heartbeatConfig,
        setHeartbeatInterval,
        setHeartbeatMaxRetries,
        toggleHeartbeatWatchdog,
        resetHeartbeatWatchdog,
        onHeartbeatReceived,
        retrying,
        setRetrying,
        setShowRetryModal,
      }}
    >
      {children}
      {showRetryModal && (
        <Modal
          isOpen={showRetryModal}
          onClose={() => {
            setRetrying(false);
            setShowRetryModal(false);
            setConnected(false);
          }}
        >
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-4xl font-bold mb-4 text-black uppercase">
              Conexion perdida
            </h2>
            <button
              onClick={() => {
                setRetrying(true);
                setShowRetryModal(false);
                setConnected(false);
              }}
              className="btn-danger group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white
                         transition-all duration-300 hover:text-slate-900 bg-red-600/80 hover:ring-red-400 hover:ring-2
                         hover:shadow-[inset_0_0_0_2px_theme('colors.red.400')]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40
                         disabled:opacity-50 disabled:cursor-not-allowed"
              title="Eliminar bloque seleccionado"
            >
              Reintentar conectar
            </button>
          </div>
        </Modal>
      )}
    </WebSocketContext.Provider>
  );
};
