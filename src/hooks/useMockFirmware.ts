// src/hooks/useMockFirmware.ts
import { useEffect } from "react";
import { useWebSocket } from "../contexts/WebSocketContext";

export function useMockFirmware(
  mode: "AP" | "STATION" = "AP",
  delay: number = 500
) {
  const { connected, mockMessage } = useWebSocket();

  useEffect(() => {
    if (!connected) return; // ← Espera a que el WS esté listo

    const tid = setTimeout(() => {
      console.log("Mock: inyectando wifiModeResponse", mode);
      mockMessage("wifiModeResponse", { mode });
    }, delay);

    return () => clearTimeout(tid);
  }, [connected, mockMessage, mode, delay]);
}
