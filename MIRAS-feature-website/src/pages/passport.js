import { esc } from '../lib/dom.js';
import { badges } from '../data/index.js';
import { getProgress, hasPassportConsent, setPassportConsent, getSaved } from '../lib/store.js';
import { emptyState, note } from '../ui/components.js';
import { pageHead, reveal } from '../ui/shell.js';
import { doodle } from '../ui/icons.js';

/** Which badges are earned, from learning progress only. */
function earned() {
  const p = getProgress();
  const types = Array.isArray(p.sourceTypes) ? p.sourceTypes : [];
  return {
    'b-first-story': !!p.storyRead,
    'b-source-reader': ['History', 'Oral tradition', 'Legend'].every((t) => types.includes(t)),
    'b-phrase': !!p.phrase,
    'b-maker': !!p.maker,
    'b-slow': !!p.saved3 && !!p.calmPlan,
    'b-respect': !!p.respect,
    'b-listener': !!p.listened,
    'b-craft': !!p.workshop,
    'b-quiet': !!p.hidden,
  };
}

/** @param {HTMLElement} main */
export function render(main) {
  main.innerHTML = `
    ${pageHead({ label: 'Passport', title: 'Your heritage passport', titleHi: 'विरासत पासपोर्ट', lead: 'Stamps for things you learn: stories read, phrases tried, makers met. Never for rushing, crowds or going where you should not.', art: doodle.postcard })}
    <section class="m-section"><div class="m-wrap p-passport-scope" data-root></div></section>`;
  const root = /** @type {HTMLElement} */ (main.querySelector('[data-root]'));

  const draw = () => {
    const on = hasPassportConsent();
    const e = earned();
    const count = Object.values(e).filter(Boolean).length;
    root.innerHTML = `
      <div class="p-passport">
        <div>
          <p class="m-label">MIRAS · Udaipur</p>
          <h2>${on ? (count ? `${count} of ${badges.length} stamps` : 'Your first page is blank') : 'Not collecting yet'}</h2>
          <p>${on ? 'Progress is kept in this browser only. It is not proof of a visit and is never location-checked.' : 'The passport only notes what you do on MIRAS if you switch it on. It stays in this browser, and you can switch it off and clear it at any time.'}</p>
          <label class="m-check" style="color:#fff;margin-top:12px"><input type="checkbox" data-consent ${on ? 'checked' : ''}> Keep passport progress in this browser</label>
          ${on ? `<p class="m-body-sm" style="margin-top:12px;color:rgba(255,255,255,.75)">Saved places: ${getSaved().length}. Switching off deletes your progress.</p>` : ''}
        </div>
        <div class="p-passport-page" aria-label="Stamps">
          ${on && !count ? `<div style="grid-column:1/-1">${emptyState({ title: 'New here? Start with a story.', body: 'Read any story to the end and your first stamp appears here. Then try a phrase, or meet a maker.', art: doodle.book, action: '<a class="m-btn" href="/stories/">Read a story</a>' })}</div>` : ''}
          ${badges.map((b, i) => {
            const got = on && e[/** @type {keyof typeof e} */ (b.id)];
            const tone = ['terracotta', 'heritage', 'leaf'][i % 3];
            return `<div class="p-badge${got ? ' is-earned' : ' is-locked'}" data-reveal>
              <span class="p-postage p-postage--${tone}">
                <span class="p-postage-frame">
                  <span class="p-postage-top">Udaipur</span>
                  <span class="p-postage-art">${doodle[/** @type {keyof typeof doodle} */ (b.doodle)] ?? ''}</span>
                  <span class="p-postage-no">№ ${String(i + 1).padStart(2, '0')}</span>
                </span>
                ${got ? '<span class="p-postmark" aria-hidden="true"><span>MIRAS</span><b>✓</b><span>Stamped</span></span>' : ''}
              </span>
              <h3>${esc(b.title)}</h3><p lang="hi">${esc(b.titleHi)}</p>
              <p class="p-badge-how">${esc(b.how)}</p>
              <span class="p-badge-state">${got ? '✓ Stamped' : 'Not yet'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div style="margin-top:32px">${note('<p>Badges reward learning and slow travel. There are no streaks, no leaderboards, no "visit 10 places in a day", and no stamps for reaching restricted or fragile places.</p>', 'paper')}</div>`;
    reveal(root);
  };
  root.addEventListener('change', (ev) => {
    const t = /** @type {HTMLInputElement} */ (ev.target);
    if (t.matches('[data-consent]')) { setPassportConsent(t.checked); draw(); /** @type {HTMLElement | null} */ (root.querySelector('[data-consent]'))?.focus(); }
  });
  draw();
}
