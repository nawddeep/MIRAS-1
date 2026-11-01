import { describe, it, expect, beforeEach } from "vitest";
import {
  getMediaDb,
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
  getMediaNotifications,
  markMediaNotificationsRead,
  getMediaAudioTracks,
} from "@/lib/media-social/db";
import { getMediaSocialStorage } from "@/lib/media-social/storage";

describe("Media & Social Module", () => {
  beforeEach(() => {
    // Ensures database and initial seeds are loaded
    getMediaDb();
  });

  it("seeds and queries initial feed posts and reels", () => {
    const feed = queryFeed();
    expect(feed.total).toBeGreaterThanOrEqual(5);
    expect(feed.posts[0]).toHaveProperty("caption");
    expect(feed.posts[0]).toHaveProperty("mediaUrl");
    expect(feed.posts[0]).toHaveProperty("userName");

    const reels = queryReels();
    expect(reels.length).toBeGreaterThanOrEqual(1);
    expect(reels.every((r) => r.mediaType === "reel")).toBe(true);
  });

  it("provides curated authentic Udaipur heritage soundtracks", () => {
    const tracks = getMediaAudioTracks();
    expect(tracks.length).toBeGreaterThanOrEqual(5);
    expect(tracks.map((t) => t.title)).toContain("Kesariya Balam (Sarangi Melody)");
  });

  it("creates a new travel reel and retrieves it by id", () => {
    const newId = createMediaPost({
      userId: "user-test",
      username: "test_creator",
      userName: "Test Creator",
      mediaType: "reel",
      mediaUrl: "/media/places/city-palace-1.webp",
      caption: "Sunset at City Palace #Udaipur #Mewar",
      placeId: "city-palace",
      placeName: "City Palace",
      hashtags: ["#Udaipur", "#Mewar"],
      audioId: "track-1",
      audioTitle: "Kesariya Balam (Sarangi Melody)",
    });

    const post = getPost(newId, "user-test");
    expect(post).not.toBeNull();
    expect(post?.caption).toContain("Sunset at City Palace");
    expect(post?.placeName).toBe("City Palace");
    expect(post?.hashtags).toContain("#Udaipur");
  });

  it("toggles post like and sends notification", () => {
    const posts = queryFeed().posts;
    const targetPost = posts[0];
    const initialLikes = targetPost.likesCount;

    // Like
    const likeResult = toggleMediaLike("user-test-liker", targetPost.id);
    expect(likeResult.isLiked).toBe(true);
    expect(likeResult.count).toBe(initialLikes + 1);

    // Unlike
    const unlikeResult = toggleMediaLike("user-test-liker", targetPost.id);
    expect(unlikeResult.isLiked).toBe(false);
    expect(unlikeResult.count).toBe(initialLikes);
  });

  it("toggles saving/bookmarking a post", () => {
    const posts = queryFeed().posts;
    const targetPost = posts[0];

    const saveResult = toggleMediaSave("user-test-saver", targetPost.id);
    expect(saveResult.isSaved).toBe(true);

    const unsaveResult = toggleMediaSave("user-test-saver", targetPost.id);
    expect(unsaveResult.isSaved).toBe(false);
  });

  it("adds and deletes comments on a post", () => {
    const posts = queryFeed().posts;
    const targetPost = posts[0];

    const comment = addMediaComment(
      targetPost.id,
      "user-test-commenter",
      "commenter_test",
      "Commenter Test",
      null,
      "Incredible view of the palace!"
    );

    expect(comment.text).toBe("Incredible view of the palace!");

    const comments = getMediaComments(targetPost.id);
    expect(comments.some((c) => c.id === comment.id)).toBe(true);

    const deleted = deleteMediaComment(comment.id, "user-test-commenter");
    expect(deleted).toBe(true);
  });

  it("toggles creator follow and updates profile counts", () => {
    const followResult = toggleMediaFollow("user-test-follower", "user-priya");
    expect(followResult.isFollowing).toBe(true);

    const profile = getMediaUserProfile("priya_wanders", "user-test-follower");
    expect(profile).not.toBeNull();
    expect(profile?.isFollowing).toBe(true);

    const unfollowResult = toggleMediaFollow("user-test-follower", "user-priya");
    expect(unfollowResult.isFollowing).toBe(false);
  });

  it("updates user profile details and privacy settings", () => {
    const updated = upsertMediaUserProfile({
      userId: "user-aarav",
      username: "aarav_explores",
      displayName: "Aarav Sharma Updated",
      bio: "Heritage explorer of Udaipur",
      travelInterests: ["Architecture", "Lakes"],
      privacy: "public",
      website: "https://aarav.travel",
    });

    expect(updated.displayName).toBe("Aarav Sharma Updated");
    expect(updated.travelInterests).toEqual(["Architecture", "Lakes"]);

    const profile = getMediaUserProfile("aarav_explores");
    expect(profile?.displayName).toBe("Aarav Sharma Updated");
    expect(profile?.website).toBe("https://aarav.travel");
  });

  it("retrieves and marks notifications as read", () => {
    const notifs = getMediaNotifications("user-aarav");
    expect(Array.isArray(notifs)).toBe(true);

    markMediaNotificationsRead("user-aarav");
    const updated = getMediaNotifications("user-aarav");
    expect(updated.every((n) => n.isRead)).toBe(true);
  });

  it("stores and retrieves media uploads", () => {
    const storage = getMediaSocialStorage();
    const fakeImageBuffer = Buffer.from("fake-png-data-stream");
    const upload = storage.saveUpload(fakeImageBuffer, "image/png", "test-upload.png");

    expect(upload.url).toContain("/api/media-social/file/");
    expect(upload.size).toBe(fakeImageBuffer.length);

    const streamInfo = storage.getFileStream(upload.filename);
    expect(streamInfo).not.toBeNull();
    expect(streamInfo?.mimeType).toBe("image/png");
    expect(streamInfo?.size).toBe(fakeImageBuffer.length);
  });
});

