// src/layouts/RootLayout.tsx
import { Outlet } from "react-router-dom";
import ApProvisioningGate from "./ApProvisioningGate";

export default function RootLayout() {
  return (
    // Todo lo que renderiza cada página va a transicionar como un “shared element” llamado "page"
    <main className="app-shell" style={{ viewTransitionName: "page", height: "100%" }}>
      <ApProvisioningGate />
      <Outlet />
    </main>
  );
}
