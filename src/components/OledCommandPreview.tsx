import { useId, type ReactNode } from "react";
import {
  FONT_HEIGHT,
  FONT_WIDTH,
  SSD1306Color,
  SSD1306_HEIGHT,
  SSD1306_WIDTH,
  type OledCommand,
  type OledFont,
} from "../screens";
import { getOledBitmapAsset } from "../screens/bitmapAssets";

interface OledCommandPreviewProps {
  commands: OledCommand[];
  className?: string;
}

interface RenderState {
  cursorX: number;
  cursorY: number;
  color: SSD1306Color;
  inverted: boolean;
}

const OLED_BLACK = "#020617";
const OLED_WHITE = "#dffcff";
const OLED_MUTED = "#67e8f9";

export default function OledCommandPreview({
  commands,
  className = "",
}: OledCommandPreviewProps) {
  const reactId = useId();
  const clipId = `oled-preview-${reactId.replace(/:/g, "")}`;
  const elements = renderCommands(commands);

  return (
    <svg
      viewBox={`0 0 ${SSD1306_WIDTH} ${SSD1306_HEIGHT}`}
      role="img"
      aria-label="Preview OLED STM"
      className={`block aspect-[2/1] w-full rounded-md border border-cyan-300/30 bg-slate-950 ${className}`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={SSD1306_WIDTH} height={SSD1306_HEIGHT} rx={1} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={SSD1306_WIDTH} height={SSD1306_HEIGHT} fill={OLED_BLACK} />
      <g clipPath={`url(#${clipId})`}>{elements}</g>
    </svg>
  );
}

function renderCommands(commands: OledCommand[]): ReactNode[] {
  const state: RenderState = {
    cursorX: 0,
    cursorY: 0,
    color: SSD1306Color.White,
    inverted: false,
  };
  let key = 0;
  let elements: ReactNode[] = [];

  for (const command of commands) {
    switch (command.type) {
      case "clear":
        elements = [];
        state.cursorX = 0;
        state.cursorY = 0;
        state.color = SSD1306Color.White;
        state.inverted = false;
        break;
      case "fill":
        elements.push(
          <rect
            key={key++}
            x={0}
            y={0}
            width={SSD1306_WIDTH}
            height={SSD1306_HEIGHT}
            fill={paint(state)}
          />
        );
        break;
      case "setColor":
        state.color = command.color;
        break;
      case "setInverted":
        state.inverted = command.value;
        break;
      case "setCursor":
        state.cursorX = command.x;
        state.cursorY = command.y;
        break;
      case "drawText":
        elements.push(textNode(command.text, command.font, state, key++));
        state.cursorX += command.text.length * FONT_WIDTH[command.font];
        break;
      case "drawTextMax": {
        const text = command.text.slice(0, command.maxChars);
        elements.push(textNode(text, command.font, state, key++));
        state.cursorX += text.length * FONT_WIDTH[command.font];
        break;
      }
      case "drawPixel":
        elements.push(
          <rect key={key++} x={command.x} y={command.y} width={1} height={1} fill={paint(state)} />
        );
        break;
      case "drawLine":
        elements.push(lineNode(command.x0, command.y0, command.x1, command.y1, state, key++));
        break;
      case "drawHorizontalLine":
        elements.push(lineNode(command.x, command.y, command.x + command.length, command.y, state, key++));
        break;
      case "drawVerticalLine":
        elements.push(lineNode(command.x, command.y, command.x, command.y + command.length, state, key++));
        break;
      case "drawRect":
        elements.push(
          <rect
            key={key++}
            x={command.x}
            y={command.y}
            width={command.w}
            height={command.h}
            fill="none"
            stroke={paint(state)}
            strokeWidth={1}
          />
        );
        break;
      case "fillRect":
        elements.push(
          <rect
            key={key++}
            x={command.x}
            y={command.y}
            width={command.w}
            height={command.h}
            fill={paint(state)}
          />
        );
        break;
      case "drawTriangle":
      case "drawFillTriangle":
        elements.push(
          <polygon
            key={key++}
            points={`${command.x1},${command.y1} ${command.x2},${command.y2} ${command.x3},${command.y3}`}
            fill={command.type === "drawFillTriangle" ? paint(state) : "none"}
            stroke={paint(state)}
            strokeWidth={1}
          />
        );
        break;
      case "drawCircle":
      case "fillCircle":
      case "drawCircleQuads":
        elements.push(
          <circle
            key={key++}
            cx={command.x}
            cy={command.y}
            r={command.radius}
            fill={command.type === "fillCircle" ? paint(state) : "none"}
            stroke={paint(state)}
            strokeWidth={1}
          />
        );
        break;
      case "drawArc":
        elements.push(
          <circle
            key={key++}
            cx={command.x}
            cy={command.y}
            r={command.radius}
            fill="none"
            stroke={paint(state)}
            strokeDasharray={`${Math.max(1, command.sweep)} 360`}
            strokeWidth={1}
          />
        );
        break;
      case "drawProgressBar": {
        const progressWidth = Math.max(0, Math.min(command.barWidth, command.progress));
        elements.push(
          <g key={key++}>
            <rect
              x={command.x}
              y={command.y}
              width={command.barWidth}
              height={command.barHeight}
              fill="none"
              stroke={paint(state)}
              strokeWidth={1}
            />
            <rect
              x={command.x}
              y={command.y}
              width={progressWidth}
              height={command.barHeight}
              fill={paint(state)}
            />
          </g>
        );
        break;
      }
      case "drawBitmap":
      case "drawBitmapMSB":
        elements.push(bitmapNode(command, state, key++));
        break;
      case "polyline":
        elements.push(
          <polyline
            key={key++}
            points={command.vertices.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke={paint(state)}
            strokeWidth={1}
          />
        );
        break;
    }
  }

  return elements;
}

function textNode(text: string, font: OledFont, state: RenderState, key: number) {
  const fontSize = font === "Font11x18" ? 17 : 9;

  return (
    <text
      key={key}
      x={state.cursorX}
      y={state.cursorY + FONT_HEIGHT[font] - 1}
      fill={paint(state)}
      fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
      fontSize={fontSize}
      fontWeight={700}
      letterSpacing={0}
    >
      {text}
    </text>
  );
}

function lineNode(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  state: RenderState,
  key: number
) {
  return (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={paint(state)} strokeWidth={1} />
  );
}

function bitmapNode(
  command: Extract<OledCommand, { type: "drawBitmap" | "drawBitmapMSB" }>,
  state: RenderState,
  key: number
) {
  const asset = getOledBitmapAsset(command.dataRef);

  if (asset) {
    const path = bitmapPath(command, asset.bytes);

    return path ? (
      <path key={key} d={path} fill={paint(state)} shapeRendering="crispEdges" />
    ) : null;
  }

  const label = command.dataRef
    .replace(/^Icon_/, "")
    .replace(/^QRCode_/, "QR_")
    .replace(/_bits$/, "")
    .replace(/_/g, " ")
    .slice(0, 10);

  return (
    <g key={key}>
      <rect
        x={command.x}
        y={command.y}
        width={command.width}
        height={command.height}
        fill="none"
        stroke={paint(state)}
        strokeWidth={1}
      />
      {command.width >= 12 && command.height >= 10 ? (
        <text
          x={command.x + 1}
          y={command.y + Math.min(command.height - 2, 8)}
          fill={OLED_MUTED}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
          fontSize={4}
          letterSpacing={0}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

function bitmapPath(
  command: Extract<OledCommand, { type: "drawBitmap" | "drawBitmapMSB" }>,
  bitmap: readonly number[]
) {
  const bytesPerRow = Math.ceil(command.width / 8);
  const msbFirst = command.type === "drawBitmapMSB";
  const segments: string[] = [];

  for (let y = 0; y < command.height; y += 1) {
    let runStart: number | null = null;

    for (let x = 0; x < command.width; x += 1) {
      const byte = bitmap[y * bytesPerRow + (x >> 3)] ?? 0;
      const bit = msbFirst ? 7 - (x & 7) : x & 7;
      const enabled = ((byte >> bit) & 1) === 1;

      if (enabled && runStart === null) {
        runStart = x;
      }

      if ((!enabled || x === command.width - 1) && runStart !== null) {
        const runEnd = enabled && x === command.width - 1 ? x + 1 : x;
        const width = runEnd - runStart;
        segments.push(
          `M${command.x + runStart} ${command.y + y}h${width}v1h-${width}z`
        );
        runStart = null;
      }
    }
  }

  return segments.join("");
}

function paint(state: RenderState) {
  if (state.color === SSD1306Color.Black) {
    return state.inverted ? OLED_WHITE : OLED_BLACK;
  }

  return state.inverted ? OLED_BLACK : OLED_WHITE;
}
