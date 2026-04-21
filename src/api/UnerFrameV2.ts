export const UNER_V2 = {
  HEADER: [0x55, 0x4e, 0x45, 0x52],
  TOKEN: 0x3a,
  VERSION: 0x02,
  MAX_PAYLOAD: 0xff,
} as const;

export const UNER_V2_NODE = {
  MCU: 0x01,
  ESP_PC: 0x02,
  WEB_APP: 0x03,
  NRF_REMOTE: 0x04,
  BROADCAST: 0x0f,
} as const;

export const UNER_V2_CMD = {
  REBOOT_ESP: 0x16,
  RESET_MCU: 0x19,
  TELEMETRY_SET_RATE: 0x20,
  TELEMETRY_ACK: 0x21,
  TELEMETRY_DATA: 0x22,
  GET_CAR_MODE: 0x5b,
  EVT_MENU_SELECTION_CHANGED: 0x96,
  EVT_SCREEN_CHANGED: 0x96,
  EVT_CAR_MODE_CHANGED: 0x97,
} as const;

export const ESP_REBOOT_MODE = {
  NORMAL: 0x00,
  AP: 0x01,
} as const;

export type EspRebootMode = "normal" | "ap";

export type UnerV2FrameOptions = {
  cmd: number;
  payload?: Uint8Array | number[];
  source?: number;
  destination?: number;
};

export interface UnerV2ParsedFrame {
  cmd: number;
  payload: Uint8Array;
  payloadLength: number;
  route: number;
  source: number;
  destination: number;
  checksum: number;
  offset: number;
  frame: Uint8Array;
}

export interface UnerV2StreamParser {
  push: (chunk: Uint8Array) => UnerV2ParsedFrame[];
  reset: () => void;
}

export function buildUnerV2Frame({
  cmd,
  payload = [],
  source = UNER_V2_NODE.ESP_PC,
  destination = UNER_V2_NODE.MCU,
}: UnerV2FrameOptions): Uint8Array {
  const payloadBytes = Array.from(payload, (byte) => byte & 0xff);

  if (payloadBytes.length > UNER_V2.MAX_PAYLOAD) {
    throw new Error("UNER v2: payload demasiado largo");
  }

  const route = ((source & 0x0f) << 4) | (destination & 0x0f);
  const frameWithoutChecksum = [
    ...UNER_V2.HEADER,
    payloadBytes.length & 0xff,
    UNER_V2.TOKEN,
    UNER_V2.VERSION,
    route,
    cmd & 0xff,
    ...payloadBytes,
  ];
  const checksum = xorChecksum(frameWithoutChecksum);

  return new Uint8Array([...frameWithoutChecksum, checksum]);
}

export function buildEspRebootRequestFrame(
  mode: EspRebootMode = "normal",
): Uint8Array {
  return buildUnerV2Frame({
    cmd: UNER_V2_CMD.REBOOT_ESP,
    payload: [mode === "ap" ? ESP_REBOOT_MODE.AP : ESP_REBOOT_MODE.NORMAL],
  });
}

export function buildStmResetFrame(): Uint8Array {
  return buildUnerV2Frame({ cmd: UNER_V2_CMD.RESET_MCU });
}

export function buildGetCarModeFrame(): Uint8Array {
  return buildUnerV2Frame({ cmd: UNER_V2_CMD.GET_CAR_MODE });
}

export function buildTelemetrySetRateFrame(periodMs: number): Uint8Array {
  const normalizedPeriod = Math.max(0, Math.min(0xffff, Math.round(periodMs)));
  const payload = [normalizedPeriod & 0xff, (normalizedPeriod >> 8) & 0xff];

  return buildUnerV2Frame({
    cmd: UNER_V2_CMD.TELEMETRY_SET_RATE,
    payload,
  });
}

export function formatUnerFrameHex(frame: Uint8Array): string {
  return Array.from(frame, (byte) => `00${byte.toString(16).toUpperCase()}`.slice(-2)).join(" ");
}

