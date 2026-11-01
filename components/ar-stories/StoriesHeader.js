'use client';
import Link from 'next/link';
import { useMe } from '@/lib/ar-stories/useStories';

/** Title and the "post a story" button. The PWA's own top bar and navigation already surround this. */
export default function StoriesHeader() {
  const [me] = useMe();
  return (
    <header className="top">
      <Link href="/ar-stories" className="brand">AR &amp; VR <span>Stories</span></Link>
      <div className="top-right">
        {me
          ? <Link href="/ar-stories/create" className="btn primary sm">+ Story</Link>
          : <Link href="/account" className="btn sm">Sign in to post</Link>}
      </div>
    </header>
  );
}
