// src/layouts/RootLayout.tsx
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import ApProvisioningGate from "./ApProvisioningGate";

export default function RootLayout() {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <main className="app-shell" style={{ height: "100%", overflow: "hidden", position: "relative" }}>
      <ApProvisioningGate />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, filter: "blur(8px)", scale: 0.98, x: 20 }}
          animate={{ opacity: 1, filter: "blur(0px)", scale: 1, x: 0 }}
          exit={{ opacity: 0, filter: "blur(8px)", scale: 0.98, x: -20 }}
          transition={{ type: "spring", bounce: 0, duration: 0.2 }}
          className="h-full w-full absolute inset-0 overflow-y-auto overflow-x-hidden"
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
