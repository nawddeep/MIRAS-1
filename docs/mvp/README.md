# MIRAS account and community MVP

## Implemented

- `/account`: username/password registration and login, private profiles by default, profile editing, password change, session revocation, single-use rotating recovery code, logout and password-confirmed account deletion.
- `/discover/community`, `/people/<username>`: persistent memories, suggestions and 24-hour stories; optional photos; public/follower/only-me post visibility; private-account follow approval; requests, removal, blocking/unblocking; likes, comments, shares, own-content deletion, reporting and moderator review.
- `/journeys`: private dated journey records, catalogue/trail validation, one record per day, recalculated self-reported milestones, up to three earned milestones featured on the social profile. Artisan-visit milestones remain unavailable until visits can be confirmed.
- `/profile`: account memories and live milestones, alongside existing device bookmarks and offline tools. `/plan` links to journey recording. `/memories` retains the local reel tool and links to account publishing.
- Explicit account backup/restore of device bookmarks and plan. Restore requires a separate button and never uploads device photos or offline guides.
- `/admin/community`: reported-post review, gated by the existing moderator passcode plus a signed-in account for mutation.

This is a server-backed, single-instance MVP using the project's SQLite store. It is not an externally hosted cloud deployment. Persistent account data works across browsers/devices that can reach the same running server. The server and database must remain available.

## Security and data handling

Passwords use per-password salted asynchronous scrypt. Sessions are random 256-bit tokens, stored as SHA-256 hashes with 30-day expiration. Cookies are HttpOnly/SameSite=Lax and Secure with a `__Host-` prefix in production. Logout revokes a session; recovery/password changes revoke all sessions. Recovery codes are 192-bit random secrets, hashed at rest and rotated when used. Never copy recovery codes into logs, screenshots or URLs.

API mutations enforce matching Origin; input schemas and streaming body limits bound requests. Persistent auth rate limits survive process restarts. Authenticated social APIs have per-account limits. Deploy behind a proxy that strips/replaces forwarded headers before enabling `MIRAS_TRUST_PROXY=true`; otherwise auth limiting conservatively shares a server bucket. Public people search exposes only intentionally discoverable name/username/bio/profile visibility, not credentials or private posts.

Private-photo authorization runs on every request; IDs or shared links never grant permission. Community endpoints and photos return `private, no-store`. The existing service worker bypasses `/api/*` and does not cache profile HTML. Sharp decodes only JPEG/PNG/WebP, rejects malformed/animated inputs, limits input pixels and size, strips EXIF/GPS, resizes to 1600px and stores WebP blobs in the database. Account deletion cascades through associated rows and photo blobs. Each account has a 500-post quota. Expired stories become inaccessible after 24h and are physically removed when the feed is accessed.

Blocks revoke follow relationships. Blocking a public account does not prevent someone from viewing that person's public posts while signed out. Use a private profile for an actual audience boundary. Switching a profile to public approves pending requests; this is disclosed beside the control. Staff can review reported content, including private reported posts. SQLite/backups contain private user data and password hashes and must be protected.

Milestones count self-recorded journeys and eligible memories; they do not claim physical location verification. Deleting a journey recalculates earned status and removes its eligibility from featured profile badges.

## Deploy and operate

1. Use Node >=22, install from the lockfile, then run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. If the host denies Turbopack worker port binding, `npm run build:webpack` uses Next.js’s supported Webpack build with the same Tailwind preprocessing; this fallback was verified successfully.
2. Set `MIRAS_DATA_DIR` to an absolute persistent directory on the single app host. SQLite and community photo blobs must not live on an ephemeral/serverless filesystem. Keep directory access restricted to the service account. Existing artisan uploads live under the same data directory and need a separate filesystem backup.
3. Set `MIRAS_APP_ORIGIN=https://your-domain.example` (no trailing slash), `NEXT_PUBLIC_DEMO_MODE=false`, a strong `ADMIN_PASSCODE`, and only configure AI if required. Terminate HTTPS at a trusted proxy; do not expose an HTTP production login. Run `npm start` behind it.
4. Run `npm run backup` with `MIRAS_DATA_DIR` matching the app. It uses SQLite's online backup API and verifies database integrity. Set `MIRAS_BACKUP_DIR` to a protected location, transfer encrypted copies off-host, and define retention. This command backs up SQLite account photos but not existing filesystem artisan uploads.
5. For recovery: stop the app, preserve the current database/WAL files, restore a verified backup as `miras.db` into a clean data directory, restore filesystem uploads, restrict permissions and start the app. Test recovery in a separate directory before relying on backups. Backups predate account deletions; retained copies must follow the operator's retention policy.
6. Configure process supervision, disk/backup monitoring, a reporting/moderation owner, privacy/terms/retention policies and a staging check before inviting the public. No recurring backup job or public deployment has been created by this change.

Google Fonts are existing build-time network dependencies in the current layout. Supply build network access or self-host the existing fonts if the build environment is offline.

## Verification

`tests/unit/community.test.ts` exercises password/session isolation, recovery rotation and races, persistent rate limits, private image access, follow approval/revocation, only-me content, ownership, blocking, moderation, expiry, account-delete cascades, journey recording, CSRF, body bounds and image decoding/metadata stripping.

Run `MIRAS_TEST_URL=http://localhost:3000 node docs/mvp/smoke.mjs` against a running development instance. It creates two random test accounts and removes them in `finally`; a guest browser confirms private-photo denial. It also checks browser signup, session flags, follow approval through UI, comments/likes, backup isolation, journey badges and featured-badge permissions, 360/390/1440 layouts, reduced-motion focus and page errors. Screenshots intentionally show test accounts and never recovery codes. Auth rate limits still apply; repeated smoke runs can temporarily exhaust the signup bucket.

## Remaining external/product work

- Public hosting/domain/HTTPS, persistent disk and off-host backups need deployment account access and configuration.
- Email verification/recovery, OAuth/passkeys and managed identity are not integrated; recovery currently requires the user's code.
- Hotel price comparison requires provider agreements/API access; direct booking/payments/refunds are not implemented.
- Real local companions, rental inventory, pricing, owner confirmation and booking operations require verified partners.
- Imported discovery suggestions still require factual/coordinate/licensing verification. Camera AI requires configured credentials. GPS-verified trip completion and confirmed artisan visits are not implemented.
- External security/load review and broader real-device/browser testing are still required before a public launch.

Verification result: 156 unit tests, typecheck and ESLint passed; the isolated two-account browser smoke passed. An online-backup fixture was read back successfully from its independent backup. The default Turbopack production build was blocked by this execution environment’s worker port restrictions; `npm run build:webpack` completed successfully, including prerendering and build traces.
