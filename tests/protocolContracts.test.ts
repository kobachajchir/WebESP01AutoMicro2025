import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  decodeBootReport,
  decodeControlSnapshot,
  decodeIrSnapshot,
  decodeMpuSnapshot,
  decodeStreamSetAck,
  decodeStreamStopAck,
  decodeTelemetrySnapshot,
  formatF4ExtensionProfile,
  formatF4PackedVersion,
  parseBootReportData,
  parseMpuData,
  normalizeStreamPeriodMs,
} from "../src/protocol/f4Payloads.ts";
import { EspClient, EspApiError } from "../src/protocol/espClient.ts";
import { resolveWebSocketUrl } from "../src/protocol/wsApi.ts";
import {
  getStmRemoteActionFeedback,
  STM_REMOTE_ACTION_STATUS,
} from "../src/utils/stmRemoteActionFeedback.ts";

const fixture = JSON.parse(readFileSync(new URL("../src/protocol/__fixtures__/f4-uner-golden-vectors.json", import.meta.url), "utf8"));
const bytes = (name: string) => Uint8Array.from(fixture.vectors[name].split(" ").map((value: string) => Number.parseInt(value, 16)));

test("MPU usa layout float32 LE de 42 bytes", () => {
  const sample = decodeMpuSnapshot(bytes("0x60_0x90_mpu"));
  assert.equal(sample.sampleSeq, 0x1234);
  assert.equal(sample.sampleDtUs, 2500);
  assert.equal(sample.eulerDeg.roll, 1.25);
  assert.equal(sample.eulerDeg.pitch, -2.5);
  assert.equal(sample.eulerDeg.yaw, 3.75);
  assert.equal(sample.magValid, true);
  assert.equal(sample.sampleValid, true);
  assert.equal(sample.accelG.y, -0.20000000298023224);
  assert.equal("linearAccelMg" in sample, false);
});

test("MPU JSON acepta flags nuevos y mantiene fallback compatible", () => {
  const base = {
    status: 0, flags: 0x05, sampleSeq: 7, sampleDtUs: 2500,
    roll: 1, pitch: 2, yaw: 3,
    accel: { x: 0, y: 0, z: 1 },
    gyro: { x: 0, y: 0, z: 0 },
  };
  assert.equal(parseMpuData(base).magValid, true);
  assert.equal(parseMpuData({ ...base, magValid: false }).magValid, false);
});


test("MPU rechaza truncado y NaN", () => {
  assert.throws(() => decodeMpuSnapshot(new Uint8Array(41)), /42 bytes/);
  const invalid = bytes("0x60_0x90_mpu");
  new DataView(invalid.buffer).setUint32(6, 0x7fc00000, true);
  assert.throws(() => decodeMpuSnapshot(invalid), /no finito/);
});

test("IR conserva orden fisico y floats negativos", () => {
  const sample = decodeIrSnapshot(bytes("0x6a_0x91_ir"));
  assert.equal(sample.raw.lineCenter, 100);
  assert.equal(sample.raw.objectLeft45, 106);
  assert.equal(sample.norm.objectRight45, 1700);
  assert.equal(sample.lateralErrorMm, -12.5);
});

test("ACK SET y STOP tienen contratos 4/1 separados", () => {
  assert.deepEqual(decodeStreamSetAck(bytes("0x61_mpu_set_ack")), { status: 0, active: true, periodMs: 20 });
  assert.deepEqual(decodeStreamStopAck(bytes("0x62_mpu_stop_ack")), { status: 0 });
  assert.throws(() => decodeStreamSetAck(bytes("0x62_mpu_stop_ack")), /4 bytes/);
});

test("telemetria 92 y control 64 se decodifican", () => {
  const telemetry = decodeTelemetrySnapshot(bytes("0x64_telemetry"));
  const control = decodeControlSnapshot(bytes("0x67_control"));
  assert.equal(telemetry.mpuStreamPeriodMs, 100);
  assert.equal(telemetry.rawAdc.length, 8);
  assert.equal(control.lineFsm, 1);
  assert.equal(control.estimatedVelocityMps, 1.25);
});

