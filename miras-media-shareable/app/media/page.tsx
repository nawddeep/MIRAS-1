"use client";

import { useState, useEffect, useCallback } from "react";
import { MediaHeader } from "@/components/media-social/MediaHeader";
import { MediaNav, type MediaTab } from "@/components/media-social/MediaNav";
import { FeedTab } from "@/components/media-social/FeedTab";
import { ReelsTab } from "@/components/media-social/ReelsTab";
import { EditorTab } from "@/components/media-social/EditorTab";
import { ArVrTab } from "@/components/media-social/ArVrTab";
import { ProfileTab } from "@/components/media-social/ProfileTab";
import { NotificationsModal } from "@/components/media-social/NotificationsModal";
import type { MediaPost, MediaNotification, MediaUserProfile, MediaAudioTrack } from "@/lib/media-social/db";

export default function MediaPage() {
  const [activeTab, setActiveTab] = useState<MediaTab>("feed");
  const [activeDemoUser, setActiveDemoUser] = useState<string>("aarav");
  const [posts, setPosts] = useState<MediaPost[]>([]);
  const [reels, setReels] = useState<MediaPost[]>([]);
  const [audioTracks, setAudioTracks] = useState<MediaAudioTrack[]>([]);
  const [places, setPlaces] = useState<{ id: string; name: string; slug: string; lat?: number; lng?: number }[]>([]);
  const [notifications, setNotifications] = useState<MediaNotification[]>([]);
  const [userProfile, setUserProfile] = useState<(MediaUserProfile & { posts: MediaPost[]; saved: MediaPost[] }) | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("user-aarav");
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  const loadData = useCallback(async () => {
    try {
      const headers = { "x-miras-demo-user": activeDemoUser };

      // Load feed
      let feedUrl = `/api/media-social?view=feed`;
      if (searchQuery.trim()) {
        feedUrl += `&q=${encodeURIComponent(searchQuery.trim())}`;
      }
      if (activeFilter && activeFilter.startsWith("#")) {
        feedUrl += `&hashtag=${encodeURIComponent(activeFilter)}`;
      } else if (activeFilter && activeFilter.startsWith("place:")) {
        feedUrl += `&placeId=${encodeURIComponent(activeFilter.replace("place:", ""))}`;
      }

      const [feedRes, reelsRes, notifRes, audioRes, placesRes, profileRes] = await Promise.all([
        fetch(feedUrl, { headers }),
        fetch("/api/media-social?view=reels", { headers }),
        fetch("/api/media-social?view=notifications", { headers }),
        fetch("/api/media-social?view=audio"),
        fetch("/api/media-social?view=places"),
        fetch(`/api/media-social?view=profile`, { headers }),
      ]);

      const [feedData, reelsData, notifData, audioData, placesData, profileData] = await Promise.all([
        feedRes.json(),
        reelsRes.json(),
        notifRes.json(),
        audioRes.json(),
        placesRes.json(),
        profileRes.json(),
      ]);

      if (feedData.ok) {
        setPosts(feedData.posts || []);
        if (feedData.currentUser) {
          setCurrentUserId(feedData.currentUser.userId);
        }
      }
      if (reelsData.ok) setReels(reelsData.reels || []);
      if (notifData.ok) setNotifications(notifData.notifications || []);
      if (audioData.ok) setAudioTracks(audioData.tracks || []);
      if (placesData.ok) setPlaces(placesData.places || []);
      if (profileData.ok) setUserProfile(profileData.profile);
    } catch (err) {
      console.error("Failed to load media data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeDemoUser, searchQuery, activeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Actions
  async function handleLike(postId: string) {
    try {
      const res = await fetch("/api/media-social", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-miras-demo-user": activeDemoUser },
        body: JSON.stringify({ action: "like", postId }),
      });
      const data = await res.json();
      if (data.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, isLiked: data.isLiked, likesCount: data.count } : p
          )
        );
        setReels((prev) =>
          prev.map((r) =>
            r.id === postId ? { ...r, isLiked: data.isLiked, likesCount: data.count } : r
          )
        );
      }
    } catch (err) {
      console.error("Like failed:", err);
    }
  }

  async function handleSave(postId: string) {
    try {
      const res = await fetch("/api/media-social", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-miras-demo-user": activeDemoUser },
        body: JSON.stringify({ action: "save", postId }),
      });
      const data = await res.json();
      if (data.ok) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, isSaved: data.isSaved } : p))
        );
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
  }

  async function handleFollow(targetId: string) {
    try {
      const res = await fetch("/api/media-social", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-miras-demo-user": activeDemoUser },
        body: JSON.stringify({ action: "follow", targetId }),
      });
      const data = await res.json();
      if (data.ok) {
        setPosts((prev) =>
          prev.map((p) => (p.userId === targetId ? { ...p, isFollowingAuthor: data.isFollowing } : p))
        );
        setReels((prev) =>
          prev.map((r) => (r.userId === targetId ? { ...r, isFollowingAuthor: data.isFollowing } : r))
        );
      }
    } catch (err) {
      console.error("Follow failed:", err);
    }
  }

  async function handleComment(postId: string, text: string) {
    try {
      const res = await fetch("/api/media-social", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-miras-demo-user": activeDemoUser },
        body: JSON.stringify({ action: "comment", postId, text }),
      });
      const data = await res.json();
      if (data.ok) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p))
        );
      }
    } catch (err) {
      console.error("Comment failed:", err);
    }
  }

  async function handleUpdateProfile(updateData: Partial<MediaUserProfile>) {
    try {
      const res = await fetch("/api/media-social", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-miras-demo-user": activeDemoUser },
        body: JSON.stringify({ action: "update_profile", ...updateData }),
      });
      const data = await res.json();
      if (data.ok && userProfile) {
        setUserProfile({
          ...userProfile,
          ...data.profile,
        });
      }
    } catch (err) {
      console.error("Profile update failed:", err);
    }
  }

  async function handleMarkNotificationsRead() {
    try {
      await fetch("/api/media-social", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-miras-demo-user": activeDemoUser },
        body: JSON.stringify({ action: "mark_notifications_read" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Mark read failed:", err);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-50 font-sans text-stone-900 select-none overflow-hidden">
      {/* Dedicated Media Header */}
      <MediaHeader
        notifications={notifications}
        onOpenNotifications={() => setShowNotifications(true)}
        activeDemoUser={activeDemoUser}
        onSwitchDemoUser={(user) => {
          setActiveDemoUser(user);
          setLoading(true);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilter={activeFilter}
        onClearFilter={() => setActiveFilter(null)}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
              <span>Loading MIRAS Media &amp; Reels...</span>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "feed" && (
              <FeedTab
                posts={posts}
                currentUserId={currentUserId}
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
                  currentUserId={currentUserId}
                  onLike={handleLike}
                  onSave={handleSave}
                  onFollow={handleFollow}
                  onComment={handleComment}
                  onViewArVr={() => setActiveTab("ar_vr")}
                  onViewProfile={() => setActiveTab("profile")}
                />
              </div>
            )}

            {activeTab === "editor" && (
              <EditorTab
                audioTracks={audioTracks}
                places={places}
                onPublishSuccess={() => {
                  loadData();
                  setActiveTab("feed");
                }}
              />
            )}

            {activeTab === "ar_vr" && (
              <ArVrTab places={places} />
            )}

            {activeTab === "profile" && userProfile && (
              <ProfileTab
                profile={userProfile}
                currentUserId={currentUserId}
                onUpdateProfile={handleUpdateProfile}
                onFollow={handleFollow}
                onViewPost={() => {}}
              />
            )}
          </>
        )}
      </main>

      {/* Notifications Drawer */}
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

      {/* Media Module Bottom Navigation Bar */}
      <MediaNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

