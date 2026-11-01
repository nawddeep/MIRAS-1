# MIRAS — Pichhola Hours

Implemented in `/Users/nawdddep/Desktop/MIRAS` on branch `MIRAS`. Development and verification were performed in a temporary workspace copy, which was removed after transfer and push. The Vite/GSAP/Lenis/WebGL website branch is unchanged. The current application is Next.js 16 / React 19, so the implementation reuses its routes, data gates, camera APIs, audio, install prompt, icons, offline storage, and service worker rather than adding a second frontend framework.

## Run

Node 22 or newer. From the project directory:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. For a production server: `npm run build && npm run start`.

Theme previews: `/?nosplash&hour=7`, `/?nosplash&hour=17`, `/?nosplash&hour=22`. `/?splash` explicitly replays the intro. Actual time uses Asia/Kolkata and is refreshed every minute. Preview overrides are restricted to demo mode.

## Screens

| Reference | Route / interaction |
|---|---|
| 01 Splash | First home visit; `/?splash` to replay; tap to skip |
| 02 Dawn home | `/?hour=7&nosplash` |
| 03 Golden home | `/?hour=17&nosplash` |
| 04 Explore | `/places` — search, category filters, persistent bookmarks |
| 05 City Palace | `/places/city-palace` — gallery, section tabs, sources, offline save |
| 06 Stories | `/stories` — source filters and collection search |
| 07 Story | `/stories/city-palace-sample-1` — bilingual text and browser speech |
| 08 Camera | `/camera` — permission request, live view, capture, native Photo and Upload |
| 09 Result | Camera → manually select Jagdish Temple in the labelled demo panel |
| 10 Artisan | `/artisans/sample-artisan-1` — hands/craft imagery, example artwork, sample enquiry |
| 11 Night home | `/?hour=22&nosplash` |

The five-slot navigation uses Home, Places, Camera, Stories and Makers, preserving real destinations from the existing application. The reference's account avatar is a working heritage-passport link; the bell opens an honest notification status. Food opens search, which displays no results rather than inventing venues. Experiences opens the existing trails flow. Detail pages have functional back controls and retain paper reading surfaces. Language controls remain on details and under home settings.

## Images

All new screen backgrounds are individual crops from the user-supplied **Udaipur Palaces, Temples and Lakes.png**, not crops of the UI design board. The 4×3 sheet is divided at its original resolution; 2 pixels per edge remove grid seams. There is no AI upscaling or invented remote image URL. Images are 358×358 WebP assets; their supplied resolution limits sharpness on high-density devices.

`public/media/pichhola/` contains:

- Row 1: `splash.webp`, `dawn.webp`, `golden.webp`, `palace.webp`
- Row 2: `palace-wide.webp`, `night.webp`, `story.webp`, `camera.webp`
- Row 3: `temple.webp`, `artisan.webp`, `moonlight.webp`, `garden.webp`
- Craft details: `artwork.webp`, `artwork-detail.webp`, cropped from the supplied artisan image. These are example artwork details, not a product inventory.

Reproduce extraction with `node scripts/extract-backgrounds.mjs "/absolute/path/to/Udaipur Palaces, Temples and Lakes.png"`.

The existing website's `public/img`, `public/hero`, `art`, and `udaipur_4k_no_title.png` were inspected. They are blue line illustrations rather than matching photographic backgrounds, so they were not substituted. Wikimedia candidates were researched before the user supplied the exact backgrounds; **no externally sourced replacement images are used in this build**. Sajjangarh retains its original labelled placeholder rather than showing a different monument. The existing Pichhola on-demand 360 preview is preserved and labelled illustrative.

Every added asset has a `content/media.json` record identifying the supplied sheet and the unverified underlying rights. This does not establish documentary authenticity or third-party photo permissions.

## PWA and accessibility

- Existing manifest, standalone display, app/maskable/Apple icons, and install prompt retained.
- Versioned service worker caches the offline page with its scripts/styles, static chunks, icons, and supplied backgrounds as used. API responses and ordinary HTML pages are never cached.
- Offline saved-place content remains in IndexedDB. Uncached navigation falls back to `/offline`.
- Safe-area padding, responsive mobile canvas, visible keyboard focus, skip link, semantic labels, bilingual text, and reduced-motion support.
- Arrival 600ms, story opening 350ms, scan lock 250ms, small fades 180ms. No new continuously running renderer.
- Camera streams stop on unmount, replacement and document hiding. Permission denial retains upload/manual exploration. The decorative monument view is labelled camera-off illustrative preview, never presented as a live feed.

## Honest demo boundaries

Historical stories and new landmark summaries are editorial samples; Hindi copy still requires native-speaker review. Opening hours, entry fees, accessibility and location coordinates are not independently verified. No ratings, review counts, artisan consent, personal identity, successful external booking, or AI confidence calibration is claimed. Artisan enquiries are stored by the existing demo backend only. The craft profile is an example rather than a real artisan listing. Recognition has a manually selected demo route and an existing optional Gemini integration; model suggestions remain unverified and show no calibrated confidence value. Physical iOS/Android camera and installation behavior still need device testing over HTTPS.

## Changed files

- Screens: `app/page.tsx`, `app/places/page.tsx`, `app/places/[slug]/page.tsx`, `app/stories/page.tsx`, `app/stories/[id]/page.tsx`, `app/artisans/[id]/page.tsx`, `app/camera/page.tsx`.
- Shell/style: `app/layout.tsx`, `app/globals.css`, `components/HomeShell.tsx`, `components/Splash.tsx`, `components/scene.tsx`, `components/shell.tsx`, `components/domain.tsx`, `components/CameraMode.tsx`, new `components/BookmarkPlace.tsx`.
- Content: `content/media.json`, City Palace / Pichhola records, new Jagdish Temple / Saheliyon Ki Bari records, City Palace story text, new Jagdish story, first sample artisan record, generated `CONTENT_TODO.md`.
- PWA: `public/sw.js`; existing manifest and icons retained.
- Reproduction/QA: `scripts/extract-backgrounds.mjs`, `scripts/capture-pichhola.mjs`, `tests/e2e/pichhola.spec.ts`, updated camera/design/journey/ passport tests, `tests/unit/sw.test.ts`, and screenshots in `docs/pichhola/390/` and `docs/pichhola/393/`.

## Verification

Commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run content:check`, `npm run build`, `npm run test:e2e`.

`node scripts/capture-pichhola.mjs` captures the 11 reference states at 390×844 and 393×852 against the production server on port 3200. Reports include broken-image and horizontal-overflow checks. Real-device behavior and pixel-identical fidelity are not claimed.

Final results (29 October 2026): production build passed; TypeScript and ESLint passed; 132/132 unit tests and 74/74 Playwright browser tests passed. Content validation reports 0 errors and 50 sample/unverified items. All 22 requested-state screenshots were generated, with no broken images or horizontal overflow in the checked screen routes. The production build retains three existing dynamic-filesystem tracing warnings in `lib/config.ts` and `lib/storage.ts`. A clean build was used to eliminate a stale stylesheet during the visual iteration. `docs/pichhola/showcase.webp` presents all 11 final states together.
