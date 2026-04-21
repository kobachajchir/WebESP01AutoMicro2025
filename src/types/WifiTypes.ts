export type WifiMode = "AP" | "STATION";
export type WifiSectionView = "WIFI" | "AP";

export type WifiCredentialsResultStatus =
  | "success"
  | "failed"
  | "timeout"
  | "cancelled";

export type WifiCredentialsStatus =
  | "idle"
  | "requested"
  | "submitting"
  | "connecting"
  | WifiCredentialsResultStatus
  | "cancelling";

export const WIFI_CREDENTIALS_SUBMIT_COMMAND = "wifi.credentials.submit";
export const WIFI_CREDENTIALS_CANCEL_COMMAND = "wifi.credentials.cancel";
export const WIFI_SCAN_START_COMMAND = "wifi.scan.start";
export const WIFI_SCAN_RESULTS_EVENT = "wifi.scan.results";
export const WIFI_NETWORK_DETAIL_COMMAND = "wifi.detail.get";
export const WIFI_NETWORK_DETAIL_EVENT = "wifi.detail.result";
export const WIFI_AP_CREDENTIALS_SET_COMMAND = "wifi.ap.credentials.set";
export const WIFI_CREDENTIALS_REQUESTED_EVENT = "wifi.credentials.requested";
export const WIFI_CREDENTIALS_RESULT_EVENT = "wifi.credentials.result";

export interface WifiCredentialsSubmitParams {
  ssid: string;
  password: string;
}

export interface WifiCredentialsCancelParams {
  ssid: string;
}

export interface WifiNetworkDetail {
  ssid: string;
  signalStrength: number | null;
  encryptionType: string | number | null;
  channel: number | null;
}
