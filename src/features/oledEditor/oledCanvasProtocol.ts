import {
  OLED_CANVAS_BYTES,
  OLED_CANVAS_FORMAT,
  OLED_CANVAS_HEIGHT,
  OLED_CANVAS_WIDTH,
  formatCrc32,
  type OledCanvasRaster,
} from "./oledCanvasRasterizer.ts";

export const OLED_CANVAS_SCREEN_CODE = 0x030503;
export const OLED_CANVAS_WEB_CHUNK_BYTES = 512;

export interface OledCanvasChunk {
  offset: number;
  bytes: Uint8Array;
  dataBase64: string;
}

export interface OledCanvasBeginResponse {
  transferId: number;
  chunkBytes: typeof OLED_CANVAS_WEB_CHUNK_BYTES;
  nextOffset: 0;
}

export interface OledCanvasCommitResponse {
  transferId: number;
  state: "rendered";
  bytes: typeof OLED_CANVAS_BYTES;
  crc32: string;
  screenCode: typeof OLED_CANVAS_SCREEN_CODE;
}

export interface OledCanvasCancelResponse {
  transferId: number;
  state: "canceled";
}

export function buildOledCanvasBeginArgs(raster: OledCanvasRaster): Record<string, unknown> {
  return {
    width: OLED_CANVAS_WIDTH,
    height: OLED_CANVAS_HEIGHT,
    format: OLED_CANVAS_FORMAT,
    totalBytes: OLED_CANVAS_BYTES,
    crc32: raster.crc32Hex,
  };
}

export function splitOledCanvasChunks(framebuffer: Uint8Array): OledCanvasChunk[] {
  if (framebuffer.length !== OLED_CANVAS_BYTES) {
    throw new Error(`OLED Canvas requiere exactamente ${OLED_CANVAS_BYTES} bytes`);
  }
  const chunks: OledCanvasChunk[] = [];
  for (let offset = 0; offset < framebuffer.length; offset += OLED_CANVAS_WEB_CHUNK_BYTES) {
    const bytes = framebuffer.slice(offset, offset + OLED_CANVAS_WEB_CHUNK_BYTES);
    chunks.push({ offset, bytes, dataBase64: bytesToBase64(bytes) });
  }
  return chunks;
}

export function buildOledCanvasChunkArgs(
  transferId: number,
  chunk: OledCanvasChunk,
): Record<string, unknown> {
  return { transferId, offset: chunk.offset, dataBase64: chunk.dataBase64 };
}

export function buildOledCanvasCommitArgs(transferId: number): Record<string, unknown> {
  return { transferId };
}

export function buildOledCanvasCancelArgs(transferId: number): Record<string, unknown> {
  return { transferId };
}

export function shouldCancelOledCanvasForMode(isRunning: boolean, mode: number | null): boolean {
  return isRunning && mode !== null && mode !== 0x02;
}

export function shouldCancelOledCanvasForScreen(
  isRunning: boolean,
  screenCode: number | null | undefined,
): boolean {
  return isRunning && screenCode !== null && screenCode !== undefined &&
    screenCode !== OLED_CANVAS_SCREEN_CODE;
}

export function validateOledCanvasBeginResponse(data: unknown): OledCanvasBeginResponse {
  const record = requireRecord(data, "begin");
  const transferId = requireTransferId(record.transferId);
  if (record.chunkBytes !== OLED_CANVAS_WEB_CHUNK_BYTES || record.nextOffset !== 0) {
    throw new Error("Respuesta oledCanvas.begin incompatible con chunks de 512 bytes");
  }
  return { transferId, chunkBytes: OLED_CANVAS_WEB_CHUNK_BYTES, nextOffset: 0 };
}

export function validateOledCanvasChunkResponse(
  data: unknown,
  transferId: number,
  expectedNextOffset: number,
): void {
  const record = requireRecord(data, "chunk");
  if (requireTransferId(record.transferId) !== transferId || record.nextOffset !== expectedNextOffset) {
    throw new Error("La confirmacion de chunk no coincide con la transferencia u offset enviados");
  }
}

export function validateOledCanvasCancelResponse(
  data: unknown,
  transferId: number,
): OledCanvasCancelResponse {
  const record = requireRecord(data, "cancel");
  if (requireTransferId(record.transferId) !== transferId || record.state !== "canceled") {
    throw new Error("La confirmacion de cancelacion no coincide con la transferencia enviada");
  }
  return { transferId, state: "canceled" };
}

export function validateOledCanvasCommitResponse(
  data: unknown,
  transferId: number,
  expectedCrc32: number | string,
): OledCanvasCommitResponse {
  const record = requireRecord(data, "commit");
  const crc32 = normalizeCrc32(record.crc32);
  const expected = normalizeCrc32(expectedCrc32);
  if (
    requireTransferId(record.transferId) !== transferId ||
    record.state !== "rendered" ||
    record.bytes !== OLED_CANVAS_BYTES ||
    crc32 !== expected ||
    record.screenCode !== OLED_CANVAS_SCREEN_CODE
  ) {
    throw new Error("La respuesta final no confirma el framebuffer, CRC y screenCode enviados");
  }
  return {
    transferId,
    state: "rendered",
    bytes: OLED_CANVAS_BYTES,
    crc32,
    screenCode: OLED_CANVAS_SCREEN_CODE,
  };
}

export function bytesToBase64(bytes: ArrayLike<number>): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = (bytes[index] ?? 0) & 0xff;
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = hasSecond ? (bytes[index + 1] ?? 0) & 0xff : 0;
    const third = hasThird ? (bytes[index + 2] ?? 0) & 0xff : 0;
    const triplet = (first << 16) | (second << 8) | third;
    output += alphabet[(triplet >>> 18) & 0x3f];
    output += alphabet[(triplet >>> 12) & 0x3f];
    output += hasSecond ? alphabet[(triplet >>> 6) & 0x3f] : "=";
    output += hasThird ? alphabet[triplet & 0x3f] : "=";
  }
  return output;
}

function requireRecord(value: unknown, operation: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Respuesta oledCanvas.${operation} invalida`);
  }
  return value as Record<string, unknown>;
}

function requireTransferId(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 0xffff) {
    throw new Error("transferId OLED invalido");
  }
  return parsed;
}

function normalizeCrc32(value: unknown): string {
  if (typeof value === "number" && Number.isInteger(value)) return formatCrc32(value);
  if (typeof value !== "string") throw new Error("CRC32 OLED ausente");
  const normalized = value.trim().replace(/^0x/i, "").toUpperCase();
  if (!/^[0-9A-F]{8}$/.test(normalized)) throw new Error("CRC32 OLED invalido");
  return normalized;
}
