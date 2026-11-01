'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const MeContext = createContext(null);

/** Provides the signed-in member's id (or null) to the story screens. The server layout reads it from the session. */
export function MeProvider({ me, children }) {
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

/** Who is signed in, or null. Kept as a one-item tuple so callers can write `const [me] = useMe()`. */
export function useMe() {
  return [useContext(MeContext)];
}

async function fetchStories() {
  const r = await fetch('/api/ar-stories', { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function useStories() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    try { setData(await fetchStories()); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => {
    let alive = true;
    fetchStories().then((d) => alive && setData(d)).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, []);
  return { data, error, reload };
}

/** Users with active stories, in tray order: me first, then unseen, then seen (newest first). */
export function trayFor(data, me) {
  if (!data) return [];
  const byUser = new Map();
  for (const s of data.stories) { if (!byUser.has(s.userId)) byUser.set(s.userId, []); byUser.get(s.userId).push(s); }
  const rows = [...byUser.entries()].map(([userId, stories]) => ({
    user: data.users.find((u) => u.id === userId),
    stories,
    seen: userId !== me && stories.every((s) => s.views.includes(me)),
    latest: Math.max(...stories.map((s) => +new Date(s.createdAt))),
  })).filter((r) => r.user);
  return rows.sort((a, b) => (a.user.id === me ? -1 : b.user.id === me ? 1 : (a.seen - b.seen) || (b.latest - a.latest)));
}

export const timeAgo = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
};

export const kindLabel = (s) => (s.projection === 'equirect' ? (s.mediaType === 'video' ? '360° video' : '360° photo') : s.projection === 'pano' ? `Panorama ${s.panoDeg || 360}°` : s.mediaType === 'video' ? 'Video' : 'Photo');
