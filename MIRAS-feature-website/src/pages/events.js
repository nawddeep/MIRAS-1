import { events } from '../data/index.js';
import { eventTicket, emptyState, note, tag } from '../ui/components.js';
import { pageHead, subNav, reveal } from '../ui/shell.js';
import { doodle } from '../ui/icons.js';

/** @param {HTMLElement} main */
export function render(main) {
  const kinds = ['All', ...new Set(events.map((e) => e.kind))];
  let kind = 'All', status = 'all';
  main.innerHTML = `
    ${pageHead({ label: 'Workshops & events', title: 'Evenings, festivals and walks', titleHi: 'उत्सव और कार्यक्रम', lead: 'What is on in Udaipur, with a clear line between what an organiser has confirmed and what is only a sample.', art: doodle.lamp })}
    ${subNav('workshops')}
    <section class="m-section"><div class="m-wrap">
      ${note(`<p>Details are shown as confirmed only when the organiser confirms them, with a date. <strong>No organiser has confirmed anything here yet.</strong> Listings are either ${tag('Demo listing', 'demo')} (invented to show the format) or ${tag('Not confirmed by organiser', 'neutral')} (a real public programme whose current details we have not confirmed).</p>`, 'paper')}
      <div style="display:flex;flex-wrap:wrap;gap:20px 48px;margin:32px 0 24px">
        <div class="m-filters" role="group" aria-label="Type of event">${kinds.map((k) => `<button class="m-filter" type="button" data-kind="${k}" aria-pressed="${k === 'All'}">${k}</button>`).join('')}</div>
        <div class="m-filters" role="group" aria-label="Listing status">
          <button class="m-filter" type="button" data-status="all" aria-pressed="true">Any status</button>
          <button class="m-filter" type="button" data-status="public" aria-pressed="false">Real programmes</button>
          <button class="m-filter" type="button" data-status="demo" aria-pressed="false">Demo listings</button>
        </div>
      </div>
      <p class="m-count" data-count aria-live="polite"></p>
      <div class="m-grid m-grid--2" data-list></div>
    </div></section>`;
  const list = /** @type {HTMLElement} */ (main.querySelector('[data-list]'));
  const count = /** @type {HTMLElement} */ (main.querySelector('[data-count]'));
  const draw = () => {
    const items = events.filter((e) => (kind === 'All' || e.kind === kind) &&
      (status === 'all' || (status === 'demo' ? e.listingType === 'Demo listing' : e.listingType !== 'Demo listing')));
    count.textContent = `${items.length} ${items.length === 1 ? 'listing' : 'listings'}`;
    list.innerHTML = items.length ? items.map(eventTicket).join('') : `<div style="grid-column:1/-1">${emptyState({ title: 'Nothing on with those filters', body: 'Try another type or status.', art: doodle.lamp })}</div>`;
    main.querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.kind === kind)));
    main.querySelectorAll('[data-status]').forEach((b) => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.status === status)));
    reveal(list);
  };
  main.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const k = /** @type {HTMLElement | null} */ (t.closest('[data-kind]'));
    const s = /** @type {HTMLElement | null} */ (t.closest('[data-status]'));
    if (k) { kind = k.dataset.kind ?? 'All'; draw(); }
    if (s) { status = s.dataset.status ?? 'all'; draw(); }
  });
  draw();
}
