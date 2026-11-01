import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { apiError, requireMember } from "@/lib/community/http";
import { currentMode } from "@/lib/config";
import { canSeeUploadedFile } from "@/lib/media-social/db";
import { contentTypeFor, FILE_NAME, uploadDir } from "@/lib/media-social/storage";

export const runtime = "nodejs";

/** Streams a member's uploaded photo or video (Range supported so video can seek) to signed-in members who may see its post. */
export async function GET(req: Request, ctx: RouteContext<"/api/media-social/file/[filename]">) {
  try {
    const member = await requireMember();
    const { filename } = await ctx.params;
    if (!FILE_NAME.test(filename) || !canSeeUploadedFile(filename, { viewerId: member.id, demo: currentMode() === "demo" })) return new Response("Not found", { status: 404 });
    const file = path.join(uploadDir(), filename);
    let size: number;
    try {
      size = fs.statSync(file).size;
    } catch {
      return new Response("Not found", { status: 404 });
    }
    const headers: Record<string, string> = {
      "Content-Type": contentTypeFor(filename),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    };
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
