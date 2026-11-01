import { esc, fmtDate } from '../lib/dom.js';
import { markets, getPlace, localTips } from '../data/index.js';
import { statusBadge, tag, emptyState } from '../ui/components.js';
import { pageHead, subNav, reveal } from '../ui/shell.js';
import { doodle } from '../ui/icons.js';

/** @param {HTMLElement} main */
export function render(main) {
  const cats = ['All', ...new Set(markets.flatMap((m) => m.categories))].sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)));
  let cat = 'All';
  main.innerHTML = `
    ${pageHead({ label: 'Explore', title: 'Market guide', titleHi: 'बाज़ार', lead: 'Where to find cloth, bangles, paintings and brass, and what to ask before you buy.', art: doodle.bangles })}
    ${subNav('explore')}
    <section class="m-section"><div class="m-wrap">
      <div class="m-filters" role="group" aria-label="What are you looking for?" style="margin-bottom:24px">
        <span class="m-label m-label--muted" style="margin:0;align-self:center;width:auto">Looking for</span>
        ${cats.map((c) => `<button class="m-filter" type="button" data-cat="${esc(c)}" aria-pressed="${c === 'All'}">${esc(c)}</button>`).join('')}
      </div>
      <div data-list></div>
      <div class="p-split" style="margin-top:48px">
        <div class="p-box p-box--paper"><h3>Before you buy</h3><ul>
          <li>Ask whether something is hand-made or machine-made; both are sold side by side.</li>
          <li>Bargaining is common for cloth and souvenirs, rarely for food. Be fair.</li>
          <li>Ask before photographing a stall or the people in it.</li>
        </ul><p style="margin:12px 0 0"><a class="m-link" href="/explore/phrases/">Phrases for the market <span class="m-arrow" aria-hidden="true">→</span></a></p></div>
        <div class="p-box"><h3>Local tips</h3>${localTips.slice(0, 3).map((t) => `<p class="m-body-sm" style="margin:0 0 10px">${tag('Local tip', 'local')} ${esc(t.text)}</p>`).join('')}<p class="m-body-sm m-muted" style="margin:0">Sample tips.</p></div>
      </div>
    </div></section>`;
  const list = /** @type {HTMLElement} */ (main.querySelector('[data-list]'));
  const draw = () => {
    const items = markets.filter((m) => cat === 'All' || m.categories.includes(cat));
    list.innerHTML = items.length ? `<div class="p-labels">${items.map((m) => {
      const p = getPlace(m.placeId);
      return `<div data-reveal>
        <div><h2 class="m-h3">${esc(m.name)}</h2>${p ? `<p class="m-body-sm" style="margin:6px 0 0"><a href="/place/?id=${p.id}">${esc(p.name)}</a></p>` : ''}</div>
        <div>
          <ul class="m-pill-list" style="margin-bottom:10px">${m.categories.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
          <p style="margin:0 0 6px"><strong>Best for:</strong> ${esc(m.bestFor)}</p>
          <p class="m-muted" style="margin:0 0 10px">${esc(m.tip)}</p>
          <div class="m-badges">${statusBadge(m.verification)}<span class="m-muted m-body-sm">Information last updated ${fmtDate(m.lastUpdated)}. Shop hours vary; none are listed.</span></div>
        </div>
      </div>`;
    }).join('')}</div>` : emptyState({ title: 'No market listed for that yet', body: 'Try another category.' });
    main.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.cat === cat)));
    reveal(list);
  };
  main.addEventListener('click', (e) => { const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-cat]')); if (b) { cat = b.dataset.cat ?? 'All'; draw(); } });
  draw();
}
