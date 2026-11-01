// Homepage sections below the locked hero. The editorial copy is in index.html;
// this file fills the data-driven slots from the shared data layer.

import { esc, fmtDuration } from '../lib/dom.js';
import { places, collections, artisans, workshops, events, hiddenPlaces, trails, memories, badges, getPlace, getStory } from '../data/index.js';
import { doodle, icon } from '../ui/icons.js';
import { drawingFor, sourceBadge, statusBadge, makerCard, workshopRow, eventTicket, tag, sourceBox } from '../ui/components.js';

/** @param {HTMLElement | null} root */
export function renderHome(root) {
  if (!root) return;
  /** @param {string} name @param {string} html */
  const fill = (name, html) => { const el = root.querySelector(`[data-slot="${name}"]`); if (el) el.innerHTML = html; };
  /** @param {string} key */
  const drawing = (key) => drawingFor(key);

  // 02 · place index with a drawing that follows hover and focus
  const first = places[0];
  fill('place-index', `
    <figure class="h-index-preview" aria-hidden="true" data-reveal>
      <div class="h-index-art" data-preview>${drawing(first.artKey)}</div>
      <figcaption><span class="m-hand" data-preview-name>${esc(first.name)}</span><span class="h-index-cat" data-preview-cat>${esc(first.category)} · ${fmtDuration(first.visitMinutes)}</span></figcaption>
    </figure>
    <ol class="h-index-list">
      ${places.map((p, i) => `<li data-reveal><a href="/place/?id=${p.id}" data-key="${p.artKey}" data-name="${esc(p.name)}" data-cat="${esc(p.category)} · ${fmtDuration(p.visitMinutes)}">
        <span class="h-index-n">${String(i + 1).padStart(2, '0')}</span>
        <span class="h-index-name">${esc(p.name)}</span>
        <span class="h-index-hi" lang="hi">${esc(p.nameHi)}</span>
        <span class="h-index-type">${esc(p.category)}</span>
      </a></li>`).join('')}
    </ol>`);
  const prev = root.querySelector('[data-preview]');
  const prevName = root.querySelector('[data-preview-name]');
  const prevCat = root.querySelector('[data-preview-cat]');
  /** @param {Event} e */
  const show = (e) => {
    const a = /** @type {HTMLElement} */ (e.target).closest('a[data-key]');
    if (!a || !prev || !prevName || !prevCat) return;
    const el = /** @type {HTMLElement} */ (a);
    prev.innerHTML = drawing(el.dataset.key ?? '');
    prevName.textContent = el.dataset.name ?? '';
    prevCat.textContent = el.dataset.cat ?? '';
  };
  root.querySelector('.h-index-list')?.addEventListener('mouseover', show);
  root.querySelector('.h-index-list')?.addEventListener('focusin', show);

  fill('collections', `<p class="m-label m-label--muted">Or start with a collection</p><ul>${collections.map((c) => `
    <li data-reveal><a href="/explore/?collection=${c.id}"><span class="h-col-title">${esc(c.title)}</span><span class="h-col-hi" lang="hi">${esc(c.titleHi)}</span><span class="h-col-blurb">${esc(c.blurb)}</span></a></li>`).join('')}</ul>`);

  // 03 · stories: one feature in a journal spread, three more in a column
  const feature = /** @type {import('../data/types.js').Story} */ (getStory('s-sajjangarh'));
  const fp = getPlace(feature.placeId);
  const more = ['s-pichola-name', 's-jagdish-steps', 's-gangaur'].map((id) => getStory(id)).filter((s) => !!s);
  fill('stories', `
    <article class="h-feature" data-reveal>
      <figure class="m-polaroid m-tilt-l h-feature-pic">
        <div class="m-frame-img" role="img" aria-label="Line drawing of ${esc(fp?.name ?? '')}"><div class="m-art">${drawing(fp?.artKey ?? '')}</div></div>
        <figcaption>${esc(fp?.name ?? '')}, from the lake road</figcaption>
      </figure>
      <div class="h-feature-text">
        <div class="m-badges">${sourceBadge(feature.sourceType)}${statusBadge(feature.verification)}</div>
        <h3 class="m-h2"><a href="/story/?id=${feature.id}">${esc(feature.title)}</a></h3>
        <p class="m-lead">${esc(feature.body[0])}</p>
        ${sourceBox(feature)}
        <a class="m-link" href="/story/?id=${feature.id}">Read, or listen to the story <span class="m-arrow" aria-hidden="true">→</span></a>
      </div>
    </article>
    <div class="h-more-stories">
      ${more.map((s) => `<article class="h-story-mini" data-reveal>
        <div class="m-badges">${sourceBadge(s.sourceType)}${statusBadge(s.verification)}</div>
        <h3 class="m-h4"><a href="/story/?id=${s.id}">${esc(s.title)}</a></h3>
        <p class="m-body-sm">${esc(s.dek)}</p>
        <p class="m-body-sm m-muted"><strong>Source:</strong> ${esc(s.sourceReference)}</p>
      </article>`).join('')}
    </div>`);

  // 04 · makers
  fill('makers-note', `${icon.pencil}<div><p><strong>Sample profiles.</strong> The makers shown here are demonstration profiles, not real people. Real makers will be listed only with their written consent, and can correct their own page.</p></div>`);
  fill('makers', artisans.slice(0, 2).map((a, i) => `<div class="h-postcard h-postcard--${i}">${makerCard(a)}</div>`).join(''));

  // 05 · something less expected
  fill('hidden', hiddenPlaces.slice(0, 3).map((h) => `
    <article class="h-hidden" data-reveal>
      <div class="h-hidden-art m-doodle">${doodle[/** @type {keyof typeof doodle} */ (h.doodle)] ?? ''}</div>
      <div class="m-badges">${statusBadge(h.verification)}${tag(`Sensitivity: ${h.sensitivity}`, 'neutral')}</div>
      <h3 class="m-h4">${esc(h.title)}</h3>
      <p class="m-body-sm">${esc(h.blurb)}</p>
      <p class="m-body-sm m-muted">${esc(h.sensitivityNote)}</p>
    </article>`).join('') + `<p class="h-hidden-more" data-reveal><a class="m-link" href="/explore/hidden/">How Hidden Udaipur is sourced and moderated <span class="m-arrow" aria-hidden="true">→</span></a></p>`);
  fill('camera-art', doodle.camera);

  // 06 · experiences
  fill('workshops', `<div>${workshops.slice(0, 3).map(workshopRow).join('')}</div>`);
  fill('events', events.slice(0, 3).map(eventTicket).join(''));

  // 07 · plan
  fill('trails', trails.slice(0, 6).map((t) => `<li><a href="/plan/trails/#${t.id}"><span>${esc(t.title)}</span><span class="m-muted">${esc(t.theme)} · ${fmtDuration(t.durationMin)}</span></a></li>`).join(''));

  // 08 · memories and passport
  fill('polaroids', memories.slice(0, 3).map((m, i) => {
    const p = getPlace(m.placeId);
    return `<figure class="m-polaroid h-pol h-pol--${i}" data-reveal>
      <div class="m-frame-img" role="img" aria-label="Line drawing standing in for a visitor's photo of ${esc(p?.name ?? '')}"><div class="m-art">${drawing(m.artKey)}</div><span class="m-img-label">Sample · drawing</span></div>
      <figcaption>${esc(m.caption)}</figcaption>
    </figure>`;
  }).join(''));
  fill('stamps', badges.slice(0, 4).map((b, i) => `<span class="m-stamp${i % 2 ? ' m-stamp--blue' : ''} h-stamp">${doodle[/** @type {keyof typeof doodle} */ (b.doodle)] ?? ''}<b>${esc(b.title)}</b><span lang="hi">${esc(b.titleHi)}</span></span>`).join(''));
}
