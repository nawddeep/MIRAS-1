import { esc, fmtDuration, toast } from '../lib/dom.js';
import { getPlace } from '../data/index.js';
import { getSaved, toggleSaved, clearSaved, markProgress } from '../lib/store.js';
import { plan, fmtTime } from '../lib/planner.js';
import { pageHead, subNav, reveal } from '../ui/shell.js';
import { icon, doodle } from '../ui/icons.js';
import { emptyState, tag } from '../ui/components.js';

const INTERESTS = [['architecture', 'Architecture'], ['lakes', 'Lakes'], ['art', 'Art'], ['crafts', 'Crafts'], ['markets', 'Markets'], ['food', 'Food'], ['photography', 'Photography'], ['family', 'With children'], ['spiritual', 'Temples']];

/** @param {HTMLElement} main */
export function render(main) {
  const qs = new URLSearchParams(location.search);
  const qDays = Math.min(5, Math.max(1, Number(qs.get('days')) || 2));
  const qInterests = qs.getAll('i');
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  main.innerHTML = `
    ${pageHead({ label: 'Plan', title: 'Plan your journey', titleHi: 'अपनी यात्रा की योजना', lead: 'Unhurried days built from what you like and what you have saved. It will not send you somewhere it believes is closed.', art: doodle.compass })}
    ${subNav('plan')}
    <section class="m-section"><div class="m-wrap p-plan-grid">
      <form class="p-plan-form m-postcard" novalidate data-form aria-label="Trip planner">
        <div class="m-form">
          <p class="m-label" style="margin:0">Your trip</p>
          <div class="m-form-row">
            <div class="m-field"><label for="pl-start">First day</label><input id="pl-start" name="start" type="date" value="${iso}" required></div>
            <div class="m-field"><label for="pl-days">Days</label><select id="pl-days" name="days">${[1, 2, 3, 4, 5].map((d) => `<option value="${d}"${d === qDays ? ' selected' : ''}>${d}</option>`).join('')}</select></div>
          </div>
          <fieldset class="m-field"><legend>Time each day</legend>
            <div class="m-checks"><label class="m-check"><input type="radio" name="pace" value="half"> Half day (morning)</label><label class="m-check"><input type="radio" name="pace" value="full" checked> Full day, with lunch</label></div></fieldset>
          <fieldset class="m-field"><legend>Interests</legend>
            <div class="m-checks">${INTERESTS.map(([v, l]) => `<label class="m-check"><input type="checkbox" name="i" value="${v}"${(qInterests.length ? qInterests.includes(v) : ['architecture', 'lakes'].includes(v)) ? ' checked' : ''}> ${l}</label>`).join('')}</div></fieldset>
          <fieldset class="m-field"><legend>Preferences</legend>
            <label class="m-check"><input type="checkbox" name="savedOnly"> Only use my saved places</label>
            <label class="m-check"><input type="checkbox" name="avoidSteps"> Avoid steep steps and hills where recorded</label></fieldset>
          <div data-err aria-live="assertive"></div>
          <button class="m-btn" type="submit">Build my plan</button>
        </div>
      </form>
      <div>
        <section aria-labelledby="saved-h" style="margin-bottom:40px">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap"><h2 class="m-h3" id="saved-h">Saved places</h2><button class="m-link" type="button" data-clear>Clear all</button></div>
          <p class="m-body-sm m-muted">Kept in this browser only.</p>
          <div data-saved></div>
        </section>
        <section aria-labelledby="out-h" aria-live="polite">
          <h2 class="m-h2" id="out-h" style="margin-bottom:12px">Your days</h2>
          <div data-out>${emptyState({ title: 'No plan yet', body: 'Choose your dates and interests, then press “Build my plan”.', art: doodle.compass })}</div>
        </section>
      </div>
    </div></section>`;

  const form = /** @type {HTMLFormElement} */ (main.querySelector('[data-form]'));
  const out = /** @type {HTMLElement} */ (main.querySelector('[data-out]'));
  const savedBox = /** @type {HTMLElement} */ (main.querySelector('[data-saved]'));

  const drawSaved = () => {
    const list = getSaved().map((id) => getPlace(id)).filter((p) => !!p);
    savedBox.innerHTML = list.length
      ? `<ul class="p-near">${list.map((p) => `<li style="display:flex;justify-content:space-between;align-items:center;gap:12px"><a href="/place/?id=${p?.id}" style="flex:1"><span>${esc(p?.name)}</span><span class="m-muted">${esc(p?.category)} · ${fmtDuration(p?.visitMinutes ?? 0)}</span></a><button class="m-btn m-btn--quiet m-btn--sm" type="button" data-remove="${p?.id}" aria-label="Remove ${esc(p?.name)}">${icon.close}</button></li>`).join('')}</ul>`
      : `<p class="m-muted" style="margin:0">Nothing saved yet. Use “Save to trip” on any <a href="/explore/">place</a>.</p>`;
  };

  const build = () => {
    const f = new FormData(form);
    const err = /** @type {HTMLElement} */ (main.querySelector('[data-err]'));
    const start = String(f.get('start') || '');
    const startInput = /** @type {HTMLInputElement} */ (form.elements.namedItem('start'));
    startInput.removeAttribute('aria-invalid');
    if (!start || Number.isNaN(new Date(start).getTime())) {
      err.innerHTML = '<p class="m-error">Choose a first day.</p>';
      startInput.setAttribute('aria-invalid', 'true'); startInput.focus(); return;
    }
    err.innerHTML = '';
    const input = {
      start, days: Number(f.get('days')), pace: /** @type {'half'|'full'} */ (f.get('pace') === 'half' ? 'half' : 'full'),
      interests: f.getAll('i').map(String), saved: getSaved(), savedOnly: f.get('savedOnly') === 'on', avoidSteps: f.get('avoidSteps') === 'on',
    };
    const r = plan(input);
    const maxStops = Math.max(0, ...r.days.map((d) => d.stops.length));
    if (getSaved().length >= 3 && maxStops <= 3) markProgress('calmPlan');
    out.innerHTML = `
      <div class="m-note m-note--paper" style="margin-bottom:28px">${icon.info}<div><p style="margin:0 0 6px"><strong>What this plan could not check</strong></p><ul style="margin:0">${r.limitations.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div></div>
      ${r.days.map((d, i) => `
        <article class="p-day" data-reveal>
          <div class="p-day-head"><h3>Day ${i + 1}</h3><span class="m-muted">${d.weekday}, ${d.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} · ${d.stops.length} ${d.stops.length === 1 ? 'stop' : 'stops'}</span></div>
          ${d.stops.length ? `<ol class="p-stops">${d.stops.map((s, j) => `
            ${j > 0 && j === d.lunchAfter ? '<li class="p-travel">Lunch and a rest, about an hour.</li>' : ''}
            ${j > 0 ? `<li class="p-travel" aria-label="Travel">${s.mode === 'walk' ? icon.route : icon.arrow} About ${s.travel} min ${s.mode === 'walk' ? 'on foot' : 'by auto-rickshaw'}</li>` : ''}
            <li class="p-stop">
              <div class="p-stop-time">${fmtTime(s.arrive)}<small>until ${fmtTime(s.leave)}</small></div>
              <div><h4><a href="/place/?id=${s.place.id}">${esc(s.place.name)}</a></h4>
                <p class="m-body-sm m-muted" style="margin:0">${esc(s.place.category)} · ${fmtDuration(s.place.visitMinutes)} · open ${(s.place.hours?.days[d.date.getDay()] ?? []).map(([a, b]) => `${a}–${b}`).join(', ')} (sample)</p>
                ${s.flags.length ? `<div class="m-badges" style="margin-top:6px">${s.flags.map((fl) => tag(fl, 'neutral')).join('')}</div>` : ''}</div>
            </li>`).join('')}
            ${d.lunchAfter >= d.stops.length ? '<li class="p-travel">Then lunch and a rest.</li>' : ''}
          </ol>` : '<p class="m-muted">No stop fits this day. Try other interests, a full-day pace, or fewer filters.</p>'}
        </article>`).join('')}
      ${r.skipped.length ? `<div class="p-box p-skipped"><h3>Not scheduled, and why</h3><ul>${r.skipped.map((s) => `<li><a href="/place/?id=${s.place.id}">${esc(s.place.name)}</a>: ${esc(s.reason)}</li>`).join('')}</ul></div>` : ''}
      <div class="m-actions" style="margin-top:24px"><a class="m-btn m-btn--ghost" href="/plan/offline/">${icon.download}<span>Keep it for offline (demo)</span></a><a class="m-link" href="/plan/responsible/">Travel responsibly <span class="m-arrow" aria-hidden="true">→</span></a></div>`;
    reveal(out);
    /** @type {HTMLElement} */ (main.querySelector('#out-h')).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  form.addEventListener('submit', (e) => { e.preventDefault(); build(); });
  main.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const r = /** @type {HTMLElement | null} */ (t.closest('[data-remove]'));
    if (r) { toggleSaved(r.dataset.remove ?? ''); drawSaved(); toast('Removed from your trip.'); }
    if (t.closest('[data-clear]')) { clearSaved(); drawSaved(); toast('Saved places cleared.'); }
  });
  drawSaved();
  if (qs.has('days') || qs.has('i')) build();
}
