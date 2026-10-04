import type { ReactNode } from "react";
import logoDashboard from "../assets/LogoDashboardV2.webp";

export default function AppLoadingScreen({
  label,
  children,
  className = "",
  showSpinner = true,
}: {
  label: string;
  children?: ReactNode;
  className?: string;
  showSpinner?: boolean;
}) {
  return (
    <div
      className={`app-loading-screen ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="app-loading-screen__grid" aria-hidden="true" />
      <div className="app-loading-screen__content">
        <div className="app-loading-screen__hero-wrapper">
          <div className="app-loading-screen__ambient-glow" aria-hidden="true" />
          <div className="app-loading-screen__logo-shell">
            <img
              className="app-loading-screen__logo"
              src={logoDashboard}
              alt="AutoMicro"
            />
          </div>
        </div>
        <div className="app-loading-screen__status-group">
          {showSpinner && (
            <div className="app-loading-screen__spinner-track" aria-hidden="true">
              <span className="app-loading-screen__spinner" />
            </div>
          )}
          <p className="app-loading-screen__label">{label}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
