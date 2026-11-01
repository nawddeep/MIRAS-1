import { randomUUID } from "node:crypto";
import { openDb, type Db } from "@/lib/repos/sqlite";
import { getConfig } from "@/lib/config";

export interface MediaPost {
  id: string;
  userId: string;
  username: string;
  userName: string;
  userAvatar: string | null;
  mediaType: "photo" | "video" | "reel" | "ar_story" | "vr_360";
  mediaUrl: string;
  thumbnailUrl: string | null;
  caption: string;
  placeId: string | null;
  placeName: string | null;
  hashtags: string[];
  mentions: string[];
  audioId: string | null;
  audioTitle: string | null;
  arConfig: {
    modelType?: string;
    overlayType?: string;
    hotspots?: { title: string; description: string; pitch: number; yaw: number }[];
    historicalYear?: number;
    description?: string;
  } | null;
  vrPanoramaUrl: string | null;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved: boolean;
  isFollowingAuthor: boolean;
  createdAt: string;
}

export interface MediaComment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userName: string;
  userAvatar: string | null;
  text: string;
  createdAt: string;
}

export interface MediaUserProfile {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  travelInterests: string[];
  privacy: "public" | "private";
  website: string;
  postsCount: number;
  reelsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
}

export interface MediaAudioTrack {
  id: string;
  title: string;
  artist: string;
  category: string;
  durationSec: number;
  fileUrl: string;
}

