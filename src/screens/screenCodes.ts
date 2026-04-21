// src/screens/screenCodes.ts

import type { ScreenCode } from "../screens/types";

export function makeScreenCode(
  menu: number,
  submenu: number,
  page: number,
): ScreenCode {
  return ((menu & 0xff) << 16) | ((submenu & 0xff) << 8) | (page & 0xff);
}

export function screenMenu(code: ScreenCode): number {
  return (code >> 16) & 0xff;
}

export function screenSubmenu(code: ScreenCode): number {
  return (code >> 8) & 0xff;
}

export function screenPage(code: ScreenCode): number {
  return code & 0xff;
}

export const SCREEN_CODE_NONE = 0x000000;

export const SCREEN_CODE_CORE_STARTUP = 0x010001;
export const SCREEN_CODE_CORE_DASHBOARD = 0x010101;
export const SCREEN_CODE_CORE_MODE_CHANGE = 0x010102;
export const SCREEN_CODE_CORE_MAIN_MENU = 0x010201;

export const SCREEN_CODE_CONNECTIVITY_WIFI_MENU = 0x020101;
export const SCREEN_CODE_CONNECTIVITY_WIFI_STATUS = 0x020201;
export const SCREEN_CODE_CONNECTIVITY_WIFI_SEARCHING = 0x020202;
export const SCREEN_CODE_CONNECTIVITY_WIFI_RESULTS = 0x020203;
export const SCREEN_CODE_CONNECTIVITY_WIFI_NOT_CONNECTED = 0x020204;
export const SCREEN_CODE_CONNECTIVITY_WIFI_CONNECTING = 0x020205;
export const SCREEN_CODE_CONNECTIVITY_WIFI_CONNECTED = 0x020206;
export const SCREEN_CODE_CONNECTIVITY_WIFI_SEARCH_COMPLETE = 0x020207;
export const SCREEN_CODE_CONNECTIVITY_WIFI_SEARCH_CANCELED = 0x020208;

export const SCREEN_CODE_CONNECTIVITY_ESP_MENU = 0x020301;
export const SCREEN_CODE_CONNECTIVITY_ESP_CHECKING = 0x020302;
export const SCREEN_CODE_CONNECTIVITY_ESP_FIRMWARE_REQUEST = 0x020303;
export const SCREEN_CODE_CONNECTIVITY_ESP_RESET_SENT = 0x020304;
export const SCREEN_CODE_CONNECTIVITY_ESP_CHECK_REQUIRED = 0x020305;
export const SCREEN_CODE_CONNECTIVITY_ESP_BOOT_RECEIVED = 0x020306;
export const SCREEN_CODE_CONNECTIVITY_ESP_FIRMWARE_RECEIVED = 0x020307;
export const SCREEN_CODE_CONNECTIVITY_ESP_MODE_CHANGED = 0x020308;
export const SCREEN_CODE_CONNECTIVITY_ESP_AP_STARTED = 0x020309;

export const SCREEN_CODE_CONNECTIVITY_USB_CONNECTED = 0x020401;
export const SCREEN_CODE_CONNECTIVITY_USB_DISCONNECTED = 0x020402;

export const SCREEN_CODE_CONNECTIVITY_WEB_SERVER_UP = 0x020501;
export const SCREEN_CODE_CONNECTIVITY_WEB_CLIENT_CONNECTED = 0x020502;
export const SCREEN_CODE_CONNECTIVITY_WEB_CLIENT_DISCONNECTED = 0x020503;

export const SCREEN_CODE_SENSORS_MENU = 0x030101;
export const SCREEN_CODE_SENSORS_IR_VALUES = 0x030201;
export const SCREEN_CODE_SENSORS_MPU_VALUES = 0x030301;
export const SCREEN_CODE_SENSORS_RADAR = 0x030401;

export const SCREEN_CODE_MOTOR_TEST = 0x040101;

export const SCREEN_CODE_SETTINGS_MENU = 0x050101;
export const SCREEN_CODE_SETTINGS_ABOUT_PROJECT = 0x050201;
export const SCREEN_CODE_SETTINGS_ABOUT_REPO = 0x050202;
export const SCREEN_CODE_SETTINGS_WARNING_TIME = 0x050301;

