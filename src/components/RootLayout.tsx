// src/layouts/RootLayout.tsx
import { Outlet } from "react-router-dom";

export default function RootLayout() {
  return (
    // Todo lo que renderiza cada página va a transicionar como un “shared element” llamado "page"
    <main className="app-shell" style={{ viewTransitionName: "page", height: "100%" }}>
      <Outlet />
    </main>
  );
}
