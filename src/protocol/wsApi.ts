export const WS_API_VERSION = 1 as const;

export const ESP_COMMANDS = {
  PIN_LOGIN: "esp.auth.pin.login",
  PIN_VALIDATE_SCREEN: "esp.auth.pin.validateScreen",
  PIN_CHANGE: "esp.auth.pin.change",
  SESSION_LOGOUT: "esp.auth.session.logout",
  SESSION_GET: "esp.auth.session.get",
  GET_MPU_SNAPSHOT: "getMpuSnapshot",
  SUBSCRIBE_MPU: "subscribeMpu",
  UNSUBSCRIBE_MPU: "unsubscribeMpu",
  GET_IR_SNAPSHOT: "getIrSnapshot",
  SUBSCRIBE_IR: "subscribeIr",
  UNSUBSCRIBE_IR: "unsubscribeIr",
  GET_TELEMETRY: "getTelemetrySnapshot",
  GET_CONTROL: "getControlSnapshot",
  GET_PREFERENCES: "getPreferences",
  SET_PREFERENCES: "setPreferences",
  GET_CURRENT_SCREEN: "getCurrentScreen",
  GET_CAR_MODE: "getCarMode",
  SET_CAR_MODE: "setCarMode",
  OLED_CANVAS_BEGIN: "oledCanvas.begin",
  OLED_CANVAS_CHUNK: "oledCanvas.chunk",
  OLED_CANVAS_COMMIT: "oledCanvas.commit",
  OLED_CANVAS_CANCEL: "oledCanvas.cancel",
  GET_FIRMWARE: "getFirmwareInfo",
  GET_BUILD: "getBuildInfo",
  GET_BOOT_REPORT: "getBootReport",
  GET_STATUS: "esp.device.getStatus",
  GET_AP_CLIENTS: "wifi.ap.clients.list",
  DISCONNECT_AP_CLIENT: "wifi.ap.clients.disconnect",
  REBOOT_ESP: "esp.reboot",
  REBOOT_STM: "rebootStm",
  GET_EXTENSION_PROFILE: "stm.extensionProfile.get",
  SET_EXTENSION_PROFILE: "stm.extensionProfile.set",
  REBOOT_INTO_PROFILE: "stm.extensionProfile.reboot",
  RAW_UNER: "rawUner",
} as const;

export type CommandName =
  | (typeof ESP_COMMANDS)[keyof typeof ESP_COMMANDS]
  | string;

export type WsRequest = {
  api: 1;
  type: "request";
  requestId: string;
  command: CommandName;
  args: Record<string, unknown>;
};

export type WsResponse<T = unknown> = {
  api: 1;
  type: "response";
  requestId: string;
  ok: true;
  command: CommandName;
  data: T;
};

export type WsEvent<T = unknown> = {
  api: 1;
  type: "event";
  event: string;
  data: T;
};

export type WsError = {
  api: 1;
  type: "error";
  requestId?: string;
  code: WsErrorCode | string;
  message: string;
  details?: unknown;
};

export type WsEnvelope = WsResponse | WsEvent | WsError;

export type WsErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "unsupported_by_f4"
  | "busy"
  | "timeout"
  | "uart_error"
  | "f4_nack"
  | "offline"
  | "connection_lost";

export interface EspHello {
  apiVersion: number;
  espVersion?: string;
  f4ContractCutoff?: string;
  clientId?: number;
  clientIp?: string;
  sessionGeneration?: number;
  assignedNode?: string;
  maxClients?: number;
  features?: Record<string, boolean>;
  backend?: Record<string, unknown>;
  sessionResumed?: boolean;
  authenticated?: boolean;
}

export function createRequestId(prefix = "web"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildWsRequest(
  command: CommandName,
  args: Record<string, unknown> = {},
  requestId = createRequestId(),
): WsRequest {
  if (!requestId || requestId.length > 64) {
    throw new Error("requestId debe tener entre 1 y 64 caracteres");
  }
  if (!command || command.length > 64) {
    throw new Error("command debe tener entre 1 y 64 caracteres");
  }

  return { api: WS_API_VERSION, type: "request", requestId, command, args };
}

export function parseWsEnvelope(value: unknown): WsEnvelope | null {
  if (!isRecord(value) || value.api !== 1 || typeof value.type !== "string") {
    return null;
  }

  if (value.type === "response") {
    return typeof value.requestId === "string" &&
      value.requestId.length > 0 &&
      value.ok === true &&
      typeof value.command === "string" &&
      "data" in value
      ? (value as WsResponse)
      : null;
  }

  if (value.type === "event") {
    return typeof value.event === "string" && value.event.length > 0 && "data" in value
      ? (value as WsEvent)
      : null;
  }

  if (value.type === "error") {
    return typeof value.code === "string" && typeof value.message === "string"
      ? (value as WsError)
      : null;
  }

  return null;
}

export function resolveWebSocketUrl(
  configuredUrl: string | undefined,
  locationLike: Pick<Location, "protocol" | "host"> = window.location,
): string {
  const explicit = configuredUrl?.trim();
  if (explicit) {
    return explicit;
  }

  const scheme = locationLike.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${locationLike.host}/ws`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
