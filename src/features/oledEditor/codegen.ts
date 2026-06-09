import {
  SSD1306Color,
  type OledCommand,
} from "../../screens";
import { buildEditorAssetIndex } from "./assets";
import { pixelsToBitmapBytes } from "./document";
import type {
  CanvasObject,
  CodegenSettings,
  DrawOp,
  EditorDocument,
  GeneratedCodeResult,
  ImageAsset,
  MonoColor,
} from "./types";

interface LocalBitmapDeclaration {
  id: string;
  objectId: string;
  symbol: string;
  bytes: number[];
}

export function buildOledCommands(document: EditorDocument): OledCommand[] {
  const assetIndex = buildEditorAssetIndex(document.assetsById);
  const commands: OledCommand[] = [];

  if (document.screen.background === "black") {
    commands.push({ type: "clear" });
  } else {
    commands.push({ type: "clear" });
    commands.push({ type: "setColor", color: SSD1306Color.White });
    commands.push({ type: "fill" });
  }

  orderedRenderableObjects(document).forEach((object) => {
    commands.push(...objectToCommands(object, assetIndex));
  });

  return commands;
}

export function generateEditorCode(
  document: EditorDocument,
  settings: CodegenSettings,
): GeneratedCodeResult {
  const ir = buildDrawOps(document);
  return settings.mode === "json-ir"
    ? buildJsonIrOutput(document, settings, ir)
    : buildUnerCommandsOutput(document, settings, ir);
}

function buildDrawOps(document: EditorDocument): DrawOp[] {
  const assetIndex = buildEditorAssetIndex(document.assetsById);

  return orderedRenderableObjects(document).flatMap<DrawOp>((object): DrawOp[] => {
    switch (object.kind) {
      case "rectangle":
        return [
          {
            id: `${object.id}-rect`,
            sourceObjectId: object.id,
            kind: "rect",
            args: {
              x: object.x,
              y: object.y,
              w: object.width,
              h: object.height,
              fill: object.fill,
              stroke: object.stroke,
              strokeWidth: object.strokeWidth,
            },
          },
        ];
      case "circle":
        return [
          {
            id: `${object.id}-circle`,
            sourceObjectId: object.id,
            kind: "circle",
            args: {
              cx: object.cx,
              cy: object.cy,
              radius: object.radius,
              fill: object.fill,
              stroke: object.stroke,
              strokeWidth: object.strokeWidth,
            },
          },
        ];
      case "line":
        return [
          {
            id: `${object.id}-line`,
            sourceObjectId: object.id,
            kind: "line",
            args: {
              x1: object.x1,
              y1: object.y1,
              x2: object.x2,
              y2: object.y2,
              stroke: object.stroke,
              strokeWidth: object.strokeWidth,
            },
          },
        ];
      case "triangle":
      case "polygon":
        return [
          {
            id: `${object.id}-poly`,
            sourceObjectId: object.id,
            kind: "polygon",
            args: {
              points: object.points,
              fill: object.fill,
              stroke: object.stroke,
              strokeWidth: object.strokeWidth,
            },
          },
        ];
      case "text":
        return [
          {
            id: `${object.id}-text`,
            sourceObjectId: object.id,
            kind: "text",
            args: {
              x: object.x,
              y: object.y,
              text: object.text,
              font: object.font,
              fill: object.fill,
              align: object.align ?? "left",
            },
          },
        ];
      case "image": {
        const asset = assetIndex[object.assetId];
        if (!asset) {
          return [];
        }
        return [
          {
            id: `${object.id}-bitmap`,
            sourceObjectId: object.id,
            kind: "bitmap",
            args: {
              x: object.x,
              y: object.y,
              width: object.width,
              height: object.height,
              dataRef: asset.id,
              bitOrder: asset.bitOrder,
            },
          },
        ];
      }
      case "bitmap":
        return [
          {
            id: `${object.id}-bitmap`,
            sourceObjectId: object.id,
            kind: "bitmap",
            args: {
              x: object.x,
              y: object.y,
              width: object.width,
              height: object.height,
              dataRef: `${sanitizeSymbol(object.name)}_bits`,
              bitOrder: "lsb",
            },
          },
        ];
    }
  });
}

