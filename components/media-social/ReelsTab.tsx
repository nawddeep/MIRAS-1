"use client";

import { useState, useEffect } from "react";
import type { MediaPost } from "@/lib/media-social/db";
import { getHeritageAudioSynth } from "@/lib/media-social/audio-synth";

interface ReelsTabProps {
  reels: MediaPost[];
  currentUserId: string;
  onLike: (postId: string) => Promise<void>;
  onSave: (postId: string) => Promise<void>;
  onFollow: (targetId: string) => Promise<void>;
  onComment: (postId: string, text: string) => Promise<void>;
  onViewArVr: (post: MediaPost) => void;
  onViewProfile: (username: string) => void;
}

export function ReelsTab({
  reels,
  currentUserId,
  onLike,
  onSave,
  onFollow,
  onComment,
  onViewArVr,
  onViewProfile,
}: ReelsTabProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<{ id: string; userName: string; username: string; text: string }[]>([]);
  const [shareToast, setShareToast] = useState("");

  const currentReel = reels[currentIndex];

  useEffect(() => {
    if (!currentReel || !isPlaying || isMuted) {
      getHeritageAudioSynth().stop();
      return;
    }

    getHeritageAudioSynth().playTrack(currentReel.audioId || "track-1", isMuted);

    return () => {
      getHeritageAudioSynth().stop();
    };
  }, [currentIndex, currentReel, isMuted, isPlaying]);

  function togglePlayPause() {
    if (isPlaying) {
      getHeritageAudioSynth().stop();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  }

  function toggleMute() {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      getHeritageAudioSynth().stop();
    } else if (isPlaying && currentReel) {
      getHeritageAudioSynth().playTrack(currentReel.audioId || "track-1", false);
    }
  }

  function handleNext() {
    if (currentIndex < reels.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  async function openComments() {
    if (!currentReel) return;
    try {
      const res = await fetch(`/api/media-social?view=comments&postId=${currentReel.id}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch {
      setComments([]);
    }
    setShowComments(true);
  }

  async function handleAddComment() {
    if (!commentText.trim() || !currentReel) return;
    await onComment(currentReel.id, commentText);
    setComments((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        userName: "You",
        username: "you",
        text: commentText.trim(),
      },
    ]);
    setCommentText("");
  }

  function handleShare() {
    if (!currentReel) return;
    const url = `${window.location.origin}/media?reel=${currentReel.id}`;
    if (navigator.share) {
      navigator.share({
        title: `MIRAS Reel · ${currentReel.userName}`,
        text: currentReel.caption,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setShareToast("Reel link copied!");
      setTimeout(() => setShareToast(""), 3000);
    }
  }

  if (!currentReel) {
    return (
      <div className="flex h-[75vh] items-center justify-center p-6 text-center text-ink-soft">
        <p>No reels found in the collection. Create the first reel!</p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-[calc(100vh-130px)] max-h-[820px] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-black shadow-2xl">
      {/* Main Reel Viewport */}
      <div className="relative h-full w-full select-none cursor-pointer overflow-hidden" onClick={togglePlayPause}>
        {/* Background Visual (Image or Video) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentReel.mediaUrl}
          alt={currentReel.caption}
          className="h-full w-full object-cover transition duration-500"
        />

        {/* Ambient Overlay Vignette */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/85" />

        {/* Audio Mute/Unmute Control (Top Right) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          className="absolute top-4 right-4 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70 active:scale-90"
          aria-label={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? (
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H9z" />
            </svg>
          ) : (
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          )}
        </button>

        {/* Index Pill (Top Left) */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md">
          <span>🎬 Reel</span>
          <span className="text-white/60">·</span>
          <span>{currentIndex + 1} / {reels.length}</span>
        </div>

        {/* Pause/Play indicator if paused */}
        {!isPlaying && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-black/60 text-white shadow-2xl backdrop-blur-md">
              <svg className="h-8 w-8 ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Vertical Reel Navigation Arrows (Desktop / Web Friendly) */}
        <div className="absolute inset-y-0 right-2 z-20 flex flex-col items-center justify-between py-16 pointer-events-none">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/80 disabled:opacity-30"
            aria-label="Previous Reel"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={currentIndex === reels.length - 1}
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/80 disabled:opacity-30"
            aria-label="Next Reel"
          >
            ↓
          </button>
        </div>

        {/* Right Interaction Rail (Like, Comment, Share, AR/VR, Audio Disc) */}
        <div className="absolute right-3 bottom-14 z-20 flex flex-col items-center gap-4 text-white">
          {/* Creator Avatar with follow badge */}
          <div className="relative mb-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile(currentReel.username);
              }}
              className="h-11 w-11 overflow-hidden rounded-full border-2 border-white shadow-md focus:outline-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={currentReel.userAvatar || "/media/placeholders/artisan-1.svg"} alt={currentReel.userName} className="h-full w-full object-cover" />
            </button>
            {currentReel.userId !== currentUserId && !currentReel.isFollowingAuthor && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFollow(currentReel.userId);
                }}
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-ink-2 text-[11px] font-bold text-white shadow"
                aria-label="Follow creator"
              >
                +
              </button>
            )}
          </div>

          {/* Like */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLike(currentReel.id);
            }}
            className="flex flex-col items-center gap-1 active:scale-90 transition"
            aria-label="Like reel"
          >
            <div className={`grid h-10 w-10 place-items-center rounded-full ${currentReel.isLiked ? "bg-ink-2 text-white" : "bg-black/40 text-white backdrop-blur-md"}`}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill={currentReel.isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <span className="text-[11px] font-bold">{currentReel.likesCount}</span>
          </button>

          {/* Comment */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openComments();
            }}
            className="flex flex-col items-center gap-1 active:scale-90 transition"
            aria-label="Open reel comments"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
              </svg>
            </div>
            <span className="text-[11px] font-bold">{currentReel.commentsCount}</span>
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            className="flex flex-col items-center gap-1 active:scale-90 transition"
            aria-label="Share reel"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </div>
            <span className="text-[11px] font-bold">Share</span>
          </button>

          {/* AR/VR Launcher Trigger */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewArVr(currentReel);
            }}
            className="flex flex-col items-center gap-1 active:scale-90 transition"
            aria-label="Experience in AR / 360"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-tr from-ink-2 to-lake-deep text-white shadow-lg shadow-ink-2/30">
              <span className="text-base">🧭</span>
            </div>
            <span className="text-[10px] font-bold">360 / AR</span>
          </button>

          {/* Spinning Audio Disc */}
          <div className="mt-1">
            <div className={`h-8 w-8 rounded-full border-2 border-ink-2 bg-gradient-to-tr from-saffron to-rose p-1 shadow-lg ${isPlaying ? "animate-spin" : ""}`}>
              <div className="h-full w-full rounded-full border border-white/50 bg-ink" />
            </div>
          </div>
        </div>

        {/* Bottom Reel Caption & Location Bar */}
        <div className="absolute inset-x-4 bottom-4 z-20 pr-16 text-white text-left">
          {/* Location badge */}
          {currentReel.placeName && (
            <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">
              <svg className="h-3 w-3 text-saffron" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M11.54 22.351A24.25 24.25 0 013 12c0-5.523 4.477-10 10-10s10 4.477 10 10a24.25 24.25 0 01-8.54 10.351c-.846.59-1.92.59-2.76 0zM12 15a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              <span>{currentReel.placeName}</span>
            </div>
          )}

          {/* Author Name */}
          <p className="text-sm font-bold tracking-tight">
            @{currentReel.username} <span className="text-xs font-normal text-white/80">({currentReel.userName})</span>
          </p>

          {/* Caption */}
          <p className="mt-1 text-xs text-white/95 line-clamp-2 leading-relaxed">
            {currentReel.caption}
          </p>

          {/* Soundtrack pill */}
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-[11px] text-white/90 backdrop-blur-md">
              <span className="text-xs">🎵</span>
              <span className="max-w-[180px] truncate">{currentReel.audioTitle || "Udaipur Heritage Soundtrack"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Share Toast */}
      {shareToast && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 rounded-full bg-ink/90 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md">
          {shareToast}
        </div>
      )}

      {/* Comments Drawer for Reels */}
      {showComments && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/50 backdrop-blur-xs">
          <div className="flex h-3/5 flex-col rounded-t-3xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink/10 pb-2">
              <span className="text-xs font-bold text-ink">Reel Comments ({comments.length})</span>
              <button type="button" onClick={() => setShowComments(false)} className="text-ink-soft hover:text-ink">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2 space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="text-xs">
                  <span className="font-bold text-ink">@{c.username}: </span>
                  <span className="text-ink/80">{c.text}</span>
                </div>
              ))}
              {comments.length === 0 && <p className="py-4 text-center text-xs text-ink-soft">No comments yet.</p>}
            </div>
            <div className="border-t border-ink/10 pt-2 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add comment..."
                className="flex-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className="rounded-full bg-ink-2 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

