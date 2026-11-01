import fs from "node:fs";
import path from "node:path";
import { checkContent, renderTodo } from "../lib/content-check";
import { HINDI_DRAFT_KEYS, hindiDraft } from "../lib/i18n";

const root = process.cwd();
const report = checkContent(path.join(root, "content"), path.join(root, "public"));
// Draft Hindi UI copy is listed with the content so the team reviews it in one place.
for (const key of HINDI_DRAFT_KEYS) report.todo.push({ kind: "copy", id: key, file: "lib/i18n.ts", note: `Hindi "${hindiDraft(key)}" needs native-speaker review` });
fs.writeFileSync(path.join(root, "CONTENT_TODO.md"), renderTodo(report, new Date()));

console.log(`Content check: ${report.errors.length} error(s), ${report.todo.length} item(s) still sample or unverified.`);
if (report.todo.length) {
  console.log("\nStill to replace or verify (full list in CONTENT_TODO.md):");
  for (const t of report.todo) console.log(`  - ${t.kind} ${t.id}: ${t.note}`);
}
if (report.warnings.length) {
  console.warn("\nWarnings:");
  for (const w of report.warnings) console.warn(`  ! ${w}`);
}
if (report.errors.length) {
  console.error("\nErrors:");
  for (const e of report.errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("\nNo errors.");
