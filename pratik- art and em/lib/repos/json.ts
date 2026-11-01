import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";

export type FileIssue = { file: string; index?: number; message: string };
type Result<T> = { items: T[]; issues: FileIssue[] };

/**
 * Reads one JSON file holding one object or an array of objects.
 * Invalid entries are skipped and reported, so one bad file never takes the app down;
 * `npm run content:check` turns these issues into a hard failure.
 */
export function readEntityFile<T extends z.ZodType>(file: string, schema: T): Result<z.infer<T>> {
  const out: Result<z.infer<T>> = { items: [], issues: [] };
  if (!fs.existsSync(file)) return out;
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    out.issues.push({ file, message: `Not valid JSON: ${(e as Error).message}` });
    return out;
  }
  const isArray = Array.isArray(raw);
  (isArray ? (raw as unknown[]) : [raw]).forEach((entry, index) => {
    const parsed = schema.safeParse(entry);
    if (parsed.success) out.items.push(parsed.data);
    else
      out.issues.push({
        file,
        index: isArray ? index : undefined,
        message: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "),
      });
  });
  return out;
}

/** Reads every *.json file in a folder with readEntityFile. */
export function readEntities<T extends z.ZodType>(dir: string, schema: T): Result<z.infer<T>> {
  const out: Result<z.infer<T>> = { items: [], issues: [] };
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const r = readEntityFile(path.join(dir, name), schema);
    out.items.push(...r.items);
    out.issues.push(...r.issues);
  }
  return out;
}
