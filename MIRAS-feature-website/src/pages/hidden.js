import { esc } from '../lib/dom.js';
import { hiddenPlaces } from '../data/index.js';
import { statusBadge, tag, note } from '../ui/components.js';
import { pageHead, subNav, reveal } from '../ui/shell.js';
import { doodle } from '../ui/icons.js';
import { markProgress } from '../lib/store.js';

/** @param {HTMLElement} main */
export function render(main) {
  markProgress('hidden');
  main.innerHTML = `
    ${pageHead({ label: 'Explore', title: 'Hidden Udaipur', titleHi: 'छुपा उदयपुर', lead: 'Lesser-known corners recommended by people who live here, shared carefully, and only in general terms.', art: doodle.arch })}
    ${subNav('explore')}
    <section class="m-section"><div class="m-wrap">
      ${note('<p><strong>Every entry below is a sample</strong> written to show the format. None is a real recommendation, so none appears on a map.</p>', 'demo')}
      <div class="p-split" style="margin:40px 0 56px">
        <div><h2 class="m-h3" style="margin-bottom:12px">How a pick gets here</h2>
          <ol class="m-steps">
            <li><div><strong>A local contributor suggests it</strong>, and says how they know it.</div></li>
            <li><div><strong>A moderator checks it</strong> with the people who live there or look after it.</div></li>
            <li><div><strong>It gets a sensitivity level.</strong> High means no exact location, ever.</div></li>
            <li><div><strong>It is published or held back.</strong> Held-back picks are not shown on maps.</div></li>
          </ol></div>
        <div class="p-box p-box--paper"><h3>Sensitivity levels</h3><dl class="m-kv">
          <dt>${tag('Low', 'neutral')}</dt><dd>A public place that can take a few more visitors.</dd>
          <dt>${tag('Medium', 'neutral')}</dt><dd>Near homes or work. Visit quietly; general area only.</dd>
          <dt>${tag('High', 'neutral')}</dt><dd>Fragile, private or sacred. Shown only in general terms, with clear guidance.</dd></dl></div>
      </div>
      <div class="m-grid m-grid--2">${hiddenPlaces.map((h) => `
        <article class="p-box" data-reveal style="display:grid;grid-template-columns:84px 1fr;gap:20px">
          <div class="m-doodle" style="width:84px">${doodle[/** @type {keyof typeof doodle} */ (h.doodle)] ?? ''}</div>
          <div>
            <div class="m-badges" style="margin-bottom:8px">${statusBadge(h.verification)}${tag(`Sensitivity: ${h.sensitivity}`, 'neutral')}${tag(h.moderation, h.moderation.startsWith('Approved') ? 'local' : 'neutral')}</div>
            <h3>${esc(h.title)}</h3>
            <p class="m-body-sm m-muted" style="margin:0 0 8px">${esc(h.area)}</p>
            <p>${esc(h.blurb)}</p>
            <p class="m-body-sm"><strong>Please:</strong> ${esc(h.sensitivityNote)}</p>
            <p class="m-body-sm m-muted" style="margin:0"><strong>Source:</strong> ${esc(h.contributor)}. ${esc(h.sourcing)}</p>
          </div>
        </article>`).join('')}</div>
    </div></section>`;
  reveal(main);
}
