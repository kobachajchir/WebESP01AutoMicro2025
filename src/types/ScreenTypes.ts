export const SCREEN_GET_CURRENT_COMMAND = "stm.screen.getCurrent";

export const SCREEN_SOURCES = {
  MENU: 0x01,
  RENDER: 0x02,
  NOTIFICATION: 0x03,
  PERMISSION: 0x04,
  SYSTEM: 0x05,
} as const;

export const SCREEN_SOURCE_NAMES: Record<number, string> = {
  [SCREEN_SOURCES.MENU]: "MENU",
  [SCREEN_SOURCES.RENDER]: "RENDER",
  [SCREEN_SOURCES.NOTIFICATION]: "NOTIFICATION",
  [SCREEN_SOURCES.PERMISSION]: "PERMISSION",
  [SCREEN_SOURCES.SYSTEM]: "SYSTEM",
};

export interface ScreenMeta {
  title: string;
  menu: number;
  submenu: number;
  page: number;
  source?: number;
  sourceName?: string;
  payload?: number[];
}

export const SCREEN_META_BY_CODE: Record<number, ScreenMeta> = {
  0x010001: screenMeta("Startup / arranque", 0x010001, SCREEN_SOURCES.SYSTEM, [0x01, 0x00, 0x01, 0x00, 0x05]),
  0x010101: screenMeta("Dashboard / Inicio", 0x010101, SCREEN_SOURCES.RENDER, [0x01, 0x01, 0x01, 0x00, 0x02]),
  0x010102: screenMeta("Cambio de modo", 0x010102, SCREEN_SOURCES.RENDER, [0x02, 0x01, 0x01, 0x00, 0x02]),
  0x010201: screenMeta("Menu principal", 0x010201, SCREEN_SOURCES.MENU, [0x01, 0x02, 0x01, 0x00, 0x01]),

  0x020101: screenMeta("Menu WiFi", 0x020101, SCREEN_SOURCES.MENU, [0x01, 0x01, 0x02, 0x00, 0x01]),
  0x020201: screenMeta("Estado WiFi / Info AP", 0x020201, SCREEN_SOURCES.RENDER, [0x01, 0x02, 0x02, 0x00, 0x02]),
  0x020202: screenMeta("Buscando redes WiFi", 0x020202, SCREEN_SOURCES.RENDER, [0x02, 0x02, 0x02, 0x00, 0x02]),
  0x020203: screenMeta("Resultados WiFi", 0x020203, SCREEN_SOURCES.MENU, [0x03, 0x02, 0x02, 0x00, 0x01]),
  0x020204: screenMeta("WiFi no conectado", 0x020204, SCREEN_SOURCES.NOTIFICATION, [0x04, 0x02, 0x02, 0x00, 0x03]),
  0x020205: screenMeta("Conectando WiFi", 0x020205, SCREEN_SOURCES.NOTIFICATION, [0x05, 0x02, 0x02, 0x00, 0x03]),
  0x020206: screenMeta("WiFi conectado", 0x020206, SCREEN_SOURCES.NOTIFICATION, [0x06, 0x02, 0x02, 0x00, 0x03]),
  0x020207: screenMeta("Busqueda WiFi completada", 0x020207, SCREEN_SOURCES.NOTIFICATION, [0x07, 0x02, 0x02, 0x00, 0x03]),
  0x020208: screenMeta("Busqueda WiFi cancelada", 0x020208, SCREEN_SOURCES.NOTIFICATION, [0x08, 0x02, 0x02, 0x00, 0x03]),

  0x020301: screenMeta("Menu Enlace ESP", 0x020301, SCREEN_SOURCES.MENU, [0x01, 0x03, 0x02, 0x00, 0x01]),
  0x020302: screenMeta("Chequeando conexion ESP", 0x020302, SCREEN_SOURCES.NOTIFICATION, [0x02, 0x03, 0x02, 0x00, 0x03]),
  0x020303: screenMeta("Solicitando firmware ESP", 0x020303, SCREEN_SOURCES.NOTIFICATION, [0x03, 0x03, 0x02, 0x00, 0x03]),
  0x020304: screenMeta("Reset ESP enviado", 0x020304, SCREEN_SOURCES.NOTIFICATION, [0x04, 0x03, 0x02, 0x00, 0x03]),
  0x020305: screenMeta("Requiere chequear conexion ESP", 0x020305, SCREEN_SOURCES.NOTIFICATION, [0x05, 0x03, 0x02, 0x00, 0x03]),
  0x020306: screenMeta("Boot ESP recibido", 0x020306, SCREEN_SOURCES.NOTIFICATION, [0x06, 0x03, 0x02, 0x00, 0x03]),
  0x020307: screenMeta("Firmware ESP recibido", 0x020307, SCREEN_SOURCES.NOTIFICATION, [0x07, 0x03, 0x02, 0x00, 0x03]),
  0x020308: screenMeta("Modo ESP actualizado", 0x020308, SCREEN_SOURCES.NOTIFICATION, [0x08, 0x03, 0x02, 0x00, 0x03]),
  0x020309: screenMeta("AP iniciado", 0x020309, SCREEN_SOURCES.NOTIFICATION, [0x09, 0x03, 0x02, 0x00, 0x03]),

  0x020401: screenMeta("USB conectado", 0x020401, SCREEN_SOURCES.NOTIFICATION, [0x01, 0x04, 0x02, 0x00, 0x03]),
  0x020402: screenMeta("USB desconectado", 0x020402, SCREEN_SOURCES.NOTIFICATION, [0x02, 0x04, 0x02, 0x00, 0x03]),
  0x020501: screenMeta("Web server listo", 0x020501, SCREEN_SOURCES.NOTIFICATION, [0x01, 0x05, 0x02, 0x00, 0x03]),
  0x020502: screenMeta("Cliente web conectado", 0x020502, SCREEN_SOURCES.NOTIFICATION, [0x02, 0x05, 0x02, 0x00, 0x03]),
  0x020503: screenMeta("Cliente web desconectado", 0x020503, SCREEN_SOURCES.NOTIFICATION, [0x03, 0x05, 0x02, 0x00, 0x03]),

  0x030101: screenMeta("Menu Sensores", 0x030101, SCREEN_SOURCES.MENU, [0x01, 0x01, 0x03, 0x00, 0x01]),
  0x030201: screenMeta("Valores IR", 0x030201, SCREEN_SOURCES.RENDER, [0x01, 0x02, 0x03, 0x00, 0x02]),
  0x030301: screenMeta("Valores MPU", 0x030301, SCREEN_SOURCES.RENDER, [0x01, 0x03, 0x03, 0x00, 0x02]),
  0x030401: screenMeta("Radar", 0x030401, SCREEN_SOURCES.RENDER, [0x01, 0x04, 0x03, 0x00, 0x02]),

  0x040101: screenMeta("Test de motores", 0x040101, SCREEN_SOURCES.RENDER, [0x01, 0x01, 0x04, 0x00, 0x02]),

  0x050101: screenMeta("Menu Configuracion", 0x050101, SCREEN_SOURCES.MENU, [0x01, 0x01, 0x05, 0x00, 0x01]),
  0x050201: screenMeta("Acerca de / Proyecto", 0x050201, SCREEN_SOURCES.RENDER, [0x01, 0x02, 0x05, 0x00, 0x02]),
  0x050202: screenMeta("Acerca de / Repo QR", 0x050202, SCREEN_SOURCES.RENDER, [0x02, 0x02, 0x05, 0x00, 0x02]),
  0x050301: screenMeta("Config tiempo de avisos", 0x050301, SCREEN_SOURCES.RENDER, [0x01, 0x03, 0x05, 0x00, 0x02]),

  0x060101: screenMeta("Control conectado", 0x060101, SCREEN_SOURCES.NOTIFICATION, [0x01, 0x01, 0x06, 0x00, 0x03]),
  0x060102: screenMeta("Control desconectado", 0x060102, SCREEN_SOURCES.NOTIFICATION, [0x02, 0x01, 0x06, 0x00, 0x03]),
  0x060201: screenMeta("Comando/ECHO recibido", 0x060201, SCREEN_SOURCES.NOTIFICATION, [0x01, 0x02, 0x06, 0x00, 0x03]),
  0x060202: screenMeta("PING recibido", 0x060202, SCREEN_SOURCES.NOTIFICATION, [0x02, 0x02, 0x06, 0x00, 0x03]),
  0x060301: screenMeta("Conexion ESP exitosa", 0x060301, SCREEN_SOURCES.RENDER, [0x01, 0x03, 0x06, 0x00, 0x02]),
  0x060302: screenMeta("Conexion ESP fallida", 0x060302, SCREEN_SOURCES.RENDER, [0x02, 0x03, 0x06, 0x00, 0x02]),

  0x070101: screenMeta("Pantalla de prueba", 0x070101, SCREEN_SOURCES.RENDER, [0x01, 0x01, 0x07, 0x00, 0x02]),

  0x080101: screenMeta("Pantalla bloqueada", 0x080101, SCREEN_SOURCES.RENDER, [0x01, 0x01, 0x08, 0x00, 0x02]),
  0x080102: screenMeta("PIN incorrecto", 0x080102, SCREEN_SOURCES.RENDER, [0x02, 0x01, 0x08, 0x00, 0x02]),
  0x080103: screenMeta("PIN modificado", 0x080103, SCREEN_SOURCES.RENDER, [0x03, 0x01, 0x08, 0x00, 0x02]),
  0x080104: screenMeta("Ingreso de PIN", 0x080104, SCREEN_SOURCES.PERMISSION, [0x04, 0x01, 0x08, 0x00, 0x04]),
  0x080105: screenMeta("PIN validando", 0x080105, SCREEN_SOURCES.PERMISSION, [0x05, 0x01, 0x08, 0x00, 0x04]),
  0x080106: screenMeta("PIN rechazado", 0x080106, SCREEN_SOURCES.PERMISSION, [0x06, 0x01, 0x08, 0x00, 0x04]),
  0x080107: screenMeta("PIN sin respuesta / timeout", 0x080107, SCREEN_SOURCES.PERMISSION, [0x07, 0x01, 0x08, 0x00, 0x04]),
  0x080108: screenMeta("PIN bloqueado", 0x080108, SCREEN_SOURCES.PERMISSION, [0x08, 0x01, 0x08, 0x00, 0x04]),
  0x080109: screenMeta("Permiso denegado", 0x080109, SCREEN_SOURCES.NOTIFICATION, [0x09, 0x01, 0x08, 0x00, 0x03]),
};

