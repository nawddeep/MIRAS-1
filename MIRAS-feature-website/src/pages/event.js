import { esc, param, fmtDate } from '../lib/dom.js';
import { getEvent, getPlace } from '../data/index.js';
import { statusBadge, tag, note } from '../ui/components.js';
import { notFound } from '../ui/shell.js';
import { icon, doodle } from '../ui/icons.js';

/** @param {HTMLElement} main */
export function render(main) {
  const e = getEvent(param('id'));
  if (!e) { main.innerHTML = notFound('event', '/events/', 'All events'); return; }
  const p = getPlace(e.placeId);
  document.title = `${e.title} · MIRAS Udaipur`;
  const row = (/** @type {string} */ k, /** @type {string} */ v, confirmed = e.organiserConfirmed) =>
    `<dt>${k}</dt><dd>${esc(v)}${confirmed ? '' : ' <span class="m-muted m-body-sm">(unconfirmed)</span>'}</dd>`;
  main.innerHTML = `
    <section class="p-hero"><div class="m-wrap">
      <a class="p-back" href="/events/">${icon.back} All events</a>
      <div class="p-hero-grid">
        <div>
          <p class="m-label">${esc(e.kind)}</p>
          <h1 class="m-h1">${esc(e.title)}</h1>
          <p class="m-lead" style="margin-top:16px">${esc(e.description)}</p>
          <div class="m-badges">${e.listingType === 'Demo listing' ? tag('Demo listing', 'demo') : tag('Not confirmed by organiser', 'neutral')}${statusBadge(e.verification)}<span class="m-muted m-body-sm">Last updated ${fmtDate(e.lastUpdated)}</span></div>
        </div>
        <div class="m-postcard">
          <span class="m-perf" aria-hidden="true">${doodle.lamp}</span>
          <dl class="m-kv" style="padding-right:64px">
            ${row('When', e.when)}${row('Where', p?.name ?? '', true)}${row('Availability', e.availability)}${row('Language', e.language)}
            ${row('Duration', e.duration)}${row('Cost', e.cost)}${row('How to book', e.bookingMethod)}
          </dl>
        </div>
      </div>
    </div></section>
    <section class="m-section"><div class="m-wrap m-narrow">
      ${note(e.listingType === 'Demo listing'
        ? '<p><strong>This listing is invented</strong> to show how an event would appear. Do not plan around it.</p>'
        : '<p><strong>This is a real public programme</strong>, but MIRAS has not confirmed the current dates, times or prices with the organiser. Check locally before you go.</p>', 'demo')}
      ${p ? `<p style="margin-top:20px"><a class="m-link" href="/place/?id=${p.id}">About ${esc(p.name)} <span class="m-arrow" aria-hidden="true">→</span></a></p>` : ''}
    </div></section>`;
}
