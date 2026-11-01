import { param } from '../lib/dom.js';
import { getWorkshop } from '../data/index.js';
import { pageHead, subNav } from '../ui/shell.js';
import { doodle } from '../ui/icons.js';
import { enquiryFormHTML, bindEnquiry } from '../ui/enquiry.js';

/** @param {HTMLElement} main */
export function render(main) {
  const ws = getWorkshop(param('workshop'));
  main.innerHTML = `
    ${pageHead({ label: 'Enquiry', title: 'Ask a maker', titleHi: 'कारीगर से पूछिए', lead: 'Send a short message or ask for an appointment. The maker replies to you directly, outside MIRAS.', art: doodle.postcard })}
    ${subNav('artisans')}
    <section class="m-section"><div class="m-wrap p-layout">
      <div>${enquiryFormHTML({ artisanId: ws?.artisanId ?? param('artisan'), workshopTitle: ws?.title ?? '' })}</div>
      <aside class="p-aside">
        <div class="p-box p-box--paper"><h3>What happens next</h3>
          <ol class="m-steps">
            <li><div>You send a message or appointment request.</div></li>
            <li><div>The maker is notified (in the real app).</div></li>
            <li><div>They reply to you by email or phone, outside MIRAS.</div></li>
          </ol>
        </div>
        <div class="p-box"><h3>No payment here</h3><p style="margin:0">An enquiry never involves money. Paying for a workshop or an item is a separate step, shown only as a <a href="/book/">booking demonstration</a>.</p></div>
      </aside>
    </div></section>`;
  bindEnquiry(main);
}
