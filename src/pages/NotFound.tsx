import React from "react";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      className="flex flex-col h-full w-full items-center justify-center gap-2 p-4 relative
                    bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100
                    selection:bg-cyan-500/30"
    >
      {/* Icono */}
      <div className="rounded-2xl">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-24 text-white/90"
        >
          <path
            fillRule="evenodd"
            d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* Título */}
      <h1
        className="text-4xl md:text-6xl font-extrabold uppercase tracking-tight
                     bg-clip-text text-transparent
                     bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400
                     bg-[length:200%_100%]
                     motion-safe:animate-[gradient-move_6s_linear_infinite]
                     drop-shadow-sm"
      >
        404 · Página no encontrada
      </h1>

      <p className="text-slate-300 text-center max-w-xl">
        La página que buscás no existe, fue movida o el enlace es incorrecto.
      </p>

      {/* Botón Ir al inicio (usa guía: btn-indigo + hover border indigo) */}
      <button
        className="btn-indigo estado-btn group relative inline-flex items-center gap-2 rounded-xl px-5 py-2
                   font-medium text-white transition-all duration-300 hover:text-slate-900
                   hover:shadow-[inset_0_0_0_1px_theme('colors.indigo.400')]
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 mt-14"
        onClick={() => navigate("/home")}
      >
        Ir al inicio
      </button>
    </div>
  );
}
