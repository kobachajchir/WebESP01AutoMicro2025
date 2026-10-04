import { parseSession } from "./session";
import type { BalanceSession } from "./session";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("automicro-calibration", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("sessions", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir el historial."));
    request.onblocked = () => reject(new Error("Cerrá otras pestañas para abrir el historial."));
  });
}
async function operation<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", mode); const request = action(tx.objectStore("sessions"));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("No se pudo guardar la sesión.")); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Historial no disponible.")); };
  });
}
export async function listSessions(): Promise<BalanceSession[]> {
  const values: unknown[] = await operation("readonly", (store) => store.getAll());
  return values.map(parseSession).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function saveSession(session: BalanceSession) {
  await operation("readwrite", (store) => store.put(session));
}
export async function deleteSession(id: string) {
  await operation("readwrite", (store) => store.delete(id));
}
