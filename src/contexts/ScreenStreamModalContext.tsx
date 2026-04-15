// src/contexts/ScreenStreamModalContext.tsx
import React, { createContext, useContext, useMemo, useState } from "react";
import ScreenStreamModal from "../components/ScreenStreamModal";

type ScreenStreamModalContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const ScreenStreamModalContext =
  createContext<ScreenStreamModalContextValue | null>(null);

export function ScreenStreamModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((prev) => !prev),
    }),
    [isOpen],
  );

  return (
    <ScreenStreamModalContext.Provider value={value}>
      {children}
      <ScreenStreamModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </ScreenStreamModalContext.Provider>
  );
}

export function useScreenStreamModal() {
  const ctx = useContext(ScreenStreamModalContext);
  if (!ctx) {
    throw new Error(
      "useScreenStreamModal debe usarse dentro de ScreenStreamModalProvider",
    );
  }
  return ctx;
}
