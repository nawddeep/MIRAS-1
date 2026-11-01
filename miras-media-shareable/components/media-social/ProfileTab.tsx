"use client";

import { useState } from "react";
import type { MediaUserProfile, MediaPost } from "@/lib/media-social/db";

interface ProfileTabProps {
  profile: MediaUserProfile & { posts: MediaPost[]; saved: MediaPost[] };
  currentUserId: string;
  onUpdateProfile: (data: Partial<MediaUserProfile>) => Promise<void>;
  onFollow: (targetId: string) => Promise<void>;
  onViewPost: (post: MediaPost) => void;
}

export function ProfileTab({
  profile,
  currentUserId,
  onUpdateProfile,
  onFollow,
  onViewPost,
}: ProfileTabProps) {
  const [activeGridTab, setActiveGridTab] = useState<"posts" | "reels" | "ar_vr" | "saved">("posts");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState<"followers" | "following" | null>(null);
  const [followList, setFollowList] = useState<{ userId: string; username: string; displayName: string; avatarUrl: string | null }[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Edit Profile Form State
  const [editName, setEditName] = useState(profile.displayName);
  const [editBio, setEditBio] = useState(profile.bio);
  const [editInterests, setEditInterests] = useState(profile.travelInterests.join(", "));
  const [editPrivacy, setEditPrivacy] = useState<"public" | "private">(profile.privacy);
  const [editWebsite, setEditWebsite] = useState(profile.website);
  const [editAvatar, setEditAvatar] = useState(profile.avatarUrl || "/media/artisan-1.svg");
  const [isSaving, setIsSaving] = useState(false);

  const isOwner = profile.userId === currentUserId;

  async function openFollowModal(type: "followers" | "following") {
    setShowFollowModal(type);
    setLoadingList(true);
    try {
      const res = await fetch(`/api/media-social?view=follows&userId=${profile.userId}&type=${type}`);
      const data = await res.json();
      setFollowList(data.list || []);
    } catch {
      setFollowList([]);
    } finally {
      setLoadingList(false);
    }
  }

  async function handleSaveProfile() {
    setIsSaving(true);
    try {
      const interestsArray = editInterests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await onUpdateProfile({
        displayName: editName,
        bio: editBio,
        travelInterests: interestsArray,
        privacy: editPrivacy,
        website: editWebsite,
        avatarUrl: editAvatar,
      });

      setShowEditModal(false);
    } finally {
      setIsSaving(false);
    }
  }

  // Filter content by grid tab
  const postsList = profile.posts.filter((p) => p.mediaType === "photo");
  const reelsList = profile.posts.filter((p) => p.mediaType === "reel" || p.mediaType === "video");
  const arVrList = profile.posts.filter((p) => p.mediaType === "ar_story" || p.mediaType === "vr_360");
  const savedList = profile.saved || [];

  return (
    <div className="mx-auto max-w-xl pb-28 pt-2 px-3 space-y-4">
      {/* Profile Header Card */}
      <div className="rounded-3xl border border-stone-200/90 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          {/* Avatar with gradient ring */}
          <div className="relative rounded-full p-[3px] bg-gradient-to-tr from-amber-500 via-rose-500 to-pink-600 shadow-md">
            <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-white bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.avatarUrl || "/media/artisan-1.svg"} alt={profile.displayName} className="h-full w-full object-cover" />
            </div>
          </div>

          {/* User Details & Counts */}
          <div className="flex-1">
            <h1 className="font-display text-lg font-bold text-stone-900 leading-snug">{profile.displayName}</h1>
            <p className="text-xs font-semibold text-rose-600">@{profile.username}</p>

            {/* Stats Row */}
            <div className="mt-3 flex items-center gap-4 text-xs">
              <div>
                <span className="font-bold text-stone-900">{profile.postsCount}</span>
                <span className="text-stone-700 ml-1">posts</span>
              </div>
              <button
                type="button"
                onClick={() => openFollowModal("followers")}
                className="hover:underline focus:outline-none"
              >
                <span className="font-bold text-stone-900">{profile.followersCount}</span>
                <span className="text-stone-700 ml-1">followers</span>
              </button>
              <button
                type="button"
                onClick={() => openFollowModal("following")}
                className="hover:underline focus:outline-none"
              >
                <span className="font-bold text-stone-900">{profile.followingCount}</span>
                <span className="text-stone-700 ml-1">following</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bio & Interests */}
        <div className="mt-4 text-xs text-stone-700 leading-relaxed">
          <p>{profile.bio || "Traveller and heritage enthusiast discovering the lake city of Udaipur."}</p>
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block font-semibold text-rose-600 hover:underline"
            >
              🔗 {profile.website.replace("https://", "")}
            </a>
          )}
        </div>

        {/* Travel Interests Chips */}
        {profile.travelInterests && profile.travelInterests.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.travelInterests.map((interest) => (
              <span
                key={interest}
                className="rounded-full bg-stone-100 border border-stone-200 px-2.5 py-0.5 text-[11px] font-medium text-stone-700"
              >
                #{interest}
              </span>
            ))}
          </div>
        )}

        {/* Action Button: Edit Profile or Follow */}
        <div className="mt-4">
          {isOwner ? (
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 py-2 text-xs font-bold text-stone-800 transition hover:bg-stone-100 active:scale-95"
            >
              Edit Profile &amp; Preferences
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onFollow(profile.userId)}
              className={`w-full rounded-xl py-2 text-xs font-bold transition shadow-sm active:scale-95 ${
                profile.isFollowing
                  ? "border border-stone-300 bg-stone-100 text-stone-700"
                  : "bg-rose-600 text-white hover:bg-rose-700"
              }`}
            >
              {profile.isFollowing ? "Following" : "+ Follow"}
            </button>
          )}
        </div>
      </div>

      {/* Grid Switcher Tabs (Posts, Reels, AR/VR, Saved) */}
      <div className="flex rounded-2xl border border-stone-200 bg-white p-1 text-xs font-bold shadow-xs">
        {[
          { id: "posts", label: "📸 Posts", count: postsList.length },
          { id: "reels", label: "🎬 Reels", count: reelsList.length },
          { id: "ar_vr", label: "🏛️ 360/AR", count: arVrList.length },
          ...(isOwner ? [{ id: "saved", label: "🔖 Saved", count: savedList.length }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveGridTab(tab.id as any)}
            className={`flex-1 rounded-xl py-2 text-center transition ${
              activeGridTab === tab.id
                ? "bg-rose-600 text-white shadow-xs font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {tab.label} <span className="opacity-75">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Media Grid View */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {activeGridTab === "posts" &&
          postsList.map((post) => (
            <div
              key={post.id}
              onClick={() => onViewPost(post)}
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-stone-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.mediaUrl} alt={post.caption} className="h-full w-full object-cover transition group-hover:scale-105" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition text-white text-xs font-bold">
                ❤️ {post.likesCount}
              </div>
            </div>
          ))}

        {activeGridTab === "reels" &&
          reelsList.map((reel) => (
            <div
              key={reel.id}
              onClick={() => onViewPost(reel)}
              className="group relative aspect-[9/16] cursor-pointer overflow-hidden rounded-xl bg-stone-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={reel.mediaUrl} alt={reel.caption} className="h-full w-full object-cover transition group-hover:scale-105" />
              <div className="absolute top-1.5 right-1.5 text-xs text-white">🎬</div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[10px] text-white font-medium truncate">
                ▶ {reel.viewsCount}
              </div>
            </div>
          ))}

        {activeGridTab === "ar_vr" &&
          arVrList.map((item) => (
            <div
              key={item.id}
              onClick={() => onViewPost(item)}
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-stone-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.mediaUrl} alt={item.caption} className="h-full w-full object-cover transition group-hover:scale-105" />
              <div className="absolute top-1.5 right-1.5 rounded-full bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                360°
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[10px] text-white truncate">
                {item.placeName || "Heritage AR"}
              </div>
            </div>
          ))}

        {activeGridTab === "saved" &&
          savedList.map((item) => (
            <div
              key={item.id}
              onClick={() => onViewPost(item)}
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-stone-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.mediaUrl} alt={item.caption} className="h-full w-full object-cover transition group-hover:scale-105" />
              <div className="absolute bottom-1 right-1 text-xs">🔖</div>
            </div>
          ))}
      </div>

      {/* Empty State */}
      {((activeGridTab === "posts" && postsList.length === 0) ||
        (activeGridTab === "reels" && reelsList.length === 0) ||
        (activeGridTab === "ar_vr" && arVrList.length === 0) ||
        (activeGridTab === "saved" && savedList.length === 0)) && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-xs text-stone-500">
          No items in this collection yet.
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="font-display text-base font-bold text-stone-900">Edit Profile</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-stone-500 hover:text-stone-800">
                ✕
              </button>
            </div>

            {/* Avatar picker */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Avatar Preset</label>
              <div className="flex gap-2">
                {[
                  "/media/artisan-1.svg",
                  "/media/artisan-2.svg",
                  "/media/places/city-palace-1.webp",
                  "/media/places/bagore-ki-haveli-1.webp",
                ].map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setEditAvatar(av)}
                    className={`h-11 w-11 overflow-hidden rounded-full border-2 transition ${
                      editAvatar === av ? "border-rose-600 ring-2 ring-rose-200" : "border-stone-200"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={av} alt="Avatar" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-stone-300 p-2 text-xs text-stone-900 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Bio</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-stone-300 p-2 text-xs text-stone-900 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Travel Interests (comma separated)</label>
              <input
                type="text"
                value={editInterests}
                onChange={(e) => setEditInterests(e.target.value)}
                placeholder="Heritage, Architecture, Lakes, Stepwells"
                className="w-full rounded-xl border border-stone-300 p-2 text-xs text-stone-900 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Website or Portfolio</label>
              <input
                type="url"
                value={editWebsite}
                onChange={(e) => setEditWebsite(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-stone-300 p-2 text-xs text-stone-900 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Profile Privacy</label>
              <div className="flex gap-2">
                {(["public", "private"] as const).map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    onClick={() => setEditPrivacy(pr)}
                    className={`flex-1 rounded-xl border py-1.5 text-xs font-semibold capitalize ${
                      editPrivacy === pr ? "border-rose-600 bg-rose-50 text-rose-700" : "border-stone-200"
                    }`}
                  >
                    {pr} Profile
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveProfile}
              className="w-full rounded-full bg-rose-600 py-2.5 text-xs font-bold text-white shadow hover:bg-rose-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Followers / Following List Modal */}
      {showFollowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="font-display text-sm font-bold text-stone-900 capitalize">
                {showFollowModal} ({followList.length})
              </h3>
              <button type="button" onClick={() => setShowFollowModal(null)} className="text-stone-500 hover:text-stone-800">
                ✕
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-3">
              {loadingList ? (
                <p className="py-4 text-center text-xs text-stone-500">Loading list...</p>
              ) : followList.length === 0 ? (
                <p className="py-4 text-center text-xs text-stone-500">No {showFollowModal} found.</p>
              ) : (
                followList.map((user) => (
                  <div key={user.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 overflow-hidden rounded-full border border-stone-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={user.avatarUrl || "/media/artisan-1.svg"} alt={user.displayName} className="h-full w-full object-cover" />
                      </div>
                      <div className="text-xs">
                        <p className="font-bold text-stone-900">{user.displayName}</p>
                        <p className="text-[10px] text-stone-500">@{user.username}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

