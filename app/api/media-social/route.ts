import fs from "node:fs";
import path from "node:path";
import { apiError, currentMember, json, requireMember, sameOrigin } from "@/lib/community/http";
import { CommunityError, getCommunity } from "@/lib/community/store";
import { currentMode } from "@/lib/config";
import { getVisiblePlaces } from "@/lib/services/content";
import {
  addMediaComment,
  createMediaPost,
  deleteMediaComment,
  deleteMediaPost,
  ensureMediaProfile,
  getFollowList,
  getMediaAudioTracks,
  getMediaComments,
  getMediaNotifications,
  getMediaUserProfile,
  getPost,
  isFollowable,
  isSeedUser,
  markMediaNotificationsRead,
  queryFeed,
  queryReels,
  toggleMediaFollow,
  toggleMediaLike,
  toggleMediaSave,
  upsertMediaUserProfile,
} from "@/lib/media-social/db";
import { MAX_VIDEO_BYTES, removeUploads, saveUpload } from "@/lib/media-social/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIA_TYPES = ["photo", "video", "reel", "ar_story", "vr_360"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];
const AVATARS = [
  "/media/placeholders/artisan-1.svg",
  "/media/placeholders/artisan-2.svg",
  "/media/placeholders/artisan-3.svg",
  "/media/places/city-palace-1.webp",
  "/media/places/bagore-ki-haveli-1.webp",
];
const STATIC_MEDIA = /^\/media\/[A-Za-z0-9_\-/]+\.(webp|jpg|png|mp4)$/;
const HASHTAG = /^#[A-Za-z0-9_ऀ-ॿ]{1,40}$/;

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** A site-local /media/... path that exists in public/, never an outside address. */
function staticMedia(value: unknown): string | null {
  if (typeof value !== "string" || !STATIC_MEDIA.test(value) || value.includes("..")) return null;
  return fs.existsSync(path.join(process.cwd(), "public", value)) ? value : null;
}

