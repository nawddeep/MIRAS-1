import { esc } from '../lib/dom.js';
import { places } from '../data/index.js';
import { markProgress } from '../lib/store.js';
import { statusBadge, note } from '../ui/components.js';
import { pageHead, subNav, reveal } from '../ui/shell.js';
import { doodle } from '../ui/icons.js';

/** @param {HTMLElement} main */
export function render(main) {
  const withAccess = places.filter((p) => p.accessibility);
  main.innerHTML = `
    ${pageHead({ label: 'Plan', title: 'Travel responsibly', titleHi: 'ज़िम्मेदारी से यात्रा', lead: 'How to visit a lived-in city well: what we know about access, how to behave in working places, and how to take photographs without taking from people.', art: doodle.hands })}
    ${subNav('plan')}
    <section class="m-section"><div class="m-wrap">
      ${note('<p>We show accessibility and etiquette notes only where we have them, and we say how sure we are. Nothing here means a place or business has been independently certified.</p>', 'paper')}
      <div class="p-split" style="margin-top:40px">
        <section class="p-box" data-reveal aria-labelledby="r1"><h3 id="r1">Accessibility: what we know</h3>
          <p>Step-free information has been recorded for ${withAccess.length} of ${places.length} places, and none of it is checked yet. For every other place we have no information, so we show nothing rather than guess.</p>
          <ul>${withAccess.map((p) => `<li><a href="/place/?id=${p.id}">${esc(p.name)}</a>: ${esc(p.accessibility?.items[0] ?? '')} ${statusBadge(p.accessibility?.status ?? 'Unverified')}</li>`).join('')}</ul>
          <p class="m-body-sm m-muted" style="margin:0">The trip planner can avoid places recorded as having steep steps.</p>
        </section>
        <section class="p-box" data-reveal aria-labelledby="r2"><h3 id="r2">In temples and on ghats</h3><ul>
          <li>Remove footwear where asked, and dress with shoulders and knees covered.</li>
          <li>Ghats are where people bathe, wash and pray. Keep your distance and keep the steps clear.</li>
          <li>Walk clockwise around shrines, and do not touch offerings.</li>
          <li>Ask before entering an inner sanctum; some are closed to visitors.</li></ul></section>
        <section class="p-box" data-reveal aria-labelledby="r3"><h3 id="r3">Taking photographs</h3><ul>
          <li>Ask first, every time a person is the subject. A smile and a gesture to the camera is enough.</li>
          <li>Never photograph people bathing, praying or in their homes without clear permission.</li>
          <li>Follow photography signs at sites; some charge a fee, some forbid it.</li>
          <li>If someone says no, or later asks you to delete a photo, do.</li></ul>
          <p class="m-body-sm m-muted" style="margin:0">MIRAS flags strangers' faces in your memories and asks before anything is shared.</p></section>
        <section class="p-box" data-reveal aria-labelledby="r4"><h3 id="r4">Looking after the lakes and lanes</h3><ul>
          <li>Carry a bottle; refill rather than buying plastic.</li>
          <li>Take rubbish away from the ghats and the hills.</li>
          <li>Do not climb on old walls, carvings or roofs for a view.</li>
          <li>Buy from makers directly where you can, and pay a fair price.</li></ul></section>
        <section class="p-box p-box--paper" data-reveal aria-labelledby="r5"><h3 id="r5">Spreading out</h3>
          <p>Popular places get very busy at sunset. Place profiles suggest a quieter time or a nearby alternative, labelled as an estimate: we do not use live crowd data.</p>
          <p style="margin:0">The heritage passport rewards learning, never visiting more places faster, and never going somewhere off-limits.</p></section>
        <section class="p-box" data-reveal aria-labelledby="r6"><h3 id="r6">Hidden places</h3>
          <p style="margin:0">Lesser-known spots are shared with their sensitivity and only in general terms, so fragile, private or sacred places are not overwhelmed. <a href="/explore/hidden/">How Hidden Udaipur works</a>.</p></section>
      </div>
    </div></section>`;
  markProgress('respect');
  reveal(main);
}
