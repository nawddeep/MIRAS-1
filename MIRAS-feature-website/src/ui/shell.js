// Site chrome: header, mobile menu, footer, page heads, sub-navigation and reveals.

import { $, $$, esc, toast, trapFocus, reducedMotion } from '../lib/dom.js';
import { getSaved, toggleSaved } from '../lib/store.js';
import { icon } from './icons.js';
import { statusBadge, sourceBadge, bindImageFallbacks } from './components.js';

export const NAV = [
  { key: 'explore', label: 'Explore', href: '/explore/' },
  { key: 'stories', label: 'Stories', href: '/stories/' },
  { key: 'artisans', label: 'Artisans', href: '/artisans/' },
  { key: 'workshops', label: 'Workshops & Events', href: '/workshops/' },
  { key: 'plan', label: 'Plan', href: '/plan/' },
  { key: 'memories', label: 'Memories', href: '/memories/' },
  { key: 'passport', label: 'Passport', href: '/passport/' },
];

/** Second-level navigation for each section. */
export const SUBNAV = {
  explore: [
    ['Discover', '/explore/'], ['Nearby', '/explore/nearby/'], ['Markets', '/explore/markets/'],
    ['Phrase help', '/explore/phrases/'], ['Camera story', '/explore/camera/'], ['Hidden Udaipur', '/explore/hidden/'],
  ],
  stories: [['All stories', '/stories/'], ['AR & VR views', '/stories/immersive/']],
  artisans: [['Directory', '/artisans/'], ['Join by voice', '/artisans/join/'], ['Send an enquiry', '/enquire/']],
  workshops: [['Workshops', '/workshops/'], ['Events', '/events/'], ['Booking demo', '/book/']],
  plan: [
    ['Trip planner', '/plan/'], ['Trails', '/plan/trails/'], ['Audio walks', '/plan/walks/'],
    ['Offline pack', '/plan/offline/'], ['Travel responsibly', '/plan/responsible/'],
  ],
};

const MORE = [
  ['Nearby places', '/explore/nearby/'], ['Markets', '/explore/markets/'], ['Phrase help', '/explore/phrases/'],
  ['Camera story', '/explore/camera/'], ['Hidden Udaipur', '/explore/hidden/'], ['Trails', '/plan/trails/'],
  ['Audio walks', '/plan/walks/'], ['AR & VR views', '/stories/immersive/'], ['Events', '/events/'],
  ['Booking demo', '/book/'], ['Join as a maker', '/artisans/join/'], ['How we label things', '/labels/'],
];

