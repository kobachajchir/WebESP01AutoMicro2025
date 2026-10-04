// Minimal MCP stdio adapter; stdout is exclusively JSON-RPC.
import { createInterface } from "node:readline";
import { analyzeSession } from "../../src/features/balanceCalibration/optimizer.ts";
const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
const fail = (id, code, message) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", (line) => {
  let request;
  try {
    if (Buffer.byteLength(line) > 8 * 1024 * 1024) throw new Error("request_too_large");
    request = JSON.parse(line);
  } catch { fail(null, -32700, "Invalid JSON request"); return; }
  if (!request || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    fail(request?.id ?? null, -32600, "Invalid request"); return;
  }
  if (request.id === undefined) return;
  const { id, method, params } = request;
  if (method === "initialize") return reply(id, {
    protocolVersion: "2025-06-18", capabilities: { tools: {} },
    serverInfo: { name: "automicro-balance-analysis", version: "1.0.0" },
  });
  if (method === "ping") return reply(id, {});
  if (method === "tools/list") return reply(id, { tools: [{
    name: "analyze_balance_session", title: "Analyze AutoMicro balance session",
    description: "Diagnoses data quality and proposes experimental PID gains from synchronized F4 records. Does not change the vehicle or prove physical stability.",
    inputSchema: { type: "object", properties: { session: { type: "object" } }, required: ["session"], additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }] });
  if (method === "tools/call") {
    if (params?.name !== "analyze_balance_session") return fail(id, -32602, "Unknown tool");
    try {
      const result = analyzeSession(params.arguments?.session);
      return reply(id, { content: [{ type: "text", text: JSON.stringify(result) }] });
    } catch (error) {
      return reply(id, { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "Invalid session" }] });
    }
  }
  fail(id, -32601, "Method not found");
});
