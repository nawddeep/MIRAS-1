import { idbAll, idbDelete, idbGet, idbPut } from "./idb";

export type ImmersiveSourceType = "imported" | "created";

export interface ImmersiveHotspot {
  id: string;
  yaw: number;
  pitch: number;
  title: string;
  caption: string;
}

export interface ImmersiveHistoryItem {
  id: string;
  title: string;
  createdAt: string;
  sourceType: ImmersiveSourceType;
  workflowLabel: string;
  imageDataUrl: string;
  thumbnailDataUrl: string;
  width: number;
  height: number;
  placeTag?: string;
  hotspots?: ImmersiveHotspot[];
}

const FALLBACK_KEY = "miras_immersive_history_v1";

function readFallback(): ImmersiveHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as ImmersiveHistoryItem[]) : [];
  } catch {
    return [];
  }
}

function writeFallback(items: ImmersiveHistoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(items.slice(0, 20)));
  } catch {
    // Ignore quota errors on fallback storage
  }
}

function uint8ToDataUrl(bytes: Uint8Array, mime = "image/jpeg"): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Reads any stitched 360° captures created in the integrated /pwa CaptureStore ('miras-capture-db')
 * so they appear automatically in the main MIRAS 360 History.
 */
async function readPwaCaptureStoreItems(): Promise<ImmersiveHistoryItem[]> {
  if (typeof indexedDB === "undefined") return [];
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("miras-capture-db", 2);
      // Read-only: if the camera has not created its database yet, do not create it empty (that would break the camera).
      req.onupgradeneeded = () => req.transaction?.abort();
      req.onerror = () => resolve([]);
      req.onsuccess = () => {
        const db = req.result;
        if (
          !db.objectStoreNames.contains("documents") ||
          !db.objectStoreNames.contains("panoramas")
        ) {
          db.close();
          resolve([]);
          return;
        }
        try {
          const tx = db.transaction(["documents", "panoramas", "thumbnails"], "readonly");
          const docStore = tx.objectStore("documents");
          const panoStore = tx.objectStore("panoramas");
          const thumbStore = tx.objectStore("thumbnails");

          const keysReq = docStore.getAllKeys();
          keysReq.onerror = () => {
            db.close();
            resolve([]);
          };
          keysReq.onsuccess = async () => {
            const keys = keysReq.result as string[];
            const items: ImmersiveHistoryItem[] = [];

            for (const key of keys) {
              const rawDocRecord = await new Promise<{ doc?: string } | string | undefined>((res) => {
                const r = docStore.get(key);
                r.onsuccess = () => res(r.result as { doc?: string } | string | undefined);
                r.onerror = () => res(undefined);
              });
              const rawDoc =
                typeof rawDocRecord === "string" ? rawDocRecord : rawDocRecord?.doc;
              if (!rawDoc) continue;

              const rawPano = await new Promise<Uint8Array | undefined>((res) => {
                const r = panoStore.get(key);
                r.onsuccess = () => res(r.result as Uint8Array | undefined);
                r.onerror = () => res(undefined);
              });
              const rawThumb = await new Promise<Uint8Array | undefined>((res) => {
                const r = thumbStore.get(key);
                r.onsuccess = () => res(r.result as Uint8Array | undefined);
                r.onerror = () => res(undefined);
              });

              const hasPano = rawPano && rawPano.byteLength > 0;
              const hasThumb = rawThumb && rawThumb.byteLength > 0;
              if (!hasPano && !hasThumb) continue;

              try {
                const parsed = JSON.parse(rawDoc) as {
                  id: string;
                  name?: string;
                  title?: string;
                  date?: string;
                  createdAt?: string;
                  settings?: { width?: number };
                  stitchReport?: { outputWidth?: number } | null;
                  hotspots?: Array<{
                    id: string;
                    yaw: number;
                    pitch: number;
                    title: string;
                    caption: string;
                  }>;
                };
                const imageDataUrl = hasPano
                  ? uint8ToDataUrl(new Uint8Array(rawPano!))
                  : uint8ToDataUrl(new Uint8Array(rawThumb!));
                const thumbnailDataUrl = hasThumb
                  ? uint8ToDataUrl(new Uint8Array(rawThumb!))
                  : imageDataUrl;
                const w = parsed.stitchReport?.outputWidth ?? parsed.settings?.width ?? 2048;
                items.push({
                  id: `pwa-${parsed.id}`,
                  title: parsed.name || parsed.title || "360° Camera Capture",
                  createdAt: parsed.date || parsed.createdAt || new Date().toISOString(),
                  sourceType: "created",
                  workflowLabel: "360° Camera Studio",
                  imageDataUrl,
                  thumbnailDataUrl,
                  width: w,
                  height: Math.round(w / 2),
                  hotspots: parsed.hotspots,
                });
              } catch {
                // Ignore malformed doc
              }
            }
            db.close();
            resolve(items);
          };
        } catch {
          db.close();
          resolve([]);
        }
      };
    } catch {
      resolve([]);
    }
  });
}