function hashtagsFrom(value: unknown, caption: string): string[] {
  const given = Array.isArray(value) ? value.filter((t): t is string => typeof t === "string" && HASHTAG.test(t)) : [];
  const tags = given.length ? given : caption.match(/#[A-Za-z0-9_ऀ-ॿ]{1,40}/g) ?? [];
  return [...new Set(tags)].slice(0, 15);
}

/** Keeps only the AR overlay fields the viewer understands, with bounded sizes. */
function arConfigFrom(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const hotspots = Array.isArray(v.hotspots)
    ? v.hotspots.slice(0, 10).flatMap((h) => {
        const o = (h ?? {}) as Record<string, unknown>;
        return typeof o.pitch === "number" && typeof o.yaw === "number" ? [{ title: text(o.title, 60), description: text(o.description, 200), pitch: o.pitch, yaw: o.yaw }] : [];
      })
    : undefined;
  return {
    modelType: text(v.modelType, 40) || undefined,
    overlayType: text(v.overlayType, 40) || undefined,
    description: text(v.description, 300) || undefined,
    historicalYear: typeof v.historicalYear === "number" && Number.isFinite(v.historicalYear) ? Math.round(v.historicalYear) : undefined,
    hotspots,
  };
}

async function readJson(req: Request, max = 32_768): Promise<Record<string, unknown>> {
  const raw = await req.text();
  if (raw.length > max) throw new CommunityError("That request is too large.", 413);
  try {
    const body = JSON.parse(raw);
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // falls through to the error below
  }
  throw new CommunityError("Check the request and try again.", 400);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const view = url.searchParams.get("view") || "feed";
    const member = await currentMember();
    const demo = currentMode() === "demo";
    const viewerId = member?.id;
    if (member) ensureMediaProfile(member.id, member.username, member.name);
    const currentUser = member ? { userId: member.id, username: member.username, displayName: member.name } : null;

    if (view === "feed") {
      const result = queryFeed(viewerId, {
        mediaType: url.searchParams.get("mediaType") || undefined,
        hashtag: url.searchParams.get("hashtag") || undefined,
        placeId: url.searchParams.get("placeId") || undefined,
        searchQuery: url.searchParams.get("q") || undefined,
        limit: Number(url.searchParams.get("limit")) || 20,
        offset: Number(url.searchParams.get("offset")) || 0,
        demo,
      });
      return json({ ok: true, currentUser, posts: result.posts, total: result.total });
    }

    if (view === "reels") return json({ ok: true, currentUser, reels: queryReels(viewerId, 50, demo) });

    if (view === "post") {
      const post = getPost(url.searchParams.get("id") ?? "", viewerId, demo);
      return post ? json({ ok: true, currentUser, post }) : json({ ok: false, error: "Post not found." }, 404);
    }

    if (view === "comments") {
      const postId = url.searchParams.get("postId") ?? "";
      if (!getPost(postId, viewerId, demo)) return json({ ok: false, error: "Post not found." }, 404);
      return json({ ok: true, comments: getMediaComments(postId) });
    }

    if (view === "profile") {
      const profile = getMediaUserProfile(url.searchParams.get("username") || member?.username || "", viewerId, demo);
      return profile ? json({ ok: true, currentUser, profile }) : json({ ok: false, error: "Profile not found." }, 404);
    }

    if (view === "follows") {
      const signedIn = await requireMember();
      const type = url.searchParams.get("type") === "following" ? "following" : "followers";
      const list = getFollowList(url.searchParams.get("userId") || signedIn.id, type).filter((u) => (isSeedUser(u.userId) ? demo : true));
      return json({ ok: true, list });
    }

    if (view === "notifications") return json({ ok: true, notifications: member ? getMediaNotifications(member.id) : [] });

    if (view === "audio") return json({ ok: true, tracks: getMediaAudioTracks() });

    if (view === "places") {
      const places = getVisiblePlaces().map((p) => ({ id: p.id, name: p.name, name_hi: p.name_hi, slug: p.slug, category: p.category, lat: p.lat, lng: p.lng, photo: p.photos[0] || null }));
      return json({ ok: true, places });
    }

    return json({ ok: false, error: "Unknown request." }, 400);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  const saved: string[] = [];
  try {
    sameOrigin(req);
    const member = await requireMember();
    const demo = currentMode() === "demo";
    ensureMediaProfile(member.id, member.username, member.name);
    const limit = (key: string, max: number, windowMs: number) => getCommunity().limit(`media:${key}:${member.id}`, max, windowMs);

    const multipart = (req.headers.get("content-type") || "").includes("multipart/form-data");
    if (multipart && Number(req.headers.get("content-length") || 0) > MAX_VIDEO_BYTES + 1_000_000) throw new CommunityError("That file is too large.", 413);
    let form: FormData | null = null;
    if (multipart) {
      try {
        form = await req.formData();
      } catch {
        throw new CommunityError("Expected a file upload.", 400);
      }
    }
    const body: Record<string, unknown> = form ? Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) : await readJson(req);
    const action = text(body.action, 30);

    if (action === "create_post") {
      limit("post", 10, 3_600_000);
      const mediaType = (MEDIA_TYPES as readonly string[]).includes(body.mediaType as string) ? (body.mediaType as MediaType) : "photo";

      let mediaUrl: string | null = null;
      const file = form?.get("file");
      if (file instanceof File) {
        const upload = await saveUpload(file);
        saved.push(upload.name);
        const wants = mediaType === "photo" || mediaType === "vr_360" ? "image" : mediaType === "video" || mediaType === "reel" ? "video" : upload.mediaType;
        if (upload.mediaType !== wants) throw new CommunityError(`A ${mediaType.replace("_", " ")} post needs a ${wants}, not a ${upload.mediaType}.`, 400);
        mediaUrl = upload.url;
      }
      mediaUrl ??= staticMedia(body.mediaUrl);
      if (!mediaUrl) throw new CommunityError("Add a photo or video to post.", 400);

      const caption = text(body.caption, 2200);
      const place = typeof body.placeId === "string" ? getVisiblePlaces().find((p) => p.id === body.placeId) : undefined;
      const audio = typeof body.audioId === "string" ? getMediaAudioTracks().find((t) => t.id === body.audioId) : undefined;
      let arConfig: unknown = body.arConfig;
      if (typeof arConfig === "string") {
        try { arConfig = JSON.parse(arConfig); } catch { arConfig = null; }
      }
      let hashtags: unknown = body.hashtags;
      if (typeof hashtags === "string") {
        try { hashtags = JSON.parse(hashtags); } catch { hashtags = []; }
      }

      const id = createMediaPost({
        userId: member.id,
        username: member.username,
        userName: member.name,
        userAvatar: null,
        mediaType,
        mediaUrl,
        thumbnailUrl: mediaUrl,
        caption,
        placeId: place?.id ?? null,
        placeName: place?.name ?? null,
        audioId: audio?.id ?? null,
        audioTitle: audio?.title ?? null,
        arConfig: arConfigFrom(arConfig),
        vrPanoramaUrl: staticMedia(body.vrPanoramaUrl),
        hashtags: hashtagsFrom(hashtags, caption),
      });
      return json({ ok: true, post: getPost(id, member.id, demo) }, 201);
    }

    if (action === "delete_post") {
      const files = deleteMediaPost(text(body.postId, 80), member.id);
      if (!files) throw new CommunityError("Post not found.", 404);
      await removeUploads(files);
      return json({ ok: true });
    }

    const visible = (postId: string) => {
      const post = getPost(postId, member.id, demo);
      if (!post) throw new CommunityError("Post not found.", 404);
      return post;
    };
    const sampleNote = "This is a sample post. You can like and save it, but comments and follows are for real members.";

    if (action === "like") {
      limit("like", 120, 60_000);
      return json({ ok: true, ...toggleMediaLike(member.id, visible(text(body.postId, 80)).id) });
    }

    if (action === "save") {
      limit("save", 120, 60_000);
      return json({ ok: true, ...toggleMediaSave(member.id, visible(text(body.postId, 80)).id) });
    }

    if (action === "comment") {
      limit("comment", 30, 600_000);
      const post = visible(text(body.postId, 80));
      const comment = text(body.text, 500);
      if (!comment) throw new CommunityError("Write a comment first.", 400);
      if (isSeedUser(post.userId)) throw new CommunityError(sampleNote, 400);
      return json({ ok: true, comment: addMediaComment(post.id, member.id, member.username, member.name, null, comment) }, 201);
    }

    if (action === "delete_comment") {
      return json({ ok: true, success: deleteMediaComment(text(body.commentId, 80), member.id) });
    }

    if (action === "follow") {
      limit("follow", 60, 3_600_000);
      const targetId = text(body.targetId, 80);
      if (isSeedUser(targetId)) throw new CommunityError(sampleNote, 400);
      if (targetId === member.id || !isFollowable(targetId, demo)) throw new CommunityError("Profile not found.", 404);
      return json({ ok: true, ...toggleMediaFollow(member.id, targetId) });
    }

    if (action === "update_profile") {
      limit("profile", 20, 3_600_000);
      const interests = Array.isArray(body.travelInterests) ? body.travelInterests.map((i) => text(i, 30)).filter(Boolean).slice(0, 10) : [];
      let website = "";
      const rawSite = text(body.website, 200);
      if (rawSite) {
        try {
          const parsed = new URL(/^https?:\/\//i.test(rawSite) ? rawSite : `https://${rawSite}`);
          if (parsed.protocol === "https:" || parsed.protocol === "http:") website = parsed.toString();
        } catch {
          website = "";
        }
      }
      const profile = upsertMediaUserProfile({
        userId: member.id,
        username: member.username,
        displayName: text(body.displayName, 60) || member.name,
        bio: text(body.bio, 160),
        avatarUrl: typeof body.avatarUrl === "string" && AVATARS.includes(body.avatarUrl) ? body.avatarUrl : null,
        travelInterests: interests,
        privacy: body.privacy === "private" ? "private" : "public",
        website,
      });
      return json({ ok: true, profile });
    }

    if (action === "mark_notifications_read") {
      markMediaNotificationsRead(member.id);
      return json({ ok: true });
    }

    return json({ ok: false, error: "Unknown request." }, 400);
  } catch (error) {
    await removeUploads(saved);
    return apiError(error);
  }
}
