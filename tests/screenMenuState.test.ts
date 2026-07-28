import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeStmMenuIndex,
  resolveVisibleMenuWindow,
} from "../src/protocol/screenMenuState.ts";

test("menu selection 0x96 conserva indices F4 zero-based", () => {
  assert.equal(normalizeStmMenuIndex(0, 3), 0);
  assert.equal(normalizeStmMenuIndex(1, 3), 1);
  assert.equal(normalizeStmMenuIndex(2, 3), 2);
});

test("menu selection limita un indice fuera del itemCount", () => {
  assert.equal(normalizeStmMenuIndex(9, 3), 2);
});

test("menu principal no TEST posiciona cursor con indice visible F4", () => {
  assert.deepEqual(resolveVisibleMenuWindow(1, 4), { firstVisibleIndex: 0, selectedSlot: 1 });
  assert.deepEqual(resolveVisibleMenuWindow(3, 4), { firstVisibleIndex: 3, selectedSlot: 0 });
});

test("menu WiFi pinta selectedIndex 4 en la segunda pagina", () => {
  assert.deepEqual(resolveVisibleMenuWindow(4, 5), { firstVisibleIndex: 3, selectedSlot: 1 });
});

test("snapshot sin selectedIndex no inventa cursor", () => {
  assert.deepEqual(resolveVisibleMenuWindow(undefined, 5), { firstVisibleIndex: 0, selectedSlot: null });
});
