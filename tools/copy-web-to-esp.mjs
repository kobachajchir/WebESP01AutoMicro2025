import { access, copyFile, mkdir, realpath, rename, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(webRoot, "dist", "index.html.gz");
const modelSource = path.join(webRoot, "public", "models", "auto_micro.glb");
const modelSizeLimit = 900_000;
const defaultEspRoot = path.resolve(webRoot, "../..", "Firmware ESP01", "FirmESP01MicroArduino2025");

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Uso: npm run copy:esp [-- --esp-dir RUTA_DEL_PROYECTO_ESP]");
    console.log("Copia index.html.gz y el modelo vigente a data/dist; elimina el HTML sin comprimir. No flashea.");
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
  const modelInfo = await stat(modelSource).catch(() => null);
  if (!modelInfo?.isFile() || modelInfo.size === 0) {
    throw new Error("Falta public/models/auto_micro.glb o está vacío.");
  }
  if (modelInfo.size >= modelSizeLimit) {
    throw new Error(`El modelo debe pesar menos de ${modelSizeLimit} bytes; pesa ${modelInfo.size}.`);
  }
  const destination = path.join(espRoot, "data", "dist");
  await mkdir(destination, { recursive: true });
  const destinationReal = await realpath(destination);
  const normalized = (value) => process.platform === "win32" ? value.toLowerCase() : value;
  if (normalized(destinationReal) !== normalized(destination)) {
    throw new Error("El destino data/dist debe ser una carpeta propia del proyecto ESP, sin enlaces.");
  }
  const modelDestination = path.join(destinationReal, "models");
  await mkdir(modelDestination, { recursive: true });
  const modelDestinationReal = await realpath(modelDestination);
  if (normalized(modelDestinationReal) !== normalized(modelDestination)) {
    throw new Error("El destino data/dist/models debe ser una carpeta propia del proyecto ESP, sin enlaces.");
  }
  const target = path.join(destinationReal, "index.html.gz");
  const modelTarget = path.join(modelDestinationReal, "auto_micro.glb");
  const temporary = path.join(destinationReal, `.index-${randomUUID()}.gz.tmp`);
  const modelTemporary = path.join(modelDestinationReal, `.model-${randomUUID()}.glb.tmp`);
  try {
    await copyFile(source, temporary);
    await copyFile(modelSource, modelTemporary);
    // Publish the model first so the updated bundle has its current geometry available.
    await rename(modelTemporary, modelTarget);
    await rename(temporary, target);
    await rm(path.join(destinationReal, "index.html"), { force: true });
  } finally {
    await rm(temporary, { force: true });
    await rm(modelTemporary, { force: true });
  }
  console.log(`Index comprimido actualizado:\n  ${target}\n  ${info.size} bytes`);
  console.log(`Modelo actualizado:\n  ${modelTarget}\n  ${modelInfo.size} bytes`);
  console.log("No se copió index.html. Draco y los demás archivos de data se conservan. No se flasheó la ESP.");
}

main().catch((error) => {
  console.error(`No se pudo copiar la web: ${error.message}`);
  process.exitCode = 1;
});
