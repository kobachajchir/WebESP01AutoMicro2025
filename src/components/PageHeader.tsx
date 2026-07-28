// src/components/PageHeader.tsx
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, type ReactNode } from "react";
import { useUser } from "../contexts/UserContext";
import { useScreenStreamModal } from "../contexts/ScreenStreamModalContext";

interface PageHeaderProps {
  setOpenSettingsModal?: (open: boolean) => void;
  setOpenInfoModal?: (open: boolean) => void;
  showSettings?: boolean;
  showInfo?: boolean;
  showLogout?: boolean;
  showHome?: boolean;
  className?: string;
  titleOverride?: string;
  leadingSlot?: ReactNode;
  statusSlot?: ReactNode;
}

const PAGE_TITLES: Record<string, string> = {
  "/control": "Control de Motores",
  "/wifi": "Wifi",
  "/statics": "MPU + IR",
  "/seguidor-pista": "Seguidor de pista",
  "/protocol": "UNER Studio",
  "/docs": "Docs",
  "/oled-editor": "Editor OLED",
  "/bluetooth": "Bluetooth",
  "/home": "Dashboard",
  "/settings": "Configuración",
};

export default function PageHeader({
  setOpenSettingsModal,
  setOpenInfoModal,
  showSettings = true,
  showInfo = true,
  showLogout = true,
  showHome = true,
  className = "app-page-header",
  titleOverride = "",
  leadingSlot,
  statusSlot,
}: PageHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, devMode } = useUser();
  const { open: openScreenStreamModal } = useScreenStreamModal();
  const inProtocol = location.pathname.startsWith("/protocol");
  const inDocs = location.pathname.startsWith("/docs");
  const docsHref = inDocs ? `/docs${location.search}` : "/docs";

  const toolbarButtonClass =
    "toolbar-btn group flex items-center justify-center gap-2 py-2 px-3 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40";

  const [hoveredHeaderBtn, setHoveredHeaderBtn] = useState<string | null>(null);
  const [accentBorder30, setAccentBorder30] = useState<string>(
    "rgba(34,211,238,0.3)",
  );

  useEffect(() => {
    try {
      const raw =
        getComputedStyle(document.documentElement).getPropertyValue(
          "--ui-accent",
        ) || "#22d3ee";
      const hex = raw.trim();
      const m = hex.match(/^#?([0-9a-fA-F]{6})$/);

      if (m) {
        const hh = m[1];
        const r = parseInt(hh.slice(0, 2), 16);
        const g = parseInt(hh.slice(2, 4), 16);
        const b = parseInt(hh.slice(4, 6), 16);
        setAccentBorder30(`rgba(${r}, ${g}, ${b}, 0.3)`);
      }
    } catch {
      // ignore
    }
  }, []);

  const getPageTitle = () => {
    const path = location.pathname;
    if (titleOverride.length > 0) {
      return titleOverride;
    }
    if (path.startsWith("/docs")) {
      return PAGE_TITLES["/docs"];
    }
    return PAGE_TITLES[path] || "Aplicación";
  };

  const getToolbarButtonStyle = (key: string): React.CSSProperties =>
    hoveredHeaderBtn === key
      ? {
          borderColor: "white",
          color: "white",
          borderStyle: "solid",
          borderWidth: "1px",
        }
      : {
          borderColor: accentBorder30,
          borderStyle: "solid",
          borderWidth: "1px",
        };

  return (
    <div className={className}>
      <div className="app-page-header__identity">
        {leadingSlot}
        <h1 className="app-title text-3xl md:text-5xl">{getPageTitle()}</h1>
      </div>

      {statusSlot ? (
        <div className="app-page-header__status">{statusSlot}</div>
      ) : null}

      <div className="app-page-header__actions">
        {showHome && !location.pathname.includes("home") && (
          <button
            aria-label="Ir a Home"
            className={toolbarButtonClass}
            onMouseEnter={() => setHoveredHeaderBtn("home")}
            onMouseLeave={() => setHoveredHeaderBtn(null)}
            onClick={() => navigate("/home", { viewTransition: true })}
            style={getToolbarButtonStyle("home")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              className="size-6 transition-transform duration-300 group-hover:scale-110"
            >
              <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
              <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
            </svg>
          </button>
        )}

        <button
          aria-label="Abrir stream de pantalla"
          className={toolbarButtonClass}
          onMouseEnter={() => setHoveredHeaderBtn("screen-stream")}
          onMouseLeave={() => setHoveredHeaderBtn(null)}
          onClick={openScreenStreamModal}
          style={getToolbarButtonStyle("screen-stream")}
          title="Abrir stream de pantalla"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            className="size-6 transition-transform duration-300 group-hover:scale-110"
          >
            <path
              fillRule="evenodd"
              d="M3.75 6A2.25 2.25 0 0 1 6 3.75h12A2.25 2.25 0 0 1 20.25 6v8.25A2.25 2.25 0 0 1 18 16.5h-4.19l.72 2.25h1.22a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h1.22l.72-2.25H6a2.25 2.25 0 0 1-2.25-2.25V6Zm1.5 0a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 .75.75v8.25a.75.75 0 0 1-.75.75H6a.75.75 0 0 1-.75-.75V6Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {(inProtocol || inDocs) && (
          <button
            aria-label="Ir a Docs"
            className={toolbarButtonClass}
            onMouseEnter={() => setHoveredHeaderBtn("docs")}
            onMouseLeave={() => setHoveredHeaderBtn(null)}
            onClick={() => navigate(docsHref, { viewTransition: true })}
            style={getToolbarButtonStyle("docs")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              className="size-6 transition-transform duration-300 group-hover:scale-110"
            >
              <path
                fillRule="evenodd"
                d="M6.75 3A3.75 3.75 0 0 0 3 6.75v10.5A3.75 3.75 0 0 0 6.75 21h10.5A3.75 3.75 0 0 0 21 17.25V8.56a2.25 2.25 0 0 0-.659-1.591l-3.31-3.31A2.25 2.25 0 0 0 15.44 3H6.75Zm7.5 1.72c.447 0 .876.178 1.193.494l2.343 2.343a.375.375 0 0 1-.265.64H14.25a.75.75 0 0 1-.75-.75V4.72h.75Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {(!inProtocol && (devMode || inDocs)) && (
          <button
            aria-label="Ir a UNER Studio"
            className={toolbarButtonClass}
            onMouseEnter={() => setHoveredHeaderBtn("protocol")}
            onMouseLeave={() => setHoveredHeaderBtn(null)}
            onClick={() => navigate("/protocol", { viewTransition: true })}
            style={getToolbarButtonStyle("protocol")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              className="size-6 transition-transform duration-300 group-hover:scale-110"
            >
              <path
                fillRule="evenodd"
                d="M4.5 5.25A2.25 2.25 0 0 1 6.75 3h10.5A2.25 2.25 0 0 1 19.5 5.25v13.5A2.25 2.25 0 0 1 17.25 21H6.75A2.25 2.25 0 0 1 4.5 18.75V5.25Zm3.9 3.97a.75.75 0 1 0-1.06 1.06L9.06 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06l2.25-2.25a.75.75 0 0 0 0-1.06L8.4 9.22Zm4.35 4.53a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {showSettings && setOpenSettingsModal && (
          <button
            aria-label="Configuración"
            className={toolbarButtonClass}
            onMouseEnter={() => setHoveredHeaderBtn("settings")}
            onMouseLeave={() => setHoveredHeaderBtn(null)}
            onClick={() => setOpenSettingsModal(true)}
            style={getToolbarButtonStyle("settings")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              className="size-6 transition-transform duration-300 group-hover:scale-110"
            >
              <path
                fillRule="evenodd"
                d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {showInfo && setOpenInfoModal && (
          <button
            aria-label="Información"
            className={toolbarButtonClass}
            onMouseEnter={() => setHoveredHeaderBtn("info")}
            onMouseLeave={() => setHoveredHeaderBtn(null)}
            onClick={() => setOpenInfoModal(true)}
            style={getToolbarButtonStyle("info")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              className="size-6 transition-transform duration-300 group-hover:scale-110"
            >
              <path
                fillRule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {showLogout && (
          <button
            aria-label="Cerrar sesion"
            className={`${toolbarButtonClass} text-rose-100 hover:text-white`}
            onClick={logout}
            title="Cerrar sesion"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              className="size-6 transition-transform duration-300 group-hover:scale-110"
            >
              <path
                fillRule="evenodd"
                d="M12.75 3.75a.75.75 0 0 0-1.5 0v8.1a.75.75 0 0 0 1.5 0v-8.1ZM7.23 6.12a.75.75 0 0 0-.96-1.15A8.25 8.25 0 1 0 17.73 4.97a.75.75 0 1 0-.96 1.15 6.75 6.75 0 1 1-9.54 0Z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden text-sm font-semibold sm:inline">
              Salir
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
