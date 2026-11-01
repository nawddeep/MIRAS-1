// Writes the small HTML shell for each inner page. Run: node tools/make-pages.mjs
// Each shell only sets the title, description and data-page key; src/app.js renders the rest.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const PAGES = [
  ['explore/index.html', 'explore', 'Explore Udaipur', 'Search and browse places in Udaipur by category, with facts, visit tips and clear labels.'],
  ['explore/nearby/index.html', 'nearby', 'Nearby places', 'Places and makers near you, as a list or a sketch map. Location is optional.'],
  ['explore/markets/index.html', 'markets', 'Market guide', 'Udaipur markets by what they sell, with verification status shown.'],
  ['explore/phrases/index.html', 'phrases', 'Phrase help', 'Hindi phrases to show a shopkeeper, in large readable text.'],
  ['explore/camera/index.html', 'camera', 'Camera story (demonstration)', 'Point your camera at a monument to find its story. A demonstration with a manual search fallback.'],
  ['explore/hidden/index.html', 'hidden', 'Hidden Udaipur', 'Lesser-known places from local contributors, with sourcing and sensitivity labels.'],
  ['place/index.html', 'place', 'Place', 'A place profile with facts, hours, stories and nearby makers.'],
  ['stories/index.html', 'stories', 'Stories behind the stones', 'Stories of Udaipur, each labelled History, Oral tradition or Legend, with its source.'],
  ['story/index.html', 'story', 'Story', 'A sourced story with a simple-language version and a listen option.'],
  ['stories/immersive/index.html', 'immersive', 'AR and VR views', 'Concept AR story view and labelled 360 and VR scenes.'],
  ['artisans/index.html', 'artisans', 'Meet local makers', 'A directory of makers in Udaipur, with products and services shown separately.'],
  ['artisan/index.html', 'artisan', 'Maker', 'A maker profile with products, services and workshops.'],
  ['artisans/join/index.html', 'join', 'Join by voice (demonstration)', 'A demonstration of voice-first listing for makers. Nothing is uploaded or published.'],
  ['enquire/index.html', 'enquire', 'Send an enquiry (demonstration)', 'Contact a maker. A demonstration: nobody is notified.'],
  ['workshops/index.html', 'workshops', 'Workshops', 'Hands-on workshops with makers in Udaipur.'],
  ['workshop/index.html', 'workshop', 'Workshop', 'Workshop details, with enquiry and a booking demonstration.'],
  ['events/index.html', 'events', 'Events', 'Performances, festivals and walks, marked as demo or organiser-confirmed.'],
  ['event/index.html', 'event', 'Event', 'Event details with update date and confirmation status.'],
  ['book/index.html', 'book', 'Booking demonstration', 'A frontend demonstration of booking a workshop or buying from a maker. No payment is taken.'],
  ['plan/index.html', 'plan', 'Plan your journey', 'A trip planner that respects opening hours and keeps days unhurried.'],
  ['plan/trails/index.html', 'trails', 'Trails and walks', 'Themed heritage trails and time-based walks.'],
  ['plan/walks/index.html', 'walks', 'Audio walks', 'Chaptered listening walks with numbered stops.'],
  ['walk/index.html', 'walk', 'Audio walk', 'A listening walk with chapters and stops.'],
  ['plan/offline/index.html', 'offline', 'Offline pack', 'Choose what to keep for low connectivity. A simulated download.'],
  ['plan/responsible/index.html', 'responsible', 'Travel responsibly', 'Accessibility, etiquette, conservation and respectful photography.'],
  ['memories/index.html', 'memories', 'Memories', 'Saved moments and a highlight-reel demonstration with consent and privacy steps.'],
  ['passport/index.html', 'passport', 'Heritage passport', 'Badges for learning and discovery, kept in this browser only.'],
  ['labels/index.html', 'labels', 'How we label things', 'What Verified, Unverified, Illustrative, Concept and Reconstructed mean on MIRAS.'],
];

export const FONTS = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Noto+Sans+Devanagari:wght@400;500&family=Oswald:wght@300;400&display=swap';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [file, key, title, desc] of PAGES) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)} · MIRAS Udaipur</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="theme-color" content="#FFFFFF">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <meta property="og:title" content="${esc(title)} · MIRAS Udaipur">
  <meta property="og:image" content="/img/og.webp">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${FONTS}" rel="stylesheet">
</head>
<body class="m-page" data-page="${key}">
  <noscript><p style="padding:24px;font-family:sans-serif">MIRAS needs JavaScript to show this page.</p></noscript>
  <script type="module" src="/src/app.js"></script>
</body>
</html>
`);
  }
  console.log(`Wrote ${PAGES.length} pages`);
}
