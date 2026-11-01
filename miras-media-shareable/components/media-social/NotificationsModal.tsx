"use client";

import type { MediaNotification } from "@/lib/media-social/db";

interface NotificationsModalProps {
  notifications: MediaNotification[];
  onClose: () => void;
  onMarkRead: () => void;
  onSelectPost?: (postId: string) => void;
}

export function NotificationsModal({
  notifications,
  onClose,
  onMarkRead,
  onSelectPost,
}: NotificationsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex h-4/5 max-h-[580px] w-full max-w-md flex-col rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold text-stone-900">Notifications</span>
            {notifications.filter((n) => !n.isRead).length > 0 && (
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {notifications.filter((n) => !n.isRead).length} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onMarkRead}
              className="text-xs font-semibold text-rose-600 hover:underline"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-7 w-7 place-items-center rounded-full text-stone-500 hover:bg-stone-100"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-500">
              <span className="text-3xl block mb-2">🔔</span>
              No notifications yet. Activity from your followers and reels will appear here.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (n.postId && onSelectPost) {
                    onSelectPost(n.postId);
                    onClose();
                  }
                }}
                className={`flex items-start gap-3 rounded-2xl p-3 transition cursor-pointer ${
                  n.isRead ? "bg-white hover:bg-stone-50" : "bg-rose-50/70 border border-rose-100"
                }`}
              >
                {/* Actor Avatar */}
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-stone-200 bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={n.actorAvatar || "/media/artisan-1.svg"} alt={n.actorName} className="h-full w-full object-cover" />
                  <span className="absolute -bottom-1 -right-1 text-xs">
                    {n.type === "like" ? "❤️" : n.type === "comment" ? "💬" : n.type === "follow" ? "👤" : "🏷️"}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 text-xs">
                  <p className="text-stone-800 leading-snug">
                    <span className="font-bold text-stone-900">{n.actorName}</span>{" "}
                    <span className="text-stone-700">{n.message}</span>
                  </p>
                  <span className="text-[10px] text-stone-600 block mt-1">
                    {new Date(n.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