function buildJsonIrOutput(
  document: EditorDocument,
  settings: CodegenSettings,
  ir: DrawOp[],
): GeneratedCodeResult {
  const lineMap: Record<string, { startLine: number; endLine: number }> = {};
  const lines: string[] = [];

  if (settings.prefix.trim().length > 0) {
    lines.push(...settings.prefix.split(/\r?\n/));
  }

  lines.push("{");
  lines.push(`  "screen": ${JSON.stringify(document.screen, null, 2).replace(/\n/g, "\n  ")},`);
  lines.push('  "ops": [');

  ir.forEach((op, index) => {
    const block = JSON.stringify(op, null, 2)
      .split("\n")
      .map((line) => `    ${line}`);
    const startLine = lines.length + 1;
    lines.push(...block.map((line, blockIndex) =>
      index === ir.length - 1 && blockIndex === block.length - 1 ? line : line,
    ));
    const endLine = lines.length;
    lineMap[op.sourceObjectId] = { startLine, endLine };

    if (index !== ir.length - 1) {
      lines[lines.length - 1] = `${lines[lines.length - 1]},`;
    }
  });

  lines.push("  ]");
  lines.push("}");

  if (settings.suffix.trim().length > 0) {
    lines.push(...settings.suffix.split(/\r?\n/));
  }

  return {
    ir,
    text: lines.join("\n"),
    lineMap,
  };
}

function buildUnerCommandsOutput(
  document: EditorDocument,
  settings: CodegenSettings,
  ir: DrawOp[],
): GeneratedCodeResult {
  const lineMap: Record<string, { startLine: number; endLine: number }> = {};
  const lines: string[] = [];
  const assetIndex = buildEditorAssetIndex(document.assetsById);
  const declarations = collectLocalBitmapDeclarations(document);
  const commandRows = orderedRenderableObjects(document).map((object) => ({
    object,
    lines: objectToCommandLines(object, assetIndex, declarations, settings.includeComments),
  }));

  if (settings.prefix.trim().length > 0) {
    lines.push(...settings.prefix.split(/\r?\n/));
  }

  if (settings.declareVariables) {
    lines.push(`const screenTitle = ${JSON.stringify(document.screen.title)};`);
    lines.push(`const screenSize = { width: ${document.screen.width}, height: ${document.screen.height} };`);
    lines.push("");
  }

  if (settings.declareImages && declarations.length > 0) {
    declarations.forEach((declaration) => {
      lines.push(...bitmapDeclarationLines(declaration.symbol, declaration.bytes));
      lines.push("");
    });
  }

  if (settings.wrapperFunction) {
    lines.push("export function buildDraftScreenCommands(): OledCommand[] {");
    lines.push("  return [");
  } else {
    lines.push("const draftScreenCommands: OledCommand[] = [");
  }

  if (settings.clearDisplay) {
    lines.push("    { type: \"clear\" },");
  }

  commandRows.forEach(({ object, lines: objectLines }) => {
    const startLine = lines.length + 1;
    lines.push(...objectLines);
    const endLine = lines.length;
    lineMap[object.id] = { startLine, endLine };
  });

  if (settings.wrapperFunction) {
    lines.push("  ];");
    lines.push("}");
  } else {
    lines.push("];");
  }

  if (settings.suffix.trim().length > 0) {
    lines.push(...settings.suffix.split(/\r?\n/));
  }

  return {
    ir,
    text: lines.join("\n"),
    lineMap,
  };
}

function orderedRenderableObjects(document: EditorDocument) {
  return document.zOrder
    .map((id) => document.objectsById[id])
    .filter((object): object is CanvasObject => Boolean(object))
    .filter((object) => !object.hidden && !object.overlay);
}

function objectToCommands(
  object: CanvasObject,
  assetIndex: Record<string, ImageAsset>,
): OledCommand[] {
  switch (object.kind) {
    case "rectangle":
      return [
        ...fillRectCommands(object.fill, object.x, object.y, object.width, object.height),
        ...strokeRectCommands(object.stroke, object.x, object.y, object.width, object.height),
      ];
    case "circle":
      return [
        ...fillCircleCommands(object.fill, object.cx, object.cy, object.radius),
        ...strokeCircleCommands(object.stroke, object.cx, object.cy, object.radius),
      ];
    case "line":
      return [
        { type: "setColor", color: monoToColor(object.stroke) },
        { type: "drawLine", x0: object.x1, y0: object.y1, x1: object.x2, y1: object.y2 },
      ];
    case "triangle":
      return buildTriangleCommands(object);
    case "polygon": {
      const points = [...object.points, object.points[0]];
      return [
        { type: "setColor", color: monoToColor(object.stroke ?? "white") },
        { type: "polyline", vertices: points },
      ];
    }
    case "text":
      return [
        { type: "setCursor", x: object.x, y: object.y },
        { type: "setColor", color: monoToColor(object.fill) },
        { type: "drawText", text: object.text, font: object.font },
      ];
    case "image": {
      const asset = assetIndex[object.assetId];
      if (!asset) {
        return [];
      }

      return [
        { type: "setColor", color: SSD1306Color.White },
        asset.bitOrder === "msb"
          ? {
              type: "drawBitmapMSB",
              x: object.x,
              y: object.y,
              width: object.width,
              height: object.height,
              dataRef: asset.id,
            }
          : {
              type: "drawBitmap",
              x: object.x,
              y: object.y,
              width: object.width,
              height: object.height,
              dataRef: asset.id,
            },
      ];
    }
    case "bitmap":
      return [
        { type: "setColor", color: SSD1306Color.White },
        {
          type: "drawBitmap",
          x: object.x,
          y: object.y,
          width: object.width,
          height: object.height,
          dataRef: `${sanitizeSymbol(object.name)}_bits`,
        },
      ];
  }
}

