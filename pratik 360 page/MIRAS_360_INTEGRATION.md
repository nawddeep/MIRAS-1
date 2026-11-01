# MIRAS 360° & VR Studio Integration Summary

## 1. Overview
Integrated the standalone **360° Camera & Stitcher PWA** (`/pwa`) and native **360° / VR Panorama Viewer** directly into the MIRAS Next.js 16 + TypeScript mobile-first frontend under `/360`, preserving the MIRAS Udaipur visual identity (`--paper`, `--ink`, `--saffron`, `--lake-deep`).

---

## 2. Bottom Navigation Integration
- **File**: `components/shell.tsx`, `components/icons.tsx`, `lib/i18n.ts`
- Added custom `Orbit360Icon` inline SVG matching the MIRAS 1.8px stroke icon family.
- Inserted the **360** tab before **Plan** in the bottom navigation bar:
  - Final order: **Home → Explore (Places) → 360 → Plan → Stories → Profile**
- Configured active route highlighting (`aria-current="page"`) for `/360` and `/replay`.
- Adjusted mobile bottom navigation grid (`repeat(6, minmax(0, 1fr))`) so all 6 touch targets remain `≥ 44×44px` with zero horizontal overflow at `360px` width.

---

## 3. 360° Camera & Studio (`/360`)
- **Files**:
  - `app/360/page.tsx`
  - `components/immersive/ImmersiveLauncher.tsx`
  - `components/immersive/CreatePanel.tsx`
  - `app/api/pwa-studio/[...path]/route.ts`
- **Streamlined Studio Experience**:
  - Removed redundant sub-workflows (`Multi-photo stitch`, `Guided 360° ring`, `360° scene studio`) and removed the `Fullscreen Studio` button so the interface is focused on the **Full 360° Camera & Studio**.
  - Kept all UI text concise (1–2 lines max).
  - Tapping **Create & Open 360° Camera** (`open-pwa-camera-btn`) messages the integrated `/pwa` studio (`MIRAS_START_CAPTURE`) to launch the 360° spherical camera immediately.
  - Styled `/api/pwa-studio/index.html` with MIRAS theme variables (`--bg`, `--surface`, `--text`, `--accent`), injected `<base href="/api/pwa-studio/" />`, bypassed onboarding popups, and prevented inner Service Worker conflicts.

---

## 4. Top-Right Panorama Import & Strict Validation
- **File**: `components/immersive/ImportPanel.tsx`
- Placed **Import Panorama** at the top right of the `/360` header.
- **Strict Panorama Verification**:
  - Accepts `.png`, `.jpg`, `.jpeg`, and `.webp` images.
  - Verifies minimum resolution (`≥ 64×32px`).
  - Enforces a **2:1 equirectangular aspect ratio** (`1.75:1` to `2.25:1`). Non-panoramic photos (portrait, `1:1` square, standard `4:3` or `16:9` photos) are automatically rejected with a clear 1-line diagnostic message.
  - Includes a verified `2048×1024` (`2:1`) `.PNG` VR test panorama loader (`/MIRAS_VR_Test_Panorama.png`).

---

## 5. WebGL 360° & Stereoscopic VR Viewer
- **File**: `components/immersive/Viewer360.tsx`
- Ported the **WebGL 3D equirectangular fragment shader** (`WebGLEyeSphere`) from `pwa/src/services/PanoramaViewer.ts` with a CSS equirectangular fallback layer.
- Supports:
  - **View 360**: Interactive monoscopic 360° sphere with drag look-around, momentum inertia, two-finger pinch-to-zoom, mouse wheel zoom, keyboard arrow keys, and device-orientation (`DeviceOrientationEvent`) motion tilt.
  - **View in VR**: Side-by-side stereoscopic dual-eye headset preview (`VR-style preview · Headset preview`).
  - **Landscape Mode**: Responsive layout expansion (`@media (orientation: landscape)`) with zero horizontal overflow.

---

## 6. On-Device History & `/pwa` IndexedDB Sync
- **Files**:
  - `lib/client/idb.ts`
  - `lib/client/immersive-store.ts`
  - `components/immersive/HistoryList.tsx`
- Upgraded MIRAS IndexedDB (`miras-v1` → version `2`) with the `"immersive"` object store.
- Built automatic two-way synchronization with `/pwa`'s `miras-capture-db` IndexedDB (`documents`, `panoramas`, `thumbnails`), properly unwrapping `{ doc: json }` records and mapping `name`, `date`, `settings.width`, and `hotspots`.
- Added a dedicated **History** tab/button (`tab-history` and `open-history-btn`) that refreshes and displays saved **Imported** and **Created** 360° items with **Open**, **View in VR**, and **Delete** actions.

---

## 7. Verification & Tests
- **Unit Tests**: `tests/unit/immersive.test.ts` (spherical geometry, target generation, GPano XMP injection) — **22/22 test suites (160 tests) passing**.
- **Playwright E2E Tests**: `tests/e2e/immersive-360.spec.ts` (bottom nav order, touch target sizes, 360 Studio launch, strict rejection of non-panoramic images, 2:1 `.png` import, VR stereo toggle, History persistence, and landscape mode) — **passing**.
