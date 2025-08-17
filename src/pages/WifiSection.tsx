import { useEffect, useRef, useState } from "react";
import { useMockFirmware } from "../hooks/useMockFirmware";
import ToggleButton from "../components/toggleButton";
import Modal from "../components/modal";
import type { WifiMode } from "../types/WifiTypes";
import PageHeader from "../components/PageHeader";
import { useWebSocket } from "../hooks/useWebSocket";

export default function WifiSection() {
  const { send, subscribe, connected } = useWebSocket();
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
  useMockFirmware("STATION", 1500);

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

  // Click en red disponible
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
      <div className="flex flex-col h-full w-full items-center justify-center p-6 relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100 selection:bg-cyan-500/30">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-24 mb-2 animate-pulse"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z"
          />
        </svg>
        <h1 className="text-4xl md:text-6xl font-extrabold uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400 bg-[length:200%_100%] motion-safe:animate-[gradient-move_6s_linear_infinite] drop-shadow-sm">
          Consultando modo Wi-Fi
        </h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full items-center justify-start p-6 space-y-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100 relative selection:bg-cyan-500/30">
      {/* Acciones superiores */}
      <PageHeader
        setOpenSettingsModal={setOpenSettingsModal}
        setOpenInfoModal={setOpenInfoModal}
      />

      {mode === "AP" ? (
        <div className="flex flex-col w-full h-full items-center justify-start bg-white/5 rounded-2xl ring-1 ring-white/10 shadow-sm backdrop-blur p-6">
          <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400 bg-[length:200%_100%] motion-safe:animate-[gradient-move_6s_linear_infinite] drop-shadow-sm">
            Modo AP
          </h1>

          {/* SSID AP */}
          <div className="flex flex-col justify-start items-start mb-4 w-full max-w-xl">
            <label
              htmlFor="ap-ssid"
              className="mb-2 text-sm font-medium text-slate-200"
            >
              SSID
            </label>
            <input
              type="text"
              name="ap-ssid"
              id="ap-ssid"
              className="w-full rounded-xl bg-white/10 text-slate-100 placeholder-slate-400 ring-1 ring-white/10 p-2.5
                         focus:outline-none focus:ring-2 focus:ring-cyan-400/40 transition duration-300"
              placeholder="Nombre de la red AP"
              value={apSsid}
              onChange={(e) => {
                setApSsid(e.target.value);
                setChangesMade(true);
              }}
            />
          </div>

          {/* Pass AP */}
          <div className="flex flex-col justify-start items-start mb-4 w-full max-w-xl">
            <label
              htmlFor="ap-password"
              className="mb-2 text-sm font-medium text-slate-200"
            >
              Contraseña
            </label>
            <div className="relative w-full">
              <input
                type={seePass ? "text" : "password"}
                name="ap-password"
                id="ap-password"
                className="w-full rounded-xl bg-white/10 text-slate-100 placeholder-slate-400 ring-1 ring-white/10 p-2.5
                           focus:outline-none focus:ring-2 focus:ring-cyan-400/40 transition duration-300"
                placeholder="Contraseña del AP"
                defaultValue={apPass}
                onChange={(e) => {
                  setApPass(e.target.value);
                  setChangesMade(true);
                }}
              />
              <button
                type="button"
                aria-label={
                  seePass ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                className="group absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-xl px-2 py-1
                           font-medium text-white transition-all duration-300 hover:text-slate-900
                           hover:shadow-[inset_0_0_0_1px_theme('colors.slate.400')]
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
                onClick={() => setSeePass(!seePass)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-5 transition-transform duration-300 group-hover:scale-110"
                >
                  <path d="M12 5.25c-5.04 0-9.06 3.33-10.29 6.45a1.25 1.25 0 0 0 0 .6C2.94 15.43 6.96 18.75 12 18.75s9.06-3.33 10.29-6.45c.08-.2.08-.41 0-.6C21.06 8.58 17.04 5.25 12 5.25Zm0 11.25a5.25 5.25 0 1 1 0-10.5 5.25 5.25 0 0 1 0 10.5Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* IP AP */}
          <div className="flex flex-col justify-start items-start mb-4 w-full max-w-xl">
            <label
              htmlFor="ap-ip"
              className="mb-2 text-sm font-medium text-slate-200"
            >
              IP de la placa
            </label>
            <input
              ref={stationIpRef}
              type="text"
              name="ap-ip"
              id="ap-ip"
              className="w-full rounded-xl bg-white/10 text-slate-100 placeholder-slate-400 ring-1 ring-white/10 p-2.5
                         focus:outline-none focus:ring-2 focus:ring-cyan-400/40 transition duration-300"
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
            disabled={!valid || !changesMade}
            className="btn-success group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white
                       transition-all duration-300 hover:text-slate-900
                       hover:shadow-[inset_0_0_0_2px_theme('colors.emerald.400')]
                       disabled:opacity-50 disabled:cursor-not-allowed mt-4
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
          >
            Guardar configuración
          </button>
        </div>
      ) : (
        <div className="h-full w-3/4 flex flex-col lg:flex-row lg:w-full gap-4 items-center justify-center">
          {/* Card STATION */}
          <div className="flex flex-col w-full h-3/4 bg-white/5 rounded-2xl ring-1 ring-white/10 shadow-sm backdrop-blur justify-center items-center p-6">
            <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400 bg-[length:200%_100%] motion-safe:animate-[gradient-move_6s_linear_infinite] drop-shadow-sm">
              Modo STATION
            </h1>

            {/* SSID */}
            <div className="flex flex-col justify-start items-start mb-4 w-full max-w-xl">
              <label
                htmlFor="station-ssid"
                className="mb-2 text-sm font-medium text-slate-200"
              >
                Red actual
              </label>
              <input
                ref={stationSsidRef}
                type="text"
                name="station-ssid"
                id="station-ssid"
                className="w-full rounded-xl bg-white/10 text-slate-100 placeholder-slate-400 ring-1 ring-white/10 p-2.5
                           focus:outline-none focus:ring-2 focus:ring-cyan-400/40 transition duration-300"
                defaultValue={initialStationInfo.ssid}
                onChange={(e) => {
                  setStationSsid(e.target.value);
                  setChangesMade(true);
                }}
              />
            </div>

            {/* IP fija toggle + IP */}
            <div className="flex flex-col justify-start items-start mb-4 w-full max-w-xl">
              <label
                htmlFor="station-ip"
                className="mb-2 text-sm font-medium text-slate-200"
              >
                IP fija?
              </label>
              <div className="flex flex-row w-full items-center gap-4">
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
                />
                <input
                  ref={stationIpRef}
                  type="text"
                  name="station-ip"
                  id="station-ip"
                  className={`flex-1 rounded-xl bg-white/10 text-slate-100 placeholder-slate-400 ring-1 ring-white/10 p-2.5
                             focus:outline-none focus:ring-2 focus:ring-cyan-400/40 transition duration-300
                             disabled:opacity-50 ${
                               fixedIPStation ? "" : "input-disabled"
                             }`}
                  defaultValue={
                    fixedIPStation ? initialStationInfo.ip : "Asignada por DHCP"
                  }
                  value={fixedIPStation ? stationIP : "Asignada por DHCP"}
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

            {/* Password */}
            <div className="flex flex-col justify-start items-start w-full max-w-xl">
              <label
                htmlFor="station-password"
                className="mb-2 text-sm font-medium text-slate-200"
              >
                Contraseña
              </label>
              <div className="relative w-full">
                <input
                  ref={stationPassRef}
                  type={seePass ? "text" : "password"}
                  name="station-password"
                  id="station-password"
                  className="w-full rounded-xl bg-white/10 text-slate-100 placeholder-slate-400 ring-1 ring-white/10 p-2.5
                             focus:outline-none focus:ring-2 focus:ring-cyan-400/40 transition duration-300"
                  defaultValue={initialStationInfo.password}
                  onChange={(e) => {
                    setStationPass(e.target.value);
                    setChangesMade(true);
                  }}
                />
                <button
                  type="button"
                  aria-label={
                    seePass ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  className="group absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-xl px-2 py-1
                             font-medium text-white transition-all duration-300 hover:text-slate-900
                             hover:shadow-[inset_0_0_0_1px_theme('colors.slate.400')]
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
                  onClick={() => setSeePass(!seePass)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-5 transition-transform duration-300 group-hover:scale-110"
                  >
                    <path d="M12 5.25c-5.04 0-9.06 3.33-10.29 6.45a1.25 1.25 0 0 0 0 .6C2.94 15.43 6.96 18.75 12 18.75s9.06-3.33 10.29-6.45c.08-.2.08-.41 0-.6C21.06 8.58 17.04 5.25 12 5.25Zm0 11.25a5.25 5.25 0 1 1 0-10.5 5.25 5.25 0 0 1 0 10.5Z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex flex-row justify-evenly items-center w-full max-w-xl mt-6 gap-4">
              <button
                className="btn-danger group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white
                           transition-all duration-300 hover:text-slate-900
                           hover:shadow-[inset_0_0_0_2px_theme('colors.white')]
                           disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-400"
                onClick={resetCredentials}
                disabled={!changesMade}
              >
                Restablecer
              </button>
              <button
                className="btn-success group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white
                           transition-all duration-300
                           hover:shadow-[inset_0_0_0_2px_theme('colors.white')]
                           hover:bg-emerald-400
                           hover:text-slate-900
                           disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={sendCredentials}
                disabled={!valid || !changesMade}
              >
                Enviar cambios
              </button>
            </div>
          </div>

          {/* Card Redes disponibles */}
          <div className="flex flex-col w-full h-3/4 bg-white/5 rounded-2xl ring-1 ring-white/10 shadow-sm backdrop-blur justify-center items-center p-6">
            <div className="flex flex-row items-center justify-between gap-2 mb-6 w-full max-w-xl">
              <div className="flex flex-row items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  className="size-6 text-slate-200"
                >
                  <path d="M21 20.25a.75.75 0 0 1-1.06 0l-4.72-4.72a7.5 7.5 0 1 1 1.06-1.06l4.72 4.72a.75.75 0 0 1 0 1.06ZM4.5 10.5a6 6 0 1 0 12 0 6 6 0 0 0-12 0Z" />
                </svg>
                <h2 className="text-xl font-semibold">Redes disponibles</h2>
              </div>

              <button
                className="refresh-btn group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white
                           transition-all duration-300 hover:text-slate-900
                           hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')]
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                onClick={refreshNetworks}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-5 transition-transform duration-300 group-hover:rotate-180"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z"
                    clipRule="evenodd"
                  />
                </svg>
                Actualizar redes
              </button>
            </div>

            <ul className="space-y-2 w-full max-w-xl">
              {availableNetworks.map((net) => (
                <li
                  key={net}
                  className="w-full cursor-pointer rounded-xl px-3 py-2
                             bg-white/10 text-slate-100 ring-1 ring-white/10
                             transition-all duration-300
                             hover:bg-white hover:text-slate-900
                             hover:shadow-[inset_0_0_0_1px_theme('colors.cyan.400')]"
                  onClick={() => handleSelectNetwork(net)}
                  title="Seleccionar red (rellena SSID y vacía la contraseña)"
                >
                  {net}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {openInfoModal && (
        <Modal
          isOpen={openInfoModal}
          onClose={() => setOpenInfoModal(false)}
          closeOnOverlayClick={false}
        >
          <h2 className="text-2xl font-bold mb-4 text-black">
            Información del Modo Wi-Fi
          </h2>
          <p className="mb-3 text-black">
            El modo AP permite que el dispositivo cree su propia red Wi-Fi a la
            que puedes conectarte directamente. El modo STATION permite que el
            dispositivo se conecte a una red Wi-Fi existente.
          </p>
          <p className="text-black">
            En el modo STATION, puedes seleccionar una red disponible y
            configurar sus credenciales. Si seleccionas una red, el SSID se
            rellenará automáticamente y la contraseña quedará vacía para que la
            ingreses.
          </p>
        </Modal>
      )}

      {openSettingsModal && (
        <Modal
          isOpen={openSettingsModal}
          onClose={() => setOpenSettingsModal(false)}
          closeOnOverlayClick={false}
        >
          <h2 className="text-2xl font-bold mb-4 text-black">Configuración</h2>

          <div className="flex flex-row gap-4 text-black w-full items-center justify-center my-4">
            <p className="text-lg">Reiniciar ESP01</p>
            <button
              className="btn-indigo group relative inline-flex items-center gap-2 rounded-xl px-3 py-2 font-medium text-white
                         transition-all duration-300 hover:text-slate-900
                         hover:shadow-[inset_0_0_0_1px_theme('colors.indigo.400')]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 estado-btn px-5"
              onClick={() => console.log("Reiniciar ESP01")}
            >
              Enviar
            </button>
          </div>

          <div className="flex flex-row gap-4 text-black w-full items-center justify-center my-4">
            <p className="text-lg">Resetear configuración</p>
            <button
              className="btn-danger group relative inline-flex items-center gap-2 rounded-xl py-2 font-medium text-white
                         transition-all duration-300 hover:text-slate-900
                         hover:shadow-[inset_0_0_0_1px_theme('colors.red.400')]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 estado-btn px-5"
              onClick={() => console.log("Resetear configuracion")}
            >
              Enviar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
