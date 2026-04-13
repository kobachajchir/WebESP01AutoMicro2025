import {
  buildScreen010001StartupCommands,
  buildScreen010101DashboardCommands,
  buildScreen010102ModeChangeCommands,
} from "./dashboardScreens";
import {
  buildScreen010201MainMenuCommands,
  buildScreen020101WifiMenuCommands,
  buildScreen020203WifiResultsMenuCommands,
  buildScreen020301EspMenuCommands,
  buildScreen030101SensorsMenuCommands,
  buildScreen050101SettingsMenuCommands,
} from "./menuScreens";
import {
  buildScreen020201WifiStatusCommands,
  buildScreen020202WifiSearchCommands,
  buildScreen020204WifiNotConnectedNotificationCommands,
  buildScreen020205WifiConnectingCommands,
  buildScreen020206WifiConnectedCommands,
  buildScreen020207WifiSearchCompleteNotificationCommands,
  buildScreen020208WifiSearchCanceledNotificationCommands,
  buildScreen020302EspCheckingConnectionNotificationCommands,
  buildScreen020303EspFirmwareRequestNotificationCommands,
  buildScreen020304EspResetSentNotificationCommands,
  buildScreen020305EspCheckConnectionRequiredNotificationCommands,
  buildScreen020306EspBootReceivedNotificationCommands,
  buildScreen020307EspFirmwareReceivedNotificationCommands,
  buildScreen020307EspFirmwareScreenCommands,
  buildScreen020308EspModeChangedNotificationCommands,
  buildScreen020309EspApStartedNotificationCommands,
  buildScreen020401UsbConnectedNotificationCommands,
  buildScreen020402UsbDisconnectedNotificationCommands,
  buildScreen020501WebServerUpNotificationCommands,
  buildScreen020502WebClientConnectedNotificationCommands,
  buildScreen020503WebClientDisconnectedNotificationCommands,
} from "./connectivityScreens";
import type { WifiStatusArgs } from "./connectivityScreens";
import {
  buildScreen030201IrValuesCommands,
  buildScreen030301MpuValuesCommands,
  buildScreen030401RadarCommands,
} from "./sensorScreens";
import {
  buildScreen040101MotorTestCommands,
} from "./motorScreens";
import {
  buildScreen050201AboutProjectCommands,
  buildScreen050202AboutRepoCommands,
  buildScreen050301WarningTimeCommands,
} from "./settingsScreens";
import {
  buildScreen060101ControllerConnectedNotificationCommands,
  buildScreen060102ControllerDisconnectedNotificationCommands,
  buildScreen060201CommandReceivedNotificationCommands,
  buildScreen060202PingReceivedNotificationCommands,
  buildScreen060301EspConnectionSucceededCommands,
  buildScreen060302EspConnectionFailedCommands,
} from "./notificationScreens";
import {
  buildScreen070101TestScreenCommands,
} from "./dashboardScreens";
import {
  buildScreen080101LockedCommands,
  buildScreen080102PinIncorrectLockCommands,
  buildScreen080103PinModifiedLockCommands,
  buildScreen080104LockEnterPinCommands,
  buildScreen080104PermissionPinEntryCommands,
  buildScreen080105PermissionPinWaitingCommands,
  buildScreen080106PermissionPinDeniedCommands,
  buildScreen080107PermissionPinTimeoutCommands,
  buildScreen080108PermissionPinBlockedCommands,
  buildScreen080109PermissionDeniedNotificationCommands,
} from "./warningScreens";
import {
  SCREEN_CODE_CONNECTIVITY_ESP_AP_STARTED,
  SCREEN_CODE_CONNECTIVITY_ESP_BOOT_RECEIVED,
  SCREEN_CODE_CONNECTIVITY_ESP_CHECK_REQUIRED,
  SCREEN_CODE_CONNECTIVITY_ESP_CHECKING,
  SCREEN_CODE_CONNECTIVITY_ESP_FIRMWARE_RECEIVED,
  SCREEN_CODE_CONNECTIVITY_ESP_FIRMWARE_REQUEST,
  SCREEN_CODE_CONNECTIVITY_ESP_MENU,
  SCREEN_CODE_CONNECTIVITY_ESP_MODE_CHANGED,
  SCREEN_CODE_CONNECTIVITY_ESP_RESET_SENT,
  SCREEN_CODE_CONNECTIVITY_USB_CONNECTED,
  SCREEN_CODE_CONNECTIVITY_USB_DISCONNECTED,
  SCREEN_CODE_CONNECTIVITY_WEB_CLIENT_CONNECTED,
  SCREEN_CODE_CONNECTIVITY_WEB_CLIENT_DISCONNECTED,
  SCREEN_CODE_CONNECTIVITY_WEB_SERVER_UP,
  SCREEN_CODE_CONNECTIVITY_WIFI_CONNECTED,
  SCREEN_CODE_CONNECTIVITY_WIFI_CONNECTING,
  SCREEN_CODE_CONNECTIVITY_WIFI_MENU,
  SCREEN_CODE_CONNECTIVITY_WIFI_NOT_CONNECTED,
  SCREEN_CODE_CONNECTIVITY_WIFI_RESULTS,
  SCREEN_CODE_CONNECTIVITY_WIFI_SEARCHING,
  SCREEN_CODE_CONNECTIVITY_WIFI_SEARCH_CANCELED,
  SCREEN_CODE_CONNECTIVITY_WIFI_SEARCH_COMPLETE,
  SCREEN_CODE_CONNECTIVITY_WIFI_STATUS,
  SCREEN_CODE_CORE_DASHBOARD,
  SCREEN_CODE_CORE_MAIN_MENU,
  SCREEN_CODE_CORE_MODE_CHANGE,
  SCREEN_CODE_CORE_STARTUP,
  SCREEN_CODE_DIAG_COMMAND_RECEIVED,
  SCREEN_CODE_DIAG_CONTROLLER_CONNECTED,
  SCREEN_CODE_DIAG_CONTROLLER_DISCONNECTED,
  SCREEN_CODE_DIAG_ESP_CONN_FAILED,
  SCREEN_CODE_DIAG_ESP_CONN_SUCCEEDED,
  SCREEN_CODE_DIAG_PING_RECEIVED,
  SCREEN_CODE_MOTOR_TEST,
  SCREEN_CODE_SENSORS_IR_VALUES,
  SCREEN_CODE_SENSORS_MENU,
  SCREEN_CODE_SENSORS_MPU_VALUES,
  SCREEN_CODE_SENSORS_RADAR,
  SCREEN_CODE_SERVICE_TEST_SCREEN,
  SCREEN_CODE_SETTINGS_ABOUT_PROJECT,
  SCREEN_CODE_SETTINGS_ABOUT_REPO,
  SCREEN_CODE_SETTINGS_MENU,
  SCREEN_CODE_SETTINGS_WARNING_TIME,
  SCREEN_CODE_WARNING_LOCKED,
  SCREEN_CODE_WARNING_PERMISSION_DENIED,
  SCREEN_CODE_WARNING_PIN_BLOCKED,
  SCREEN_CODE_WARNING_PIN_DENIED,
  SCREEN_CODE_WARNING_PIN_ENTRY,
  SCREEN_CODE_WARNING_PIN_INCORRECT,
  SCREEN_CODE_WARNING_PIN_MODIFIED,
  SCREEN_CODE_WARNING_PIN_TIMEOUT,
  SCREEN_CODE_WARNING_PIN_WAITING,
} from "./screenCodes";
import type {
  CarModeLabel,
  DashboardConnectionState,
  ModeChangeScreenArgs,
} from "./dashboardScreens";
import type { MotorDirection, MotorSelection } from "./motorScreens";
import type { OledCommand } from "./types";