function objectToCommandLines(
  object: CanvasObject,
  assetIndex: Record<string, ImageAsset>,
  declarations: LocalBitmapDeclaration[],
  includeComments: boolean,
) {
  const commands = objectToCommandsWithLocalRefs(object, assetIndex, declarations);
  const lines: string[] = [];

  if (includeComments) {
    lines.push(`    // ${object.name}`);
  }

  commands.forEach((command) => {
    lines.push(`    ${stringifyCommand(command)},`);
  });

  return lines;
}

function objectToCommandsWithLocalRefs(
  object: CanvasObject,
  assetIndex: Record<string, ImageAsset>,
  declarations: LocalBitmapDeclaration[],
): OledCommand[] {
  if (object.kind === "bitmap") {
    const declaration = declarations.find((item) => item.objectId === object.id);
    return [
      { type: "setColor", color: SSD1306Color.White } as OledCommand,
      {
        type: "drawBitmap",
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
        dataRef: declaration?.symbol ?? `${sanitizeSymbol(object.name)}_bits`,
      } as OledCommand,
    ];
  }

  if (object.kind === "image") {
    const asset = assetIndex[object.assetId];
    if (!asset) {
      return [];
    }

    return [
      { type: "setColor", color: SSD1306Color.White } as OledCommand,
      asset.bitOrder === "msb"
        ? {
            type: "drawBitmapMSB",
            x: object.x,
            y: object.y,
            width: object.width,
            height: object.height,
            dataRef: asset.id,
          } as OledCommand
        : {
            type: "drawBitmap",
            x: object.x,
            y: object.y,
            width: object.width,
            height: object.height,
            dataRef: asset.id,
          } as OledCommand,
    ];
  }

  return objectToCommands(object, assetIndex);
}

function collectLocalBitmapDeclarations(document: EditorDocument) {
  return orderedRenderableObjects(document).flatMap((object) => {
    if (object.kind !== "bitmap") {
      return [];
    }

    return [
      {
        id: object.id,
        objectId: object.id,
        symbol: `${sanitizeSymbol(object.name)}_bits`,
        bytes: pixelsToBitmapBytes(object.pixelData, object.width, object.height, "lsb"),
      },
    ];
  });
}

function bitmapDeclarationLines(symbol: string, bytes: number[]) {
  const lines = [`const ${symbol} = [`];

  for (let index = 0; index < bytes.length; index += 12) {
    const chunk = bytes
      .slice(index, index + 12)
      .map((value) => `0x${value.toString(16).padStart(2, "0")}`)
      .join(", ");
    lines.push(`  ${chunk},`);
  }

  lines.push("];");
  return lines;
}

