import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import * as WebScreenCodes from "../src/screens/screenCodes.ts";

interface FirmwareScreenCode {
  name: string;
  value: number;
}

const firmwareHeaderPath = fileURLToPath(
  new URL("../../../FirmwareF4/Core/Inc/screen_codes.h", import.meta.url),
);
const webRootPath = fileURLToPath(new URL("..", import.meta.url));

function readFirmwareScreenCodes(): FirmwareScreenCode[] {
  const header = readFileSync(firmwareHeaderPath, "utf8");
  const definitions: FirmwareScreenCode[] = [];
  const directDefinition =
    /^#define\s+(SCREEN_CODE_[A-Z0-9_]+)\s+SCREEN_CODE\(\s*(0x[0-9a-f]+)u?\s*,\s*(0x[0-9a-f]+)u?\s*,\s*(0x[0-9a-f]+)u?\s*\)/gim;

  for (const match of header.matchAll(directDefinition)) {
    const [, name, menu, submenu, page] = match;
    assert.ok(name && menu && submenu && page, "Definicion F4 incompleta");
    definitions.push({
      name,
      value:
        (Number.parseInt(menu, 16) << 16) |
        (Number.parseInt(submenu, 16) << 8) |
        Number.parseInt(page, 16),
    });
  }

  return definitions.filter(({ name }) => name !== "SCREEN_CODE_NONE");
}

test("todos los screenCodes concretos de F4 existen con el mismo valor en Web", () => {
  const firmwareCodes = readFirmwareScreenCodes();
  assert.ok(firmwareCodes.length > 0, "No se pudieron leer screenCodes del header F4");

  for (const { name, value } of firmwareCodes) {
    const webValue = (WebScreenCodes as Record<string, unknown>)[name];
    assert.equal(
      webValue,
      value,
      `${name} debe conservar el valor 0x${value.toString(16).padStart(6, "0")}`,
    );
  }
});

test("todos los screenCodes concretos de F4 resuelven a comandos OLED Web", async () => {
  const vite = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    root: webRootPath,
    server: { middlewareMode: true },
  });

  const { resolveOledScreen } = await vite.ssrLoadModule(
    "/src/screens/screenRenderRegistry.ts",
  ) as typeof import("../src/screens/screenRenderRegistry.ts");

  test.after(async () => {
    await vite.close();
  });

  for (const { name, value } of readFirmwareScreenCodes()) {
    const resolved = resolveOledScreen({ screenCode: value });
    assert.ok(
      resolved,
      `${name} (0x${value.toString(16).padStart(6, "0")}) no tiene renderer Web`,
    );
    assert.ok(resolved.commands.length > 0, `${name} debe producir al menos un comando`);
  }
});
