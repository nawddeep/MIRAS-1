import fs from "node:fs";
import path from "node:path";
import { Label } from "@/components/ui";

// Serves the team's existing scroll story page if it has been copied to public/story/.
// Its clips have no confirmed rights yet, so the note below stays until the team confirms them.
export default function StoryPage() {
  const present = fs.existsSync(path.join(process.cwd(), "public", "story", "index.html"));
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Udaipur story</h1>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-saffron bg-saffron/15 p-3 text-sm">
        <Label tone="warn">Needs rights confirmation</Label>
        <span>The video clips and images on this page do not have confirmed owners or permitted use yet.</span>
      </div>
      {present ? (
        <div className="-mx-4 h-[80svh] overflow-hidden border-y border-line sm:mx-0 sm:rounded-2xl sm:border">
          <iframe src="/story/index.html" title="Udaipur story" className="h-full w-full" />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line p-5 text-ink-soft">
          <p>The story page is not installed.</p>
          <p className="mt-2 text-sm">
            To add it, unzip &ldquo;MIRAS Udaipur Story&rdquo; so that <code>public/story/index.html</code> and{" "}
            <code>public/story/media/</code> exist, then add each media file to <code>content/media.json</code> with its owner and
            permitted use.
          </p>
        </div>
      )}
    </div>
  );
}
