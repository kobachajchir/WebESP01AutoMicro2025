import type {
  BitOrder,
  BitmapObject,
  CanvasObject,
  CircleObject,
  CodegenSettings,
  EditorDocument,
  ImageAsset,
  ImageObject,
  LineObject,
  Point,
  PolygonObject,
  RectangleObject,
  ScreenSpec,
  TextObject,
  TriangleObject,
} from "./types";

const DEFAULT_SCREEN: ScreenSpec = {
  width: 128,
  height: 64,
  background: "black",
  title: "Screen 1",
};

let objectCounter = 0;
let assetCounter = 0;

export const DEFAULT_CODEGEN_SETTINGS: CodegenSettings = {
  wrapperFunction: true,
  includeComments: true,
  declareImages: true,
  declareVariables: false,
  clearDisplay: true,
  prefix: "",
  suffix: "",
  mode: "uner-commands",
};

export function createEmptyDocument(
  partial?: Partial<EditorDocument>,
): EditorDocument {
  return {
    screen: {
      ...DEFAULT_SCREEN,
      ...(partial?.screen ?? {}),
    },
    objectsById: partial?.objectsById ?? {},
    zOrder: partial?.zOrder ?? [],
    assetsById: partial?.assetsById ?? {},
  };
}

export function cloneDocument(document: EditorDocument): EditorDocument {
  return {
    screen: { ...document.screen },
    objectsById: Object.fromEntries(
      Object.entries(document.objectsById).map(([id, object]) => [
        id,
        cloneObject(object),
      ]),
    ),
    zOrder: [...document.zOrder],
    assetsById: Object.fromEntries(
      Object.entries(document.assetsById).map(([id, asset]) => [
        id,
        cloneAsset(asset),
      ]),
    ),
  };
}

export function cloneObject(object: CanvasObject): CanvasObject {
  switch (object.kind) {
    case "rectangle":
      return { ...object };
    case "circle":
      return { ...object };
    case "line":
      return { ...object };
    case "triangle":
      return {
        ...object,
        points: object.points.map((point) => ({ ...point })) as TriangleObject["points"],
      };
    case "polygon":
      return {
        ...object,
        points: object.points.map((point) => ({ ...point })),
      };
    case "text":
      return { ...object };
    case "image":
      return { ...object };
    case "bitmap":
      return {
        ...object,
        pixelData: [...object.pixelData],
      };
  }
}

export function cloneAsset(asset: ImageAsset): ImageAsset {
  return {
    ...asset,
    bytes: [...asset.bytes],
  };
}

export function nextObjectId(prefix: string) {
  objectCounter += 1;
  return `${prefix}-${objectCounter}`;
}

export function nextAssetId(prefix = "asset") {
  assetCounter += 1;
  return `${prefix}-${assetCounter}`;
}

export function nextZIndex(document: EditorDocument) {
  return document.zOrder.length;
}

export function insertObject(
  document: EditorDocument,
  object: CanvasObject,
): EditorDocument {
  const next = cloneDocument(document);
  next.objectsById[object.id] = cloneObject(object);
  next.zOrder = [...next.zOrder.filter((id) => id !== object.id), object.id];
  syncZIndices(next);
  return next;
}

export function patchObject<T extends CanvasObject>(
  document: EditorDocument,
  id: string,
  patch: Partial<T>,
): EditorDocument {
  const current = document.objectsById[id];

  if (!current) {
    return document;
  }

  const next = cloneDocument(document);
  next.objectsById[id] = {
    ...current,
    ...patch,
  } as CanvasObject;
  return next;
}

export function replaceObject(
  document: EditorDocument,
  object: CanvasObject,
): EditorDocument {
  const next = cloneDocument(document);
  next.objectsById[object.id] = cloneObject(object);
  return next;
}

export function removeObjects(
  document: EditorDocument,
  ids: string[],
): EditorDocument {
  const next = cloneDocument(document);

  ids.forEach((id) => {
    delete next.objectsById[id];
  });

  next.zOrder = next.zOrder.filter((id) => !ids.includes(id));
  syncZIndices(next);
  return next;
}

export function moveObjectUp(document: EditorDocument, id: string) {
  const next = cloneDocument(document);
  const index = next.zOrder.indexOf(id);

  if (index === -1 || index === next.zOrder.length - 1) {
    return document;
  }

  const updated = [...next.zOrder];
  const swap = updated[index + 1];
  updated[index + 1] = id;
  updated[index] = swap;
  next.zOrder = updated;
  syncZIndices(next);
  return next;
}

export function moveObjectDown(document: EditorDocument, id: string) {
  const next = cloneDocument(document);
  const index = next.zOrder.indexOf(id);

  if (index <= 0) {
    return document;
  }

  const updated = [...next.zOrder];
  const swap = updated[index - 1];
  updated[index - 1] = id;
  updated[index] = swap;
  next.zOrder = updated;
  syncZIndices(next);
  return next;
}

export function registerAsset(
  document: EditorDocument,
  asset: ImageAsset,
): EditorDocument {
  const next = cloneDocument(document);
  next.assetsById[asset.id] = cloneAsset(asset);
  return next;
}

