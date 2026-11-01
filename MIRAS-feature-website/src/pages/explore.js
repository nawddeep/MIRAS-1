import { esc, param } from '../lib/dom.js';
import { places, collections, stories } from '../data/index.js';
import { isSaved } from '../lib/store.js';
import { placeCard, emptyState } from '../ui/components.js';
import { pageHead, subNav, reveal } from '../ui/shell.js';
import { icon, doodle } from '../ui/icons.js';
import { places as art } from '../art.js';

const GROUPS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'palaces', label: 'Palaces & havelis', match: (/** @type {string} */ c) => ['Palace', 'Haveli'].includes(c) },
  { id: 'water', label: 'Lakes & ghats', match: (/** @type {string} */ c) => ['Lake', 'Ghat'].includes(c) },
  { id: 'temples', label: 'Temples', match: (/** @type {string} */ c) => c === 'Temple' },
  { id: 'views', label: 'Gardens & views', match: (/** @type {string} */ c) => ['Garden', 'Viewpoint'].includes(c) },
  { id: 'crafts', label: 'Markets & crafts', match: (/** @type {string} */ c) => ['Market', 'Craft village'].includes(c) },
];

/** @param {HTMLElement} main */
export function render(main) {
  const state = {
    q: param('q') ?? '',
    group: GROUPS.some((g) => g.id === param('cat')) ? /** @type {string} */ (param('cat')) : 'all',
    collection: collections.some((c) => c.id === param('collection')) ? param('collection') : null,
  };

  main.innerHTML = `
    ${pageHead({ label: 'Explore', title: 'Find your way into the old city', titleHi: 'पुराने शहर की सैर', lead: 'Palaces and lakes, yes, but also ghats, bazaars and the streets where things are still made by hand.', art: art.palace })}
    ${subNav('explore')}
    <section class="m-section"><div class="m-wrap">
      <div class="m-toolbar" role="search">
        <div class="m-search"><label class="m-sr" for="q">Search places</label>${icon.search}<input id="q" type="search" placeholder="Search places, areas or stories" value="${esc(state.q)}" autocomplete="off"></div>
      </div>
      <div class="m-filters" role="group" aria-label="Filter by category" style="margin-bottom:22px">
        ${GROUPS.map((g) => `<button class="m-filter" type="button" data-group="${g.id}" aria-pressed="${g.id === state.group}">${g.label}</button>`).join('')}
      </div>
      <div class="p-collections" role="group" aria-label="Collections">
        <span class="m-label m-label--muted" style="margin:0;align-self:center">Collections</span>
        ${collections.map((c) => `<button class="m-filter" type="button" data-collection="${c.id}" aria-pressed="${c.id === state.collection}">${esc(c.title)}</button>`).join('')}
      </div>
      <div data-colinfo></div>
      <p class="m-count" data-count aria-live="polite"></p>
      <div data-results></div>
    </div></section>`;

  const results = /** @type {HTMLElement} */ (main.querySelector('[data-results]'));
  const count = /** @type {HTMLElement} */ (main.querySelector('[data-count]'));
  const colinfo = /** @type {HTMLElement} */ (main.querySelector('[data-colinfo]'));
  const input = /** @type {HTMLInputElement} */ (main.querySelector('#q'));

  const draw = () => {
    const q = state.q.trim().toLowerCase();
    const group = GROUPS.find((g) => g.id === state.group) ?? GROUPS[0];
    const list = places.filter((p) => {
      if (!group.match(p.category)) return false;
      if (state.collection && !p.collections.includes(state.collection)) return false;
      if (!q) return true;
      const storyText = stories.filter((s) => s.placeId === p.id).map((s) => s.title).join(' ');
      return `${p.name} ${p.nameHi} ${p.category} ${p.area} ${p.summary} ${p.interests.join(' ')} ${storyText}`.toLowerCase().includes(q);
    });
    const col = collections.find((c) => c.id === state.collection);
    colinfo.innerHTML = col ? `<div class="m-note m-note--paper" style="margin-bottom:22px">${icon.info}<div><p><strong>${esc(col.title)}</strong> <span lang="hi" class="m-muted">${esc(col.titleHi)}</span> · ${esc(col.blurb)}</p></div></div>` : '';
    count.textContent = `${list.length} ${list.length === 1 ? 'place' : 'places'}${q ? ` matching “${state.q.trim()}”` : ''}`;
    results.innerHTML = list.length
      ? `<div class="m-grid m-grid--3${!q && group.id === 'all' && !col ? ' m-grid--lead' : ''}">${list.map((p) => placeCard(p, { saved: isSaved(p.id) })).join('')}</div>`
      : emptyState({
        title: 'Nothing matches that yet',
        body: `We couldn't find a place for “${esc(state.q.trim())}”${group.id !== 'all' ? ` in ${esc(group.label)}` : ''}${col ? ` within ${esc(col.title)}` : ''}. Try a broader word, or clear the filters.`,
        art: doodle.compass,
        action: '<button class="m-btn m-btn--ghost" type="button" data-clear>Clear search and filters</button>',
      });
    const url = new URL(location.href);
    url.search = '';
    if (state.q.trim()) url.searchParams.set('q', state.q.trim());
    if (state.group !== 'all') url.searchParams.set('cat', state.group);
    if (state.collection) url.searchParams.set('collection', state.collection);
    history.replaceState(null, '', url);
    main.querySelectorAll('[data-group]').forEach((b) => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.group === state.group)));
    main.querySelectorAll('[data-collection]').forEach((b) => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.collection === state.collection)));
    reveal(results);
  };

  input.addEventListener('input', () => { state.q = input.value; draw(); });
  main.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const g = /** @type {HTMLElement | null} */ (t.closest('[data-group]'));
    const c = /** @type {HTMLElement | null} */ (t.closest('[data-collection]'));
    if (g) { state.group = g.dataset.group ?? 'all'; draw(); }
    if (c) { state.collection = state.collection === c.dataset.collection ? null : c.dataset.collection ?? null; draw(); }
    if (t.closest('[data-clear]')) { state.q = ''; input.value = ''; state.group = 'all'; state.collection = null; draw(); input.focus(); }
  });
  draw();
}
