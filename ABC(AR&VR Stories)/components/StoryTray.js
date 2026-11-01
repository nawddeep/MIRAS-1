'use client';
import Link from 'next/link';
import Avatar from './Avatar';

export default function StoryTray({ rows, me, users }) {
  const mine = rows.find((r) => r.user.id === me);
  const meUser = users.find((u) => u.id === me);
  return (
    <div className="tray" role="list">
      {!mine && (
        <Link href="/create" className="tray-item" role="listitem">
          <span className="ring add"><Avatar user={meUser} size={62} /><span className="plus">+</span></span>
          <span className="tray-name">Your story</span>
        </Link>
      )}
      {rows.map((r) => (
        <Link key={r.user.id} href={`/story/${r.user.id}`} className="tray-item" role="listitem">
          <span className={`ring ${r.seen ? 'seen' : ''}`}>
            <Avatar user={r.user} size={62} />
            {r.stories.some((s) => s.projection !== 'flat') && <span className="ring-badge">360</span>}
          </span>
          <span className="tray-name">{r.user.id === me ? 'Your story' : r.user.handle}</span>
        </Link>
      ))}
    </div>
  );
}
