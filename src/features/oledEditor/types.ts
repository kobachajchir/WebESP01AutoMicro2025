import type { OledFont } from "../../screens";

export type ToolId =
  | "select"
  | "image"
  | "paint"
  | "text"
  | "rectangle"
  | "circle"
  | "line"
  | "triangle"
  | "polygon";

export type MonoColor = "white" | "black";
export type BitOrder = "lsb" | "msb";
export type CanvasObjectKind =
  | "rectangle"
  | "circle"
  | "line"
  | "triangle"
  | "polygon"
  | "text"
  | "image"
  | "bitmap";

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenSpec {
  width: number;
  height: number;
  background: MonoColor;
  title: string;
}

export interface BaseObject {
  id: string;
  kind: CanvasObjectKind;
  name: string;
  locked: boolean;
  hidden: boolean;
  overlay?: boolean;
  zIndex: number;
}

export interface RectangleObject extends BaseObject {
  kind: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: MonoColor | null;
  stroke: MonoColor | null;
  strokeWidth: number;
}

export interface CircleObject extends BaseObject {
  kind: "circle";
  cx: number;
  cy: number;
  radius: number;
  fill: MonoColor | null;
  stroke: MonoColor | null;
  strokeWidth: number;
}

export interface LineObject extends BaseObject {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: MonoColor;
  strokeWidth: number;
}

export interface TriangleObject extends BaseObject {
  kind: "triangle";
  points: [Point, Point, Point];
  fill: MonoColor | null;
  stroke: MonoColor | null;
  strokeWidth: number;
}

export interface PolygonObject extends BaseObject {
  kind: "polygon";
  points: Point[];
  fill: MonoColor | null;
  stroke: MonoColor | null;
  strokeWidth: number;
}

export interface TextObject extends BaseObject {
  kind: "text";
  x: number;
  y: number;
  text: string;
  font: OledFont;
  fill: MonoColor;
  align?: "left" | "center" | "right";
}

export interface ImageObject extends BaseObject {
  kind: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  assetId: string;
  bitOrder: BitOrder;
  alphaChannel?: boolean;
}

export interface BitmapObject extends BaseObject {
  kind: "bitmap";
  x: number;
  y: number;
  width: number;
  height: number;
  pixelData: number[];
  colorMode: "monochrome";
  alphaChannel?: boolean;
}

export type CanvasObject =
  | RectangleObject
  | CircleObject
  | LineObject
  | TriangleObject
  | PolygonObject
  | TextObject
  | ImageObject
  | BitmapObject;

export interface ImageAsset {
  id: string;
  name: string;
  width: number;
  height: number;
  bytes: number[];
  bitOrder: BitOrder;
  source: "shared" | "upload" | "generated";
  draft?: boolean;
}

export interface EditorDocument {
  screen: ScreenSpec;
  objectsById: Record<string, CanvasObject>;
  zOrder: string[];
  assetsById: Record<string, ImageAsset>;
}

export interface SelectionState {
  selectedIds: string[];
  vertexEdit?:
    | { objectId: string; kind: "triangle"; activeVertex?: 0 | 1 | 2 }
    | { objectId: string; kind: "polygon"; activeVertex?: number }
    | { objectId: string; kind: "line"; activeVertex?: 0 | 1 };
}

export interface CodegenSettings {
  wrapperFunction: boolean;
  includeComments: boolean;
  declareImages: boolean;
  declareVariables: boolean;
  clearDisplay: boolean;
  prefix: string;
  suffix: string;
  mode: "uner-commands" | "json-ir";
}

export interface HistoryEditorAction {
  type: "document/replace";
  document: EditorDocument;
}

export interface HistoryEntry {
  label: string;
  forward: HistoryEditorAction[];
  inverse: HistoryEditorAction[];
  timestamp: number;
}

export interface EditorState {
  document: EditorDocument;
  selection: SelectionState;
  activeTool: ToolId;
  hoveredId: string | null;
  viewport: {
    zoom: number;
    panX: number;
    panY: number;
  };
  history: {
    past: HistoryEntry[];
    future: HistoryEntry[];
    transactionLabel?: string;
    stagedForward: HistoryEditorAction[];
    stagedInverse: HistoryEditorAction[];
  };
  ui: {
    rightMouseMode: "none" | "erase" | "remove-vertex";
    textEditingId?: string;
    imagePanelOpen: boolean;
    selectedAssetId?: string;
    codeSettings: CodegenSettings;
  };
}

export interface DrawOp {
  id: string;
  sourceObjectId: string;
  kind: "rect" | "circle" | "line" | "polygon" | "text" | "bitmap";
  args: Record<string, unknown>;
}

export interface GeneratedCodeResult {
  ir: DrawOp[];
  text: string;
  lineMap: Record<string, { startLine: number; endLine: number }>;
}

