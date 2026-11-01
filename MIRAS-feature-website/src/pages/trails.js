import { esc, fmtDuration, fmtKm } from '../lib/dom.js';
import { trails, getPlace, distanceKm } from '../data/index.js';
import { statusBadge } from '../ui/components.js';
import { pageHead, subNav, reveal } from '../ui/shell.js';
import { doodle } from '../ui/icons.js';
import { sketchMap } from '../ui/map.js';

/** @param {HTMLElement} main */
export function render(main) {
  let kind = 'all';
  main.innerHTML = `
    ${pageHead({ label: 'Plan', title: 'Trails and walks', titleHi: 'विरासत की राहें', lead: 'Themed routes through the city, and short walks for when you only have a couple of hours.', art: doodle.palm })}
    ${subNav('plan')}
    <section class="m-section"><div class="m-wrap">
      <div class="m-filters" role="group" aria-label="Kind of route" style="margin-bottom:12px">
        <button class="m-filter" type="button" data-kind="all" aria-pressed="true">All routes</button>
        <button class="m-filter" type="button" data-kind="themed" aria-pressed="false">By theme</button>
        <button class="m-filter" type="button" data-kind="timed" aria-pressed="false">By time</button>
      </div>
      <p class="m-body-sm m-muted">Routes use approximate coordinates and typical visit lengths. Distances are straight-line; walking is longer. All routes are sample routes.</p>
      <div data-list></div>
    </div></section>`;
  const list = /** @type {HTMLElement} */ (main.querySelector('[data-list]'));
  const draw = () => {
    list.innerHTML = trails.filter((t) => kind === 'all' || t.kind === kind).map((t) => {
      const stops = t.placeIds.map((id) => getPlace(id)).filter((p) => !!p);
      let km = 0;
      for (let i = 1; i < stops.length; i++) km += distanceKm(/** @type {any} */ (stops[i - 1]).coords, /** @type {any} */ (stops[i]).coords);
      return `<article class="p-trail" id="${t.id}" data-reveal>
        <div>
          <p class="m-label">${esc(t.theme)}</p>
          <h2>${esc(t.title)}</h2>
          <p>${esc(t.blurb)}</p>
          <ul class="m-meta" style="margin:14px 0"><li>${fmtDuration(t.durationMin)} including visits</li><li>${stops.length} stops</li><li>about ${fmtKm(km)} between stops</li></ul>
          ${statusBadge(t.verification)}
          <ol class="p-route" style="margin-top:22px">${stops.map((p, i) => `<li><span class="p-route-n">${i + 1}</span><a href="/place/?id=${p?.id}">${esc(p?.name)}</a><span class="m-muted">${fmtDuration(p?.visitMinutes ?? 0)}</span></li>`).join('')}</ol>
        </div>
        <div>${sketchMap({ points: stops.map((p, i) => ({ id: p?.id ?? '', label: `${i + 1}. ${p?.name}`, lat: p?.coords.lat ?? 0, lng: p?.coords.lng ?? 0 })), title: `Sketch map of ${t.title}` })}</div>
      </article>`;
    }).join('');
    main.querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.kind === kind)));
    reveal(list);
  };
  main.addEventListener('click', (e) => { const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-kind]')); if (b) { kind = b.dataset.kind ?? 'all'; draw(); } });
  draw();
  if (location.hash) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView(), 50);
}
