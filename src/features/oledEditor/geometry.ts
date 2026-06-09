import { FONT_HEIGHT, FONT_WIDTH, SSD1306_HEIGHT, SSD1306_WIDTH } from "../../screens";
import type {
  BoundingBox,
  BitmapObject,
  CanvasObject,
  CircleObject,
  ImageObject,
  LineObject,
  Point,
  RectangleObject,
  TextObject,
  TriangleObject,
} from "./types";

export type HandlePosition =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

export const HANDLE_RADIUS = 2;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampPointToScreen(point: Point): Point {
  return {
    x: clamp(point.x, 0, SSD1306_WIDTH),
    y: clamp(point.y, 0, SSD1306_HEIGHT),
  };
}

export function normalizeRect(start: Point, end: Point): BoundingBox {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.max(1, Math.abs(end.x - start.x));
  const height = Math.max(1, Math.abs(end.y - start.y));

  return { x, y, width, height };
}

export function snapLine(start: Point, end: Point, enabled: boolean): Point {
  if (!enabled) {
    return end;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const diagonal = Math.max(absX, absY);

  if (absX > absY * 2) {
    return { x: end.x, y: start.y };
  }

  if (absY > absX * 2) {
    return { x: start.x, y: end.y };
  }

  return {
    x: start.x + diagonal * Math.sign(dx || 1),
    y: start.y + diagonal * Math.sign(dy || 1),
  };
}

export function centerObjectAt(
  point: Point,
  width: number,
  height: number,
): Point {
  return {
    x: clamp(Math.round(point.x - width / 2), 0, SSD1306_WIDTH - width),
    y: clamp(Math.round(point.y - height / 2), 0, SSD1306_HEIGHT - height),
  };
}

export function getObjectBounds(object: CanvasObject): BoundingBox {
  switch (object.kind) {
    case "rectangle":
      return {
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
      };
    case "circle":
      return {
        x: object.cx - object.radius,
        y: object.cy - object.radius,
        width: object.radius * 2,
        height: object.radius * 2,
      };
    case "line":
      return {
        x: Math.min(object.x1, object.x2),
        y: Math.min(object.y1, object.y2),
        width: Math.max(1, Math.abs(object.x2 - object.x1)),
        height: Math.max(1, Math.abs(object.y2 - object.y1)),
      };
    case "triangle":
      return pointsBounds(object.points);
    case "polygon":
      return pointsBounds(object.points);
    case "text":
      return {
        x: object.x,
        y: object.y,
        width: Math.max(1, object.text.length * FONT_WIDTH[object.font]),
        height: FONT_HEIGHT[object.font],
      };
    case "image":
      return {
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
      };
    case "bitmap":
      return {
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
      };
  }
}

export function getSelectionBounds(objects: CanvasObject[]): BoundingBox | null {
  if (objects.length === 0) {
    return null;
  }

  const bounds = objects.map(getObjectBounds);
  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function pointInBounds(point: Point, bounds: BoundingBox, padding = 0) {
  return (
    point.x >= bounds.x - padding &&
    point.x <= bounds.x + bounds.width + padding &&
    point.y >= bounds.y - padding &&
    point.y <= bounds.y + bounds.height + padding
  );
}

export function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
    0,
    1,
  );

  const px = start.x + t * dx;
  const py = start.y + t * dy;
  return Math.hypot(point.x - px, point.y - py);
}

