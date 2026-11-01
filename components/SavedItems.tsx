"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookmarkPlace } from "./BookmarkPlace";

type Item = { id: string; title: string; subtitle?: string; href: string; image: string; kind: "place" | "story" };

export function SavedItems({ items }: { items: Item[] }) {
  const [saved, setSaved] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const update = () => {
      try {
        const places: string[] = JSON.parse(localStorage.getItem("miras-bookmarks") || "[]");
        const stories: string[] = JSON.parse(localStorage.getItem("miras-story-bookmarks") || "[]");
        setSaved([...places.map(id => `place:${id}`), ...stories.map(id => `story:${id}`)]);
      } catch { setSaved([]); }
      setLoaded(true);
    };
    update();
    window.addEventListener("miras-bookmarks-changed", update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener("miras-bookmarks-changed", update); window.removeEventListener("storage", update); };
  }, []);
  const shown = items.filter(item => saved.includes(`${item.kind}:${item.id}`));
  if (!loaded) return <p role="status">Loading your saved collection…</p>;
  return <section className="saved-collection" aria-label="Saved collection">
    <h2 className="t-heading">Your collection <span className="collection-count">{shown.length}</span></h2>
    {shown.length ? <ul>{shown.map(item => <li key={`${item.kind}:${item.id}`} className="saved-item">
      <Link href={item.href}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt="" width={72} height={72} loading="lazy" />
        <span><strong>{item.title}</strong><small>{item.subtitle || item.kind}</small></span>
      </Link><BookmarkPlace slug={item.id} kind={item.kind} />
    </li>)}</ul> : <div className="collection-empty"><p className="font-display text-xl">Your collection starts here.</p><p>Bookmark a place or story to start your collection.</p><Link href="/places" className="profile-explore">Explore places →</Link></div>}
  </section>;
}