function screenMeta(
  title: string,
  screenCode: number,
  source: number,
  payload: number[]
): ScreenMeta {
  return {
    title,
    menu: (screenCode >>> 16) & 0xff,
    submenu: (screenCode >>> 8) & 0xff,
    page: screenCode & 0xff,
    source,
    sourceName: SCREEN_SOURCE_NAMES[source],
    payload,
  };
}

export type ScreenUpdateKind =
  | "screen.changed"
  | "screen.current"
  | "device.response";

export interface ScreenReport {
  cmd?: number;
  src?: number;
  dst?: number;
  len?: number;
  screen_code: number;
  screenCode: number;
  screenCodeHex: string;
  menu: number;
  submenu: number;
  page: number;
  source?: number;
  sourceName?: string;
  payload?: number[];
  rawData?: Record<string, unknown>;
}

export interface CurrentScreen extends ScreenReport {
  title: string;
  known: boolean;
  meta?: ScreenMeta;
  updateKind: ScreenUpdateKind;
  receivedAt: number;
  requestId?: string;
}

export function normalizeScreenReport(data: unknown): ScreenReport | null {
  if (!isRecord(data)) {
    return null;
  }

  const payload = readNumberArray(data.payload);
  const screenCode =
    readUint32(data.screenCode) ??
    readUint32(data.screen_code) ??
    readUint32(data.screenCodeHex) ??
    readScreenCodeFromPayload(payload);

  if (screenCode === null) {
    return null;
  }

  const source = readByte(data.source) ?? readPayloadSource(payload);
  const sourceName =
    readString(data.sourceName) ??
    (source === undefined ? undefined : SCREEN_SOURCE_NAMES[source]);

  return {
    cmd: readByte(data.cmd),
    src: readByte(data.src),
    dst: readByte(data.dst),
    len: readInteger(data.len),
    screen_code: screenCode,
    screenCode,
    screenCodeHex: formatScreenCodeHex(screenCode),
    menu: readByte(data.menu) ?? ((screenCode >>> 16) & 0xff),
    submenu: readByte(data.submenu) ?? ((screenCode >>> 8) & 0xff),
    page: readByte(data.page) ?? (screenCode & 0xff),
    source,
    sourceName,
    payload,
    rawData: data,
  };
}

