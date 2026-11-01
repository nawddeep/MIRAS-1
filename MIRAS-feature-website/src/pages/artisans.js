import { esc } from '../lib/dom.js';
import { artisans, products, workshops } from '../data/index.js';
import { makerCard, emptyState, note } from '../ui/components.js';
import { pageHead, subNav, reveal } from '../ui/shell.js';
import { icon, doodle } from '../ui/icons.js';

/** @param {HTMLElement} main */
export function render(main) {
  const crafts = ['All', ...new Set(artisans.map((a) => a.craft))];
  let craft = 'All', q = '';
  main.innerHTML = `
    ${pageHead({ label: 'Artisans', title: 'Meet local makers', titleHi: 'स्थानीय कारीगर', lead: 'Painters, dyers, bangle-makers, potters, puppet-makers and silversmiths, in the lanes behind the sights.', art: doodle.brush })}
    ${subNav('artisans')}
    <section class="m-section"><div class="m-wrap">
      ${note('<p><strong>These are demonstration profiles.</strong> They are not real people or businesses. Real makers will be listed only with their written consent for the listing and any photos, and will be able to correct their own page.</p>', 'demo')}
      <div class="m-toolbar" style="margin-top:32px" role="search">
        <div class="m-search"><label class="m-sr" for="mq">Search makers</label>${icon.search}<input id="mq" type="search" placeholder="Search a craft, a studio or an area" autocomplete="off"></div>
      </div>
      <div class="m-filters" role="group" aria-label="Filter by craft" style="margin-bottom:22px">
        ${crafts.map((c) => `<button class="m-filter" type="button" data-craft="${esc(c)}" aria-pressed="${c === 'All'}">${esc(c)}</button>`).join('')}
      </div>
      <p class="m-count" data-count aria-live="polite"></p>
      <div data-list></div>
      <div class="p-split" style="margin-top:56px">
        <div class="p-box p-box--paper"><h3>Products and services, kept apart</h3><p style="margin:0">On every profile, things a maker sells (${products.length} sample products) are listed separately from things they offer to do for you, and from workshops (${workshops.length} sample workshops).</p></div>
        <div class="p-box"><h3>Are you a maker?</h3><p>Describe your craft by speaking, in Hindi or English. You check the draft before anything is shown.</p><a class="m-link" href="/artisans/join/">Try the voice listing demo <span class="m-arrow" aria-hidden="true">→</span></a></div>
      </div>
    </div></section>`;

  const list = /** @type {HTMLElement} */ (main.querySelector('[data-list]'));
  const count = /** @type {HTMLElement} */ (main.querySelector('[data-count]'));
  const draw = () => {
    const n = q.trim().toLowerCase();
    const items = artisans.filter((a) => (craft === 'All' || a.craft === craft) && (!n || `${a.studio} ${a.craft} ${a.craftHi} ${a.area} ${a.intro}`.toLowerCase().includes(n)));
    count.textContent = `${items.length} ${items.length === 1 ? 'maker' : 'makers'}`;
    list.innerHTML = items.length
      ? `<div class="m-grid m-grid--3">${items.map(makerCard).join('')}</div>`
      : emptyState({ title: 'No makers match that', body: 'Try another craft or a shorter search.', art: doodle.brush, action: '<button class="m-btn m-btn--ghost" type="button" data-reset>Show all makers</button>' });
    main.querySelectorAll('[data-craft]').forEach((b) => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.craft === craft)));
    reveal(list);
  };
  const input = /** @type {HTMLInputElement} */ (main.querySelector('#mq'));
  input.addEventListener('input', () => { q = input.value; draw(); });
  main.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const b = /** @type {HTMLElement | null} */ (t.closest('[data-craft]'));
    if (b) { craft = b.dataset.craft ?? 'All'; draw(); }
    if (t.closest('[data-reset]')) { craft = 'All'; q = ''; input.value = ''; draw(); }
  });
  draw();
}
