import type { CommandDefinition, CommandField } from "./types";
import { decodeMpuSnapshot, decodeIrSnapshot, decodeTelemetrySnapshot, decodeControlSnapshot, decodeBootReport, decodeStreamSetAck } from "../../protocol/f4Payloads";

export function strictHexBytes(value: string): number[] {
  if (!value.trim()) return [];
  return value.trim().split(/\s+/).map(token => {
    if (!/^(?:0x)?[0-9a-f]{1,2}$/i.test(token)) throw new Error(`Byte hexadecimal inválido: ${token}`);
    return Number.parseInt(token.replace(/^0x/i, ""), 16);
  });
}
function integer(raw: string, maximum: number, hex = false): number {
  const value = raw.trim().replace(hex ? /^0x/i : /^$/, "");
  if (!(hex ? /^[0-9a-f]+$/i : /^\d+$/).test(value)) throw new Error("Número entero inválido.");
  const result = Number.parseInt(value, hex ? 16 : 10);
  if (!Number.isSafeInteger(result) || result > maximum) throw new Error(`Número fuera de rango 0..${maximum}.`);
  return result;
}
function le(value: number, width: number): number[] {
  return Array.from({ length: width }, (_, index) => (value >>> (8 * index)) & 255);
}
function encode(field: CommandField, raw: string): number[] {
  switch (field.type) {
    case "bytes": return strictHexBytes(raw);
    case "digits":
      if (!/^\d{4}$/.test(raw)) throw new Error("El PIN debe contener exactamente cuatro dígitos.");
      return [...raw].map(Number);
    case "str": {
      const data = [...new TextEncoder().encode(raw)];
      if (data.length > 255) throw new Error("El texto supera 255 bytes UTF-8.");
      return [data.length, ...data];
    }
    case "f32": {
      if (!raw.trim() || !Number.isFinite(Number(raw))) throw new Error("Float inválido.");
      const data = new Uint8Array(4); const view = new DataView(data.buffer);
      view.setFloat32(0, Number(raw), true);
      if (!Number.isFinite(view.getFloat32(0, true))) throw new Error("Float fuera del rango f32.");
      return [...data];
    }
    case "hex4": return le(integer(raw, 0xffffffff, true), 4);
    case "u16": return le(integer(raw, 65535), 2);
    case "optionalU16": return raw.trim() ? le(integer(raw, 65535), 2) : [];
    case "optionalU8": return raw.trim() ? [integer(raw, 255)] : [];
    case "hex1": return [integer(raw, 255, true)];
    case "select":
      if (!field.options?.some(option => option.value === raw)) throw new Error(`Opción inválida para ${field.label}.`);
      return [integer(raw, 255)];
    default: return [integer(raw, 255)];
  }
}
export function encodeCommandFields(command: CommandDefinition, values: Record<string, string>): number[] {
  const emit = (ids: string[]) => ids.flatMap(id => {
    const field = command.fields.find(item => item.id === id);
    if (!field) throw new Error(`Campo ausente: ${id}`);
    return encode(field, values[id] ?? "");
  });
  switch (command.name) {
    case "AUTH_VALIDATE_PIN": {
      const scope = integer(values.scope ?? "", 2);
      if (integer(values.requestId ?? "", 255) === 0) throw new Error("Request ID debe ser distinto de cero.");
      return emit(["requestId", "scope", "pin", ...(scope === 1 ? ["screenCode"] : scope === 2 ? ["newPin"] : [])]);
    }
    case "MENU_ITEM_CLICK": {
      const item = integer(values.item ?? "", 3);
      if (item < 1) throw new Error("Ítem visible debe ser 1..3.");
      return emit(["screenCode", "item"]);
    }
    case "SET_BALANCE_PID": {
      const mask = integer(values.mask ?? "", 7);
      if (!mask) throw new Error("Seleccionar al menos un coeficiente PID.");
      return emit(["mask", ...["kp", "ki", "kd"].filter((_, i) => mask & (1 << i))]);
    }
    case "SET_AP_CONFIG_F4": {
      const mask = integer(values.mask ?? "", 15);
      if (!mask) throw new Error("Máscara AP vacía.");
      return emit(["mask", ...(mask & 1 ? ["ssid"] : []), ...(mask & 2 ? ["password"] : []), ...(mask & 4 ? ["protected"] : []), ...(mask & 8 ? ["ip0", "ip1", "ip2", "ip3"] : [])]);
    }
    case "WIFI_CREDENTIALS_FLOW": {
      const action = integer(values.action ?? "", 2);
      return emit(action === 0 ? ["action"] : action === 2 ? ["action", "ssid"] : ["action", "reuse", "ssid", "password", "ip", "gateway", "subnet", "bssid"]);
    }
    case "OLED_CANVAS_TRANSFER": {
      const op = integer(values.operation ?? "", 4); const head = emit(["operation", "transferId"]);
      if (op === 1) return [...head, 128, 64, 0, ...le(1024, 2), ...emit(["crc"])];
      if (op === 2) {
        const data = emit(["data"]);
        if (!data.length || data.length > 112) throw new Error("CHUNK debe tener 1..112 bytes.");
        const offset = integer(values.offset ?? "", 65535);
        if (offset + data.length > 1024) throw new Error("CHUNK excede el framebuffer de 1024 bytes.");
        return [...head, ...emit(["offset"]), data.length, ...data];
      }
      return head;
    }
    default: return command.fields.flatMap(field => encode(field, values[field.id] ?? ""));
  }
}

