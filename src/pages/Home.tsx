// src/pages/Home.tsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useViewTransitionState } from "react-router-dom";
import { useWebSocket } from "../hooks/useWebSocket";
import { useUNERProtocol } from "../hooks/useUnerProtocol";
import { le16, readLe16 } from "../api/UnerProtocolUtils";
import PageHeader from "../components/PageHeader";
import Modal from "../components/modal";

const Home: React.FC = () => {
  const {
    connected,
    heartbeatConfig,
    setHeartbeatInterval,
    setHeartbeatMaxRetries,
    toggleHeartbeatWatchdog,
    onHeartbeatReceived,
  } = useWebSocket();

  const { send, subscribe } = useUNERProtocol();
  const navigate = useNavigate();
  const [on, setOn] = useState(false);
  const [openInfoModal, setOpenInfoModal] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);

  // Refs para el timer del parpadeo
  const blinkIntervalRef = useRef<number | null>(null);

  const CMD_HEARTBEAT = 0xa2;

  // Suscribirse a heartbeats recibidos
  useEffect(() => {
    const off = subscribe(0xa2, (p) => {
      const ms = readLe16(p.payload);
      console.log("[UNER] RX heartbeat:", ms, "ms");

      // Notificar al contexto que se recibió un heartbeat
      onHeartbeatReceived();
    });
    return off;
  }, [subscribe, onHeartbeatReceived]);

  const toControl = useViewTransitionState("/control");

  useEffect(() => {
    if (toControl) console.log("VT → /control activa");
  }, [toControl]);

  // Efecto para el parpadeo del LED
  useEffect(() => {
    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current);
    }

    if (!connected) return; // si no hay conexión → no titila

    setOn(true); // arranca encendido
    blinkIntervalRef.current = setInterval(
      () => setOn((v) => !v),
      heartbeatConfig.intervalMs
    );

    return () => {
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
      }
    };
  }, [connected, heartbeatConfig.intervalMs]);

  // Cleanup cuando se desmonta el componente
  useEffect(() => {
    return () => {
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
      }
    };
  }, []);

  // Manejar envío de heartbeat manual
  const handleSendHeartbeat = async () => {
    await send(CMD_HEARTBEAT, le16(heartbeatConfig.intervalMs)).then(() => {
      // Si el contador está en 0, resetear el watchdog
      if (heartbeatConfig.remainingRetries === 0) {
        onHeartbeatReceived();
      }
    });
  };

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
        <PageHeader
          setOpenSettingsModal={setOpenSettingsModal}
          setOpenInfoModal={setOpenInfoModal}
          titleOverride="Auto Microcontroladores 2025"
        />

        <div className="flex flex-col xl:flex-row justify-evenly items-center w-full max-w-6xl mt-8 gap-6">
          {/* Estado y Watchdog */}
          <div className="flex flex-col items-center gap-4">
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
                  className={`h-[14px] w-[14px] rounded-full shadow transition-colors duration-${
                    heartbeatConfig.intervalMs > 500 ? "500" : "100"
                  } ${
                    connected
                      ? on
                        ? "bg-emerald-400"
                        : "bg-transparent border border-emerald-400"
                      : "bg-rose-400"
                  }`}
                />
                {connected ? "Conectado" : "Desconectado"}
              </span>
            </div>
          </div>

          {/* Configuraciones */}
          {!connected && (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleSendHeartbeat}
                className="refresh-btn group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white transition-all duration-300 hover:text-slate-900 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-6 transition-transform duration-300 group-hover:rotate-180"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.30-.918Z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-xl">Enviar heartbeat</p>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Accesos */}
      <div className="flex flex-col md:flex-row h-3/4 md:h-1/2 w-full md:w-11/12 max-w-6xl items-center justify-between gap-6">
        {/* 1) Estado — cyan → indigo */}
        <button
          className={`group relative w-3/4 md:w-1/3 h-3/5 rounded-2xl transition-all duration-300 ${
            !connected
              ? "!bg-gray-400 !text-slate-900"
              : "estado-btn hover:-translate-y-1 hover:text-slate-900 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          }`}
          onClick={() => navigate("/statics", { viewTransition: true })}
          aria-label="Ir a Estado"
          disabled={!connected}
        >
          <div
            className={`flex flex-col justify-center items-center h-full w-full rounded-2xl
                 bg-transparent text-slate-100 transition-all duration-300 group-hover:text-slate-900 ${
                   connected ? "text-hover-indigo" : "text-hover-gray"
                 }`}
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
          className={`group relative w-3/4 md:w-1/3 h-3/5 rounded-2xl transition-all duration-300 ${
            !connected
              ? "!bg-gray-400 !text-slate-900"
              : "control-btn hover:-translate-y-1 hover:text-slate-900 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          }`}
          onClick={(e) => {
            e.preventDefault();
            navigate("/control", { viewTransition: true });
          }}
          disabled={!connected}
          aria-label="Ir a Control"
        >
          <div
            className={`flex flex-col justify-center items-center h-full w-full rounded-2xl
         bg-transparent text-slate-100 transition-all duration-300 group-hover:text-slate-900 ${
           connected ? "text-hover-indigo" : "text-hover-gray"
         }`}
          >
            <svg
              width="800px"
              height="800px"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              className="size-24 md:size-32 transition-transform duration-300"
              fill="currentColor"
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
          className={`group relative w-3/4 md:w-1/3 h-3/5 rounded-2xl transition-all duration-300 ${
            !connected
              ? "!bg-gray-400 !text-slate-900"
              : "wifi-btn hover:-translate-y-1 hover:text-slate-900 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          }`}
          onClick={() => navigate("/wifi", { viewTransition: true })}
          aria-label="Ir a Wi-Fi"
          disabled={!connected}
        >
          <div
            className={`flex flex-col justify-center items-center h-full w-full rounded-2xl
                 bg-transparent text-slate-100 transition-all duration-300 group-hover:text-slate-900 ${
                   connected ? "text-hover-indigo" : "text-hover-gray"
                 }`}
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
      {openInfoModal && (
        <Modal
          isOpen={openInfoModal}
          onClose={() => setOpenInfoModal(false)}
          closeOnOverlayClick={false}
        >
          <h2 className="text-2xl font-bold mb-4 text-black">
            Pantalla de Inicio
          </h2>
          <p className="mb-3 text-black">
            La pantalla de inicio muestra el estado actual de la conexión con el
            dispositivo y permite enviar el comando <em>heartbeat</em> para
            verificar la comunicación. También indica visualmente si el enlace
            con la placa está activo o no mediante un indicador que titila al
            ritmo configurado.
          </p>
          <p className="text-black">
            Es el punto de partida para acceder al resto de funciones de la
            aplicación.
          </p>
        </Modal>
      )}
      {openSettingsModal && (
        <Modal
          isOpen={openSettingsModal}
          onClose={() => setOpenSettingsModal(false)}
          closeOnOverlayClick={false}
          containerClassnames="flex-col"
        >
          <h2 className="text-2xl font-bold mb-4 text-black">Configuración</h2>
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Watchdog Status */}
            <div className="flex w-full lg:w-1/2 flex-col items-center justify-center gap-2 p-3 rounded-lg bg-slate-600/80 border border-slate-700">
              <div className="flex items-center gap-3">
                <p className="text-sm text-white">Watchdog:</p>
                <button
                  onClick={toggleHeartbeatWatchdog}
                  className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                    heartbeatConfig.isActive
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-slate-600 text-slate-200 hover:bg-slate-900"
                  }`}
                  disabled={!connected}
                >
                  {heartbeatConfig.isActive ? "Activo" : "Inactivo"}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm text-white">Intentos restantes:</p>
                <span
                  className={`font-bold text-lg ${
                    heartbeatConfig.remainingRetries === 0
                      ? "text-red-400"
                      : heartbeatConfig.remainingRetries <= 2
                      ? "text-yellow-400"
                      : "text-green-400"
                  }`}
                >
                  {heartbeatConfig.remainingRetries} de{" "}
                  {heartbeatConfig.maxRetries}
                </span>
              </div>
            </div>
            {/* Sliders de configuración */}
            <div className="flex w-full lg:w-1/2 flex-col gap-4 p-3 items-center justify-center rounded-lg bg-slate-600/80 border-slate-700">
              <div className="flex flex-col">
                <label htmlFor="hb-slider" className="text-sm text-white">
                  {`Intervalo heartbeat (${heartbeatConfig.intervalMs} ms)`}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="hb-slider"
                    type="range"
                    min={50}
                    max={10000}
                    step={50}
                    value={heartbeatConfig.intervalMs}
                    onChange={(e) => {
                      setHeartbeatInterval(Number(e.target.value));
                    }}
                    className="w-56 accent-cyan-400"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label htmlFor="retry-slider" className="text-sm text-white">
                  {`Intentos máximos (${heartbeatConfig.maxRetries})`}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="retry-slider"
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={heartbeatConfig.maxRetries}
                    onChange={(e) =>
                      setHeartbeatMaxRetries(Number(e.target.value))
                    }
                    className="w-56 accent-yellow-400"
                  />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Home;
