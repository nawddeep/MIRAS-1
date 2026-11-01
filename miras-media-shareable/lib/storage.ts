import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "@/lib/config";
import { getRepos } from "@/lib/repos";
import type { MediaAsset } from "@/lib/schemas";

export const UPLOAD_NAME = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;
const EXT: Record<string, "jpg" | "png" | "webp"> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type MediaRights = Pick<MediaAsset, "owner" | "permittedUse" | "licenceNote" | "containsPeople">;

export interface StorageProvider {
  /** Stores an uploaded image and records its rights. Refuses images that show people. */
  saveImage(data: Buffer, mime: string, rights: MediaRights): MediaAsset;
  read(name: string): Buffer | undefined;
}

/** Writes to <dataDir>/uploads and serves through /api/media. A cloud bucket can replace this later. */
export class LocalStorage implements StorageProvider {
  constructor(private dir = path.join(getConfig().dataDir, "uploads")) {}

  saveImage(data: Buffer, mime: string, rights: MediaRights): MediaAsset {
    if (rights.containsPeople) throw new Error("Photos that show people are not stored.");
    const ext = EXT[mime];
    if (!ext) throw new Error("Only JPEG, PNG or WebP images are accepted.");
    fs.mkdirSync(this.dir, { recursive: true });
    const name = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(this.dir, name), data);
    const asset: MediaAsset = { id: `upload-${name}`, path: `/api/media/${name}`, ...rights };
    getRepos().media.save(asset);
    return asset;
  }

  read(name: string) {
    if (!UPLOAD_NAME.test(name)) return undefined;
    const file = path.join(this.dir, name);
    return fs.existsSync(file) ? fs.readFileSync(file) : undefined;
  }
}

let storage: StorageProvider | undefined;
export const getStorage = () => (storage ??= new LocalStorage());
/** Tests only. */
export const setStorage = (s: StorageProvider | undefined) => {
  storage = s;
};
