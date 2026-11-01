import type { CaptureDocument, FrameRecord } from '../models/CaptureModels';
import {
  CaptureError,
  createCaptureDocument,
  frameFileName
} from '../models/CaptureModels';

export interface CaptureLibrary {
  captures: CaptureDocument[];
  warnings: string[];
}

export interface StorageEstimateInfo {
  usageBytes: number;
  quotaBytes: number;
  availableBytes: number;
  lowSpace: boolean;
}

interface StorageBackend {
  saveDocument(id: string, json: string): Promise<void>;
  listCaptureIds(): Promise<string[]>;
  readDocument(id: string): Promise<string | null>;
  deleteCapture(id: string): Promise<void>;
  writeFrame(captureId: string, fileName: string, data: Uint8Array): Promise<void>;
  readFrame(captureId: string, fileName: string): Promise<Uint8Array | null>;
  deleteFrame(captureId: string, fileName: string): Promise<void>;
  listFrameFiles(captureId: string): Promise<string[]>;
  writePanorama(captureId: string, data: Uint8Array): Promise<void>;
  readPanorama(captureId: string): Promise<Uint8Array | null>;
  writeThumbnail(captureId: string, data: Uint8Array): Promise<void>;
  readThumbnail(captureId: string): Promise<Uint8Array | null>;
}

function wrapStorageError(err: unknown): CaptureError {
  if (err instanceof CaptureError) return err;
  const name = (err as { name?: string })?.name ?? '';
  const msg = (err as { message?: string })?.message ?? String(err);
  if (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota/i.test(msg)
  ) {
    return new CaptureError(
      'Device storage is full (QuotaExceededError). Delete old captures or free space on your phone and retry.'
    );
  }
  return new CaptureError(`Storage error: ${msg}`);
}

class MemoryBackend implements StorageBackend {
  private docs = new Map<string, string>();
  private files = new Map<string, Map<string, Uint8Array>>();
  private panos = new Map<string, Uint8Array>();
  private thumbs = new Map<string, Uint8Array>();

  async saveDocument(id: string, json: string): Promise<void> {
    this.docs.set(id, json);
    if (!this.files.has(id)) this.files.set(id, new Map());
  }

  async listCaptureIds(): Promise<string[]> {
    const ids = new Set<string>([
      ...this.docs.keys(),
      ...this.files.keys(),
      ...this.panos.keys()
    ]);
    return Array.from(ids).sort();
  }

  async readDocument(id: string): Promise<string | null> {
    return this.docs.get(id) ?? null;
  }

  async deleteCapture(id: string): Promise<void> {
    this.docs.delete(id);
    this.files.delete(id);
    this.panos.delete(id);
    this.thumbs.delete(id);
  }

  async writeFrame(captureId: string, fileName: string, data: Uint8Array): Promise<void> {
    if (!this.files.has(captureId)) this.files.set(captureId, new Map());
    this.files.get(captureId)!.set(fileName, new Uint8Array(data));
  }

  async readFrame(captureId: string, fileName: string): Promise<Uint8Array | null> {
    const f = this.files.get(captureId)?.get(fileName);
    return f ? new Uint8Array(f) : null;
  }

  async deleteFrame(captureId: string, fileName: string): Promise<void> {
    this.files.get(captureId)?.delete(fileName);
  }

  async listFrameFiles(captureId: string): Promise<string[]> {
    const map = this.files.get(captureId);
    return map ? Array.from(map.keys()).sort() : [];
  }

  async writePanorama(captureId: string, data: Uint8Array): Promise<void> {
    this.panos.set(captureId, new Uint8Array(data));
  }

  async readPanorama(captureId: string): Promise<Uint8Array | null> {
    const p = this.panos.get(captureId);
    return p ? new Uint8Array(p) : null;
  }

  async writeThumbnail(captureId: string, data: Uint8Array): Promise<void> {
    this.thumbs.set(captureId, new Uint8Array(data));
  }

  async readThumbnail(captureId: string): Promise<Uint8Array | null> {
    const t = this.thumbs.get(captureId);
    return t ? new Uint8Array(t) : null;
  }

  corruptDocument(id: string, rawContent: string): void {
    this.docs.set(id, rawContent);
  }

  createOrphanFolder(id: string): void {
    if (!this.files.has(id)) this.files.set(id, new Map());
  }
}

class IndexedDBBackend implements StorageBackend {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly dbName: string;

