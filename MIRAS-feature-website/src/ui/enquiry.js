// Enquiry and appointment-request form. Separate from the booking demo:
// there is no payment language here. Nothing is sent and nobody is notified.

import { $, esc, toast } from '../lib/dom.js';
import { icon } from './icons.js';
import { artisans, getArtisan } from '../data/index.js';

/** @param {{artisanId?: string | null, workshopTitle?: string}} [o] */
export function enquiryFormHTML({ artisanId = null, workshopTitle = '' } = {}) {
  return `
  <form class="m-form" novalidate data-enquiry>
    <div class="m-note m-note--demo">${icon.pencil}<div><p><strong>Demonstration.</strong> This form checks your details and shows what would happen, but nothing is sent and nobody is notified. No payment is involved in an enquiry.</p></div></div>
    <div class="m-field">
      <label for="eq-maker">Maker</label>
      <select id="eq-maker" name="maker" required>
        <option value="">Choose a maker</option>
        ${artisans.map((a) => `<option value="${a.id}"${a.id === artisanId ? ' selected' : ''}>${esc(a.studio)} · ${esc(a.craft)}</option>`).join('')}
      </select>
    </div>
    <fieldset class="m-field">
      <legend>What would you like to do?</legend>
      <div class="m-checks" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
        <label class="m-check"><input type="radio" name="type" value="message" checked> Send a short message</label>
        <label class="m-check"><input type="radio" name="type" value="appointment"> Request an appointment</label>
      </div>
    </fieldset>
    <div class="m-form-row">
      <div class="m-field"><label for="eq-name">Your name</label><input id="eq-name" name="name" autocomplete="name" required></div>
      <div class="m-field"><label for="eq-contact">Email or phone</label><input id="eq-contact" name="contact" autocomplete="email" required aria-describedby="eq-contact-hint"><p class="m-hint" id="eq-contact-hint">So the maker could reply outside MIRAS.</p></div>
    </div>
    <div class="m-form-row" data-appt hidden>
      <div class="m-field"><label for="eq-date">Preferred date</label><input id="eq-date" name="date" type="date"></div>
      <div class="m-field"><label for="eq-time">Time of day</label><select id="eq-time" name="time"><option>Morning</option><option>Afternoon</option><option>Evening</option></select></div>
    </div>
    <div class="m-field"><label for="eq-msg">Message</label><textarea id="eq-msg" name="message" required placeholder="What would you like to ask?">${workshopTitle ? `Hello, I'd like to ask about "${esc(workshopTitle)}". ` : ''}</textarea></div>
    <label class="m-check m-body-sm"><input type="checkbox" name="fail"> Show the error state (for testing this demo)</label>
    <div class="m-actions"><button class="m-btn" type="submit">Send enquiry (demo)</button></div>
    <div data-result aria-live="polite"></div>
  </form>`;
}

/** @param {ParentNode} root */
export function bindEnquiry(root) {
  const form = /** @type {HTMLFormElement | null} */ ($('[data-enquiry]', root));
  if (!form) return;
  const appt = /** @type {HTMLElement} */ ($('[data-appt]', form));
  const result = /** @type {HTMLElement} */ ($('[data-result]', form));
  form.addEventListener('change', (e) => {
    const t = /** @type {HTMLInputElement} */ (e.target);
    if (t.name === 'type') appt.hidden = t.value !== 'appointment';
  });

  /** @param {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} input @param {string} msg */
  const flag = (input, msg) => {
    const f = /** @type {HTMLElement} */ (input.closest('.m-field'));
    f.classList.add('is-invalid');
    const id = input.id + '-err';
    f.insertAdjacentHTML('beforeend', `<p class="m-error" id="${id}">${esc(msg)}</p>`);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), id].filter(Boolean).join(' '));
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.querySelectorAll('.m-error').forEach((n) => n.remove());
    form.querySelectorAll('.is-invalid').forEach((n) => n.classList.remove('is-invalid'));
    form.querySelectorAll('[aria-invalid]').forEach((n) => {
      n.removeAttribute('aria-invalid');
      const d = (n.getAttribute('aria-describedby') || '').split(' ').filter((x) => !x.endsWith('-err')).join(' ');
      d ? n.setAttribute('aria-describedby', d) : n.removeAttribute('aria-describedby');
    });
    const el = form.elements;
    const maker = /** @type {HTMLSelectElement} */ (el.namedItem('maker'));
    const name = /** @type {HTMLInputElement} */ (el.namedItem('name'));
    const contact = /** @type {HTMLInputElement} */ (el.namedItem('contact'));
    const msg = /** @type {HTMLTextAreaElement} */ (el.namedItem('message'));
    const date = /** @type {HTMLInputElement} */ (el.namedItem('date'));
    const isAppt = /** @type {HTMLInputElement} */ (form.querySelector('[name=type]:checked')).value === 'appointment';
    /** @type {HTMLElement | null} */
    let first = null;
    if (!maker.value) { flag(maker, 'Choose which maker to contact.'); first ||= maker; }
    if (!name.value.trim()) { flag(name, 'Please tell the maker your name.'); first ||= name; }
    const c = contact.value.trim();
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);
    const okPhone = /^[+\d][\d\s-]{7,}$/.test(c);
    if (!okEmail && !okPhone) { flag(contact, 'Enter an email address or a phone number with at least 8 digits.'); first ||= contact; }
    if (msg.value.trim().length < 10) { flag(msg, 'Write a short message (at least 10 characters).'); first ||= msg; }
    if (isAppt && !date.value) { flag(date, 'Choose a preferred date for the appointment.'); first ||= date; }
    if (isAppt && date.value && new Date(date.value) < new Date(new Date().toDateString())) { flag(date, 'Choose a date that is not in the past.'); first ||= date; }
    if (first) { first.focus(); result.innerHTML = ''; return; }

    const a = getArtisan(maker.value);
    const fail = /** @type {HTMLInputElement} */ (el.namedItem('fail')).checked;
    const btn = /** @type {HTMLButtonElement} */ (form.querySelector('[type=submit]'));
    btn.disabled = true;
    btn.textContent = 'Sending…';
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Send enquiry (demo)';
      if (fail) {
        result.innerHTML = `<div class="m-status m-status--err" role="alert">${icon.alert}<div><h3>That didn't go through (simulated)</h3><p>Nothing was lost: your message is still in the form. Untick the test option and try again.</p></div></div>`;
        return;
      }
      result.innerHTML = `<div class="m-status m-status--ok" tabindex="-1">${icon.check}<div>
        <h3>Enquiry ready, but not sent</h3>
        <p>In the real app, ${esc(a?.studio ?? 'the maker')} would be notified and would reply to you outside MIRAS${isAppt ? ' about your appointment request' : ''}.</p>
        <p><strong>This is a demonstration: nobody was notified and nothing was stored.</strong></p>
      </div></div>`;
      /** @type {HTMLElement} */ (result.firstElementChild).focus();
      toast('Demo enquiry complete. Nobody was notified.');
    }, 700);
  });
}