export interface MediaNotification {
  id: string;
  userId: string;
  actorId: string;
  actorUsername: string;
  actorName: string;
  actorAvatar: string | null;
  type: "like" | "comment" | "follow" | "mention";
  postId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

/** The made-up demo creators the module ships with. Their posts are samples: shown in demo mode only. */
export const MEDIA_SEED_USER_IDS = ["user-aarav", "user-priya", "user-dev"] as const;
const SEED_SQL = MEDIA_SEED_USER_IDS.map((id) => `'${id}'`).join(",");
export const isSeedUser = (id: string) => (MEDIA_SEED_USER_IDS as readonly string[]).includes(id);

/** Who is asking: a signed-in member's id (or none), and whether sample content may be shown. */
export interface Audience {
  viewerId?: string | null;
  demo: boolean;
}

/**
 * SQL for "this post may be seen by this viewer": samples only in demo mode, members' posts only for signed-in
 * members, and a private author's posts only for that author and their followers.
 */
function visibleSql(alias: string, a: Audience, params: Record<string, unknown>): string {
  params.aDemo = a.demo ? 1 : 0;
  params.aMember = a.viewerId ? 1 : 0;
  params.aViewer = a.viewerId ?? "";
  return `((${alias}.user_id IN (${SEED_SQL}) AND @aDemo = 1) OR (${alias}.user_id NOT IN (${SEED_SQL}) AND @aMember = 1))
    AND (COALESCE((SELECT u.privacy FROM media_user_profiles u WHERE u.user_id = ${alias}.user_id), 'public') = 'public'
         OR ${alias}.user_id = @aViewer
         OR EXISTS (SELECT 1 FROM media_follows f WHERE f.follower_id = @aViewer AND f.target_id = ${alias}.user_id))`;
}

/** Escapes % _ and \\ so user text matches literally in a LIKE ... ESCAPE '\\' clause. */
const likeEscape = (text: string) => text.replace(/[\\%_]/g, "\\$&");

type PostRow = Omit<MediaPost, "hashtags" | "mentions" | "arConfig" | "likesCount" | "commentsCount" | "isLiked" | "isSaved" | "isFollowingAuthor"> & {
  hashtags: string;
  mentions: string;
  arConfig: string | null;
  likesCount: number;
  commentsCount: number;
  isLiked: number;
  isSaved: number;
  isFollowingAuthor: number;
};
type ActorRow = { username: string; display_name: string; avatar_url: string | null } | undefined;
type ProfileRow = {
  user_id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  travel_interests: string | null;
  privacy: "public" | "private";
  website: string | null;
};
type NotificationRow = Omit<MediaNotification, "isRead"> & { isRead: number };

let dbInstance: Db | undefined;

export function getMediaDb(): Db {
  if (dbInstance) return dbInstance;
  const db = openDb(getConfig().dataDir);

  db.exec(`
    CREATE TABLE IF NOT EXISTS media_posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_avatar TEXT,
      media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video', 'reel', 'ar_story', 'vr_360')),
      media_url TEXT NOT NULL,
      thumbnail_url TEXT,
      caption TEXT NOT NULL DEFAULT '',
      place_id TEXT,
      place_name TEXT,
      hashtags TEXT NOT NULL DEFAULT '[]',
      mentions TEXT NOT NULL DEFAULT '[]',
      audio_id TEXT,
      audio_title TEXT,
      ar_config TEXT,
      vr_panorama_url TEXT,
      views_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_media_posts_created ON media_posts (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_media_posts_user ON media_posts (user_id);
    CREATE INDEX IF NOT EXISTS idx_media_posts_type ON media_posts (media_type);
    CREATE INDEX IF NOT EXISTS idx_media_posts_place ON media_posts (place_id);

    CREATE TABLE IF NOT EXISTS media_likes (
      user_id TEXT NOT NULL,
      post_id TEXT NOT NULL REFERENCES media_posts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS media_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES media_posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_avatar TEXT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_media_comments_post ON media_comments (post_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS media_saved (
      user_id TEXT NOT NULL,
      post_id TEXT NOT NULL REFERENCES media_posts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS media_follows (
      follower_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (follower_id, target_id)
    );

    CREATE TABLE IF NOT EXISTS media_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_avatar TEXT,
      type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'mention')),
      post_id TEXT,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_media_notif_user ON media_notifications (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS media_user_profiles (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      avatar_url TEXT,
      travel_interests TEXT NOT NULL DEFAULT '[]',
      privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'private')),
      website TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_audio_tracks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      category TEXT NOT NULL,
      duration_sec INTEGER NOT NULL,
      file_url TEXT NOT NULL
    );
  `);

  seedInitialData(db);
  dbInstance = db;
  return db;
}

function seedInitialData(db: Db) {
  const trackCount = db.prepare("SELECT COUNT(*) AS c FROM media_audio_tracks").pluck().get() as number;
  if (trackCount === 0) {
    const tracks: MediaAudioTrack[] = [
      { id: "track-1", title: "Kesariya Balam (Sarangi Melody)", artist: "Udaipur Heritage Ensemble", category: "Folk Instrumental", durationSec: 32, fileUrl: "" },
      { id: "track-2", title: "Lake Palace Twilight Flute", artist: "Mewar Classical Strings", category: "Ambient Sitar", durationSec: 45, fileUrl: "" },
      { id: "track-3", title: "Royal Court Tabla & Shehnai", artist: "Ustad Rahim Khan", category: "Royal Classical", durationSec: 28, fileUrl: "" },
      { id: "track-4", title: "Pichhola Gentle Waves & Santoor", artist: "Heritage Soundscapes", category: "Nature & Strings", durationSec: 60, fileUrl: "" },
      { id: "track-5", title: "Ghoomar Festival Beats", artist: "Desert Rhythm Group", category: "Festive Beats", durationSec: 36, fileUrl: "" },
    ];
    const insertTrack = db.prepare("INSERT INTO media_audio_tracks (id, title, artist, category, duration_sec, file_url) VALUES (?, ?, ?, ?, ?, ?)");
    for (const t of tracks) {
      insertTrack.run(t.id, t.title, t.artist, t.category, t.durationSec, t.fileUrl);
    }
  }

  const profileCount = db.prepare("SELECT COUNT(*) AS c FROM media_user_profiles").pluck().get() as number;
  if (profileCount === 0) {
    const profiles = [
      {
        userId: "user-aarav",
        username: "aarav_explores",
        displayName: "Aarav Sharma",
        bio: "Documenting Mewar architecture, hidden stepwells and ghat sunrise vibes 📸✨",
        avatarUrl: "/media/placeholders/artisan-1.svg",
        travelInterests: JSON.stringify(["Heritage", "Architecture", "Sunset Chaser", "Stepwells"]),
        privacy: "public",
        website: "",
        updatedAt: new Date().toISOString(),
      },
      {
        userId: "user-priya",
        username: "priya_wanders",
        displayName: "Priya Rathore",
        bio: "Udaipur native · Curator of artisan stories & traditional miniature painting 🎨",
        avatarUrl: "/media/placeholders/artisan-2.svg",
        travelInterests: JSON.stringify(["Artisans", "Local Crafts", "Culture", "Folk Art"]),
        privacy: "public",
        website: "",
        updatedAt: new Date().toISOString(),
      },
      {
        userId: "user-dev",
        username: "dev_heritage",
        displayName: "Devendra Singh",
        bio: "Historian & photographer. Exploring living traditions around Lake Pichola 🏰",
        avatarUrl: "/media/places/city-palace-1.webp",
        travelInterests: JSON.stringify(["History", "Palaces", "Lakes", "Royal Legends"]),
        privacy: "public",
        website: "",
        updatedAt: new Date().toISOString(),
      },
    ];

    const insertProfile = db.prepare(
      "INSERT INTO media_user_profiles (user_id, username, display_name, bio, avatar_url, travel_interests, privacy, website, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const p of profiles) {
      insertProfile.run(p.userId, p.username, p.displayName, p.bio, p.avatarUrl, p.travelInterests, p.privacy, p.website, p.updatedAt);
    }
  }

  const postCount = db.prepare("SELECT COUNT(*) AS c FROM media_posts").pluck().get() as number;
  if (postCount === 0) {
    const initialPosts = [
      {
        id: "post-city-palace-reel",
        user_id: "user-aarav",
        username: "aarav_explores",
        user_name: "Aarav Sharma",
        user_avatar: "/media/placeholders/artisan-1.svg",
        media_type: "reel",
        media_url: "/media/places/city-palace-1.webp",
        thumbnail_url: "/media/places/city-palace-1.webp",
        caption: "Golden light casting shadows across the Manek Chowk arches at City Palace. Every stone here whispers centuries of Mewar pride. #CityPalace #Udaipur #MewarHeritage #GoldenHour",
        place_id: "city-palace",
        place_name: "City Palace, Udaipur",
        hashtags: JSON.stringify(["#CityPalace", "#Udaipur", "#MewarHeritage", "#GoldenHour"]),
        mentions: JSON.stringify(["@dev_heritage"]),
        audio_id: "track-1",
        audio_title: "Kesariya Balam (Sarangi Melody)",
        ar_config: JSON.stringify({
          modelType: "marble_arch",
          overlayType: "royal_banner",
          historicalYear: 1559,
          description: "Founded by Maharana Udai Singh II on the banks of Lake Pichola.",
        }),
        vr_panorama_url: "/media/places/city-palace-2.webp",
        views_count: 1420,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: "post-pichhola-vr",
        user_id: "user-dev",
        username: "dev_heritage",
        user_name: "Devendra Singh",
        user_avatar: "/media/places/city-palace-1.webp",
        media_type: "vr_360",
        media_url: "/media/pichhola/palace-wide.webp",
        thumbnail_url: "/media/pichhola/palace-wide.webp",
        caption: "360° sunset panoramic from the calm waters of Lake Pichola looking at Jag Mandir and the illuminated ridges. Swipe to rotate around the tranquil lake. #LakePichola #Udaipur360 #VRHeritage #SunsetView",
        place_id: "pichhola",
        place_name: "Lake Pichola",
        hashtags: JSON.stringify(["#LakePichola", "#Udaipur360", "#VRHeritage", "#SunsetView"]),
        mentions: JSON.stringify(["@aarav_explores", "@priya_wanders"]),
        audio_id: "track-4",
        audio_title: "Pichhola Gentle Waves & Santoor",
        ar_config: JSON.stringify({
          hotspots: [
            { title: "Jag Mandir Island Palace", description: "Built in 1620, served as inspiration for the Taj Mahal.", pitch: 5, yaw: 120 },
            { title: "City Palace Complex", description: "A contiguous façade stretching over 244 meters.", pitch: 10, yaw: -45 },
          ],
        }),
        vr_panorama_url: "/media/pichhola/palace-wide.webp",
        views_count: 2890,
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: "post-bagore-story",
        user_id: "user-priya",
        username: "priya_wanders",
        user_name: "Priya Rathore",
        user_avatar: "/media/placeholders/artisan-2.svg",
        media_type: "ar_story",
        media_url: "/media/places/bagore-ki-haveli-1.webp",
        thumbnail_url: "/media/places/bagore-ki-haveli-1.webp",
        caption: "Step into Bagore Ki Haveli at Gangaur Ghat. Experience our interactive AR story overlay revealing 18th-century court costumes and royal puppets! #BagoreKiHaveli #ARStory #UdaipurPuppets #GangaurGhat",
        place_id: "bagore-ki-haveli",
        place_name: "Bagore Ki Haveli",
        hashtags: JSON.stringify(["#BagoreKiHaveli", "#ARStory", "#UdaipurPuppets", "#GangaurGhat"]),
        mentions: JSON.stringify([]),
        audio_id: "track-5",
        audio_title: "Ghoomar Festival Beats",
        ar_config: JSON.stringify({
          modelType: "royal_puppet",
          historicalYear: 1750,
          description: "Built by Amar Chand Badwa, Prime Minister of Mewar, containing 138 ornate rooms.",
        }),
        vr_panorama_url: null,
        views_count: 980,
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
      {
        id: "post-saheliyon-photo",
        user_id: "user-priya",
        username: "priya_wanders",
        user_name: "Priya Rathore",
        user_avatar: "/media/placeholders/artisan-2.svg",
        media_type: "photo",
        media_url: "/media/places/saheliyon-ki-bari-1.webp",
        thumbnail_url: "/media/places/saheliyon-ki-bari-1.webp",
        caption: "Marble elephants, sculpted lotus pools, and rain-fountains engineered in 1710 without pumps — powered entirely by gravity from Fateh Sagar Lake! #SaheliyonKiBari #AncientEngineering #RoyalGardens #Udaipur",
        place_id: "saheliyon-ki-bari",
        place_name: "Saheliyon Ki Bari",
        hashtags: JSON.stringify(["#SaheliyonKiBari", "#AncientEngineering", "#RoyalGardens", "#Udaipur"]),
        mentions: JSON.stringify(["@aarav_explores"]),
        audio_id: "track-2",
        audio_title: "Lake Palace Twilight Flute",
        ar_config: null,
        vr_panorama_url: null,
        views_count: 1650,
        created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
      },
      {
        id: "post-sajjangarh-reel",
        user_id: "user-aarav",
        username: "aarav_explores",
        user_name: "Aarav Sharma",
        user_avatar: "/media/placeholders/artisan-1.svg",
        media_type: "reel",
        media_url: "/media/places/sajjangarh-1.webp",
        thumbnail_url: "/media/places/sajjangarh-1.webp",
        caption: "Perched high on Bansdara peak at 3,100 feet above sea level. Sajjangarh Monsoon Palace watching over the Aravalli mountains as dusk falls. #MonsoonPalace #Sajjangarh #UdaipurReels #MountainVibes",
        place_id: "sajjangarh",
        place_name: "Monsoon Palace (Sajjangarh)",
        hashtags: JSON.stringify(["#MonsoonPalace", "#Sajjangarh", "#UdaipurReels", "#MountainVibes"]),
        mentions: JSON.stringify([]),
        audio_id: "track-3",
        audio_title: "Royal Court Tabla & Shehnai",
        ar_config: JSON.stringify({
          modelType: "palace_astronomy",
          historicalYear: 1884,
          description: "Conceived by Maharana Sajjan Singh as an astronomical observatory and monsoon retreat.",
        }),
        vr_panorama_url: "/media/places/sajjangarh-2.webp",
        views_count: 3120,
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
    ];

    const insertPost = db.prepare(`
      INSERT INTO media_posts (
        id, user_id, username, user_name, user_avatar, media_type, media_url, thumbnail_url,
        caption, place_id, place_name, hashtags, mentions, audio_id, audio_title, ar_config,
        vr_panorama_url, views_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const post of initialPosts) {
      insertPost.run(
        post.id,
        post.user_id,
        post.username,
        post.user_name,
        post.user_avatar,
        post.media_type,
        post.media_url,
        post.thumbnail_url,
        post.caption,
        post.place_id,
        post.place_name,
        post.hashtags,
        post.mentions,
        post.audio_id,
        post.audio_title,
        post.ar_config,
        post.vr_panorama_url,
        post.views_count,
        post.created_at
      );
    }

    // Seed sample likes
    db.prepare("INSERT OR IGNORE INTO media_likes (user_id, post_id, created_at) VALUES (?, ?, ?)").run("user-priya", "post-city-palace-reel", new Date().toISOString());
    db.prepare("INSERT OR IGNORE INTO media_likes (user_id, post_id, created_at) VALUES (?, ?, ?)").run("user-dev", "post-city-palace-reel", new Date().toISOString());
    db.prepare("INSERT OR IGNORE INTO media_likes (user_id, post_id, created_at) VALUES (?, ?, ?)").run("user-aarav", "post-pichhola-vr", new Date().toISOString());

    // Seed sample comments
    db.prepare(
      "INSERT INTO media_comments (id, post_id, user_id, username, user_name, user_avatar, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      "comment-1",
      "post-city-palace-reel",
      "user-priya",
      "priya_wanders",
      "Priya Rathore",
      "/media/placeholders/artisan-2.svg",
      "The stone jharokhas during sunset are simply breathtaking! Must visit around 5:30 PM.",
      new Date().toISOString()
    );

    db.prepare(
      "INSERT INTO media_comments (id, post_id, user_id, username, user_name, user_avatar, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      "comment-2",
      "post-pichhola-vr",
      "user-aarav",
      "aarav_explores",
      "Aarav Sharma",
      "/media/placeholders/artisan-1.svg",
      "This 360 view captures the reflection of Jag Mandir so vividly. Beautiful work Devendra!",
      new Date().toISOString()
    );

    // Seed sample follows
    db.prepare("INSERT OR IGNORE INTO media_follows (follower_id, target_id, created_at) VALUES (?, ?, ?)").run("user-aarav", "user-priya", new Date().toISOString());
    db.prepare("INSERT OR IGNORE INTO media_follows (follower_id, target_id, created_at) VALUES (?, ?, ?)").run("user-priya", "user-aarav", new Date().toISOString());
    db.prepare("INSERT OR IGNORE INTO media_follows (follower_id, target_id, created_at) VALUES (?, ?, ?)").run("user-dev", "user-aarav", new Date().toISOString());

    // Seed sample notification
    db.prepare(`
      INSERT INTO media_notifications (id, user_id, actor_id, actor_username, actor_name, actor_avatar, type, post_id, message, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "notif-1",
      "user-aarav",
      "user-priya",
      "priya_wanders",
      "Priya Rathore",
      "/media/placeholders/artisan-2.svg",
      "comment",
      "post-city-palace-reel",
      "commented: 'The stone jharokhas during sunset are simply breathtaking!'",
      0,
      new Date().toISOString()
    );
  }
}

export function queryFeed(
  viewerId?: string,
  options: {
    mediaType?: string;
    hashtag?: string;
    placeId?: string;
    searchQuery?: string;
    userId?: string;
    limit?: number;
    offset?: number;
    demo?: boolean;
  } = {}
): { posts: MediaPost[]; total: number } {
  const db = getMediaDb();
  const vId = viewerId ?? "";
  const limit = Math.min(100, Math.max(1, Math.floor(options.limit ?? 20)));
  const offset = Math.max(0, Math.floor(options.offset ?? 0));

  const params: Record<string, unknown> = { vId, limit, offset };
  const conditions: string[] = [visibleSql("p", { viewerId, demo: options.demo === true }, params)];

  if (options.mediaType && options.mediaType !== "all") {
    conditions.push("p.media_type = @mediaType");
    params.mediaType = options.mediaType;
  }

  if (options.userId) {
    conditions.push("p.user_id = @userId");
    params.userId = options.userId;
  }

  if (options.placeId) {
    conditions.push("p.place_id = @placeId");
    params.placeId = options.placeId;
  }

  if (options.hashtag) {
    const tag = options.hashtag.startsWith("#") ? options.hashtag : `#${options.hashtag}`;
    conditions.push("p.hashtags LIKE @hashtag ESCAPE '\\'");
    params.hashtag = `%"${likeEscape(tag.slice(0, 60))}"%`;
  }

  if (options.searchQuery && options.searchQuery.trim()) {
    conditions.push("(p.caption LIKE @searchQuery ESCAPE '\\' OR p.place_name LIKE @searchQuery ESCAPE '\\' OR p.user_name LIKE @searchQuery ESCAPE '\\' OR p.username LIKE @searchQuery ESCAPE '\\' OR p.hashtags LIKE @searchQuery ESCAPE '\\')");
    params.searchQuery = `%${likeEscape(options.searchQuery.trim().slice(0, 80))}%`;
  }

  const whereClause = conditions.join(" AND ");

  const total = db.prepare(`SELECT COUNT(*) AS c FROM media_posts p WHERE ${whereClause}`).get(params) as { c: number };

  const sql = `
    SELECT 
      p.id,
      p.user_id AS userId,
      p.username,
      p.user_name AS userName,
      p.user_avatar AS userAvatar,
      p.media_type AS mediaType,
      p.media_url AS mediaUrl,
      p.thumbnail_url AS thumbnailUrl,
      p.caption,
      p.place_id AS placeId,
      p.place_name AS placeName,
      p.hashtags,
      p.mentions,
      p.audio_id AS audioId,
      p.audio_title AS audioTitle,
      p.ar_config AS arConfig,
      p.vr_panorama_url AS vrPanoramaUrl,
      p.views_count AS viewsCount,
      p.created_at AS createdAt,
      (SELECT COUNT(*) FROM media_likes l WHERE l.post_id = p.id) AS likesCount,
      (SELECT COUNT(*) FROM media_comments c WHERE c.post_id = p.id) AS commentsCount,
      EXISTS(SELECT 1 FROM media_likes l WHERE l.post_id = p.id AND l.user_id = @vId) AS isLiked,
      EXISTS(SELECT 1 FROM media_saved s WHERE s.post_id = p.id AND s.user_id = @vId) AS isSaved,
      EXISTS(SELECT 1 FROM media_follows f WHERE f.follower_id = @vId AND f.target_id = p.user_id) AS isFollowingAuthor
    FROM media_posts p
    WHERE ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT @limit OFFSET @offset
  `;

  const rows = db.prepare(sql).all(params) as PostRow[];

  const posts: MediaPost[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    username: r.username,
    userName: r.userName,
    userAvatar: r.userAvatar,
    mediaType: r.mediaType,
    mediaUrl: r.mediaUrl,
    thumbnailUrl: r.thumbnailUrl,
    caption: r.caption,
    placeId: r.placeId,
    placeName: r.placeName,
    hashtags: JSON.parse(r.hashtags || "[]"),
    mentions: JSON.parse(r.mentions || "[]"),
    audioId: r.audioId,
    audioTitle: r.audioTitle,
    arConfig: r.arConfig ? JSON.parse(r.arConfig) : null,
    vrPanoramaUrl: r.vrPanoramaUrl,
    viewsCount: r.viewsCount,
    likesCount: Number(r.likesCount),
    commentsCount: Number(r.commentsCount),
    isLiked: Boolean(r.isLiked),
    isSaved: Boolean(r.isSaved),
    isFollowingAuthor: Boolean(r.isFollowingAuthor),
    createdAt: r.createdAt,
  }));

  return { posts, total: total.c };
}

export function queryReels(viewerId?: string, limit = 30, demo = false): MediaPost[] {
  const result = queryFeed(viewerId, { mediaType: "reel", limit, demo });
  return result.posts;
}

export function getPost(postId: string, viewerId?: string, demo = false): MediaPost | null {
  const db = getMediaDb();
  const vId = viewerId ?? "";
  const params: Record<string, unknown> = { postId, vId };
  const visible = visibleSql("p", { viewerId, demo }, params);
  const sql = `
    SELECT 
      p.id,
      p.user_id AS userId,
      p.username,
      p.user_name AS userName,
      p.user_avatar AS userAvatar,
      p.media_type AS mediaType,
      p.media_url AS mediaUrl,
      p.thumbnail_url AS thumbnailUrl,
      p.caption,
      p.place_id AS placeId,
      p.place_name AS placeName,
      p.hashtags,
      p.mentions,
      p.audio_id AS audioId,
      p.audio_title AS audioTitle,
      p.ar_config AS arConfig,
      p.vr_panorama_url AS vrPanoramaUrl,
      p.views_count AS viewsCount,
      p.created_at AS createdAt,
      (SELECT COUNT(*) FROM media_likes l WHERE l.post_id = p.id) AS likesCount,
      (SELECT COUNT(*) FROM media_comments c WHERE c.post_id = p.id) AS commentsCount,
      EXISTS(SELECT 1 FROM media_likes l WHERE l.post_id = p.id AND l.user_id = @vId) AS isLiked,
      EXISTS(SELECT 1 FROM media_saved s WHERE s.post_id = p.id AND s.user_id = @vId) AS isSaved,
      EXISTS(SELECT 1 FROM media_follows f WHERE f.follower_id = @vId AND f.target_id = p.user_id) AS isFollowingAuthor
    FROM media_posts p
    WHERE p.id = @postId AND ${visible}
  `;

  const r = db.prepare(sql).get(params) as PostRow | undefined;
  if (!r) return null;

  return {
    id: r.id,
    userId: r.userId,
    username: r.username,
    userName: r.userName,
    userAvatar: r.userAvatar,
    mediaType: r.mediaType,
    mediaUrl: r.mediaUrl,
    thumbnailUrl: r.thumbnailUrl,
    caption: r.caption,
    placeId: r.placeId,
    placeName: r.placeName,
    hashtags: JSON.parse(r.hashtags || "[]"),
    mentions: JSON.parse(r.mentions || "[]"),
    audioId: r.audioId,
    audioTitle: r.audioTitle,
    arConfig: r.arConfig ? JSON.parse(r.arConfig) : null,
    vrPanoramaUrl: r.vrPanoramaUrl,
    viewsCount: r.viewsCount,
    likesCount: Number(r.likesCount),
    commentsCount: Number(r.commentsCount),
    isLiked: Boolean(r.isLiked),
    isSaved: Boolean(r.isSaved),
    isFollowingAuthor: Boolean(r.isFollowingAuthor),
    createdAt: r.createdAt,
  };
}

export function createMediaPost(data: {
  userId: string;
  username: string;
  userName: string;
  userAvatar?: string | null;
  mediaType: "photo" | "video" | "reel" | "ar_story" | "vr_360";
  mediaUrl: string;
  thumbnailUrl?: string | null;
  caption: string;
  placeId?: string | null;
  placeName?: string | null;
  hashtags?: string[];
  mentions?: string[];
  audioId?: string | null;
  audioTitle?: string | null;
  arConfig?: unknown;
  vrPanoramaUrl?: string | null;
}): string {
  const db = getMediaDb();
  const id = `post-${randomUUID()}`;
  const now = new Date().toISOString();

  // Extract hashtags & mentions automatically if not explicitly given
  const extractedHashtags = data.hashtags && data.hashtags.length > 0 ? data.hashtags : (data.caption.match(/#[a-zA-Z0-9_\u0900-\u097F]+/g) || []);
  const extractedMentions = data.mentions && data.mentions.length > 0 ? data.mentions : (data.caption.match(/@[a-zA-Z0-9_]+/g) || []);

  db.prepare(`
    INSERT INTO media_posts (
      id, user_id, username, user_name, user_avatar, media_type, media_url,
      thumbnail_url, caption, place_id, place_name, hashtags, mentions, audio_id,
      audio_title, ar_config, vr_panorama_url, views_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    id,
    data.userId,
    data.username,
    data.userName,
    data.userAvatar ?? null,
    data.mediaType,
    data.mediaUrl,
    data.thumbnailUrl ?? null,
    data.caption,
    data.placeId ?? null,
    data.placeName ?? null,
    JSON.stringify(extractedHashtags),
    JSON.stringify(extractedMentions),
    data.audioId ?? null,
    data.audioTitle ?? null,
    data.arConfig ? JSON.stringify(data.arConfig) : null,
    data.vrPanoramaUrl ?? null,
    now
  );

  return id;
}

export function toggleMediaLike(userId: string, postId: string): { isLiked: boolean; count: number } {
  const db = getMediaDb();
  const existing = db.prepare("SELECT 1 FROM media_likes WHERE user_id = ? AND post_id = ?").get(userId, postId);

  if (existing) {
    db.prepare("DELETE FROM media_likes WHERE user_id = ? AND post_id = ?").run(userId, postId);
  } else {
    db.prepare("INSERT INTO media_likes (user_id, post_id, created_at) VALUES (?, ?, ?)").run(userId, postId, new Date().toISOString());

    // Send notification to post author if not self
    const post = db.prepare("SELECT user_id FROM media_posts WHERE id = ?").get(postId) as { user_id: string } | undefined;
    if (post && post.user_id !== userId) {
      const actor = db.prepare("SELECT username, display_name, avatar_url FROM media_user_profiles WHERE user_id = ?").get(userId) as ActorRow;
      db.prepare(`
        INSERT INTO media_notifications (id, user_id, actor_id, actor_username, actor_name, actor_avatar, type, post_id, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'like', ?, 'liked your post', ?)
      `).run(
        `notif-${randomUUID()}`,
        post.user_id,
        userId,
        actor?.username || "traveller",
        actor?.display_name || "Miras Traveller",
        actor?.avatar_url || null,
        postId,
        new Date().toISOString()
      );
    }
  }

  const count = db.prepare("SELECT COUNT(*) AS c FROM media_likes WHERE post_id = ?").pluck().get(postId) as number;
  return { isLiked: !existing, count };
}

export function toggleMediaSave(userId: string, postId: string): { isSaved: boolean } {
  const db = getMediaDb();
  const existing = db.prepare("SELECT 1 FROM media_saved WHERE user_id = ? AND post_id = ?").get(userId, postId);

  if (existing) {
    db.prepare("DELETE FROM media_saved WHERE user_id = ? AND post_id = ?").run(userId, postId);
  } else {
    db.prepare("INSERT INTO media_saved (user_id, post_id, created_at) VALUES (?, ?, ?)").run(userId, postId, new Date().toISOString());
  }

  return { isSaved: !existing };
}

export function addMediaComment(
  postId: string,
  userId: string,
  username: string,
  userName: string,
  userAvatar: string | null,
  text: string
): MediaComment {
  const db = getMediaDb();
  const id = `comment-${randomUUID()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO media_comments (id, post_id, user_id, username, user_name, user_avatar, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, postId, userId, username, userName, userAvatar ?? null, text.trim(), now);

  // Send notification to post author if not self
  const post = db.prepare("SELECT user_id FROM media_posts WHERE id = ?").get(postId) as { user_id: string } | undefined;
  if (post && post.user_id !== userId) {
    db.prepare(`
      INSERT INTO media_notifications (id, user_id, actor_id, actor_username, actor_name, actor_avatar, type, post_id, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'comment', ?, ?, ?)
    `).run(
      `notif-${randomUUID()}`,
      post.user_id,
      userId,
      username,
      userName,
      userAvatar ?? null,
      postId,
      `commented: "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"`,
      now
    );
  }

  return {
    id,
    postId,
    userId,
    username,
    userName,
    userAvatar,
    text: text.trim(),
    createdAt: now,
  };
}

export function getMediaComments(postId: string): MediaComment[] {
  const db = getMediaDb();
  const rows = db.prepare(`
    SELECT id, post_id AS postId, user_id AS userId, username, user_name AS userName, user_avatar AS userAvatar, text, created_at AS createdAt
    FROM media_comments
    WHERE post_id = ?
    ORDER BY created_at ASC
  `).all(postId) as MediaComment[];

  return rows.map((r) => ({
    id: r.id,
    postId: r.postId,
    userId: r.userId,
    username: r.username,
    userName: r.userName,
    userAvatar: r.userAvatar,
    text: r.text,
    createdAt: r.createdAt,
  }));
}

export function deleteMediaComment(commentId: string, userId: string): boolean {
  const db = getMediaDb();
  const res = db.prepare("DELETE FROM media_comments WHERE id = ? AND user_id = ?").run(commentId, userId);
  return res.changes > 0;
}

export function toggleMediaFollow(followerId: string, targetId: string): { isFollowing: boolean } {
  if (followerId === targetId) throw new Error("Cannot follow yourself.");
  const db = getMediaDb();
  const existing = db.prepare("SELECT 1 FROM media_follows WHERE follower_id = ? AND target_id = ?").get(followerId, targetId);

  if (existing) {
    db.prepare("DELETE FROM media_follows WHERE follower_id = ? AND target_id = ?").run(followerId, targetId);
  } else {
    db.prepare("INSERT INTO media_follows (follower_id, target_id, created_at) VALUES (?, ?, ?)").run(followerId, targetId, new Date().toISOString());

    // Notification
    const actor = db.prepare("SELECT username, display_name, avatar_url FROM media_user_profiles WHERE user_id = ?").get(followerId) as ActorRow;
    db.prepare(`
      INSERT INTO media_notifications (id, user_id, actor_id, actor_username, actor_name, actor_avatar, type, post_id, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'follow', NULL, 'started following you', ?)
    `).run(
      `notif-${randomUUID()}`,
      targetId,
      followerId,
      actor?.username || "traveller",
      actor?.display_name || "Miras Traveller",
      actor?.avatar_url || null,
      new Date().toISOString()
    );
  }

  return { isFollowing: !existing };
}

export function getMediaUserProfile(username: string, viewerId?: string, demo = false): (MediaUserProfile & { posts: MediaPost[]; saved: MediaPost[] }) | null {
  const db = getMediaDb();
  const profileRow = db.prepare("SELECT * FROM media_user_profiles WHERE username = ? COLLATE NOCASE").get(username) as ProfileRow | undefined;
  if (!profileRow) return null;
  if (isSeedUser(profileRow.user_id) ? !demo : !viewerId) return null;

  const vId = viewerId ?? "";
  const isFollowing = vId ? Boolean(db.prepare("SELECT 1 FROM media_follows WHERE follower_id = ? AND target_id = ?").get(vId, profileRow.user_id)) : false;

  const userPosts = queryFeed(viewerId, { userId: profileRow.user_id, limit: 100, demo }).posts;
  const userReels = userPosts.filter((p) => p.mediaType === "reel");

  // Get saved posts for this viewer if viewing their own profile
  const savedPosts: MediaPost[] = [];
  if (vId === profileRow.user_id) {
    const savedIds = db.prepare("SELECT post_id FROM media_saved WHERE user_id = ? ORDER BY created_at DESC").pluck().all(vId) as string[];
    for (const sid of savedIds) {
      const p = getPost(sid, vId, demo);
      if (p) savedPosts.push(p);
    }
  }

  const followersCount = db.prepare("SELECT COUNT(*) AS c FROM media_follows WHERE target_id = ?").pluck().get(profileRow.user_id) as number;
  const followingCount = db.prepare("SELECT COUNT(*) AS c FROM media_follows WHERE follower_id = ?").pluck().get(profileRow.user_id) as number;

  return {
    userId: profileRow.user_id,
    username: profileRow.username,
    displayName: profileRow.display_name,
    bio: profileRow.bio || "",
    avatarUrl: profileRow.avatar_url || null,
    travelInterests: JSON.parse(profileRow.travel_interests || "[]"),
    privacy: profileRow.privacy,
    website: profileRow.website || "",
    postsCount: userPosts.length,
    reelsCount: userReels.length,
    followersCount,
    followingCount,
    isFollowing,
    posts: userPosts,
    saved: savedPosts,
  };
}

export function upsertMediaUserProfile(data: {
  userId: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string | null;
  travelInterests?: string[];
  privacy?: "public" | "private";
  website?: string;
}): MediaUserProfile {
  const db = getMediaDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO media_user_profiles (user_id, username, display_name, bio, avatar_url, travel_interests, privacy, website, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username,
      display_name = excluded.display_name,
      bio = excluded.bio,
      avatar_url = COALESCE(excluded.avatar_url, media_user_profiles.avatar_url),
      travel_interests = excluded.travel_interests,
      privacy = excluded.privacy,
      website = excluded.website,
      updated_at = excluded.updated_at
  `).run(
    data.userId,
    data.username,
    data.displayName,
    data.bio || "",
    data.avatarUrl ?? null,
    JSON.stringify(data.travelInterests || []),
    data.privacy || "public",
    data.website || "",
    now
  );

  return {
    userId: data.userId,
    username: data.username,
    displayName: data.displayName,
    bio: data.bio || "",
    avatarUrl: data.avatarUrl ?? null,
    travelInterests: data.travelInterests || [],
    privacy: data.privacy || "public",
    website: data.website || "",
    postsCount: 0,
    reelsCount: 0,
    followersCount: 0,
    followingCount: 0,
  };
}

export function getFollowList(userId: string, type: "followers" | "following"): { userId: string; username: string; displayName: string; avatarUrl: string | null }[] {
  const db = getMediaDb();
  const sql =
    type === "followers"
      ? `SELECT p.user_id AS userId, p.username, p.display_name AS displayName, p.avatar_url AS avatarUrl
         FROM media_follows f
         JOIN media_user_profiles p ON p.user_id = f.follower_id
         WHERE f.target_id = ?`
      : `SELECT p.user_id AS userId, p.username, p.display_name AS displayName, p.avatar_url AS avatarUrl
         FROM media_follows f
         JOIN media_user_profiles p ON p.user_id = f.target_id
         WHERE f.follower_id = ?`;

  return db.prepare(sql).all(userId) as { userId: string; username: string; displayName: string; avatarUrl: string | null }[];
}

export function getMediaNotifications(userId: string): MediaNotification[] {
  const db = getMediaDb();
  const rows = db.prepare(`
    SELECT id, user_id AS userId, actor_id AS actorId, actor_username AS actorUsername, actor_name AS actorName,
           actor_avatar AS actorAvatar, type, post_id AS postId, message, is_read AS isRead, created_at AS createdAt
    FROM media_notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(userId) as NotificationRow[];

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    actorId: r.actorId,
    actorUsername: r.actorUsername,
    actorName: r.actorName,
    actorAvatar: r.actorAvatar,
    type: r.type,
    postId: r.postId,
    message: r.message,
    isRead: Boolean(r.isRead),
    createdAt: r.createdAt,
  }));
}

export function markMediaNotificationsRead(userId: string): void {
  const db = getMediaDb();
  db.prepare("UPDATE media_notifications SET is_read = 1 WHERE user_id = ?").run(userId);
}

export function getMediaAudioTracks(): MediaAudioTrack[] {
  const db = getMediaDb();
  return db.prepare("SELECT id, title, artist, category, duration_sec AS durationSec, file_url AS fileUrl FROM media_audio_tracks").all() as MediaAudioTrack[];
}


/** Creates the member's media profile the first time they use Media, so they can post, be followed and be found. */
export function ensureMediaProfile(userId: string, username: string, displayName: string): void {
  getMediaDb()
    .prepare("INSERT OR IGNORE INTO media_user_profiles (user_id, username, display_name, bio, avatar_url, travel_interests, privacy, website, updated_at) VALUES (?, ?, ?, '', NULL, '[]', 'public', '', ?)")
    .run(userId, username, displayName, new Date().toISOString());
}

/** A profile someone may follow: it exists, and it is a sample only in demo mode. */
export function isFollowable(targetId: string, demo: boolean): boolean {
  if (isSeedUser(targetId) && !demo) return false;
  return Boolean(getMediaDb().prepare("SELECT 1 FROM media_user_profiles WHERE user_id = ?").get(targetId));
}

const OWN_FILE = /^\/api\/media-social\/file\/([a-z0-9-]+\.(?:jpg|png|webp|mp4|webm|mov))$/;

/** The uploaded file names a set of post rows point at (static /media/... paths are not ours to delete). */
function uploadedFiles(rows: { media_url: string; thumbnail_url: string | null; vr_panorama_url: string | null }[]): string[] {
  const names = new Set<string>();
  for (const r of rows) for (const u of [r.media_url, r.thumbnail_url, r.vr_panorama_url]) {
    const m = u ? OWN_FILE.exec(u) : null;
    if (m) names.add(m[1]);
  }
  return [...names];
}

/** True when a post still points at this uploaded file (used before unlinking it). */
export function isUploadedFileInUse(name: string): boolean {
  const url = `/api/media-social/file/${name}`;
  return Boolean(getMediaDb().prepare("SELECT 1 FROM media_posts WHERE media_url = ? OR thumbnail_url = ? OR vr_panorama_url = ? LIMIT 1").get(url, url, url));
}

/** True when the uploaded file belongs to a post this viewer may see, so the file route applies the same audience rules. */
export function canSeeUploadedFile(name: string, audience: Audience): boolean {
  const url = `/api/media-social/file/${name}`;
  const ids = getMediaDb().prepare("SELECT id FROM media_posts WHERE media_url = ? OR thumbnail_url = ? OR vr_panorama_url = ?").pluck().all(url, url, url) as string[];
  return ids.some((id) => getPost(id, audience.viewerId ?? undefined, audience.demo) !== null);
}

function removePostRows(db: Db, ids: string[]): void {
  for (const sql of [
    "DELETE FROM media_likes WHERE post_id = ?",
    "DELETE FROM media_comments WHERE post_id = ?",
    "DELETE FROM media_saved WHERE post_id = ?",
    "DELETE FROM media_notifications WHERE post_id = ?",
    "DELETE FROM media_posts WHERE id = ?",
  ]) for (const id of ids) db.prepare(sql).run(id);
}

/** Deletes the author's own post and its likes, comments and notifications. Returns the uploaded files now unused, or null if it is not theirs. */
export function deleteMediaPost(postId: string, userId: string): string[] | null {
  const db = getMediaDb();
  const row = db.prepare("SELECT media_url, thumbnail_url, vr_panorama_url FROM media_posts WHERE id = ? AND user_id = ?").get(postId, userId) as
    | { media_url: string; thumbnail_url: string | null; vr_panorama_url: string | null }
    | undefined;
  if (!row) return null;
  db.transaction(() => removePostRows(db, [postId]))();
  return uploadedFiles([row]).filter((name) => !isUploadedFileInUse(name));
}

/** Removes everything a member made in Media (posts, comments, likes, follows, notifications, profile). Returns their uploaded files. */
export function deleteMediaDataForUser(userId: string): string[] {
  const db = getMediaDb();
  const posts = db.prepare("SELECT id, media_url, thumbnail_url, vr_panorama_url FROM media_posts WHERE user_id = ?").all(userId) as {
    id: string; media_url: string; thumbnail_url: string | null; vr_panorama_url: string | null;
  }[];
  db.transaction(() => {
    removePostRows(db, posts.map((p) => p.id));
    db.prepare("DELETE FROM media_likes WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM media_comments WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM media_saved WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM media_follows WHERE follower_id = ? OR target_id = ?").run(userId, userId);
    db.prepare("DELETE FROM media_notifications WHERE user_id = ? OR actor_id = ?").run(userId, userId);
    db.prepare("DELETE FROM media_user_profiles WHERE user_id = ?").run(userId);
  })();
  return uploadedFiles(posts).filter((name) => !isUploadedFileInUse(name));
}
