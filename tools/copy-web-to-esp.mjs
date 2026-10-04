import { access, copyFile, mkdir, realpath, rename, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(webRoot, "dist", "index.html.gz");
const defaultEspRoot = path.resolve(webRoot, "../..", "Firmware ESP01", "FirmESP01MicroArduino2025");

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Uso: npm run copy:esp [-- --esp-dir RUTA_DEL_PROYECTO_ESP]");
    console.log("Reemplaza data/dist/index.html.gz y elimina el index.html sin comprimir. No flashea.");
    return;
  }
  if (args.length !== 0 && (args.length !== 2 || args[0] !== "--esp-dir" || !args[1])) {
    throw new Error("Argumentos inválidos. Usá --help para ver el uso.");
  }
  const espRoot = await realpath(args.length ? path.resolve(args[1]) : defaultEspRoot);
  await access(path.join(espRoot, "platformio.ini"));
  const info = await stat(source).catch(() => null);
  if (!info?.isFile() || info.size === 0) {
    throw new Error("Falta dist/index.html.gz o está vacío. Ejecutá npm run build primero.");
  }
  const destination = path.join(espRoot, "data", "dist");
  await mkdir(destination, { recursive: true });
  const destinationReal = await realpath(destination);
  const normalized = (value) => process.platform === "win32" ? value.toLowerCase() : value;
  if (normalized(destinationReal) !== normalized(destination)) {
    throw new Error("El destino data/dist debe ser una carpeta propia del proyecto ESP, sin enlaces.");
  }
  const target = path.join(destinationReal, "index.html.gz");
  const temporary = path.join(destinationReal, `.index-${randomUUID()}.gz.tmp`);
  try {
    await copyFile(source, temporary);
    await rename(temporary, target);
    await rm(path.join(destinationReal, "index.html"), { force: true });
  } finally {
    await rm(temporary, { force: true });
  }
  console.log(`Index comprimido actualizado:\n  ${target}\n  ${info.size} bytes`);
  console.log("No se copió index.html. Modelos y Draco se conservan. No se flasheó la ESP.");
}

main().catch((error) => {
  console.error(`No se pudo copiar la web: ${error.message}`);
  process.exitCode = 1;
});
