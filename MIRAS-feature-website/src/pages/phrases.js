import { esc, openDialog } from '../lib/dom.js';
import { phrases } from '../data/index.js';
import { markProgress } from '../lib/store.js';
import { pageHead, subNav } from '../ui/shell.js';
import { doodle } from '../ui/icons.js';
import { note } from '../ui/components.js';

/** @param {HTMLElement} main */
export function render(main) {
  const contexts = ['All', ...new Set(phrases.map((p) => p.context))];
  let ctx = 'All', mode = 'hi';
  main.innerHTML = `
    ${pageHead({ label: 'Explore', title: 'Phrase help', titleHi: 'काम के शब्द', lead: 'Pick a phrase and show it to a shopkeeper or driver in large, clear text.', art: doodle.speech })}
    ${subNav('explore')}
    <section class="m-section"><div class="m-wrap">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px 32px;margin-bottom:28px;align-items:end">
        <div class="m-filters" role="group" aria-label="Situation">${contexts.map((c) => `<button class="m-filter" type="button" data-ctx="${c}" aria-pressed="${c === 'All'}">${c}</button>`).join('')}</div>
        <div class="m-field" style="min-width:240px"><label for="ph-lang">Show phrases in</label>
          <select id="ph-lang"><option value="hi">Hindi (देवनागरी)</option><option value="tr">Hindi, in Latin letters</option><option value="en">English</option></select></div>
      </div>
      <div class="p-phrases" data-list></div>
      <div style="margin-top:32px">${note('<p>Phrases are in standard Hindi. Udaipur also speaks Mewari, which we have not added yet because we have not had the phrases checked by a native speaker.</p>', 'paper')}</div>
    </div></section>`;
  const list = /** @type {HTMLElement} */ (main.querySelector('[data-list]'));
  const lang = /** @type {HTMLSelectElement} */ (main.querySelector('#ph-lang'));
  const draw = () => {
    list.innerHTML = phrases.filter((p) => ctx === 'All' || p.context === ctx).map((p) => {
      const mainText = mode === 'hi' ? p.hi : mode === 'tr' ? p.translit : p.en;
      const sub = mode === 'en' ? `${p.translit}` : p.en;
      return `<button class="p-phrase" type="button" data-ph="${p.id}" aria-label="Show large: ${esc(p.en)}">
        <span class="p-ph-main"${mode === 'hi' ? ' lang="hi"' : ''}>${esc(mainText)}</span>
        <span class="p-ph-sub">${esc(sub)}</span>
        <span class="m-label m-label--muted" style="margin:6px 0 0">${esc(p.context)} · tap to show</span>
      </button>`;
    }).join('');
    main.querySelectorAll('[data-ctx]').forEach((b) => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.ctx === ctx)));
  };
  lang.addEventListener('change', () => { mode = lang.value; draw(); });
  main.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const c = /** @type {HTMLElement | null} */ (t.closest('[data-ctx]'));
    if (c) { ctx = c.dataset.ctx ?? 'All'; draw(); }
    const b = /** @type {HTMLElement | null} */ (t.closest('[data-ph]'));
    const p = phrases.find((x) => x.id === b?.dataset.ph);
    if (p) {
      markProgress('phrase');
      openDialog({ title: p.en, wide: true, body: `<div class="p-show"><p class="p-show-hi" lang="hi">${esc(p.hi)}</p><p class="p-show-tr">${esc(p.translit)}</p><p class="m-muted">Turn your screen towards the person you are talking to.</p><div><button class="m-btn" type="button" data-close>Done</button></div></div>` });
    }
  });
  draw();
}