  constructor(dbName = 'miras-capture-db') {
    this.dbName = dbName;
  }

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('documents')) {
            db.createObjectStore('documents');
          }
          if (!db.objectStoreNames.contains('frames')) {
            db.createObjectStore('frames');
          }
          if (!db.objectStoreNames.contains('panoramas')) {
            db.createObjectStore('panoramas');
          }
          if (!db.objectStoreNames.contains('thumbnails')) {
            db.createObjectStore('thumbnails');
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(wrapStorageError(req.error));
      });
    }
    return this.dbPromise;
  }

  private async readTx<T>(
    storeName: string,
    op: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.getDB();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = op(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(wrapStorageError(request.error));
      transaction.onerror = () => reject(wrapStorageError(transaction.error));
    });
  }

  /**
   * Resolves writes strictly on transaction.oncomplete (not request.onsuccess)
   * and rejects on transaction.onabort / transaction.onerror.
   */
  private async writeTx(
    storeNames: string | string[],
    op: (tx: IDBTransaction) => void
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeNames, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(wrapStorageError(transaction.error ?? new Error('Transaction aborted')));
      transaction.onerror = () =>
        reject(wrapStorageError(transaction.error ?? new Error('Transaction failed')));
      try {
        op(transaction);
      } catch (err) {
        reject(wrapStorageError(err));
      }
    });
  }

  async saveDocument(id: string, json: string): Promise<void> {
    await this.writeTx('documents', (tx) => {
      tx.objectStore('documents').put({ doc: json }, id);
    });
  }

  async listCaptureIds(): Promise<string[]> {
    const docKeys = (await this.readTx('documents', (s) => s.getAllKeys())) as string[];
    const frameKeys = (await this.readTx('frames', (s) => s.getAllKeys())) as string[];
    const ids = new Set<string>(docKeys.map(String));
    for (const fk of frameKeys) {
      const parts = String(fk).split('/');
      if (parts[0]) ids.add(parts[0]);
    }
    return Array.from(ids).sort();
  }

  async readDocument(id: string): Promise<string | null> {
    const record = await this.readTx<{ doc?: string } | string | undefined>('documents', (s) =>
      s.get(id)
    );
    if (typeof record === 'string') return record;
    return record?.doc ?? null;
  }

  async deleteCapture(id: string): Promise<void> {
    const range = IDBKeyRange.bound(`${id}/`, `${id}/\uffff`);
    await this.writeTx(['documents', 'panoramas', 'thumbnails', 'frames'], (tx) => {
      tx.objectStore('documents').delete(id);
      tx.objectStore('panoramas').delete(id);
      tx.objectStore('thumbnails').delete(id);
      tx.objectStore('frames').delete(range);
    });
  }

  async writeFrame(captureId: string, fileName: string, data: Uint8Array): Promise<void> {
    await this.writeTx('frames', (tx) => {
      tx.objectStore('frames').put(new Uint8Array(data), `${captureId}/${fileName}`);
    });
  }

  async readFrame(captureId: string, fileName: string): Promise<Uint8Array | null> {
    const data = await this.readTx<Uint8Array | undefined>('frames', (s) =>
      s.get(`${captureId}/${fileName}`)
    );
    return data ? new Uint8Array(data) : null;
  }

  async deleteFrame(captureId: string, fileName: string): Promise<void> {
    await this.writeTx('frames', (tx) => {
      tx.objectStore('frames').delete(`${captureId}/${fileName}`);
    });
  }

  async listFrameFiles(captureId: string): Promise<string[]> {
    const prefix = `${captureId}/`;
    const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
    const frameKeys = (await this.readTx('frames', (s) => s.getAllKeys(range))) as string[];
    return frameKeys
      .map(String)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length))
      .sort();
  }

  async writePanorama(captureId: string, data: Uint8Array): Promise<void> {
    await this.writeTx('panoramas', (tx) => {
      tx.objectStore('panoramas').put(new Uint8Array(data), captureId);
    });
  }

  async readPanorama(captureId: string): Promise<Uint8Array | null> {
    const data = await this.readTx<Uint8Array | undefined>('panoramas', (s) =>
      s.get(captureId)
    );
    return data ? new Uint8Array(data) : null;
  }

  async writeThumbnail(captureId: string, data: Uint8Array): Promise<void> {
    await this.writeTx('thumbnails', (tx) => {
      tx.objectStore('thumbnails').put(new Uint8Array(data), captureId);
    });
  }

  async readThumbnail(captureId: string): Promise<Uint8Array | null> {
    const data = await this.readTx<Uint8Array | undefined>('thumbnails', (s) =>
      s.get(captureId)
    );
    return data ? new Uint8Array(data) : null;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CaptureStore {
  static readonly shared = new CaptureStore();
  private backend: StorageBackend;
  private persistRequested = false;

  constructor(options?: { memory?: boolean; dbName?: string }) {
    if (options?.memory || typeof indexedDB === 'undefined') {
      this.backend = new MemoryBackend();
    } else {
      this.backend = new IndexedDBBackend(options?.dbName);
    }
  }

  async requestPersistentStorage(): Promise<boolean> {
    if (this.persistRequested) return true;
    this.persistRequested = true;
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.persist === 'function'
    ) {
      try {
        return await navigator.storage.persist();
      } catch {
        return false;
      }
    }
    return false;
  }

  async checkStorageAvailable(minBytes = 40 * 1024 * 1024): Promise<StorageEstimateInfo> {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.estimate === 'function'
    ) {
      try {
        const est = await navigator.storage.estimate();
        const usage = est.usage ?? 0;
        const quota = est.quota ?? 0;
        const available = quota > 0 ? Math.max(0, quota - usage) : Infinity;
        return {
          usageBytes: usage,
          quotaBytes: quota,
          availableBytes: available,
          lowSpace: quota > 0 && available < minBytes
        };
      } catch {
        // Ignore estimate error
      }
    }
    return {
      usageBytes: 0,
      quotaBytes: 0,
      availableBytes: Infinity,
      lowSpace: false
    };
  }

  async save(capture: CaptureDocument): Promise<void> {
    // Compact JSON without duplicate framesJson
    const docJson = JSON.stringify(capture);
    await this.backend.saveDocument(capture.id.toLowerCase(), docJson);
  }

  async list(): Promise<CaptureDocument[]> {
    const lib = await this.load();
    return lib.captures;
  }

  async load(): Promise<CaptureLibrary> {
    const ids = await this.backend.listCaptureIds();
    const captures: CaptureDocument[] = [];
    const warnings: string[] = [];

    for (const folderId of ids) {
      if (!UUID_REGEX.test(folderId)) continue;
      try {
        const raw = await this.backend.readDocument(folderId);
        if (!raw) {
          throw new CaptureError('Missing document.json');
        }
        const parsed = JSON.parse(raw) as CaptureDocument;
        if (
          !parsed ||
          typeof parsed.id !== 'string' ||
          parsed.id.toLowerCase() !== folderId.toLowerCase()
        ) {
          throw new CaptureError('Capture identifier does not match its folder.');
        }
        captures.push(createCaptureDocument(parsed));
      } catch {
        warnings.push(
          `Capture ${folderId} could not be loaded. Its files have been kept for recovery.`
        );
      }
    }

    captures.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { captures, warnings };
  }

  async delete(id: string): Promise<void> {
    await this.backend.deleteCapture(id.toLowerCase());
  }

  async writeFrame(data: Uint8Array, record: FrameRecord, captureId: string): Promise<void> {
    const file = record.file ?? frameFileName(record.index);
    await this.backend.writeFrame(captureId.toLowerCase(), file, data);
  }

  async writeRawFrameFile(captureId: string, fileName: string, data: Uint8Array): Promise<void> {
    await this.backend.writeFrame(captureId.toLowerCase(), fileName, data);
  }

  async readFrame(captureId: string, fileName: string): Promise<Uint8Array> {
    const data = await this.backend.readFrame(captureId.toLowerCase(), fileName);
    if (!data) {
      throw new CaptureError(`Cannot read image ${fileName}.`);
    }
    return data;
  }

  async deleteFrame(captureId: string, fileName: string): Promise<void> {
    await this.backend.deleteFrame(captureId.toLowerCase(), fileName);
  }

  async listFrameFiles(captureId: string): Promise<string[]> {
    return this.backend.listFrameFiles(captureId.toLowerCase());
  }

  async writePanorama(captureId: string, data: Uint8Array): Promise<void> {
    await this.backend.writePanorama(captureId.toLowerCase(), data);
  }

  async readPanorama(captureId: string): Promise<Uint8Array> {
    const data = await this.backend.readPanorama(captureId.toLowerCase());
    if (!data) {
      throw new CaptureError('Panorama image not found. Stitch the capture first.');
    }
    return data;
  }

  async writeThumbnail(captureId: string, data: Uint8Array): Promise<void> {
    await this.backend.writeThumbnail(captureId.toLowerCase(), data);
  }

  async readThumbnail(captureId: string): Promise<Uint8Array | null> {
    return this.backend.readThumbnail(captureId.toLowerCase());
  }

  simulateOrphanCapture(id: string): void {
    if (this.backend instanceof MemoryBackend) {
      this.backend.createOrphanFolder(id.toLowerCase());
    }
  }

  simulateCorruptedDocument(id: string, content: string): void {
    if (this.backend instanceof MemoryBackend) {
      this.backend.corruptDocument(id.toLowerCase(), content);
    }
  }
}