export function createRectangle(
  document: EditorDocument,
  bounds: { x: number; y: number; width: number; height: number },
): RectangleObject {
  return {
    id: nextObjectId("rect"),
    kind: "rectangle",
    name: `rectangle-${document.zOrder.length + 1}`,
    locked: false,
    hidden: false,
    zIndex: nextZIndex(document),
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fill: "black",
    stroke: "white",
    strokeWidth: 1,
  };
}

export function createCircle(
  document: EditorDocument,
  center: Point,
  radius: number,
): CircleObject {
  return {
    id: nextObjectId("circle"),
    kind: "circle",
    name: `circle-${document.zOrder.length + 1}`,
    locked: false,
    hidden: false,
    zIndex: nextZIndex(document),
    cx: center.x,
    cy: center.y,
    radius,
    fill: null,
    stroke: "white",
    strokeWidth: 1,
  };
}

export function createLine(
  document: EditorDocument,
  start: Point,
  end: Point,
): LineObject {
  return {
    id: nextObjectId("line"),
    kind: "line",
    name: `line-${document.zOrder.length + 1}`,
    locked: false,
    hidden: false,
    zIndex: nextZIndex(document),
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    stroke: "white",
    strokeWidth: 1,
  };
}

export function createTriangle(
  document: EditorDocument,
  points: [Point, Point, Point],
): TriangleObject {
  return {
    id: nextObjectId("triangle"),
    kind: "triangle",
    name: `triangle-${document.zOrder.length + 1}`,
    locked: false,
    hidden: false,
    zIndex: nextZIndex(document),
    points,
    fill: null,
    stroke: "white",
    strokeWidth: 1,
  };
}

export function createPolygon(
  document: EditorDocument,
  points: Point[],
): PolygonObject {
  return {
    id: nextObjectId("polygon"),
    kind: "polygon",
    name: `polygon-${document.zOrder.length + 1}`,
    locked: false,
    hidden: false,
    zIndex: nextZIndex(document),
    points,
    fill: null,
    stroke: "white",
    strokeWidth: 1,
  };
}

export function createText(
  document: EditorDocument,
  point: Point,
): TextObject {
  return {
    id: nextObjectId("text"),
    kind: "text",
    name: `text-${document.zOrder.length + 1}`,
    locked: false,
    hidden: false,
    zIndex: nextZIndex(document),
    x: point.x,
    y: point.y,
    text: "hola mundo",
    font: "Font7x10",
    fill: "white",
    align: "left",
  };
}

export function createImageObject(
  document: EditorDocument,
  asset: ImageAsset,
  point: Point,
): ImageObject {
  return {
    id: nextObjectId("image"),
    kind: "image",
    name: asset.name,
    locked: false,
    hidden: false,
    zIndex: nextZIndex(document),
    x: point.x,
    y: point.y,
    width: asset.width,
    height: asset.height,
    assetId: asset.id,
    bitOrder: asset.bitOrder,
    alphaChannel: false,
  };
}

export function createBitmapObject(
  document: EditorDocument,
  point: Point,
  width = 128,
  height = 64,
): BitmapObject {
  return {
    id: nextObjectId("bitmap"),
    kind: "bitmap",
    name: `paint-layer-${document.zOrder.length + 1}`,
    locked: false,
    hidden: false,
    zIndex: nextZIndex(document),
    x: point.x,
    y: point.y,
    width,
    height,
    pixelData: buildEmptyPixelData(width, height),
    colorMode: "monochrome",
    alphaChannel: false,
  };
}

export function buildEmptyPixelData(width: number, height: number) {
  return Array.from({ length: width * height }, () => 0);
}

export function bitmapBytesToPixels(
  bytes: readonly number[],
  width: number,
  height: number,
  bitOrder: BitOrder,
) {
  const bytesPerRow = Math.ceil(width / 8);
  const pixels = buildEmptyPixelData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const byte = bytes[y * bytesPerRow + (x >> 3)] ?? 0;
      const bitIndex = bitOrder === "msb" ? 7 - (x & 7) : x & 7;
      pixels[y * width + x] = (byte >> bitIndex) & 1;
    }
  }

  return pixels;
}

export function pixelsToBitmapBytes(
  pixels: readonly number[],
  width: number,
  height: number,
  bitOrder: BitOrder,
) {
  const bytesPerRow = Math.ceil(width / 8);
  const bytes = Array.from({ length: bytesPerRow * height }, () => 0);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!pixels[y * width + x]) {
        continue;
      }

      const index = y * bytesPerRow + (x >> 3);
      const bitIndex = bitOrder === "msb" ? 7 - (x & 7) : x & 7;
      bytes[index] |= 1 << bitIndex;
    }
  }

  return bytes;
}

export function createUploadedAsset(
  name: string,
  width: number,
  height: number,
  bytes: number[],
  bitOrder: BitOrder = "lsb",
): ImageAsset {
  return {
    id: nextAssetId("upload"),
    name,
    width,
    height,
    bytes,
    bitOrder,
    source: "upload",
    draft: true,
  };
}

function syncZIndices(document: EditorDocument) {
  document.zOrder.forEach((id, index) => {
    const current = document.objectsById[id];

    if (current) {
      current.zIndex = index;
    }
  });
}

