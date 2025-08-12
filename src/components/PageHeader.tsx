// src/components/PageHeader.tsx
import { useLocation, useNavigate } from "react-router-dom";

interface PageHeaderProps {
  setOpenSettingsModal?: (open: boolean) => void;
  setOpenInfoModal?: (open: boolean) => void;
  showSettings?: boolean;
  showInfo?: boolean;
  className?: string;
}

const PAGE_TITLES: Record<string, string> = {
  "/control": "Control de Motores",
  "/wifi": "Wifi",
  "/sensors": "Sensores",
  "/bluetooth": "Bluetooth",
  "/home": "Dashboard",
  "/settings": "Configuración",
  // Agrega más rutas según necesites
};

export default function PageHeader({
  setOpenSettingsModal,
  setOpenInfoModal,
  showSettings = true,
  showInfo = true,
  className = "flex flex-row items-center justify-between w-full mb-6",
}: PageHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Obtener el título basado en la ruta actual
  const getPageTitle = () => {
    const path = location.pathname;
    return PAGE_TITLES[path] || "Aplicación";
  };

  return (
    <div className={className}>
      <h1 className="ml-6 text-4xl md:text-6xl font-extrabold uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400 bg-[length:200%_100%] motion-safe:animate-[gradient-move_6s_linear_infinite]">
        {getPageTitle()}
      </h1>

      <div className="flex flex-row gap-2">
        <button
          aria-label="Ir a Home"
          className="toolbar-btn group flex items-center justify-center py-2 px-3 rounded-2xl transition-all duration-300 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          onClick={() => navigate("/home", { viewTransition: true })}
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

        {showSettings && setOpenSettingsModal && (
          <button
            aria-label="Configuración"
            className="toolbar-btn group flex items-center justify-center py-2 px-3 rounded-2xl transition-all duration-300 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            onClick={() => setOpenSettingsModal(true)}
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
            className="toolbar-btn group flex items-center justify-center py-2 px-3 rounded-2xl transition-all duration-300 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            onClick={() => setOpenInfoModal(true)}
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
      </div>
    </div>
  );
}
