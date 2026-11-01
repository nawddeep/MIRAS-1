import { currentMember } from "@/lib/community/http";
import { getVisiblePlaces } from "@/lib/services/content";
import {
  queryFeed,
  queryReels,
  getPost,
  createMediaPost,
  toggleMediaLike,
  toggleMediaSave,
  addMediaComment,
  getMediaComments,
  deleteMediaComment,
  toggleMediaFollow,
  getMediaUserProfile,
  upsertMediaUserProfile,
  getFollowList,
  getMediaNotifications,
  markMediaNotificationsRead,
  getMediaAudioTracks,
} from "@/lib/media-social/db";
import { getMediaSocialStorage } from "@/lib/media-social/storage";

const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });

async function resolveUser(req: Request) {
  try {
    const member = await currentMember();
    if (member) {
      return {
        userId: member.id,
        username: member.username,
        displayName: member.name,
        avatarUrl: null,
      };
    }
  } catch {
    // Handle when cookies() is unavailable or not in standard request context
  }

  // Fallback to active demo traveller persona if not yet signed into an account
  const headerUser = req.headers.get("x-miras-demo-user");
  if (headerUser === "priya") {
    return {
      userId: "user-priya",
      username: "priya_wanders",
      displayName: "Priya Rathore",
      avatarUrl: "/media/artisan-2.svg",
    };
  }
  return {
    userId: "user-aarav",
    username: "aarav_explores",
    displayName: "Aarav Sharma",
    avatarUrl: "/media/artisan-1.svg",
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const view = url.searchParams.get("view") || "feed";
    const user = await resolveUser(req);
    const viewerId = user.userId;

    if (view === "feed") {
      const mediaType = url.searchParams.get("mediaType") || undefined;
      const hashtag = url.searchParams.get("hashtag") || undefined;
      const placeId = url.searchParams.get("placeId") || undefined;
      const searchQuery = url.searchParams.get("q") || undefined;
      const limit = Number(url.searchParams.get("limit")) || 20;
      const offset = Number(url.searchParams.get("offset")) || 0;

      const result = queryFeed(viewerId, {
        mediaType,
        hashtag,
        placeId,
        searchQuery,
        limit,
        offset,
      });

      return json({
        ok: true,
        currentUser: user,
        posts: result.posts,
        total: result.total,
      });
    }

    if (view === "reels") {
      const reels = queryReels(viewerId, 50);
      return json({ ok: true, currentUser: user, reels });
    }

    if (view === "post") {
      const id = url.searchParams.get("id");
      if (!id) return json({ ok: false, error: "Missing post id" }, 400);
      const post = getPost(id, viewerId);
      if (!post) return json({ ok: false, error: "Post not found" }, 404);
      return json({ ok: true, currentUser: user, post });
    }

    if (view === "comments") {
      const postId = url.searchParams.get("postId");
      if (!postId) return json({ ok: false, error: "Missing postId" }, 400);
      const comments = getMediaComments(postId);
      return json({ ok: true, comments });
    }

    if (view === "profile") {
      const username = url.searchParams.get("username") || user.username;
      const profile = getMediaUserProfile(username, viewerId);
      if (!profile) return json({ ok: false, error: "Profile not found" }, 404);
      return json({ ok: true, currentUser: user, profile });
    }

    if (view === "follows") {
      const targetUserId = url.searchParams.get("userId") || viewerId;
      const type = (url.searchParams.get("type") as "followers" | "following") || "followers";
      const list = getFollowList(targetUserId, type);
      return json({ ok: true, list });
    }

    if (view === "notifications") {
      const notifications = getMediaNotifications(viewerId);
      return json({ ok: true, notifications });
    }

    if (view === "audio") {
      const tracks = getMediaAudioTracks();
      return json({ ok: true, tracks });
    }

    if (view === "places") {
      const places = getVisiblePlaces().map((p) => ({
        id: p.id,
        name: p.name,
        name_hi: p.name_hi,
        slug: p.slug,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        photo: p.photos[0] || null,
      }));
      return json({ ok: true, places });
    }

    return json({ ok: false, error: "Invalid view" }, 400);
  } catch (err) {
    console.error("GET /api/media-social error:", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await resolveUser(req);
    const contentType = req.headers.get("content-type") || "";

    // Multipart Form (file upload / post creation)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const action = String(formData.get("action") || "");

      if (action === "upload") {
        const file = formData.get("file") as File | null;
        if (!file) return json({ ok: false, error: "No file uploaded" }, 400);

        const buffer = Buffer.from(await file.arrayBuffer());
        const storage = getMediaSocialStorage();
        const uploaded = storage.saveUpload(buffer, file.type, file.name);

        return json({ ok: true, file: uploaded });
      }

      if (action === "create_post") {
        const file = formData.get("file") as File | null;
        let mediaUrl = String(formData.get("mediaUrl") || "");

        if (file && file.size > 0) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const storage = getMediaSocialStorage();
          const uploaded = storage.saveUpload(buffer, file.type, file.name);
          mediaUrl = uploaded.url;
        }

        if (!mediaUrl) {
          return json({ ok: false, error: "Media file or URL is required" }, 400);
        }

        const mediaType = (formData.get("mediaType") || "photo") as any;
        const caption = String(formData.get("caption") || "");
        const placeId = formData.get("placeId") ? String(formData.get("placeId")) : null;
        const placeName = formData.get("placeName") ? String(formData.get("placeName")) : null;
        const audioId = formData.get("audioId") ? String(formData.get("audioId")) : null;
        const audioTitle = formData.get("audioTitle") ? String(formData.get("audioTitle")) : null;
        const vrPanoramaUrl = formData.get("vrPanoramaUrl") ? String(formData.get("vrPanoramaUrl")) : null;
        const arConfigRaw = formData.get("arConfig");
        let arConfig = null;
        if (arConfigRaw) {
          try {
            arConfig = JSON.parse(String(arConfigRaw));
          } catch {
            arConfig = null;
          }
        }

        const hashtagsRaw = formData.get("hashtags");
        const hashtags = hashtagsRaw ? JSON.parse(String(hashtagsRaw)) : [];

        const newPostId = createMediaPost({
          userId: user.userId,
          username: user.username,
          userName: user.displayName,
          userAvatar: user.avatarUrl,
          mediaType,
          mediaUrl,
          thumbnailUrl: mediaUrl,
          caption,
          placeId,
          placeName,
          audioId,
          audioTitle,
          arConfig,
          vrPanoramaUrl,
          hashtags,
        });

        const post = getPost(newPostId, user.userId);
        return json({ ok: true, post });
      }
    }

    // JSON body actions
    const body = await req.json();
    const { action } = body;

    if (action === "like") {
      const { postId } = body;
      if (!postId) return json({ ok: false, error: "postId is required" }, 400);
      const result = toggleMediaLike(user.userId, postId);
      return json({ ok: true, ...result });
    }

    if (action === "save") {
      const { postId } = body;
      if (!postId) return json({ ok: false, error: "postId is required" }, 400);
      const result = toggleMediaSave(user.userId, postId);
      return json({ ok: true, ...result });
    }

    if (action === "comment") {
      const { postId, text } = body;
      if (!postId || !text || !text.trim()) {
        return json({ ok: false, error: "postId and text are required" }, 400);
      }
      const comment = addMediaComment(postId, user.userId, user.username, user.displayName, user.avatarUrl, text);
      return json({ ok: true, comment });
    }

    if (action === "delete_comment") {
      const { commentId } = body;
      if (!commentId) return json({ ok: false, error: "commentId is required" }, 400);
      const success = deleteMediaComment(commentId, user.userId);
      return json({ ok: true, success });
    }

    if (action === "follow") {
      const { targetId } = body;
      if (!targetId) return json({ ok: false, error: "targetId is required" }, 400);
      const result = toggleMediaFollow(user.userId, targetId);
      return json({ ok: true, ...result });
    }

    if (action === "update_profile") {
      const { displayName, bio, travelInterests, privacy, website, avatarUrl } = body;
      const updated = upsertMediaUserProfile({
        userId: user.userId,
        username: user.username,
        displayName: displayName || user.displayName,
        bio,
        avatarUrl,
        travelInterests,
        privacy,
        website,
      });
      return json({ ok: true, profile: updated });
    }

    if (action === "mark_notifications_read") {
      markMediaNotificationsRead(user.userId);
      return json({ ok: true });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (err) {
    console.error("POST /api/media-social error:", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
}
