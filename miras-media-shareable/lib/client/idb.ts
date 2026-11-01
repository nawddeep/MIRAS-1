// Tiny IndexedDB wrapper. Everything here stays on the visitor's device.

const DB_NAME = "miras";
const VERSION = 1;
export type StoreName = "memories" | "offline";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      for (const name of ["memories", "offline"]) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const idbPut = <T extends { id: string }>(store: StoreName, value: T) => run(store, "readwrite", (s) => s.put(value));
export const idbGet = <T>(store: StoreName, id: string) => run<T | undefined>(store, "readonly", (s) => s.get(id));
export const idbAll = <T>(store: StoreName) => run<T[]>(store, "readonly", (s) => s.getAll());
export const idbDelete = (store: StoreName, id: string) => run(store, "readwrite", (s) => s.delete(id));
