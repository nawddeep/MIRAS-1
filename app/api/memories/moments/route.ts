import { getAiProvider } from "@/lib/ai";
import { clientKey } from "@/lib/http";
import { limits, tooMany } from "@/lib/rate-limit";
import { MAX_FRAMES, pickMoments } from "@/lib/services/memories";

const MAX_FRAME_BYTES = 1.5 * 1024 * 1024;

/** Still frames in (one request), captions and verified stories out. Nothing is stored. */
export async function POST(req: Request) {
  if (!limits.memories.allow(clientKey(req))) return tooMany();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, error: "Upload was incomplete. Please try again." }, { status: 400 });
  }
  const files = form.getAll("frames").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return Response.json({ ok: false, error: "No photos received." }, { status: 400 });
  if (files.length > MAX_FRAMES) return Response.json({ ok: false, error: `Please pick up to ${MAX_FRAMES} moments.` }, { status: 400 });
  if (files.some((f) => f.size > MAX_FRAME_BYTES)) return Response.json({ ok: false, error: "A photo is too large." }, { status: 413 });

  let chosen: (string | null)[] = [];
  try {
    const raw = JSON.parse(String(form.get("places") ?? "[]"));
    if (Array.isArray(raw)) chosen = raw.map((x) => (typeof x === "string" && x ? x : null));
  } catch {
    // No place choices: the model's suggestions (if any) are used.
  }

  const frames = await Promise.all(files.map(async (f) => ({ data: Buffer.from(await f.arrayBuffer()), mime: f.type || "image/jpeg" })));
  const result = await pickMoments(getAiProvider(), frames, chosen);
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
