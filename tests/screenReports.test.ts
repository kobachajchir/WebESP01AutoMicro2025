import assert from "node:assert/strict";
import test from "node:test";
import { normalizeScreenReport } from "../src/types/ScreenTypes.ts";

test("snapshot 0x52 toma source antes de seleccion e itemCount", () => {
  const report = normalizeScreenReport({
    cmd: 0x52,
    payload: [0x01, 0x02, 0x01, 0x00, 0x01, 0x02, 0x06],
  });
  assert.equal(report?.screenCode, 0x010201);
  assert.equal(report?.source, 0x01);
});

test("evento 0x96 conserva source al final del payload", () => {
  const report = normalizeScreenReport({
    cmd: 0x96,
    payload: [0x01, 0x02, 0x01, 0x00, 0x02, 0x06, 0x01],
  });
  assert.equal(report?.source, 0x01);
});

test("snapshot extendido de dashboard no confunde flags con source", () => {
  const report = normalizeScreenReport({
    cmd: 0x52,
    payload: [0x01, 0x01, 0x01, 0x00, 0x02, 0x1f, 0x02, 0x02, 192, 168, 4, 1, 0],
  });
  assert.equal(report?.screenCode, 0x010101);
  assert.equal(report?.source, 0x02);
});
