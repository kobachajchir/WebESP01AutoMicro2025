// src/contexts/WebSocketContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import type { ReactNode } from "react";

type WSMessageHandler = (data: any) => void;

interface WebSocketContextType {
  /** Estado de conexión */
  connected: boolean;
  /** Envía un mensaje (serializado a JSON) */
  send: (type: string, payload?: any) => void;
  /** Se suscribe a un tipo de mensaje y recibe el payload */
  subscribe: (type: string, handler: WSMessageHandler) => () => void;
  /** Cierra la conexión */
  disconnect: () => void;
  /** Inyecta un mensaje entrante (para mocks) */
  mockMessage: (type: string, payload?: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
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
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Map<string, Set<WSMessageHandler>>());

  // 1) Abrir WS al montar
  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    // ✔ Conexión establecida tras 1s (mock)
    setTimeout(() => setConnected(true), 1000);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (evt) => {
      let msg: any;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      const { type, payload } = msg;
      listeners.current.get(type)?.forEach((handler) => handler(payload));
    };

    return () => {
      ws.close();
      listeners.current.clear();
    };
  }, [url]);

  // 2) Enviar mensaje al servidor
  const send = useCallback((type: string, payload?: any) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // 3) Suscribirse a un tipo de mensaje entrante
  const subscribe = useCallback((type: string, handler: WSMessageHandler) => {
    if (!listeners.current.has(type)) {
      listeners.current.set(type, new Set());
    }
    listeners.current.get(type)!.add(handler);
    return () => {
      listeners.current.get(type)!.delete(handler);
    };
  }, []);

  // 4) Cerrar la conexión
  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  // 5) Inyectar un mensaje entrante para mocks
  const mockMessage = useCallback((type: string, payload?: any) => {
    listeners.current.get(type)?.forEach((handler) => handler(payload));
  }, []);

  return (
    <WebSocketContext.Provider
      value={{ connected, send, subscribe, disconnect, mockMessage }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

/** Hook para usar WebSocketContext */
export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket debe usarse dentro de <WebSocketProvider>");
  }
  return ctx;
}
