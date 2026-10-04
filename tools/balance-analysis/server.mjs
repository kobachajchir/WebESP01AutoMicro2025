// Node 22.18+; same numerical engine as the browser. No hardware control.
import { createServer } from "node:http";
import { analyzeSession } from "../../src/features/balanceCalibration/optimizer.ts";
const host = process.env.BALANCE_HOST || "127.0.0.1";
const port = Number(process.env.PORT || 9877);
const origin = process.env.BALANCE_ALLOWED_ORIGIN || "http://localhost:5173";
const token = process.env.BALANCE_API_TOKEN;
if (!["127.0.0.1", "localhost"].includes(host) && !token) throw new Error("Configurar BALANCE_API_TOKEN antes de exponer el servicio.");
createServer(async (req, res) => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin" };
  if (req.headers.origin === origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
  }
  const reply = (status, value) => { if (!res.writableEnded) { res.writeHead(status, headers); res.end(JSON.stringify(value)); } };
  if (req.url !== "/v1/balance/analyze") return reply(404, { error: "not_found" });
  if (req.headers.origin && req.headers.origin !== origin) return reply(403, { error: "origin_not_allowed" });
  if (req.method === "OPTIONS") { res.writeHead(204, headers); return res.end(); }
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
  if (token && req.headers.authorization !== `Bearer ${token}`) return reply(401, { error: "unauthorized" });
  if (!(req.headers["content-type"] || "").startsWith("application/json")) return reply(415, { error: "json_required" });
  try {
    const chunks = []; let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) { reply(413, { error: "session_too_large" }); return; }
      chunks.push(chunk);
    }
    reply(200, analyzeSession(JSON.parse(Buffer.concat(chunks).toString("utf8"))));
  } catch (error) { reply(400, { error: "invalid_session", message: error instanceof Error ? error.message : "Sesión inválida" }); }
}).listen(port, host, () => console.log(`Balance analysis listening on ${host}:${port}`));
