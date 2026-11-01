"use client";

import Link from "next/link";
import { useState } from "react";
import type { MediaPost, MediaComment } from "@/lib/media-social/db";

interface FeedTabProps {
  posts: MediaPost[];
  currentUserId: string;
  onLike: (postId: string) => Promise<void>;
  onSave: (postId: string) => Promise<void>;
  onFollow: (targetId: string) => Promise<void>;
  onComment: (postId: string, text: string) => Promise<void>;
  onFilterHashtag: (tag: string) => void;
  onFilterPlace: (placeId: string) => void;
  onViewArVr: (post: MediaPost) => void;
  onViewProfile: (username: string) => void;
}

export function FeedTab({
  posts,
  currentUserId,
  onLike,
  onSave,
  onFollow,
  onComment,
  onFilterHashtag,
  onFilterPlace,
  onViewArVr,
  onViewProfile,
}: FeedTabProps) {
  const [selectedPostComments, setSelectedPostComments] = useState<{ post: MediaPost; comments: MediaComment[] } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [shareToast, setShareToast] = useState("");
  const [activeMediaFilter, setActiveMediaFilter] = useState<string>("all");

  async function openComments(post: MediaPost) {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/media-social?view=comments&postId=${post.id}`);
      const data = await res.json();
      setSelectedPostComments({ post, comments: data.comments || [] });
    } catch {
      setSelectedPostComments({ post, comments: [] });
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleAddComment() {
    if (!commentText.trim() || !selectedPostComments) return;
    await onComment(selectedPostComments.post.id, commentText);
    setCommentText("");
    // Refresh comments in sheet
    const res = await fetch(`/api/media-social?view=comments&postId=${selectedPostComments.post.id}`);
    const data = await res.json();
    setSelectedPostComments({
      post: {
        ...selectedPostComments.post,
        commentsCount: selectedPostComments.post.commentsCount + 1,
      },
      comments: data.comments || [],
    });
  }

  function handleShare(post: MediaPost) {
    const url = `${window.location.origin}/media?post=${post.id}`;
    if (navigator.share) {
      navigator.share({
        title: `MIRAS · ${post.userName} in Udaipur`,
        text: post.caption,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setShareToast("Link copied to clipboard!");
      setTimeout(() => setShareToast(""), 3000);
    }
  }

  const filteredPosts = posts.filter((p) => {
    if (activeMediaFilter === "all") return true;
    if (activeMediaFilter === "photos") return p.mediaType === "photo";
    if (activeMediaFilter === "reels") return p.mediaType === "reel" || p.mediaType === "video";
    if (activeMediaFilter === "ar_vr") return p.mediaType === "ar_story" || p.mediaType === "vr_360";
    return true;
  });

  return (
    <div className="mx-auto max-w-xl pb-24">
      {/* Stories live in their own feature */}
      <Link
        href="/ar-stories"
        className="mb-4 flex items-center justify-between gap-3 border-b border-ink/10 bg-white px-4 py-3 shadow-sm"
      >
        <span>
          <span className="block text-sm font-bold text-ink">Today&apos;s stories</span>
          <span className="block text-xs text-ink-soft">24-hour 360°, VR and AR stories from travellers</span>
        </span>
        <span aria-hidden className="text-lg text-saffron-text">→</span>
      </Link>

      {/* Filter Tabs */}
      <div className="mb-4 flex items-center justify-between px-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "All Posts" },
            { id: "photos", label: "📸 Photos" },
            { id: "reels", label: "🎬 Reels" },
            { id: "ar_vr", label: "🏛️ 360 & AR" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveMediaFilter(tab.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                activeMediaFilter === tab.id
                  ? "bg-ink-2 text-white shadow-sm"
                  : "bg-white text-ink-soft border border-ink/10 hover:bg-ink/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-soft font-medium">{filteredPosts.length} posts</span>
      </div>

      {/* Feed Posts List */}
      <div className="space-y-6 px-2 sm:px-0">
        {filteredPosts.map((post) => (
          <article
            key={post.id}
            className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm transition hover:shadow-md"
          >
            {/* Post Author Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 text-left">
                <button type="button" onClick={() => onViewProfile(post.username)} aria-label={`${post.userName}'s profile`} className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-ink/5 focus:outline-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.userAvatar || "/media/placeholders/artisan-1.svg"} alt="" className="h-full w-full object-cover" />
                </button>
                <div>
                  <button type="button" onClick={() => onViewProfile(post.username)} className="flex items-center gap-1 text-left focus:outline-none">
                    <span className="text-xs font-bold text-ink hover:underline">{post.userName}</span>
                    <span className="text-[11px] text-ink-soft font-normal">@{post.username}</span>
                  </button>
                  {post.placeName && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (post.placeId) onFilterPlace(post.placeId);
                      }}
                      className="flex items-center gap-0.5 text-[11px] font-medium text-saffron-text hover:underline"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M11.54 22.351A24.25 24.25 0 013 12c0-5.523 4.477-10 10-10s10 4.477 10 10a24.25 24.25 0 01-8.54 10.351c-.846.59-1.92.59-2.76 0zM12 15a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                      </svg>
                      <span>{post.placeName}</span>
                    </button>
                  )}
                </div>
              </div>

              {post.userId !== currentUserId && (
                <button
                  type="button"
                  onClick={() => onFollow(post.userId)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition active:scale-95 ${
                    post.isFollowingAuthor
                      ? "border border-ink/15 bg-ink/5 text-ink/80 hover:bg-ink/10"
                      : "bg-ink-2 text-white shadow-sm hover:bg-ink"
                  }`}
                >
                  {post.isFollowingAuthor ? "Following" : "+ Follow"}
                </button>
              )}
            </div>

            {/* Post Media Display */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-3 sm:aspect-[16/10]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.mediaUrl}
                alt={post.caption}
                className="h-full w-full object-cover transition duration-300 hover:scale-[1.01]"
              />

              {/* Media Type Badge */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                {post.mediaType === "reel" && (
                  <span className="flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                    <span>🎬 Reel</span>
                  </span>
                )}
                {post.mediaType === "vr_360" && (
                  <button
                    type="button"
                    onClick={() => onViewArVr(post)}
                    className="flex items-center gap-1 rounded-full bg-saffron-text px-2.5 py-1 text-[11px] font-semibold text-white shadow hover:bg-ink-2"
                  >
                    <span>🧭 View 360°</span>
                  </button>
                )}
                {post.mediaType === "ar_story" && (
                  <button
                    type="button"
                    onClick={() => onViewArVr(post)}
                    className="flex items-center gap-1 rounded-full bg-ink-2 px-2.5 py-1 text-[11px] font-semibold text-white shadow hover:bg-ink"
                  >
                    <span>✨ AR Story</span>
                  </button>
                )}
              </div>

              {/* Audio Pill if post has soundtrack */}
              {post.audioTitle && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                  <span className="animate-spin text-xs">🎵</span>
                  <span className="max-w-[180px] truncate">{post.audioTitle}</span>
                </div>
              )}
            </div>

            {/* Action Bar (Like, Comment, Share, Save) */}
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Like Button */}
                  <button
                    type="button"
                    onClick={() => onLike(post.id)}
                    className="group flex items-center gap-1.5 text-ink/80 transition active:scale-90"
                    aria-label={post.isLiked ? "Unlike post" : "Like post"}
                  >
                    <svg
                      className={`h-6 w-6 transition ${
                        post.isLiked ? "fill-saffron-text text-saffron-text scale-110" : "text-ink/80 group-hover:text-saffron-text"
                      }`}
                      viewBox="0 0 24 24"
                      fill={post.isLiked ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                      />
                    </svg>
                    <span className="text-xs font-bold text-ink">{post.likesCount}</span>
                  </button>

                  {/* Comment Button */}
                  <button
                    type="button"
                    onClick={() => openComments(post)}
                    className="group flex items-center gap-1.5 text-ink/80 transition active:scale-95"
                    aria-label="View comments"
                  >
                    <svg className="h-6 w-6 text-ink/80 group-hover:text-saffron-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                    </svg>
                    <span className="text-xs font-bold text-ink">{post.commentsCount}</span>
                  </button>

                  {/* Share Button */}
                  <button
                    type="button"
                    onClick={() => handleShare(post)}
                    className="text-ink/80 transition hover:text-ink active:scale-95"
                    aria-label="Share post"
                  >
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>

                {/* Bookmark / Save Button */}
                <button
                  type="button"
                  onClick={() => onSave(post.id)}
                  className="text-ink/80 transition active:scale-90"
                  aria-label={post.isSaved ? "Unsave post" : "Save post"}
                >
                  <svg
                    className={`h-6 w-6 transition ${
                      post.isSaved ? "fill-saffron-text text-saffron-text" : "hover:text-saffron-text"
                    }`}
                    viewBox="0 0 24 24"
                    fill={post.isSaved ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                  </svg>
                </button>
              </div>

              {/* Post Caption & Expandable Content */}
              <div className="mt-2 text-xs text-ink leading-relaxed">
                <span className="font-bold text-ink mr-1.5 cursor-pointer hover:underline" onClick={() => onViewProfile(post.username)}>
                  {post.userName}
                </span>
                <span>{post.caption}</span>
              </div>

              {/* Clickable Hashtags */}
              {post.hashtags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {post.hashtags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onFilterHashtag(tag)}
                      className="text-xs font-semibold text-saffron-text hover:text-saffron-text hover:underline"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {/* Timestamp */}
              <div className="mt-2 text-[10px] text-ink-soft uppercase tracking-wider">
                {new Date(post.createdAt).toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </article>
        ))}

        {filteredPosts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-8 text-center">
            <p className="font-display text-lg font-bold text-ink">No media posts found</p>
            <p className="mt-1 text-xs text-ink-soft">Try clearing your filters or create a new post using the Create studio!</p>
          </div>
        )}
      </div>

      {/* Share Toast */}
      {shareToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-lg animate-bounce">
          {shareToast}
        </div>
      )}

      {/* Comments Drawer / Sheet */}
      {selectedPostComments && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center p-0 sm:p-4">
          <div className="flex h-[80vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:h-[600px] sm:rounded-2xl">
            {/* Sheet Header */}
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
              <span className="font-display text-sm font-bold text-ink">
                Comments ({selectedPostComments.comments.length})
              </span>
              <button
                type="button"
                onClick={() => setSelectedPostComments(null)}
                className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-ink/5"
              >
                ✕
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingComments ? (
                <div className="py-8 text-center text-xs text-ink-soft">Loading comments...</div>
              ) : selectedPostComments.comments.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink-soft">
                  No comments yet. Start the conversation!
                </div>
              ) : (
                selectedPostComments.comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-ink/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.userAvatar || "/media/placeholders/artisan-1.svg"} alt={c.userName} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-ink">{c.userName}</span>
                        <span className="text-[10px] text-ink-soft">@{c.username}</span>
                      </div>
                      <p className="mt-0.5 text-ink leading-relaxed">{c.text}</p>
                      <span className="text-[10px] text-ink-soft">
                        {new Date(c.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input Form */}
            <div className="border-t border-ink/10 p-3 bg-paper">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddComment();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  maxLength={400}
                  className="flex-1 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs text-ink placeholder:text-ink-soft/70 focus:border-saffron focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="rounded-full bg-ink-2 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-ink disabled:opacity-50"
                >
                  Post
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

