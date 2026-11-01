# Focused discovery refinement

Contract: ../ui-polish/contract.md, focused discovery revision.

Home now leads with three real-photo recommendations, a suggested trail and a craft guide. Four compact service shortcuts and the complete catalogue remain accessible through More / All features. Removed repeated feature lists from Home; Profile and Discover retain all tools.

Main navigation: Home, Explore, Plan, Stories, Profile. Camera remains accessible through Home header and travel tools. Explore search is visible, catalogue access is explicit, and unknown place IDs sort after the curated five.

Place guides: visible Directions / Save / Add to plan; one photo gallery; source/credit disclosures; no sample-artisan recommendations. Direction URLs search named places rather than approximate coordinate pins. Sourced history is distinguished from unconfirmed visitor hours and fees.

Plan: selected stops persist using the existing device store and appear as a shortlist before the selection controls. Scheduling still requires real opening windows; missing data produces actionable recovery through suggested trails. No hours or bookings were invented. Storage errors are reported.

Stories: place context and reading time precede the reader; long source and review details are collapsed below the text. Photo attribution remains available.

Validation: TypeScript, ESLint, 142 unit tests. Browser checks at 360x800, 390x844 and 1440x900: no horizontal overflow, all five navigation controls within viewport, curated order, visible search, one gallery, save/unsave, profile collection, persisted plan selection, partial schedule recovery, empty search, failed storage, visible keyboard focus, night/reduced-motion view and no page errors.

The visual rating is subjective. This is a verified frontend refinement, not evidence of launch-ready accounts, bookings, live availability or field-verified visitor information.
