"use client";

import { useEffect, useState } from "react";
import { BookmarkIcon } from "./icons";

export function BookmarkPlace({ slug, kind = "place", appearance = "overlay" }: { slug: string; kind?: "place" | "story"; appearance?: "overlay" | "action" }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const key = kind === "place" ? "miras-bookmarks" : "miras-story-bookmarks";
  useEffect(() => {
    const update = () => {
      try { setSaved(JSON.parse(localStorage.getItem(key) || "[]").includes(slug)); } catch { setSaved(false); }
    };
    update();
    window.addEventListener("miras-bookmarks-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("miras-bookmarks-changed", update);
      window.removeEventListener("storage", update);
    };
  }, [key, slug]);

  function toggle() {
    try {
      const items: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify(saved ? items.filter(s => s !== slug) : [...new Set([...items, slug])]));
      setSaved(!saved);
      setError(false);
      window.dispatchEvent(new Event("miras-bookmarks-changed"));
    } catch { setError(true); }
  }

  return <>
    <button type="button" className={appearance === "action" ? "place-save-action" : "photo-bookmark"} aria-label={saved ? "Remove bookmark" : `Bookmark ${kind}`} aria-pressed={saved} onClick={toggle}><BookmarkIcon size={20} />{appearance === "action" && <span>{saved ? "Saved" : "Save"}</span>}</button>
    {error && <span role="status" className="bookmark-error">Device storage is unavailable.</span>}
  </>;
}