function stringifyCommand(command: OledCommand) {
  switch (command.type) {
    case "clear":
      return `{ type: "clear" }`;
    case "fill":
      return `{ type: "fill" }`;
    case "setColor":
      return `{ type: "setColor", color: ${stringifyColor(command.color)} }`;
    case "setInverted":
      return `{ type: "setInverted", value: ${String(command.value)} }`;
    case "setCursor":
      return `{ type: "setCursor", x: ${command.x}, y: ${command.y} }`;
    case "drawText":
      return `{ type: "drawText", text: ${JSON.stringify(command.text)}, font: ${JSON.stringify(command.font)} }`;
    case "drawTextMax":
      return `{ type: "drawTextMax", text: ${JSON.stringify(command.text)}, maxChars: ${command.maxChars}, font: ${JSON.stringify(command.font)} }`;
    case "drawPixel":
      return `{ type: "drawPixel", x: ${command.x}, y: ${command.y} }`;
    case "drawLine":
      return `{ type: "drawLine", x0: ${command.x0}, y0: ${command.y0}, x1: ${command.x1}, y1: ${command.y1} }`;
    case "drawHorizontalLine":
      return `{ type: "drawHorizontalLine", x: ${command.x}, y: ${command.y}, length: ${command.length} }`;
    case "drawVerticalLine":
      return `{ type: "drawVerticalLine", x: ${command.x}, y: ${command.y}, length: ${command.length} }`;
    case "drawRect":
      return `{ type: "drawRect", x: ${command.x}, y: ${command.y}, w: ${command.w}, h: ${command.h} }`;
    case "fillRect":
      return `{ type: "fillRect", x: ${command.x}, y: ${command.y}, w: ${command.w}, h: ${command.h} }`;
    case "drawTriangle":
      return `{ type: "drawTriangle", x1: ${command.x1}, y1: ${command.y1}, x2: ${command.x2}, y2: ${command.y2}, x3: ${command.x3}, y3: ${command.y3} }`;
    case "drawFillTriangle":
      return `{ type: "drawFillTriangle", x1: ${command.x1}, y1: ${command.y1}, x2: ${command.x2}, y2: ${command.y2}, x3: ${command.x3}, y3: ${command.y3} }`;
    case "drawCircle":
      return `{ type: "drawCircle", x: ${command.x}, y: ${command.y}, radius: ${command.radius} }`;
    case "fillCircle":
      return `{ type: "fillCircle", x: ${command.x}, y: ${command.y}, radius: ${command.radius} }`;
    case "drawCircleQuads":
      return `{ type: "drawCircleQuads", x: ${command.x}, y: ${command.y}, radius: ${command.radius}, quads: ${command.quads} }`;
    case "drawArc":
      return `{ type: "drawArc", x: ${command.x}, y: ${command.y}, radius: ${command.radius}, startAngle: ${command.startAngle}, sweep: ${command.sweep} }`;
    case "drawProgressBar":
      return `{ type: "drawProgressBar", x: ${command.x}, y: ${command.y}, barWidth: ${command.barWidth}, barHeight: ${command.barHeight}, progress: ${command.progress} }`;
    case "drawBitmap":
      return `{ type: "drawBitmap", x: ${command.x}, y: ${command.y}, width: ${command.width}, height: ${command.height}, dataRef: ${JSON.stringify(command.dataRef)} }`;
    case "drawBitmapMSB":
      return `{ type: "drawBitmapMSB", x: ${command.x}, y: ${command.y}, width: ${command.width}, height: ${command.height}, dataRef: ${JSON.stringify(command.dataRef)} }`;
    case "polyline":
      return `{ type: "polyline", vertices: ${JSON.stringify(command.vertices)} }`;
  }
}

function stringifyColor(color: SSD1306Color) {
  if (color === SSD1306Color.Black) {
    return "SSD1306Color.Black";
  }

  if (color === SSD1306Color.Inverse) {
    return "SSD1306Color.Inverse";
  }

  return "SSD1306Color.White";
}

function monoToColor(color: MonoColor) {
  return color === "black" ? SSD1306Color.Black : SSD1306Color.White;
}

function fillRectCommands(
  color: MonoColor | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!color) {
    return [];
  }

  return [
    { type: "setColor", color: monoToColor(color) } as OledCommand,
    { type: "fillRect", x, y, w: width, h: height } as OledCommand,
  ];
}

function strokeRectCommands(
  color: MonoColor | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!color) {
    return [];
  }

  return [
    { type: "setColor", color: monoToColor(color) } as OledCommand,
    { type: "drawRect", x, y, w: width, h: height } as OledCommand,
  ];
}

function fillCircleCommands(
  color: MonoColor | null,
  x: number,
  y: number,
  radius: number,
) {
  if (!color) {
    return [];
  }

  return [
    { type: "setColor", color: monoToColor(color) } as OledCommand,
    { type: "fillCircle", x, y, radius } as OledCommand,
  ];
}

function strokeCircleCommands(
  color: MonoColor | null,
  x: number,
  y: number,
  radius: number,
) {
  if (!color) {
    return [];
  }

  return [
    { type: "setColor", color: monoToColor(color) } as OledCommand,
    { type: "drawCircle", x, y, radius } as OledCommand,
  ];
}

function buildTriangleCommands(object: Extract<CanvasObject, { kind: "triangle" }>) {
  const [first, second, third] = object.points;
  const commands: OledCommand[] = [];

  if (object.fill) {
    commands.push(
      { type: "setColor", color: monoToColor(object.fill) },
      {
        type: "drawFillTriangle",
        x1: first.x,
        y1: first.y,
        x2: second.x,
        y2: second.y,
        x3: third.x,
        y3: third.y,
      },
    );
  }

  if (object.stroke) {
    commands.push(
      { type: "setColor", color: monoToColor(object.stroke) },
      {
        type: "drawTriangle",
        x1: first.x,
        y1: first.y,
        x2: second.x,
        y2: second.y,
        x3: third.x,
        y3: third.y,
      },
    );
  }

  return commands;
}

function sanitizeSymbol(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return base.length > 0 ? base : "bitmap";
}
