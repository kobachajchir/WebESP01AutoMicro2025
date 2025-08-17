// src/contexts/WebSocketContext.tsx
import React, {
  createContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";

type WSMessageHandler = (data: any) => void;
type WSRawHandler = (data: ArrayBuffer | Uint8Array) => void;

interface WebSocketContextType {
  connected: boolean;
  setConnected: (state: boolean) => void;

  send: (type: string, payload?: any) => void;
  subscribe: (type: string, handler: WSMessageHandler) => () => void;

  sendRaw: (data: Uint8Array) => void;
  subscribeRaw: (handler: WSRawHandler) => () => void;

  disconnect: () => void;
  mockMessage: (type: string, payload?: any) => void;

  // 👇 NUEVO: inyectar binario en modo mock
  mockRaw: (data: Uint8Array) => void;
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

  const jsonListeners = useRef(new Map<string, Set<WSMessageHandler>>());
  const rawListeners = useRef(new Set<WSRawHandler>());

  // 1) Abrir WS al montarconnection
  useEffect(() => {
    const mockMode = url.includes("mock");

    if (mockMode) {
      setConnected(true);
      wsRef.current = null; // no abrimos un WS real
      return () => {
        jsonListeners.current.clear();
        rawListeners.current.clear();
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

  // 4) === NUEVO === Enviar binario
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

  // 5) === NUEVO === Suscribirse a binario
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
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