export function toCurrentScreen(
  report: ScreenReport,
  updateKind: ScreenUpdateKind,
  requestId?: string
): CurrentScreen {
  const meta = SCREEN_META_BY_CODE[report.screenCode];

  return {
    ...report,
    title: meta?.title ?? "Pantalla desconocida",
    known: Boolean(meta),
    meta,
    updateKind,
    receivedAt: Date.now(),
    requestId,
  };
}

export function formatScreenCodeHex(screenCode: number): string {
  const normalized = screenCode >>> 0;
  const width = normalized > 0xffffff ? 8 : 6;
  return `0x${normalized.toString(16).toUpperCase().padStart(width, "0")}`;
}

function readScreenCodeFromPayload(payload: number[] | undefined): number | null {
  if (!payload || payload.length < 4) {
    return null;
  }

  return (
    payload[0] |
    (payload[1] << 8) |
    (payload[2] << 16) |
    (payload[3] << 24)
  ) >>> 0;
}

function readPayloadSource(payload: number[] | undefined): number | undefined {
  return payload && payload.length >= 5 ? payload[4] : undefined;
}

function readNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.map(readByte);
  return values.every((item) => item !== undefined)
    ? (values as number[])
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readByte(value: unknown): number | undefined {
  const numberValue = readInteger(value);
  if (numberValue === undefined) {
    return undefined;
  }

  return numberValue & 0xff;
}

function readUint32(value: unknown): number | null {
  const numberValue = readInteger(value);
  return numberValue === undefined ? null : numberValue >>> 0;
}

function readInteger(value: unknown): number | undefined {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
