/* eslint-disable no-bitwise */

/**
 * UNERProtocol (TypeScript)
 * - Espejo de la versión C (STM32/HAL)
 * - Protocolo binario:
 *   HEADER "UNER" (4B), LENGTH (1B), TOKEN ':' (1B), CMD (1B), PAYLOAD (N), CHKSUM (1B)
 * - LENGTH = 1 (CMD) + N (PAY) + 1 (CHK) -> [2..32], N <= 30
 * - CHECKSUM = XOR(HEADER..PAYLOAD)  // incluye header, length y token
 *
 * Compatibilidad opcional (legacy):
 * - UNER_ENABLE_LEGACY_HEADER_UNER_COLON: si true, acepta/emite header "UNER:" (5B) sin token aparte
 */

/* =================== Opciones de compatibilidad =================== */
export const UNER_ENABLE_LEGACY_HEADER_UNER_COLON = false;

/* =================== Constantes del protocolo =================== */
export const UNER = {
  HEADER_CORRECT: new Uint8Array([0x55, 0x4e, 0x45, 0x52]), // "UNER"
  HEADER_LEGACY: new Uint8Array([0x55, 0x4e, 0x45, 0x52, 0x3a]), // "UNER:"
  TOKEN: 0x3a, // ':'
  PCK_MAX_PAYLOAD: 30,
  // Overhead = 4 hdr + 1 len + 1 token + 1 cmd + 1 chksum = 8
  PCK_OVERHEAD: 8,
  PCK_MAX_TOTAL: 8 + 30, // 38 (se recalcula a partir de los defs)
  LENGTH_MIN: 2, // 1 (CMD) + 0 (PAY) + 1 (CHK)
  LENGTH_MAX: 32, // 1 (CMD) + 30 (PAY) + 1 (CHK)
} as const;

/* =================== Tipos y estados =================== */
export type UNERPacket = {
  cmd: number;
  payload: Uint8Array; // copia recortada a payloadLen
  payloadLen: number; // N
  chk: number; // checksum recibido
};

export interface UNERTransport {
  send: (data: Uint8Array) => void;
  onBytes: (handler: (data: Uint8Array) => void) => () => void;
}

export enum UNERStatus {
  OK = 0,
  IN_PROGRESS = 1,
  NO_PACKET = 2,
  ERR_NULL_PTR = -1,
  ERR_PAYLOAD_TOO_LONG = -2,
  ERR_BUFFER_TOO_SMALL = -3,
  ERR_INVALID_LENGTH = -4,
  ERR_HEADER_MISMATCH = -5,
  ERR_TOKEN_MISMATCH = -9,
  ERR_CHECKSUM_MISMATCH = -6,
  ERR_RX_OVERFLOW = -7,
  ERR_TX_FAIL = -8,
  ERR_ARG = -10,
}

/* NO exportar; solo uso interno del parser */
const enum ParserState {
  WAIT_HEADER = 0,
  WAIT_LEN,
  WAIT_TOKEN, // omitido en legacy (porque el ':' ya va en el header)
  WAIT_CMD,
  WAIT_PAYLOAD,
  WAIT_CHK,
}

export type OnPacketFn = (p: UNERPacket) => void;

/* =================== Implementación =================== */
export class UNERProtocol {
  /* Ring buffer RX */
  private rxRing: Uint8Array;
  private head = 0;
  private tail = 0;

  /* Estado del parser */
  private state: ParserState = ParserState.WAIT_HEADER;
  private headerProgress = 0; // 0..(len(header)-1)
  private cksRunning = 0;

  /* Campos en curso */
  private lenField = 0; // LENGTH
  private expectedPayload = 0; // N = len - 2 (CMD y CHK)
  private cmdByte = 0;
  private payloadIdx = 0;

  /* Último paquete válido (buffer interno de payload) */
  private _payloadBuf: Uint8Array = new Uint8Array(UNER.PCK_MAX_PAYLOAD);
  private _packet: UNERPacket = {
    cmd: 0,
    payloadLen: 0,
    chk: 0,
    payload: new Uint8Array(0),
  };
  private _packetReady = false;

