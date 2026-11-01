"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadStamps, validStamps, type Stamp } from "@/lib/passport";
import type { Lang } from "@/lib/i18n";
import { SampleBadge } from "./ui";

type PassportPlace = { id: string; slug: string; name: string; isSample: boolean; storyIds: string[] };

export function Passport({ places, lang }: { places: PassportPlace[]; lang: Lang }) {
  const [stamps, setStamps] = useState<Stamp[]>([]);
  useEffect(() => {
    const visible = new Set(places.flatMap((p) => p.storyIds));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from device storage
    setStamps(validStamps(loadStamps(), visible));
  }, [places]);

  return (
    <ul className="grid grid-cols-2 gap-3" data-testid="passport">
      {places.map((p) => {
        const s = stamps.find((x) => x.placeId === p.id);
        return (
          <li
            key={p.id}
            className={`rounded-2xl border-2 p-3 text-center ${s ? "border-saffron bg-saffron/15" : "border-dashed border-line"}`}
            data-stamped={Boolean(s)}
          >
            {p.isSample && <SampleBadge lang={lang} />}
            <p className="mt-1 font-display text-lg">{p.name}</p>
            {s ? (
              <p className="text-xs">
                {s.how === "listened" ? "Listened" : "Read"} on {new Date(s.earnedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </p>
            ) : (
              <Link href={`/places/${p.slug}#stories`} className="text-xs underline">
                Read a story to earn this stamp
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
