import { esc } from '../lib/dom.js';
import { audioWalks, getPlace } from '../data/index.js';
import { statusBadge, tag } from '../ui/components.js';
import { pageHead, subNav, reveal } from '../ui/shell.js';
import { doodle } from '../ui/icons.js';

/** @param {HTMLElement} main */
export function render(main) {
  main.innerHTML = `
    ${pageHead({ label: 'Plan', title: 'Audio walks', titleHi: 'सुनते हुए सैर', lead: 'Short chapters to listen to as you walk, with numbered stops so you never need to look at a map for long.', art: doodle.ear })}
    ${subNav('plan')}
    <section class="m-section"><div class="m-wrap">
      <div class="m-grid m-grid--2">${audioWalks.map((w) => `
        <article class="m-card m-postcard" data-reveal>
          <span class="m-perf" aria-hidden="true">${doodle.ear}</span>
          <p class="m-label" style="margin:0">${w.chapters.length} chapters · about ${w.durationMin} min</p>
          <h2 class="m-card-title" style="font-size:32px;padding-right:60px"><a href="/walk/?id=${w.id}">${esc(w.title)}</a></h2>
          <p>${esc(w.blurb)}</p>
          <ol class="p-route">${w.chapters.map((c, i) => `<li><span class="p-route-n">${i + 1}</span><span style="font:600 18px var(--font-serif);color:var(--heritage-deep)">${esc(c.title)}</span><span class="m-muted">${esc(getPlace(c.placeId)?.name ?? '')}</span></li>`).join('')}</ol>
          <div class="m-badges">${statusBadge(w.verification)}${tag('Synthetic voice', 'demo')}</div>
        </article>`).join('')}</div>
    </div></section>`;
  reveal(main);
}
