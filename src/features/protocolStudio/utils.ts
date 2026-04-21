import { FRAME_COMMANDS, IDLE_SUMMARY, NODE_NAMES } from "./catalog";
import type {
  BlockGap,
  BuilderData,
  CommandDefinition,
  CommandField,
  DetectInputResult,
  InvalidCandidate,
  OverallState,
  ScanBlockResult,
  TranslationResult,
  ValidationItem,
  ValidFrameItem,
} from "./types";

export function h2(value: number) {
  return `00${(value & 0xff).toString(16).toUpperCase()}`.slice(-2);
}

export function hx(value: number) {
  return `0x${h2(value)}`;
}

export function bytesToHex(bytes: number[]) {
  return bytes.map(h2).join(" ");
}

export function bytesToRealTerm(bytes: number[]) {
  return bytes.map(hx).join(" ");
}

export function xorChecksum(bytes: number[]) {
  return bytes.reduce((acc, byte) => acc ^ byte, 0);
}

export function nodeName(node: number) {
  return NODE_NAMES[node] ?? `0x${node.toString(16).toUpperCase()}`;
}

export function normalizeCmdKey(cmd: number) {
  return `0x${h2(cmd)}`;
}

export function isPrintableAscii(bytes: number[]) {
  return bytes.every((byte) => byte >= 32 && byte <= 126);
}

export function strToBytes(input: string) {
  return Array.from(new TextEncoder().encode(input));
}

export function parseHexString(input: string) {
  if (!input.trim()) {
    return [];
  }

  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const parsed = Number.parseInt(token.replace(/^0x/i, ""), 16);
      return Number.isNaN(parsed) ? Number.NaN : parsed & 0xff;
    });
}

