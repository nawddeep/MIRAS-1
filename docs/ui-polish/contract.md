# MIRAS UI refinement contract

Surface: home discovery, shared navigation, place/story cards, gallery and saved collection.
Job: visitors find a place or story, inspect imagery and save it for later.
Primary action: search or open a discovery destination; secondary action: bookmark.
Direction: calm heritage travel journal, ivory paper, lake blue and saffron; preserve bilingual names and existing imagery. Existing HomeShell and domain cards are the local visual references.
Hierarchy: greeting and scene → search → four categories → featured story → further destinations. Use a full photographic feature with a readable dark caption, consistent fine borders and contextual motion.
Viewports: 390x844 and 1440x900; also check 360px narrow labels. Preserve the existing 480px app canvas on desktop.
Motion: finite staggered entrance, image transition, hover lift, pressed feedback and bookmark confirmation. No animation may hide content if JavaScript is unavailable. Reduced motion disables movement and smooth scrolling.
Accessibility: visible keyboard focus, named controls, 44px action targets, readable image captions, no horizontal page overflow.
States: loading = gallery image request with stable frame; empty = no saved items with explore link; error = storage denied with visible feedback; partial = available gallery images alongside a failed image with readable fallback; success = bookmark pressed state and saved collection; permission = no new permission requests in this presentation-only scope, camera workflow unchanged.

## Typography and density revision
Increase body to 17px, supporting text to 15px, navigation to 15–16px, section headings to 26px. Align bilingual category labels using stable rows. Replace plain home destination links with existing illustrative imagery and captions; expose existing travel tools. Reduce duplicated home bottom padding. At >=900px expand app canvas to 880px and use two-column home sections and three-column destination tiles. Verify 360x800, 390x844 and 1440x900, including long labels and night theme.

## Feature entry points
Home and Profile expose a shared feature menu; /discover lists every new frontend surface. Community has explicitly ephemeral sample likes/follows/comments and clipboard sharing. Account visibility previews do not alter permissions. Badges remain locked until trip verification exists. Hotel and rental searches open Google Maps for an entered area (no geolocation); provider links expose no invented prices. Local hosts and CSV-backed hidden locations have actionable empty states. Existing memories, passport, artisans, trails and saved collections remain linked. Viewports: 390x844 and 1440x900, with a 360px overflow check. Verify preview interactions, reset behaviour, routes, maps parameters, keyboard focus, reduced motion and unknown-route 404. Loading/error/partial for this frontend-only scope reuse gallery checks; external booking, geolocation permission and authenticated publishing remain unconnected.

## Focused discovery revision
Primary flow: Home recommendation → place details → Directions / Save / Add to plan → persisted planner selection. Home uses three real-photo recommendations, one suggested trail, one craft guide and four compact feature shortcuts, with full catalogue in More. Preserve all feature entry points in Discover and Profile. Main navigation is Home, Explore, Plan, Stories, Profile; camera remains in Home header and travel tools. Remove repeated place gallery and unverified sample-artisan recommendations. History labels say Sourced story rather than implying field verification. Practical unknowns remain explicit. Explore search is visible and curated IDs sort before additions. Target viewports 390x844, 1440x900, plus 360px and reduced-motion checks. Verify save/unsave, plan persistence, named map URL, failed-storage feedback, empty search, field-source details, all-feature access and readable long labels.
