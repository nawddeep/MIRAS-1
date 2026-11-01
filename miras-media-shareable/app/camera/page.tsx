import type { Viewport } from "next";
import Link from "next/link";
import { CameraMode } from "@/components/CameraMode";
import { CloseIcon } from "@/components/icons";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { aiStatus } from "@/lib/ai";
import { getConfig } from "@/lib/config";
import { pick } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { getVisiblePlaces } from "@/lib/services/content";

export const viewport: Viewport = { themeColor: "#131B31" };

export default async function CameraPage() {
  const lang = await getLang();
  const cfg = getConfig();
  const places = getVisiblePlaces().map((p) => ({ id: p.id, slug: p.slug, name: pick(lang, p.name, p.name_hi), photo: p.photos[0], summary: pick(lang, p.summary, p.summary_hi), category: p.category }));
  return (
    <div className="camera-screen on-dark -mx-5 -mt-5 min-h-[100svh] space-y-4 bg-ink px-5 pt-[calc(12px+env(safe-area-inset-top))] pb-8 text-on-dark">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" aria-label="Close camera" className="grid h-11 w-11 place-items-center rounded-full hover:bg-ink-2">
          <CloseIcon />
        </Link>
        <LanguageSwitch lang={lang} />
      </div>
      <h1 className="sr-only">Camera story mode</h1>
      <p className="sr-only">
        Point your camera at one of {places.length} supported places to read its stories. If MIRAS is not sure, it says so instead of guessing.
      </p>
      <CameraMode lang={lang} demo={!aiStatus().configured} places={places} uploadTimeoutMs={cfg.uploadTimeoutMs} threshold={cfg.matchThreshold} />
    </div>
  );
}
