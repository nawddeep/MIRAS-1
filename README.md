# MIRAS

Heritage and local-discovery web app for Udaipur. Team Impala, hackathon final
(Heritage, Tourism and Sustainable Hospitality).

**Demo journey:** find a heritage site → preview it → read a sourced story → meet a local artisan → send an enquiry.
**Second journey:** an artisan creates a listing by voice (`/onboard`).

Original demonstration content may be sample-badged. Sourced discovery content, imported unverified suggestions and user-created account posts are now distinct.
The real content list is in `CONTENT_TODO.md`.

## Account and community MVP

Real private-by-default accounts, follow approval, persistent memories/stories, photos, likes, comments, reporting, journey milestones and account collection backups are now available. Start at `/account` and `/discover/community`. See [the implementation and deployment guide](docs/mvp/README.md) for data handling, verification and remaining integrations. The older sample/demo descriptions below apply to the original discovery and artisan demo, not every new account feature.

## Run it

Needs Node 22 or newer.

```bash
npm install
npm run dev            # http://localhost:3000
```

No `.env` is needed. Without a Gemini key, AI features use a mock provider labelled `Demo response`.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build && npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests at 360 px (Playwright). Run `npm run build` and `npx playwright install chromium` first |
| `npm run content:check` | Validates `/content`, fails on errors, writes `CONTENT_TODO.md` |

## Pages

| Page | What it does |
|---|---|
| `/`, `/places/[slug]`, `/search` | Discovery, place profile (360 preview, stories, "Visiting responsibly", "Save for offline"), search |
| `/artisans`, `/artisans/[id]`, `/owner/[token]` | Artisan showcase, enquiries, private owner page (edit, consent, publish, workshops) |
| `/onboard` | Voice-first artisan onboarding |
| `/camera` | Camera story mode |
| `/plan` | Trip planner (uses `openingTimes` and coordinates from content only; travel is an Estimate) |
| `/trails`, `/trails/[id]`, `/trails/[id]/walk` | Content-defined trails and audio walks |
| `/memories` | In-app highlight reel from your own photos (frames never stored on the server) |
| `/passport` | Heritage passport stamps (device only, not location-verified) |
| `/events` | Organiser-confirmed upcoming events (IST) |
| `/picks`, `/admin/moderation` | Visitor "Hidden Udaipur" picks, moderated (needs `ADMIN_PASSCODE`) |
| `/offline` | Offline copies saved on this device |
| `/replay` | Open your own 360 photo (stays on the device) |
| `/concept/ar` | Concept only. Not real AR |
| `/admin` | Status: AI, mode, content check, enquiry counts |

Bookings and payments are not built. See [docs/PHASE6_NOT_BUILT.md](docs/PHASE6_NOT_BUILT.md).

## Configuration

Copy `.env.example` to `.env`. Never commit `.env`.

- `GEMINI_API_KEY`, `GEMINI_MODEL`: both needed to switch from the mock to Gemini. Use the exact model name from Google's docs.
- `MATCH_THRESHOLD`: camera mode confidence needed to show a place (default `0.85`).
- `ADMIN_PASSCODE`: enables `/admin/moderation`. Without it, moderation is disabled and visitor picks stay hidden.
- `NEXT_PUBLIC_DEMO_MODE`: `true` (default) also shows sample content. Set `false` for real, verified content only. Rebuild after changing it.

`/admin` shows whether AI is configured and the content status.

## Adding real content (no code changes)

| What | Where |
|---|---|
| Places | `content/places/*.json` |
| Stories | `content/stories/*.json` |
| Artisans | `content/artisans/*.json` |
| Workshops | `content/workshops/*.json` |
| Trails | `content/trails/*.json` |
| Events | `content/events/*.json` |
| Phrases | `content/phrases.json` |
| Licensed music (Memories) | `content/music.json`, each track also needs a `content/media.json` entry |
| Photos | `public/media/…`, plus an entry in `content/media.json` (owner, permitted use, contains people) |
| Signed consent forms | `private/` (gitignored). Reference the file name in `consent.docRef` |

Each file holds one object or an array. After every change, run `npm run content:check`.

Rules the app enforces:

- A visitor sees a story only when `verifiedBy` is set and `isSample` is `false`. In demo mode, sample stories also show, always badged.
- `sourceType` is `history`, `oral_tradition` or `legend`. `history` needs a `sourceRef`.
- An artisan can be `published` only with `consent.given`, `consent.date` and `ownerConfirmedAt`.
- A workshop can be `published` only with `confirmedByOwnerAt`.
- Every file in `public/media` needs a rights entry in `content/media.json`.

## Folders

- `app/`: pages and API routes
- `components/`: UI components
- `lib/`: schemas, repositories (JSON + SQLite), services (visibility and publish gates), AI providers
- `content/`: team-supplied content (JSON)
- `public/media/`: images
- `scripts/`: `content:check`
- `tests/`: unit and e2e tests
- `data/` (gitignored): SQLite database and uploads

See `BUILD_LOG.md` for what was built and when.
# MIRAS-1
