import { FONT_HEIGHT, FONT_WIDTH, getGlyphRows } from "../../screens/oledBitmapFont.ts";
import type { OledFont } from "../../screens/types";
import { buildEditorAssetIndex } from "./assets.ts";
import type { CanvasObject, EditorDocument, ImageAsset, MonoColor, Point } from "./types";

export const OLED_CANVAS_WIDTH = 128;
export const OLED_CANVAS_HEIGHT = 64;
export const OLED_CANVAS_BYTES = 1024;
export const OLED_CANVAS_FORMAT = "ssd1306-page-lsb" as const;

export interface OledCanvasRaster {
  width: typeof OLED_CANVAS_WIDTH;
  height: typeof OLED_CANVAS_HEIGHT;
  format: typeof OLED_CANVAS_FORMAT;
  pixels: Uint8Array;
  framebuffer: Uint8Array;
  crc32: number;
  crc32Hex: string;
}

/** Rasteriza el documento vivo sin depender del canvas DOM del editor. */
export function rasterizeOledDocument(document: EditorDocument): OledCanvasRaster {
  if (document.screen.width !== OLED_CANVAS_WIDTH || document.screen.height !== OLED_CANVAS_HEIGHT) {
    throw new Error(
      `OLED Canvas requiere ${OLED_CANVAS_WIDTH}x${OLED_CANVAS_HEIGHT}; ` +
        `el documento es ${document.screen.width}x${document.screen.height}`,
    );
  }

  const pixels = new Uint8Array(OLED_CANVAS_WIDTH * OLED_CANVAS_HEIGHT);
  if (document.screen.background === "white") pixels.fill(1);
  const assetIndex = buildEditorAssetIndex(document.assetsById);

  for (const id of document.zOrder) {
    const object = document.objectsById[id];
    if (!object || object.hidden || object.overlay) continue;
    rasterizeObject(pixels, object, assetIndex);
  }

  const framebuffer = packPageMajor(pixels);
  const crc32 = crc32IsoHdlc(framebuffer);
  return {
    width: OLED_CANVAS_WIDTH,
    height: OLED_CANVAS_HEIGHT,
    format: OLED_CANVAS_FORMAT,
    pixels,
    framebuffer,
    crc32,
    crc32Hex: formatCrc32(crc32),
  };
}

export function packPageMajor(pixels: ArrayLike<number>): Uint8Array {
  if (pixels.length !== OLED_CANVAS_WIDTH * OLED_CANVAS_HEIGHT) {
    throw new Error(`Se esperaban ${OLED_CANVAS_WIDTH * OLED_CANVAS_HEIGHT} pixeles`);
  }
  const bytes = new Uint8Array(OLED_CANVAS_BYTES);
  for (let y = 0; y < OLED_CANVAS_HEIGHT; y += 1) {
    for (let x = 0; x < OLED_CANVAS_WIDTH; x += 1) {
      if (pixels[y * OLED_CANVAS_WIDTH + x]) {
        bytes[x + Math.floor(y / 8) * OLED_CANVAS_WIDTH] |= 1 << (y & 7);
      }
    }
  }
  return bytes;
}

export function unpackPageMajor(framebuffer: ArrayLike<number>): Uint8Array {
  if (framebuffer.length !== OLED_CANVAS_BYTES) {
    throw new Error(`Se esperaban ${OLED_CANVAS_BYTES} bytes de framebuffer`);
  }
  const pixels = new Uint8Array(OLED_CANVAS_WIDTH * OLED_CANVAS_HEIGHT);
  for (let y = 0; y < OLED_CANVAS_HEIGHT; y += 1) {
    for (let x = 0; x < OLED_CANVAS_WIDTH; x += 1) {
      const value = framebuffer[x + Math.floor(y / 8) * OLED_CANVAS_WIDTH] ?? 0;
      pixels[y * OLED_CANVAS_WIDTH + x] = (value >> (y & 7)) & 1;
    }
  }
  return pixels;
}

