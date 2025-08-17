/** Devuelve Uint8Array con el valor LE16 de n */
export function le16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
}

/** Lee un valor LE16 desde buf en la posición off */
export function readLe16(buf: Uint8Array, off = 0): number {
  return (buf[off] | (buf[off + 1] << 8)) >>> 0;
}
