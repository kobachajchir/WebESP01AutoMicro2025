import type { ReactNode } from "react";
import logoDashboard from "../assets/LogoDashboard.webp";

export default function AppLoadingScreen({
  label,
  children,
}: {
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="app-loading-screen" role="status" aria-live="polite" aria-label={label}>
      <div className="app-loading-screen__grid" aria-hidden="true" />
      <div className="app-loading-screen__content">
        <div className="app-loading-screen__logo-shell">
          <img
            className="app-loading-screen__logo"
            src={logoDashboard}
            alt="Auto Microcontroladores"
          />
        </div>
        <span className="app-loading-screen__spinner" aria-hidden="true" />
        <p>{label}</p>
        {children}
      </div>
    </div>
  );
}
