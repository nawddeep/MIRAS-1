import path from "node:path";
import { getConfig } from "../config";
import { migrate, openCoreDb, type Db } from "./migrate";

/** data/miras-v2.db, or $MIRAS_DB. */
export const coreDbPath = () => (process.env.MIRAS_DB ? path.resolve(process.env.MIRAS_DB) : path.join(getConfig().dataDir, "miras-v2.db"));

let db: Db | undefined;

/** The relational database, created and migrated on first use. */
export function getCoreDb(): Db {
  if (!db) {
    db = openCoreDb(coreDbPath());
    migrate(db);
  }
  return db;
}

/** Tests only: swap in an in-memory database. */
export function setCoreDb(next: Db | undefined) {
  db = next;
}
