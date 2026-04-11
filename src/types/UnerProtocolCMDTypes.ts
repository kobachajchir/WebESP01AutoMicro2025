// src/proto/uner_cmds.ts
export const CMD = {
  // Heartbeat
  HEARTBEAT_SET: 0xa0, // payload: u16 period_ms
  HEARTBEAT_ACK: 0xa1, // payload: u16 period_ms
  HEARTBEAT_BEAT: 0xa2, // payload (opcional): u16 period_ms

  // Wi-Fi
  WIFI_GET_MODE: 0x10, // no payload
  WIFI_MODE: 0x11, // payload: u8 mode (0=AP, 1=STATION)
  WIFI_GET_SCAN: 0x12, // no payload
  WIFI_SCAN_LIST: 0x13, // payload: u8 N + N*(u8 ssidLen, ssid[ssidLen], i8 rssi_dBm, u8 sec)
  WIFI_SET_AP: 0x14, // payload: APCreds
  WIFI_SET_STA: 0x15, // payload: STACreds
  WIFI_ACK: 0x16, // payload: u8 cmdRef, u8 code

  // Telemetría (MPU6050)
  TELEMETRY_SET_RATE: 0x20, // payload: u16 period_ms (0 = desactivar)
  TELEMETRY_ACK: 0x21, // payload: u8 code, u16 period_ms
  TELEMETRY_DATA: 0x22, // payload: u8 schema, u16 seq, i16[6] imu_data, i16 tempRaw

  // Preferencias de aplicacion persistidas en NVS
  // APP_PIN_CONFIG request:
  //   validate -> [action=0x01, current_pin_ascii4]
  //   change   -> [action=0x02, current_pin_ascii4, new_pin_ascii4]
  // APP_PIN_CONFIG response/ACK: [action, code]
  APP_PIN_CONFIG: 0x60,

  // APP_THEME_CONFIG request: [base_rgb3, accent_rgb3]
  // APP_THEME_CONFIG response/ACK: [code]
  APP_THEME_CONFIG: 0x61,
} as const;

// Helper para construir payloads específicos
export const PayloadBuilder = {
  // Heartbeat
  heartbeatSet: (periodMs: U16): Uint8Array => {
    const buf = new Uint8Array(2);
    buf[0] = periodMs & 0xff;
    buf[1] = (periodMs >> 8) & 0xff;
    return buf;
  },

  // Wi-Fi AP credentials
  wifiSetAP: (
    ssid: string,
    password: string,
    ip: [U8, U8, U8, U8]
  ): Uint8Array => {
    const ssidBytes = new TextEncoder().encode(ssid);
    const passBytes = new TextEncoder().encode(password);
    const totalLen = 1 + ssidBytes.length + 1 + passBytes.length + 4;

    const buf = new Uint8Array(totalLen);
    let offset = 0;

    buf[offset++] = ssidBytes.length;
    buf.set(ssidBytes, offset);
    offset += ssidBytes.length;

    buf[offset++] = passBytes.length;
    buf.set(passBytes, offset);
    offset += passBytes.length;

    buf.set(ip, offset);

    return buf;
  },

  // Wi-Fi Station credentials
  wifiSetSTA: (
    ssid: string,
    password: string,
    fixedIp: boolean,
    ip?: [U8, U8, U8, U8]
  ): Uint8Array => {
    const ssidBytes = new TextEncoder().encode(ssid);
    const passBytes = new TextEncoder().encode(password);
    const totalLen = 1 + ssidBytes.length + 1 + passBytes.length + 1 + 4;

    const buf = new Uint8Array(totalLen);
    let offset = 0;

    buf[offset++] = ssidBytes.length;
    buf.set(ssidBytes, offset);
    offset += ssidBytes.length;

    buf[offset++] = passBytes.length;
    buf.set(passBytes, offset);
    offset += passBytes.length;

    buf[offset++] = fixedIp ? 1 : 0;
    buf.set(ip || [0, 0, 0, 0], offset);

    return buf;
  },

  // Telemetry rate
  telemetrySetRate: (periodMs: U16): Uint8Array => {
    const buf = new Uint8Array(2);
    buf[0] = periodMs & 0xff;
    buf[1] = (periodMs >> 8) & 0xff;
    return buf;
  },

  appPinConfig: (
    action: U8,
    currentPin: string,
    newPin?: string
  ): Uint8Array => {
    const current = encodePin4(currentPin);
    const next = newPin ? encodePin4(newPin) : new Uint8Array(0);
    const buf = new Uint8Array(1 + current.length + next.length);
    buf[0] = action;
    buf.set(current, 1);
    if (next.length) buf.set(next, 1 + current.length);
    return buf;
  },

  appThemeConfig: (
    base: [U8, U8, U8],
    accent: [U8, U8, U8]
  ): Uint8Array => new Uint8Array([...base, ...accent]),
} as const;

