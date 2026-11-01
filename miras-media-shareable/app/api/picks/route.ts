import { clientKey, readJson } from "@/lib/http";
import { limits, tooMany } from "@/lib/rate-limit";
import { submitPick } from "@/lib/services/picks";

/** A visitor suggests a local pick. Stored as pending; never shown until a moderator approves it. */
export async function POST(req: Request) {
  if (!limits.picks.allow(clientKey(req))) return tooMany();
  const result = submitPick(await readJson(req));
  return Response.json(result, { status: result.ok ? 201 : 400 });
}
