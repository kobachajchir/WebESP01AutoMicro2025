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
} as const;

function assertWifiSsidLength(ssidBytes: Uint8Array, allowEmpty = false) {
  if (!allowEmpty && ssidBytes.length < 1) {
    throw new Error("SSID debe tener al menos 1 caracter.");
  }
  if (ssidBytes.length > 32) {
    throw new Error("SSID no puede superar 32 bytes.");
  }
}

function assertWifiPasswordLength(
  passBytes: Uint8Array,
  { allowOpenAp = false }: { allowOpenAp?: boolean } = {}
) {
  if (allowOpenAp && passBytes.length === 0) {
    return;
  }
  if (passBytes.length < 8) {
    throw new Error("Password debe tener al menos 8 caracteres.");
  }
}

function ensureIPv4Bytes(ip: readonly number[]): [number, number, number, number] {
  if (ip.length !== 4) {
    throw new Error("La IP debe tener exactamente 4 bytes.");
  }

  const normalized = ip.map((part) => {
    if (!Number.isInteger(part) || part < 0 || part > 255) {
      throw new Error("Cada byte de IP debe ser un entero entre 0 y 255.");
    }
    return part;
  }) as [number, number, number, number];

  return normalized;
}

export function isValidIPv4String(value: string): boolean {
  const parts = value.trim().split(".");
  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    if (part === "") {
      return false;
    }
    const numeric = Number(part);
    return Number.isInteger(numeric) && numeric >= 0 && numeric <= 255;
  });
}

export function ipStringToBytes(value: string): [number, number, number, number] {
  if (!isValidIPv4String(value)) {
    throw new Error("La IP debe tener formato IPv4 valido.");
  }

  return ensureIPv4Bytes(value.trim().split(".").map((part) => Number(part)));
}

export function ipBytesToString(value: readonly number[]): string {
  const [a, b, c, d] = ensureIPv4Bytes(value);
  return `${a}.${b}.${c}.${d}`;
}

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
    const ipBytes = ensureIPv4Bytes(ip);

    assertWifiSsidLength(ssidBytes);
    assertWifiPasswordLength(passBytes, { allowOpenAp: true });

    const totalLen = 1 + ssidBytes.length + 1 + passBytes.length + 4;

    const buf = new Uint8Array(totalLen);
    let offset = 0;

    buf[offset++] = ssidBytes.length;
    buf.set(ssidBytes, offset);
    offset += ssidBytes.length;

    buf[offset++] = passBytes.length;
    buf.set(passBytes, offset);
    offset += passBytes.length;

    buf.set(ipBytes, offset);

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
    const ipBytes = ensureIPv4Bytes(ip ?? [0, 0, 0, 0]);

    assertWifiSsidLength(ssidBytes);
    assertWifiPasswordLength(passBytes);
    if (fixedIp && !ip) {
      throw new Error("Para IP fija debe enviarse una IPv4 explicita.");
    }

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
    buf.set(ipBytes, offset);

    return buf;
  },

  // Telemetry rate
  telemetrySetRate: (periodMs: U16): Uint8Array => {
    const buf = new Uint8Array(2);
    buf[0] = periodMs & 0xff;
    buf[1] = (periodMs >> 8) & 0xff;
    return buf;
  },
} as const;

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
