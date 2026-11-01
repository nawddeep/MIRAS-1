import Link from "next/link";
import { MemoriesFlow } from "@/components/MemoriesFlow";
import { Label } from "@/components/ui";
import { aiStatus } from "@/lib/ai";
import { getConfig } from "@/lib/config";
import { pick } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { getVisiblePlaces } from "@/lib/services/content";

export default async function MemoriesPage() {
  const lang = await getLang();
  const places = getVisiblePlaces().map((p) => ({ id: p.id, name: pick(lang, p.name, p.name_hi) }));
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Memories</h1>
      <p className="text-ink-soft">
        Turn up to five of your own photos or clips into a short in-app reel with captions and verified stories. Your photos stay on this device.
      </p>
      {!aiStatus().configured && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-saffron/15 p-3 text-sm">
          <Label tone="warn">Demo response</Label> AI is not configured, so captions are placeholders.
        </p>
      )}
      <Link href="/discover/community" className="feature-secondary">Share a memory to your account →</Link>
      <MemoriesFlow lang={lang} places={places} uploadTimeoutMs={getConfig().uploadTimeoutMs} />
    </div>
  );
}