export function pointInPolygon(point: Point, vertices: readonly Point[]) {
  let inside = false;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const left = vertices[i];
    const right = vertices[j];
    const intersects =
      left.y > point.y !== right.y > point.y &&
      point.x <
        ((right.x - left.x) * (point.y - left.y)) / (right.y - left.y || 1) +
          left.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function hitTestObject(object: CanvasObject, point: Point) {
  if (object.hidden) {
    return false;
  }

  switch (object.kind) {
    case "rectangle":
    case "text":
    case "image":
    case "bitmap":
      return pointInBounds(point, getObjectBounds(object));
    case "circle":
      return Math.hypot(point.x - object.cx, point.y - object.cy) <= object.radius + 1;
    case "line":
      return (
        distanceToSegment(
          point,
          { x: object.x1, y: object.y1 },
          { x: object.x2, y: object.y2 },
        ) <= Math.max(3, object.strokeWidth + 2)
      );
    case "triangle":
      return pointInPolygon(point, object.points);
    case "polygon":
      return pointInPolygon(point, object.points);
  }
}

export function findVertexHandle(
  points: readonly Point[],
  point: Point,
  tolerance = 3,
): number | null {
  for (let index = 0; index < points.length; index += 1) {
    if (Math.hypot(points[index].x - point.x, points[index].y - point.y) <= tolerance) {
      return index;
    }
  }

  return null;
}

export function findLineEndpointHandle(
  object: LineObject,
  point: Point,
  tolerance = 3,
): 0 | 1 | null {
  if (Math.hypot(object.x1 - point.x, object.y1 - point.y) <= tolerance) {
    return 0;
  }

  if (Math.hypot(object.x2 - point.x, object.y2 - point.y) <= tolerance) {
    return 1;
  }

  return null;
}

export function getResizeHandles(bounds: BoundingBox): Record<HandlePosition, Point> {
  const x = bounds.x;
  const y = bounds.y;
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const midX = bounds.x + bounds.width / 2;
  const midY = bounds.y + bounds.height / 2;

  return {
    nw: { x, y },
    n: { x: midX, y },
    ne: { x: right, y },
    e: { x: right, y: midY },
    se: { x: right, y: bottom },
    s: { x: midX, y: bottom },
    sw: { x, y: bottom },
    w: { x, y: midY },
  };
}

export function findResizeHandle(
  bounds: BoundingBox,
  point: Point,
  tolerance = 3,
): HandlePosition | null {
  const handles = getResizeHandles(bounds);

  for (const [key, value] of Object.entries(handles) as Array<[HandlePosition, Point]>) {
    if (Math.hypot(value.x - point.x, value.y - point.y) <= tolerance) {
      return key;
    }
  }

  return null;
}

export function translateObject<T extends CanvasObject>(
  object: T,
  dx: number,
  dy: number,
): T {
  switch (object.kind) {
    case "rectangle":
      return { ...object, x: object.x + dx, y: object.y + dy } as T;
    case "circle":
      return { ...object, cx: object.cx + dx, cy: object.cy + dy } as T;
    case "line":
      return {
        ...object,
        x1: object.x1 + dx,
        y1: object.y1 + dy,
        x2: object.x2 + dx,
        y2: object.y2 + dy,
      } as T;
    case "triangle":
      return {
        ...object,
        points: object.points.map((value) => ({ x: value.x + dx, y: value.y + dy })) as TriangleObject["points"],
      } as T;
    case "polygon":
      return {
        ...object,
        points: object.points.map((value) => ({ x: value.x + dx, y: value.y + dy })),
      } as T;
    case "text":
      return { ...object, x: object.x + dx, y: object.y + dy } as T;
    case "image":
      return { ...object, x: object.x + dx, y: object.y + dy } as T;
    case "bitmap":
      return { ...object, x: object.x + dx, y: object.y + dy } as T;
  }
}

export function updateVertexPoint<T extends TriangleObject | { kind: "polygon"; points: Point[] }>(
  object: T,
  index: number,
  point: Point,
): T {
  const nextPoints = object.points.map((value, currentIndex) =>
    currentIndex === index ? point : value,
  );
  return {
    ...object,
    points: nextPoints,
  } as T;
}

export function updateLineEndpoint(
  object: LineObject,
  endpoint: 0 | 1,
  point: Point,
): LineObject {
  return endpoint === 0
    ? { ...object, x1: point.x, y1: point.y }
    : { ...object, x2: point.x, y2: point.y };
}

export function resizeObjectFromBounds<T extends RectangleObject | ImageObject | TextObject | { kind: "bitmap"; x: number; y: number; width: number; height: number }>(
  object: T,
  bounds: BoundingBox,
): T {
  return {
    ...object,
    x: clamp(bounds.x, 0, SSD1306_WIDTH - bounds.width),
    y: clamp(bounds.y, 0, SSD1306_HEIGHT - bounds.height),
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
  } as T;
}

export function resizeCircleFromBounds(
  object: CircleObject,
  bounds: BoundingBox,
): CircleObject {
  const radius = Math.max(1, Math.round(Math.max(bounds.width, bounds.height) / 2));
  return {
    ...object,
    cx: Math.round(bounds.x + bounds.width / 2),
    cy: Math.round(bounds.y + bounds.height / 2),
    radius,
  };
}

export function resizeBitmapFromBounds(
  object: BitmapObject,
  bounds: BoundingBox,
): BitmapObject {
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  const nextPixels = Array.from({ length: width * height }, (_, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const sourceX = Math.min(
      object.width - 1,
      Math.floor((x * object.width) / width),
    );
    const sourceY = Math.min(
      object.height - 1,
      Math.floor((y * object.height) / height),
    );
    return object.pixelData[sourceY * object.width + sourceX] ?? 0;
  });

  return {
    ...object,
    x: clamp(bounds.x, 0, SSD1306_WIDTH - width),
    y: clamp(bounds.y, 0, SSD1306_HEIGHT - height),
    width,
    height,
    pixelData: nextPixels,
  };
}

export function resizeBounds(
  original: BoundingBox,
  handle: HandlePosition,
  dx: number,
  dy: number,
): BoundingBox {
  let left = original.x;
  let top = original.y;
  let right = original.x + original.width;
  let bottom = original.y + original.height;

  if (handle.includes("w")) {
    left += dx;
  }
  if (handle.includes("e")) {
    right += dx;
  }
  if (handle.includes("n")) {
    top += dy;
  }
  if (handle.includes("s")) {
    bottom += dy;
  }

  if (right <= left) {
    right = left + 1;
  }
  if (bottom <= top) {
    bottom = top + 1;
  }

  return {
    x: clamp(left, 0, SSD1306_WIDTH - 1),
    y: clamp(top, 0, SSD1306_HEIGHT - 1),
    width: clamp(right - left, 1, SSD1306_WIDTH),
    height: clamp(bottom - top, 1, SSD1306_HEIGHT),
  };
}

function pointsBounds(points: readonly Point[]): BoundingBox {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}
