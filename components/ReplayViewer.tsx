"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { Pano360 } from "./Pano360";

/** Opens the visitor's own equirectangular photo in the 360 viewer. The file never leaves the device. */
export function ReplayViewer({ lang }: { lang: Lang }) {
  const [url, setUrl] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  async function open(file: File | undefined) {
    if (!file) return;
    setWarning(null);
    try {
      const bmp = await createImageBitmap(file);
      // 360 photos are equirectangular: about twice as wide as they are tall.
      if (Math.abs(bmp.width / bmp.height - 2) > 0.1) setWarning("This does not look like a 360 photo (it should be about twice as wide as it is tall). It may look stretched.");
    } catch {
      setWarning("Could not read that image.");
      return;
    }
    setUrl(URL.createObjectURL(file));
  }

  return (
    <div className="space-y-3">
      <input type="file" accept="image/*" aria-label="Your 360 photo" onChange={(e) => open(e.target.files?.[0])} className="block w-full text-sm" />
      <p className="text-xs text-ink-soft">Your photo is opened in this browser only. It is not uploaded.</p>
      {warning && (
        <p role="status" className="rounded-xl bg-saffron/15 p-3 text-sm">
          {warning}
        </p>
      )}
      {url && <Pano360 key={url} src={url} illustrative={false} lang={lang} alt="Your 360 photo" />}
    </div>
  );
}
