import { useMemo } from "react";
import type { OledFont } from "../screens";
import { buildBitmapTextPath } from "../screens/oledBitmapFont";

interface OledBitmapTextProps {
  x: number;
  y: number;
  text: string;
  font: OledFont;
  fill: string;
  align?: "left" | "center" | "right";
}

export default function OledBitmapText({
  x,
  y,
  text,
  font,
  fill,
  align = "left",
}: OledBitmapTextProps) {
  const textPath = useMemo(
    () => buildBitmapTextPath(text, font, x, y, align),
    [align, font, text, x, y],
  );

  if (!textPath.path) {
    return null;
  }

  return (
    <path
      d={textPath.path}
      fill={fill}
      shapeRendering="crispEdges"
    />
  );
}
