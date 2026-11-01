# Pichhola Hours implementation

## Audit and design contract

The active `MIRAS` branch uses Next.js 16.4.3 App Router, React 19, Tailwind 4, local JSON content and SQLite. Existing routes already implement discovery, narration, camera upload, enquiries, offline guides, passport, and artisan onboarding. The working tree was clean before this work.

The `origin/feature/website` branch holds the separate Vite desktop site, with GSAP 3, Lenis, `src/hero.js`, layered lake artwork and WebGL-related hero code. That branch is preserved. This branch already uses `app/` for the application source; adding a second `/app` URL would duplicate existing navigation and PWA scope. Existing public routes are retained.

No Pichhola asset ZIP was found. Individual WebP backgrounds already in `public/media/pichhola/` correspond to the supplied image sheet; use these without embedding the design board. All supplied illustrations and sample content remain identified as such. No external asset service or new UI dependency is needed.

The supplied 11-screen board defines the composition: cinematic lake photography, paper reading surfaces, bilingual editorial typography, saffron actions and a cusped arch for welcome/camera. Exactly Tiro Devanagari Hindi and Hind are used. Home follows Udaipur time; reading stays light and camera stays dark.

| Surface | User job / primary action | Checkable hierarchy |
| --- | --- | --- |
| Welcome | Enter the app | Lotus, MIRAS, tagline, arch photo, waterline; skip available |
| Dawn / day / golden / night | Find a place or story | Greeting, scene, headline, search, four shortcuts, discovery card |
| Explore | Search, filter and open a place | Compact bilingual toolbar, category chips, image cards, bookmarks |
| Place | Understand and explore a landmark | Hero, working thumbnails, bilingual name, tabs, facts / stories / visit |
| Stories / reader | Choose, read or listen | Classification chips, editorial image cards, light overlapping reader, audio |
| Camera / result | Capture or upload, inspect suggestion | Dark arch, corners, capture modes; clear demo / permission / unknown states |
| Artisan | Inspect craft and enquire | Hands at work, craft name, sample status, artwork gallery, enquiry |
| Profile | Find saved content and personal tools | Device-only identity, saved places and stories, passport and offline tools |

Target viewports: 390x844, 393x852, 360x800, plus 1440x900 desktop. All controls have 44px touch targets; visible keyboard focus, reduced motion and safe areas are required.

State contract: loading retains camera controls and shows progress; empty search offers reset; camera/API failures offer retry/upload; partial information stays labelled unverified; bookmark success has visible toggle and removal; camera permission denial offers upload and place links.

## Implemented screens and behavior

1. Welcome: lotus wordmark, supplied arch photograph, animated waterline, skippable arrival.
2. Dawn home: bilingual greeting, morning lake, search, shortcuts and discovery.
3. Golden home: same geometry, warm photograph and evening copy.
4. Explore: server-backed search/category queries, large cards, persistent bookmarks.
5. Place: working photo selection, bilingual heading, location, section navigation with active state, related stories, original optional 360 viewer, offline saving and responsible-visit information.
6. Stories: All/History/Oral tradition/Legend filters, search and source-labelled editorial cards.
7. Reader: overlapping paper, bilingual title, attribution, browser narration, story bookmarks and passport stamps.
8. Camera: live preview, cusped arch, capture/upload, selected-photo preview, processing corners, capability-gated flash and explicit permission/error/unknown states.
9. Recognition: supplied monument image, actual content summary, source status, full-story navigation and scan-again recovery. Returning to the result resets scroll.
10. Artisan: hands-at-work hero, bilingual craft, location, interactive artwork gallery and existing enquiry flow.
11. Night home: moonlit lake, readable ink-blue surfaces, search, shortcuts and featured story.

Also included: a distinct neutral daytime photograph (10:00–16:00), Profile with device-local saved places/stories and travel tools, delayed/dismissible installation prompt, manual iOS/Android installation instructions, and active Home/Explore/Camera/Stories/Profile navigation.

Home refreshes at time boundaries and when the page resumes. Reading surfaces stay light; camera stays dark. The separate Vite desktop branch is untouched; this branch displays the mobile application in a centered desktop shell. No duplicate application URL or dependency was introduced.

## Assets

