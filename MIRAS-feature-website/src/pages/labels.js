import { esc } from '../lib/dom.js';
import { media } from '../data/index.js';
import { statusBadge, sourceBadge, tag } from '../ui/components.js';
import { pageHead } from '../ui/shell.js';
import { doodle } from '../ui/icons.js';

/** @param {HTMLElement} main */
export function render(main) {
  main.innerHTML = `
    ${pageHead({ label: 'About this site', title: 'How we label things', titleHi: 'हम चीज़ों को कैसे चिह्नित करते हैं', lead: 'MIRAS tries never to let a guess look like a fact. These labels say how much to trust what you are reading.', art: doodle.quill })}
    <section class="m-section"><div class="m-wrap">
      <h2 class="m-h3" style="margin-bottom:16px">What kind of story</h2>
      <div class="p-labels" style="margin-bottom:56px">
        <div><div>${sourceBadge('History')}</div><p style="margin:0">Documented in written records. Each one should cite the record.</p></div>
        <div><div>${sourceBadge('Oral tradition')}</div><p style="margin:0">Passed down locally. Recorded with the teller's permission, and named only if they agree.</p></div>
        <div><div>${sourceBadge('Legend')}</div><p style="margin:0">Told and retold. Worth hearing; not to be read as fact.</p></div>
      </div>
      <h2 class="m-h3" style="margin-bottom:16px">How sure we are</h2>
      <div class="p-labels" style="margin-bottom:56px">
        <div><div>${statusBadge('Verified')}</div><p style="margin:0">Has a source and was checked by someone other than its writer. <strong>Nothing on this demonstration site is Verified yet.</strong></p></div>
        <div><div>${statusBadge('Unverified')}</div><p style="margin:0">Based on widely published information, not yet checked by MIRAS.</p></div>
        <div><div>${statusBadge('Illustrative')}</div><p style="margin:0">A sample written or drawn to show how something will look. Not real data.</p></div>
        <div><div>${statusBadge('Concept')}</div><p style="margin:0">An idea that is not built. Shown so you know where MIRAS is going.</p></div>
        <div><div>${statusBadge('Reconstructed')}</div><p style="margin:0">An interpretation of how something may once have looked. Never a record.</p></div>
        <div><div>${tag('Estimate', 'estimate')}</div><p style="margin:0">A suggestion worked out from sample data, such as a quieter time to visit. No live crowd data is used.</p></div>
        <div><div>${tag('Demonstration profile', 'demo')}</div><p style="margin:0">A maker or business invented for this demo. Not a real person.</p></div>
      </div>
      <h2 class="m-h3" id="rights" style="margin-bottom:8px;scroll-margin-top:90px">Image rights</h2>
      <p class="m-muted" style="max-width:70ch">Who made each image and what it may be used for. Public does not mean reusable. Line drawings and icons not listed here were drawn in code for MIRAS.</p>
      <div class="p-table-scroll"><table class="p-rights">
        <thead><tr><th scope="col">Image</th><th scope="col">Kind</th><th scope="col">Creator</th><th scope="col">Licence</th><th scope="col">Permitted use</th><th scope="col">Notes</th></tr></thead>
        <tbody>${Object.values(media).map((m) => `<tr><td><code>${esc(m.src)}</code></td><td>${esc(m.label)}</td><td>${esc(m.creator)}</td><td>${esc(m.licence)}</td><td>${esc(m.permittedUse)}</td><td>${esc(m.notes)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div></section>`;
}
