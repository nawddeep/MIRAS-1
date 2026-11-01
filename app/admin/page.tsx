import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import { Card, Label } from "@/components/ui";
import { aiStatus } from "@/lib/ai";
import { getConfig } from "@/lib/config";
import { checkContent } from "@/lib/content-check";
import { getRepos } from "@/lib/repos";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Team status screen. Shows configuration state and counts only: no keys, no contact details. */
export default function AdminPage() {
  const cfg = getConfig();
  const ai = aiStatus();
  const report = checkContent(cfg.contentDir, path.join(process.cwd(), "public"));
  const repos = getRepos();
  const counts = repos.enquiries.countByArtisan();
  const names = new Map(repos.artisans.list().map((a) => [a.id, a.name]));

  return (
    <div className="space-y-4">
      <Link href="/admin/community" className="feature-secondary">Review community reports →</Link>
      <h1 className="text-3xl">Status</h1>

      <Card>
        <h2 className="text-xl">AI</h2>
        {ai.configured ? (
          <p className="mt-1">
            <Label tone="info">Gemini configured</Label> Model: <code>{ai.model}</code>
          </p>
        ) : (
          <p className="mt-1">
            <Label tone="rose">AI not configured</Label> Using the mock provider. Every AI output is labelled &ldquo;Demo response&rdquo;.
            {ai.hasKey && !ai.model && " A key is set but GEMINI_MODEL is empty."}
            {!ai.hasKey && ai.model && " GEMINI_MODEL is set but the key is empty."}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-xl">Mode</h2>
        <p className="mt-1">
          {cfg.demoMode ? <Label tone="warn">Demo mode</Label> : <Label tone="info">Live mode</Label>}{" "}
          {cfg.demoMode ? "Sample content is enabled." : "Only verified, non-sample content is shown."}
        </p>
        <p className="mt-1 text-sm text-ink-soft">Camera match threshold: {cfg.matchThreshold}</p>
      </Card>

      <Card>
        <h2 className="text-xl">Content</h2>
        <p className="mt-1">
          <Label tone={report.errors.length ? "rose" : "info"}>{report.errors.length} error(s)</Label>{" "}
          <Label tone="warn">{report.todo.length} item(s) still sample or unverified</Label>
        </p>
        {report.errors.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm">
            {report.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-ink-soft">
          Run <code>npm run content:check</code> for the full list (written to CONTENT_TODO.md).
        </p>
      </Card>

      <Card>
        <h2 className="text-xl">Enquiries per artisan</h2>
        {Object.keys(counts).length ? (
          <ul className="mt-1 text-sm">
            {Object.entries(counts).map(([id, n]) => (
              <li key={id}>
                {names.get(id) ?? id}: {n}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">No enquiries yet.</p>
        )}
      </Card>
    </div>
  );
}
