import fs from "node:fs";
import { getMediaSocialStorage } from "@/lib/media-social/storage";

export async function GET(req: Request, ctx: RouteContext<"/api/media-social/file/[filename]">) {
  const { filename } = await ctx.params;
  const storage = getMediaSocialStorage();
  const fileInfo = storage.getFileStream(filename);

  if (!fileInfo) {
    return new Response("Media file not found", { status: 404 });
  }

  const { filePath, size, mimeType } = fileInfo;
  const range = req.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : size - 1;

    if (start >= size || end >= size) {
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }

    const chunksize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    // Convert node read stream to web readable stream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new Response(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunksize),
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Full content response
  const stream = fs.createReadStream(filePath);
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });

  return new Response(webStream, {
    status: 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(size),
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