Reused `public/media/pichhola/{splash,dawn,palace-wide,golden,moonlight,palace,temple,garden,camera,artisan,artwork,artwork-detail}.webp` and the existing local PWA icons. The complete 14-image Pichhola directory is about 580 KiB. These are individual backgrounds already extracted from the supplied sheet; no whole UI-board image is embedded. Fonts remain exactly Tiro Devanagari Hindi and Hind, self-hosted by Next font output after build-time retrieval.

## Verification

- Lint: passes without warnings.
- TypeScript: passes through `npm run typecheck` and production build.
- Unit suite: 132 tests pass across 19 files.
- Complete browser suite: 82 tests passed before the final small refinements; 29 final targeted checks passed for the updated scenes, navigation, galleries, camera, PWA and offline flow. See `ui-review/evidence.json` for final results.
- Captures: all eleven reference states, Profile and neutral day at 390×844, 393×852 and 360×800; desktop shell at 1440×900. Screenshots use a device scale factor of 1 and are stored under `docs/ui-review/`.
- Accessibility: keyboard skip link and visible focus, labelled controls, 44px navigation targets, selected/pressed states, live processing/error messages, reduced motion, no horizontal overflow, and Hindi language attributes checked. This is a focused accessibility check, not full WCAG certification.
- Performance: existing slow-network browser test passed; photographs are compact local WebP, gallery thumbnails lazy-load, 360/WebGL loads only on demand, hidden-page home updates are skipped and camera tracks stop when the app is hidden. No Lighthouse score or physical-device performance result is claimed.
- Content validation: zero schema errors; 50 existing sample/unverified items remain explicitly tracked in `CONTENT_TODO.md`.
- Production build succeeds. Three pre-existing Turbopack filesystem-tracing warnings remain in `lib/config.ts` and `lib/storage.ts`; these can increase deployment bundle size.

## PWA and integration limits

Manifest, icons, standalone metadata and versioned service-worker cache are present. Offline application fallback and explicitly saved guides were exercised in Chromium against a production build. Cache version is now v3 and cleanup only deletes MIRAS-owned caches. Android installation eligibility, delayed prompt behavior and iOS manual steps are supported; installation on physical iOS/Android devices has not been tested.

Actual camera hardware, torch, Hindi voice availability and Safari behavior require device testing. The browser suite uses a fake camera. Recognition uses the existing optional Gemini integration and is clearly demo-labelled without configuration; no arbitrary confidence percentage is presented. Product inventory/pricing, live bookings/payments, accounts/sync, independently verified historical content, real artisan consent and production notification feeds are not connected. Artwork is labelled illustrative rather than presented as a purchasable product catalogue. Sample enquiries are stored locally on the demo server; no artisan is actually contacted.

## Run locally

```sh
npm install
npm run dev
# http://localhost:3000
npm run lint
npm run typecheck
npm test
npm run build
npm run start
npm run test:e2e
node --import tsx scripts/content-check.ts
```

A production build needs network access to fetch the two font families. Playwright requires its Chromium installation. Camera access works on HTTPS or localhost. Preview home modes with `/?nosplash&hour=7`, `12`, `17`, or `22` in demo mode.

## Files

Created:

- `app/profile/page.tsx`
- `components/PhotoGallery.tsx`
- `components/SavedItems.tsx`
- `components/SectionNav.tsx`
- `tests/e2e/mobile-reference.spec.ts`
- `docs/PICHHOLA_IMPLEMENTATION.md`
- `docs/ui-review/evidence.json`

Modified:

- `app/artisans/[id]/page.tsx`
- `app/artisans/page.tsx`
- `app/camera/page.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `app/places/[slug]/page.tsx`
- `app/stories/[id]/page.tsx`
- `components/AudioBar.tsx`
- `components/BookmarkPlace.tsx`
- `components/CameraMode.tsx`
- `components/HomeShell.tsx`
- `components/InstallPrompt.tsx`
- `components/StoryReader.tsx`
- `components/domain.tsx`
- `components/icons.tsx`
- `components/scene.tsx`
- `components/shell.tsx`
- `lib/time-of-day.ts`
- `next.config.ts`
- `public/sw.js`
- `tests/unit/sw.test.ts`
- `tests/unit/theme.test.ts`

Generated screenshot evidence is in `docs/ui-review/`; historical screenshots in `docs/ui/` are preserved.
