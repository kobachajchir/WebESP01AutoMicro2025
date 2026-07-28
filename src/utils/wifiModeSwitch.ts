export type EspOperatingMode = "AP" | "RED";
export type EspBootMode = "ap" | "normal";
export type DestinationIpSource = "fixed" | "default" | "dhcp";

export interface WifiModeConfig {
  apSsid: string;
  apIp: string;
  stationSsid: string;
  stationIp: string;
}

export interface WifiModeDestination {
  mode: EspOperatingMode;
  bootMode: EspBootMode;
  ssid: string;
  ip: string | null;
  ipSource: DestinationIpSource;
  url: string | null;
}

interface WifiStatusLike {
  apActive: boolean;
  staConnected: boolean;
}

const AP_DEFAULT_IP = "192.168.4.1";
const UNSPECIFIED_IP = "0.0.0.0";

export function resolveEspOperatingMode(
  status: WifiStatusLike | null,
): EspOperatingMode {
  return status?.apActive && !status.staConnected ? "AP" : "RED";
}

export function resolveOppositeModeDestination(
  currentMode: EspOperatingMode,
  config: WifiModeConfig,
): WifiModeDestination {
  if (currentMode === "RED") {
    const configuredIp = normalizeIp(config.apIp);
    const ip = configuredIp ?? AP_DEFAULT_IP;
    return {
      mode: "AP",
      bootMode: "ap",
      ssid: config.apSsid.trim(),
      ip,
      ipSource: configuredIp ? "fixed" : "default",
      url: `http://${ip}/`,
    };
  }

  const ip = normalizeIp(config.stationIp);
  return {
    mode: "RED",
    bootMode: "normal",
    ssid: config.stationSsid.trim(),
    ip,
    ipSource: ip ? "fixed" : "dhcp",
    url: ip ? `http://${ip}/` : null,
  };
}

function normalizeIp(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed !== UNSPECIFIED_IP ? trimmed : null;
}
