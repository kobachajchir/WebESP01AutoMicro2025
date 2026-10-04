import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(web, "../..");
const manifest = JSON.parse(await readFile(path.join(web, "src/features/protocolStudio/commandManifest.json"), "utf8"));
const source = await readFile(path.join(root, "Firmware ESP01/FirmESP01MicroArduino2025/src/f4_command_registry.c"), "utf8");
const observed = [...source.matchAll(/SPEC\(0x([0-9A-F]+)u,\s*"([^"]+)",([^\n]+)\)/gi)].map(match => ({
  id: `0x${match[1].toUpperCase().padStart(2,"0")}`, name: match[2], values: match[3].split(",").map(value => value.trim()),
}));
const missing = observed.filter(item => item.values[9] === "true" && !manifest.commands.some(entry => entry.id === item.id));
const renamed = observed.filter(item => manifest.commands.some(entry => entry.id === item.id && entry.name !== item.name));
const manual = manifest.commands.filter(entry => entry.implemented && entry.coverage === "raw");
const declared = manifest.commands.filter(entry => !entry.implemented);
const overrides = manifest.commands.filter(entry => entry.implemented !== entry.registryImplemented);
const report = { assigned: manifest.commands.length, missing, renamed, manualPayload: manual.map(({id,name,schema})=>({id,name,schema})), declared: declared.map(({id,name})=>({id,name})), handlerOverrides: overrides.map(({id,name,evidence})=>({id,name,evidence})), note: "Compara asignación de IDs/nombres, no demuestra paridad de payloads ni funcionamiento físico. Revisar tabla/handlers y transportes al incorporar comandos nuevos." };
console.log(JSON.stringify(report, null, 2));
if (missing.length || renamed.length) process.exitCode = 1;
