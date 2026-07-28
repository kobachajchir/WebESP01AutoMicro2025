export type OledBitmapName = string;

export interface OledBitmapAsset {
  name: OledBitmapName;
  bytes: readonly number[];
}

function bytes(hex: string): readonly number[] {
  return hex
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((value) => Number.parseInt(value.replace(/^0x/i, ""), 16) & 0xff);
}

const IMAGE_CURSOR_BLACK_BYTES = bytes(
  "00 00 01 03 07 0f 1f 3f 7f 0f 1b 19 30 10 00 00",
);

export const OLED_BITMAP_ASSETS: Record<OledBitmapName, OledBitmapAsset> = {
  Icon_Car_bits: {
    name: "Icon_Car_bits",
    bytes: bytes(`
      3f ff ff ff ff fc 21 01 00 00 80 84 21 01 00 00 80 84 21 01
      00 f0 87 84 21 01 00 10 84 84 21 01 00 10 84 84 e1 01 00 10
      84 87 21 01 00 10 84 84 21 01 00 f0 87 84 21 01 00 00 80 84
      21 01 00 00 80 84 21 01 00 00 80 84 3f ff ff ff ff fc
    `),
  },
  Icon_UserBtn_bits: {
    name: "Icon_UserBtn_bits",
    bytes: bytes(`
      e0 03 38 0e cc 19 f6 37 fa 2f fb 6f fd 5f fd 5f
      fd 5f fb 6f fa 2f f6 37 cc 19 38 0e e0 03 00 00
    `),
  },
  Icon_Wifi_bits: {
    name: "Icon_Wifi_bits",
    bytes: bytes(`
      80 0f 00 e0 3f 00 78 f0 00 9c cf 01 ee bf 03 f7 78 07
      3a e7 02 dc df 01 e8 b8 00 70 77 00 a0 2f 00 c0 1d 00
      80 0a 00 00 07 00 00 02 00 00 00 00
    `),
  },
  Icon_Sensors_bits: {
    name: "Icon_Sensors_bits",
    bytes: bytes(`
      1c 00 22 00 e3 3f 22 00 1c 00 00 0e 00 11 ff 31
      00 11 00 0e 1c 00 22 00 e3 3f 22 00 1c 00 00 00
    `),
  },
  Icon_Cursor_bits: {
    name: "Icon_Cursor_bits",
    bytes: IMAGE_CURSOR_BLACK_BYTES,
  },
  image_cursor_black_bits: {
    name: "image_cursor_black_bits",
    bytes: IMAGE_CURSOR_BLACK_BYTES,
  },
  Icon_Config_bits: {
    name: "Icon_Config_bits",
    bytes: bytes(`
      00 00 00 07 80 06 40 01 40 31 c0 30 40 2d 40 12
      a0 0f 50 00 28 00 14 00 0a 00 05 00 03 00 00 00
    `),
  },
  Icon_Prefs_bits: {
    name: "Icon_Prefs_bits",
    bytes: bytes(`
      00 00 00 00 00 00 1c 00 22 00 e3 3f 22 00 1c 00
      00 0e 00 11 ff 31 00 11 00 0e 00 00 00 00 00 00
    `),
  },
  Icon_Refrescar_bits: {
    name: "Icon_Refrescar_bits",
    bytes: bytes(`
      00 00 f0 09 fc 0b 0e 0f 02 0e 83 0f 01 00 01 00
      01 10 00 10 3e 10 0e 08 1e 0e fa 07 f2 01 00 00
    `),
  },
  Icon_Volver_bits: {
    name: "Icon_Volver_bits",
    bytes: bytes(`
      00 00 00 00 00 00 00 00 04 00 06 00 ff 00 06 01
      04 02 00 02 00 01 f8 00 00 00 00 00 00 00 00 00
    `),
  },
  Icon_Link_bits: {
    name: "Icon_Link_bits",
    bytes: bytes(`
      00 1e 00 3f 80 73 c0 61 c0 60 60 70 68 39 6c 1b
      4e 0b 07 03 83 01 c3 01 e7 00 7e 00 3c 00 00 00
    `),
  },
  Icon_Encoder_bits: {
    name: "Icon_Encoder_bits",
    bytes: bytes(`
      f8 03 fc 07 0e 0e f7 1d fb 1b fb 1b fb 1b fb 1b
      fb 1b f7 1d 0e 0e fc 07 f8 03
    `),
  },
  Icon_USB_bits: {
    name: "Icon_USB_bits",
    bytes: bytes(`
      00 00 00 00 30 00 f8 00 30 01 04 02 06 c2 ff ff
      06 c8 04 08 c0 04 e0 03 c0 00 00 00 00 00 00 00
    `),
  },
  Icon_RF_bits: {
    name: "Icon_RF_bits",
    bytes: bytes(`
      00 00 00 00 00 00 04 40 00 02 80 00 12 90 00 09
      21 01 a5 4b 01 95 52 01 a5 4b 01 09 21 01 12 90
      00 02 80 00 04 40 00 00 00 00 00 00 00 00 00 00
    `),
  },
  Icon_Controller_bits: {
    name: "Icon_Controller_bits",
    bytes: bytes(`
      00 00 00 00 00 00 00 00 00 00 80 1f 80 3f 00 e0 ff e0 7f 00
      e0 ff ff ff 00 f0 ff ff ff 01 f0 ff ff ff 01 f8 ff ff f3 03
      f8 f1 ff f3 03 f8 f1 ff de 03 7c c0 7f 9c 07 7c c0 ff de 07
      fc f1 ff f3 07 fc f1 ff f3 07 fe f1 ff ff 07 fe ff ff ff 0f
      fe ff ff ff 0f fe ff ff ff 0f fe 1f 80 ff 0f fe 07 00 fc 0f
      fe 03 00 f8 07 fc 01 00 f0 07 fc 00 00 e0 07 7c 00 00 c0 07
      18 00 00 00 03 00 00 00 00 00 00 00 00 00 00
    `),
  },
  Icon_APWifi_bits: {
    name: "Icon_APWifi_bits",
    bytes: bytes(`
      e0 03 18 0c e4 13 12 24 c9 49 25 52 95 54 c5 51
      60 03 c0 01 80 00 c0 01 40 01 60 03 20 02 00 00
    `),
  },
  Arrow_Right_bits: {
    name: "Arrow_Right_bits",
    bytes: bytes("01 03 07 0f 07 03 01"),
  },
  Arrow_Left_bits: {
    name: "Arrow_Left_bits",
    bytes: bytes("08 0c 0e 0f 0e 0c 08"),
  },
  QRCode_Github_bits: {
    name: "QRCode_Github_bits",
    bytes: bytes(`
      00 00 30 3f 83 fc 00 00 00 00 30 3f 83 fc 00 00
      00 00 30 3f 83 fc 00 00 1f fe 31 ce 03 fc 7f f8
      1f fe 31 ce 03 fc 7f f8 18 06 30 30 03 fc 60 18
      18 06 30 30 03 fc 60 18 18 06 38 30 03 fc 60 18
      18 06 3e 3e 0c 0c 60 18 18 06 3e 3e 0c 0c 60 18
      18 06 38 0f ff fc 60 18 18 06 30 0f ff fc 60 18
      18 06 38 0f ff fc 60 18 1f fe 3e 3e 73 8c 7f f8
      1f fe 3e 3e 73 8c 7f f8 00 00 39 ce 73 8c 00 00
      00 00 31 ce 73 8c 00 00 00 00 39 ce 73 8c 00 00
      ff ff fe 00 03 8f ff ff ff ff fe 00 03 8f ff ff
      3f 00 00 07 ff 83 f7 80 1f 00 00 0f ff 83 e3 00
      1f 00 00 0f ff 83 e3 00 e7 c7 f1 c1 80 7f 80 07
      e7 c7 f1 c1 80 7f 80 07 c7 c7 f1 c1 80 7f 80 07
      00 06 0f f0 0c 73 9c f8 00 06 0f f0 0c 73 9c f8
      07 3f c0 30 70 00 7c 00 07 3f c0 30 70 00 7c 00
      07 3f c0 30 70 00 7c 00 00 c0 30 00 7c 7c 7f f8
      00 c0 30 00 7c 7c 7f f8 18 ff ff 8f 8c 1f e3 e7
      18 ff ff cf 8c 0f e3 e7 18 ff ff cf 8c 0f e3 e3
      00 3e 01 c0 7c 73 e0 00 00 3e 01 c0 7c 73 e0 00
      18 39 fe 31 f3 f3 98 18 18 39 fe 31 f3 f3 9c 18
      18 39 fe 31 f3 f3 9c 18 1f f8 3e 0e 0c 00 03 07
      1f f8 3e 0e 0c 00 03 07 3f f8 7e 0c 0c 00 03 07
      ff ff f1 f0 70 0f e3 07 ff ff f1 f0 70 0f e3 07
      00 00 31 f0 7f 8c 63 f8 00 00 31 f0 7f 8c 63 f8
      00 00 31 f0 3f 8c e3 f8 1f fe 30 30 00 0f e3 e0
      1f fe 30 30 00 0f e3 e0 18 06 30 3f 80 00 03 ff
      18 06 30 3f 80 00 03 ff 18 06 30 3f 80 00 03 ff
      18 06 31 cf 83 80 7f e0 18 06 31 cf 83 80 7f e0
      18 06 3e 30 7f ff e0 00 18 06 3e 30 7f ff e0 00
      18 06 3e 30 7f ff e0 00 1f fe 3f ce 7c 70 03 00
      1f fe 3f ce 7c 70 03 00 00 00 39 cf ff 83 fc f8
      00 00 31 cf ff 83 fc f8 00 00 31 cf ff 83 fc f8
    `),
  },
  Icon_Info_bits: {
    name: "Icon_Info_bits",
    bytes: bytes(`
      e0 03 18 0c c4 10 42 21 c2 20 01 40 c1 41 41 41
      41 41 41 41 42 21 c2 21 04 10 18 0c e0 03 00 00
    `),
  },
  Icon_OperationWarning_bits: {
    name: "Icon_OperationWarning_bits",
    bytes: bytes(`
      00 00 80 01 40 02 40 02 20 04 90 09 90 09 88 11
      88 11 84 21 02 40 82 41 81 81 01 80 fe 7f 00 00
    `),
  },
  Icon_Tool_bits: {
    name: "Icon_Tool_bits",
    bytes: bytes(`
      01 07 83 06 42 01 44 31 c8 30 50 2d 60 12 a0 0f
      d0 00 28 07 94 0d 0a 1b 05 36 03 2c 00 38 00 00
    `),
  },
  Icon_Checked_bits: {
    name: "Icon_Checked_bits",
    bytes: bytes(`
      00 00 00 00 00 00 00 20 00 30 00 38 01 1c 03 0e
      07 07 8e 03 dc 01 f8 00 70 00 20 00 00 00 00 00
    `),
  },
  Icon_Crossed_bits: {
    name: "Icon_Crossed_bits",
    bytes: bytes(`
      00 00 00 00 03 06 07 07 8e 03 dc 01 f8 00 70 00
      f8 00 dc 01 8e 03 07 07 03 06 00 00 00 00 00 00
    `),
  },
  Icon_Wifi_NotConnected_bits: {
    name: "Icon_Wifi_NotConnected_bits",
    bytes: bytes(`
      84 0f 00 68 30 00 10 c0 00 a4 0f 01 42 30 02 91 40 04
      08 85 00 c4 1a 01 20 24 00 10 4a 00 80 15 00 40 20 00
      00 42 00 00 85 00 00 02 01 00 00 00
    `),
  },
  Icon_Wifi_25_bits: {
    name: "Icon_Wifi_25_bits",
    bytes: bytes(`
      80 0f 00 60 30 00 18 c0 00 84 0f 01 62 30 02 11 40 04
      0a 87 02 c4 18 01 28 a0 00 10 47 00 a0 2f 00 c0 1d 00
      80 0a 00 00 07 00 00 02 00 00 00 00
    `),
  },
  Icon_Wifi_50_bits: {
    name: "Icon_Wifi_50_bits",
    bytes: bytes(`
      80 0f 00 60 30 00 18 c0 00 84 0f 01 62 30 02 11 40 04
      0a 87 02 c4 1f 01 e8 b8 00 70 77 00 a0 2f 00 c0 1d 00
      80 0a 00 00 07 00 00 02 00 00 00 00
    `),
  },
  Icon_Wifi_75_bits: {
    name: "Icon_Wifi_75_bits",
    bytes: bytes(`
      80 0f 00 60 30 00 18 c0 00 84 0f 01 e2 3f 02 f1 78 04
      3a e7 02 dc df 01 e8 b8 00 70 77 00 a0 2f 00 c0 1d 00
      80 0a 00 00 07 00 00 02 00 00 00 00
    `),
  },
  Icon_Wifi_100_bits: {
    name: "Icon_Wifi_100_bits",
    bytes: bytes(`
      80 0f 00 e0 3f 00 78 f0 00 9c cf 01 ee bf 03 f7 78 07
      3a e7 02 dc df 01 e8 b8 00 70 77 00 a0 2f 00 c0 1d 00
      80 0a 00 00 07 00 00 02 00 00 00 00
    `),
  },
  Icon_Lock_bits: {
    name: "Icon_Lock_bits",
    bytes: bytes(`
      f0 01 08 02 e4 04 12 09 0a 0a 0a 0a fe 0f 03 18
      e5 14 11 11 11 11 a1 10 a1 10 45 14 03 18 fe 0f
    `),
  },
  Icon_Auto_bits: {
    name: "Icon_Auto_bits",
    bytes: bytes(`
      ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff fc 07 ff ff ff ff ff ff ff ff ff ff ff ff ff ff e0 01 ff ff ff ff ff ff ff ff ff ff ff ff ff ff c0 00 ff ff ff ff ff ff ff ff ff ff ff ff ff ff 80 00 7f ff ff ff ff ff ff ff ff ff ff ff ff f1 00 80 3f ff ff ff ff ff ff ff ff ff ff ff ff ff c0 00 40 1f ff ff ff ff ff ff ff ff ff ff ff ff 1f 0c 10 0f ff ff ff ff ff ff ff ff ff ff ff fc 7f ce 08 07 ff ff ff ff ff ff ff ff ff ff ff f8 ff e3 8c 07 ff ff ff ff ff ff ff ff ff ff ff e3 ff f0 c4 03 ff ff ff ff ff ff ff ff ff ff ff cf ff fc 22 03 ff ff ff ff ff ff ff ff ff ff ff 3f ff ff 01 03 ff ff ff ff ff ff ff ff ff ff fc 7f fe 0f c1 81 ff ff ff ff ff ff ff ff ff ff f9 fe 7e 0f f0 81 ff ff ff ff ff ff ff ff ff ff e3 fc 3e 0f f8 80 ff ff ff ff ff ff ff ff ff ff 8f f3 cf ff fe 00 ff ff ff ff ff ff ff ff ff fe 3f cf e7 ff ff 40 ff ff ff ff ff ff ff ff ff fc 7f 1f fb ff fc 40 ff ff ff ff ff ff ff ff ff f1 fe 7f fb ff f8 40 ff ff ff ff ff ff ff ff ff e7 f8 ff ef ff e0 60 7f ff ff ff ff ff ff ff ff 9f f9 ff 9f ff 80 60 7f ff ff ff ff ff ff ff fe 7f fc fe 7f ff 00 60 ff ff ff ff ff ff ff ff f8 ff ff 3c ff fc 00 60 ff ff ff ff ff ff ff ff f1 ff ff 91 ff f0 00 20 ff ff ff ff ff ff ff ff c7 ff ff ef ff c0 00 41 ff ff ff ff ff ff ff ff 1f ff ff ff ff 80 00 41 ff ff ff ff ff ff ff fe 7f ff ff ff fe 00 00 03 ff ff ff ff ff ff ff f8 ff ff ff ff f8 00 00 07 ff ff ff ff ff ff e3 ff ff ff ff f0 00 00 0f ff ff ff ff ff ff 8f ff ff ff ff c0 00 00 7f ff ff ff ff ff ff 1f ff ff ff ff 00 00 3f ff ff ff ff ff ff fe 7f f9 ff ff fe 00 00 7f ff ff ff ff ff ff fc ff e0 7f ff f8 00 01 ff ff ff ff ff ff ff fc 07 e0 7f ff e0 00 07 ff ff ff ff ff ff ff f8 01 f0 ff ff 80 00 1f ff ff ff ff ff ff e0 00 ff ff ff 00 00 3f ff ff ff ff ff ff c0 00 7f ff fc 00 00 ff ff ff ff ff ff ff 80 00 3f ff f8 00 01 ff ff ff ff ff ff ff 80 10 1f ff e0 00 0f ff ff ff ff ff ff 82 08 0f ff 80 00 1f ff ff ff ff ff ff 0f 84 03 fe 00 00 7f ff ff ff ff ff ff 1c 62 01 fc 00 00 ff ff ff ff ff ff ff 19 01 02 30 00 03 ff ff ff ff ff ff ff 33 81 03 00 00 0f ff ff ff ff ff ff 33 a0 83 80 00 1f ff ff ff ff ff ff 31 94 81 80 00 7f ff ff ff ff ff ff 90 10 41 80 01 ff ff ff ff ff ff ff 90 18 20 80 07 ff ff ff ff ff ff ff 92 0c 20 80 1f ff ff ff ff ff ff ff 9b 04 20 80 3f ff ff ff ff ff ff ff 8b 00 00 80 7f ff ff ff ff ff ff ff c9 00 10 01 ff ff ff ff ff ff ff ff c4 1c 10 07 ff ff ff ff ff ff ff ff e0 1e 10 ff ff ff ff ff ff ff ff ff e2 1d 10 ff ff ff ff ff ff ff ff ff f1 19 10 ff ff ff ff ff ff ff ff ff f8 c3 01 ff ff ff ff ff ff ff ff ff fc 7e 01 ff ff ff ff ff ff ff ff ff fc 1c 03 ff ff ff ff ff ff ff ff ff fe 00 07 ff ff ff ff ff ff ff ff ff ff 00 0f ff ff ff ff ff ff ff ff ff ff c0 3f ff ff ff ff ff ff ff ff ff ff f8 ff ff
    `),
  },
};

export function getOledBitmapAsset(name: string): OledBitmapAsset | undefined {
  return OLED_BITMAP_ASSETS[name];
}
