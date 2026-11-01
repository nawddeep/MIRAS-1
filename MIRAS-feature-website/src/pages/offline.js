import { esc, toast } from '../lib/dom.js';
import { places, phrases, itineraries, audioWalks } from '../data/index.js';
import { pageHead, subNav } from '../ui/shell.js';
import { icon } from '../ui/icons.js';
import { note } from '../ui/components.js';

const PACKS = [
  { id: 'profiles', title: 'Place profiles', detail: `${places.length} places: facts, sample hours, tips and drawings`, mb: 3.2 },
  { id: 'phrases', title: 'Phrase help', detail: `${phrases.length} phrases in Hindi and English`, mb: 0.1 },
  { id: 'itineraries', title: 'Itineraries and trails', detail: `${itineraries.length} itineraries and their routes`, mb: 0.4 },
  { id: 'walks', title: 'Audio walk scripts', detail: `${audioWalks.length} walks, text only (no recorded audio exists)`, mb: 0.2 },
  { id: 'images', title: 'Compressed images', detail: 'Smaller versions of the drawings, for slow connections', mb: 6.5 },
];

/** @param {HTMLElement} main */
export function render(main) {
  /** @type {Record<string, 'none' | 'loading' | 'ready'>} */
  const state = Object.fromEntries(PACKS.map((p) => [p.id, 'none']));
  /** @type {Record<string, number>} */
  const timers = {};
  main.innerHTML = `
    ${pageHead({ label: 'Plan', title: 'Offline pack', titleHi: 'बिना नेटवर्क के', lead: 'Choose what to keep for places with weak signal. Large items download only when you ask.', art: icon.wifiOff })}
    ${subNav('plan')}
    <section class="m-section"><div class="m-wrap m-narrow" style="margin:0 auto">
      ${note('<p><strong>Simulated.</strong> The progress bars below are a demonstration. Nothing is actually saved to your device, and this site does not work offline yet.</p>', 'demo')}
      <div class="p-packs" style="margin-top:28px" data-packs></div>
      <p class="m-body-sm m-muted" style="margin-top:16px" data-total aria-live="polite"></p>
    </div></section>`;
  const box = /** @type {HTMLElement} */ (main.querySelector('[data-packs]'));
  const total = /** @type {HTMLElement} */ (main.querySelector('[data-total]'));
  const draw = () => {
    box.innerHTML = PACKS.map((p) => `
      <div class="p-pack">
        <div><h3>${esc(p.title)}</h3><p>${esc(p.detail)} · about ${p.mb} MB</p></div>
        <div>${state[p.id] === 'ready'
          ? `<button class="m-btn m-btn--quiet m-btn--sm" type="button" data-remove="${p.id}">${icon.trash}<span>Remove</span></button>`
          : state[p.id] === 'loading'
            ? `<button class="m-btn m-btn--quiet m-btn--sm" type="button" data-cancel="${p.id}">Cancel</button>`
            : `<button class="m-btn m-btn--sm" type="button" data-get="${p.id}">${icon.download}<span>Download (demo)</span></button>`}</div>
        <div class="m-progress" role="progressbar" aria-label="${esc(p.title)} download" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${state[p.id] === 'ready' ? 100 : 0}" data-bar="${p.id}"><span style="width:${state[p.id] === 'ready' ? 100 : 0}%"></span></div>
        <p class="p-pack-state" data-state="${p.id}">${state[p.id] === 'ready' ? `${icon.tick.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} Ready (simulated, not really stored)` : state[p.id] === 'loading' ? 'Downloading…' : 'Not downloaded'}</p>
      </div>`).join('');
    const mb = PACKS.filter((p) => state[p.id] === 'ready').reduce((s, p) => s + p.mb, 0);
    total.textContent = `Selected for offline: ${mb.toFixed(1)} MB (simulated).`;
  };
  const start = (/** @type {string} */ id) => {
    state[id] = 'loading'; draw();
    let pct = 0;
    timers[id] = window.setInterval(() => {
      pct = Math.min(100, pct + 9 + Math.round(pct / 10));
      const bar = box.querySelector(`[data-bar="${id}"]`);
      bar?.setAttribute('aria-valuenow', String(pct));
      const span = /** @type {HTMLElement | null} */ (bar?.firstElementChild ?? null);
      if (span) span.style.width = pct + '%';
      const st = box.querySelector(`[data-state="${id}"]`);
      if (st) st.textContent = `Downloading… ${pct}%`;
      if (pct >= 100) { clearInterval(timers[id]); state[id] = 'ready'; draw(); toast('Simulated download finished.'); }
    }, 220);
  };
  main.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const g = /** @type {HTMLElement | null} */ (t.closest('[data-get]'));
    const c = /** @type {HTMLElement | null} */ (t.closest('[data-cancel]'));
    const r = /** @type {HTMLElement | null} */ (t.closest('[data-remove]'));
    if (g?.dataset.get) start(g.dataset.get);
    if (c?.dataset.cancel) { clearInterval(timers[c.dataset.cancel]); state[c.dataset.cancel] = 'none'; draw(); }
    if (r?.dataset.remove) { state[r.dataset.remove] = 'none'; draw(); }
  });
  draw();
}
