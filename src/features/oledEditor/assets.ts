import { getOledBitmapAsset } from "../../screens/bitmapAssets.ts";
import type { OledFont } from "../../screens";
import type { BitOrder, ImageAsset } from "./types";

export interface EditorFontPreset {
  id: OledFont;
  label: string;
  width: number;
  height: number;
}

export interface EditorBitmapAssetDefinition extends ImageAsset {
  label: string;
  category: string;
  dataRef: string;
  description?: string;
}

interface SharedAssetSeed {
  id: string;
  label: string;
  width: number;
  height: number;
  bitOrder: BitOrder;
  category: string;
  description?: string;
  sourceRef?: string;
}

export const OLED_FONT_PRESETS: readonly EditorFontPreset[] = [
  { id: "Font7x10", label: "Font 7x10", width: 7, height: 10 },
  { id: "Font11x18", label: "Font 11x18", width: 11, height: 18 },
];

const SHARED_ASSET_SEEDS: readonly SharedAssetSeed[] = [
  {
    id: "Icon_Car_bits",
    label: "Auto lateral",
    width: 48,
    height: 13,
    bitOrder: "lsb",
    category: "vehiculo",
  },
  {
    id: "Icon_UserBtn_bits",
    label: "Boton usuario",
    width: 15,
    height: 16,
    bitOrder: "lsb",
    category: "ui",
  },
  {
    id: "Icon_Wifi_bits",
    label: "Wifi",
    width: 19,
    height: 16,
    bitOrder: "lsb",
    category: "conectividad",
  },
  {
    id: "Icon_Sensors_bits",
    label: "Sensores",
    width: 16,
    height: 16,
    bitOrder: "lsb",
    category: "sensores",
  },
  {
    id: "Icon_Cursor_bits",
    label: "Cursor menu",
    width: 8,
    height: 16,
    bitOrder: "lsb",
    category: "ui",
    sourceRef: "image_cursor_black_bits",
  },
  {
    id: "Icon_Config_bits",
    label: "Config",
    width: 16,
    height: 16,
    bitOrder: "lsb",
    category: "ui",
  },
  {
    id: "Icon_Prefs_bits",
    label: "Preferencias",
    width: 16,
    height: 16,
    bitOrder: "lsb",
    category: "ui",
  },
  {
    id: "Icon_Refrescar_bits",
    label: "Refrescar",
    width: 16,
    height: 16,
    bitOrder: "lsb",
    category: "ui",
  },
  {
    id: "Icon_Volver_bits",
    label: "Volver",
    width: 16,
    height: 16,
    bitOrder: "lsb",
    category: "ui",
  },
  {
    id: "Icon_Link_bits",
    label: "Link",
    width: 16,
    height: 16,
    bitOrder: "lsb",
    category: "conectividad",
  },
  {
    id: "Icon_Encoder_bits",
    label: "Encoder",
    width: 13,
    height: 13,
    bitOrder: "lsb",
    category: "ui",
  },
  {
    id: "Icon_USB_bits",
    label: "USB",
    width: 16,
    height: 16,
    bitOrder: "lsb",
    category: "conectividad",
  },
  {
    id: "Icon_RF_bits",
    label: "RF",
    width: 17,
    height: 16,
    bitOrder: "lsb",
    category: "conectividad",
  },
  {
    id: "Icon_Controller_bits",
    label: "Control",
    width: 37,
    height: 27,
    bitOrder: "lsb",
    category: "control",
  },
  {
    id: "Icon_APWifi_bits",
    label: "AP Wifi",
    width: 15,
    height: 16,
    bitOrder: "lsb",
    category: "conectividad",
  },
  {
    id: "Arrow_Right_bits",
    label: "Flecha derecha",
    width: 4,
    height: 7,
    bitOrder: "lsb",
    category: "ui",
  },
  {
    id: "Arrow_Left_bits",
    label: "Flecha izquierda",
    width: 4,
    height: 7,
    bitOrder: "lsb",
    category: "ui",
  },
  {
    id: "QRCode_Github_bits",
    label: "QR Github",
    width: 64,
    height: 64,
    bitOrder: "msb",
    category: "qr",
  },
  {
    id: "QrCodeAutoWEBGithub",
    label: "QR Auto WEB Github",
    width: 64,
    height: 64,
    bitOrder: "msb",
    category: "qr",
    description: "Alias draft del QR del proyecto para el editor.",
    sourceRef: "QRCode_Github_bits",
  },
  {
    id: "Icon_Info_bits",
    label: "Info",
    width: 16,
    height: 16,
    bitOrder: "lsb",
    category: "ui",
  },
  {
    id: "Icon_Tool_bits",
    label: "Herramienta",
    width: 16,
    height: 16,
    bitOrder: "lsb",
    category: "ui",
  },
  {
    id: "Icon_Checked_bits",
    label: "Check",
    width: 14,
    height: 16,
    bitOrder: "lsb",
    category: "ui",
  },
  {
    id: "Icon_Crossed_bits",
    label: "Cruz",
    width: 11,
    height: 16,
    bitOrder: "lsb",
    category: "ui",
  },
  {
    id: "Icon_Wifi_NotConnected_bits",
    label: "Wifi offline",
    width: 19,
    height: 16,
    bitOrder: "lsb",
    category: "conectividad",
  },
  {
    id: "Icon_Wifi_25_bits",
    label: "Wifi 25%",
    width: 19,
    height: 16,
    bitOrder: "lsb",
    category: "conectividad",
  },
  {
    id: "Icon_Wifi_50_bits",
    label: "Wifi 50%",
    width: 19,
    height: 16,
    bitOrder: "lsb",
    category: "conectividad",
  },
  {
    id: "Icon_Wifi_75_bits",
    label: "Wifi 75%",
    width: 19,
    height: 16,
    bitOrder: "lsb",
    category: "conectividad",
  },
  {
    id: "Icon_Wifi_100_bits",
    label: "Wifi 100%",
    width: 19,
    height: 16,
    bitOrder: "lsb",
    category: "conectividad",
  },
  {
    id: "Icon_Lock_bits",
    label: "Candado",
    width: 13,
    height: 16,
    bitOrder: "lsb",
    category: "ui",
  },
  {
    id: "Icon_Auto_bits",
    label: "Splash Auto",
    width: 128,
    height: 64,
    bitOrder: "msb",
    category: "vehiculo",
  },
];

