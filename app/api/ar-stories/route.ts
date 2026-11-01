import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { apiError, currentMember, json, requireMember, sameOrigin } from "@/lib/community/http";
import { CommunityError, getCommunity } from "@/lib/community/store";
import { currentMode } from "@/lib/config";
import { detectMedia, MAX_BYTES } from "@/lib/ar-stories/media";
import { getArStories, MAX_SECONDS, purgeExpired, storiesForViewer, STORY_TTL_MS, toClientStory, uploadDir, type Projection } from "@/lib/ar-stories/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECTIONS: Projection[] = ["equirect", "pano", "flat"];
const DAILY_LIMIT = 10;

export async function GET() {
  try {
    await purgeExpired();
    const viewer = await currentMember();
    return json(storiesForViewer(viewer?.id ?? null, currentMode()));
  } catch (error) {
    return apiError(error);
  }
}

/** Upload a story: signed-in members only, validated from the file's own bytes, rate-limited. */
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const member = await requireMember();
    if (Number(req.headers.get("content-length") || 0) > MAX_BYTES + 1_000_000) throw new CommunityError("That file is larger than 150 MB.", 413);
    getCommunity().limit(`ar-story:${member.id}`, 6, 3_600_000);
    const store = getArStories();
    if (store.countSince(member.id, new Date(Date.now() - STORY_TTL_MS).toISOString()) >= DAILY_LIMIT) {
      throw new CommunityError(`You have reached today's limit of ${DAILY_LIMIT} stories. Delete one, or try again tomorrow.`, 429);
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new CommunityError("Expected a file upload.", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new CommunityError("No file was sent.", 400);
    if (file.size > MAX_BYTES) throw new CommunityError("That file is larger than 150 MB.", 413);
    const detected = detectMedia(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
    if (!detected) throw new CommunityError("That file type isn’t supported. Use a JPG, PNG or WEBP photo, or an MP4, WEBM or MOV video.", 415);
    const { ext, mediaType } = detected;

    const rawProjection = String(form.get("projection"));
    const projection = (PROJECTIONS as string[]).includes(rawProjection) ? (rawProjection as Projection) : "flat";
    const panoDeg = Math.min(360, Math.max(90, Math.round(Number(form.get("panoDeg")) || 360)));
    const videoLength = Number(form.get("videoLength")) || 0;
    const trimStart = mediaType === "video" ? Math.max(0, Number(form.get("trimStart")) || 0) : 0;
    // The 60-second rule: photos show for 3 to 60 s; videos play at most 60 s from the trim point.
    let duration = Number(form.get("duration")) || (mediaType === "image" ? 8 : MAX_SECONDS);
    if (mediaType === "video" && videoLength) duration = Math.min(duration, videoLength - trimStart);
    duration = Math.round(Math.min(MAX_SECONDS, Math.max(mediaType === "image" ? 3 : 1, duration)) * 10) / 10;

    const id = store.newId();
    const mediaFile = `${id}.${ext}`;
    const dir = uploadDir();
    await fs.mkdir(dir, { recursive: true });
    const target = path.join(dir, mediaFile);
    await pipeline(Readable.fromWeb(file.stream() as unknown as NodeReadableStream), createWriteStream(target));
    try {
      const row = store.create(id, member.id, {
        mediaType,
        projection,
        panoDeg,
        mediaFile,
        duration,
        trimStart,
        caption: String(form.get("caption") || "").trim().slice(0, 160),
        place: String(form.get("place") || "").trim().slice(0, 60),
      });
      return json({ story: toClientStory(row) }, 201);
    } catch (error) {
      await fs.unlink(target).catch(() => {});
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}
