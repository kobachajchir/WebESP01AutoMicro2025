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
} as const;

export type UnerV2FrameOptions = {
  cmd: number;
  payload?: Uint8Array | number[];
  source?: number;
  destination?: number;
};

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

export function buildEspRebootRequestFrame(): Uint8Array {
  return buildUnerV2Frame({ cmd: UNER_V2_CMD.REBOOT_ESP });
}

export function buildStmResetFrame(): Uint8Array {
  return buildUnerV2Frame({ cmd: UNER_V2_CMD.RESET_MCU });
}

export function formatUnerFrameHex(frame: Uint8Array): string {
  return Array.from(frame, (byte) => `00${byte.toString(16).toUpperCase()}`.slice(-2)).join(" ");
}

function xorChecksum(bytes: number[]): number {
  return bytes.reduce((acc, byte) => acc ^ byte, 0) & 0xff;
}
