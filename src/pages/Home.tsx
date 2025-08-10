// src/pages/Home.tsx
import React from "react";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useNavigate } from "react-router-dom";

const Home: React.FC = () => {
  const { connected } = useWebSocket();
  const navigate = useNavigate();

  return (
    <div
      className="flex flex-col h-full w-full items-center p-6 relative
                 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100
                 selection:bg-cyan-500/30"
    >
      <style>{`
        @keyframes gradient-move {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes border-move {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col h-1/3 w-full items-center justify-center p-4">
        <p
          className="text-4xl md:text-6xl font-extrabold uppercase tracking-tight
                     bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400
                     bg-[length:200%_100%] motion-safe:animate-[gradient-move_6s_linear_infinite]
                     drop-shadow-sm"
        >
          Auto Microcontroladores 2025
        </p>

        <div className="flex flex-row justify-evenly items-center w-full max-w-4xl mt-8">
          {/* Estado */}
          <div className="flex flex-row items-center gap-3">
            <p className="text-lg md:text-xl font-semibold text-slate-200">
              Estado:
            </p>
            <span
              aria-live="polite"
              className={`inline-flex items-center gap-2 text-lg md:text-xl font-bold
                          ${connected ? "text-emerald-400" : "text-rose-400"}`}
            >
              <span
                className={`h-[14px] w-[14px] rounded-full shadow
                            ${
                              connected
                                ? "bg-emerald-400 animate-pulse"
                                : "bg-rose-400"
                            }`}
              />
              {connected ? "Conectado" : "Desconectado"}
            </span>
          </div>

          {/* Refrescar (gradiente interior → hover: borde gradiente + interior blanco) */}
          <button className="refresh-btn group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white transition-all duration-300 hover:text-slate-900 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-6 transition-transform duration-300 group-hover:rotate-180"
            >
              <path
                fill-rule="evenodd"
                d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z"
                clip-rule="evenodd"
              />
            </svg>
            <p className="text-xl">Refrescar</p>
          </button>
        </div>
      </div>

      {/* Accesos */}
      <div className="flex flex-row h-1/2 w-11/12 max-w-6xl items-center justify-between gap-6">
        {/* 1) Estado — cyan → indigo */}
        <button
          className="estado-btn group relative w-1/4 h-3/5 rounded-2xl
               transition-all duration-300 hover:-translate-y-1 hover:text-slate-900
               hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')]
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40
               "
          onClick={() => navigate("/statics")}
          aria-label="Ir a Estado"
        >
          <div
            className="flex flex-col justify-center items-center h-full w-full rounded-2xl
                 bg-transparent text-slate-100 transition-all duration-300 group-hover:text-slate-900 text-hover-indigo"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-24 md:size-32 transition-transform duration-300 group-hover:rotate-12"
            >
              <path
                fillRule="evenodd"
                d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm14.25 6a.75.75 0 0 1-.22.53l-2.25 2.25a.75.75 0 1 1-1.06-1.06L15.44 12l-1.72-1.72a.75.75 0 1 1 1.06-1.06l2.25 2.25c.141.14.22.331.22.53Zm-10.28-.53a.75.75 0 0 0 0 1.06l2.25 2.25a.75.75 0 1 0 1.06-1.06L8.56 12l1.72-1.72a.75.75 0 1 0-1.06-1.06l-2.25 2.25Z"
                clipRule="evenodd"
              />
            </svg>
            <p className="-mt-2 text-2xl md:text-2xl font-extrabold uppercase">
              Estado
            </p>
          </div>
        </button>

        {/* 2) Control — indigo → fuchsia */}
        <button
          className="control-btn group relative w-1/4 h-3/5 rounded-2xl
               transition-all duration-300 hover:-translate-y-1 hover:text-slate-900
               hover:shadow-[inset_0_0_0_2px_theme('colors.indigo.400')]
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
          onClick={() => navigate("/control")}
          aria-label="Ir a Control"
        >
          <div
            className="flex flex-col justify-center items-center h-full w-full rounded-2xl
                 bg-transparent text-slate-100 transition-all duration-300 group-hover:text-slate-900 text-hover-indigo fill-white hover:fill-indigo-500"
          >
            <svg
              width="800px"
              height="800px"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              className="size-24 md:size-32 transition-transform duration-300 "
            >
              <path d="M19.444 9.361c-.882-4.926-2.854-6.379-3.903-6.379-1.637 0-2.057 1.217-5.541 1.258-3.484-.041-3.904-1.258-5.541-1.258-1.049 0-3.022 1.453-3.904 6.379-.503 2.812-1.049 7.01.252 7.514 1.619.627 2.168-.941 3.946-2.266C6.558 13.266 7.424 12.95 10 12.95s3.442.316 5.247 1.659c1.778 1.324 2.327 2.893 3.946 2.266 1.301-.504.755-4.701.251-7.514zM6 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm7 0a1 1 0 1 1 0-2 1 1 0 1 1 0 2zm2-2a1 1 0 1 1 0-2 1 1 0 1 1 0 2z" />
            </svg>
            <p className="-mt-2 text-2xl md:text-2xl font-extrabold uppercase">
              Control
            </p>
          </div>
        </button>

        {/* 3) Wi-Fi — fuchsia → teal */}
        <button
          className="wifi-btn group relative w-1/4 h-3/5 rounded-2xl
               transition-all duration-300 hover:-translate-y-1 hover:text-slate-900
               hover:shadow-[inset_0_0_0_2px_theme('colors.fuchsia.400')]
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/40
               text-slate-hovered"
          onClick={() => navigate("/wifi")}
          aria-label="Ir a Wi-Fi"
        >
          <div
            className="flex flex-col justify-center items-center h-full w-full rounded-2xl
                 bg-transparent text-slate-100 transition-all duration-300 group-hover:text-slate-900 text-hover-indigo"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-24 md:size-32 transition-transform duration-300 group-hover:-rotate-12"
            >
              <path
                fillRule="evenodd"
                d="M1.371 8.143c5.858-5.857 15.356-5.857 21.213 0a.75.75 0 0 1 0 1.061l-.53.53a.75.75 0 0 1-1.06 0c-4.98-4.979-13.053-4.979-18.032 0a.75.75 0 0 1-1.06 0l-.53-.53a.75.75 0 0 1 0-1.06Zm3.182 3.182c4.1-4.1 10.749-4.1 14.85 0a.75.75 0 0 1 0 1.061l-.53.53a.75.75 0 0 1-1.062 0 8.25 8.25 0 0 0-11.667 0 .75.75 0 0 1-1.06 0l-.53-.53a.75.75 0 0 1 0-1.06Zm3.204 3.182a6 6 0 0 1 8.486 0 .75.75 0 0 1 0 1.061l-.53.53a.75.75 0 0 1-1.061 0 3.75 3.75 0 0 0-5.304 0 .75.75 0 0 1-1.06 0l-.53-.53a.75.75 0 0 1 0-1.06Zm3.182 3.182a1.5 1.5 0 0 1 2.122 0 .75.75 0 0 1 0 1.061l-.53.53a.75.75 0 0 1-1.061 0l-.53-.53a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
            <p className="-mt-2 text-2xl md:text-2xl font-extrabold uppercase">
              Wifi
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default Home;
