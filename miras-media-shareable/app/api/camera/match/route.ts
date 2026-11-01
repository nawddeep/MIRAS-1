import { getAiProvider } from "@/lib/ai";
import { clientKey } from "@/lib/http";
import { limits, tooMany } from "@/lib/rate-limit";
import { matchFrame } from "@/lib/services/camera";

const MAX_FRAME_BYTES = 3 * 1024 * 1024;

/** One frame in, a place match (or "I don't know") out. The frame is never stored. */
export async function POST(req: Request) {
  if (!limits.cameraMatch.allow(clientKey(req))) return tooMany();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Upload was incomplete. Please try again." }, { status: 400 });
  }
  const frame = form.get("frame");
  const demoPick = form.get("demoPlaceId");
  const demoPlaceId = typeof demoPick === "string" && demoPick ? demoPick : undefined;
  const hasFrame = frame instanceof File && frame.size > 0;
  if (!hasFrame && !demoPlaceId) return Response.json({ error: "No photo received." }, { status: 400 });
  if (hasFrame && frame.size > MAX_FRAME_BYTES) return Response.json({ error: "Photo is too large." }, { status: 413 });

  const result = await matchFrame(
    getAiProvider(),
    hasFrame ? Buffer.from(await frame.arrayBuffer()) : Buffer.alloc(0),
    hasFrame ? frame.type || "image/jpeg" : "image/jpeg",
    { demoPlaceId },
  );
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
