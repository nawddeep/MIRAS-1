// Booking and checkout: a frontend demonstration only. Kept separate from the
// enquiry flow. No card fields, no payment provider, no money moves.

import { esc, param, fmtINR, fmtDuration, toast } from '../lib/dom.js';
import { workshops, products, getArtisan } from '../data/index.js';
import { pageHead, subNav } from '../ui/shell.js';
import { icon, doodle } from '../ui/icons.js';
import { note } from '../ui/components.js';

const bookable = workshops.filter((w) => w.howToBook.includes('booking'));

/** @param {HTMLElement} main */
export function render(main) {
  const type0 = param('type') === 'product' ? 'product' : 'workshop';
  const id0 = param('id');
  const state = {
    step: 1, type: type0,
    id: (type0 === 'product' ? products.find((p) => p.id === id0) : bookable.find((w) => w.id === id0))?.id ?? (type0 === 'product' ? products[0].id : bookable[0].id),
    qty: 1, date: '', ref: '', status: /** @type {'none'|'confirmed'|'cancelled'} */ ('none'),
  };

  main.innerHTML = `
    ${pageHead({ label: 'Workshops & events · demonstration', title: 'Booking, shown but not taken', titleHi: 'बुकिंग (केवल प्रदर्शन)', lead: 'How booking a workshop or buying from a maker would work once demand is proven and payments are safe to add.', art: icon.ticket })}
    ${subNav('workshops')}
    <section class="m-section"><div class="m-wrap">
      ${note('<p><strong>Frontend demonstration.</strong> There is no payment provider, no card form and no business on the other end. Nothing is charged, booked or sent. For real contact with a maker, use an <a href="/enquire/">enquiry</a> instead.</p>', 'demo')}
      <ol class="p-steps" style="margin-top:32px" aria-label="Booking steps" data-steps></ol>
      <div class="p-layout"><div data-body aria-live="polite"></div>
        <aside class="p-aside">
          <div class="p-box"><h3>Cancellations</h3><p class="m-body-sm" style="margin:0">Draft policy: cancel up to 24 hours before a workshop for a full refund; later cancellations at the maker's discretion. Not in force: no bookings are taken.</p></div>
          <div class="p-box"><h3>Refunds</h3><p class="m-body-sm" style="margin:0">Draft: refunds would go back to the original payment method through the licensed provider. Timings would depend on that provider.</p></div>
          <div class="p-box"><h3>Disputes</h3><p class="m-body-sm" style="margin:0">Draft: raise a problem within 7 days; MIRAS would hear both sides before the provider's process. A compliance review must come first.</p></div>
        </aside>
      </div>
    </div></section>`;

  const steps = /** @type {HTMLElement} */ (main.querySelector('[data-steps]'));
  const body = /** @type {HTMLElement} */ (main.querySelector('[data-body]'));
  const item = () => state.type === 'product' ? products.find((p) => p.id === state.id) : workshops.find((w) => w.id === state.id);
  const unit = () => { const it = item(); return it ? ('price' in it ? it.price.amount : it.cost.amount) : 0; };

  const draw = () => {
    steps.innerHTML = ['Choose', 'Review', 'Payment', 'Confirmation'].map((l, i) => `<li class="${i + 1 === state.step ? 'is-on' : i + 1 < state.step ? 'is-done' : ''}"${i + 1 === state.step ? ' aria-current="step"' : ''}><b>${i + 1}.</b>${l}</li>`).join('');
    const it = item();
    const a = getArtisan(it?.artisanId);
    if (state.step === 1) {
      body.innerHTML = `<form class="m-form" data-choose novalidate>
        <div class="m-seg" role="group" aria-label="What are you booking?">
          <button type="button" data-type="workshop" aria-pressed="${state.type === 'workshop'}">A workshop</button>
          <button type="button" data-type="product" aria-pressed="${state.type === 'product'}">An item</button>
        </div>
        <fieldset class="m-field"><legend>${state.type === 'workshop' ? 'Workshop' : 'Item'}</legend><div class="p-choice">
          ${(state.type === 'workshop' ? bookable : products).map((x) => {
            const price = 'price' in x ? x.price.amount : x.cost.amount;
            const sub = 'durationMin' in x ? `${fmtDuration(x.durationMin)} · ${getArtisan(x.artisanId)?.studio}` : `${x.material} · ${getArtisan(x.artisanId)?.studio}`;
            return `<label><input type="radio" name="id" value="${x.id}"${x.id === state.id ? ' checked' : ''}><span><strong>${esc(x.title)}</strong><span class="m-muted">${esc(sub)}</span></span><span>${fmtINR(price)}</span></label>`;
          }).join('')}</div></fieldset>
        <div class="m-form-row">
          ${state.type === 'workshop' ? `<div class="m-field"><label for="bk-date">Date</label><input id="bk-date" name="date" type="date" value="${state.date}" required><p class="m-hint">Any date: availability is not real.</p></div>` : ''}
          <div class="m-field"><label for="bk-qty">${state.type === 'workshop' ? 'People' : 'Quantity'}</label><select id="bk-qty" name="qty">${[1, 2, 3, 4].map((n) => `<option${n === state.qty ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
        </div>
        <div data-err aria-live="assertive"></div>
        <div class="m-actions"><button class="m-btn" type="submit">Review</button></div>
      </form>`;
    } else if (state.step === 2) {
      body.innerHTML = `<h2 class="m-h3" style="margin-bottom:16px">Check the details</h2>
        <table class="p-summary"><tbody>
          <tr><th scope="row">${state.type === 'workshop' ? 'Workshop' : 'Item'}</th><td>${esc(it?.title)}</td></tr>
          <tr><th scope="row">Maker</th><td>${esc(a?.studio)} <span class="m-muted">(demonstration profile)</span></td></tr>
          ${state.type === 'workshop' ? `<tr><th scope="row">Date</th><td>${new Date(state.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>` : ''}
          <tr><th scope="row">${state.type === 'workshop' ? 'People' : 'Quantity'}</th><td>${state.qty} × ${fmtINR(unit())}</td></tr>
          <tr class="p-total"><th scope="row">Total (illustrative)</th><td>${fmtINR(unit() * state.qty)}</td></tr>
        </tbody></table>
        <p class="m-body-sm m-muted" style="margin-top:10px">Illustrative prices. Taxes and fees are not modelled.</p>
        <div class="m-actions" style="margin-top:20px"><button class="m-btn m-btn--quiet" type="button" data-go="1">Back</button><button class="m-btn" type="button" data-go="3">Continue to payment</button></div>`;
    } else if (state.step === 3) {
      body.innerHTML = `<h2 class="m-h3" style="margin-bottom:16px">Payment (illustrative)</h2>
        <div class="m-postcard" style="background:var(--white)">
          <span class="m-perf" aria-hidden="true">${doodle.lamp}</span>
          <p style="padding-right:60px">In the real app you would now be handed to a <strong>licensed payment provider</strong>. MIRAS would never see your card details. This step needs business verification and a compliance review before it can exist.</p>
          <p class="m-muted">No payment details are asked for on this page. Choose an outcome to see each state:</p>
          <div class="m-actions"><button class="m-btn" type="button" data-pay="ok">Simulate a successful payment</button><button class="m-btn m-btn--danger" type="button" data-pay="fail">Simulate a failed payment</button></div>
        </div>
        <div data-payerr aria-live="assertive" style="margin-top:16px"></div>
        <div class="m-actions" style="margin-top:20px"><button class="m-btn m-btn--quiet" type="button" data-go="2">Back</button></div>`;
    } else {
      body.innerHTML = state.status === 'cancelled'
        ? `<div class="m-status" tabindex="-1">${icon.info}<div><h3>Booking ${esc(state.ref)} cancelled (simulated)</h3><p>Under the draft policy this would be a full refund. Nothing was charged in the first place.</p></div></div>
           <div class="m-actions" style="margin-top:20px"><button class="m-btn m-btn--ghost" type="button" data-restart>Start a new demo booking</button></div>`
        : `<div class="p-confirm" tabindex="-1">
          <span class="m-stamp"><b>Demo</b>not booked</span>
          <p class="m-label" style="margin:0">Simulated confirmation</p>
          <h2 class="m-h3" style="padding-right:110px">${esc(it?.title)}</h2>
          <dl class="m-kv"><dt>Reference</dt><dd>${esc(state.ref)}</dd><dt>Total</dt><dd>${fmtINR(unit() * state.qty)} (not charged)</dd><dt>Maker</dt><dd>${esc(a?.studio)} (not notified)</dd></dl>
          <p style="margin:0"><strong>This is a frontend demonstration.</strong> No booking exists, no money moved, and no one was told.</p>
          <div class="m-actions"><button class="m-btn m-btn--danger" type="button" data-cancel>Cancel this booking</button><button class="m-btn m-btn--quiet" type="button" data-restart>Start again</button></div>
        </div>`;
      /** @type {HTMLElement | null} */ (body.firstElementChild)?.focus();
    }
  };

  body.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const f = new FormData(form);
    state.id = String(f.get('id') || state.id);
    state.qty = Number(f.get('qty') || 1);
    if (state.type === 'workshop') {
      const date = String(f.get('date') || '');
      const err = /** @type {HTMLElement} */ (form.querySelector('[data-err]'));
      const input = /** @type {HTMLInputElement} */ (form.querySelector('#bk-date'));
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (!date || new Date(date + 'T00:00:00') < today) {
        err.innerHTML = `<p class="m-error" id="bk-date-err">${date ? 'Choose a date that is not in the past.' : 'Choose a date for the workshop.'}</p>`;
        input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', 'bk-date-err'); input.focus(); return;
      }
      state.date = date;
    }
    state.step = 2; draw();
  });
  body.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const ty = /** @type {HTMLElement | null} */ (t.closest('[data-type]'));
    if (ty) { state.type = ty.dataset.type === 'product' ? 'product' : 'workshop'; state.id = state.type === 'product' ? products[0].id : bookable[0].id; draw(); /** @type {HTMLElement | null} */ (body.querySelector(`[data-type="${state.type}"]`))?.focus(); }
    const go = /** @type {HTMLElement | null} */ (t.closest('[data-go]'));
    if (go) { state.step = Number(go.dataset.go); draw(); }
    const pay = /** @type {HTMLElement | null} */ (t.closest('[data-pay]'));
    if (pay?.dataset.pay === 'fail') {
      /** @type {HTMLElement} */ (body.querySelector('[data-payerr]')).innerHTML = `<div class="m-status m-status--err" role="alert">${icon.alert}<div><h3>Payment failed (simulated)</h3><p>Nothing was charged. In the real app you could try again or choose another method with the provider.</p></div></div>`;
    }
    if (pay?.dataset.pay === 'ok') { state.ref = 'DEMO-' + Math.random().toString(36).slice(2, 7).toUpperCase(); state.status = 'confirmed'; state.step = 4; draw(); toast('Simulated confirmation. Nothing was booked.'); }
    if (t.closest('[data-cancel]')) { state.status = 'cancelled'; draw(); }
    if (t.closest('[data-restart]')) { state.step = 1; state.status = 'none'; state.ref = ''; draw(); }
  });
  draw();
}