/**
 * An earlier build could leave an empty "miras-capture-db" (no tables) that the camera then fails on.
 * A database without the camera's capture tables holds no captures, so remove it and let the camera create it.
 * Never touches a database that has them.
 */
export async function repairPwaCaptureDb(): Promise<void> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return;
  try {
    if (!(await indexedDB.databases()).some((d) => d.name === "miras-capture-db")) return;
    const broken = await new Promise<boolean>((resolve) => {
      const req = indexedDB.open("miras-capture-db");
      req.onupgradeneeded = () => req.transaction?.abort();
      req.onerror = () => resolve(false);
      req.onsuccess = () => {
        const db = req.result;
        const missing = !db.objectStoreNames.contains("documents") || !db.objectStoreNames.contains("panoramas");
        db.close();
        resolve(missing);
      };
    });
    if (!broken) return;
    await new Promise<void>((resolve) => {
      const del = indexedDB.deleteDatabase("miras-capture-db");
      del.onsuccess = del.onerror = del.onblocked = () => resolve();
    });
  } catch {
    // Best effort: the camera shows its own message if storage is unavailable.
  }
}

async function deleteFromPwaCaptureStore(rawId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const pwaId = rawId.replace(/^pwa-/, "");
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("miras-capture-db", 2);
      req.onupgradeneeded = () => req.transaction?.abort();
      req.onerror = () => resolve();
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(["documents", "panoramas", "thumbnails"], "readwrite");
          tx.objectStore("documents").delete(pwaId);
          tx.objectStore("panoramas").delete(pwaId);
          tx.objectStore("thumbnails").delete(pwaId);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        } catch {
          db.close();
          resolve();
        }
      };
    } catch {
      resolve();
    }
  });
}

const DELETED_SEEDS_KEY = "miras_deleted_seed_ids_v1";

export const BUNDLED_HERITAGE_VIEW_ITEM: ImmersiveHistoryItem = {
  id: "seed-heritage-view-44ce9931",
  title: "Untitled Heritage View (44ce9931)",
  createdAt: "2026-10-28T13:02:04Z",
  sourceType: "created",
  workflowLabel: "46 frames · 6144×3072 · 360° Capture",
  imageDataUrl: "/media/immersive/heritage-view-44ce9931/panorama.jpg",
  thumbnailDataUrl: "/media/immersive/heritage-view-44ce9931/thumb.jpg",
  width: 6144,
  height: 3072,
};

function isSeedDeleted(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(DELETED_SEEDS_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return list.includes(id);
  } catch {
    return false;
  }
}

function markSeedDeleted(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(DELETED_SEEDS_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    if (!list.includes(id)) {
      window.localStorage.setItem(DELETED_SEEDS_KEY, JSON.stringify([...list, id]));
    }
  } catch {
    // Ignore storage errors
  }
}

export async function listImmersiveHistory(): Promise<ImmersiveHistoryItem[]> {
  try {
    const [all, pwaItems] = await Promise.all([
      idbAll<ImmersiveHistoryItem>("immersive"),
      readPwaCaptureStoreItems(),
    ]);
    const map = new Map<string, ImmersiveHistoryItem>();
    if (!isSeedDeleted(BUNDLED_HERITAGE_VIEW_ITEM.id)) {
      map.set(BUNDLED_HERITAGE_VIEW_ITEM.id, BUNDLED_HERITAGE_VIEW_ITEM);
    }
    for (const item of [...all, ...pwaItems]) {
      map.set(item.id, item);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    const fallback = readFallback();
    if (!isSeedDeleted(BUNDLED_HERITAGE_VIEW_ITEM.id)) {
      fallback.push(BUNDLED_HERITAGE_VIEW_ITEM);
    }
    return fallback.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

export async function getImmersiveHistoryItem(
  id: string
): Promise<ImmersiveHistoryItem | undefined> {
  if (id === BUNDLED_HERITAGE_VIEW_ITEM.id && !isSeedDeleted(id)) {
    return BUNDLED_HERITAGE_VIEW_ITEM;
  }
  try {
    return await idbGet<ImmersiveHistoryItem>("immersive", id);
  } catch {
    return readFallback().find((item) => item.id === id);
  }
}

export async function saveImmersiveHistoryItem(
  item: ImmersiveHistoryItem
): Promise<ImmersiveHistoryItem> {
  try {
    await idbPut("immersive", item);
  } catch {
    const existing = readFallback().filter((x) => x.id !== item.id);
    writeFallback([item, ...existing]);
  }
  return item;
}

export async function deleteImmersiveHistoryItem(id: string): Promise<void> {
  if (id === BUNDLED_HERITAGE_VIEW_ITEM.id) {
    markSeedDeleted(id);
  }
  if (id.startsWith("pwa-")) {
    await deleteFromPwaCaptureStore(id);
  }
  try {
    await idbDelete("immersive", id);
  } catch {
    writeFallback(readFallback().filter((x) => x.id !== id));
  }
}