export function parseLooseList(input: string) {
  return input
    .split(/[,\s]+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((token) => {
      if (/^0x[0-9a-fA-F]{1,2}$/.test(token)) {
        return Number.parseInt(token, 16) & 0xff;
      }
      if (/^[0-9]{1,3}$/.test(token)) {
        return Number.parseInt(token, 10) & 0xff;
      }
      if (/^[0-9a-fA-F]{1,2}$/.test(token)) {
        return Number.parseInt(token, 16) & 0xff;
      }
      return Number.NaN;
    });
}

export function extractHexTokens(input: string) {
  const matches = input.match(/0x[0-9a-fA-F]{1,2}\b|(?<![A-Za-z0-9_])[0-9A-Fa-f]{2}(?![A-Za-z0-9_])/g);
  return matches ?? [];
}

export function asciiPreview(bytes: number[], maxLength = 60) {
  const preview = bytes
    .map((byte) => {
      if (byte === 0x0d) {
        return "\\r";
      }
      if (byte === 0x0a) {
        return "\\n";
      }
      if (byte >= 32 && byte <= 126) {
        return String.fromCharCode(byte);
      }
      return ".";
    })
    .join("");

  return preview.length > maxLength ? `${preview.slice(0, maxLength)}...` : preview;
}

function asciiSearchText(bytes: number[]) {
  return bytes
    .map((byte) => {
      if (byte === 0x0d) {
        return "\r";
      }
      if (byte === 0x0a) {
        return "\n";
      }
      if (byte >= 32 && byte <= 126) {
        return String.fromCharCode(byte);
      }
      return " ";
    })
    .join("");
}

export function shortHex(bytes: number[], maxBytes = 32) {
  const preview = bytesToHex(bytes.slice(0, maxBytes));
  return bytes.length > maxBytes ? `${preview} ...` : preview;
}

export function defaultValueForField(field: CommandField) {
  if (field.type === "select") {
    return field.options?.[0]?.value ?? "";
  }
  if (field.type === "u8") {
    return field.placeholder ?? "0";
  }
  return field.placeholder ?? "";
}

export function createDefaultFieldValues(command: CommandDefinition | undefined) {
  const values: Record<string, string> = {};
  if (!command) {
    return values;
  }

  for (const field of command.fields) {
    values[field.id] = defaultValueForField(field);
  }

  return values;
}

function parseRequiredNumber(rawValue: string, radix: number, label: string) {
  const normalized = rawValue.trim();
  const parsed = Number.parseInt(normalized, radix);

  if (!normalized || Number.isNaN(parsed)) {
    throw new Error(`Valor invalido para ${label}.`);
  }

  return parsed & 0xff;
}

export function buildFormPayload(command: CommandDefinition | undefined, values: Record<string, string>) {
  if (!command) {
    return [];
  }

  const bytes: number[] = [];

  for (const field of command.fields) {
    const rawValue = values[field.id] ?? "";

    if (field.type === "str") {
      const encoded = strToBytes(rawValue);
      bytes.push(encoded.length & 0xff, ...encoded);
      continue;
    }

    if (field.type === "select" || field.type === "u8") {
      bytes.push(parseRequiredNumber(rawValue, 10, field.label));
      continue;
    }

    bytes.push(parseRequiredNumber(rawValue.replace(/^0x/i, ""), 16, field.label));
  }

  return bytes;
}

export function buildFrameData(
  source: string,
  destination: string,
  commandKey: string,
  manualPayload: string,
  fieldValues: Record<string, string>
): BuilderData {
  const cmd = Number.parseInt(commandKey, 16);
  const src = Number.parseInt(source, 10);
  const dst = Number.parseInt(destination, 10);
  const route = ((src & 0x0f) << 4) | (dst & 0x0f);

  let payload: number[];

  if (manualPayload.trim()) {
    payload = parseHexString(manualPayload);
    if (payload.some(Number.isNaN)) {
      throw new Error("Payload manual invalido: revisa los bytes hexadecimales.");
    }
  } else {
    payload = buildFormPayload(FRAME_COMMANDS[commandKey], fieldValues);
  }

  const frameWithoutChecksum = [0x55, 0x4e, 0x45, 0x52, payload.length, 0x3a, 0x02, route, cmd, ...payload];
  const checksum = xorChecksum(frameWithoutChecksum);

  return {
    frame: [...frameWithoutChecksum, checksum],
    payload,
    cmd,
    route,
    chk: checksum,
    len: payload.length,
  };
}

export function countHeaders(bytes: number[]) {
  let count = 0;
  for (let index = 0; index <= bytes.length - 4; index += 1) {
    if (bytes[index] === 0x55 && bytes[index + 1] === 0x4e && bytes[index + 2] === 0x45 && bytes[index + 3] === 0x52) {
      count += 1;
    }
  }
  return count;
}

function interpretLooseArray(bytes: number[], sourceLabel: string): DetectInputResult {
  if (bytes.some(Number.isNaN)) {
    throw new Error("Hay valores invalidos en la entrada.");
  }
  if (bytes.length === 0) {
    throw new Error("No encontre bytes validos.");
  }
  if (bytes.length === 1) {
    return { mode: "cmd", cmd: bytes[0], sourceLabel };
  }
  return {
    mode: "frame",
    bytes,
    sourceLabel,
    forceBlockScan: countHeaders(bytes) > 1 || bytes.length > 64,
  };
}

export function detectInput(rawInput: string): DetectInputResult {
  const trimmed = rawInput.trim();
  const normalizedName = trimmed.toUpperCase().replace(/\s+/g, "_");

  for (const [key, definition] of Object.entries(FRAME_COMMANDS)) {
    if (definition.name.toUpperCase() === normalizedName) {
      return { mode: "cmd", cmd: Number.parseInt(key, 16), sourceLabel: "nombre de comando" };
    }
  }

  if (/^(0x)?[0-9a-fA-F]{1,2}$/.test(trimmed)) {
    return {
      mode: "cmd",
      cmd: Number.parseInt(trimmed.replace(/^0x/i, ""), 16) & 0xff,
      sourceLabel: "CMD suelto",
    };
  }

  const pythonMatch = trimmed.match(/bytes\s*\(\s*\[([\s\S]*?)\]\s*\)/i);
  if (pythonMatch) {
    return interpretLooseArray(parseLooseList(pythonMatch[1]), "Python bytes");
  }

  const braceMatch = trimmed.match(/\{([\s\S]*?)\}/);
  if (braceMatch) {
    return interpretLooseArray(parseLooseList(braceMatch[1]), "array C/Arduino");
  }

  const hexTokens = extractHexTokens(trimmed);
  if (hexTokens.length > 0) {
    const bytes = hexTokens.map((token) => Number.parseInt(token.replace(/^0x/i, ""), 16) & 0xff);
    const headers = countHeaders(bytes);

    return {
      mode: "frame",
      bytes,
      sourceLabel: headers > 1 ? "bloque hex" : "hex / RealTerm",
      forceBlockScan: headers > 1 || bytes.length > 64,
    };
  }

  throw new Error(
    "Formato no reconocido. Prueba con frame hex, RealTerm, array C, Python bytes, nombre de comando o bloque hex."
  );
}

export function okLine(message: string): ValidationItem {
  return { tone: "ok", message };
}

export function warnLine(message: string): ValidationItem {
  return { tone: "warn", message };
}

export function badLine(message: string): ValidationItem {
  return { tone: "bad", message };
}

function describeNetworkInterface(value: number) {
  if (value === 0x01) {
    return "STA";
  }
  if (value === 0x02) {
    return "AP";
  }
  return hx(value);
}

function isNetworkIpDefinition(definition?: CommandDefinition) {
  return ["BOOT_COMPLETE", "NETWORK_IP", "EVT_NETWORK_IP", "EVT_BOOT_COMPLETE"].includes(definition?.name ?? "");
}

function formatNetworkIpPayload(payload: number[]) {
  if (payload.length !== 5) {
    return null;
  }

  const iface = describeNetworkInterface(payload[0]);
  const ip = `${payload[1]}.${payload[2]}.${payload[3]}.${payload[4]}`;

  return {
    iface,
    ip,
    text: `${bytesToHex(payload)} | Interfaz: ${iface} | IP: ${ip}`,
  };
}

function classifyGap(bytes: number[]) {
  const ascii = asciiSearchText(bytes);
  const bootMarkers = [
    "ets Jan  8 2013",
    "rst cause:2",
    "boot mode:(3,6)",
    "load 0x4010f000",
    "tail",
  ];

  if (bootMarkers.some((marker) => ascii.includes(marker))) {
    return {
      kind: "boot_reset" as const,
      title: "Bytes fuera de frame (reinicio ESP)",
      note: "Se detecto el bloque fijo de arranque del ESP8266. En este sistema normalmente indica que el STM se reinicio y obligo al ESP a reiniciarse.",
    };
  }

  return {
    kind: "out_of_frame" as const,
    title: "Bytes fuera de frame",
    note: "Bloque presente en el stream que no forma una trama UNER valida.",
  };
}

export function createIdleTranslation(): TranslationResult {
  return {
    overall: "warn",
    summary: IDLE_SUMMARY,
    typeDetected: "-",
    cmdHex: "-",
    name: "-",
    meaning: "-",
    route: "-",
    nodes: "-",
    len: "-",
    payload: "-",
    validations: [],
    frameBytes: [],
    hasFrame: false,
  };
}

export function createErrorTranslation(message: string): TranslationResult {
  return {
    overall: "bad",
    summary: message,
    typeDetected: "No reconocido",
    cmdHex: "-",
    name: "-",
    meaning: "No se pudo interpretar la entrada.",
    route: "-",
    nodes: "-",
    len: "-",
    payload: "-",
    validations: [badLine(message)],
    frameBytes: [],
    hasFrame: false,
  };
}

export function createEmptyBlockTranslation(): TranslationResult {
  return {
    overall: "warn",
    summary: "No se detectaron frames UNER validos.",
    typeDetected: "Escaneo de bloque",
    cmdHex: "-",
    name: "-",
    meaning: "No se detectaron frames UNER validos.",
    route: "-",
    nodes: "-",
    len: "-",
    payload: "-",
    validations: [warnLine("No se detectaron frames validos en el bloque.")],
    frameBytes: [],
    hasFrame: false,
  };
}

export function analyzeCommandOnly(cmd: number, sourceLabel: string): TranslationResult {
  const key = normalizeCmdKey(cmd);
  const definition = FRAME_COMMANDS[key];
  const validations: ValidationItem[] = [];

  if (definition) {
    validations.push(okLine(`CMD reconocido: ${key} -> ${definition.name}.`));
  } else {
    validations.push(badLine(`CMD no reconocido en la tabla actual: ${key}.`));
  }

  let inferredType = "Comando simple";
  if (definition?.kind === "event") {
    inferredType = "Evento";
  }
  if (definition?.kind === "ack") {
    inferredType = "ACK/NACK";
  }
  if (definition?.kind === "request" || definition?.kind === "mixed") {
    inferredType = "Comando de aplicacion";
  }

  return {
    overall: definition ? "ok" : "warn",
    summary: definition
      ? `Se reconocio correctamente el comando ${key} (${definition.name}). Como no se envio un frame completo, solo se valido el identificador del comando.`
      : "Se interpreto la entrada como un byte de comando, pero no existe en la tabla cargada.",
    typeDetected: `${inferredType} (${sourceLabel})`,
    cmdHex: key,
    name: definition ? definition.name : "Desconocido",
    meaning: definition ? definition.desc : "No hay definicion cargada para este comando.",
    route: "-",
    nodes: "-",
    len: "-",
    payload: "-",
    validations,
    frameBytes: [],
    hasFrame: false,
  };
}

function buildSummary(params: {
  overall: OverallState;
  definition?: CommandDefinition;
  key: string;
  frameRole: string;
  sourceLabel: string;
  payload: number[];
  src: number | null;
  dst: number | null;
}) {
  const { overall, definition, key, frameRole, sourceLabel, payload, src, dst } = params;

  if (overall === "bad") {
    return `La entrada se interpreto como ${frameRole.toLowerCase()} (${sourceLabel}), pero el frame no es valido segun UNER v2.`;
  }

  if (!definition) {
    return `El frame esta bien formado a nivel transporte, pero el CMD ${key} no existe en la tabla cargada.`;
  }

  const networkIpPayload = isNetworkIpDefinition(definition) ? formatNetworkIpPayload(payload) : null;

  let extra = "";
  if (networkIpPayload) {
    extra = ` Notifica la interfaz ${networkIpPayload.iface} con IP ${networkIpPayload.ip}.`;
  } else if (definition.kind === "mixed" && payload.length > 0 && payload[0] === 0xfe) {
    extra = " Se detecto una notificacion asincrona con finalizador 0xFE.";
  } else if (frameRole === "Respuesta / mixto" || frameRole === "Posible response") {
    extra = " Por el payload, puede tratarse de una respuesta o notificacion.";
  } else if (frameRole === "Request") {
    extra = " Parece una solicitud enviada al destino.";
  } else if (frameRole === "Evento") {
    extra = " Corresponde a un evento emitido por el sistema.";
  }

  return `Frame correcto. ${key} = ${definition.name}. Ruta ${nodeName(src ?? 0)} -> ${nodeName(dst ?? 0)}.${extra}`;
}

export function analyzeFrame(frame: number[], sourceLabel: string): TranslationResult {
  const validations: ValidationItem[] = [];
  const hasMinLength = frame.length >= 10;

  if (!hasMinLength) {
    validations.push(
      badLine(`Frame demasiado corto: ${frame.length} bytes. Un frame UNER valido necesita al menos 10 bytes.`)
    );
  } else {
    validations.push(okLine(`Longitud minima suficiente: ${frame.length} bytes.`));
  }

  const headerOk =
    frame.length >= 4 &&
    frame[0] === 0x55 &&
    frame[1] === 0x4e &&
    frame[2] === 0x45 &&
    frame[3] === 0x52;
  validations.push(headerOk ? okLine("Header correcto: 55 4E 45 52 ('UNER').") : badLine("Header invalido."));

  const lenField = frame.length >= 5 ? frame[4] : null;
  const token = frame.length >= 6 ? frame[5] : null;
  const version = frame.length >= 7 ? frame[6] : null;
  const route = frame.length >= 8 ? frame[7] : null;
  const cmd = frame.length >= 9 ? frame[8] : null;
  const checksumReceived = frame.length >= 1 ? frame[frame.length - 1] : null;

  if (token !== null) {
    validations.push(token === 0x3a ? okLine("TOKEN correcto: 0x3A.") : badLine(`TOKEN invalido: ${hx(token)}.`));
  }
  if (version !== null) {
    validations.push(version === 0x02 ? okLine("VER correcta: 0x02.") : badLine(`VER invalida o inesperada: ${hx(version)}.`));
  }

  let payload: number[] = [];
  let lenOk = false;
  if (hasMinLength && lenField !== null) {
    payload = frame.slice(9, frame.length - 1);
    lenOk = payload.length === lenField;
    validations.push(
      lenOk
        ? okLine(`LEN correcto: ${lenField} bytes.`)
        : badLine(`LEN incorrecto: el frame dice ${lenField} bytes pero hay ${payload.length} bytes reales de payload.`)
    );
  }

  let checksumCalc: number | null = null;
  let checksumOk = false;
  if (frame.length >= 2 && checksumReceived !== null) {
    checksumCalc = xorChecksum(frame.slice(0, -1));
    checksumOk = checksumCalc === checksumReceived;
    validations.push(
      checksumOk
        ? okLine(`Checksum correcto: recibido ${hx(checksumReceived)}, calculado ${hx(checksumCalc)}.`)
        : badLine(`Checksum incorrecto: recibido ${hx(checksumReceived)}, calculado ${hx(checksumCalc)}.`)
    );
  }

  let src: number | null = null;
  let dst: number | null = null;
  if (route !== null) {
    src = (route >> 4) & 0x0f;
    dst = route & 0x0f;
    validations.push(okLine(`ROUTE interpretado: src=${hx(src)} (${nodeName(src)}), dst=${hx(dst)} (${nodeName(dst)}).`));
  }

  const key = cmd !== null ? normalizeCmdKey(cmd) : "-";
  const definition = FRAME_COMMANDS[key];

  if (cmd !== null) {
    validations.push(
      definition ? okLine(`CMD reconocido: ${key} -> ${definition.name}.`) : warnLine(`CMD no reconocido en la tabla actual: ${key}.`)
    );
  }

  let payloadRuleOk: boolean | null = null;
  if (definition && lenOk) {
    if (payload.length < definition.minPayload || payload.length > definition.maxPayload) {
      payloadRuleOk = false;
      validations.push(
        warnLine(
          `Payload fuera del rango esperado para ${definition.name}: esperado entre ${definition.minPayload} y ${definition.maxPayload} bytes, llegaron ${payload.length}.`
        )
      );
    } else {
      payloadRuleOk = true;
      validations.push(okLine(`Payload dentro del rango esperado para ${definition.name}.`));
    }
  }

  let frameRole = "Frame";
  if (definition?.kind === "event") {
    frameRole = "Evento";
  } else if (definition?.kind === "ack") {
    frameRole = "ACK/NACK";
  } else if (definition?.kind === "mixed") {
    frameRole =
      payload.length > 0 && payload[0] === 0xfe ? "Push / notificacion" : payload.length > 0 ? "Respuesta / mixto" : "Request";
  } else if (definition?.kind === "request") {
    frameRole = payload.length === 0 ? "Request" : "Posible response";
  }

  const payloadHex = payload.length > 0 ? bytesToHex(payload) : "(vacio)";
  let payloadText =
    payload.length > 0 && isPrintableAscii(payload)
      ? `${payloadHex} | ASCII: "${String.fromCharCode(...payload)}"`
      : payloadHex;

  const networkIpPayload = definition && isNetworkIpDefinition(definition) ? formatNetworkIpPayload(payload) : null;
  if (networkIpPayload) {
    payloadText = networkIpPayload.text;
    validations.push(
      okLine(`Notificacion de red detectada: interfaz ${networkIpPayload.iface} con IP ${networkIpPayload.ip}.`)
    );
  }

  if (definition?.name === "ACK" && payload.length === 2) {
    validations.push(okLine(`ACK de ${normalizeCmdKey(payload[0])} con status ${hx(payload[1])}.`));
  }
  if (definition?.name === "NACK" && payload.length === 2) {
    validations.push(warnLine(`NACK del comando ${normalizeCmdKey(payload[0])} con reason ${hx(payload[1])}.`));
  }
  if (definition?.name === "GET_SCAN_RESULTS" && payload.length === 1 && payload[0] === 0xfe) {
    validations.push(okLine("Detectado finalizador asincrono de scan: payload [FE]."));
  }
  if ((definition?.name === "CONNECT_WIFI" || definition?.name === "START_AP") && payload.length === 5 && payload[0] === 0xfe) {
    validations.push(
      okLine(`Detectada notificacion de finalizacion con IP: ${payload[1]}.${payload[2]}.${payload[3]}.${payload[4]}.`)
    );
  }
  if (definition?.name === "REBOOT_ESP" && payload.length === 1) {
    const rebootMode = payload[0] === 0x01 ? "modo AP" : "modo normal";
    payloadText = `${payloadHex} | ${rebootMode}`;
    validations.push(okLine(`Pedido de reinicio ESP con bootMode=${rebootMode}.`));
  }
  if (definition?.name === "WIFI_GET_DETAIL" && payload.length >= 4) {
    const ssidLen = payload[0] ?? 0;
    if (payload.length >= ssidLen + 4) {
      const ssidBytes = payload.slice(1, 1 + ssidLen);
      const signalStrength = payload[1 + ssidLen] > 127
        ? payload[1 + ssidLen] - 256
        : payload[1 + ssidLen];
      const encryptionType = payload[2 + ssidLen];
      const channel = payload[3 + ssidLen];
      const ssid = new TextDecoder().decode(new Uint8Array(ssidBytes));
      payloadText =
        `${payloadHex} | ssid="${ssid}", signalStrength=${signalStrength}dBm, ` +
        `encryptionType=${encryptionType}, channel=${channel}`;
      validations.push(okLine("Detalle de red WiFi reconocido."));
    }
  }
  if (
    (definition?.name === "GET_CAR_MODE" ||
      definition?.name === "EVT_CAR_MODE_CHANGED") &&
    payload.length === 1
  ) {
    const modeLabel = carModeLabel(payload[0]);
    payloadText = `${payloadHex} | ${modeLabel}`;
    validations.push(okLine(`Modo de auto recibido: ${modeLabel} (${hx(payload[0])}).`));
  }
  if (
    definition?.name === "EVT_MENU_SELECTION_CHANGED" &&
    payload.length >= 5
  ) {
    const screenCode =
      payload[0] |
      (payload[1] << 8) |
      (payload[2] << 16) |
      (payload[3] << 24);
    const selectedIndex = payload.length >= 7 ? payload[4] : null;
    const itemCount = payload.length >= 7 ? payload[5] : payload[4];
    const source = payload.length >= 7 ? payload[6] : payload[5];
    payloadText =
      `${payloadHex} | screenCode=0x${screenCode
        .toString(16)
        .toUpperCase()
        .padStart(6, "0")}` +
      (selectedIndex !== null ? `, selectedIndex=${selectedIndex}` : "") +
      `, itemCount=${itemCount ?? "-"}, source=${source ?? "-"}`;
    validations.push(okLine("Evento de pantalla/menu reconocido para sincronizar el OLED web."));
  }

  const baseValid = headerOk && lenOk && checksumOk && token === 0x3a && version === 0x02;
  let overall: OverallState = "ok";
  if (!baseValid) {
    overall = "bad";
  } else if (!definition || payloadRuleOk === false) {
    overall = "warn";
  }

  return {
    overall,
    summary: buildSummary({
      overall,
      definition,
      key,
      frameRole,
      sourceLabel,
      payload,
      src,
      dst,
    }),
    typeDetected: `${frameRole} (${sourceLabel})`,
    cmdHex: key,
    name: definition ? definition.name : "Desconocido",
    meaning: definition ? definition.desc : "No hay definicion cargada para este CMD.",
    route: route !== null ? hx(route) : "-",
    nodes: src !== null && dst !== null ? `${nodeName(src)} -> ${nodeName(dst)}` : "-",
    len: lenField !== null ? `${lenField} bytes` : "-",
    payload: payloadText,
    validations,
    frameBytes: frame,
    hasFrame: true,
  };
}

function carModeLabel(value: number) {
  if (value === 0x00) return "IDLE_MODE";
  if (value === 0x01) return "FOLLOW_MODE";
  if (value === 0x02) return "TEST_MODE";
  return `valor fuera de CAR_MODE_MAX: ${value}`;
}

export function scanBlock(bytes: number[], sourceLabel: string): ScanBlockResult {
  const validFrames: ValidFrameItem[] = [];
  const invalidCandidates: InvalidCandidate[] = [];
  const gaps: BlockGap[] = [];

  let lastConsumed = 0;
  let index = 0;

  while (index <= bytes.length - 4) {
    const isHeader =
      bytes[index] === 0x55 &&
      bytes[index + 1] === 0x4e &&
      bytes[index + 2] === 0x45 &&
      bytes[index + 3] === 0x52;

    if (!isHeader) {
      index += 1;
      continue;
    }

    if (index > lastConsumed) {
      gaps.push({
        start: lastConsumed,
        end: index - 1,
        bytes: bytes.slice(lastConsumed, index),
        ...classifyGap(bytes.slice(lastConsumed, index)),
      });
    }

    if (index + 10 > bytes.length) {
      invalidCandidates.push({
        offset: index,
        reason: "Header detectado pero no hay suficientes bytes para un frame completo minimo.",
        preview: bytes.slice(index),
      });
      lastConsumed = index;
      break;
    }

    const lenField = bytes[index + 4];
    const totalLength = 10 + lenField;

    if (index + totalLength > bytes.length) {
      invalidCandidates.push({
        offset: index,
        reason: `Header valido pero el frame queda truncado. LEN=${lenField}, total esperado=${totalLength} bytes.`,
        preview: bytes.slice(index, Math.min(bytes.length, index + 24)),
      });
      lastConsumed = index;
      break;
    }

    const frame = bytes.slice(index, index + totalLength);
    const tokenOk = frame[5] === 0x3a;
    const versionOk = frame[6] === 0x02;
    const checksumReceived = frame[frame.length - 1];
    const checksumCalc = xorChecksum(frame.slice(0, -1));
    const checksumOk = checksumReceived === checksumCalc;
    const lenOk = frame.slice(9, -1).length === lenField;

    if (tokenOk && versionOk && lenOk && checksumOk) {
      validFrames.push({
        offset: index,
        frame,
        analysis: analyzeFrame(frame, `${sourceLabel} @${index}`),
      });
      index += totalLength;
      lastConsumed = index;
    } else {
      const reasons: string[] = [];
      if (!tokenOk) {
        reasons.push(`TOKEN invalido (${hx(frame[5])})`);
      }
      if (!versionOk) {
        reasons.push(`VER invalida (${hx(frame[6])})`);
      }
      if (!lenOk) {
        reasons.push("LEN inconsistente");
      }
      if (!checksumOk) {
        reasons.push(`CHK invalido (rx=${hx(checksumReceived)}, calc=${hx(checksumCalc)})`);
      }

      invalidCandidates.push({
        offset: index,
        reason: reasons.join(", "),
        preview: frame.slice(0, Math.min(frame.length, 24)),
      });

      index += 1;
      lastConsumed = index;
    }
  }

  if (lastConsumed < bytes.length) {
    gaps.push({
      start: lastConsumed,
      end: bytes.length - 1,
      bytes: bytes.slice(lastConsumed),
      ...classifyGap(bytes.slice(lastConsumed)),
    });
  }

  const knownCount = validFrames.filter((item) => Boolean(FRAME_COMMANDS[item.analysis.cmdHex])).length;
  const unknownCount = validFrames.length - knownCount;

  return {
    sourceLabel,
    totalBytes: bytes.length,
    validFrames,
    invalidCandidates,
    gaps,
    knownCount,
    unknownCount,
  };
}
