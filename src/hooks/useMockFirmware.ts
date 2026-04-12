// src/hooks/useMockFirmware.ts
import { useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import { CMD } from "../types/UnerProtocolCMDTypes";

export function useMockFirmware(
  mode: "AP" | "STATION" = "AP",
  delay: number = 500
) {
  const { mockRaw } = useWebSocket();

  useEffect(() => {
    const tid = setTimeout(() => {
      console.log("Mock: inyectando WIFI_MODE response", mode);

      // Construir respuesta binaria para WIFI_MODE
      // payload: u8 (0=AP, 1=STATION)
      const modeValue = mode === "AP" ? 0 : 1;
      const response = new Uint8Array([CMD.WIFI_MODE, modeValue]);

      mockRaw(response);
    }, delay);

    return () => clearTimeout(tid);
  }, [mockRaw, mode, delay]);
}