/** CRC-32/ISO-HDLC: poly 0xEDB88320, init/xorout 0xFFFFFFFF. */
export function crc32IsoHdlc(bytes: ArrayLike<number>): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= (bytes[index] ?? 0) & 0xff;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) !== 0 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function formatCrc32(crc32: number): string {
  return (crc32 >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

function rasterizeObject(
  pixels: Uint8Array,
  object: CanvasObject,
  assetsById: Record<string, ImageAsset>,
) {
  switch (object.kind) {
    case "rectangle": {
      const x = rounded(object.x);
      const y = rounded(object.y);
      const width = positiveSize(object.width);
      const height = positiveSize(object.height);
      if (object.fill) fillRect(pixels, x, y, width, height, colorBit(object.fill));
      if (object.stroke) {
        strokePolygon(
          pixels,
          [
            { x, y },
            { x: x + width - 1, y },
            { x: x + width - 1, y: y + height - 1 },
            { x, y: y + height - 1 },
          ],
          colorBit(object.stroke),
          object.strokeWidth,
          true,
        );
      }
      break;
    }
    case "circle": {
      const cx = rounded(object.cx);
      const cy = rounded(object.cy);
      const radius = Math.max(0, rounded(object.radius));
      if (object.fill) fillCircle(pixels, cx, cy, radius, colorBit(object.fill));
      if (object.stroke) {
        strokeCircle(pixels, cx, cy, radius, colorBit(object.stroke), object.strokeWidth);
      }
      break;
    }
    case "line":
      drawLine(
        pixels,
        rounded(object.x1),
        rounded(object.y1),
        rounded(object.x2),
        rounded(object.y2),
        colorBit(object.stroke),
        object.strokeWidth,
      );
      break;
    case "triangle":
    case "polygon": {
      const points = object.points.map((point) => ({ x: rounded(point.x), y: rounded(point.y) }));
      if (object.fill && points.length >= 3) fillPolygon(pixels, points, colorBit(object.fill));
      if (object.stroke && points.length >= 2) {
        strokePolygon(pixels, points, colorBit(object.stroke), object.strokeWidth, true);
      }
      break;
    }
    case "text":
      drawText(
        pixels,
        object.text,
        object.font,
        rounded(object.x),
        rounded(object.y),
        object.align ?? "left",
        colorBit(object.fill),
      );
      break;
    case "image": {
      const asset = assetsById[object.assetId];
      if (asset) {
        drawAsset(
          pixels,
          asset,
          rounded(object.x),
          rounded(object.y),
          positiveSize(object.width),
          positiveSize(object.height),
        );
      }
      break;
    }
    case "bitmap":
      drawPixelLayer(
        pixels,
        object.pixelData,
        positiveSize(object.width),
        positiveSize(object.height),
        rounded(object.x),
        rounded(object.y),
      );
      break;
  }
}

function drawText(
  pixels: Uint8Array,
  text: string,
  font: OledFont,
  x: number,
  y: number,
  align: "left" | "center" | "right",
  value: number,
) {
  const width = FONT_WIDTH[font];
  const height = FONT_HEIGHT[font];
  const bitStart = font === "Font11x18" ? 15 : 7;
  (text || "").split("\n").forEach((line, lineIndex) => {
    const glyphs = Array.from(line);
    const lineWidth = glyphs.length * width;
    const originX =
      align === "center" ? x - Math.floor(lineWidth / 2) : align === "right" ? x - lineWidth : x;
    const originY = y + lineIndex * (height + 1);
    glyphs.forEach((char, glyphIndex) => {
      getGlyphRows(font, char).forEach((row, rowIndex) => {
        for (let column = 0; column < width; column += 1) {
          if (((row >> (bitStart - column)) & 1) !== 0) {
            setPixel(pixels, originX + glyphIndex * width + column, originY + rowIndex, value);
          }
        }
      });
    });
  });
}

function drawAsset(
  pixels: Uint8Array,
  asset: ImageAsset,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (asset.width <= 0 || asset.height <= 0) return;
  const bytesPerRow = Math.ceil(asset.width / 8);
  for (let targetY = 0; targetY < height; targetY += 1) {
    const sourceY = Math.min(asset.height - 1, Math.floor((targetY * asset.height) / height));
    for (let targetX = 0; targetX < width; targetX += 1) {
      const sourceX = Math.min(asset.width - 1, Math.floor((targetX * asset.width) / width));
      const byte = asset.bytes[sourceY * bytesPerRow + (sourceX >> 3)] ?? 0;
      const bit = asset.bitOrder === "msb" ? 7 - (sourceX & 7) : sourceX & 7;
      if (((byte >> bit) & 1) !== 0) setPixel(pixels, x + targetX, y + targetY, 1);
    }
  }
}

function drawPixelLayer(
  pixels: Uint8Array,
  source: ArrayLike<number>,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  for (let localY = 0; localY < height; localY += 1) {
    for (let localX = 0; localX < width; localX += 1) {
      if (source[localY * width + localX]) setPixel(pixels, x + localX, y + localY, 1);
    }
  }
}

function fillRect(
  pixels: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number,
  value: number,
) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) setPixel(pixels, px, py, value);
  }
}

