// Entry for every page except the homepage (which uses src/main.js because it carries the hero).
// Each HTML shell sets <body data-page="..."> and this file renders the chrome and the page.

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import { mountChrome, reveal } from './ui/shell.js';
import { icon } from './ui/icons.js';

/** page key → [nav section, loader] */
const PAGES = /** @type {Record<string, [string, () => Promise<{render: (main: HTMLElement) => void | Promise<void>}>]>} */ ({
  explore: ['explore', () => import('./pages/explore.js')],
  nearby: ['explore', () => import('./pages/nearby.js')],
  markets: ['explore', () => import('./pages/markets.js')],
  phrases: ['explore', () => import('./pages/phrases.js')],
  camera: ['explore', () => import('./pages/camera.js')],
  hidden: ['explore', () => import('./pages/hidden.js')],
  place: ['explore', () => import('./pages/place.js')],
  stories: ['stories', () => import('./pages/stories.js')],
  story: ['stories', () => import('./pages/story.js')],
  immersive: ['stories', () => import('./pages/immersive.js')],
  artisans: ['artisans', () => import('./pages/artisans.js')],
  artisan: ['artisans', () => import('./pages/artisan.js')],
  join: ['artisans', () => import('./pages/join.js')],
  enquire: ['artisans', () => import('./pages/enquire.js')],
  workshops: ['workshops', () => import('./pages/workshops.js')],
  workshop: ['workshops', () => import('./pages/workshop.js')],
  events: ['workshops', () => import('./pages/events.js')],
  event: ['workshops', () => import('./pages/event.js')],
  book: ['workshops', () => import('./pages/book.js')],
  plan: ['plan', () => import('./pages/plan.js')],
  trails: ['plan', () => import('./pages/trails.js')],
  walks: ['plan', () => import('./pages/walks.js')],
  walk: ['plan', () => import('./pages/walk.js')],
  offline: ['plan', () => import('./pages/offline.js')],
  responsible: ['plan', () => import('./pages/responsible.js')],
  memories: ['memories', () => import('./pages/memories.js')],
  passport: ['passport', () => import('./pages/passport.js')],
  labels: ['', () => import('./pages/labels.js')],
});

async function boot() {
  const key = document.body.dataset.page || '';
  const entry = PAGES[key];
  document.body.insertAdjacentHTML('afterbegin', `
    <a class="m-skip" href="#main">Skip to content</a>
    <header id="header"></header>
    <div class="m-demo-strip m-scope"><div class="m-wrap">${icon.pencil}<span>Frontend demonstration. Sample data; nothing you do here is sent, stored on a server, booked or charged.</span></div></div>
    <main id="main" class="m-scope" tabindex="-1"></main>
    <footer id="footer"></footer>`);
  const header = /** @type {HTMLElement} */ (document.getElementById('header'));
  const footer = /** @type {HTMLElement} */ (document.getElementById('footer'));
  const main = /** @type {HTMLElement} */ (document.getElementById('main'));
  mountChrome({ section: entry?.[0] ?? '', header, footer });
  if (!entry) {
    main.innerHTML = '<section class="m-section"><div class="m-wrap"><h1 class="m-h1">Page not found</h1><p><a class="m-link" href="/">Back to the homepage</a></p></div></section>';
    return;
  }
  try {
    const mod = await entry[1]();
    await mod.render(main);
  } catch (err) {
    console.error(err);
    main.innerHTML = '<section class="m-section"><div class="m-wrap m-narrow"><h1 class="m-h1">Something went wrong loading this page.</h1><p class="m-lead">Please reload. If it keeps happening, go back to the <a href="/">homepage</a>.</p></div></section>';
  }
  reveal(main);
}

boot();
