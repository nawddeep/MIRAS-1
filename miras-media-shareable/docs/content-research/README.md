# Udaipur starter collection — 30 October 2026

Delivered totals: 15 published place guides (replacing the five placeholder guides and adding ten), 20 original short English history/architecture stories, 10 curated alternative destinations, 3 suggested trail sequences, 6 badge definitions. Existing first-story IDs were retained for saved links. Existing placeholder story arrays were replaced, not counted as additional researched stories.

Historical descriptions were checked against Incredible India (Ministry of Tourism), Rajasthan Tourism, the City Palace Museum operator, and Bharatiya Lok Kala Mandal's own website. Each story carries its exact source URL. Text is original short paraphrase; source-site photographs were not downloaded. Place galleries now use openly licensed photographs; see ../image-research/README.md and each guide’s Photo credits. Home artwork remains illustrative. Hindi place names are included; full Hindi story translations still need native review.

## Provenance and limits

- `place-provenance.json` records historical and geographic sources per place.
- `coordinate-sources.json` is the raw geographic lookup log, including two initial unsuccessful lookups. Badi was resolved to Wikipedia's `Lake_Badi` page; Ahar Museum uses the broader Ahar reference, explicitly marked in its guide.
- Coordinates are geographic references, not surveyed entrances. Lake coordinates can point into water. UI map actions therefore search the **named place**, not these coordinates. Confirm access with the venue. The official tourism pages' generic Udaipur map coordinates were rejected as unsuitable.
- Opening hours remain unconfirmed except Bharatiya Lok Kala Mandal's published museum hours. Fourteen places intentionally have no machine-readable opening window, so the automatic planner cannot schedule them yet.
- Visit durations and trail totals are editorial estimates. Trails are suggested stop sequences, not surveyed paths, turn-by-turn tracks or proof that every segment is walkable.
- `verifiedBy` explicitly identifies an automated source check, not a human, local guide, institution endorsement or field visit. Accessibility remains unknown. No prices or reviews were invented.
- “Hidden” is a curated alternative collection of known attractions, not a claim that the places are secret, deserted or freely accessible. The ten entries overlap the place directory intentionally.
- `hidden-locations.csv` exports coordinates with their uncertainty notes. Recheck entrance pins before using it for navigation.
- Badge definitions describe future earning rules. They do not award badges, verify completed trips or imply an account exists.

## Sources

- [Incredible India: Udaipur](https://www.incredibleindia.gov.in/en/rajasthan/udaipur), plus each guide's linked attraction page.
- [Rajasthan Tourism: Udaipur](https://www.tourism.rajasthan.gov.in/udaipur.html).
- [City Palace Museum](https://citypalacemuseum.org/).
- [Bharatiya Lok Kala Mandal](https://lokkalamandal.com/).
- Geographic references from Wikipedia are listed per entry; these are open factual reference points and remain unverified entrances.

Run `npm run content:check`, `npm run typecheck`, `npm run lint` and `npm test` after edits.
