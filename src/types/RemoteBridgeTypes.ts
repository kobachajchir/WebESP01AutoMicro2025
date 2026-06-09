import { APP_PIN_ACTION } from "./UnerProtocolCMDTypes";

export const REMOTE_AUTH_BRIDGE_MODE = {
  UNER: "uner",
  JSON: "json",
} as const;

export type RemoteAuthBridgeMode =
  (typeof REMOTE_AUTH_BRIDGE_MODE)[keyof typeof REMOTE_AUTH_BRIDGE_MODE];

export const STM_REMOTE_COMMAND_MODE = {
  LEGACY_HEX: "legacy-hex",
  JSON: "json",
} as const;

export type StmRemoteCommandMode =
  (typeof STM_REMOTE_COMMAND_MODE)[keyof typeof STM_REMOTE_COMMAND_MODE];

export const ESP_REMOTE_AUTH_COMMANDS = {
  LOGIN: "esp.auth.pin.login",
  VALIDATE_SCREEN: "esp.auth.pin.validateScreen",
} as const;

export const STM_REMOTE_AUTH_COMMANDS = {
  PIN_GRANTED: "stm.auth.pin.grant",
} as const;

export const STM_REMOTE_INPUT_COMMANDS = {
  ENCODER_BUTTON: "stm.input.encoderButton",
  USER_BUTTON: "stm.input.userButton",
  ROTATE_LEFT: "stm.input.rotateLeft",
  ROTATE_RIGHT: "stm.input.rotateRight",
} as const;

export const STM_LEGACY_REMOTE_COMMANDS = {
  MENU_ITEM_CLICK: "0x53",
  ENCODER_BUTTON: "0x54",
  USER_BUTTON: "0x55",
  REQUEST_SCREEN_PAGE: "0x56",
  ROTATE_LEFT: "0x57",
  ROTATE_RIGHT: "0x58",
  PIN_GRANTED: "0x59",
} as const;

export interface EspRemoteAuthParams {
  pin: string;
}

export interface StmRemoteGrantParams {
  screenCode: number;
}

export interface StmRemoteRotateParams {
  screenCode: number;
}

export interface StmRemoteButtonParams {
  screenCode: number;
  pressKind: "short" | "long";
}

export function getRemoteAuthBridgeMode(): RemoteAuthBridgeMode {
  const raw = import.meta.env.VITE_REMOTE_AUTH_BRIDGE_MODE?.trim().toLowerCase();
  return raw === REMOTE_AUTH_BRIDGE_MODE.UNER
    ? REMOTE_AUTH_BRIDGE_MODE.UNER
    : REMOTE_AUTH_BRIDGE_MODE.JSON;
}

export function getStmRemoteCommandMode(): StmRemoteCommandMode {
  const raw = import.meta.env.VITE_STM_REMOTE_COMMAND_MODE?.trim().toLowerCase();
  return raw === STM_REMOTE_COMMAND_MODE.JSON
    ? STM_REMOTE_COMMAND_MODE.JSON
    : STM_REMOTE_COMMAND_MODE.LEGACY_HEX;
}

export function resolveEspRemoteAuthCommand(action: number): string | null {
  if (action === APP_PIN_ACTION.LOGIN) {
    return ESP_REMOTE_AUTH_COMMANDS.LOGIN;
  }

  if (action === APP_PIN_ACTION.VALIDATE_SCREEN) {
    return ESP_REMOTE_AUTH_COMMANDS.VALIDATE_SCREEN;
  }

  return null;
}

export function toRemotePressKindLabel(pressKind: number): "short" | "long" {
  return pressKind === 0x01 ? "long" : "short";
}
