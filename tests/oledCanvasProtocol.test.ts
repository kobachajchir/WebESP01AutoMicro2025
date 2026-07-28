import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOledCanvasChunkArgs,
  bytesToBase64,
  splitOledCanvasChunks,
  shouldCancelOledCanvasForMode,
  shouldCancelOledCanvasForScreen,
  validateOledCanvasBeginResponse,
  validateOledCanvasCancelResponse,
  validateOledCanvasChunkResponse,
  validateOledCanvasCommitResponse,
} from "../src/features/oledEditor/oledCanvasProtocol.ts";
import { buildWsRequest, ESP_COMMANDS } from "../src/protocol/wsApi.ts";

test("Base64 cubre bloques completos y padding", () => {
  assert.equal(bytesToBase64(Uint8Array.of(0x4d, 0x61, 0x6e)), "TWFu");
  assert.equal(bytesToBase64(Uint8Array.of(0x4d)), "TQ==");
  assert.equal(bytesToBase64(Uint8Array.of(0x4d, 0x61)), "TWE=");
});

test("Web divide el framebuffer en offsets 0 y 512", () => {
  const chunks = splitOledCanvasChunks(Uint8Array.from({ length: 1024 }, (_, index) => index & 0xff));
  assert.deepEqual(chunks.map(({ offset, bytes }) => [offset, bytes.length]), [[0, 512], [512, 512]]);
  assert.equal(chunks[0].dataBase64.length, 684);
  assert.equal(chunks[1].dataBase64.length, 684);
});

test("envelope maximo de chunk queda por debajo de WS_JSON_MAX=1024", () => {
  const chunk = splitOledCanvasChunks(new Uint8Array(1024))[0];
  const request = buildWsRequest(
    ESP_COMMANDS.OLED_CANVAS_CHUNK,
    buildOledCanvasChunkArgs(0xffff, chunk),
    "x".repeat(64),
  );
  assert.ok(JSON.stringify(request).length < 1024);
});

test("valida correlacion de begin, chunks y commit final", () => {
  const begin = validateOledCanvasBeginResponse({ transferId: "42", chunkBytes: 512, nextOffset: 0 });
  assert.equal(begin.transferId, 42);
  assert.throws(() => validateOledCanvasBeginResponse({ transferId: 0, chunkBytes: 512, nextOffset: 0 }));
  assert.doesNotThrow(() => validateOledCanvasChunkResponse({ transferId: 42, nextOffset: 512 }, 42, 512));
  const commit = validateOledCanvasCommitResponse({
    transferId: 42,
    state: "rendered",
    bytes: 1024,
    crc32: "CBF43926",
    screenCode: 0x030503,
  }, 42, 0xcbf43926);
  assert.equal(commit.state, "rendered");
  assert.throws(() => validateOledCanvasCommitResponse({
    ...commit,
    crc32: "00000000",
  }, 42, "CBF43926"));
});

test("valida correlacion de cancel por transferId y estado", () => {
  assert.deepEqual(
    validateOledCanvasCancelResponse({ transferId: 42, state: "canceled" }, 42),
    { transferId: 42, state: "canceled" },
  );
  assert.throws(() => validateOledCanvasCancelResponse({ transferId: 43, state: "canceled" }, 42));
  assert.throws(() => validateOledCanvasCancelResponse({ transferId: 42, state: "rendered" }, 42));
});

test("cancela cambios de modo o pantalla desde la fase preparing", () => {
  assert.equal(shouldCancelOledCanvasForMode(true, 0x01), true);
  assert.equal(shouldCancelOledCanvasForMode(true, 0x02), false);
  assert.equal(shouldCancelOledCanvasForMode(false, 0x01), false);
  assert.equal(shouldCancelOledCanvasForScreen(true, 0x030500), true);
  assert.equal(shouldCancelOledCanvasForScreen(true, 0x030503), false);
  assert.equal(shouldCancelOledCanvasForScreen(false, 0x030500), false);
});
