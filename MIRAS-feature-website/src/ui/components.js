// Shared HTML templates. Only things genuinely reused across pages live here.

import { esc, fmtDuration, fmtDate, fmtINR } from '../lib/dom.js';
import { icon, doodle } from './icons.js';
import { places as art } from '../art.js';
import { getMedia, getPlace, getArtisan } from '../data/index.js';

/** @typedef {import('../data/types.js').Verification} Verification */
/** @typedef {import('../data/types.js').SourceType} SourceType */

const VERIFY = {
  Verified: { cls: 'verified', ic: icon.verified, title: 'Checked by a second person against a source' },
  Unverified: { cls: 'unverified', ic: icon.question, title: 'Not yet checked by MIRAS' },
  Illustrative: { cls: 'illustrative', ic: icon.pencil, title: 'Sample or illustrative content' },
  Concept: { cls: 'concept', ic: icon.concept, title: 'Not built yet' },
  Reconstructed: { cls: 'reconstructed', ic: icon.layers, title: 'An interpretation of how something may have looked' },
};
const SOURCE = {
  History: { cls: 'history', ic: icon.history },
  'Oral tradition': { cls: 'oral', ic: icon.oral },
  Legend: { cls: 'legend', ic: icon.legend },
};

/** Verification status. Text and icon, never colour alone. @param {Verification} v */
export const statusBadge = (v) => {
  const s = VERIFY[v];
  return `<span class="m-badge m-badge--${s.cls}">${s.ic}<span>${esc(v)}</span></span>`;
};
/** @param {SourceType} t */
export const sourceBadge = (t) => {
  const s = SOURCE[t];
  return `<span class="m-badge m-badge--${s.cls}">${s.ic}<span>${esc(t)}</span></span>`;
};
/** @param {string} text @param {'demo'|'estimate'|'local'|'neutral'|'concept'} [kind] */
export const tag = (text, kind = 'neutral') => `<span class="m-badge m-badge--${kind}">${kind === 'concept' ? icon.concept : kind === 'estimate' ? icon.sparkle : kind === 'demo' ? icon.pencil : ''}<span>${esc(text)}</span></span>`;
export const conceptBadge = () => tag('Concept', 'concept');
export const demoBadge = (text = 'Demonstration') => tag(text, 'demo');

/** Source type and reference, always visible. @param {{sourceType: SourceType, sourceReference: string, verification: Verification, lastUpdated: string}} s */
export const sourceBox = (s) => `
  <dl class="m-source">
    <dt>Source type</dt><dd>${sourceBadge(s.sourceType)}</dd>
    <dt>Source reference</dt><dd>${esc(s.sourceReference)}</dd>
    <dt>Status</dt><dd>${statusBadge(s.verification)} <span class="m-muted m-body-sm">Last updated ${fmtDate(s.lastUpdated)}</span></dd>
  </dl>`;

/** Line drawing for a key: a place drawing from art.js, else a doodle. @param {string | undefined} key */
export const drawingFor = (key) =>
  (key && (art[/** @type {keyof typeof art} */ (key)] || doodle[/** @type {keyof typeof doodle} */ (key)])) || doodle.postcard;

/**
 * An image with reserved dimensions and an ink-drawing fallback if it is missing or fails.
 * @param {{mediaId?: string | null, artKey?: string, alt?: string, ratio?: string, eager?: boolean, cls?: string, showLabel?: boolean}} o
 */
export function frameImage({ mediaId, artKey, alt = '', ratio = '4 / 3', eager = false, cls = '', showLabel = true }) {
  const m = getMedia(mediaId);
  const drawing = drawingFor(artKey);
  const isDoodle = !(artKey && art[/** @type {keyof typeof art} */ (artKey)]);
  const fallback = `<div class="m-art${isDoodle ? ' m-art--doodle' : ''}" ${m ? 'hidden' : ''}>${drawing}</div>`;
  if (!m) {
    return `<div class="m-frame-img ${cls}" style="aspect-ratio:${ratio}" role="img" aria-label="${esc(alt || 'Line drawing')} (line drawing)">${fallback}${showLabel ? '<span class="m-img-label">Drawing</span>' : ''}</div>`;
  }
  return `<div class="m-frame-img ${cls}" style="aspect-ratio:${ratio}">
    <img src="${m.src}" alt="${esc(alt || m.alt)}" width="${m.width ?? ''}" height="${m.height ?? ''}" ${eager ? '' : 'loading="lazy"'} decoding="async" data-fallback>
    ${fallback}
    ${showLabel ? `<span class="m-img-label">${esc(m.label)}</span>` : ''}
  </div>`;
}

/** Wire up graceful fallbacks for any images rendered with frameImage. @param {ParentNode} [root] */
export function bindImageFallbacks(root = document) {
  root.querySelectorAll('img[data-fallback]').forEach((n) => {
    const img = /** @type {HTMLImageElement} */ (n);
    const fail = () => {
      const frame = img.closest('.m-frame-img');
      frame?.classList.add('is-broken');
      frame?.querySelector('.m-art')?.removeAttribute('hidden');
      const label = frame?.querySelector('.m-img-label');
      if (label) label.textContent = 'Image unavailable · drawing shown';
    };
    if (img.complete && img.naturalWidth === 0) fail();
    else img.addEventListener('error', fail, { once: true });
  });
}