export function parseUnerV2Frames(bytes: Uint8Array): UnerV2ParsedFrame[] {
  const frames: UnerV2ParsedFrame[] = [];

  for (let offset = 0; offset <= bytes.length - 10; offset += 1) {
    if (!hasHeaderAt(bytes, offset)) {
      continue;
    }

    const payloadLength = bytes[offset + 4];
    const frameLength = 10 + payloadLength;

    if (offset + frameLength > bytes.length) {
      break;
    }

    const token = bytes[offset + 5];
    const version = bytes[offset + 6];
    if (token !== UNER_V2.TOKEN || version !== UNER_V2.VERSION) {
      continue;
    }

    const checksumIndex = offset + frameLength - 1;
    const frameWithoutChecksum = Array.from(bytes.slice(offset, checksumIndex));
    const checksum = bytes[checksumIndex];

    if (xorChecksum(frameWithoutChecksum) !== checksum) {
      continue;
    }

    const route = bytes[offset + 7];
    const source = (route >> 4) & 0x0f;
    const destination = route & 0x0f;
    const cmd = bytes[offset + 8];
    const payloadStart = offset + 9;
    const payloadEnd = payloadStart + payloadLength;

    frames.push({
      cmd,
      payload: bytes.slice(payloadStart, payloadEnd),
      payloadLength,
      route,
      source,
      destination,
      checksum,
      offset,
      frame: bytes.slice(offset, offset + frameLength),
    });
  }

  return frames;
}

export function createUnerV2StreamParser(
  maxBufferedBytes = 4096,
): UnerV2StreamParser {
  let buffer: number[] = [];
  let absoluteOffset = 0;

  const discard = (count: number) => {
    if (count <= 0) {
      return;
    }

    buffer = buffer.slice(count);
    absoluteOffset += count;
  };

  return {
    push(chunk: Uint8Array) {
      const frames: UnerV2ParsedFrame[] = [];
      buffer.push(...chunk);

      if (buffer.length > maxBufferedBytes) {
        discard(buffer.length - (UNER_V2.HEADER.length - 1));
      }

      while (buffer.length >= UNER_V2.HEADER.length) {
        const headerIndex = findHeaderIndex(buffer);

        if (headerIndex < 0) {
          discard(Math.max(0, buffer.length - (UNER_V2.HEADER.length - 1)));
          break;
        }

        if (headerIndex > 0) {
          discard(headerIndex);
        }

        if (buffer.length < 10) {
          break;
        }

        const payloadLength = buffer[4];
        const token = buffer[5];
        const version = buffer[6];

        if (token !== UNER_V2.TOKEN || version !== UNER_V2.VERSION) {
          discard(1);
          continue;
        }

        const frameLength = 10 + payloadLength;
        if (buffer.length < frameLength) {
          break;
        }

        const checksumIndex = frameLength - 1;
        const frameWithoutChecksum = buffer.slice(0, checksumIndex);
        const checksum = buffer[checksumIndex];

        if (xorChecksum(frameWithoutChecksum) !== checksum) {
          discard(1);
          continue;
        }

        const frameBytes = Uint8Array.from(buffer.slice(0, frameLength));
        const payloadStart = 9;
        const payloadEnd = payloadStart + payloadLength;
        const route = buffer[7];

        frames.push({
          cmd: buffer[8],
          payload: frameBytes.slice(payloadStart, payloadEnd),
          payloadLength,
          route,
          source: (route >> 4) & 0x0f,
          destination: route & 0x0f,
          checksum,
          offset: absoluteOffset,
          frame: frameBytes,
        });

        discard(frameLength);
      }

      return frames;
    },
    reset() {
      buffer = [];
      absoluteOffset = 0;
    },
  };
}

function hasHeaderAt(bytes: Uint8Array, offset: number): boolean {
  return UNER_V2.HEADER.every((byte, index) => bytes[offset + index] === byte);
}

function findHeaderIndex(bytes: number[]): number {
  const maxStart = bytes.length - UNER_V2.HEADER.length;

  for (let offset = 0; offset <= maxStart; offset += 1) {
    if (UNER_V2.HEADER.every((byte, index) => bytes[offset + index] === byte)) {
      return offset;
    }
  }

  return -1;
}

function xorChecksum(bytes: number[]): number {
  return bytes.reduce((acc, byte) => acc ^ byte, 0) & 0xff;
}
