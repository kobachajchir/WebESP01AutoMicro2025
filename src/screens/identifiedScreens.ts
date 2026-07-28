import {
  baselineY,
  clear,
  drawXbm,
  textAt,
  withNotificationProgress,
} from "./helpers";
import type { NotificationProgressArgs, OledCommand } from "./types";

export interface IdentifiedScreenArgs {
  lines: string[];
  footer?: string;
  iconRef?: string;
}

function centeredX(text: string, glyphWidth = 7): number {
  return Math.max(0, Math.floor((128 - text.length * glyphWidth) / 2));
}

function normalizedLines(lines: string[]): string[] {
  return lines
    .map((line) => line.trim().slice(0, 18))
    .filter(Boolean)
    .slice(0, 3);
}

/**
 * Fallback identificado para pantallas que solo publican screenCode/source.
 * No inventa valores dinamicos: conserva la identidad de la pantalla fisica
 * hasta que el contrato transporte un snapshot especifico para esa vista.
 */
export function buildIdentifiedScreenCommands(args: IdentifiedScreenArgs): OledCommand[] {
  const lines = normalizedLines(args.lines);
  const footer = args.footer?.trim().slice(0, 16);
  const hasIcon = Boolean(args.iconRef);
  const startY = hasIcon ? 24 : lines.length <= 2 ? 14 : 5;
  const commands: OledCommand[] = [clear()];

  if (args.iconRef) {
    commands.push(...drawXbm(56, 3, 16, 16, args.iconRef));
  }

  lines.forEach((line, index) => {
    commands.push(...textAt(centeredX(line), startY + index * 13, line, "Font7x10"));
  });

  if (footer) {
    commands.push(...textAt(2, baselineY(63, "Font7x10"), footer, "Font7x10"));
    commands.push(...drawXbm(112, 48, 13, 13, "Icon_Encoder_bits"));
  }

  return commands;
}

export function buildIdentifiedNotificationCommands(
  lines: string[],
  progress?: NotificationProgressArgs,
): OledCommand[] {
  return withNotificationProgress(
    buildIdentifiedScreenCommands({
      lines,
      iconRef: "Icon_Info_bits",
    }),
    progress,
  );
}
