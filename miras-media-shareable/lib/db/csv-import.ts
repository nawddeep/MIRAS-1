import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { Db } from "./migrate";

type Column = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number };

const q = (name: string) => `"${name}"`;
const columnsOf = (db: Db, table: string) => db.pragma(`table_info(${q(table)})`) as Column[];

/** RFC 4180: quoted fields, "" escapes, newlines inside quotes, CRLF or LF, optional BOM. Blank lines are dropped. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch !== '"') {
        field += ch;
      } else if (src[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) rows.push([...row, field]);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Tables a CSV can target: everything except bookkeeping and the full-text index internals. */
export function importableTables(db: Db): string[] {
  const names = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name`).pluck().all() as string[];
  return names.filter((n) => n !== "schema_migrations" && !/_fts(_|$)/.test(n));
}

/** Parents before children, so foreign keys hold while rows are inserted. */
function insertionOrder(db: Db, tables: string[]): string[] {
  const parents = new Map(
    tables.map((t) => [
      t,
      (db.pragma(`foreign_key_list(${q(t)})`) as { table: string }[]).map((f) => f.table).filter((p) => p !== t && tables.includes(p)),
    ]),
  );
  const order: string[] = [];
  const visit = (t: string, stack: string[]) => {
    if (order.includes(t)) return;
    if (stack.includes(t)) throw new Error(`Foreign-key cycle: ${[...stack, t].join(" -> ")}`);
    for (const p of parents.get(t) ?? []) visit(p, [...stack, t]);
    order.push(t);
  };
  tables.forEach((t) => visit(t, []));
  return order;
}

/** Empty cell -> column default (or NULL); yes/no/true/false -> 1/0 in INTEGER columns. */
function cellValue(raw: string, col: Column): string | number | null | undefined {
  const v = raw.trim();
  if (v === "") return col.dflt_value !== null ? undefined : null;
  if (col.type === "INTEGER" && /^(true|yes)$/i.test(v)) return 1;
  if (col.type === "INTEGER" && /^(false|no)$/i.test(v)) return 0;
  return v;
}

function importFile(db: Db, table: string, file: string): number {
  const label = path.basename(file);
  const [header, ...rows] = parseCsv(fs.readFileSync(file, "utf8"));
  if (!header) return 0;
  const cols = columnsOf(db, table);
  const byName = new Map(cols.map((c) => [c.name, c]));
  const names = header.map((h) => h.trim());
  const unknown = names.filter((n) => !byName.has(n));
  if (unknown.length) throw new Error(`${label}: unknown column(s) ${unknown.join(", ")}`);
  const pk = cols.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name);

  const statements = new Map<string, Database.Statement<(string | number | null)[]>>();
  rows.forEach((cells, i) => {
    if (cells.length > names.length) throw new Error(`${label} line ${i + 2}: ${cells.length} cells but ${names.length} columns`);
    const used: string[] = [];
    const values: (string | number | null)[] = [];
    names.forEach((name, j) => {
      const v = cellValue(cells[j] ?? "", byName.get(name)!);
      if (v === undefined) return;
      used.push(name);
      values.push(v);
    });
    const key = used.join(",");
    let stmt = statements.get(key);
    if (!stmt) {
      const update = used.filter((c) => !pk.includes(c));
      const conflict =
        pk.length && pk.every((c) => used.includes(c))
          ? `ON CONFLICT(${pk.map(q)}) ${update.length ? `DO UPDATE SET ${update.map((c) => `${q(c)} = excluded.${q(c)}`)}` : "DO NOTHING"}`
          : "";
      stmt = db.prepare<(string | number | null)[]>(`INSERT INTO ${q(table)} (${used.map(q)}) VALUES (${used.map(() => "?")}) ${conflict}`);
      statements.set(key, stmt);
    }
    try {
      stmt.run(...values);
    } catch (e) {
      throw new Error(`${label} line ${i + 2}: ${(e as Error).message}`);
    }
  });
  return rows.length;
}

/**
 * Loads every <table>.csv in dir, parents first, in one transaction: a bad row aborts the whole import.
 * Re-running is safe: rows with an existing primary key are updated.
 */
export function importDir(db: Db, dir: string): { table: string; rows: number }[] {
  const tables = importableTables(db);
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv"));
  const byTable = new Map(files.map((f) => [path.basename(f, path.extname(f)), f]));
  const unknown = [...byTable.keys()].filter((t) => !tables.includes(t));
  if (unknown.length) throw new Error(`No table for: ${unknown.map((t) => `${t}.csv`).join(", ")}`);
  const results: { table: string; rows: number }[] = [];
  db.transaction(() => {
    for (const table of insertionOrder(db, tables)) {
      const file = byTable.get(table);
      if (file) results.push({ table, rows: importFile(db, table, path.join(dir, file)) });
    }
  })();
  return results;
}

/** One header-only CSV per table, plus COLUMNS.txt saying which columns are required. */
export function writeTemplates(db: Db, dir: string): string[] {
  fs.mkdirSync(dir, { recursive: true });
  const tables = insertionOrder(db, importableTables(db));
  const guide: string[] = ["Import order (parents first):", tables.join(", "), "", "table.column  TYPE  required|optional  [default]"];
  for (const t of tables) {
    const cols = columnsOf(db, t);
    fs.writeFileSync(path.join(dir, `${t}.csv`), `${cols.map((c) => c.name).join(",")}\n`);
    for (const c of cols) {
      const required = c.notnull && c.dflt_value === null && c.pk === 0 ? "required" : "optional";
      guide.push(`${t}.${c.name}  ${c.type}  ${required}${c.dflt_value !== null ? `  [${c.dflt_value}]` : ""}`);
    }
  }
  fs.writeFileSync(path.join(dir, "COLUMNS.txt"), `${guide.join("\n")}\n`);
  return tables;
}
