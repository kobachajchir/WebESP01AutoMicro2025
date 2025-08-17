import { useContext } from "react";
import { WebSocketContext } from "../contexts/WebSocketContext";

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket debe usarse dentro de <WebSocketProvider>");
  }
  return ctx;
}