// Reuse the production decoders; decoding a snapshot here follows the same units as the UI.
export function decodeStudioPayload(id: string, payload: number[], response: boolean): string | null {
  const data = Uint8Array.from(payload); const v = new DataView(data.buffer);
  if ((id === "0x90" || id === "0x60" && response) && data.length === 42) return JSON.stringify(decodeMpuSnapshot(data));
  if ((id === "0x91" || id === "0x6A" && response) && data.length === 56) return JSON.stringify(decodeIrSnapshot(data));
  if ((id === "0x9F" || id === "0x6F" && response) && data.length === 22) return JSON.stringify(decodeBootReport(data));
  if (response && id === "0x64" && data.length === 92) return JSON.stringify(decodeTelemetrySnapshot(data));
  if (response && id === "0x67" && data.length === 64) return JSON.stringify(decodeControlSnapshot(data));
  if (response && ["0x61", "0x6B"].includes(id) && data.length === 4) return JSON.stringify(decodeStreamSetAck(data));
  if (response && id === "0x51" && data.length === 9) return `status=${data[0]}, request_id=${data[1]}, scope=${data[2]}, granted=${data[3]}, ttl_ms=${v.getUint32(4, true)}, attempts_left=${data[8]}`;
  if (response && id === "0x5D" && data.length === 6) return `status=${data[0]}, active=${data[1]}, ttl_ms=${v.getUint32(2, true)}`;
  if (response && ["0x65", "0x66"].includes(id) && data.length === (id === "0x65" ? 13 : 14)) {
    const offset = id === "0x65" ? 1 : 2;
    return `status=${data[0]}${offset === 2 ? `, changed_mask=${data[1]}` : ""}, Kp=${v.getFloat32(offset, true)}, Ki=${v.getFloat32(offset + 4, true)}, Kd=${v.getFloat32(offset + 8, true)}`;
  }
  if ((id === "0x98" || id === "0x79" && response) && data.length === 3) return `line_enabled=${data[0]}, objects_enabled=${data[1]}, persisted=${data[2]}`;
  if (id === "0x7A" && data.length === (response ? 4 : 3)) {
    const offset = response ? 1 : 0;
    return `${response ? `status=${data[0]}, ` : ""}line_enabled=${data[offset]}, objects_enabled=${data[offset + 1]}, persist=${data[offset + 2]}`;
  }
  if (response && ["0x74", "0x62", "0x6C"].includes(id) && data.length === 1) return `status=${data[0]}`;
  if (["0x73", "0x5E", "0x5F", "0x6E"].includes(id) && response && data.length === 2) return `status=${data[0]}, value=${data[1]}`;
  if (["0x52", "0x95", "0x96"].includes(id) && (response || id !== "0x52") && data.length >= 5) {
    const screen = `screen=0x${v.getUint32(0, true).toString(16).toUpperCase().padStart(8, "0")}`;
    if (id === "0x96" && data.length === 7) return `${screen}, selected=${data[4]}, count=${data[5]}, source=${data[6]}`;
    return `${screen}, source=${data[4]}, extensión=${[...data.slice(5)].map(n => n.toString(16).padStart(2,"0")).join(" ") || "vacía"}`;
  }
  if (id === "0x6D" && response && data.length === 10) return `op=${data[0]}, status=${data[1]}, transfer_id=${v.getUint16(2,true)}, next_offset=${v.getUint16(4,true)}, crc32=0x${v.getUint32(6,true).toString(16)}`;
  if (id === "0x63" && response && data.length === 5) return `status=${data[0]}, changed_mask=0x${v.getUint32(1,true).toString(16)}`;
  if (id === "0x78" && response && data.length === 3) return `status=${data[0]}, changed_mask=${data[1]}, apply_state=${data[2]}`;
  return null;
}