/** @param {string} section */
export function headerHTML(section) {
  const count = getSaved().length;
  return `
  <div class="m-wrap m-header-inner">
    <a class="m-brand" href="/" aria-label="MIRAS home"><span class="m-brand-mark">MIRAS</span><span class="m-brand-sub" lang="hi">उदयपुर</span></a>
    <nav class="m-nav" aria-label="Main">
      ${NAV.map((n) => `<a href="${n.href}"${n.key === section ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}
    </nav>
    <a class="m-trip" href="/plan/" aria-label="Your trip: ${count} saved places">${icon.bookmark}<span>Trip</span><span class="m-trip-count" data-trip-count>${count}</span></a>
    <button class="m-menu-btn" type="button" aria-expanded="false" aria-controls="m-sheet" data-menu-open><span></span><span></span><span class="m-sr">Open menu</span></button>
  </div>
  <div class="m-sheet m-scope" id="m-sheet" role="dialog" aria-modal="true" aria-label="Menu" hidden>
    <div class="m-sheet-top"><a class="m-brand" href="/"><span class="m-brand-mark">MIRAS</span></a><button class="m-close" type="button" data-menu-close aria-label="Close menu">${icon.close}</button></div>
    <nav class="m-sheet-main" aria-label="Main">${NAV.map((n) => `<a href="${n.href}"${n.key === section ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}</nav>
    <nav class="m-sheet-more" aria-label="More">${MORE.map(([l, h]) => `<a href="${h}">${l}</a>`).join('')}</nav>
  </div>`;
}

export function footerHTML() {
  /** @param {string} title @param {string[][]} links */
  const col = (title, links) => `<div><h2>${title}</h2><ul>${links.map(([l, h]) => `<li><a href="${h}">${l}</a></li>`).join('')}</ul></div>`;
  return `
  <div class="m-footer-band" role="img" aria-label="Ink drawing of boats on the lake"></div>
  <div class="m-wrap">
    <div class="m-footer-top">
      <div class="m-footer-brand">
        <p class="m-footer-mark">MIRAS</p>
        <p class="m-footer-tag">Heritage, handed down.</p>
        <p class="m-footer-hi" lang="hi">विरासत, जो आगे बढ़ती है · उदयपुर</p>
      </div>
      ${col('Explore', [['Discover places', '/explore/'], ['Nearby', '/explore/nearby/'], ['Markets', '/explore/markets/'], ['Hidden Udaipur', '/explore/hidden/'], ['Phrase help', '/explore/phrases/']])}
      ${col('Stories & makers', [['Stories', '/stories/'], ['AR & VR views', '/stories/immersive/'], ['Artisans', '/artisans/'], ['Join by voice', '/artisans/join/'], ['Camera story', '/explore/camera/']])}
      ${col('Do & plan', [['Workshops', '/workshops/'], ['Events', '/events/'], ['Trip planner', '/plan/'], ['Trails & walks', '/plan/trails/'], ['Travel responsibly', '/plan/responsible/']])}
      ${col('Keep', [['Memories', '/memories/'], ['Passport', '/passport/'], ['Offline pack', '/plan/offline/'], ['Booking demo', '/book/'], ['How we label things', '/labels/']])}
    </div>
    <div class="m-footer-legend" aria-label="Labels used on this site">
      <p>Every story shows its source type:</p>${sourceBadge('History')}${sourceBadge('Oral tradition')}${sourceBadge('Legend')}
      <p>and its status:</p>${statusBadge('Verified')}${statusBadge('Unverified')}${statusBadge('Illustrative')}${statusBadge('Concept')}${statusBadge('Reconstructed')}
    </div>
    <div class="m-footer-small">
      <p>A frontend demonstration. Places are real; listings, makers, prices and reviews are samples. Nothing is sent, stored on a server, booked or charged.</p>
      <p>© 2026 MIRAS · Team Impala</p>
    </div>
  </div>`;
}

/** Wire the mobile menu. @param {HTMLElement} header */
function bindMenu(header) {
  const open = /** @type {HTMLButtonElement} */ ($('[data-menu-open]', header));
  const sheet = /** @type {HTMLElement} */ ($('#m-sheet', header));
  let release = () => {};
  const close = () => {
    sheet.hidden = true;
    open.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
    release();
  };
  open.addEventListener('click', () => {
    sheet.hidden = false;
    open.setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';
    release = trapFocus(sheet, close);
  });
  $('[data-menu-close]', sheet)?.addEventListener('click', close);
  sheet.addEventListener('click', (e) => { if (/** @type {HTMLElement} */ (e.target).closest('a')) close(); });
  matchMedia('(min-width: 1081px)').addEventListener('change', (e) => { if (e.matches && !sheet.hidden) close(); });
  return close;
}

/**
 * Render header and footer into the page.
 * @param {{section: string, home?: boolean, header: HTMLElement, footer: HTMLElement}} o
 */
export function mountChrome({ section, home = false, header, footer }) {
  header.className = `m-header m-scope${home ? ' m-header--home' : ''}`;
  header.innerHTML = headerHTML(section);
  footer.className = 'm-footer m-scope';
  footer.innerHTML = footerHTML();
  const closeMenu = bindMenu(header);
  window.addEventListener('miras:store', () => {
    $$('[data-trip-count]').forEach((n) => (n.textContent = String(getSaved().length)));
  });
  bindSaveButtons();
  return { closeMenu };
}

/** Delegate every "Save to trip" button on the page. */
function bindSaveButtons() {
  document.addEventListener('click', (e) => {
    const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-save]'));
    if (!b) return;
    const id = /** @type {string} */ (b.dataset.save);
    const on = toggleSaved(id);
    $$(`[data-save="${id}"]`).forEach((btn) => {
      btn.setAttribute('aria-pressed', String(on));
      btn.innerHTML = `${on ? icon.bookmarkOn : icon.bookmark}<span>${on ? 'Saved to trip' : 'Save to trip'}</span>`;
    });
    toast(on ? 'Saved to your trip, in this browser only.' : 'Removed from your trip.');
  });
}

/**
 * @param {{label: string, title: string, titleHi?: string, lead?: string, art?: string, extra?: string}} o
 */
export const pageHead = ({ label, title, titleHi = '', lead = '', art = '', extra = '' }) => `
  <header class="m-pagehead">
    <div class="m-wrap m-pagehead-grid">
      <div>
        <p class="m-label">${label}</p>
        <h1 class="m-h1">${esc(title)}</h1>
        ${titleHi ? `<p class="m-hi-title" lang="hi">${esc(titleHi)}</p>` : ''}
        ${lead ? `<p class="m-lead">${lead}</p>` : ''}
        ${extra}
      </div>
      ${art ? `<div class="m-pagehead-art m-doodle">${art}</div>` : ''}
    </div>
  </header>`;

/** @param {keyof typeof SUBNAV} section */
export function subNav(section) {
  const items = SUBNAV[section];
  if (!items) return '';
  const here = location.pathname.replace(/index\.html$/, '');
  return `<nav class="m-subnav" aria-label="In this section"><div class="m-wrap"><ul>${items
    .map(([l, h]) => `<li><a href="${h}"${here === h ? ' aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul></div></nav>`;
}

/** Fade elements in as they scroll into view. Skipped when reduced motion is preferred. @param {ParentNode} [root] */
export function reveal(root = document) {
  bindImageFallbacks(root);
  if (reducedMotion() || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('m-reveal-ready');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  root.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => io.observe(el));
}

/** Simple not-found block for detail pages with a bad or missing id. @param {string} what @param {string} back @param {string} backLabel */
export const notFound = (what, back, backLabel) => `
  <section class="m-section"><div class="m-wrap m-narrow">
    <p class="m-label">Not found</p>
    <h1 class="m-h1">We couldn't find that ${esc(what)}.</h1>
    <p class="m-lead">The link may be out of date. Nothing is broken on your side.</p>
    <a class="m-btn" href="${back}">${esc(backLabel)} ${icon.arrow}</a>
  </div></section>`;
