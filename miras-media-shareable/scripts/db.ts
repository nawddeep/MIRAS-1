import fs from "node:fs";
import path from "node:path";
import { importDir, importableTables, writeTemplates } from "../lib/db/csv-import";
import { coreDbPath } from "../lib/db/core";
import { migrate, openCoreDb } from "../lib/db/migrate";

const usage = `Usage: tsx scripts/db.ts <command>
  migrate              create/upgrade the database from db/migrations
  status               show applied migrations and row counts
  templates [dir]      write blank CSV templates (default db/csv-templates)
  import <dir>         load <table>.csv files from dir (re-runnable)
  seed                 load the flagged sample rows (db/sample-data/sample.sql) for demo mode
Database file: $MIRAS_DB, else <MIRAS_DATA_DIR or ./data>/miras-v2.db`;

const [cmd, arg] = process.argv.slice(2);
const db = openCoreDb(coreDbPath());

try {
  if (cmd === "migrate") {
    const applied = migrate(db);
    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Already up to date.");
  } else if (cmd === "status") {
    migrate(db);
    for (const t of importableTables(db)) {
      const n = (db.prepare(`SELECT COUNT(*) FROM "${t}"`).pluck().get() as number) ?? 0;
      console.log(`${String(n).padStart(6)}  ${t}`);
    }
  } else if (cmd === "templates") {
    migrate(db);
    const dir = path.resolve(arg ?? "db/csv-templates");
    console.log(`Wrote ${writeTemplates(db, dir).length} templates to ${dir}`);
  } else if (cmd === "seed") {
    migrate(db);
    db.exec(fs.readFileSync(path.resolve("db/sample-data/sample.sql"), "utf8"));
    console.log("Sample rows loaded (is_sample = 1; shown only in demo mode).");
  } else if (cmd === "import" && arg) {
    migrate(db);
    for (const r of importDir(db, path.resolve(arg))) console.log(`${String(r.rows).padStart(6)}  ${r.table}`);
  } else {
    console.log(usage);
    process.exitCode = 1;
  }
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
