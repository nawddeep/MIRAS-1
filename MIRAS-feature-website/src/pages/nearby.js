import { esc, param, fmtKm, toast } from '../lib/dom.js';
import { places, artisans, distanceKm, getPlace } from '../data/index.js';
import { drawingFor, tag } from '../ui/components.js';
import { pageHead, subNav, reveal } from '../ui/shell.js';
import { icon, doodle } from '../ui/icons.js';
import { sketchMap, inArea } from '../ui/map.js';

/** @param {HTMLElement} main */
export function render(main) {
  const startId = getPlace(param('from'))?.id ?? 'jagdish-temple';
  const state = {
    /** @type {{lat: number, lng: number, label: string}} */
    from: (() => { const p = /** @type {import('../data/types.js').Place} */ (getPlace(startId)); return { ...p.coords, label: p.name }; })(),
    view: 'list', show: 'all', active: /** @type {string | null} */ (null),
  };

  main.innerHTML = `
    ${pageHead({ label: 'Explore', title: 'What is near you', titleHi: 'आस-पास', lead: 'Places and makers sorted by distance. Pick a starting point, or share your location if you want to. You never have to.', art: doodle.compass })}
    ${subNav('explore')}
    <section class="m-section"><div class="m-wrap">
      <div class="p-locbar">
        <div class="m-field"><label for="nb-from">Start from</label>
          <select id="nb-from">${places.map((p) => `<option value="${p.id}"${p.id === startId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="__me" disabled>My location (shared)</option></select></div>
        <button class="m-btn m-btn--ghost" type="button" data-locate>${icon.locate}<span>Use my location</span></button>
        <p class="m-body-sm m-muted" style="margin:0;flex:1 1 260px" data-locmsg>Optional. Your location stays in this page and is not sent or stored.</p>
      </div>
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px;margin-bottom:24px">
        <div class="m-filters" role="group" aria-label="Show">
          <button class="m-filter" type="button" data-show="all" aria-pressed="true">Everything</button>
          <button class="m-filter" type="button" data-show="place" aria-pressed="false">Places</button>
          <button class="m-filter" type="button" data-show="maker" aria-pressed="false">Makers</button>
        </div>
        <div class="m-seg" role="group" aria-label="View">
          <button type="button" data-view="list" aria-pressed="true">${icon.list}List</button>
          <button type="button" data-view="map" aria-pressed="false">${icon.map}Map</button>
        </div>
      </div>
      <div data-out></div>
    </div></section>`;

  const out = /** @type {HTMLElement} */ (main.querySelector('[data-out]'));
  const msg = /** @type {HTMLElement} */ (main.querySelector('[data-locmsg]'));
  const sel = /** @type {HTMLSelectElement} */ (main.querySelector('#nb-from'));

  const items = () => [
    ...(state.show !== 'maker' ? places.map((p) => ({ id: p.id, kind: /** @type {const} */ ('place'), label: p.name, sub: p.category, href: `/place/?id=${p.id}`, coords: p.coords, art: drawingFor(p.artKey) })) : []),
    ...(state.show !== 'place' ? artisans.map((a) => ({ id: a.id, kind: /** @type {const} */ ('maker'), label: a.studio, sub: `${a.craft} · demo profile`, href: `/artisan/?id=${a.id}`, coords: a.coords, art: doodle[/** @type {keyof typeof doodle} */ (a.doodle)] ?? '' })) : []),
  ].map((x) => ({ ...x, km: distanceKm(state.from, x.coords) })).sort((a, b) => a.km - b.km);

  const listHTML = (/** @type {ReturnType<typeof items>} */ list) => `<ol class="p-nearlist">${list.map((x) => `
    <li data-item="${x.id}" class="${x.id === state.active ? 'is-active' : ''}">
      <div class="m-row-art">${x.art}</div>
      <div><h3><a href="${x.href}">${esc(x.label)}</a></h3><p class="m-body-sm m-muted" style="margin:2px 0 0">${esc(x.sub)}${x.kind === 'maker' ? ' · general area' : ''}</p></div>
      <div style="display:grid;justify-items:end;gap:6px"><span class="m-dist">${fmtKm(x.km)}</span><a class="m-body-sm" href="https://www.google.com/maps/dir/?api=1&destination=${x.coords.lat},${x.coords.lng}" target="_blank" rel="noopener">Directions<span class="m-sr"> to ${esc(x.label)} (opens Google Maps)</span></a></div>
    </li>`).join('')}</ol>`;

  const draw = () => {
    const list = items();
    if (state.view === 'list') {
      out.innerHTML = `<p class="m-count">Distances in a straight line from <strong>${esc(state.from.label)}</strong>. Walking distances are longer.</p>${listHTML(list)}`;
    } else {
      out.innerHTML = `<div class="p-mapwrap">
        ${sketchMap({ points: list.map((x) => ({ id: x.id, label: x.label, lat: x.coords.lat, lng: x.coords.lng, kind: x.kind })), activeId: state.active, you: state.from, title: 'Sketch map of places and makers near ' + state.from.label })}
        <div><p class="m-count">Nearest to ${esc(state.from.label)}. Select a pin to highlight it.</p>${listHTML(list.slice(0, 6))}</div>
      </div>`;
    }
    main.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.view === state.view)));
    main.querySelectorAll('[data-show]').forEach((b) => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.show === state.show)));
    reveal(out);
  };

  sel.addEventListener('change', () => {
    const p = getPlace(sel.value);
    if (p) { state.from = { ...p.coords, label: p.name }; msg.textContent = 'Optional. Your location stays in this page and is not sent or stored.'; draw(); }
  });
  main.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const v = /** @type {HTMLElement | null} */ (t.closest('[data-view]'));
    const s = /** @type {HTMLElement | null} */ (t.closest('[data-show]'));
    const pin = /** @type {HTMLElement | null} */ (t.closest('[data-pin]'));
    if (v) { state.view = v.dataset.view ?? 'list'; draw(); }
    if (s) { state.show = s.dataset.show ?? 'all'; draw(); }
    if (pin) { state.active = pin.dataset.pin ?? null; draw(); main.querySelector(`[data-item="${state.active}"]`)?.scrollIntoView({ block: 'nearest' }); }
    if (t.closest('[data-locate]')) locate();
  });
  main.addEventListener('keydown', (e) => {
    const pin = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-pin]'));
    if (pin && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); state.active = pin.dataset.pin ?? null; draw(); /** @type {HTMLElement | null} */ (main.querySelector(`[data-pin="${state.active}"]`))?.focus(); }
  });

  function locate() {
    if (!('geolocation' in navigator)) { msg.textContent = 'This browser cannot share a location. Choose a starting point instead.'; return; }
    msg.textContent = 'Asking your browser for permission…';
    navigator.geolocation.getCurrentPosition((pos) => {
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!inArea(here)) {
        msg.innerHTML = `${tag('Outside Udaipur', 'neutral')} You seem to be outside the old city area, so distances would not help. Keeping <strong>${esc(state.from.label)}</strong> as the starting point.`;
        return;
      }
      state.from = { ...here, label: 'You (approximate)' };
      sel.value = '__me';
      msg.textContent = 'Using your location for this page only. Nothing is sent or stored.';
      toast('Location used for this page only.');
      draw();
    }, (err) => {
      msg.textContent = err.code === err.PERMISSION_DENIED
        ? 'Location permission was declined. That is fine: choose a starting point instead.'
        : 'Your location could not be found. Choose a starting point instead.';
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }
  draw();
}