function encodePin4(pin: string): Uint8Array {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("PIN invalido: se esperan 4 digitos");
  }
  return new TextEncoder().encode(pin);
}

// Tipos de datos básicos
export type U8 = number;
export type U16 = number;
export type I8 = number;
export type I16 = number;

// Códigos de error para WIFI_ACK y TELEMETRY_ACK
export const ERROR_CODES = {
  OK: 0,
  ARG: 1, // Argumentos inválidos
  UNSUPPORTED: 2, // Operación no soportada
  BUSY: 3, // Sistema ocupado
  SCAN_FAIL: 4, // Fallo en escaneo Wi-Fi
  AUTH_FAIL: 5, // Fallo de autenticación
  SSID_NOT_FOUND: 6, // SSID no encontrado
  TIMEOUT: 7, // Timeout
  APPLY_FAIL: 8, // Fallo al aplicar configuración
} as const;

export const APP_PIN_ACTION = {
  VALIDATE: 0x01,
  CHANGE: 0x02,
} as const;

export const SETTINGS_ACK_CODES = {
  OK: 0,
  INVALID_PIN: 1,
  ARG: 2,
  SAVE_FAIL: 3,
  BUSY: 4,
} as const;

// Tipos de seguridad Wi-Fi
export const WIFI_SECURITY = {
  OPEN: 0,
  WEP: 1, // Legacy, no recomendado
  WPA_PSK: 2, // TKIP
  WPA2_PSK: 3, // CCMP/AES - típico
  WPA3_PERSONAL: 4, // SAE
  WPA_WPA2_MIXED: 5, // Mixto
} as const;

// Modos Wi-Fi
export const WIFI_MODE = {
  AP: 0, // Access Point
  STATION: 1, // Station/Client
} as const;

// Schemas de telemetría
export const TELEMETRY_SCHEMA = {
  MPU6050_INT16: 0x01, // MPU6050 datos crudos int16
} as const;

// Estructuras de datos
export interface APCreds {
  ssidLen: U8;
  ssid: Uint8Array; // UTF-8
  passLen: U8;
  pass: Uint8Array; // UTF-8
  ip: Uint8Array; // IPv4 [4 bytes]
}

export interface STACreds {
  ssidLen: U8;
  ssid: Uint8Array; // UTF-8
  passLen: U8;
  pass: Uint8Array; // UTF-8
  fixedIp: U8; // 0=DHCP, 1=IP fija
  ip: Uint8Array; // IPv4 [4 bytes], válido si fixedIp=1
}

export interface WiFiNetwork {
  ssidLen: U8;
  ssid: string; // UTF-8
  rssi_dBm: I8; // Potencia de señal
  security: U8; // Tipo de seguridad (ver WIFI_SECURITY)
}

export interface TelemetryDataV1 {
  schema: U8; // = 0x01 (MPU6050_INT16)
  seq: U16; // Contador de paquete (0..65535)
  accX: I16; // Acelerómetro X (crudo)
  accY: I16; // Acelerómetro Y (crudo)
  accZ: I16; // Acelerómetro Z (crudo)
  gyroX: I16; // Giroscopio X (crudo)
  gyroY: I16; // Giroscopio Y (crudo)
  gyroZ: I16; // Giroscopio Z (crudo)
  tempRaw: I16; // Temperatura (cruda)
}

// Funciones de conversión MPU6050 (referencia típica)
export const MPU6050_CONVERSION = {
  // Para rango ±2g: acc_g = accRaw / 16384.0
  ACC_SENSITIVITY_2G: 16384,

  // Para rango ±250°/s: gyro_dps = gyroRaw / 131.0
  GYRO_SENSITIVITY_250DPS: 131,

  // Temperatura: Temp(°C) ≈ (tempRaw / 340) + 36.53
  TEMP_SENSITIVITY: 340,
  TEMP_OFFSET: 36.53,

  // Funciones helper
  convertAcceleration: (raw: I16): number =>
    raw / MPU6050_CONVERSION.ACC_SENSITIVITY_2G,
  convertGyroscope: (raw: I16): number =>
    raw / MPU6050_CONVERSION.GYRO_SENSITIVITY_250DPS,
  convertTemperature: (raw: I16): number =>
    raw / MPU6050_CONVERSION.TEMP_SENSITIVITY + MPU6050_CONVERSION.TEMP_OFFSET,
} as const;
