'use client';
import { useCallback, useEffect, useState } from 'react';

const ME_KEY = 'miras-stories-me';

/** Who is using the app (no login in the prototype – pick a demo user). */
export function useMe() {
  const [me, setMeState] = useState('you');
  useEffect(() => { try { const v = localStorage.getItem(ME_KEY); if (v) setMeState(v); } catch { /* private mode */ } }, []);
  const setMe = useCallback((id) => { setMeState(id); try { localStorage.setItem(ME_KEY, id); } catch { /* ignore */ } }, []);
  return [me, setMe];
}

export function useStories() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/stories', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
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
