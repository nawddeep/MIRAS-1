# Mobile reference alignment — 30 October

The two user-supplied boards are the visual reference: pale blue/sage canvas, neutral black sans-serif type, white pill controls, rounded photographic cards and five-tab navigation. Target widths: 360px, 390×844 and 1440×900.

Home uses a Lake Pichola preview behind the City Palace card; card bookmarks save directly. Place details retain an immersive photo, readable scrim, story thumbnails and working Add to my day / Directions / Save actions. The feature hub contains the board's 18 destinations; Plan remains in the main navigation. Profile keeps actual saved items, empty recovery, journal sections and locked milestones. Planner uses real dates, saved stops and existing scheduling validation. Community interactions remain explicitly a local frontend preview.

Typography uses Arial/Helvetica as a close neutral match. Exact font metadata and separate full-resolution scenic assets were not supplied with the raster boards. Existing place photographs are retained; no claim of pixel-identical photography. Native PWA/browser safe areas replace the mockups' illustrated device frame and status bar.

Verification: typecheck, ESLint and 142 unit tests pass. Browser checks cover six routes at three widths, no horizontal overflow or page errors, journal tabs, 18 feature links, bookmarks, add-to-plan, visible keyboard focus with reduced motion, populated and empty collections/plans, missing-hours recovery, community follow/like/comment, and denied-storage recovery. Populated screenshots use an isolated browser test context, not visitor data.