  /* Estadísticas */
  public packetsOK = 0;
  public errorsChecksum = 0;
  public errorsLength = 0;
  public errorsHeader = 0;
  public errorsToken = 0;
  public errorsOverflow = 0;

  constructor(
    ringCapacity = 128, // preferentemente potencia de 2
    private onPacket?: OnPacketFn // <- parámetro-propiedad (no declarar arriba)
  ) {
    this.rxRing = new Uint8Array(ringCapacity);
    this.resetParser();
  }

  /* ==== API simétrica a C ==== */

  /** Resetea la máquina de estados. No borra el contenido del ring. */
  resetParser(): void {
    this.state = ParserState.WAIT_HEADER;
    this.headerProgress = 0;
    this.cksRunning = 0;

    this.lenField = 0;
    this.expectedPayload = 0;
    this.cmdByte = 0;
    this.payloadIdx = 0;

    this._packetReady = false;
  }

  /** Inserta un byte crudo (desde WebSerial, WebSocket, etc). */
  pushByte(b: number): UNERStatus {
    // ring "lleno" si (head - tail) >= (capacidad - 1)
    const count = this.head - this.tail;
    if (count >= this.rxRing.length - 1) {
      this.errorsOverflow++;
      return UNERStatus.ERR_RX_OVERFLOW;
    }
    this.rxRing[this.head % this.rxRing.length] = b & 0xff;
    this.head++;
    return UNERStatus.OK;
  }

  /** Procesa el ring hasta agotar o formar >= 1 paquete. */
  parse(): UNERStatus {
    let ret: UNERStatus = UNERStatus.NO_PACKET;

    while (this.head !== this.tail) {
      const b = this.rxRing[this.tail % this.rxRing.length];
      this.tail++;

      switch (this.state) {
        case ParserState.WAIT_HEADER: {
          const hdr = UNER_ENABLE_LEGACY_HEADER_UNER_COLON
            ? UNER.HEADER_LEGACY
            : UNER.HEADER_CORRECT;

          if (b === hdr[this.headerProgress]) {
            this.cksRunning ^= b; // XOR incluye header
            this.headerProgress++;
            if (this.headerProgress >= hdr.length) {
              this.headerProgress = 0;
              this.state = ParserState.WAIT_LEN;
            }
          } else {
            // Re-sincroniza y reconsidera b como posible 'U'
            this.resetParser();
            if (b === 0x55 /* 'U' */) {
              this.headerProgress = 1;
              this.cksRunning = b;
            }
          }
          break;
        }

        case ParserState.WAIT_LEN:
          this.lenField = b & 0xff;
          this.cksRunning ^= b;
          if (
            this.lenField < UNER.LENGTH_MIN ||
            this.lenField > UNER.LENGTH_MAX
          ) {
            this.errorsLength++;
            // Re-sincroniza y reconsidera b como posible 'U'
            this.resetParser();
            if (b === 0x55) {
              this.headerProgress = 1;
              this.cksRunning = b;
            }
          } else {
            this.state = UNER_ENABLE_LEGACY_HEADER_UNER_COLON
              ? ParserState.WAIT_CMD // en legacy el ':' ya fue parte del header
              : ParserState.WAIT_TOKEN; // en formato correcto ahora esperamos TOKEN
          }
          break;

        case ParserState.WAIT_TOKEN:
          if (b !== UNER.TOKEN) {
            this.errorsToken++;
            // Re-sincroniza y reconsidera b como posible 'U'
            this.resetParser();
            if (b === 0x55) {
              this.headerProgress = 1;
              this.cksRunning = b;
            }
          } else {
            this.cksRunning ^= b; // XOR incluye token
            this.state = ParserState.WAIT_CMD;
          }
          break;

        case ParserState.WAIT_CMD:
          this.cmdByte = b & 0xff;
          this.cksRunning ^= b; // XOR incluye CMD
          this.expectedPayload = this.lenField - 2; // CMD + CHK
          this.payloadIdx = 0;
          this.state =
            this.expectedPayload === 0
              ? ParserState.WAIT_CHK
              : ParserState.WAIT_PAYLOAD;
          break;

        case ParserState.WAIT_PAYLOAD:
          if (this.payloadIdx < UNER.PCK_MAX_PAYLOAD) {
            this._payloadBuf[this.payloadIdx++] = b & 0xff;
            this.cksRunning ^= b;
            if (this.payloadIdx >= this.expectedPayload) {
              this.state = ParserState.WAIT_CHK;
            }
          } else {
            // No debería suceder si len fue validado
            this.errorsLength++;
            this.resetParser();
            if (b === 0x55) {
              this.headerProgress = 1;
              this.cksRunning = b;
            }
          }
          break;

        case ParserState.WAIT_CHK: {
          const cks = b & 0xff;
          if (cks !== this.cksRunning) {
            this.errorsChecksum++;
            // Re-sincroniza y reconsidera b como 'U'
            this.resetParser();
            if (b === 0x55) {
              this.headerProgress = 1;
              this.cksRunning = b;
            }
          } else {
            // Paquete válido
            this._packet = {
              cmd: this.cmdByte,
              payloadLen: this.expectedPayload,
              chk: cks,
              payload: this._payloadBuf.slice(0, this.expectedPayload),
            };
            this._packetReady = true;
            this.packetsOK++;

            if (this.onPacket) this.onPacket(this._packet);

            // Listo para buscar otro header
            this.state = ParserState.WAIT_HEADER;
            this.headerProgress = 0;
            this.cksRunning = 0;
            ret = UNERStatus.OK;
          }
          break;
        }

        default:
          this.resetParser();
          break;
      }
    }

    return ret;
  }

