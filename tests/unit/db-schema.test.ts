import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { importDir, importableTables, parseCsv, writeTemplates } from "@/lib/db/csv-import";
import { migrate, openCoreDb, type Db } from "@/lib/db/migrate";

let db: Db;
const dirs: string[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "miras-db-"));
  dirs.push(d);
  return d;
};

beforeEach(() => {
  db = openCoreDb(":memory:");
  migrate(db);
});
afterEach(() => {
  db.close();
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const run = (sql: string) => db.exec(sql);
const seedPlace = () =>
  run(`INSERT INTO categories (id, name) VALUES ('lakes', 'Lakes');
       INSERT INTO places (id, slug, name, category_id, lat, lng, summary, typical_visit_minutes, opening_hours_text)
       VALUES ('pichhola', 'pichhola', 'Lake Pichhola', 'lakes', 24.57, 73.68, 'A calm lake.', 60, 'Sunrise to sunset');`);

describe("migrations", () => {
  it("apply once and are a no-op the second time", () => {
    expect(migrate(db)).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) FROM schema_migrations").pluck().get()).toBe(8);
  });

  it("leave no foreign-key violations and every table STRICT", () => {
    expect(db.pragma("foreign_key_check")).toEqual([]);
    const lax = (db.pragma("table_list") as { name: string; type: string; strict: number }[]).filter(
      (t) => t.type === "table" && !t.name.startsWith("sqlite_") && t.name !== "schema_migrations" && !/_fts/.test(t.name) && !t.strict,
    );
    expect(lax).toEqual([]);
  });
});

describe("publish gates", () => {
  beforeEach(seedPlace);

  it("rejects a history story without a source reference", () => {
    expect(() =>
      run(`INSERT INTO stories (id, place_id, title, source_type, rights_owner, rights_permitted_use) VALUES ('s1','pichhola','T','history','Team','app')`),
    ).toThrow(/constraint/i);
    run(`INSERT INTO stories (id, place_id, title, source_type, source_ref, rights_owner, rights_permitted_use) VALUES ('s2','pichhola','T','history','Gazetteer 1908','Team','app')`);
  });

  it("rejects verified_by without verified_at", () => {
    expect(() =>
      run(`INSERT INTO stories (id, place_id, title, source_type, verified_by, rights_owner, rights_permitted_use) VALUES ('s1','pichhola','T','legend','Asha','Team','app')`),
    ).toThrow(/constraint/i);
  });

  it("publishes an artisan only with consent, owner confirmation and no sample flag", () => {
    const base = `INSERT INTO artisans (id, name, craft, description, contact, locality_text, photo_rights, status, is_sample, consent_given, consent_date, owner_confirmed_at)`;
    expect(() => run(`${base} VALUES ('a1','N','C','D','c','L','R','published',0,0,NULL,NULL)`)).toThrow(/constraint/i);
    expect(() => run(`${base} VALUES ('a2','N','C','D','c','L','R','published',1,1,'2026-10-01T00:00:00Z','2026-10-02T00:00:00Z')`)).toThrow(/constraint/i);
    run(`${base} VALUES ('a3','N','C','D','c','L','R','published',0,1,'2026-10-01T00:00:00Z','2026-10-02T00:00:00Z')`);
    run(`${base} VALUES ('a4','N','C','D','c','L','R','draft',1,0,NULL,NULL)`);
  });

  it("publishes a companion only after identity check and safety agreement", () => {
    run(`INSERT INTO users (id, username, display_name, password_hash, recovery_hash) VALUES ('u1','asha','Asha','x','y')`);
    const base = `INSERT INTO companions (id, user_id, display_name, bio, status, identity_verified_by, identity_verified_at, safety_agreed_at)`;
    expect(() => run(`${base} VALUES ('c1','u1','Asha','Bio','published',NULL,NULL,NULL)`)).toThrow(/constraint/i);
    run(`${base} VALUES ('c1','u1','Asha','Bio','published','Team','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')`);
  });

  it("needs a named moderator for any non-pending hidden spot", () => {
    expect(() => run(`INSERT INTO hidden_spots (id, name, description, status) VALUES ('h1','Spot','D','approved')`)).toThrow(/constraint/i);
    run(`INSERT INTO hidden_spots (id, name, description, status, moderated_by, moderated_at) VALUES ('h1','Spot','D','approved','Asha','2026-10-01T00:00:00Z')`);
  });

  it("allows one passport stamp per place and rejects a malformed stamp", () => {
    run(`INSERT INTO users (id, username, display_name, password_hash, recovery_hash) VALUES ('u1','asha','Asha','x','y')`);
    run(`INSERT INTO passport_stamps (id, user_id, kind, place_id) VALUES ('t1','u1','place','pichhola')`);
    expect(() => run(`INSERT INTO passport_stamps (id, user_id, kind, place_id) VALUES ('t2','u1','place','pichhola')`)).toThrow(/constraint/i);
    expect(() => run(`INSERT INTO passport_stamps (id, user_id, kind) VALUES ('t3','u1','trail')`)).toThrow(/constraint/i);
  });

  it("cannot overbook a workshop session", () => {
    expect(() => run(`INSERT INTO workshop_sessions (id, workshop_id, starts_at, seats_total, seats_taken) VALUES ('x','w','2027-01-01T10:00:00Z',2,3)`)).toThrow(/constraint/i);
  });
});

describe("screen queries", () => {
  beforeEach(seedPlace);

  it("full-text search finds places and story text, and follows updates", () => {
    run(`INSERT INTO stories (id, place_id, title, source_type, rights_owner, rights_permitted_use) VALUES ('s1','pichhola','The floating palace','legend','Team','app');
         INSERT INTO story_texts (story_id, lang, body) VALUES ('s1','en','A queen once sailed across the water.');`);
    expect(db.prepare("SELECT name FROM places_fts WHERE places_fts MATCH 'lake'").pluck().all()).toEqual(["Lake Pichhola"]);
    expect(db.prepare("SELECT story_id FROM story_texts t JOIN story_texts_fts f ON f.rowid = t.rowid WHERE story_texts_fts MATCH 'queen'").pluck().all()).toEqual(["s1"]);
    run(`UPDATE places SET name = 'Pichhola Sagar' WHERE id = 'pichhola'`);
    expect(db.prepare("SELECT name FROM places_fts WHERE places_fts MATCH 'name:lake'").pluck().all()).toEqual([]);
    expect(db.prepare("SELECT name FROM places_fts WHERE places_fts MATCH 'name:sagar'").pluck().all()).toEqual(["Pichhola Sagar"]);
  });

  it("place cards count only published stories", () => {
    run(`INSERT INTO stories (id, place_id, title, source_type, rights_owner, rights_permitted_use, status) VALUES
           ('s1','pichhola','A','legend','T','app','published'), ('s2','pichhola','B','legend','T','app','draft');`);
    expect(db.prepare("SELECT story_count FROM v_place_cards WHERE id = 'pichhola'").pluck().get()).toBe(1);
  });

  it("story cards flag verification, languages, simple text and audio", () => {
    run(`INSERT INTO stories (id, place_id, title, source_type, rights_owner, rights_permitted_use, verified_by, verified_at) VALUES ('s1','pichhola','A','legend','T','app','Asha','2026-10-01T00:00:00Z');
         INSERT INTO story_texts (story_id, lang, body) VALUES ('s1','en','English'), ('s1','hi','हिन्दी');
         INSERT INTO story_texts (story_id, lang, variant, body, checked, checked_at) VALUES ('s1','en','simple','Easy',1,'2026-10-01T00:00:00Z');`);
    const card = db.prepare("SELECT is_verified, has_simple, has_audio, langs FROM v_story_cards WHERE id = 's1'").get() as Record<string, unknown>;
    expect(card).toMatchObject({ is_verified: 1, has_simple: 1, has_audio: 0 });
    expect(String(card.langs).split(",").sort()).toEqual(["en", "hi"]);
  });

  it("trail overview lists stops in order", () => {
    run(`INSERT INTO places (id, slug, name, category_id, lat, lng, summary, typical_visit_minutes, opening_hours_text) VALUES ('b','b','B','lakes',24.5,73.7,'s',30,'h');
         INSERT INTO trails (id, title, theme, approx_minutes) VALUES ('t','T','theme',90);
         INSERT INTO trail_stops (trail_id, position, place_id) VALUES ('t',2,'pichhola'), ('t',1,'b');`);
    expect(db.prepare("SELECT stop_count, place_ids FROM v_trail_overview WHERE id = 't'").get()).toEqual({ stop_count: 2, place_ids: "b,pichhola" });
  });

  it("hides exact coordinates of sensitive hidden spots and every unapproved spot", () => {
    run(`INSERT INTO hidden_spots (id, name, description, sensitive, lat, lng, area_label, status, moderated_by, moderated_at) VALUES
           ('open','Open','D',0,24.5,73.7,'Old city','approved','Asha','2026-10-01T00:00:00Z'),
           ('quiet','Quiet','D',1,24.6,73.8,'Near the lake','approved','Asha','2026-10-01T00:00:00Z');
         INSERT INTO hidden_spots (id, name, description, lat, lng) VALUES ('new','New','D',24.7,73.9);`);
    const rows = db.prepare("SELECT id, lat, lng, area_label FROM v_hidden_spots_public ORDER BY id").all();
    expect(rows).toEqual([
      { id: "open", lat: 24.5, lng: 73.7, area_label: "Old city" },
      { id: "quiet", lat: null, lng: null, area_label: "Near the lake" },
    ]);
  });

  it("compares the latest price per booking site and flags the cheapest", () => {
    run(`INSERT INTO booking_sources (id, name) VALUES ('a','Site A'), ('b','Site B');
         INSERT INTO stays (id, name, lat, lng) VALUES ('s','Haveli',24.5,73.7);
         INSERT INTO stay_prices (stay_id, source_id, price_minor, checked_at) VALUES
           ('s','a',150000,'2026-09-01T00:00:00Z'), ('s','a',200000,'2026-10-01T00:00:00Z'), ('s','b',250000,'2026-10-01T00:00:00Z');`);
    expect(db.prepare("SELECT source_id, price_minor, is_cheapest FROM v_stay_price_comparison ORDER BY source_id").all()).toEqual([
      { source_id: "a", price_minor: 200000, is_cheapest: 1 },
      { source_id: "b", price_minor: 250000, is_cheapest: 0 },
    ]);
  });
});

describe("csv import", () => {
  const write = (dir: string, name: string, body: string) => fs.writeFileSync(path.join(dir, name), body);
  const placesCsv = (summary: string) =>
    `id,slug,name,category_id,lat,lng,summary,typical_visit_minutes,opening_hours_text,is_sample\r\npichhola,pichhola,Lake Pichhola,lakes,24.57,73.68,${summary},60,Sunrise to sunset,no\r\n`;

  it("parses quotes, escaped quotes, embedded newlines and a BOM", () => {
    expect(parseCsv('﻿a,b\n"x, y","say ""hi""\nthere"\n\n')).toEqual([["a", "b"], ["x, y", 'say "hi"\nthere']]);
  });

  it("loads parents before children regardless of file order, mapping yes/no and blanks", () => {
    const dir = tmp();
    write(dir, "places.csv", placesCsv('"A calm lake, wide\nand quiet"'));
    write(dir, "categories.csv", "id,name,name_hi\nlakes,Lakes,\n");
    const result = importDir(db, dir);
    expect(result.map((r) => r.table)).toEqual(["categories", "places"]);
    const place = db.prepare("SELECT summary, is_sample, status, name_hi FROM places").get();
    expect(place).toEqual({ summary: "A calm lake, wide\nand quiet", is_sample: 0, status: "draft", name_hi: null });
  });

  it("is re-runnable: an existing primary key is updated, not duplicated", () => {
    const dir = tmp();
    write(dir, "categories.csv", "id,name\nlakes,Lakes\n");
    write(dir, "places.csv", placesCsv("First"));
    importDir(db, dir);
    write(dir, "places.csv", placesCsv("Second"));
    importDir(db, dir);
    expect(db.prepare("SELECT COUNT(*) FROM places").pluck().get()).toBe(1);
    expect(db.prepare("SELECT summary FROM places").pluck().get()).toBe("Second");
  });

  it("aborts the whole import on a bad row and names file and line", () => {
    const dir = tmp();
    write(dir, "categories.csv", "id,name\nlakes,Lakes\n");
    write(dir, "places.csv", placesCsv("ok").replace("lakes", "missing-category"));
    expect(() => importDir(db, dir)).toThrow(/places\.csv line 2.*FOREIGN KEY/i);
    expect(db.prepare("SELECT COUNT(*) FROM categories").pluck().get()).toBe(0);
  });

  it("rejects unknown columns and unknown tables", () => {
    const a = tmp();
    write(a, "categories.csv", "id,nme\nlakes,Lakes\n");
    expect(() => importDir(db, a)).toThrow(/unknown column.*nme/i);
    const b = tmp();
    write(b, "monuments.csv", "id\nx\n");
    expect(() => importDir(db, b)).toThrow(/No table for: monuments\.csv/);
  });

  it("writes a header-only template for every importable table, and those import as empty", () => {
    const dir = tmp();
    const tables = writeTemplates(db, dir);
    expect([...tables].sort()).toEqual(importableTables(db));
    expect(fs.readFileSync(path.join(dir, "categories.csv"), "utf8")).toBe("id,name,name_hi,position\n");
    expect(fs.readFileSync(path.join(dir, "COLUMNS.txt"), "utf8")).toContain("places.summary  TEXT  required");
    const imported = importDir(db, dir);
    expect(imported).toHaveLength(tables.length);
    expect(imported.every((r) => r.rows === 0)).toBe(true);
  });
});
