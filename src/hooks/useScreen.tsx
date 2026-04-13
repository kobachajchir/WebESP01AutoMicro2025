import { useContext } from "react";
import { ScreenContext } from "../contexts/ScreenContext";

export function useScreen() {
  const ctx = useContext(ScreenContext);
  if (!ctx) {
    throw new Error("useScreen debe usarse dentro de <ScreenProvider>");
  }
  return ctx;
}
