import { esc } from '../lib/dom.js';
import { workshops } from '../data/index.js';
import { workshopRow, emptyState, note } from '../ui/components.js';
import { pageHead, subNav, reveal } from '../ui/shell.js';
import { doodle } from '../ui/icons.js';

/** @param {HTMLElement} main */
export function render(main) {
  const crafts = [...new Set(workshops.map((w) => w.craft))];
  const langs = [...new Set(workshops.flatMap((w) => w.languages))];
  main.innerHTML = `
    ${pageHead({ label: 'Workshops & events', title: 'Spend an afternoon making something', titleHi: 'कुछ हाथ से बनाइए', lead: 'Small, hands-on sessions with makers, in their own workshops.', art: doodle.pot })}
    ${subNav('workshops')}
    <section class="m-section"><div class="m-wrap">
      ${note('<p><strong>Sample listings.</strong> Every workshop here belongs to a demonstration profile. Prices and days are illustrative, and no maker has confirmed them. Real listings will show the date the owner last confirmed the details.</p>', 'demo')}
      <form class="m-toolbar" style="margin-top:32px" aria-label="Filter workshops" data-f>
        <div class="m-field" style="min-width:200px"><label for="wf-craft">Craft</label><select id="wf-craft" name="craft"><option value="">Any craft</option>${crafts.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
        <div class="m-field" style="min-width:180px"><label for="wf-lang">Language</label><select id="wf-lang" name="lang"><option value="">Any language</option>${langs.map((l) => `<option>${esc(l)}</option>`).join('')}</select></div>
        <div class="m-field" style="min-width:180px"><label for="wf-len">Length</label><select id="wf-len" name="len"><option value="">Any length</option><option value="90">Up to 1½ hours</option><option value="150">Up to 2½ hours</option><option value="999">Longer</option></select></div>
        <button class="m-btn m-btn--quiet" type="reset">Clear</button>
      </form>
      <p class="m-count" data-count aria-live="polite"></p>
      <div data-list></div>
    </div></section>`;
  const form = /** @type {HTMLFormElement} */ (main.querySelector('[data-f]'));
  const list = /** @type {HTMLElement} */ (main.querySelector('[data-list]'));
  const count = /** @type {HTMLElement} */ (main.querySelector('[data-count]'));
  const draw = () => {
    const f = new FormData(form);
    const craft = String(f.get('craft') || ''), lang = String(f.get('lang') || ''), len = Number(f.get('len') || 0);
    const items = workshops.filter((w) => (!craft || w.craft === craft) && (!lang || w.languages.includes(lang)) &&
      (!len || (len === 999 ? w.durationMin > 150 : w.durationMin <= len)));
    count.textContent = `${items.length} ${items.length === 1 ? 'workshop' : 'workshops'}`;
    list.innerHTML = items.length ? items.map(workshopRow).join('') : emptyState({ title: 'No workshop fits those filters', body: 'Try a different language or length, or clear the filters.', art: doodle.pot, action: '<button class="m-btn m-btn--ghost" type="button" data-reset>Clear filters</button>' });
    reveal(list);
  };
  form.addEventListener('change', draw);
  form.addEventListener('reset', () => setTimeout(draw));
  main.addEventListener('click', (e) => { if (/** @type {HTMLElement} */ (e.target).closest('[data-reset]')) { form.reset(); } });
  draw();
}
