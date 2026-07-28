import { baselineY, clear, drawXbm, setInverse, setWhite, textAt, withNotificationProgress } from "./helpers";
import {
  SCREEN_CODE_CORE_REMOTE_MODE_CHANGED,
  SCREEN_CODE_DIAG_COMMAND_RECEIVED,
  SCREEN_CODE_DIAG_CONTROLLER_CONNECTED,
  SCREEN_CODE_DIAG_CONTROLLER_DISCONNECTED,
  SCREEN_CODE_DIAG_ESP_CONN_FAILED,
  SCREEN_CODE_DIAG_ESP_CONN_SUCCEEDED,
  SCREEN_CODE_DIAG_PING_RECEIVED,
} from "./screenCodes";
import type { NotificationProgressArgs, OledCommand } from "./types";

function notification(commands: OledCommand[], progress?: NotificationProgressArgs): OledCommand[] {
  return withNotificationProgress(commands, progress);
}

export const screen010105RemoteModeChangedCode = SCREEN_CODE_CORE_REMOTE_MODE_CHANGED;

export function buildScreen010105RemoteModeChangedNotificationCommands(
  args: { mode: string },
  progress?: NotificationProgressArgs,
): OledCommand[] {
  const mode = ["IDLE", "FOLLOW", "TEST"].includes(args.mode) ? args.mode : "MODO";
  const secondLine = `a ${mode}`;
  const center7x10 = (text: string) => Math.max(0, Math.floor((128 - text.length * 7) / 2));
  return notification([
    clear(),
    setWhite(),
    ...drawXbm(56, 3, 16, 16, "Icon_Info_bits"),
    ...textAt(center7x10("Cambio remoto"), baselineY(34, "Font7x10"), "Cambio remoto", "Font7x10"),
    ...textAt(center7x10(secondLine), baselineY(52, "Font7x10"), secondLine, "Font7x10"),
  ], progress);
}

const centerSmallNotificationTextX = (text: string) =>
  Math.max(0, Math.floor((128 - text.length * 7) / 2));

function buildUnerForwardingNotificationCommands(
  enabled: boolean,
  progress?: NotificationProgressArgs,
): OledCommand[] {
  const commands: OledCommand[] = [
    clear(),
    setWhite(),
  ];
  if (!enabled) commands.push(setInverse());
  commands.push(...drawXbm(56, 3, 16, 16, "Icon_Link_bits"));
  if (!enabled) {
    commands.push(
      setWhite(),
      { type: "drawLine", x0: 56, y0: 3, x1: 72, y1: 19 },
      { type: "drawLine", x0: 57, y0: 3, x1: 73, y1: 19 },
    );
  }
  const state = enabled ? "activado" : "desactivado";
  commands.push(
    ...textAt(centerSmallNotificationTextX("Port forward"), baselineY(34, "Font7x10"), "Port forward", "Font7x10"),
    ...textAt(centerSmallNotificationTextX(state), baselineY(52, "Font7x10"), state, "Font7x10"),
  );
  return notification(commands, progress);
}

export function buildScreen050417UnerForwardingEnabledNotificationCommands(
  progress?: NotificationProgressArgs,
): OledCommand[] {
  return buildUnerForwardingNotificationCommands(true, progress);
}

export function buildScreen050418UnerForwardingDisabledNotificationCommands(
  progress?: NotificationProgressArgs,
): OledCommand[] {
  return buildUnerForwardingNotificationCommands(false, progress);
}

export const screen060101ControllerConnectedCode = SCREEN_CODE_DIAG_CONTROLLER_CONNECTED;

export function buildScreen060101ControllerConnectedNotificationCommands(progress?: NotificationProgressArgs): OledCommand[] {
  return notification([
    clear(),
    setWhite(),
    ...drawXbm(46, 4, 37, 27, "Icon_Controller_bits"),
    ...textAt(28, baselineY(48, "Font11x18"), "Control", "Font11x18"),
    ...textAt(16, baselineY(63, "Font11x18"), "conectado", "Font11x18"),
  ], progress);
}

export const screen060102ControllerDisconnectedCode = SCREEN_CODE_DIAG_CONTROLLER_DISCONNECTED;

export function buildScreen060102ControllerDisconnectedNotificationCommands(progress?: NotificationProgressArgs): OledCommand[] {
  return notification([
    clear(),
    setWhite(),
    ...textAt(28, baselineY(48, "Font11x18"), "Control", "Font11x18"),
    ...textAt(8, baselineY(63, "Font11x18"), "desconectado", "Font11x18"),
    { type: "drawLine", x0: 46, y0: 2, x1: 84, y1: 30 },
    { type: "drawLine", x0: 47, y0: 2, x1: 85, y1: 30 },
    { type: "drawLine", x0: 47, y0: 1, x1: 85, y1: 29 },
    setInverse(),
    ...drawXbm(46, 4, 37, 27, "Icon_Controller_bits"),
    setWhite(),
  ], progress);
}

export const screen060201CommandReceivedCode = SCREEN_CODE_DIAG_COMMAND_RECEIVED;

export function buildScreen060201CommandReceivedNotificationCommands(progress?: NotificationProgressArgs): OledCommand[] {
  return notification([
    clear(),
    setWhite(),
    ...drawXbm(2, 12, 19, 16, "Icon_Wifi_100_bits"),
    ...textAt(27, baselineY(30, "Font11x18"), "ECHO", "Font11x18"),
    ...textAt(2, baselineY(50, "Font11x18"), "recibido", "Font11x18"),
  ], progress);
}

export const screen060202PingReceivedCode = SCREEN_CODE_DIAG_PING_RECEIVED;

export function buildScreen060202PingReceivedNotificationCommands(progress?: NotificationProgressArgs): OledCommand[] {
  return notification([
    clear(),
    setWhite(),
    ...drawXbm(2, 12, 16, 16, "Icon_Info_bits"),
    ...textAt(27, baselineY(30, "Font11x18"), "PING", "Font11x18"),
    ...textAt(2, baselineY(50, "Font11x18"), "recibido", "Font11x18"),
  ], progress);
}

export const screen060301EspConnSucceededCode = SCREEN_CODE_DIAG_ESP_CONN_SUCCEEDED;

export function buildScreen060301EspConnectionSucceededCommands(): OledCommand[] {
  return [
    clear(),
    setWhite(),
    ...textAt(27, baselineY(36, "Font11x18"), "Conexion", "Font11x18"),
    ...textAt(32, baselineY(49, "Font11x18"), "exitosa", "Font11x18"),
    ...drawXbm(111, 47, 13, 13, "Icon_Encoder_bits"),
    ...drawXbm(57, 6, 14, 16, "Icon_Checked_bits"),
  ];
}

export const screen060302EspConnFailedCode = SCREEN_CODE_DIAG_ESP_CONN_FAILED;

export function buildScreen060302EspConnectionFailedCommands(): OledCommand[] {
  return [
    clear(),
    setWhite(),
    ...textAt(27, baselineY(36, "Font11x18"), "Conexion", "Font11x18"),
    ...textAt(32, baselineY(49, "Font11x18"), "fallida", "Font11x18"),
    ...drawXbm(111, 47, 13, 13, "Icon_Encoder_bits"),
    ...drawXbm(58, 9, 11, 16, "Icon_Crossed_bits"),
  ];
}

export const controllerConnectedNotificationExample = buildScreen060101ControllerConnectedNotificationCommands();
export const commandReceivedNotificationExample = buildScreen060201CommandReceivedNotificationCommands();