/** @param {import('../data/types.js').Place} p @param {{saved?: boolean, compact?: boolean, useImage?: boolean}} [o] */
export function placeCard(p, { saved = false, compact = false, useImage = false } = {}) {
  return `<article class="m-card" data-reveal>
    ${frameImage({ mediaId: useImage ? p.imageId : null, artKey: p.artKey, alt: `${p.name}`, ratio: compact ? '3 / 2' : '4 / 3', showLabel: useImage && !!p.imageId })}
    <div class="m-badges"><span class="m-label m-label--muted" style="margin:0">${esc(p.category)} · ${esc(p.area.split(',')[0])}</span></div>
    <h3 class="m-card-title"><a href="/place/?id=${p.id}">${esc(p.name)}</a></h3>
    <p class="m-card-sub" lang="hi">${esc(p.nameHi)}</p>
    ${compact ? '' : `<p>${esc(p.summary)}</p>`}
    <ul class="m-meta"><li>${icon.clock}${fmtDuration(p.visitMinutes)} visit</li><li>${statusBadge(p.verification)}</li></ul>
    <div class="m-card-actions">${saveButton(p.id, saved)}</div>
  </article>`;
}

/** @param {string} id @param {boolean} saved */
export const saveButton = (id, saved) =>
  `<button class="m-btn m-btn--quiet m-btn--sm" type="button" data-save="${id}" aria-pressed="${saved}">${saved ? icon.bookmarkOn : icon.bookmark}<span>${saved ? 'Saved to trip' : 'Save to trip'}</span></button>`;

/** @param {import('../data/types.js').Story} s */
export function storyRow(s) {
  const p = getPlace(s.placeId);
  return `<article class="m-row" data-reveal>
    <div class="m-row-art">${p ? drawingFor(p.artKey) : ''}</div>
    <div>
      <div class="m-badges" style="margin-bottom:10px">${sourceBadge(s.sourceType)}${statusBadge(s.verification)}</div>
      <h3><a href="/story/?id=${s.id}">${esc(s.title)}</a></h3>
      <p>${esc(s.dek)}</p>
      <p class="m-body-sm m-muted"><strong style="color:var(--charcoal)">Source:</strong> ${esc(s.sourceReference)}</p>
    </div>
    <div class="m-row-side">${p ? esc(p.name) : ''}</div>
  </article>`;
}

/** Maker card in a postcard frame. @param {import('../data/types.js').Artisan} a */
export function makerCard(a) {
  const near = getPlace(a.nearPlaceId);
  return `<article class="m-card m-postcard" data-reveal>
    <span class="m-perf" aria-hidden="true">${doodle[/** @type {keyof typeof doodle} */ (a.doodle)] ?? ''}</span>
    <p class="m-label" style="margin:0">${esc(a.craft)}</p>
    <p class="m-card-sub" lang="hi" style="margin:0">${esc(a.craftHi)}</p>
    <h3 class="m-card-title" style="max-width:14ch"><a href="/artisan/?id=${a.id}">${esc(a.studio)}</a></h3>
    <p>${esc(a.intro)}</p>
    <ul class="m-meta"><li>${icon.pin}${esc(a.area)}${near ? `, near ${esc(near.name)}` : ''}</li><li>${icon.globe}${a.languages.map(esc).join(', ')}</li></ul>
    <div class="m-badges">${tag('Demonstration profile', 'demo')}</div>
  </article>`;
}

/** @param {import('../data/types.js').Workshop} w */
export function workshopRow(w) {
  const a = getArtisan(w.artisanId);
  return `<article class="m-row" data-reveal>
    <div class="m-row-art">${a ? doodle[/** @type {keyof typeof doodle} */ (a.doodle)] ?? '' : ''}</div>
    <div>
      <p class="m-label" style="margin-bottom:8px">${esc(w.craft)}</p>
      <h3><a href="/workshop/?id=${w.id}">${esc(w.title)}</a></h3>
      <p>${esc(w.description)}</p>
      <ul class="m-meta"><li>${icon.clock}${fmtDuration(w.durationMin)}</li><li>${icon.globe}${w.languages.map(esc).join(', ')}</li><li>Up to ${w.groupSize} people</li></ul>
    </div>
    <div class="m-row-side"><strong style="font:500 22px var(--font-serif);color:var(--heritage-deep)">${fmtINR(w.cost.amount)}</strong><br>${esc(w.cost.note)}<br><span style="display:inline-block;margin-top:8px">${statusBadge(w.verification)}</span></div>
  </article>`;
}

/** @param {import('../data/types.js').EventItem} e */
export function eventTicket(e) {
  const p = getPlace(e.placeId);
  const [big, small] = e.month ? [e.month.slice(0, 3), e.kind] : ['—', 'Date varies'];
  return `<article class="m-ticket" data-reveal>
    <div class="m-ticket-date"><b style="text-transform:capitalize">${esc(big)}</b><span>${esc(small)}</span></div>
    <div class="m-ticket-body">
      <div class="m-badges">${e.organiserConfirmed ? tag('Organiser-confirmed', 'local') : e.listingType === 'Demo listing' ? tag('Demo listing', 'demo') : tag('Not confirmed by organiser', 'neutral')}</div>
      <h3><a href="/event/?id=${e.id}">${esc(e.title)}</a></h3>
      <ul class="m-meta"><li>${icon.calendar}${esc(e.when)}</li>${p ? `<li>${icon.pin}${esc(p.name)}</li>` : ''}</ul>
    </div>
  </article>`;
}

/** @param {{title: string, body: string, art?: string, action?: string}} o */
export const emptyState = ({ title, body, art = doodle.compass, action = '' }) => `
  <div class="m-empty" role="status">
    <div class="m-empty-art">${art}</div>
    <h3>${esc(title)}</h3>
    <p>${body}</p>
    ${action}
  </div>`;

/** @param {string} html @param {'paper'|'demo'|''} [kind] */
export const note = (html, kind = '') => `<div class="m-note${kind ? ` m-note--${kind}` : ''}">${kind === 'demo' ? icon.pencil : icon.info}<div>${html}</div></div>`;
