import { useCallback, useEffect, useMemo, useState } from "react";
import ToggleButton from "../components/toggleButton";
import Modal from "../components/modal";
import type { WifiMode } from "../types/WifiTypes";
import PageHeader from "../components/PageHeader";
import { useWebSocket } from "../hooks/useWebSocket";
import { useUNERProtocol } from "../hooks/useUnerProtocol";
import { UNERProtocol } from "../api/UnerProtocol";
import {
  CMD,
  PayloadBuilder,
  ipStringToBytes,
  isValidIPv4String,
} from "../types/UnerProtocolCMDTypes";

type StationInfo = {
  ssid: string;
  ip: string;
  password: string;
  fixedIp: boolean;
};

type AvailableNetwork = {
  ssid: string;
  rssi: number;
  security: number;
};

const DEFAULT_AP_IP = "192.168.4.1";
const DHCP_IP = "0.0.0.0";
const MOCK_NETWORKS: AvailableNetwork[] = [
  { ssid: "Home_Network", rssi: -45, security: 3 },
  { ssid: "Office_WiFi", rssi: -61, security: 4 },
  { ssid: "CoffeeShop_Guest", rssi: -72, security: 0 },
  { ssid: "Neighbor_WiFi", rssi: -81, security: 3 },
];

function securityLabel(security: number) {
  if (security === 0) return "Abierta";
  if (security === 1) return "WEP";
  if (security === 3) return "WPA/WPA2";
  if (security === 4) return "WPA2/WPA3";
  return "Desconocida";
}

function buildScanListPayload(networks: AvailableNetwork[]) {
  const encodedNetworks = networks.map((network) => {
    const ssidBytes = new TextEncoder().encode(network.ssid);
    const payload = new Uint8Array(1 + ssidBytes.length + 1 + 1);
    let offset = 0;

    payload[offset++] = ssidBytes.length;
    payload.set(ssidBytes, offset);
    offset += ssidBytes.length;
    payload[offset++] = network.rssi < 0 ? 256 + network.rssi : network.rssi;
    payload[offset] = network.security;

    return payload;
  });

  const totalLength =
    1 + encodedNetworks.reduce((sum, network) => sum + network.length, 0);
  const payload = new Uint8Array(totalLength);
  let offset = 0;

  payload[offset++] = encodedNetworks.length;
  for (const network of encodedNetworks) {
    payload.set(network, offset);
    offset += network.length;
  }

  return payload;
}

function decodeScanListPayload(payload: Uint8Array): AvailableNetwork[] {
  if (payload.length < 1) {
    return [];
  }

  const networks: AvailableNetwork[] = [];
  const count = payload[0];
  let offset = 1;

  for (let index = 0; index < count && offset < payload.length; index++) {
    const ssidLen = payload[offset++];
    if (offset + ssidLen + 2 > payload.length) {
      break;
    }

    const ssidBytes = payload.slice(offset, offset + ssidLen);
    const ssid = new TextDecoder().decode(ssidBytes);
    offset += ssidLen;

    const rawRssi = payload[offset++];
    const rssi = rawRssi > 127 ? rawRssi - 256 : rawRssi;
    const security = payload[offset++];

    networks.push({ ssid, rssi, security });
  }

  return networks;
}

function buildAckPayload(cmdRef: number, code = 0) {
  return new Uint8Array([cmdRef & 0xff, code & 0xff]);
}

