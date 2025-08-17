import { useContext } from "react";
import { UNERProtocolContext, type UNERContextValue } from "../contexts/UNERProtocolContext";

export function useUNERProtocol(): UNERContextValue {
  const ctx = useContext(UNERProtocolContext);
  if (!ctx)
    throw new Error(
      "useUNERProtocol debe usarse dentro de <UNERProtocolProvider />"
    );
  return ctx;
}