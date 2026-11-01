import fs from "node:fs";
import path from "node:path";
import { readEntities, readEntityFile, type FileIssue } from "@/lib/repos/json";
import { placeholderCoordinateIds } from "@/lib/planner";
import { Artisan, BadgeDefinition, EventItem, HiddenLocation, MediaAsset, MusicTrack, Phrase, Place, StoryEntry, Trail, Workshop } from "@/lib/schemas";
import { artisanPublishBlockers, workshopPublishBlockers } from "@/lib/services/publishing";

const MEDIA_EXT = /\.(jpe?g|png|webp|gif|svg|avif|mp4|webm|mov|mp3|m4a|wav|ogg|aac)$/i;

export type TodoItem = { kind: string; id: string; file: string; note: string };
export type ContentReport = { errors: string[]; warnings: string[]; todo: TodoItem[] };

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

/**
 * Validates everything the team drops into /content and /public.
 * Errors fail the check; the todo list is every sample or not-yet-visible item still to replace.
 */
export function checkContent(contentDir: string, publicDir: string): ContentReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const todo: TodoItem[] = [];
  const rel = (f: string) => path.relative(path.dirname(contentDir), f);
  const issue = (i: FileIssue) => errors.push(`${rel(i.file)}${i.index !== undefined ? ` [${i.index}]` : ""}: ${i.message}`);

  const places = readEntities(path.join(contentDir, "places"), Place);
  const stories = readEntities(path.join(contentDir, "stories"), StoryEntry);
  const artisans = readEntities(path.join(contentDir, "artisans"), Artisan);
  const workshops = readEntities(path.join(contentDir, "workshops"), Workshop);
  const mediaFile = path.join(contentDir, "media.json");
  const media = readEntityFile(mediaFile, MediaAsset);
  if (!fs.existsSync(mediaFile)) errors.push("content/media.json is missing.");
  const music = readEntityFile(path.join(contentDir, "music.json"), MusicTrack);
  const trails = readEntities(path.join(contentDir, "trails"), Trail);
  const phrases = readEntityFile(path.join(contentDir, "phrases.json"), Phrase);
  const events = readEntities(path.join(contentDir, "events"), EventItem);
  const hidden = readEntityFile(path.join(contentDir, "hidden-locations.json"), HiddenLocation);
  const badges = readEntityFile(path.join(contentDir, "badges.json"), BadgeDefinition);
  [places, stories, artisans, workshops, media, music, trails, phrases, events, hidden, badges].forEach((r) => r.issues.forEach(issue));

  const dupes = (kind: string, ids: string[]) =>
    ids.filter((id, i) => ids.indexOf(id) !== i).forEach((id) => errors.push(`Duplicate ${kind} id "${id}".`));
  dupes("place", places.items.map((p) => p.id));
  dupes("story", stories.items.map((s) => s.id));
  dupes("artisan", artisans.items.map((a) => a.id));
  dupes("workshop", workshops.items.map((w) => w.id));
  dupes("badge", badges.items.map((b) => b.id));
  dupes("hidden location", hidden.items.map((h) => h.id));

  const placeIds = new Set(places.items.map((p) => p.id));
  for (const h of hidden.items) if (!placeIds.has(h.placeId)) errors.push(`Hidden location "${h.id}" points to unknown place "${h.placeId}".`);
  for (const s of stories.items) if (!placeIds.has(s.placeId)) errors.push(`Story "${s.id}" points to unknown place "${s.placeId}".`);
  for (const t of trails.items) for (const id of t.placeIds) if (!placeIds.has(id)) errors.push(`Trail "${t.id}" includes unknown place "${id}".`);
  const artisanIds = new Set(artisans.items.map((a) => a.id));
  for (const w of workshops.items) if (!artisanIds.has(w.artisanId)) errors.push(`Workshop "${w.id}" points to unknown artisan "${w.artisanId}".`);

  for (const a of artisans.items) {
    if (a.status === "published") {
      const missing = artisanPublishBlockers(a);
      if (missing.length) errors.push(`Artisan "${a.id}" is published but: ${missing.join(", ")}.`);
    }
  }
  for (const w of workshops.items) {
    if (w.status === "published") {
      const missing = workshopPublishBlockers(w);
      if (missing.length) errors.push(`Workshop "${w.id}" is published but: ${missing.join(", ")}.`);
    }
  }

  // Media rights: every media file needs an entry, every entry needs a file, every referenced photo needs an entry.
  const byPath = new Map(media.items.map((m) => [m.path, m]));
  for (const file of walk(publicDir).filter((f) => MEDIA_EXT.test(f))) {
    const webPath = "/" + path.relative(publicDir, file).split(path.sep).join("/");
    if (!byPath.has(webPath)) errors.push(`Media file ${webPath} has no rights entry in content/media.json (owner, permittedUse).`);
  }
  for (const m of media.items) {
    if (m.path.startsWith("/") && !m.path.startsWith("/api/") && !fs.existsSync(path.join(publicDir, m.path))) {
      errors.push(`content/media.json lists ${m.path} but the file does not exist.`);
    }
  }
  const referenced: [string, string][] = [
    ...places.items.flatMap((p) => [...p.photos, ...(p.preview360 ? [p.preview360.path] : [])].map((src): [string, string] => [`place "${p.id}"`, src])),
    ...artisans.items.flatMap((a) => a.photos.map((src): [string, string] => [`artisan "${a.id}"`, src])),
  ];
  for (const m of music.items) if (!byPath.has(m.path)) errors.push(`Music track "${m.id}" (${m.path}) has no rights entry in content/media.json.`);
  for (const [owner, src] of referenced) {
    const m = byPath.get(src);
    if (!m) errors.push(`${owner} uses ${src}, which has no rights entry in content/media.json.`);
    else if (m.containsPeople && owner.startsWith("artisan")) errors.push(`${owner} uses ${src}, which is marked as showing people. Faces are not allowed.`);
  }

  const file = (kind: string) => `content/${kind}`;
  for (const p of places.items) if (p.isSample) todo.push({ kind: "place", id: p.id, file: file("places"), note: "sample text and photos; coordinates are placeholders" });
  const unchecked = (notes?: { verifiedBy?: string }[]) => Boolean(notes?.some((n) => !n.verifiedBy?.trim()));
  for (const p of places.items) {
    const fields = Object.entries({
      accessibility: unchecked(p.accessibility && [p.accessibility]),
      etiquette: unchecked(p.etiquette),
      conservation: unchecked(p.conservation),
      photography: unchecked(p.photographyRules && [p.photographyRules]),
    })
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (fields.length) todo.push({ kind: "place", id: p.id, file: file("places"), note: `not yet verified: ${fields.join(", ")}` });
  }
  for (const s of stories.items) {
    if (s.isSample) todo.push({ kind: "story", id: s.id, file: file("stories"), note: "sample text; needs real text, source and a verifier" });
    else if (!s.verifiedBy?.trim()) todo.push({ kind: "story", id: s.id, file: file("stories"), note: "not verified yet, so hidden from visitors" });
  }
  for (const a of artisans.items) if (a.isSample) todo.push({ kind: "artisan", id: a.id, file: file("artisans"), note: "sample listing; replace with a real artisan and signed consent" });
  for (const e of events.items) {
    if (e.isSample) todo.push({ kind: "event", id: e.id, file: file("events"), note: "sample event" });
    else if (!e.confirmedByOrganiserAt) todo.push({ kind: "event", id: e.id, file: file("events"), note: "not confirmed by the organiser yet, so hidden" });
  }
  for (const t of trails.items) if (t.isSample) todo.push({ kind: "trail", id: t.id, file: file("trails"), note: "sample trail" });
  for (const p of phrases.items) if (p.isSample) todo.push({ kind: "phrase", id: p.id, file: "content/phrases.json", note: "sample phrase; needs a checked translation" });
  for (const w of workshops.items) if (w.isSample) todo.push({ kind: "workshop", id: w.id, file: file("workshops"), note: "sample workshop" });
  for (const m of media.items) if (/placeholder/i.test(m.permittedUse)) todo.push({ kind: "media", id: m.id, file: "content/media.json", note: `placeholder image ${m.path}` });

  const shared = placeholderCoordinateIds(places.items);
  if (shared.size) warnings.push(`Places share identical coordinates (likely placeholders; the trip planner will refuse them): ${[...shared].join(", ")}.`);
  for (const p of places.items) if (!p.openingTimes) warnings.push(`Place "${p.id}" has no openingTimes, so the trip planner cannot schedule it.`);

  return { errors, warnings, todo };
}

export function renderTodo(report: ContentReport, when: Date): string {
  const lines = [
    "# Content to replace",
    "",
    `Generated by \`npm run content:check\` on ${when.toISOString()}. Do not edit by hand; rerun the check.`,
    "",
    `${report.todo.length} item(s) still to replace or verify.`,
    "",
  ];
  const headings: Record<string, string> = { place: "Places", story: "Stories", artisan: "Artisans", workshop: "Workshops", media: "Media", trail: "Trails", phrase: "Phrases", event: "Events", copy: "Hindi copy (draft)" };
  const kinds = [...new Set(report.todo.map((t) => t.kind))];
  for (const k of kinds) {
    lines.push(`## ${headings[k] ?? k}`, "");
    for (const t of report.todo.filter((x) => x.kind === k)) lines.push(`- [ ] \`${t.id}\` (${t.file}): ${t.note}`);
    lines.push("");
  }
  if (report.warnings.length) lines.push("## Warnings", "", ...report.warnings.map((w) => `- ${w}`), "");
  if (report.errors.length) {
    lines.push("## Errors to fix first", "", ...report.errors.map((e) => `- ${e}`), "");
  }
  return lines.join("\n");
}
