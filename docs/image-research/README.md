# Place photography — 30 October 2026

27 openly licensed Wikimedia Commons photographs now cover all 15 place guides. Most places have two photographs; Badi Lake, Bharatiya Lok Kala Mandal and Udai Sagar have one each. The optimized WebP collection is 3,993,266 bytes (about 4 MB decimal).

## Rights and provenance

`imported.json` records each selected file's source page, photographer, licence, licence URL, original URL and local output. `content/media.json` is the application's rights registry and includes these 27 files. The place guide's native **Photo credits** disclosure links to the source and licence and identifies the photographer. Story detail pages show the corresponding photo credit as well. Cards lead to the credited guide.

Originals were resized proportionally (maximum 1280px in either dimension, no upscaling), oriented and converted to WebP at quality 82. No subjects were generated, removed or retouched; existing watermarks were retained. Adapted files retain their source image licence, including applicable Creative Commons share-alike conditions. Source licence pages remain authoritative. Photos are not presented as current-condition documentation.

Search candidates were filtered for the correct Udaipur place. Unrelated Udai Bilas Palace results were rejected for Udai Sagar. A Badi photo dominated by a visitor was excluded from the published set. One optional second Lok Kala image could not be downloaded; the guide uses its licensed collection photograph. Ahar Museum images depict collection objects, not its exterior. Moti Magri photos depict views from the memorial hill. These two galleries identify their subjects in captions.

`candidates.json`, `extra-candidates.json` and `selected.json` retain the search/import audit. They contain rejected or failed candidates; only `imported.json` lists published assets. `contact-sheet.png` is a visual review sheet of the initial optimized candidates; the excluded Badi visitor photograph is not published under public/media or used in a guide.

## Checks

- Content validator: no missing media files or rights entries.
- Browser: all 27 local image requests return 200; galleries settle after load, including cached images.
- Rendered reviews: Explore, Stories, Shilpgram, Ahar Museum and Shilpgram story at 390x844 and 1440x900; no horizontal overflow.
- Shilpgram second-image selection and expanded source/licence credit checked.
- Reduced motion disables the image transition.
- TypeScript, lint and 142 unit tests pass.

The time-of-day home artwork and unrelated artisan/demo imagery are retained; this update replaces the 15 place galleries and uses their photos on place and story listings/details.
