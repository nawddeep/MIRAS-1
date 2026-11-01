import { esc, param, fmtINR, fmtDuration, fmtDate } from '../lib/dom.js';
import { getWorkshop, getArtisan, getPlace } from '../data/index.js';
import { statusBadge, tag, note } from '../ui/components.js';
import { notFound } from '../ui/shell.js';
import { icon, doodle } from '../ui/icons.js';
import { markProgress } from '../lib/store.js';

/** @param {HTMLElement} main */
export function render(main) {
  const w = getWorkshop(param('id'));
  if (!w) { main.innerHTML = notFound('workshop', '/workshops/', 'All workshops'); return; }
  const a = getArtisan(w.artisanId), p = getPlace(w.placeId);
  document.title = `${w.title} · MIRAS Udaipur`;
  markProgress('workshop');
  const bookable = w.howToBook.includes('booking');
  main.innerHTML = `
    <section class="p-hero"><div class="m-wrap">
      <a class="p-back" href="/workshops/">${icon.back} All workshops</a>
      <div class="p-hero-grid">
        <div>
          <p class="m-label">${esc(w.craft)} workshop</p>
          <h1 class="m-h1">${esc(w.title)}</h1>
          <p class="m-lead" style="margin-top:16px">${esc(w.description)}</p>
          <div class="m-badges" style="margin-bottom:20px">${statusBadge(w.verification)}${w.ownerConfirmed ? tag('Confirmed by owner', 'local') : tag('Not confirmed by owner', 'neutral')}<span class="m-muted m-body-sm">Last updated ${fmtDate(w.lastUpdated)}</span></div>
          <div class="m-actions">
            <a class="m-btn" href="/enquire/?workshop=${w.id}">Ask the maker</a>
            ${bookable ? `<a class="m-btn m-btn--ghost" href="/book/?type=workshop&id=${w.id}">${icon.ticket}<span>Booking demo</span></a>` : ''}
          </div>
        </div>
        <div class="m-postcard p-card-split">
          <dl class="m-kv">
            <dt>Length</dt><dd>${fmtDuration(w.durationMin)}</dd>
            <dt>Language</dt><dd>${w.languages.map(esc).join(', ')}</dd>
            <dt>Group</dt><dd>Up to ${w.groupSize} people</dd>
            <dt>Cost</dt><dd>${fmtINR(w.cost.amount)} <span class="m-muted">(${esc(w.cost.note.toLowerCase())})</span></dd>
            <dt>Sample days</dt><dd>${w.sampleDays.map(esc).join(', ')}</dd>
            <dt>How to book</dt><dd>${esc(w.howToBook)}</dd>
          </dl>
          <div class="m-doodle">${a ? doodle[/** @type {keyof typeof doodle} */ (a.doodle)] ?? '' : ''}</div>
        </div>
      </div>
    </div></section>
    <section class="m-section"><div class="m-wrap p-split">
      <div class="p-box"><h3>With</h3><p>${a ? `<a href="/artisan/?id=${a.id}">${esc(a.studio)}</a>, ${esc(a.craft.toLowerCase())}.` : ''}</p><p class="m-body-sm m-muted" style="margin:0">Demonstration profile, not a real business.</p></div>
      <div class="p-box"><h3>Where</h3><p>${p ? `Near <a href="/place/?id=${p.id}">${esc(p.name)}</a>.` : ''} The exact address is shared by the maker after an enquiry.</p></div>
    </div>
    <div class="m-wrap" style="margin-top:24px">${note('<p>Availability is not shown because no owner has confirmed it. Out-of-date details are the most common problem with listings like this, so real listings show the date the owner last checked them.</p>', 'paper')}</div>
    </section>`;
}
