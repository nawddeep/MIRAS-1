"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MediaHeader } from "@/components/media-social/MediaHeader";
import { MediaNav, type MediaTab } from "@/components/media-social/MediaNav";
import { FeedTab } from "@/components/media-social/FeedTab";
import { ReelsTab } from "@/components/media-social/ReelsTab";
import { EditorTab } from "@/components/media-social/EditorTab";
import { ArVrTab } from "@/components/media-social/ArVrTab";
import { ProfileTab } from "@/components/media-social/ProfileTab";
import { NotificationsModal } from "@/components/media-social/NotificationsModal";
import type { MediaPost, MediaNotification, MediaUserProfile, MediaAudioTrack } from "@/lib/media-social/db";

type Me = { userId: string; username: string; displayName: string } | null;
type Profile = MediaUserProfile & { posts: MediaPost[]; saved: MediaPost[] };
type Place = { id: string; name: string; slug: string; lat?: number; lng?: number };

const get = (url: string) =>
  fetch(url, { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => ({ ok: false }));

async function fetchAll(searchQuery: string, activeFilter: string | null) {
  let feedUrl = "/api/media-social?view=feed";
  if (searchQuery.trim()) feedUrl += `&q=${encodeURIComponent(searchQuery.trim())}`;
  if (activeFilter?.startsWith("#")) feedUrl += `&hashtag=${encodeURIComponent(activeFilter)}`;
  else if (activeFilter?.startsWith("place:")) feedUrl += `&placeId=${encodeURIComponent(activeFilter.replace("place:", ""))}`;
  const [feed, reels, notifications, audio, places, profile] = await Promise.all([
    get(feedUrl),
    get("/api/media-social?view=reels"),
    get("/api/media-social?view=notifications"),
    get("/api/media-social?view=audio"),
    get("/api/media-social?view=places"),
    get("/api/media-social?view=profile"),
  ]);
  return { feed, reels, notifications, audio, places, profile };
}

function SignInCard({ what }: { what: string }) {
  return (
    <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-ink/10 bg-white p-6 text-center shadow-sm">
      <h2 className="font-display text-lg font-bold text-ink">Sign in to {what}</h2>
      <p className="mt-1 text-sm text-ink-soft">Media is for MIRAS members. It takes a minute to create an account.</p>
      <Link href="/account" className="mt-4 inline-block rounded-full bg-ink-2 px-5 py-2 text-sm font-semibold text-white hover:bg-ink">
        Sign in or register
      </Link>
    </div>
  );
}

export default function MediaPage() {
  const [activeTab, setActiveTab] = useState<MediaTab>("feed");
  const [posts, setPosts] = useState<MediaPost[]>([]);
  const [reels, setReels] = useState<MediaPost[]>([]);
  const [audioTracks, setAudioTracks] = useState<MediaAudioTrack[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [notifications, setNotifications] = useState<MediaNotification[]>([]);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [me, setMe] = useState<Me>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchAll(searchQuery, activeFilter).then((d) => {
      if (!alive) return;
      if (d.feed.ok) {
        setPosts(d.feed.posts || []);
        setMe(d.feed.currentUser ?? null);
      }
      if (d.reels.ok) setReels(d.reels.reels || []);
      if (d.notifications.ok) setNotifications(d.notifications.notifications || []);
      if (d.audio.ok) setAudioTracks(d.audio.tracks || []);
      if (d.places.ok) setPlaces(d.places.places || []);
      setUserProfile(d.profile.ok ? d.profile.profile : null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [searchQuery, activeFilter, version]);

  const reload = () => setVersion((v) => v + 1);

  /** POST an action; on failure show the server's message and return null. */
  async function send(body: Record<string, unknown>) {
    try {
      const res = await fetch("/api/media-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        setNotice(data.error || "Something went wrong. Please try again.");
        return null;
      }
      setNotice("");
      return data;
    } catch {
      setNotice("Could not reach the server. Check your connection and try again.");
      return null;
    }
  }

  async function handleLike(postId: string) {
    const data = await send({ action: "like", postId });
    if (!data) return;
    const apply = (p: MediaPost) => (p.id === postId ? { ...p, isLiked: data.isLiked, likesCount: data.count } : p);
    setPosts((prev) => prev.map(apply));
    setReels((prev) => prev.map(apply));
  }

  async function handleSave(postId: string) {
    const data = await send({ action: "save", postId });
    if (data) setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, isSaved: data.isSaved } : p)));
  }

  async function handleFollow(targetId: string) {
    const data = await send({ action: "follow", targetId });
    if (!data) return;
    const apply = (p: MediaPost) => (p.userId === targetId ? { ...p, isFollowingAuthor: data.isFollowing } : p);
    setPosts((prev) => prev.map(apply));
    setReels((prev) => prev.map(apply));
  }

  async function handleComment(postId: string, text: string) {
    const data = await send({ action: "comment", postId, text });
    if (data) setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p)));
  }

  async function handleUpdateProfile(updateData: Partial<MediaUserProfile>) {
    const data = await send({ action: "update_profile", ...updateData });
    if (data && userProfile) setUserProfile({ ...userProfile, ...data.profile });
  }

  async function handleMarkNotificationsRead() {
    if (await send({ action: "mark_notifications_read" })) setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-paper font-sans text-ink">
      <MediaHeader
        notifications={notifications}
        onOpenNotifications={() => setShowNotifications(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilter={activeFilter}
        onClearFilter={() => setActiveFilter(null)}
      />

      <main className="flex-1 overflow-y-auto">
        {!me && !loading && (
          <p className="mx-auto max-w-xl px-4 pt-3 text-center text-xs text-ink-soft">
            You are browsing as a visitor.{" "}
            <Link href="/account" className="font-semibold text-saffron-text underline">
              Sign in
            </Link>{" "}
            to like, comment, follow and post.
          </p>
        )}
        {notice && (
          <div role="alert" className="mx-auto mt-3 flex max-w-xl items-center justify-between gap-3 rounded-xl border border-saffron/40 bg-saffron/10 px-4 py-2 text-xs font-medium text-ink">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message" className="text-ink-soft hover:text-ink">
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-saffron-text border-t-transparent" />
              <span>Loading MIRAS Media &amp; Reels...</span>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "feed" && (
              <FeedTab
                posts={posts}
                currentUserId={me?.userId ?? ""}
                onLike={handleLike}
                onSave={handleSave}
                onFollow={handleFollow}
                onComment={handleComment}
                onFilterHashtag={(tag) => setActiveFilter(tag)}
                onFilterPlace={(placeId) => setActiveFilter(`place:${placeId}`)}
                onViewArVr={() => setActiveTab("ar_vr")}
                onViewProfile={() => setActiveTab("profile")}
              />
            )}

            {activeTab === "reels" && (
              <div className="pt-2">
                <ReelsTab
                  reels={reels}
                  currentUserId={me?.userId ?? ""}
                  onLike={handleLike}
                  onSave={handleSave}
                  onFollow={handleFollow}
                  onComment={handleComment}
                  onViewArVr={() => setActiveTab("ar_vr")}
                  onViewProfile={() => setActiveTab("profile")}
                />
              </div>
            )}

            {activeTab === "editor" &&
              (me ? (
                <EditorTab
                  audioTracks={audioTracks}
                  places={places}
                  onPublishSuccess={() => {
                    reload();
                    setActiveTab("feed");
                  }}
                />
              ) : (
                <SignInCard what="create a post" />
              ))}

            {activeTab === "ar_vr" && <ArVrTab places={places} />}

            {activeTab === "profile" &&
              (me && userProfile ? (
                <ProfileTab
                  profile={userProfile}
                  currentUserId={me.userId}
                  onUpdateProfile={handleUpdateProfile}
                  onFollow={handleFollow}
                  onViewPost={() => {}}
                />
              ) : (
                <SignInCard what="see your profile" />
              ))}
          </>
        )}
      </main>

      {showNotifications && (
        <NotificationsModal
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onMarkRead={handleMarkNotificationsRead}
          onSelectPost={() => {
            setActiveTab("feed");
          }}
        />
      )}

      <MediaNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