export const SHARED_EDITOR_BITMAPS: readonly EditorBitmapAssetDefinition[] =
  SHARED_ASSET_SEEDS.flatMap((seed) => {
    const asset = getOledBitmapAsset(seed.sourceRef ?? seed.id);

    if (!asset) {
      return [];
    }

    return [
      {
        id: seed.id,
        name: seed.id,
        label: seed.label,
        width: seed.width,
        height: seed.height,
        bytes: [...asset.bytes],
        bitOrder: seed.bitOrder,
        source: "shared" as const,
        category: seed.category,
        description: seed.description,
        draft: true,
        dataRef: seed.id,
      },
    ];
  });

export function buildEditorAssetIndex(
  customAssets: Record<string, ImageAsset> = {},
): Record<string, EditorBitmapAssetDefinition> {
  const shared = Object.fromEntries(
    SHARED_EDITOR_BITMAPS.map((asset) => [asset.id, asset]),
  );
  const custom = Object.fromEntries(
    Object.values(customAssets).map((asset) => [
      asset.id,
      {
        ...asset,
        label: asset.name,
        category: asset.source === "generated" ? "paint" : "upload",
        dataRef: asset.id,
      },
    ]),
  );

  return {
    ...shared,
    ...custom,
  };
}

export function listEditorAssets(
  customAssets: Record<string, ImageAsset> = {},
): EditorBitmapAssetDefinition[] {
  return Object.values(buildEditorAssetIndex(customAssets)).sort((left, right) =>
    left.category === right.category
      ? left.label.localeCompare(right.label)
      : left.category.localeCompare(right.category),
  );
}
