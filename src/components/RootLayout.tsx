// src/layouts/RootLayout.tsx
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ApProvisioningGate from "./ApProvisioningGate";

export default function RootLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();
  const resting = { opacity: 1, transform: "translateY(0) scale(1)" };
  const away = {
    opacity: 0,
    transform: reduceMotion ? "translateY(0) scale(1)" : "translateY(8px) scale(0.99)",
  };

  return (
    <main className="app-shell app-route-shell">
      <ApProvisioningGate />
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={location.pathname}
          initial={away}
          animate={resting}
          exit={away}
          transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: [0.23, 1, 0.32, 1] }}
          className="app-route-view"
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
