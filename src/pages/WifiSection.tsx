import React, { useEffect, useRef, useState } from 'react'
import { useWebSocket } from '../contexts/WebSocketContext';
import { useMockFirmware } from '../hooks/useMockFirmware';
import ToggleButton from '../components/toggleButton';
import Modal from '../components/modal';
import type { WifiMode } from '../types/WifiTypes';
import { useNavigate } from 'react-router-dom';

export default function WifiSection() {
const { send, subscribe, connected } = useWebSocket();
const navigate = useNavigate();
const [mode, setMode] = useState<WifiMode | null>(null);
const [changesMade, setChangesMade] = useState(false);
const [fixedIPStation, setFixedIPStation] = useState(false);

// --- AP state ---
const [apSsid, setApSsid] = useState("");
const [apPass, setApPass] = useState("");
const [apIP, setApIP] = useState("192.168.1.1");

// --- STATION state (editable form) ---
const [stationSsid, setStationSsid] = useState("");
const [stationPass, setStationPass] = useState("");
const [stationIP, setStationIP] = useState("");

const [seePass, setSeePass] = useState(false);

const [openInfoModal, setOpenInfoModal] = useState(false);
const [openSettingsModal, setOpenSettingsModal] = useState(false);

// Refs para "linkear" inputs (STATION)
const stationSsidRef = useRef<HTMLInputElement>(null);
const stationPassRef = useRef<HTMLInputElement>(null);
const stationIpRef = useRef<HTMLInputElement>(null);

// Defaults iniciales obtenidos al principio (para Restablecer)
const stationDefaultsRef = useRef<{
  ssid: string;
  ip: string;
  password: string;
} | null>(null);

const [valid, setValid] = useState(false);

// Mockea que la placa está en STATION
useMockFirmware("STATION", 300);

// Datos simulados para STATION (valores iniciales del dispositivo)
const initialStationInfo = {
  ssid: "Home_Network",
  ip: "192.168.1.100",
  password: "password123",
};

// Redes disponibles (mock)
const availableNetworks = [
  "Office_WiFi",
  "CoffeeShop_Guest",
  "Home_Network",
  "Neighbor_WiFi",
  "Public_Hotspot",
];

// Conexión y suscripciones
useEffect(() => {
  if (!connected) return;

  const offMode = subscribe("wifiModeResponse", ({ mode }) => {
    setMode(mode);
  });

  // (Si más adelante recibes 'available-wifi-response', aquí suscribes y setearías el listado real)

  send("get-wifi-mode");
  send("get-available-wifi");

  return () => {
    offMode();
  };
}, [connected, send, subscribe]);

// Inicializa los defaults y el formulario STATION cuando el modo cambia a STATION
useEffect(() => {
  if (mode !== "STATION") return;

  // Guarda defaults una sola vez
  if (!stationDefaultsRef.current) {
    stationDefaultsRef.current = { ...initialStationInfo };
  }

  // Carga defaults al formulario (refs + state)
  const d = stationDefaultsRef.current;
  if (d) {
    setStationSsid(d.ssid);
    setStationPass(d.password);
    setStationIP(d.ip);

    if (stationSsidRef.current) stationSsidRef.current.value = d.ssid;
    if (stationPassRef.current) stationPassRef.current.value = d.password;
    if (stationIpRef.current) stationIpRef.current.value = d.ip;
  }
  setChangesMade(false);
}, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

// Validación AP
useEffect(() => {
  if (mode === "AP") {
    setValid(apSsid.length >= 4 && apPass.length >= 4);
  }
}, [mode, apSsid, apPass]);

// Validación STATION
useEffect(() => {
  if (mode === "STATION") {
    setValid(stationSsid.length >= 1 && stationPass.length >= 4);
  }
}, [mode, stationSsid, stationPass]);

// Restablecer credenciales a los valores iniciales
function resetCredentials() {
  if (mode === "AP") {
    setApSsid("");
    setApPass("");
    setApIP("192.168.1.1");
  } else {
    const d = stationDefaultsRef.current ?? initialStationInfo;
    setStationSsid(d.ssid);
    setStationPass(d.password);
    setStationIP(d.ip);

    if (stationSsidRef.current) stationSsidRef.current.value = d.ssid;
    if (stationPassRef.current) stationPassRef.current.value = d.password;
    if (stationIpRef.current) stationIpRef.current.value = d.ip;
  }
  setChangesMade(false);
  console.log("Credenciales restablecidas a valores iniciales");
}

// Enviar credenciales según modo
function sendCredentials() {
  if (mode === "AP") {
    send("set-ap-credentials", { ssid: apSsid, password: apPass, ip: apIP });
  } else {
    send("set-station-credentials", {
      ssid: stationSsid,
      password: stationPass,
      fixedIp: fixedIPStation,
      ip: stationIP,
    });
  }
  setChangesMade(false);
  console.log("Credenciales enviadas:", {
    mode,
    ssid: mode === "AP" ? apSsid : stationSsid,
    password: mode === "AP" ? apPass : stationPass,
    ip: apIP,
  });
}

// Click en red disponible:
// - Copia SSID al input (via ref)
// - Blanquea password (via ref)
// - Actualiza estado
// - Habilita botones (changesMade)
function handleSelectNetwork(net: string) {
  if (stationSsidRef.current) stationSsidRef.current.value = net;
  if (stationPassRef.current) stationPassRef.current.value = "";

  setStationSsid(net);
  setStationPass("");
  setChangesMade(true);

  // Focus en contraseña para que el usuario la complete
  stationPassRef.current?.focus();
}

// Refrescar redes disponibles
function refreshNetworks() {
  send("get-available-wifi");
  console.log("Redes disponibles actualizadas");
}

if (mode === null) {
  return (
    <div className="flex flex-col h-full w-full items-center justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="size-24 mb-0 animate-pulse text-white"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z"
        />
      </svg>
      <p className="text-white text-2xl">Consultando modo Wi-Fi</p>
    </div>
  );
}

return (
  <div className="flex flex-col h-full w-full items-center justify-center p-4 space-y-6 bg-gray-300 relative">
    <div className="flex flex-row space-x-2 absolute top-6 right-8">
      <button
        className="flex items-center justify-center p-2 rounded-full bg- text-white hover:bg-gray-700 transition-colors"
        onClick={() => navigate("/home")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
          />
        </svg>
      </button>
      <button
        className="flex items-center justify-center p-2 rounded-full bg- text-white hover:bg-gray-700 transition-colors"
        onClick={() => setOpenSettingsModal(true)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </svg>
      </button>
      <button
        className="flex items-center justify-center p-2 rounded-full bg- text-white hover:bg-gray-700 transition-colors"
        onClick={() => setOpenInfoModal(true)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
          />
        </svg>
      </button>
    </div>
    {mode === "AP" ? (
      <div className="flex flex-col w-full h-full items-center justify-center bg-gray-800 shadow-lg rounded-lg p-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-24 text-white"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5"
          />
        </svg>
        <h1 className="text-2xl font-bold mb-4">Modo AP</h1>

        {/* SSID AP */}
        <div className="flex flex-col justify-start items-start mb-4 w-2/3">
          <label
            htmlFor="ap-ssid"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            SSID
          </label>
          <input
            type="text"
            name="ap-ssid"
            id="ap-ssid"
            className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg
                     focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5
                     dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400
                     dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            placeholder="Nombre de la red AP"
            value={apSsid}
            onChange={(e) => {
              setApSsid(e.target.value);
              setChangesMade(true);
            }}
          />
        </div>

        {/* Pass AP */}
        <div className="flex flex-col justify-start items-start mb-4 w-2/3">
          <label
            htmlFor="ap-password"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Contraseña
          </label>
          <div className="flex flex-col w-full justify-center relative">
            <input
              type={seePass ? "text" : "password"}
              name="ap-password"
              id="ap-password"
              className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg
                     focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5
                     dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400
                     dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              placeholder="Contraseña del AP"
              defaultValue={apPass}
              onChange={(e) => {
                setApPass(e.target.value);
                setChangesMade(true);
              }}
            />
            <button
              className="absolute right-1 outline-none focus:outline-none hover:outline-none hover:border-none"
              onClick={() => {
                setSeePass(!seePass);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex flex-col justify-start items-start mb-4 w-2/3">
          <label
            htmlFor="ap-ip"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            IP de la placa
          </label>
          <input
            ref={stationIpRef}
            type="text"
            name="ap-ip"
            id="ap-ip"
            className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg
                     focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5
                     dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400
                     dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            defaultValue={initialStationInfo.ip}
            onChange={(e) => {
              if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(e.target.value)) {
                return;
              }
              setApIP(e.target.value);
              setChangesMade(true);
            }}
          />
        </div>

        <button
          onClick={sendCredentials}
          className="bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition
            disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          disabled={!valid || !changesMade}
        >
          Guardar configuración
        </button>
      </div>
    ) : (
      <div className="h-full w-full flex flex-col md:flex-row">
        {/* Card de información/edición STATION */}
        <div className="flex flex-col w-full bg-gray-800 shadow-lg rounded-lg justify-center items-center mx-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="size-24 text-white"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z"
            />
          </svg>
          <h1 className="text-2xl font-bold mb-8">Modo STATION</h1>

          {/* SSID (editable, linkeado por ref) */}
          <div className="flex flex-col justify-start items-start mb-4 w-5/6">
            <label
              htmlFor="station-ssid"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              Red actual
            </label>
            <input
              ref={stationSsidRef}
              type="text"
              name="station-ssid"
              id="station-ssid"
              className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg
                     focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5
                     dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400
                     dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              defaultValue={initialStationInfo.ssid}
              onChange={(e) => {
                setStationSsid(e.target.value);
                setChangesMade(true);
              }}
            />
          </div>

          {/* IP (solo lectura pero linkeada por ref para restablecer) */}
          <div className="flex flex-col justify-start items-start mb-4 w-5/6">
            <label
              htmlFor="station-ip"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              IP fija?
            </label>
            <div className="flex flex-row w-full justify-center items-center space-x-6 relative">
              <ToggleButton
                onActivate={() => setFixedIPStation(true)}
                onDeactivate={() => {
                  setFixedIPStation(false);
                  if (stationIpRef.current) {
                    stationIpRef.current.value = initialStationInfo.ip;
                    setStationIP(initialStationInfo.ip);
                    setChangesMade(true);
                  }
                }}
                classNames="ml-4"
              />
              <input
                ref={stationIpRef}
                type="text"
                name="station-ip"
                id="station-ip"
                className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg
                     focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5
                     dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400
                     dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                defaultValue={initialStationInfo.ip}
                readOnly={!fixedIPStation}
                onChange={(e) => {
                  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(e.target.value)) {
                    return;
                  }
                  setStationIP(e.target.value);
                  setChangesMade(true);
                }}
              />
            </div>
          </div>

          {/* Password (editable, linkeado por ref) */}
          <div className="flex flex-col justify-start items-start w-5/6">
            <label
              htmlFor="station-password"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              Contraseña
            </label>
            <div className="flex flex-col w-full justify-center relative">
              <input
                ref={stationPassRef}
                type={seePass ? "text" : "password"}
                name="station-password"
                id="station-password"
                className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg
                     focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5
                     dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400
                     dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                defaultValue={initialStationInfo.password}
                onChange={(e) => {
                  setStationPass(e.target.value);
                  setChangesMade(true);
                }}
              />
              <button
                className="absolute right-1 outline-none focus:outline-none hover:outline-none hover:border-none"
                onClick={() => {
                  setSeePass(!seePass);
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-row justify-evenly items-center w-full mt-6">
            <button
              className="bg-red-800 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={resetCredentials}
              disabled={!changesMade}
            >
              Restablecer
            </button>
            <button
              className="bg-green-800 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={sendCredentials}
              disabled={!valid || !changesMade}
            >
              Enviar cambios
            </button>
          </div>
        </div>

        {/* Card de redes disponibles */}
        <div className="flex flex-col w-full bg-gray-800 shadow-lg rounded-lg justify-center items-center mx-2">
          <div className="flex flex-row items-center justify-between gap-2 mb-4 w-5/6">
            <div className="flex flex-row items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-6 text-white"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-white">
                Redes disponibles
              </h2>
            </div>
          </div>

          <ul className="space-y-2 flex flex-col w-1/2">
            {availableNetworks.map((net) => (
              <li
                key={net}
                className="
                    block w-full
                    bg-gray-50 border border-gray-300
                    text-gray-900 hover:text-white
                    rounded-lg
                    p-2.5
                    focus:outline-none focus:ring-2 focus:ring-primary-600
                    hover:bg-gray-600 hover:border-gray-400
                    cursor-pointer
                    transition
                  "
                onClick={() => handleSelectNetwork(net)}
                title="Seleccionar red (rellena SSID y vacía la contraseña)"
              >
                {net}
              </li>
            ))}
          </ul>
          <div>
            <button
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
              onClick={refreshNetworks}
            >
              Actualizar redes
            </button>
          </div>
        </div>
      </div>
    )}
    {openInfoModal && (
      <Modal isOpen={openInfoModal} onClose={() => setOpenInfoModal(false)}>
        <h2 className="text-2xl font-bold mb-4 text-black">
          Información del Modo Wi-Fi
        </h2>
        <p className="mb-4 text-black">
          El modo AP permite que el dispositivo cree su propia red Wi-Fi a la
          que puedes conectarte directamente. El modo STATION permite que el
          dispositivo se conecte a una red Wi-Fi existente.
        </p>
        <p className="mb-4 text-black">
          En el modo STATION, puedes seleccionar una red disponible y configurar
          sus credenciales. Si seleccionas una red, el SSID se rellenará
          automáticamente y la contraseña quedará vacía para que la ingreses.
        </p>
      </Modal>
    )}
    {openSettingsModal && (
      <Modal
        isOpen={openSettingsModal}
        onClose={() => setOpenSettingsModal(false)}
      >
        <h2 className="text-2xl font-bold mb-4 text-black">Configuracion</h2>
        <div className="flex flex-row space-x-4 text-black w-full items-center justify-center my-4">
          <p className="text-lg">Reiniciar ESP01</p>
          <button
            className="bg-blue-600 text-white px-4 py-1 rounded-md hover:bg-blue-700 transition"
            onClick={() => console.log("Reiniciar ESP01")}
          >
            Ejecutar
          </button>
        </div>
        <div className="flex flex-row space-x-4 text-black w-full items-center justify-center my-4">
          <p className="text-lg">Resetear configuracion</p>
          <button
            className="bg-blue-600 text-white px-4 py-1 rounded-md hover:bg-blue-700 transition"
            onClick={() => console.log("Resetear configuracion")}
          >
            Ejecutar
          </button>
        </div>
      </Modal>
    )}
  </div>
);
}
