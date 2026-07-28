import { buildMenuScreenCommands } from "./menuScreens";
import {
  SCREEN_CODE_SENSORS_DISPLAY_MENU,
  SCREEN_CODE_SENSORS_DISPLAY_OLED_CANVAS,
  SCREEN_CODE_SENSORS_DISPLAY_ROTATION_MPU_TEST,
  SCREEN_CODE_SENSORS_DISPLAY_ROTATION_TEST,
  SCREEN_CODE_SENSORS_MENU,
} from "./screenCodes";
import { clear, textAt } from "./helpers";
import type { MenuScreenItem, OledCommand } from "./types";

export const displayMenuItems: MenuScreenItem[] = [
  { label: "Test orient.", iconRef: "Icon_Smartphone_bits", screenCode: SCREEN_CODE_SENSORS_DISPLAY_ROTATION_TEST },
  { label: "Auto MPU", iconRef: "Icon_Smartphone_bits", screenCode: SCREEN_CODE_SENSORS_DISPLAY_ROTATION_MPU_TEST },
  { label: "OLED Canvas", iconRef: "Icon_Smartphone_bits", screenCode: SCREEN_CODE_SENSORS_DISPLAY_OLED_CANVAS },
  { label: "Volver", iconRef: "Icon_Volver_bits", screenCode: SCREEN_CODE_SENSORS_MENU },
];

export function buildScreen030500DisplayMenuCommands(
  args: { selectedIndex?: number; firstVisibleIndex?: number } = {},
): OledCommand[] {
  return buildMenuScreenCommands({
    screenCode: SCREEN_CODE_SENSORS_DISPLAY_MENU,
    items: displayMenuItems,
    selectedIndex: args.selectedIndex,
    firstVisibleIndex: args.firstVisibleIndex,
  });
}

export function buildScreen030503OledCanvasReadyCommands(): OledCommand[] {
  return [
    clear(),
    ...textAt(29, 20, "Listo para", "Font7x10"),
    ...textAt(15, 36, "recibir canvas", "Font7x10"),
  ];
}
