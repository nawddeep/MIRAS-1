import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type Db = Database.Database;

export const MIGRATIONS_DIR = path.resolve("db/migrations");

/** Opens (creating if needed) the relational MIRAS database. Pass ":memory:" in tests. */
export function openCoreDb(file: string | ":memory:"): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}

/** Applies every not-yet-applied .sql file in filename order, each in its own transaction. Returns the names applied. */
export function migrate(db: Db, dir = MIGRATIONS_DIR): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
  const done = new Set(db.prepare("SELECT name FROM schema_migrations").pluck().all() as string[]);
  const applied: string[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    db.transaction(() => {
      db.exec(fs.readFileSync(path.join(dir, file), "utf8"));
      db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run(file, new Date().toISOString());
    })();
    applied.push(file);
  }
  return applied;
}