  /** ¿Hay paquete listo? (modo polling) */
  packetReady(): boolean {
    return this._packetReady;
  }

  /** Devuelve el último paquete válido (copia del payload ya recortado). */
  getLastPacket(): UNERPacket {
    return {
      cmd: this._packet.cmd,
      payloadLen: this._packet.payloadLen,
      chk: this._packet.chk,
      payload: this._packet.payload.slice(0),
    };
  }

  /** Limpia el flag de paquete listo. */
  clearFlag(): void {
    this._packetReady = false;
  }

  /** Construye un paquete binario listo para enviar (Uint8Array). */
  buildPacket(cmd: number, payload?: Uint8Array): Uint8Array {
    const n = payload ? payload.length : 0;
    if (n > UNER.PCK_MAX_PAYLOAD) {
      throw new Error("UNER: payload_len fuera de rango");
    }

    const total = UNER.PCK_OVERHEAD + n;
    const buf = new Uint8Array(total);
    let i = 0;

    if (UNER_ENABLE_LEGACY_HEADER_UNER_COLON) {
      // "UNER:" (legacy)
      buf.set(UNER.HEADER_LEGACY, i);
      i += UNER.HEADER_LEGACY.length;
    } else {
      // "UNER"
      buf.set(UNER.HEADER_CORRECT, i);
      i += UNER.HEADER_CORRECT.length;
    }

    const lenField = 1 + n + 1; // CMD + PAY + CHK
    buf[i++] = lenField & 0xff;

    if (!UNER_ENABLE_LEGACY_HEADER_UNER_COLON) {
      // En formato correcto, el ':' va después del length
      buf[i++] = UNER.TOKEN;
    }

    buf[i++] = cmd & 0xff;

    if (n && payload) {
      buf.set(payload, i);
      i += n;
    }

    const cks = UNERProtocol.calcChecksum(buf.subarray(0, i));
    buf[i++] = cks & 0xff;

    return buf;
  }

  /** XOR de todos los bytes del header hasta el último byte del payload. */
  static calcChecksum(data: Uint8Array): number {
    let x = 0;
    for (let i = 0; i < data.length; i++) x ^= data[i];
    return x & 0xff;
  }

}
