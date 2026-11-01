import { importAbcMock, loadAbcMock } from "../lib/db/abc-mock";
import { coreDbPath } from "../lib/db/core";
import { migrate, openCoreDb } from "../lib/db/migrate";

/** Loads the data in "ABC(3 features)/src" (mockData.js + eventsData.js) into the database. */
async function main() {
  const db = openCoreDb(coreDbPath());
  migrate(db);
  const counts = importAbcMock(db, await loadAbcMock());
  for (const [table, n] of Object.entries(counts)) console.log(`${String(n).padStart(6)}  ${table}`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exitCode = 1;
});
