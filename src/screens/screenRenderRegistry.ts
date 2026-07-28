import {
  buildScreen010001StartupCommands,
  buildScreen010101DashboardCommands,
  buildScreen010102ModeChangeCommands,
} from "./dashboardScreens";
import {
  buildMenuScreenCommands,
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
  buildScreen02020aWifiCredentialsWebCommands,
  buildScreen02020bWifiCredentialsSucceededCommands,
  buildScreen02020cWifiCredentialsFailedCommands,
  buildScreen02020dWifiCredentialsAtCommands,
  buildScreen020302EspCheckingConnectionNotificationCommands,
  buildScreen020303EspFirmwareRequestNotificationCommands,
  buildScreen020304EspResetSentNotificationCommands,
  buildScreen020305EspCheckConnectionRequiredNotificationCommands,
  buildScreen020306EspBootReceivedNotificationCommands,
  buildScreen02030bEspUnresponsiveNotificationCommands,
  buildScreen02030cEspWatchdogResetNotificationCommands,
  buildScreen02030dEspExceptionResetNotificationCommands,
  buildScreen020307EspFirmwareReceivedNotificationCommands,
  buildScreen020307EspFirmwareScreenCommands,
  buildScreen020308EspModeChangedNotificationCommands,
  buildScreen020309EspApStartedNotificationCommands,
  buildScreen020401UsbConnectedNotificationCommands,
  buildScreen020402UsbDisconnectedNotificationCommands,
  buildScreen020501WebServerUpNotificationCommands,
  buildScreen020502WebClientConnectedNotificationCommands,
  buildScreen020503WebClientDisconnectedNotificationCommands,
  buildScreen020601ApDeviceConnectedNotificationCommands,
  buildScreen020602ApDeviceDisconnectedNotificationCommands,
} from "./connectivityScreens";
import type { WifiStatusArgs } from "./connectivityScreens";
import {
  buildScreen030201IrValuesCommands,
  buildScreen030301MpuValuesCommands,
  buildScreen030401RadarCommands,
} from "./sensorScreens";
import {
  buildScreen030500DisplayMenuCommands,
  buildScreen030503OledCanvasReadyCommands,
} from "./displayScreens";
import {
  buildScreen040101MotorTestCommands,
} from "./motorScreens";
import {
  buildScreen050201AboutProjectCommands,
  buildScreen050202AboutRepoCommands,
  buildScreen050301WarningTimeCommands,
} from "./settingsScreens";
import {
  buildScreen010105RemoteModeChangedNotificationCommands,
  buildScreen050417UnerForwardingEnabledNotificationCommands,
  buildScreen050418UnerForwardingDisabledNotificationCommands,
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
  buildIdentifiedNotificationCommands,
  buildIdentifiedScreenCommands,
} from "./identifiedScreens";
import * as ScreenCodes from "./screenCodes";
import {
  SCREEN_CODE_CONNECTIVITY_ESP_AP_STARTED,
  SCREEN_CODE_CONNECTIVITY_ESP_BOOT_RECEIVED,
  SCREEN_CODE_CONNECTIVITY_ESP_EXCEPTION_RESET,
  SCREEN_CODE_CONNECTIVITY_ESP_CHECK_REQUIRED,
  SCREEN_CODE_CONNECTIVITY_ESP_CHECKING,
  SCREEN_CODE_CONNECTIVITY_ESP_FIRMWARE_RECEIVED,
  SCREEN_CODE_CONNECTIVITY_ESP_FIRMWARE_REQUEST,
  SCREEN_CODE_CONNECTIVITY_ESP_MENU,
  SCREEN_CODE_CONNECTIVITY_ESP_MODE_CHANGED,
  SCREEN_CODE_CONNECTIVITY_ESP_RESET_SENT,
  SCREEN_CODE_CONNECTIVITY_ESP_UNRESPONSIVE,
  SCREEN_CODE_CONNECTIVITY_ESP_WATCHDOG_RESET,
  SCREEN_CODE_CONNECTIVITY_USB_CONNECTED,
  SCREEN_CODE_CONNECTIVITY_USB_DISCONNECTED,
  SCREEN_CODE_CONNECTIVITY_WEB_CLIENT_CONNECTED,
  SCREEN_CODE_CONNECTIVITY_WEB_CLIENT_DISCONNECTED,
  SCREEN_CODE_CONNECTIVITY_WEB_SERVER_UP,
  SCREEN_CODE_CONNECTIVITY_AP_DEVICE_CONNECTED,
  SCREEN_CODE_CONNECTIVITY_AP_DEVICE_DISCONNECTED,
  SCREEN_CODE_CONNECTIVITY_WIFI_CONNECTED,
  SCREEN_CODE_CONNECTIVITY_WIFI_CONNECTING,
  SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_AT,
  SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_FAILED,
  SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_SUCCEEDED,
  SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_WEB,
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
  SCREEN_CODE_CORE_REMOTE_MODE_CHANGED,
  SCREEN_CODE_CORE_STARTUP,
  SCREEN_CODE_DIAG_COMMAND_RECEIVED,
  SCREEN_CODE_DIAG_CONTROLLER_CONNECTED,
  SCREEN_CODE_DIAG_CONTROLLER_DISCONNECTED,
  SCREEN_CODE_DIAG_ESP_CONN_FAILED,
  SCREEN_CODE_DIAG_ESP_CONN_SUCCEEDED,
  SCREEN_CODE_DIAG_PING_RECEIVED,
  SCREEN_CODE_MOTOR_TEST,
  SCREEN_CODE_SENSORS_DISPLAY_MENU,
  SCREEN_CODE_SENSORS_DISPLAY_OLED_CANVAS,
  SCREEN_CODE_SENSORS_IR_VALUES,
  SCREEN_CODE_SENSORS_MENU,
  SCREEN_CODE_SENSORS_MPU_VALUES,
  SCREEN_CODE_SENSORS_RADAR,
  SCREEN_CODE_SERVICE_TEST_SCREEN,
  SCREEN_CODE_SETTINGS_ABOUT_PROJECT,
  SCREEN_CODE_SETTINGS_ABOUT_REPO,
  SCREEN_CODE_SETTINGS_MENU,
  SCREEN_CODE_SETTINGS_PREFS_UNER_FORWARDING_DISABLED,
  SCREEN_CODE_SETTINGS_PREFS_UNER_FORWARDING_ENABLED,
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
import type { MenuScreenItem, NotificationProgressArgs, OledCommand } from "./types";

const SOURCE_RENDER = 0x02;
const SOURCE_PERMISSION = 0x04;

interface IdentifiedMenuDefinition {
  variant: string;
  description: string;
  items: MenuScreenItem[];
}

interface IdentifiedScreenDefinition {
  variant: string;
  category: string;
  description: string;
  lines: string[];
  footer?: string;
}

const item = (label: string, iconRef = "Icon_Tool_bits"): MenuScreenItem => ({ label, iconRef });
const backItem = (): MenuScreenItem => item("Volver", "Icon_Volver_bits");

const IDENTIFIED_MENUS: Record<number, IdentifiedMenuDefinition> = {
  [ScreenCodes.SCREEN_CODE_SENSORS_IR_MENU]: {
    variant: "IR test menu",
    description: "Submenu fisico de infrarrojos.",
    items: [item("Valores IR"), item("Test ruta"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_SENSORS_MPU_MENU]: {
    variant: "MPU test menu",
    description: "Submenu fisico del MPU.",
    items: [item("Valores MPU"), item("Recalibrar", "Icon_Refrescar_bits"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_MOTOR_MENU]: {
    variant: "Motor test menu",
    description: "Seleccion de motor para prueba individual.",
    items: [item("Motor izquierdo"), item("Motor derecho"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_BALANCE_MENU]: {
    variant: "Balance PID menu",
    description: "Menu de estado, log y ganancias del control de balance.",
    items: [item("Estado PID", "Icon_Info_bits"), item("Log PID", "Icon_Config_bits"), item("Kp"), item("Ki"), item("Kd"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_SETTINGS_ABOUT_MENU]: {
    variant: "About menu",
    description: "Menu Acerca de de la F4.",
    items: [item("Info", "Icon_Info_bits"), item("Repositorio", "Icon_Info_bits"), item("Build", "Icon_Info_bits"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_MENU]: {
    variant: "Preferences menu",
    description: "Menu raiz de preferencias persistentes.",
    items: [item("Encoder", "Icon_Encoder_bits"), item("Pantalla", "Icon_Smartphone_bits"), item("Seguridad", "Icon_Config_bits"), item("Rotacion", "Icon_Smartphone_bits"), item("Sistema", "Icon_Config_bits"), item("UNER Router", "Icon_Link_bits"), item("Motores"), item("Linea", "Icon_Sensors_bits"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_ENCODER_MENU]: {
    variant: "Encoder preferences menu",
    description: "Preferencias del encoder.",
    items: [item("Invertir giro", "Icon_Config_bits"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_DISPLAY_MENU]: {
    variant: "Display preferences menu",
    description: "Preferencias de bloqueo y timeout de pantalla.",
    items: [item("Bloq pantalla", "Icon_Config_bits"), item("T.s bloqueo", "Icon_Smartphone_bits"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_MOTORS_MENU]: {
    variant: "Motor preferences menu",
    description: "Preferencias persistentes de motores.",
    items: [item("PWM Minimo"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_MOTOR_PWM_MENU]: {
    variant: "Minimum PWM menu",
    description: "Ajuste de PWM minimo por motor.",
    items: [item("Motor izq"), item("Motor der"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_SYSTEM_MENU]: {
    variant: "System preferences menu",
    description: "Timeout de acciones y periodo Alive USB.",
    items: [item("T.s accion", "Icon_Config_bits"), item("Alive USB", "Icon_USB_bits"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_ROTATION_MENU]: {
    variant: "Rotation preferences menu",
    description: "Preferencias de rotacion automatica.",
    items: [item("Rot. automatica", "Icon_Config_bits"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_UNER_ROUTER_MENU]: {
    variant: "UNER router preferences menu",
    description: "Preferencias de forwarding UNER.",
    items: [item("Forwarding", "Icon_Config_bits"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_LINE_MENU]: {
    variant: "Line preferences menu",
    description: "Preferencias del seguidor de linea.",
    items: [item("Ancho cinta", "Icon_Sensors_bits"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_SECURITY_MENU]: {
    variant: "Security preferences menu",
    description: "Preferencias del bloqueo por PIN.",
    items: [item("Bloqueo PIN", "Icon_Config_bits"), backItem()],
  },
  [ScreenCodes.SCREEN_CODE_SERVICE_UNER_ROUTER_MENU]: {
    variant: "UNER router service menu",
    description: "Seleccion de transporte para la prueba del router UNER.",
    items: [item("USB CDC", "Icon_USB_bits"), item("UART ESP", "Icon_Link_bits"), item("NRF24", "Icon_RF_bits"), backItem()],
  },
};

const IDENTIFIED_SCREENS: Record<number, IdentifiedScreenDefinition> = {
  [ScreenCodes.SCREEN_CODE_CORE_STABILIZE_PROMPT]: { variant: "Stabilize prompt", category: "transient state screen", description: "Solicitud de estabilizacion previa al modo seleccionado.", lines: ["Estabilizar", "vehiculo"], footer: "Click: aceptar" },
  [ScreenCodes.SCREEN_CODE_CORE_MODE_PROMPT]: { variant: "Mode prompt", category: "transient state screen", description: "Confirmacion local del modo del auto.", lines: ["Confirmar modo"], footer: "Click: aceptar" },
  [ScreenCodes.SCREEN_CODE_CONNECTIVITY_WIFI_DETAILS]: { variant: "WiFi details", category: "connectivity screen", description: "Detalle de la red WiFi seleccionada.", lines: ["Detalle WiFi", "Red seleccionada"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_CONNECTIVITY_ESP_REBOOT_MODE]: { variant: "ESP reboot mode", category: "connectivity screen", description: "Seleccion o confirmacion del modo de reinicio ESP.", lines: ["Reinicio ESP", "Modo de arranque"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_SENSORS_ROUTE_ALIGNMENT]: { variant: "Route alignment", category: "sensor screen", description: "Prueba de alineacion sobre la ruta.", lines: ["Test ruta", "Alineacion"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_SENSORS_MPU_CALIBRATION]: { variant: "MPU calibration", category: "sensor screen", description: "Calibracion local del MPU en progreso.", lines: ["Calibrando MPU", "No mover"], footer: "Click: cancelar" },
  [ScreenCodes.SCREEN_CODE_SENSORS_DISPLAY_ROTATION_TEST]: { variant: "OLED rotation test", category: "display test screen", description: "Prueba manual de orientacion OLED.", lines: ["Test orient.", "Pantalla OLED"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_SENSORS_DISPLAY_ROTATION_MPU_TEST]: { variant: "OLED MPU rotation test", category: "display test screen", description: "Prueba de rotacion OLED asistida por MPU.", lines: ["Auto MPU", "Rotacion OLED"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_MOTOR_LEFT_TEST]: { variant: "Left motor test", category: "motor/control screen", description: "Prueba individual del motor izquierdo.", lines: ["Motor izquierdo", "Prueba manual"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_MOTOR_RIGHT_TEST]: { variant: "Right motor test", category: "motor/control screen", description: "Prueba individual del motor derecho.", lines: ["Motor derecho", "Prueba manual"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_BALANCE_PID_STATUS]: { variant: "Balance PID status", category: "balance screen", description: "Estado del controlador PID de balance.", lines: ["Estado PID", "Balance"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_BALANCE_PID_LOG]: { variant: "Balance PID log", category: "balance screen", description: "Configuracion del log PID.", lines: ["Log PID", "Balance"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_BALANCE_PID_KP]: { variant: "Balance Kp", category: "balance screen", description: "Edicion de ganancia proporcional.", lines: ["Balance PID", "Ganancia Kp"], footer: "Click: guardar" },
  [ScreenCodes.SCREEN_CODE_BALANCE_PID_KI]: { variant: "Balance Ki", category: "balance screen", description: "Edicion de ganancia integral.", lines: ["Balance PID", "Ganancia Ki"], footer: "Click: guardar" },
  [ScreenCodes.SCREEN_CODE_BALANCE_PID_KD]: { variant: "Balance Kd", category: "balance screen", description: "Edicion de ganancia derivativa.", lines: ["Balance PID", "Ganancia Kd"], footer: "Click: guardar" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_ABOUT_BUILD]: { variant: "Firmware build", category: "settings/info screen", description: "Informacion de compilacion del firmware F4.", lines: ["Build F4", "Firmware"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_ENCODER_INVERT]: { variant: "Encoder direction preference", category: "settings screen", description: "Estado identificado del ajuste de inversion del encoder.", lines: ["Invertir giro", "Encoder"], footer: "Click: cambiar" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_DISPLAY_LOCK]: { variant: "Screen lock preference", category: "settings screen", description: "Estado identificado del bloqueo automatico de pantalla.", lines: ["Bloq pantalla", "Preferencia"], footer: "Click: cambiar" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_DISPLAY_TIMEOUT]: { variant: "Screen lock timeout", category: "settings screen", description: "Edicion del timeout de bloqueo OLED.", lines: ["T.s bloqueo", "Editar valor"], footer: "Click: guardar" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_MOTOR_PWM_LEFT]: { variant: "Left minimum PWM", category: "settings screen", description: "Edicion del PWM minimo izquierdo.", lines: ["PWM minimo", "Motor izq"], footer: "Click: guardar" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_MOTOR_PWM_RIGHT]: { variant: "Right minimum PWM", category: "settings screen", description: "Edicion del PWM minimo derecho.", lines: ["PWM minimo", "Motor der"], footer: "Click: guardar" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_SYSTEM_ACTION_TIMEOUT]: { variant: "System action timeout", category: "settings screen", description: "Edicion del timeout de acciones.", lines: ["T.s accion", "Editar valor"], footer: "Click: guardar" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_ROTATION_TEST]: { variant: "Preference rotation test", category: "display test screen", description: "Prueba de rotacion desde preferencias.", lines: ["Test rotacion", "Pantalla OLED"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_ROTATION_MPU_TEST]: { variant: "Preference MPU rotation test", category: "display test screen", description: "Prueba MPU desde preferencias.", lines: ["Test MPU", "Rotacion OLED"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_ROTATION_AUTO]: { variant: "Automatic rotation preference", category: "settings screen", description: "Estado identificado de la rotacion OLED automatica.", lines: ["Rot. automatica", "Pantalla OLED"], footer: "Click: cambiar" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_UNER_ROUTER_FORWARDING]: { variant: "UNER forwarding preference", category: "settings screen", description: "Estado identificado del forwarding del router UNER.", lines: ["UNER Router", "Forwarding"], footer: "Click: cambiar" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_LINE_WIDTH]: { variant: "Line width preference", category: "settings screen", description: "Edicion del ancho de cinta negra.", lines: ["Ancho cinta", "Editar valor"], footer: "Click: guardar" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_SYSTEM_USB_ALIVE]: { variant: "USB Alive period", category: "settings screen", description: "Edicion del periodo Alive USB.", lines: ["Alive USB", "Editar periodo"], footer: "Click: guardar" },
  [ScreenCodes.SCREEN_CODE_SETTINGS_PREFS_SECURITY_PIN_LOCK]: { variant: "PIN lock preference", category: "settings screen", description: "Estado identificado del bloqueo local por PIN.", lines: ["Bloqueo PIN", "Seguridad"], footer: "Click: cambiar" },
  [ScreenCodes.SCREEN_CODE_SERVICE_UNER_ROUTER_USB]: { variant: "UNER router USB test", category: "service screen", description: "Prueba del router UNER por USB CDC.", lines: ["UNER Router", "USB CDC"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_SERVICE_UNER_ROUTER_UART]: { variant: "UNER router UART test", category: "service screen", description: "Prueba del router UNER por UART ESP.", lines: ["UNER Router", "UART ESP"], footer: "Click: volver" },
  [ScreenCodes.SCREEN_CODE_SERVICE_UNER_ROUTER_NRF]: { variant: "UNER router NRF test", category: "service screen", description: "Prueba reservada del router UNER por NRF24.", lines: ["UNER Router", "NRF24"], footer: "Click: volver" },
};

const IDENTIFIED_NOTIFICATIONS: Record<number, IdentifiedScreenDefinition> = {
  [ScreenCodes.SCREEN_CODE_SENSORS_MPU_STREAM_STARTED]: { variant: "MPU stream started", category: "notification", description: "Aviso de stream MPU activado.", lines: ["Stream MPU", "iniciado"] },
  [ScreenCodes.SCREEN_CODE_SENSORS_MPU_STREAM_STOPPED]: { variant: "MPU stream stopped", category: "notification", description: "Aviso de stream MPU detenido.", lines: ["Stream MPU", "detenido"] },
  [ScreenCodes.SCREEN_CODE_SENSORS_MPU_CALIBRATION_NOTICE]: { variant: "MPU calibration notice", category: "notification", description: "Aviso previo a calibrar el MPU.", lines: ["Calibrar MPU", "No mover"] },
  [ScreenCodes.SCREEN_CODE_SENSORS_MPU_CALIBRATION_DONE]: { variant: "MPU calibration complete", category: "notification", description: "Aviso de calibracion MPU finalizada.", lines: ["MPU calibrado", "con exito"] },
  [ScreenCodes.SCREEN_CODE_WARNING_REMOTE_AUTHENTICATED]: { variant: "Remote authenticated", category: "notification", description: "Aviso de sesion remota autenticada.", lines: ["Remoto", "autenticado"] },
  [ScreenCodes.SCREEN_CODE_WARNING_PIN_CORRECT]: { variant: "PIN correct", category: "notification", description: "Aviso de PIN correcto.", lines: ["PIN correcto"] },
  [ScreenCodes.SCREEN_CODE_WARNING_PIN_BYPASSED]: { variant: "PIN bypassed", category: "notification", description: "Aviso de permiso sin validacion PIN por configuracion.", lines: ["PIN omitido", "por config."] },
};

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
  const totalMs = readNumber(data.totalMs);
  const remainingMs = readNumber(data.remainingMs);
  const progress = {
    elapsedTicks: totalMs != null && remainingMs != null
      ? Math.max(0, totalMs - remainingMs)
      : readNumber(data.elapsedTicks) ?? readNumber(data.progressTicks) ?? 1,
    totalTicks: totalMs ?? readNumber(data.totalTicks) ?? 8,
  };

  const identified = resolveIdentifiedScreen(input, data, progress);
  if (identified) {
    return identified;
  }

  switch (input.screenCode) {
    case SCREEN_CODE_CORE_STARTUP:
      return resolved(input, "Startup splash", "transient state screen", "buildScreen010001StartupCommands", "Splash de arranque renderizado con el bitmap del auto.", buildScreen010001StartupCommands());
    case SCREEN_CODE_CORE_DASHBOARD:
      return resolved(input, "Dashboard", "dashboard screen", "buildScreen010101DashboardCommands", "Estado principal del STM: conectividad, modo del auto y accesos a Menu/Modo.", buildScreen010101DashboardCommands(readDashboardArgs(data)));
    case SCREEN_CODE_CORE_MODE_CHANGE:
      return resolved(input, "Mode change selector", "transient state screen", "buildScreen010102ModeChangeCommands", "Selector de modo del auto con flechas y confirmacion por encoder.", buildScreen010102ModeChangeCommands(readModeChangeArgs(data)));
    case SCREEN_CODE_CORE_REMOTE_MODE_CHANGED:
      return resolved(input, "Cambio de modo remoto", "notification", "buildScreen010105RemoteModeChangedNotificationCommands", "Aviso transitorio mostrado por F4 luego de aceptar un cambio de modo desde la Web.", buildScreen010105RemoteModeChangedNotificationCommands({ mode: readString(data.carMode) ?? readString(data.mode) ?? "MODO" }, progress));
    case SCREEN_CODE_CORE_MAIN_MENU:
      return resolved(input, "Main menu", "menu screen", "buildScreen010201MainMenuCommands", "Menu principal. La identidad oficial sigue siendo screenCode; el indice solo ajusta el cursor si el bridge lo informa.", buildScreen010201MainMenuCommands(readMenuArgs(data)));

    case SCREEN_CODE_CONNECTIVITY_WIFI_MENU:
      return resolved(input, "WiFi menu", "menu screen", "buildScreen020101WifiMenuCommands", "Submenu WiFi con estado, busqueda de redes, enlace ESP y regreso.", buildScreen020101WifiMenuCommands(readMenuArgs(data)));
    case SCREEN_CODE_CONNECTIVITY_WIFI_STATUS:
      return resolved(input, "WiFi status", "connectivity screen", "buildScreen020201WifiStatusCommands", "Vista de estado WiFi. Si no llegan parametros extra se usa un estado seguro de desconectado.", buildScreen020201WifiStatusCommands(readWifiStatusArgs(data)));
    case SCREEN_CODE_CONNECTIVITY_WIFI_SEARCHING:
      return resolved(input, "WiFi search with timer", "transient state screen", "buildScreen020202WifiSearchCommands", "Busqueda de redes con contador y accion de cancelar.", buildScreen020202WifiSearchCommands({ secondsRemaining: readNumber(data.secondsRemaining) ?? 10 }));
    case SCREEN_CODE_CONNECTIVITY_WIFI_RESULTS:
      return resolved(input, "WiFi results menu", "menu screen", "buildScreen020203WifiResultsMenuCommands", "Lista de SSIDs detectados. Sin lista dinamica se muestra el fallback del builder.", buildScreen020203WifiResultsMenuCommands({ ...readMenuArgs(data), networkSsids: readWifiResultSsids(data) }));
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
    case SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_WEB:
      return resolved(input, "WiFi credentials requested from Web", "notification", "buildScreen02020aWifiCredentialsWebCommands", "Solicitud de credenciales WiFi pendiente en la Web; usa el SSID informado por ESP si STM no lo incluye.", buildScreen02020aWifiCredentialsWebCommands({ ssid: readCredentialsSsid(data) }, progress));
    case SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_SUCCEEDED:
      return resolved(input, "WiFi credentials accepted", "notification", "buildScreen02020bWifiCredentialsSucceededCommands", "Credenciales WiFi aceptadas por Web/ESP.", buildScreen02020bWifiCredentialsSucceededCommands({ ssid: readCredentialsSsid(data) }, progress));
    case SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_FAILED:
      return resolved(input, "WiFi credentials failed", "notification", "buildScreen02020cWifiCredentialsFailedCommands", "Credenciales WiFi rechazadas o fallidas.", buildScreen02020cWifiCredentialsFailedCommands({ ssid: readCredentialsSsid(data) }, progress));
    case SCREEN_CODE_CONNECTIVITY_WIFI_CREDENTIALS_AT:
      return resolved(
        input,
        "WiFi credentials entered locally over AT",
        "connectivity screen",
        "buildScreen02020dWifiCredentialsAtCommands",
        "Ingreso local de la clave WiFi con encoder cuando el backend activo es AT.",
        buildScreen02020dWifiCredentialsAtCommands({
          ssid: readCredentialsSsid(data),
          passwordLength: readNumber(data.passwordLength) ?? readNumber(data.password_length) ?? 0,
          selectedCharacter: readString(data.selectedCharacter) ?? readString(data.selected_character) ?? "A",
        }),
      );

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
    case SCREEN_CODE_CONNECTIVITY_ESP_UNRESPONSIVE:
      return resolved(input, "ESP unresponsive", "notification", "buildScreen02030bEspUnresponsiveNotificationCommands", "La F4 agoto los heartbeats y perdio respuesta del ESP.", buildScreen02030bEspUnresponsiveNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_ESP_WATCHDOG_RESET:
      return resolved(input, "ESP watchdog reset", "notification", "buildScreen02030cEspWatchdogResetNotificationCommands", "El ESP volvio a iniciar e informo reset por watchdog.", buildScreen02030cEspWatchdogResetNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_ESP_EXCEPTION_RESET:
      return resolved(input, "ESP exception reset", "notification", "buildScreen02030dEspExceptionResetNotificationCommands", "El ESP volvio a iniciar e informo reset por excepcion.", buildScreen02030dEspExceptionResetNotificationCommands(progress));
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
    case SCREEN_CODE_CONNECTIVITY_AP_DEVICE_CONNECTED:
      return resolved(input, "AP device connected", "notification", "buildScreen020601ApDeviceConnectedNotificationCommands", "Aviso de dispositivo asociado al Access Point.", buildScreen020601ApDeviceConnectedNotificationCommands(progress));
    case SCREEN_CODE_CONNECTIVITY_AP_DEVICE_DISCONNECTED:
      return resolved(input, "AP device disconnected", "notification", "buildScreen020602ApDeviceDisconnectedNotificationCommands", "Aviso de dispositivo que abandono el Access Point.", buildScreen020602ApDeviceDisconnectedNotificationCommands(progress));

    case SCREEN_CODE_SENSORS_MENU:
      return resolved(input, "Sensors menu", "menu screen", "buildScreen030101SensorsMenuCommands", "Menu de sensores: IR, MPU y test de motores.", buildScreen030101SensorsMenuCommands(readMenuArgs(data)));
    case SCREEN_CODE_SENSORS_DISPLAY_MENU:
      return resolved(input, "Display test menu", "menu screen", "buildScreen030500DisplayMenuCommands", "Submenu Testeo > Pantalla con las pruebas OLED y OLED Canvas.", buildScreen030500DisplayMenuCommands(readMenuArgs(data)));
    case SCREEN_CODE_SENSORS_DISPLAY_OLED_CANVAS:
      return resolved(input, "OLED Canvas ready", "service screen", "buildScreen030503OledCanvasReadyCommands", "Pantalla exclusiva que habilita la recepcion transaccional del framebuffer.", buildScreen030503OledCanvasReadyCommands());
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
    case SCREEN_CODE_SETTINGS_PREFS_UNER_FORWARDING_ENABLED:
      return resolved(input, "Port forwarding activado", "notification", "buildScreen050417UnerForwardingEnabledNotificationCommands", "Aviso transitorio luego de persistir y aplicar PF ON en la F4.", buildScreen050417UnerForwardingEnabledNotificationCommands(progress));
    case SCREEN_CODE_SETTINGS_PREFS_UNER_FORWARDING_DISABLED:
      return resolved(input, "Port forwarding desactivado", "notification", "buildScreen050418UnerForwardingDisabledNotificationCommands", "Aviso transitorio luego de persistir y aplicar PF OFF en la F4.", buildScreen050418UnerForwardingDisabledNotificationCommands(progress));
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

function resolveIdentifiedScreen(
  input: ScreenRenderInput,
  data: Record<string, unknown>,
  progress: NotificationProgressArgs,
): ResolvedOledScreen | null {
  const menu = IDENTIFIED_MENUS[input.screenCode];
  if (menu) {
    const menuArgs = readMenuArgs(data);
    return resolved(
      input,
      menu.variant,
      "menu screen",
      "buildMenuScreenCommands",
      menu.description,
      buildMenuScreenCommands({
        screenCode: input.screenCode,
        items: menu.items,
        selectedIndex: menuArgs.selectedIndex,
        firstVisibleIndex: menuArgs.firstVisibleIndex,
      }),
    );
  }

  const notification = IDENTIFIED_NOTIFICATIONS[input.screenCode];
  if (notification) {
    return resolved(
      input,
      notification.variant,
      notification.category,
      "buildIdentifiedNotificationCommands",
      notification.description,
      buildIdentifiedNotificationCommands(notification.lines, progress),
    );
  }

  const screen = IDENTIFIED_SCREENS[input.screenCode];
  if (!screen) {
    return null;
  }

  return resolved(
    input,
    screen.variant,
    screen.category,
    "buildIdentifiedScreenCommands",
    screen.description,
    buildIdentifiedScreenCommands({
      lines: screen.lines,
      footer: screen.footer,
    }),
  );
}

function readDashboardArgs(data: Record<string, unknown>) {
  return {
    espPresent: readBoolean(data.espPresent),
    connection: readConnection(data.connection),
    ssid: readString(data.ssid),
    ipAddress: readString(data.ipAddress),
    backend: readDashboardBackend(data.backend),
    usbActive: readBoolean(data.usbActive),
    rfActive: readBoolean(data.rfActive),
    carMode: readCarMode(data.carMode),
  };
}

function readDashboardBackend(value: unknown): "WEB" | "AT" | "No ESP" {
  return value === "WEB" || value === "AT" ? value : "No ESP";
}

function readModeChangeArgs(data: Record<string, unknown>): ModeChangeScreenArgs {
  return { mode: readMode(data.mode) };
}

function readMenuArgs(data: Record<string, unknown>) {
  return {
    selectedIndex: readNumber(data.selectedIndex) ?? readNumber(data.cursor),
    firstVisibleIndex: readNumber(data.firstVisibleIndex),
    sensoresVisible: readBoolean(data.sensoresVisible) ?? readBoolean(data.sensorsVisible),
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

function readCredentialsSsid(data: Record<string, unknown>): string | undefined {
  return (
    readString(data.ssid) ??
    readString(data.webCredentialsSsid) ??
    readString(data.pendingWifiCredentialsSsid) ??
    readString(data.stationSsid) ??
    readString(data.staSsid)
  );
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
  return value === "FOLLOW" || value === "TEST"
    ? value
    : "IDLE";
}

function readMode(value: unknown): ModeChangeScreenArgs["mode"] {
  return value === "FOLLOW" || value === "TEST" ? value : "IDLE";
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
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "si") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }

  return undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const trimmed = value.trim();
    const parsed = trimmed.toLowerCase().startsWith("0x")
      ? Number.parseInt(trimmed.slice(2), 16)
      : Number(trimmed);

    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }

  return undefined;
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

function readWifiResultSsids(data: Record<string, unknown>): string[] | undefined {
  return (
    readStringArray(data.networkSsids) ??
    readStringArray(data.ssids) ??
    readStringArray(data.wifiSsids) ??
    readNetworkObjectSsids(data.networks) ??
    readNetworkObjectSsids(data.items)
  );
}

function readNetworkObjectSsids(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const ssids = value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      return (
        readString(record.ssid) ??
        readString(record.SSID) ??
        readString(record.name) ??
        readString(record.networkName)
      );
    })
    .filter((ssid): ssid is string => Boolean(ssid));

  return ssids.length > 0 ? ssids : undefined;
}