const SOURCE_RENDER = 0x02;
const SOURCE_PERMISSION = 0x04;

export interface ScreenRenderInput {
  screenCode: number;
  source?: number;
  sourceName?: string;
  title?: string;
  rawData?: Record<string, unknown>;
}

export interface ResolvedOledScreen {
  title: string;
  variant: string;
  category: string;
  builder: string;
  description: string;
  commands: OledCommand[];
}

export function resolveOledScreen(input: ScreenRenderInput): ResolvedOledScreen | null {
  const data = input.rawData ?? {};
  const progress = {
    elapsedTicks: readNumber(data.elapsedTicks) ?? readNumber(data.progressTicks) ?? 1,
    totalTicks: readNumber(data.totalTicks) ?? 8,
  };

  switch (input.screenCode) {
    case SCREEN_CODE_CORE_STARTUP:
      return resolved(input, "Startup splash", "transient state screen", "buildScreen010001StartupCommands", "Splash de arranque renderizado con el bitmap del auto.", buildScreen010001StartupCommands());
    case SCREEN_CODE_CORE_DASHBOARD:
      return resolved(input, "Dashboard", "dashboard screen", "buildScreen010101DashboardCommands", "Estado principal del STM: conectividad, modo del auto y accesos a Menu/Modo.", buildScreen010101DashboardCommands(readDashboardArgs(data)));
    case SCREEN_CODE_CORE_MODE_CHANGE:
      return resolved(input, "Mode change selector", "transient state screen", "buildScreen010102ModeChangeCommands", "Selector de modo del auto con flechas y confirmacion por encoder.", buildScreen010102ModeChangeCommands(readModeChangeArgs(data)));
    case SCREEN_CODE_CORE_MAIN_MENU:
      return resolved(input, "Main menu", "menu screen", "buildScreen010201MainMenuCommands", "Menu principal. La identidad oficial sigue siendo screenCode; el indice solo ajusta el cursor si el bridge lo informa.", buildScreen010201MainMenuCommands(readMenuArgs(data)));

    case SCREEN_CODE_CONNECTIVITY_WIFI_MENU:
      return resolved(input, "WiFi menu", "menu screen", "buildScreen020101WifiMenuCommands", "Submenu WiFi con estado, busqueda de redes, enlace ESP y regreso.", buildScreen020101WifiMenuCommands(readMenuArgs(data)));
    case SCREEN_CODE_CONNECTIVITY_WIFI_STATUS:
      return resolved(input, "WiFi status", "connectivity screen", "buildScreen020201WifiStatusCommands", "Vista de estado WiFi. Si no llegan parametros extra se usa un estado seguro de desconectado.", buildScreen020201WifiStatusCommands(readWifiStatusArgs(data)));
    case SCREEN_CODE_CONNECTIVITY_WIFI_SEARCHING:
      return resolved(input, "WiFi search with timer", "transient state screen", "buildScreen020202WifiSearchCommands", "Busqueda de redes con contador y accion de cancelar.", buildScreen020202WifiSearchCommands({ secondsRemaining: readNumber(data.secondsRemaining) ?? 10 }));
    case SCREEN_CODE_CONNECTIVITY_WIFI_RESULTS:
      return resolved(input, "WiFi results menu", "menu screen", "buildScreen020203WifiResultsMenuCommands", "Lista de SSIDs detectados. Sin lista dinamica se muestra el fallback del builder.", buildScreen020203WifiResultsMenuCommands({ ...readMenuArgs(data), networkSsids: readStringArray(data.networkSsids) }));
    case SCREEN_CODE_CONNECTIVITY_WIFI_NOT_CONNECTED:
      return resolved(input, "WiFi not connected notification", "notification", "buildScreen020204WifiNotConnectedNotificationCommands", "Aviso transitorio de WiFi sin conexion.", buildScreen020204WifiNotConnectedNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_WIFI_CONNECTING:
      return resolved(input, "WiFi connecting", "notification", "buildScreen020205WifiConnectingCommands", "Aviso de conexion WiFi en curso con SSID truncado a 14 caracteres.", buildScreen020205WifiConnectingCommands({ ssid: readString(data.ssid) ?? "AutoWiFi" }, progress));
    case SCREEN_CODE_CONNECTIVITY_WIFI_CONNECTED:
      return resolved(input, "WiFi connected", "notification", "buildScreen020206WifiConnectedCommands", "Aviso de conexion WiFi exitosa con SSID e IP.", buildScreen020206WifiConnectedCommands({ ssid: readString(data.ssid) ?? "AutoWiFi", ipAddress: readString(data.ipAddress) ?? "192.168.4.1" }, progress));
    case SCREEN_CODE_CONNECTIVITY_WIFI_SEARCH_COMPLETE:
      return resolved(input, "WiFi search complete", "notification", "buildScreen020207WifiSearchCompleteNotificationCommands", "Aviso transitorio de busqueda WiFi completada.", buildScreen020207WifiSearchCompleteNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_WIFI_SEARCH_CANCELED:
      return resolved(input, "WiFi search canceled", "notification", "buildScreen020208WifiSearchCanceledNotificationCommands", "Aviso transitorio de busqueda WiFi cancelada.", buildScreen020208WifiSearchCanceledNotificationCommands(progress));

    case SCREEN_CODE_CONNECTIVITY_ESP_MENU:
      return resolved(input, "ESP submenu", "menu screen", "buildScreen020301EspMenuCommands", "Submenu de enlace ESP con chequeo, firmware y reset.", buildScreen020301EspMenuCommands(readMenuArgs(data)));
    case SCREEN_CODE_CONNECTIVITY_ESP_CHECKING:
      return resolved(input, "ESP checking connection", "notification", "buildScreen020302EspCheckingConnectionNotificationCommands", "Aviso de chequeo de conexion con el ESP.", buildScreen020302EspCheckingConnectionNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_ESP_FIRMWARE_REQUEST:
      return resolved(input, "ESP firmware request", "notification", "buildScreen020303EspFirmwareRequestNotificationCommands", "Pantalla de solicitud de firmware del ESP.", buildScreen020303EspFirmwareRequestNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_ESP_RESET_SENT:
      return resolved(input, "ESP reset sent", "notification", "buildScreen020304EspResetSentNotificationCommands", "Pantalla de confirmacion de envio de reset al ESP.", buildScreen020304EspResetSentNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_ESP_CHECK_REQUIRED:
      return resolved(input, "ESP check required", "notification", "buildScreen020305EspCheckConnectionRequiredNotificationCommands", "Aviso para ejecutar un chequeo de conexion ESP.", buildScreen020305EspCheckConnectionRequiredNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_ESP_BOOT_RECEIVED:
      return resolved(input, "ESP boot received", "notification", "buildScreen020306EspBootReceivedNotificationCommands", "Aviso de boot recibido desde el ESP.", buildScreen020306EspBootReceivedNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_ESP_FIRMWARE_RECEIVED: {
      const firmwareVersion = readString(data.firmwareVersion) ?? readString(data.version) ?? "ESP01";
      const useFullScreen = input.source === SOURCE_RENDER;
      return resolved(input, useFullScreen ? "ESP firmware full screen" : "ESP firmware received notification", useFullScreen ? "full screen" : "notification", useFullScreen ? "buildScreen020307EspFirmwareScreenCommands" : "buildScreen020307EspFirmwareReceivedNotificationCommands", "Mismo screenCode con dos rutas; la UI decide por source cuando esta disponible.", useFullScreen ? buildScreen020307EspFirmwareScreenCommands({ firmwareVersion }) : buildScreen020307EspFirmwareReceivedNotificationCommands({ firmwareVersion }, progress));
    }
    case SCREEN_CODE_CONNECTIVITY_ESP_MODE_CHANGED:
      return resolved(input, "ESP mode changed", "notification", "buildScreen020308EspModeChangedNotificationCommands", "Aviso de modo ESP actualizado.", buildScreen020308EspModeChangedNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_ESP_AP_STARTED:
      return resolved(input, "ESP AP started", "notification", "buildScreen020309EspApStartedNotificationCommands", "Aviso de AP iniciado, con IP del ESP cuando el bridge la informa.", buildScreen020309EspApStartedNotificationCommands({ ipAddress: readString(data.ipAddress) ?? "192.168.4.1" }, progress));
    case SCREEN_CODE_CONNECTIVITY_USB_CONNECTED:
      return resolved(input, "USB connected", "notification", "buildScreen020401UsbConnectedNotificationCommands", "Aviso de USB conectado.", buildScreen020401UsbConnectedNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_USB_DISCONNECTED:
      return resolved(input, "USB disconnected", "notification", "buildScreen020402UsbDisconnectedNotificationCommands", "Aviso de USB desconectado.", buildScreen020402UsbDisconnectedNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_WEB_SERVER_UP:
      return resolved(input, "Web server up", "notification", "buildScreen020501WebServerUpNotificationCommands", "Aviso de web server listo.", buildScreen020501WebServerUpNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_WEB_CLIENT_CONNECTED:
      return resolved(input, "Web client connected", "notification", "buildScreen020502WebClientConnectedNotificationCommands", "Aviso de cliente web conectado.", buildScreen020502WebClientConnectedNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_WEB_CLIENT_DISCONNECTED:
      return resolved(input, "Web client disconnected", "notification", "buildScreen020503WebClientDisconnectedNotificationCommands", "Aviso de cliente web desconectado.", buildScreen020503WebClientDisconnectedNotificationCommands(progress));

    case SCREEN_CODE_SENSORS_MENU:
      return resolved(input, "Sensors menu", "menu screen", "buildScreen030101SensorsMenuCommands", "Menu de sensores: IR, MPU y test de motores.", buildScreen030101SensorsMenuCommands(readMenuArgs(data)));
    case SCREEN_CODE_SENSORS_IR_VALUES:
      return resolved(input, "IR values live graph", "sensor screen", "buildScreen030201IrValuesCommands", "Grafico de ocho sensores IR; sin datos dinamicos usa una muestra estable.", buildScreen030201IrValuesCommands({ irValues: readNumberArray(data.irValues, 8) ?? [0, 512, 1024, 1536, 2048, 2560, 3072, 4095] }));
    case SCREEN_CODE_SENSORS_MPU_VALUES:
      return resolved(input, "MPU live values", "sensor screen", "buildScreen030301MpuValuesCommands", "Tabla live de acelerometro y giroscopio MPU.", buildScreen030301MpuValuesCommands(readMpuArgs(data)));
    case SCREEN_CODE_SENSORS_RADAR:
      return resolved(input, "Radar", "sensor screen", "buildScreen030401RadarCommands", "Radar con grilla circular y silueta del auto.", buildScreen030401RadarCommands());
    case SCREEN_CODE_MOTOR_TEST:
      return resolved(input, "Motor test", "motor/control screen", "buildScreen040101MotorTestCommands", "Vista completa de test de motores con direccion, velocidad y barra de avance.", buildScreen040101MotorTestCommands(readMotorArgs(data)));
    case SCREEN_CODE_SETTINGS_MENU:
      return resolved(input, "Settings menu", "menu screen", "buildScreen050101SettingsMenuCommands", "Menu de configuracion; Preferencias no tiene screenCode propio en firmware.", buildScreen050101SettingsMenuCommands(readMenuArgs(data)));
    case SCREEN_CODE_SETTINGS_ABOUT_PROJECT:
      return resolved(input, "About project", "settings/info screen", "buildScreen050201AboutProjectCommands", "Pantalla Acerca de con proyecto, autor, ano e iconos.", buildScreen050201AboutProjectCommands());
    case SCREEN_CODE_SETTINGS_ABOUT_REPO:
      return resolved(input, "About repo QR", "settings/info screen", "buildScreen050202AboutRepoCommands", "Pantalla con QR del repositorio y flecha de regreso.", buildScreen050202AboutRepoCommands());
    case SCREEN_CODE_SETTINGS_WARNING_TIME:
      return resolved(input, "Warning time config", "settings screen", "buildScreen050301WarningTimeCommands", "Configuracion de segundos para avisos.", buildScreen050301WarningTimeCommands({ seconds: readNumber(data.seconds) ?? 10 }));
    case SCREEN_CODE_DIAG_CONTROLLER_CONNECTED:
      return resolved(input, "Controller connected", "notification", "buildScreen060101ControllerConnectedNotificationCommands", "Aviso de control conectado.", buildScreen060101ControllerConnectedNotificationCommands(progress));
    case SCREEN_CODE_DIAG_CONTROLLER_DISCONNECTED:
      return resolved(input, "Controller disconnected", "notification", "buildScreen060102ControllerDisconnectedNotificationCommands", "Aviso de control desconectado.", buildScreen060102ControllerDisconnectedNotificationCommands(progress));
    case SCREEN_CODE_DIAG_COMMAND_RECEIVED:
      return resolved(input, "Command received", "notification", "buildScreen060201CommandReceivedNotificationCommands", "Aviso de comando/ECHO recibido.", buildScreen060201CommandReceivedNotificationCommands(progress));
    case SCREEN_CODE_DIAG_PING_RECEIVED:
      return resolved(input, "Ping received", "notification", "buildScreen060202PingReceivedNotificationCommands", "Aviso de PING recibido.", buildScreen060202PingReceivedNotificationCommands(progress));
    case SCREEN_CODE_DIAG_ESP_CONN_SUCCEEDED:
      return resolved(input, "ESP connection succeeded", "status view", "buildScreen060301EspConnectionSucceededCommands", "Vista de conexion ESP exitosa.", buildScreen060301EspConnectionSucceededCommands());
    case SCREEN_CODE_DIAG_ESP_CONN_FAILED:
      return resolved(input, "ESP connection failed", "status view", "buildScreen060302EspConnectionFailedCommands", "Vista de conexion ESP fallida.", buildScreen060302EspConnectionFailedCommands());
    case SCREEN_CODE_SERVICE_TEST_SCREEN:
      return resolved(input, "Test screen", "service screen", "buildScreen070101TestScreenCommands", "Pantalla de servicio vacia, traducida como clear().", buildScreen070101TestScreenCommands());
    case SCREEN_CODE_WARNING_LOCKED:
      return resolved(input, "Lock screen, locked", "warning screen", "buildScreen080101LockedCommands", "Pantalla bloqueada simple.", buildScreen080101LockedCommands());
    case SCREEN_CODE_WARNING_PIN_INCORRECT:
      return resolved(input, "Lock screen, PIN incorrect", "warning screen", "buildScreen080102PinIncorrectLockCommands", "Pantalla bloqueada por PIN incorrecto.", buildScreen080102PinIncorrectLockCommands());
    case SCREEN_CODE_WARNING_PIN_MODIFIED:
      return resolved(input, "Lock screen, PIN modified", "warning screen", "buildScreen080103PinModifiedLockCommands", "Pantalla bloqueada con PIN modificado.", buildScreen080103PinModifiedLockCommands());
    case SCREEN_CODE_WARNING_PIN_ENTRY:
      return input.source === SOURCE_PERMISSION
        ? resolved(input, "Permission PIN entry form", "confirmation / permission screen", "buildScreen080104PermissionPinEntryCommands", "Formulario de ingreso de PIN de cuatro digitos; se elige por source PERMISSION.", buildScreen080104PermissionPinEntryCommands(readPinFormArgs(data)))
        : resolved(input, "Lock screen, enter PIN prompt", "warning screen", "buildScreen080104LockEnterPinCommands", "Prompt simple de ingreso de PIN; se usa cuando source no es PERMISSION.", buildScreen080104LockEnterPinCommands());
    case SCREEN_CODE_WARNING_PIN_WAITING:
      return resolved(input, "Permission PIN waiting", "loading / permission screen", "buildScreen080105PermissionPinWaitingCommands", "PIN en validacion contra ESP.", buildScreen080105PermissionPinWaitingCommands(readPinFormArgs(data)));
    case SCREEN_CODE_WARNING_PIN_DENIED:
      return resolved(input, "Permission PIN denied", "warning screen", "buildScreen080106PermissionPinDeniedCommands", "PIN rechazado con contador de intentos.", buildScreen080106PermissionPinDeniedCommands({ attemptsLeft: readNumber(data.attemptsLeft) ?? 2 }));
    case SCREEN_CODE_WARNING_PIN_TIMEOUT:
      return resolved(input, "Permission PIN timeout", "warning screen", "buildScreen080107PermissionPinTimeoutCommands", "Timeout de validacion PIN.", buildScreen080107PermissionPinTimeoutCommands());
    case SCREEN_CODE_WARNING_PIN_BLOCKED:
      return resolved(input, "Permission PIN blocked", "warning screen", "buildScreen080108PermissionPinBlockedCommands", "PIN bloqueado por demasiados fallos.", buildScreen080108PermissionPinBlockedCommands());
    case SCREEN_CODE_WARNING_PERMISSION_DENIED:
      return resolved(input, "Permission denied notification", "notification", "buildScreen080109PermissionDeniedNotificationCommands", "Aviso de accion restringida por falta de permiso.", buildScreen080109PermissionDeniedNotificationCommands(progress));
    default:
      return null;
  }
}

function resolved(
  input: ScreenRenderInput,
  variant: string,
  category: string,
  builder: string,
  description: string,
  commands: OledCommand[]
): ResolvedOledScreen {
  return {
    title: input.title ?? variant,
    variant,
    category,
    builder,
    description,
    commands,
  };
}

function readDashboardArgs(data: Record<string, unknown>) {
  return {
    connection: readConnection(data.connection),
    ssid: readString(data.ssid),
    ipAddress: readString(data.ipAddress),
    usbActive: readBoolean(data.usbActive),
    rfActive: readBoolean(data.rfActive),
    carMode: readCarMode(data.carMode),
  };
}

function readModeChangeArgs(data: Record<string, unknown>): ModeChangeScreenArgs {
  return { mode: readMode(data.mode) };
}

function readMenuArgs(data: Record<string, unknown>) {
  return {
    selectedIndex: readNumber(data.selectedIndex) ?? readNumber(data.cursor) ?? 0,
    firstVisibleIndex: readNumber(data.firstVisibleIndex),
  };
}

function readWifiStatusArgs(data: Record<string, unknown>): WifiStatusArgs {
  const state = readString(data.state);
  return {
    state: state === "sta" || state === "ap" || state === "disconnected" ? state : "disconnected",
    ssid: readString(data.ssid),
    ipAddress: readString(data.ipAddress),
  };
}

function readMpuArgs(data: Record<string, unknown>) {
  return {
    accelX: readNumber(data.accelX) ?? 120,
    accelY: readNumber(data.accelY) ?? -40,
    accelZ: readNumber(data.accelZ) ?? 980,
    gyroX: readNumber(data.gyroX) ?? 3,
    gyroY: readNumber(data.gyroY) ?? -2,
    gyroZ: readNumber(data.gyroZ) ?? 0,
  };
}

function readMotorArgs(data: Record<string, unknown>) {
  return {
    selectedMotor: readMotorSelection(data.selectedMotor),
    direction: readMotorDirection(data.direction),
    leftSpeed: readNumber(data.leftSpeed) ?? 128,
    rightSpeed: readNumber(data.rightSpeed) ?? 128,
    movementEnabled: readBoolean(data.movementEnabled) ?? true,
  };
}

function readPinFormArgs(data: Record<string, unknown>) {
  return {
    digits: readNumberArray(data.digits, 4) ?? [0, 0, 0, 0],
    pinIndex: readNumber(data.pinIndex) ?? 0,
  };
}

function readConnection(value: unknown): DashboardConnectionState {
  return value === "sta" || value === "ap" || value === "none" ? value : "none";
}

function readCarMode(value: unknown): CarModeLabel {
  return value === "FOLLOW" || value === "TEST" || value === "DEF" || value === "ERROR"
    ? value
    : "IDLE";
}

function readMode(value: unknown): ModeChangeScreenArgs["mode"] {
  return value === "FOLLOW" || value === "TEST" || value === "ERROR" ? value : "IDLE";
}

function readMotorSelection(value: unknown): MotorSelection {
  return value === "left" || value === "right" || value === "both" || value === "none"
    ? value
    : "unknown";
}

function readMotorDirection(value: unknown): MotorDirection {
  return value === "backward" ? "backward" : "forward";
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : undefined;
}

function readNumberArray(value: unknown, length: number): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.map(readNumber);
  return values.length >= length && values.every((item) => item !== undefined)
    ? (values as number[]).slice(0, length)
    : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : undefined;
}
