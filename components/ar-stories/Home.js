'use client';
/* eslint-disable @next/next/no-img-element -- these show streamed, signed-in-only story media and a blob: preview of the visitor's own file; next/image cannot optimise either */
import Link from 'next/link';
import StoriesHeader from './StoriesHeader';
import StoryTray from './StoryTray';
import Avatar from './Avatar';
import { kindLabel, timeAgo, trayFor, useMe, useStories } from '@/lib/ar-stories/useStories';

function Thumb({ s }) {
  if (s.mediaType === 'video') {
    return s.poster ? <img src={s.poster} alt="" /> : <video src={`${s.src}#t=${(s.trimStart || 0) + 0.2}`} muted playsInline preload="metadata" />;
  }
  return <img src={s.src} alt="" />;
}

export default function Home() {
  const [me] = useMe();
  const { data, error } = useStories();
  const rows = trayFor(data, me);
  const immersive = (data?.stories || []).filter((s) => s.projection !== 'flat').slice().reverse();
  return (
    <main className="home">
      <StoriesHeader />
      {error && <p className="err">Couldn’t load stories: {error}</p>}
      {!data && !error && <p className="muted pad">Loading stories…</p>}
      {data && (
        <>
          <StoryTray rows={rows} me={me} users={data.users} />
          {!me && <p className="muted small pad">Sign in to see stories from MIRAS members, share your own and reply. <Link href="/account" className="link">Sign in or create an account</Link></p>}
          {data.stories.some((s) => s.mock) && <p className="muted small pad">Stories marked Sample are for demonstration.</p>}
          <section className="pad">
            <div className="section-head">
              <h2>Step into Udaipur</h2>
              <p className="muted">360° photos, panoramas and videos – open any story in <b>360</b>, <b>VR</b> or <b>AR</b>.</p>
            </div>
            <div className="explore">
              {immersive.map((s) => {
                const u = data.users.find((x) => x.id === s.userId);
                return (
                  <Link key={s.id} href={`/ar-stories/story/${s.userId}?s=${s.id}`} className="card">
                    <Thumb s={s} />
                    <span className="card-kind">{kindLabel(s)}{s.mock ? ' · Sample' : ''}</span>
                    <span className="card-foot"><Avatar user={u} size={24} /> <b>{u?.handle}</b> · {timeAgo(s.createdAt)}<br /><span className="card-place">📍 {s.place || 'Udaipur'}</span></span>
                  </Link>
                );
              })}
            </div>
            <div className="howto">
              <div><b>360</b><span>Drag, or move your phone, to look around.</span></div>
              <div><b>VR</b><span>Split-screen for a phone VR viewer – or a headset via WebXR.</span></div>
              <div><b>AR</b><span>A portal into the 360 world floats in your room. Tap it to step inside.</span></div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
