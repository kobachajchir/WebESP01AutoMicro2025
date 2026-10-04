import { buildIdentifiedScreenCommands } from "./identifiedScreens";
import { buildMenuScreenCommands } from "./menuScreens";
import type { ScreenRenderInput, ResolvedOledScreen } from "./screenRenderRegistry";
const names: Record<number, string> = {
  [0x010202]: "CORE_FAVORITES",
  [0x02020E]: "CONNECTIVITY_OSK_WIFI_SSID",
  [0x02020F]: "CONNECTIVITY_OSK_WIFI_PASSWORD",
  [0x020210]: "CONNECTIVITY_OSK_WIFI_IPV4",
  [0x030203]: "SENSORS_IR_AMBIENT",
  [0x030600]: "SENSORS_KEYBOARD_MENU",
  [0x030601]: "TEST_KEYBOARD_ASCII",
  [0x030602]: "TEST_KEYBOARD_NUMERIC",
  [0x050204]: "SETTINGS_ABOUT_BOOTLOADER",
  [0x050500]: "SETTINGS_SYSTEM_MENU",
  [0x050501]: "SETTINGS_SYSTEM_BOOTLOADER_CONFIRM",
  [0x050419]: "SETTINGS_PREFS_IR_MENU",
  [0x05041A]: "SETTINGS_PREFS_IR_OBJECTS",
  [0x05041B]: "SETTINGS_PREFS_IR_LINE",
  [0x05041C]: "SETTINGS_PREFS_IR_LIGHTS",
  [0x090101]: "INPUT_KEYBOARD_ALPHA",
  [0x090102]: "INPUT_KEYBOARD_NUMERIC",
};
// Labels from F4 menu_definition.c. Dynamic favorites, OSK state and
// notification variants have no complete remote snapshot: never fabricate them.
const menus: Record<number, string[]> = {
  0x030600: ["Teclado ASCII", "Teclado numerico", "Volver"],
  0x050500: ["Reiniciar a BootV2", "Reiniciar a BootST", "Volver"],
};
export function resolveRemediatedScreen(input: ScreenRenderInput): ResolvedOledScreen | null {
  const name = names[input.screenCode];
  if (!name) return null;
  const data = input.rawData ?? {};
  const ir = data.irEmitters as { objects?: unknown; line?: unknown; lights?: unknown } | null;
  const irKnown = ir && typeof ir.objects === "boolean" && typeof ir.line === "boolean" && typeof ir.lights === "boolean";
  const labels = input.screenCode === 0x050419 && irKnown
    ? [`Objetos ${ir.objects ? "ON" : "OFF"}`, `Linea ${ir.line ? "ON" : "OFF"}`, `Luces ${ir.lights ? "ON" : "OFF"}`, "Volver"]
    : menus[input.screenCode];
  const selected = typeof data.selectedIndex === "number" ? data.selectedIndex : undefined;
  const menuReady = labels && data.itemCount === labels.length && selected !== undefined;
  const title = input.title || name.replaceAll("_", " ");
  return {
    title,
    variant: menuReady ? "reported-menu" : "identity-only",
    category: menuReady ? "menu screen" : "identified screen",
    builder: menuReady ? "buildMenuScreenCommands" : "buildIdentifiedScreenCommands",
    description: menuReady ? "Menú con selección publicada por F4." : "Identidad conocida. El protocolo no expone todos los datos necesarios para reproducir esta pantalla; no se simulan cursor, texto, confirmación ni variante de notificación.",
    commands: menuReady ? buildMenuScreenCommands({ screenCode: input.screenCode, items: labels.map(label => ({ label })), selectedIndex: selected }) : buildIdentifiedScreenCommands({ lines: [title, `0x${input.screenCode.toString(16).padStart(6, "0")}`, "Sin datos remotos"] }),
  };
}
