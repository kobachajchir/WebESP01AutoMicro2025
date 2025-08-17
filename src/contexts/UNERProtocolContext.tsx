import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  UNERProtocol,
  UNERStatus,
  type UNERPacket,
} from "./../api/UnerProtocol";
import { useWebSocket } from "../hooks/useWebSocket";

/** Interfaz de transporte agnóstico (WS, WebSerial, BLE, etc.) */
export interface UNERTransport {
  write: (data: Uint8Array) => Promise<void> | void;
  start?: () => Promise<() => void> | (() => void) | void;
  onBytes: (cb: (chunk: Uint8Array) => void) => (() => void) | void;
  isConnected?: () => boolean;
}

export type UNERCmdHandler = (packet: UNERPacket) => void;

export interface UNERContextValue {
  send: (cmd: number, payload?: Uint8Array) => Promise<void>;
  subscribe: (cmd: number, handler: UNERCmdHandler) => () => void;
  lastPacket?: UNERPacket;
  stats: {
    packetsOK: number;
    errorsChecksum: number;
    errorsLength: number;
    errorsHeader: number;
    errorsToken: number;
    errorsOverflow: number;
  };
  connected: boolean;
}

export interface UNERProtocolProviderProps {
  transport?: UNERTransport; // si no llega, se usa auto WS
  ringCapacity?: number;
  children: ReactNode;
}

export const UNERProtocolContext = createContext<UNERContextValue | undefined>(
  undefined
);

/* ---- Adaptador automático desde tu useWebSocket() ---- */
function useAutoWsTransport(): UNERTransport {
  const ws = useWebSocket(); // { connected, sendRaw, subscribeRaw, ... }

  return useMemo<UNERTransport>(
    () => ({
      write: (data: Uint8Array) => {
        ws.sendRaw(data); // siempre binario
      },
      onBytes: (cb) => {
        return ws.subscribeRaw((incoming: ArrayBuffer | Uint8Array) => {
          const chunk =
            incoming instanceof Uint8Array
              ? incoming
              : new Uint8Array(incoming);
          cb(chunk);
        });
      },
      start: () => () => {}, // el WS ya gestiona la conexión
      isConnected: () => !!ws.connected,
    }),
    [ws]
  );
}

/* =================== Provider =================== */
export function UNERProtocolProvider({
  transport: transportProp,
  ringCapacity = 256,
  children,
}: UNERProtocolProviderProps) {
  const autoTransport = useAutoWsTransport();
  const transport = transportProp ?? autoTransport;

  const [lastPacket, setLastPacket] = useState<UNERPacket | undefined>();
  const [connected, setConnected] = useState<boolean>(
    transport.isConnected?.() ?? true
  );

  const subscribersRef = useRef<Map<number, Set<UNERCmdHandler>>>(new Map());

  const onPacket = useCallback((p: UNERPacket) => {
    setLastPacket(p);
    const set = subscribersRef.current.get(p.cmd);
    if (set && set.size) {
      for (const h of set) {
        try {
          h(p);
        } catch (e) {
          console.error("[UNER] handler error:", e);
        }
      }
    }
  }, []);

  const uner = useMemo(
    () => new UNERProtocol(ringCapacity, onPacket),
    [ringCapacity, onPacket]
  );

  // Feeder transport -> parser
  useEffect(() => {
    let stopFn: void | (() => void) | Promise<() => void>;
    let unsubscribe: void | (() => void);

    const feed = (chunk: Uint8Array) => {
      for (let i = 0; i < chunk.length; i++) {
        const st = uner.pushByte(chunk[i]);
        if (st === UNERStatus.ERR_RX_OVERFLOW) {
          console.warn("[UNER] RX ring overflow");
        }
      }
      uner.parse();
    };

    unsubscribe = transport.onBytes(feed);

    const startMaybe = transport.start?.();
    if (startMaybe instanceof Promise) {
      startMaybe
        .then((fn) => {
          stopFn = fn;
          setConnected(transport.isConnected?.() ?? true);
        })
        .catch((e) => {
          console.error("[UNER] transport start error:", e);
          setConnected(false);
        });
    } else {
      stopFn = startMaybe;
      setConnected(transport.isConnected?.() ?? true);
    }

    const t = setInterval(() => {
      if (transport.isConnected) {
        const now = !!transport.isConnected();
        setConnected((prev) => (prev !== now ? now : prev));
      }
    }, 350);

    return () => {
      clearInterval(t);
      try {
        if (typeof unsubscribe === "function") unsubscribe();
      } catch {}
      try {
        if (typeof stopFn === "function") stopFn();
      } catch {}
    };
  }, [transport, uner]);

  const send = useCallback(
    async (cmd: number, payload?: Uint8Array) => {
      const frame = uner.buildPacket(cmd, payload);
      console.log("[UNER] Enviando:", { cmd, payload, frame });
      await transport.write(frame);
    },
    [transport, uner]
  );

  const subscribe = useCallback((cmd: number, handler: UNERCmdHandler) => {
    let set = subscribersRef.current.get(cmd);
    if (!set) {
      set = new Set();
      subscribersRef.current.set(cmd, set);
    }
    set.add(handler);
    return () => {
      const s = subscribersRef.current.get(cmd);
      if (!s) return;
      s.delete(handler);
      if (s.size === 0) subscribersRef.current.delete(cmd);
    };
  }, []);

  const stats = useMemo(
    () => ({
      packetsOK: uner.packetsOK,
      errorsChecksum: uner.errorsChecksum,
      errorsLength: uner.errorsLength,
      errorsHeader: uner.errorsHeader,
      errorsToken: uner.errorsToken,
      errorsOverflow: uner.errorsOverflow,
    }),
    [uner, lastPacket]
  );

  const value = useMemo<UNERContextValue>(
    () => ({
      send,
      subscribe,
      lastPacket,
      stats,
      connected,
    }),
    [send, subscribe, lastPacket, stats, connected]
  );

  return (
    <UNERProtocolContext.Provider value={value}>
      {children}
    </UNERProtocolContext.Provider>
  );
}