function fillCircle(
  pixels: Uint8Array,
  cx: number,
  cy: number,
  radius: number,
  value: number,
) {
  const radiusSquared = radius * radius;
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radiusSquared) setPixel(pixels, x, y, value);
    }
  }
}

function strokeCircle(
  pixels: Uint8Array,
  cx: number,
  cy: number,
  radius: number,
  value: number,
  strokeWidth: number,
) {
  let x = radius;
  let y = 0;
  let error = 1 - radius;
  while (x >= y) {
    [
      [cx + x, cy + y], [cx + y, cy + x], [cx - y, cy + x], [cx - x, cy + y],
      [cx - x, cy - y], [cx - y, cy - x], [cx + y, cy - x], [cx + x, cy - y],
    ].forEach(([px, py]) => drawBrush(pixels, px, py, value, strokeWidth));
    y += 1;
    if (error < 0) error += 2 * y + 1;
    else {
      x -= 1;
      error += 2 * (y - x + 1);
    }
  }
}

function fillPolygon(pixels: Uint8Array, points: Point[], value: number) {
  const minY = Math.max(0, Math.min(...points.map((point) => point.y)));
  const maxY = Math.min(OLED_CANVAS_HEIGHT - 1, Math.max(...points.map((point) => point.y)));
  for (let y = minY; y <= maxY; y += 1) {
    const intersections: number[] = [];
    for (let index = 0; index < points.length; index += 1) {
      const first = points[index];
      const second = points[(index + 1) % points.length];
      if ((first.y > y) === (second.y > y) || first.y === second.y) continue;
      intersections.push(first.x + ((y - first.y) * (second.x - first.x)) / (second.y - first.y));
    }
    intersections.sort((left, right) => left - right);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      for (let x = Math.ceil(intersections[index]); x <= Math.floor(intersections[index + 1]); x += 1) {
        setPixel(pixels, x, y, value);
      }
    }
  }
}

function strokePolygon(
  pixels: Uint8Array,
  points: Point[],
  value: number,
  strokeWidth: number,
  close: boolean,
) {
  const edgeCount = close ? points.length : Math.max(0, points.length - 1);
  for (let index = 0; index < edgeCount; index += 1) {
    const first = points[index];
    const second = points[(index + 1) % points.length];
    drawLine(pixels, first.x, first.y, second.x, second.y, value, strokeWidth);
  }
}

function drawLine(
  pixels: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  value: number,
  strokeWidth: number,
) {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    drawBrush(pixels, x, y, value, strokeWidth);
    if (x === x1 && y === y1) break;
    const doubled = error * 2;
    if (doubled >= dy) { error += dy; x += sx; }
    if (doubled <= dx) { error += dx; y += sy; }
  }
}

function drawBrush(
  pixels: Uint8Array,
  x: number,
  y: number,
  value: number,
  strokeWidth: number,
) {
  const size = Math.max(1, rounded(strokeWidth));
  const start = -Math.floor((size - 1) / 2);
  for (let dy = start; dy < start + size; dy += 1) {
    for (let dx = start; dx < start + size; dx += 1) setPixel(pixels, x + dx, y + dy, value);
  }
}

function setPixel(pixels: Uint8Array, x: number, y: number, value: number) {
  if (x < 0 || x >= OLED_CANVAS_WIDTH || y < 0 || y >= OLED_CANVAS_HEIGHT) return;
  pixels[y * OLED_CANVAS_WIDTH + x] = value ? 1 : 0;
}

function colorBit(color: MonoColor): number { return color === "white" ? 1 : 0; }
function rounded(value: number): number { return Number.isFinite(value) ? Math.round(value) : 0; }
function positiveSize(value: number): number { return Math.max(1, rounded(value)); }
