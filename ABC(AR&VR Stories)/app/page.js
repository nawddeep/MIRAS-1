'use client';
import Link from 'next/link';
import Header from '@/components/Header';
import StoryTray from '@/components/StoryTray';
import Avatar from '@/components/Avatar';
import { kindLabel, timeAgo, trayFor, useMe, useStories } from '@/lib/useStories';

function Thumb({ s }) {
  if (s.mediaType === 'video') {
    return s.poster ? <img src={s.poster} alt="" /> : <video src={`${s.src}#t=${(s.trimStart || 0) + 0.2}`} muted playsInline preload="metadata" />;
  }
  return <img src={s.src} alt="" />;
}

export default function Home() {
  const [me, setMe] = useMe();
  const { data, error } = useStories();
  const rows = trayFor(data, me);
  const immersive = (data?.stories || []).filter((s) => s.projection !== 'flat').slice().reverse();
  return (
    <main className="home">
      <Header me={me} setMe={setMe} />
      {error && <p className="err">Couldn’t load stories: {error}</p>}
      {!data && !error && <p className="muted pad">Loading stories…</p>}
      {data && (
        <>
          <StoryTray rows={rows} me={me} users={data.users} />
          <section className="pad">
            <div className="section-head">
              <h2>Step into Udaipur</h2>
              <p className="muted">360° photos, panoramas and videos – open any story in <b>360</b>, <b>VR</b> or <b>AR</b>.</p>
            </div>
            <div className="explore">
              {immersive.map((s) => {
                const u = data.users.find((x) => x.id === s.userId);
                return (
                  <Link key={s.id} href={`/story/${s.userId}?s=${s.id}`} className="card">
                    <Thumb s={s} />
                    <span className="card-kind">{kindLabel(s)}</span>
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