export const SCREEN_CODE_DIAG_CONTROLLER_CONNECTED = 0x060101;
export const SCREEN_CODE_DIAG_CONTROLLER_DISCONNECTED = 0x060102;
export const SCREEN_CODE_DIAG_COMMAND_RECEIVED = 0x060201;
export const SCREEN_CODE_DIAG_PING_RECEIVED = 0x060202;
export const SCREEN_CODE_DIAG_ESP_CONN_SUCCEEDED = 0x060301;
export const SCREEN_CODE_DIAG_ESP_CONN_FAILED = 0x060302;

export const SCREEN_CODE_SERVICE_TEST_SCREEN = 0x070101;

export const SCREEN_CODE_WARNING_LOCKED = 0x080101;
export const SCREEN_CODE_WARNING_PIN_INCORRECT = 0x080102;
export const SCREEN_CODE_WARNING_PIN_MODIFIED = 0x080103;
export const SCREEN_CODE_WARNING_PIN_ENTRY = 0x080104;
export const SCREEN_CODE_WARNING_PIN_WAITING = 0x080105;
export const SCREEN_CODE_WARNING_PIN_DENIED = 0x080106;
export const SCREEN_CODE_WARNING_PIN_TIMEOUT = 0x080107;
export const SCREEN_CODE_WARNING_PIN_BLOCKED = 0x080108;
export const SCREEN_CODE_WARNING_PERMISSION_DENIED = 0x080109;

export interface ScreenDefinition {
  code: ScreenCode;
  isValidationScreen?: boolean;
  pinDigitsCount?: number;
}

export const SCREEN_REPORT_SOURCE_PERMISSION = 0x04;

export const SCREEN_DEFINITIONS: Partial<Record<ScreenCode, ScreenDefinition>> =
  {
    [SCREEN_CODE_WARNING_PIN_ENTRY]: {
      code: SCREEN_CODE_WARNING_PIN_ENTRY,
      isValidationScreen: true,
      pinDigitsCount: 4,
    },
    [SCREEN_CODE_WARNING_PIN_WAITING]: {
      code: SCREEN_CODE_WARNING_PIN_WAITING,
      isValidationScreen: true,
      pinDigitsCount: 4,
    },
    [SCREEN_CODE_WARNING_PIN_DENIED]: {
      code: SCREEN_CODE_WARNING_PIN_DENIED,
      isValidationScreen: true,
      pinDigitsCount: 4,
    },
    [SCREEN_CODE_WARNING_PIN_TIMEOUT]: {
      code: SCREEN_CODE_WARNING_PIN_TIMEOUT,
      isValidationScreen: true,
      pinDigitsCount: 4,
    },
    [SCREEN_CODE_WARNING_PIN_BLOCKED]: {
      code: SCREEN_CODE_WARNING_PIN_BLOCKED,
      isValidationScreen: true,
      pinDigitsCount: 4,
    },
  };

export function getScreenDefinition(
  code: ScreenCode | null | undefined,
): ScreenDefinition | null {
  if (typeof code !== "number") {
    return null;
  }

  return SCREEN_DEFINITIONS[code] ?? null;
}

export function isValidationScreenCode(
  code: ScreenCode | null | undefined,
): boolean {
  return getScreenDefinition(code)?.isValidationScreen === true;
}

export function isPermissionValidationScreenCode(
  code: ScreenCode | null | undefined,
  source?: number,
): boolean {
  if (!isValidationScreenCode(code)) {
    return false;
  }

  if (code === SCREEN_CODE_WARNING_PIN_ENTRY) {
    return source === SCREEN_REPORT_SOURCE_PERMISSION;
  }

  return true;
}

export function getValidationPinDigitsCount(
  code: ScreenCode | null | undefined,
): number {
  const def = getScreenDefinition(code);
  if (!def?.isValidationScreen) {
    return 0;
  }

  return Math.max(1, def.pinDigitsCount ?? 4);
}
