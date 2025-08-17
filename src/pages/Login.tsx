import React, { useRef, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

export default function Login() {
  const { send } = useWebSocket();
  const [valid, isValid] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function onInputChange(_event: React.ChangeEvent<HTMLInputElement>) {
    const username = userRef.current?.value || "";
    const password = passwordRef.current?.value || "";
    // password debe tener al menos 4 caracteres y username al menos 4 también
    isValid(username.length >= 4 && password.length >= 4);
  }

  function sendLoginAttempt() {
    const username = (document.getElementById("username") as HTMLInputElement)
      .value;
    const password = (document.getElementById("password") as HTMLInputElement)
      .value;
    send("login_attempt", { username, password });
    console.log("Intento de inicio de sesión enviado:", { username, password });
  }

  return (
    <div
      className="flex flex-col h-full w-full items-center justify-center p-6 relative
                    bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100
                    selection:bg-cyan-500/30"
    >
      <div className="flex flex-col items-center justify-center w-full max-w-md ">
        {/* Card */}
        <div className="w-full rounded-2xl bg-white/5 backdrop-blur ring-1 ring-white/10 shadow-sm">
          <div className="w-full flex flex-col items-center justify-center">
            {/* SVG con el mismo gradiente animado que el título */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="size-24 mt-6 mb-1 drop-shadow-sm"
              aria-hidden="true"
            >
              <defs>
                {/* Gradiente animado (cyan → indigo → fuchsia) */}
                <linearGradient
                  id="titleGradient"
                  x1="-100%"
                  x2="0%"
                  y1="0%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#67e8f9" /> {/* cyan-300 */}
                  <stop offset="50%" stopColor="#818cf8" /> {/* indigo-400 */}
                  <stop offset="100%" stopColor="#e879f9" /> {/* fuchsia-400 */}
                  <animate
                    attributeName="x1"
                    values="-100%;0%;-100%"
                    dur="6s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="x2"
                    values="0%;100%;0%"
                    dur="6s"
                    repeatCount="indefinite"
                  />
                </linearGradient>
              </defs>
              <path
                fill="url(#titleGradient)"
                fillRule="evenodd"
                d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
                clipRule="evenodd"
              />
            </svg>

            {/* Título con el gradiente animado existente */}
            <h1 className="text-3xl font-extrabold uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400 bg-[length:200%_100%] motion-safe:animate-[gradient-move_6s_linear_infinite] drop-shadow-sm">
              Iniciar sesión
            </h1>
          </div>
          <div className="p-6 sm:p-8 space-y-6">
            <form className="space-y-5" action="#">
              {/* Usuario */}
              <div className="flex flex-col">
                <label
                  htmlFor="username"
                  className="mb-2 text-sm font-medium text-slate-200"
                >
                  Usuario
                </label>
                <input
                  type="text"
                  name="username"
                  id="username"
                  placeholder="Ingrese su usuario"
                  onChange={onInputChange}
                  ref={userRef}
                  className="w-full rounded-xl bg-white/10 text-slate-100 placeholder-slate-400
                             ring-1 ring-white/10 p-2.5 transition duration-300
                             focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </div>

              {/* Contraseña */}
              <div className="flex flex-col">
                <label
                  htmlFor="password"
                  className="mb-2 text-sm font-medium text-slate-200"
                >
                  Contraseña
                </label>
                <input
                  type="password"
                  name="password"
                  id="password"
                  placeholder="••••••••"
                  onChange={onInputChange}
                  ref={passwordRef}
                  className="w-full rounded-xl bg-white/10 text-slate-100 placeholder-slate-400
                             ring-1 ring-white/10 p-2.5 transition duration-300
                             focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </div>

              {/* Enlaces/acciones */}
              <div className="flex items-center justify-between">
                <a
                  href="#"
                  className="text-sm text-indigo-300 hover:text-white underline underline-offset-4 transition-colors duration-300"
                >
                  ¿Olvidó su contraseña?
                </a>
              </div>

              {/* Botón principal (usa guía: btn-indigo) */}
              <button
                type="button"
                onClick={sendLoginAttempt}
                disabled={!valid}
                className="btn-indigo group relative inline-flex w-full items-center justify-center gap-2
                           rounded-2xl px-4 py-2 font-semibold text-white
                           transition-all duration-300 hover:text-slate-900
                           hover:shadow-[inset_0_0_0_2px_theme('colors.indigo.400')]
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40
                           disabled:opacity-50 disabled:cursor-not-allowed estado-btn"
              >
                Iniciar sesión
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
