import { useState } from "react";
import {
  applyThemeMode,
  loadThemeMode,
  saveThemeMode,
  type ThemeMode,
} from "../utils/theme";
import ToggleButton from "./ToggleButton";

export default function ThemeModeToggleCard({
  className = "",
}: {
  className?: string;
}) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadThemeMode());

  function handleThemeModeToggle(nextChecked: boolean) {
    const nextMode: ThemeMode = nextChecked ? "dark" : "light";
    setThemeMode(nextMode);
    saveThemeMode(nextMode);
    applyThemeMode(nextMode);
  }

  return (
    <section className={`settings-identity-card settings-appearance-card ${className}`.trim()}>
      <div className="settings-appearance-card__content">
        <div className="settings-card-heading">
          <span className="settings-card-heading__icon">
            <AppearanceIcon />
          </span>
          <div>
            <h3>Apariencia</h3>
            <p>Modo visual global para toda la aplicación.</p>
          </div>
        </div>

        <ToggleButton
          checked={themeMode === "dark"}
          onChange={handleThemeModeToggle}
          className={`app-mode-toggle app-mode-toggle--theme theme-mode-toggle--${themeMode}`}
          labelClassName="app-mode-toggle__label"
          labels={true}
          size="lg"
          title="Alternar modo de apariencia"
          labelOn="Modo oscuro"
          labelOff="Modo claro"
          ariaLabel="Alternar modo de apariencia"
        />
      </div>
    </section>
  );
}

function AppearanceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9 6.5 6.5 0 0 1-9-9Z" />
      <path d="M13 3.5A8.5 8.5 0 0 0 12 20.5" />
    </svg>
  );
}
