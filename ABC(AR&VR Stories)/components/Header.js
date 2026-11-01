'use client';
import Link from 'next/link';
import Avatar from './Avatar';
import { USERS } from '@/lib/mock';

export default function Header({ me, setMe }) {
  const user = USERS.find((u) => u.id === me);
  return (
    <header className="top">
      <Link href="/" className="brand">MIRAS <span>Stories</span></Link>
      <div className="top-right">
        <Link href="/create" className="btn primary sm">+ Story</Link>
        <label className="whoami" title="Demo: switch user">
          <Avatar user={user} size={30} />
          <select value={me} onChange={(e) => setMe(e.target.value)} aria-label="Viewing as">
            {USERS.map((u) => <option key={u.id} value={u.id}>{u.id === 'you' ? 'You (demo)' : `@${u.handle}`}</option>)}
          </select>
        </label>
      </div>
    </header>
  );
}