test("reporte de arranque 0x6F/0x9F conserva perfil, versiones y CRC", () => {
  const payload = new Uint8Array(22);
  const view = new DataView(payload.buffer);
  payload.set([1, 0, 1, 0x18, 0x1f, 0], 0);
  view.setUint32(6, 0x00010000, true);
  view.setUint32(10, 0x00020100, true);
  view.setUint32(14, 280092, true);
  view.setUint32(18, 0xec16cb3c, true);

  const report = decodeBootReport(payload);
  assert.equal(report.mailboxValid, true);
  assert.equal(report.extensionProfileId, 0);
  assert.equal(formatF4ExtensionProfile(report.extensionProfileId), "NRF24 (SPI2)");
  assert.equal(formatF4PackedVersion(report.bootloaderVersion), "1.0.0");
  assert.equal(formatF4PackedVersion(report.appVersion), "2.1.0");
  assert.equal(report.appCrc32, 0xec16cb3c);
  assert.deepEqual(
    parseBootReportData({ cmd: 0x9f, payload: Array.from(payload) }),
    report,
  );
  assert.throws(() => decodeBootReport(payload.subarray(0, 21)), /22 bytes/);
});

test("periodos F4 se limitan a 20..1000 ms", () => {
  assert.equal(normalizeStreamPeriodMs(8), 20);
  assert.equal(normalizeStreamPeriodMs(2000), 1000);
});

test("EspClient correlaciona respuestas fuera de orden", async () => {
  const sent: Array<Record<string, unknown>> = [];
  const client = new EspClient();
  client.setSender((text) => sent.push(JSON.parse(text)));
  const first = client.request("getMpuSnapshot", {}, { requestId: "a" });
  const second = client.request("getIrSnapshot", {}, { requestId: "b" });
  client.accept({ api: 1, type: "response", requestId: "b", ok: true, command: "getIrSnapshot", data: { id: 2 } });
  client.accept({ api: 1, type: "response", requestId: "a", ok: true, command: "getMpuSnapshot", data: { id: 1 } });
  assert.deepEqual(await first, { id: 1 });
  assert.deepEqual(await second, { id: 2 });
  assert.equal(sent.length, 2);
});

test("EspClient rechaza pending al desconectar", async () => {
  const client = new EspClient();
  client.setSender(() => undefined);
  const pending = client.request("getMpuSnapshot", {}, { timeoutMs: 1000 });
  client.setSender(null);
  await assert.rejects(pending, (error: unknown) => error instanceof EspApiError && error.code === "connection_lost");
});

test("URL WS respeta override y HTTPS", () => {
  assert.equal(resolveWebSocketUrl("wss://device.example/ws", { protocol: "http:", host: "ignored" } as Location), "wss://device.example/ws");
  assert.equal(resolveWebSocketUrl(undefined, { protocol: "https:", host: "car.local" } as Location), "wss://car.local/ws");
});

test("acciones STM explican screen mismatch y solicitan resincronizacion", () => {
  const error = new EspApiError("f4_nack", "STM command rejected", {
    target: "stm",
    status: STM_REMOTE_ACTION_STATUS.SCREEN_MISMATCH,
    stmCode: STM_REMOTE_ACTION_STATUS.SCREEN_MISMATCH,
  });
  const feedback = getStmRemoteActionFeedback(error, "girar encoder");
  assert.equal(feedback.status, STM_REMOTE_ACTION_STATUS.SCREEN_MISMATCH);
  assert.equal(feedback.refreshScreen, true);
  assert.match(feedback.message, /pantalla del F4 cambio/i);
});

test("acciones STM distinguen evento no consumido de sesion vencida", () => {
  const notConsumed = getStmRemoteActionFeedback(
    new EspApiError("f4_nack", "STM command rejected", { status: 4 }),
    "pulsar USER",
  );
  assert.match(notConsumed.message, /ningun manejador/i);
  assert.equal(notConsumed.reauthenticationRequired, false);

  const unauthorized = getStmRemoteActionFeedback(
    new EspApiError("unauthorized", "A valid FirmwareF4 PIN session is required"),
    "pulsar USER",
  );
  assert.equal(unauthorized.reauthenticationRequired, true);
  assert.equal(unauthorized.refreshScreen, false);
});