export default function WifiSection() {
  const { connected, mockMode, mockRaw } = useWebSocket();
  const { send, subscribe } = useUNERProtocol();
  const protocol = useMemo(() => new UNERProtocol(), []);

  const [mode, setMode] = useState<WifiMode | null>(null);
  const [changesMade, setChangesMade] = useState(false);
  const [fixedIPStation, setFixedIPStation] = useState(false);
  const [apSsid, setApSsid] = useState("");
  const [apPass, setApPass] = useState("");
  const [apIP, setApIP] = useState(DEFAULT_AP_IP);
  const [stationSsid, setStationSsid] = useState("");
  const [stationPass, setStationPass] = useState("");
  const [stationIP, setStationIP] = useState(DHCP_IP);
  const [seePass, setSeePass] = useState(false);
  const [openInfoModal, setOpenInfoModal] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [valid, setValid] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [stationDefaults, setStationDefaults] = useState<StationInfo | null>(
    null
  );
  const [apDefaults, setApDefaults] = useState<{
    ssid: string;
    password: string;
    ip: string;
  } | null>(null);
  const [availableNetworks, setAvailableNetworks] = useState<AvailableNetwork[]>(
    []
  );

  const emitMockPacket = useCallback((
    cmd: number,
    payload?: Uint8Array,
    delayMs = 120
  ) => {
    window.setTimeout(() => {
      mockRaw(protocol.buildPacket(cmd, payload));
    }, delayMs);
  }, [mockRaw, protocol]);

  const requestScan = useCallback(() => {
    void send(CMD.WIFI_GET_SCAN);

    if (mockMode) {
      emitMockPacket(CMD.WIFI_SCAN_LIST, buildScanListPayload(MOCK_NETWORKS), 180);
    }
  }, [emitMockPacket, mockMode, send]);

  useEffect(() => {
    const offMode = subscribe(CMD.WIFI_MODE, (packet) => {
      const nextMode = packet.payload[0] === 0 ? "AP" : "STATION";
      setMode(nextMode);
      requestScan();
    });

    const offScanList = subscribe(CMD.WIFI_SCAN_LIST, (packet) => {
      setAvailableNetworks(decodeScanListPayload(packet.payload));
    });

    const offAck = subscribe(CMD.WIFI_ACK, (packet) => {
      const cmdRef = packet.payload[0];
      const code = packet.payload[1] ?? 0;
      const ok = code === 0;

      if (ok) {
        setStatusMessage(`ACK recibido para 0x${cmdRef.toString(16).toUpperCase()}.`);
        setChangesMade(false);
      } else {
        setStatusMessage(
          `ACK con error ${code} para 0x${cmdRef.toString(16).toUpperCase()}.`
        );
      }
    });

    return () => {
      offMode();
      offScanList();
      offAck();
    };
  }, [requestScan, subscribe]);

  useEffect(() => {
    if (!connected) {
      return;
    }

    void send(CMD.WIFI_GET_MODE);

    if (mockMode) {
      const mockStation: StationInfo = {
        ssid: "Home_Network",
        password: "password123",
        ip: DHCP_IP,
        fixedIp: false,
      };

      setStationDefaults(mockStation);
      setStationSsid(mockStation.ssid);
      setStationPass(mockStation.password);
      setStationIP(mockStation.ip);
      setFixedIPStation(mockStation.fixedIp);

      const nextApDefaults = {
        ssid: "AutoMicro_AP",
        password: "12345678",
        ip: DEFAULT_AP_IP,
      };

      setApDefaults(nextApDefaults);
      setApSsid(nextApDefaults.ssid);
      setApPass(nextApDefaults.password);
      setApIP(nextApDefaults.ip);

      emitMockPacket(CMD.WIFI_MODE, new Uint8Array([1]), 120);
    }
  }, [connected, mockMode, protocol, send]);

  useEffect(() => {
    if (mode === "AP") {
      const ssidValid = apSsid.length >= 1 && apSsid.length <= 32;
      const passValid = apPass.length === 0 || apPass.length >= 8;
      setValid(ssidValid && passValid && isValidIPv4String(apIP));
      return;
    }

    if (mode === "STATION") {
      const ssidValid = stationSsid.length >= 1 && stationSsid.length <= 32;
      const passValid = stationPass.length >= 8;
      const ipValid = !fixedIPStation || isValidIPv4String(stationIP);
      setValid(ssidValid && passValid && ipValid);
      return;
    }

    setValid(false);
  }, [mode, apIP, apPass, apSsid, fixedIPStation, stationIP, stationPass, stationSsid]);

  function resetCredentials() {
    if (mode === "AP") {
      const defaults = apDefaults ?? {
        ssid: "",
        password: "",
        ip: DEFAULT_AP_IP,
      };

      setApSsid(defaults.ssid);
      setApPass(defaults.password);
      setApIP(defaults.ip);
      setChangesMade(false);
      setStatusMessage("Configuracion AP restablecida.");
      return;
    }

    const defaults = stationDefaults ?? {
      ssid: "",
      password: "",
      ip: DHCP_IP,
      fixedIp: false,
    };

    setStationSsid(defaults.ssid);
    setStationPass(defaults.password);
    setStationIP(defaults.ip);
    setFixedIPStation(defaults.fixedIp);
    setChangesMade(false);
    setStatusMessage("Configuracion STATION restablecida.");
  }

  async function sendCredentials() {
    try {
      if (mode === "AP") {
        const payload = PayloadBuilder.wifiSetAP(
          apSsid,
          apPass,
          ipStringToBytes(apIP)
        );

        await send(CMD.WIFI_SET_AP, payload);
        setApDefaults({ ssid: apSsid, password: apPass, ip: apIP });

        if (mockMode) {
          emitMockPacket(CMD.WIFI_ACK, buildAckPayload(CMD.WIFI_SET_AP), 180);
        }

        return;
      }

      if (mode === "STATION") {
        const nextIp = fixedIPStation ? stationIP : DHCP_IP;
        const payload = PayloadBuilder.wifiSetSTA(
          stationSsid,
          stationPass,
          fixedIPStation,
          ipStringToBytes(nextIp)
        );

        await send(CMD.WIFI_SET_STA, payload);
        setStationDefaults({
          ssid: stationSsid,
          password: stationPass,
          ip: nextIp,
          fixedIp: fixedIPStation,
        });

        if (mockMode) {
          emitMockPacket(CMD.WIFI_ACK, buildAckPayload(CMD.WIFI_SET_STA), 180);
        }
      }
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron enviar las credenciales."
      );
    }
  }

  function handleSelectNetwork(ssid: string) {
    setStationSsid(ssid);
    setStationPass("");
    setChangesMade(true);
    setStatusMessage(`SSID seleccionado: ${ssid}.`);
  }

  function refreshNetworks() {
    requestScan();
    setStatusMessage("Solicitud de scan enviada.");
  }

  if (mode === null) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-slate-100 selection:bg-cyan-500/30">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="mb-2 size-24 animate-pulse"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z"
          />
        </svg>
        <h1 className="bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400 bg-[length:200%_100%] bg-clip-text text-4xl font-extrabold uppercase tracking-tight text-transparent drop-shadow-sm motion-safe:animate-[gradient-move_6s_linear_infinite] md:text-6xl">
          Consultando modo Wi-Fi
        </h1>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-start space-y-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-slate-100 selection:bg-cyan-500/30">
      <PageHeader
        setOpenSettingsModal={setOpenSettingsModal}
        setOpenInfoModal={setOpenInfoModal}
      />

      <div className="flex w-full max-w-6xl items-center justify-between rounded-2xl bg-white/5 px-5 py-3 ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-sm uppercase tracking-[0.18em] text-slate-300">
            Modo actual
          </span>
          <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-400/30">
            {mode}
          </span>
        </div>

        <button
          className="refresh-btn group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white transition-all duration-300 hover:text-slate-900 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          onClick={refreshNetworks}
        >
          Actualizar redes
        </button>
      </div>

      {statusMessage && (
        <div className="w-full max-w-6xl rounded-2xl bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100 ring-1 ring-cyan-400/20">
          {statusMessage}
        </div>
      )}

      {mode === "AP" ? (
        <div className="flex h-full w-full flex-col items-center justify-start rounded-2xl bg-white/5 p-6 shadow-sm ring-1 ring-white/10 backdrop-blur">
          <h1 className="mb-6 bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400 bg-[length:200%_100%] bg-clip-text text-3xl font-extrabold uppercase tracking-tight text-transparent drop-shadow-sm motion-safe:animate-[gradient-move_6s_linear_infinite] md:text-4xl">
            Modo AP
          </h1>

          <div className="mb-4 flex w-full max-w-xl flex-col items-start justify-start">
            <label htmlFor="ap-ssid" className="mb-2 text-sm font-medium text-slate-200">
              SSID
            </label>
            <input
              id="ap-ssid"
              type="text"
              className="w-full rounded-xl bg-white/10 p-2.5 text-slate-100 ring-1 ring-white/10 transition duration-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              placeholder="Nombre de la red AP"
              value={apSsid}
              onChange={(event) => {
                setApSsid(event.target.value);
                setChangesMade(true);
              }}
            />
          </div>

          <div className="mb-4 flex w-full max-w-xl flex-col items-start justify-start">
            <label htmlFor="ap-password" className="mb-2 text-sm font-medium text-slate-200">
              Contraseña
            </label>
            <div className="relative w-full">
              <input
                id="ap-password"
                type={seePass ? "text" : "password"}
                className="w-full rounded-xl bg-white/10 p-2.5 text-slate-100 ring-1 ring-white/10 transition duration-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                placeholder="Vacío para AP abierto, o mínimo 8 caracteres"
                value={apPass}
                onChange={(event) => {
                  setApPass(event.target.value);
                  setChangesMade(true);
                }}
              />
              <button
                type="button"
                aria-label={seePass ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="group absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-xl px-2 py-1 font-medium text-white transition-all duration-300 hover:text-slate-900 hover:shadow-[inset_0_0_0_1px_theme('colors.slate.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
                onClick={() => setSeePass((value) => !value)}
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

          <div className="mb-4 flex w-full max-w-xl flex-col items-start justify-start">
            <label htmlFor="ap-ip" className="mb-2 text-sm font-medium text-slate-200">
              IP del AP
            </label>
            <input
              id="ap-ip"
              type="text"
              className="w-full rounded-xl bg-white/10 p-2.5 text-slate-100 ring-1 ring-white/10 transition duration-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              placeholder="192.168.4.1 o 0.0.0.0 para usar default"
              value={apIP}
              onChange={(event) => {
                setApIP(event.target.value);
                setChangesMade(true);
              }}
            />
          </div>

          <button
            onClick={() => void sendCredentials()}
            disabled={!valid || !changesMade}
            className="btn-success group relative mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white transition-all duration-300 hover:text-slate-900 hover:shadow-[inset_0_0_0_2px_theme('colors.emerald.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar configuración
          </button>
        </div>
      ) : (
        <div className="flex h-full w-3/4 flex-col items-center justify-center gap-4 lg:w-full lg:flex-row">
          <div className="flex h-3/4 w-full flex-col items-center justify-center rounded-2xl bg-white/5 p-6 shadow-sm ring-1 ring-white/10 backdrop-blur">
            <h1 className="mb-6 bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400 bg-[length:200%_100%] bg-clip-text text-3xl font-extrabold uppercase tracking-tight text-transparent drop-shadow-sm motion-safe:animate-[gradient-move_6s_linear_infinite] md:text-4xl">
              Modo STATION
            </h1>

            <div className="mb-4 flex w-full max-w-xl flex-col items-start justify-start">
              <label htmlFor="station-ssid" className="mb-2 text-sm font-medium text-slate-200">
                Red actual
              </label>
              <input
                id="station-ssid"
                type="text"
                className="w-full rounded-xl bg-white/10 p-2.5 text-slate-100 ring-1 ring-white/10 transition duration-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                value={stationSsid}
                onChange={(event) => {
                  setStationSsid(event.target.value);
                  setChangesMade(true);
                }}
              />
            </div>

            <div className="mb-4 flex w-full max-w-xl flex-col items-start justify-start">
              <label htmlFor="station-ip" className="mb-2 text-sm font-medium text-slate-200">
                IP fija
              </label>
              <div className="flex w-full items-center gap-4">
                <ToggleButton
                  checked={fixedIPStation}
                  onChange={(checked) => {
                    setFixedIPStation(checked);
                    if (!checked) {
                      setStationIP(DHCP_IP);
                    }
                    setChangesMade(true);
                  }}
                />
                <input
                  id="station-ip"
                  type="text"
                  className="flex-1 rounded-xl bg-white/10 p-2.5 text-slate-100 ring-1 ring-white/10 transition duration-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:opacity-50"
                  value={fixedIPStation ? stationIP : DHCP_IP}
                  readOnly={!fixedIPStation}
                  onChange={(event) => {
                    setStationIP(event.target.value);
                    setChangesMade(true);
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Si el toggle está apagado, se envía `fixedIp=0` e IP `0.0.0.0`.
              </p>
            </div>

            <div className="flex w-full max-w-xl flex-col items-start justify-start">
              <label htmlFor="station-password" className="mb-2 text-sm font-medium text-slate-200">
                Contraseña
              </label>
              <div className="relative w-full">
                <input
                  id="station-password"
                  type={seePass ? "text" : "password"}
                  className="w-full rounded-xl bg-white/10 p-2.5 text-slate-100 ring-1 ring-white/10 transition duration-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  value={stationPass}
                  onChange={(event) => {
                    setStationPass(event.target.value);
                    setChangesMade(true);
                  }}
                />
                <button
                  type="button"
                  aria-label={seePass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="group absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-xl px-2 py-1 font-medium text-white transition-all duration-300 hover:text-slate-900 hover:shadow-[inset_0_0_0_1px_theme('colors.slate.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
                  onClick={() => setSeePass((value) => !value)}
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

            <div className="mt-6 flex w-full max-w-xl flex-row items-center justify-evenly gap-4">
              <button
                className="btn-danger group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white transition-all duration-300 hover:bg-red-400 hover:text-slate-900 hover:shadow-[inset_0_0_0_2px_theme('colors.white')] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={resetCredentials}
                disabled={!changesMade}
              >
                Restablecer
              </button>
              <button
                className="btn-success group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white transition-all duration-300 hover:bg-emerald-400 hover:text-slate-900 hover:shadow-[inset_0_0_0_2px_theme('colors.white')] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void sendCredentials()}
                disabled={!valid || !changesMade}
              >
                Enviar cambios
              </button>
            </div>
          </div>

          <div className="flex h-3/4 w-full flex-col items-center justify-center rounded-2xl bg-white/5 p-6 shadow-sm ring-1 ring-white/10 backdrop-blur">
            <div className="mb-6 flex w-full max-w-xl flex-row items-center justify-between gap-2">
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
                className="refresh-btn group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white transition-all duration-300 hover:text-slate-900 hover:shadow-[inset_0_0_0_2px_theme('colors.cyan.400')] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                onClick={refreshNetworks}
              >
                Actualizar redes
              </button>
            </div>

            <ul className="max-h-96 w-full max-w-xl space-y-2 overflow-y-auto">
              {availableNetworks.map((network, index) => (
                <li
                  key={`${network.ssid}-${index}`}
                  className="flex w-full cursor-pointer flex-row items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-slate-100 ring-1 ring-white/10 transition-all duration-300 hover:bg-white hover:text-slate-900 hover:shadow-[inset_0_0_0_1px_theme('colors.cyan.400')]"
                  onClick={() => handleSelectNetwork(network.ssid)}
                  title="Seleccionar red"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{network.ssid}</span>
                    <span className="text-xs opacity-75">
                      RSSI: {network.rssi}dBm | Seguridad:{" "}
                      {securityLabel(network.security)}
                    </span>
                  </div>
                </li>
              ))}

              {availableNetworks.length === 0 && (
                <li className="w-full rounded-xl bg-white/5 px-3 py-4 text-center text-slate-400">
                  No se encontraron redes disponibles
                </li>
              )}
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
          <h2 className="mb-4 text-2xl font-bold text-black">
            Contrato Wi-Fi con firmware
          </h2>
          <p className="mb-3 text-black">
            Esta pantalla ahora arma los payloads igual que el parser del
            firmware.
          </p>
          <p className="mb-3 text-black">
            AP usa `WIFI_SET_AP (0x14)` con:
            <code> [ssidLen][ssid][passLen][pass][ip0][ip1][ip2][ip3] </code>
          </p>
          <p className="text-black">
            STATION usa `WIFI_SET_STA (0x15)` con:
            <code>
              {" "}
              [ssidLen][ssid][passLen][pass][fixedIp][ip0][ip1][ip2][ip3]
            </code>
          </p>
        </Modal>
      )}

      {openSettingsModal && (
        <Modal
          isOpen={openSettingsModal}
          onClose={() => setOpenSettingsModal(false)}
          closeOnOverlayClick={false}
        >
          <h2 className="mb-4 text-2xl font-bold text-black">Configuración</h2>

          <div className="my-4 flex w-full flex-row items-center justify-center gap-4 text-black">
            <p className="text-lg">El payload se construye con UNERProtocol</p>
          </div>

          <div className="my-4 flex w-full flex-row items-center justify-center gap-4 text-black">
            <p className="text-lg">{`AP admite password vacio o >= 8 bytes`}</p>
          </div>

          <div className="my-4 flex w-full flex-row items-center justify-center gap-4 text-black">
            <p className="text-lg">STA siempre envía los 4 bytes de IP</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
