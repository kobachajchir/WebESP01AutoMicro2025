import { analyzeSession } from "./optimizer";
self.onmessage = (event: MessageEvent<unknown>) => {
  try { self.postMessage({ ok: true, result: analyzeSession(event.data) }); }
  catch (error) { self.postMessage({ ok: false, error: error instanceof Error ? error.message : "No se pudo analizar la sesión." }); }
};
