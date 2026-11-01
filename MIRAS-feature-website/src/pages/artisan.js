import { esc, param, fmtINR, fmtDate, fmtDuration } from '../lib/dom.js';
import { getArtisan, getPlace, productsFor, servicesFor, workshopsFor, placesNear } from '../data/index.js';
import { markProgress } from '../lib/store.js';
import { statusBadge, tag, note } from '../ui/components.js';
import { notFound, reveal } from '../ui/shell.js';
import { icon, doodle } from '../ui/icons.js';
import { enquiryFormHTML, bindEnquiry } from '../ui/enquiry.js';

/** @param {HTMLElement} main */
export function render(main) {
  const a = getArtisan(param('id'));
  if (!a) { main.innerHTML = notFound('maker', '/artisans/', 'All makers'); return; }
  document.title = `${a.studio} · MIRAS Udaipur`;
  const near = getPlace(a.nearPlaceId);
  const prods = productsFor(a.id), servs = servicesFor(a.id), ws = workshopsFor(a.id);
  const nearby = placesNear(a.coords, 3);
  const art = doodle[/** @type {keyof typeof doodle} */ (a.doodle)] ?? '';

  main.innerHTML = `
    <section class="p-hero"><div class="m-wrap">
      <a class="p-back" href="/artisans/">${icon.back} All makers</a>
      <div class="p-hero-grid">
        <div>
          <p class="m-label">${esc(a.craft)} · <span lang="hi">${esc(a.craftHi)}</span></p>
          <h1 class="m-h1">${esc(a.studio)}</h1>
          <p class="m-lead" style="margin-top:16px">${esc(a.intro)}</p>
          <div class="m-badges" style="margin-bottom:20px">${tag('Demonstration profile', 'demo')}${statusBadge(a.verification)}<span class="m-muted m-body-sm">Last updated ${fmtDate(a.lastUpdated)}</span></div>
          <div class="m-actions"><a class="m-btn" href="#enquire">Send an enquiry</a>${ws.length ? `<a class="m-btn m-btn--ghost" href="/workshop/?id=${ws[0].id}">See the workshop</a>` : ''}</div>
        </div>
        <div class="m-postcard p-card-split">
          <div>
            <p class="m-hand" style="margin:0 0 10px">How the work is done</p>
            <p style="margin:0">${esc(a.process)}</p>
          </div>
          <div class="m-doodle">${art}</div>
        </div>
      </div>
    </div></section>

    <div class="m-wrap" style="padding:clamp(36px,5vw,64px) var(--m-gutter) clamp(48px,6vw,96px)">
      <div class="p-layout">
        <div>
          <section class="p-block" aria-labelledby="prod-h">
            <p class="m-label">Sells</p>
            <h2 id="prod-h">Products</h2>
            ${prods.length ? `<table class="p-summary"><caption class="m-sr">Products</caption><thead><tr><th scope="col">Item</th><th scope="col">Material</th><th scope="col" style="text-align:right">Price</th></tr></thead><tbody>
              ${prods.map((p) => `<tr><td><strong style="font:600 18px var(--font-serif)">${esc(p.title)}</strong></td><td class="m-muted">${esc(p.material)}</td><td style="text-align:right">${fmtINR(p.price.amount)}<br><span class="m-body-sm m-muted">${esc(p.price.note)}</span></td></tr>`).join('')}
            </tbody></table>
            <div class="m-actions" style="margin-top:16px"><a class="m-link" href="/book/?type=product&id=${prods[0].id}">Try the purchase demonstration <span class="m-arrow" aria-hidden="true">→</span></a></div>
            <p class="m-body-sm m-muted" style="margin-top:10px">No product photos yet: photos are shown only with the maker's consent and clear rights.</p>` : note('<p>This maker has not listed products.</p>', 'paper')}
          </section>
          <section class="p-block" aria-labelledby="serv-h">
            <p class="m-label">Offers to do</p>
            <h2 id="serv-h">Services</h2>
            ${servs.length ? `<div style="display:grid;gap:14px">${servs.map((s) => `<div class="p-box"><h3>${esc(s.title)}</h3><p style="margin:0 0 6px">${esc(s.detail)}</p><p class="m-body-sm m-muted" style="margin:0">How to ask: ${esc(s.howToRequest)}</p></div>`).join('')}</div>` : note('<p>This maker has not listed any services.</p>', 'paper')}
          </section>
          <section class="p-block" aria-labelledby="ws-h">
            <p class="m-label">Teaches</p>
            <h2 id="ws-h">Workshops</h2>
            ${ws.length ? ws.map((w) => `<div class="p-box"><h3><a href="/workshop/?id=${w.id}">${esc(w.title)}</a></h3><ul class="m-meta"><li>${icon.clock}${fmtDuration(w.durationMin)}</li><li>${fmtINR(w.cost.amount)} (${esc(w.cost.note.toLowerCase())})</li><li>${esc(w.howToBook)}</li></ul></div>`).join('') : note('<p>No workshops listed.</p>', 'paper')}
          </section>
          <section class="p-block" id="enquire" aria-labelledby="enq-h" style="scroll-margin-top:90px">
            <h2 id="enq-h">Send an enquiry</h2>
            ${enquiryFormHTML({ artisanId: a.id })}
          </section>
        </div>
        <aside class="p-aside">
          <div class="p-box"><h3>Where</h3><p style="margin:0 0 6px">${esc(a.area)}${near ? `, near <a href="/place/?id=${near.id}">${esc(near.name)}</a>` : ''}.</p><p class="m-body-sm m-muted" style="margin:0">General area only. Exact addresses are shared by the maker directly.</p></div>
          <div class="p-box"><h3>Languages</h3><p style="margin:0">${a.languages.map(esc).join(', ')}</p></div>
          <div class="p-box p-box--paper"><h3>Consent</h3><p style="margin:0 0 6px"><strong>${esc(a.consent.status)}.</strong></p><p class="m-body-sm" style="margin:0">${esc(a.consent.note)}</p></div>
          ${nearby.length ? `<div class="p-box"><h3>Places close by</h3><ul class="p-near">${nearby.map(({ place }) => `<li><a href="/place/?id=${place.id}"><span>${esc(place.name)}</span><span class="m-muted">${esc(place.category)}</span></a></li>`).join('')}</ul></div>` : ''}
        </aside>
      </div>
    </div>`;
  bindEnquiry(main);
  markProgress('maker');
  reveal(main);
}
