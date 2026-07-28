import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyDocument } from "../src/features/oledEditor/document.ts";
import {
  OLED_CANVAS_BYTES,
  OLED_CANVAS_HEIGHT,
  OLED_CANVAS_WIDTH,
  crc32IsoHdlc,
  packPageMajor,
  rasterizeOledDocument,
  unpackPageMajor,
} from "../src/features/oledEditor/oledCanvasRasterizer.ts";
import type { EditorDocument } from "../src/features/oledEditor/types.ts";

test("CRC-32/ISO-HDLC coincide con el vector canonico", () => {
  const bytes = Uint8Array.from(Array.from("123456789", (char) => char.charCodeAt(0)));
  assert.equal(crc32IsoHdlc(bytes), 0xcbf43926);
});

test("packing SSD1306 es page-major con bit vertical LSB", () => {
  const pixels = new Uint8Array(OLED_CANVAS_WIDTH * OLED_CANVAS_HEIGHT);
  const points = [[0, 0], [127, 7], [0, 8], [127, 63]] as const;
  points.forEach(([x, y]) => { pixels[y * OLED_CANVAS_WIDTH + x] = 1; });
  const framebuffer = packPageMajor(pixels);
  assert.equal(framebuffer.length, OLED_CANVAS_BYTES);
  assert.equal(framebuffer[0], 0x01);
  assert.equal(framebuffer[127], 0x80);
  assert.equal(framebuffer[128], 0x01);
  assert.equal(framebuffer[1023], 0x80);
  assert.deepEqual(unpackPageMajor(framebuffer), pixels);
});

test("fondos negro y blanco ocupan exactamente 1024 bytes", () => {
  const black = rasterizeOledDocument(createEmptyDocument());
  assert.equal(black.framebuffer.length, OLED_CANVAS_BYTES);
  assert.ok(black.framebuffer.every((byte) => byte === 0));

  const whiteDocument = createEmptyDocument({ screen: {
    width: 128, height: 64, title: "white", background: "white",
  } });
  const white = rasterizeOledDocument(whiteDocument);
  assert.ok(white.framebuffer.every((byte) => byte === 0xff));
});

test("compone zOrder, fill negro y omite capas hidden/overlay", () => {
  const document = createEmptyDocument();
  document.objectsById = {
    white: {
      id: "white", kind: "rectangle", name: "white", locked: false, hidden: false,
      zIndex: 0, x: 0, y: 0, width: 8, height: 8, fill: "white", stroke: null, strokeWidth: 1,
    },
    erase: {
      id: "erase", kind: "rectangle", name: "erase", locked: false, hidden: false,
      zIndex: 1, x: 2, y: 2, width: 4, height: 4, fill: "black", stroke: null, strokeWidth: 1,
    },
    hidden: {
      id: "hidden", kind: "bitmap", name: "hidden", locked: false, hidden: true,
      zIndex: 2, x: 3, y: 3, width: 1, height: 1, pixelData: [1], colorMode: "monochrome",
    },
    overlay: {
      id: "overlay", kind: "bitmap", name: "overlay", locked: false, hidden: false,
      overlay: true, zIndex: 3, x: 4, y: 4, width: 1, height: 1, pixelData: [1], colorMode: "monochrome",
    },
  };
  document.zOrder = ["white", "erase", "hidden", "overlay"];
  const { pixels } = rasterizeOledDocument(document);
  assert.equal(pixels[0], 1);
  assert.equal(pixels[3 * OLED_CANVAS_WIDTH + 3], 0);
  assert.equal(pixels[4 * OLED_CANVAS_WIDTH + 4], 0);
});

test("rasteriza formas, texto, bitmap e imagen con clipping", () => {
  const document: EditorDocument = createEmptyDocument();
  document.assetsById.dot = {
    id: "dot", name: "dot", width: 1, height: 1, bytes: [0x01], bitOrder: "lsb", source: "upload",
  };
  document.objectsById = {
    circle: {
      id: "circle", kind: "circle", name: "circle", locked: false, hidden: false,
      zIndex: 0, cx: 20, cy: 20, radius: 3, fill: "white", stroke: "white", strokeWidth: 1,
    },
    line: {
      id: "line", kind: "line", name: "line", locked: false, hidden: false,
      zIndex: 1, x1: -4, y1: 63, x2: 10, y2: 63, stroke: "white", strokeWidth: 1,
    },
    polygon: {
      id: "polygon", kind: "polygon", name: "polygon", locked: false, hidden: false,
      zIndex: 2, points: [{ x: 30, y: 30 }, { x: 40, y: 30 }, { x: 35, y: 40 }],
      fill: "white", stroke: "white", strokeWidth: 1,
    },
    text: {
      id: "text", kind: "text", name: "text", locked: false, hidden: false,
      zIndex: 3, x: 50, y: 0, text: "A", font: "Font7x10", fill: "white", align: "left",
    },
    bitmap: {
      id: "bitmap", kind: "bitmap", name: "bitmap", locked: false, hidden: false,
      zIndex: 4, x: 126, y: 62, width: 1, height: 1, pixelData: [1], colorMode: "monochrome",
    },
    image: {
      id: "image", kind: "image", name: "image", locked: false, hidden: false,
      zIndex: 5, x: 127, y: 63, width: 1, height: 1, assetId: "dot", bitOrder: "lsb",
    },
  };
  document.zOrder = ["circle", "line", "polygon", "text", "bitmap", "image"];
  const { pixels, framebuffer } = rasterizeOledDocument(document);
  assert.equal(pixels[20 * OLED_CANVAS_WIDTH + 20], 1);
  assert.equal(pixels[63 * OLED_CANVAS_WIDTH], 1);
  assert.equal(pixels[34 * OLED_CANVAS_WIDTH + 35], 1);
  assert.equal(pixels[0 * OLED_CANVAS_WIDTH + 53], 1);
  assert.equal(pixels[62 * OLED_CANVAS_WIDTH + 126], 1);
  assert.equal(framebuffer[1023] & 0x80, 0x80);
});

test("rasteriza imagenes del catalogo compartido igual que el editor", () => {
  const document = createEmptyDocument();
  document.objectsById.shared = {
    id: "shared",
    kind: "image",
    name: "Auto lateral",
    locked: false,
    hidden: false,
    zIndex: 0,
    x: 0,
    y: 0,
    width: 48,
    height: 13,
    assetId: "Icon_Car_bits",
    bitOrder: "lsb",
  };
  document.zOrder = ["shared"];

  const { framebuffer } = rasterizeOledDocument(document);
  assert.ok(framebuffer.some((byte) => byte !== 0));
});
