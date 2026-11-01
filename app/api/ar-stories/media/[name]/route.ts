import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { apiError, requireMember } from "@/lib/community/http";
import { getArStories, uploadDir } from "@/lib/ar-stories/store";

export const runtime = "nodejs";
const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
const NAME = /^s-[a-z0-9]+-[a-f0-9]{6}\.(jpg|png|webp|mp4|webm|mov)$/;

/** Streams a member's story media (with Range support so video can seek), to signed-in members, while the story is live. */
export async function GET(req: Request, ctx: RouteContext<"/api/ar-stories/media/[name]">) {
  try {
    await requireMember();
    const { name } = await ctx.params;
    if (!NAME.test(name) || !getArStories().byFile(name)) return new Response("Not found", { status: 404 });
    const file = path.join(uploadDir(), name);
    let size: number;
    try {
      size = fs.statSync(file).size;
    } catch {
      return new Response("Not found", { status: 404 });
    }
    const headers: Record<string, string> = { "Content-Type": TYPES[name.split(".").pop()!], "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" };
    const range = req.headers.get("range");
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m || (!m[1] && !m[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      let start = m[1] ? Number(m[1]) : 0;
      let end = m[2] ? Number(m[2]) : size - 1;
      if (!m[1]) {
        start = Math.max(0, size - Number(m[2]));
        end = size - 1;
      }
      end = Math.min(end, size - 1);
      if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream, {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
      });
    }
    return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, { headers: { ...headers, "Content-Length": String(size) } });
  } catch (error) {
    return apiError(error);
  }
}
