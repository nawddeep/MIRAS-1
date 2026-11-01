// Point-your-camera story mode: a frontend demonstration.
// The camera starts only when asked. No frame is captured, analysed or saved:
// the visitor chooses what the camera "sees", and the page looks up a fixed
// place → story mapping. Below the confidence threshold it says "I don't know".

import { $, esc } from '../lib/dom.js';
import { getPlace, getStory } from '../data/index.js';
import { pageHead, subNav } from '../ui/shell.js';
import { icon, doodle } from '../ui/icons.js';
import { note, sourceBox, sourceBadge, statusBadge } from '../ui/components.js';

const THRESHOLD = 0.7;
/** Three demo sites, as in the phase guide, plus an unclear view. */
const SIMULATIONS = [
  { id: 'city-palace', label: 'City Palace', confidence: 0.91 },
  { id: 'jagdish-temple', label: 'Jagdish Temple', confidence: 0.86 },
  { id: 'bagore-ki-haveli', label: 'Bagore Ki Haveli', confidence: 0.82 },
  { id: 'unclear', label: 'Something unclear (poor light, wrong angle)', confidence: 0.34 },
];

/** @param {HTMLElement} main */
export function render(main) {
  main.innerHTML = `
    ${pageHead({ label: 'Explore · demonstration', title: 'Point your camera, find the story', titleHi: 'कैमरा दिखाइए, कहानी सुनिए', lead: 'Aim at a monument and MIRAS answers only from checked entries. If it is not sure, it says so.', art: doodle.camera })}
    ${subNav('explore')}
    <section class="m-section"><div class="m-wrap">
      ${note('<p><strong>Demonstration.</strong> No recognition happens on this page. Nothing from the camera is captured, analysed or saved. You choose what the camera "sees" below, so you can try both a confident answer and an "I don\'t know".</p>', 'demo')}
      <div class="p-demo-grid" style="margin-top:32px">
        <div>
          <div class="p-viewfinder" data-vf>
            <span class="p-vf-tag">Demonstration</span>
            <div class="p-vf-corners" aria-hidden="true"></div>
            <div class="p-vf-msg" data-vfmsg>${doodle.camera}<p style="margin:0">The camera is off.</p><button class="m-btn" type="button" data-cam style="background:var(--white);color:var(--heritage)!important;border-color:var(--white)">${icon.camera}<span>Start camera</span></button><p class="m-body-sm" style="margin:0;color:rgba(255,255,255,.8)">Your browser will ask for permission. You can also skip the camera entirely.</p></div>
          </div>
          <div class="m-actions" style="margin-top:12px"><button class="m-btn m-btn--quiet m-btn--sm" type="button" data-camstop hidden>${icon.stop}<span>Turn camera off</span></button></div>
          <form class="p-box" style="margin-top:16px" data-sim>
            <div class="m-field"><label for="sim">What is the camera pointed at? (simulated)</label>
              <select id="sim">${SIMULATIONS.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select></div>
            <div class="m-actions" style="margin-top:14px"><button class="m-btn" type="submit">${icon.search}<span>Find the story</span></button></div>
          </form>
        </div>
        <div aria-live="polite" data-result>
          <div class="p-result p-box--paper" style="border-color:transparent">
            <h2 class="m-h3">How it will work</h2>
            <ol class="m-steps">
              <li><div>You point the camera at a monument.</div></li>
              <li><div>MIRAS recognises the place, with a confidence score.</div></li>
              <li><div>It looks up the checked entries for that place, and nothing else.</div></li>
              <li><div>It shows the story with its type and source, or says “I don't know” and offers search.</div></li>
            </ol>
            <p class="m-body-sm m-muted" style="margin:0">Photos that include people are never stored.</p>
          </div>
        </div>
      </div>
    </div></section>`;

  /** @type {MediaStream | null} */
  let stream = null;
  const vf = /** @type {HTMLElement} */ ($('[data-vf]', main));
  const msg = /** @type {HTMLElement} */ ($('[data-vfmsg]', main));
  const stopBtn = /** @type {HTMLButtonElement} */ ($('[data-camstop]', main));
  const result = /** @type {HTMLElement} */ ($('[data-result]', main));

  const stop = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    vf.querySelector('video')?.remove();
    msg.hidden = false;
    msg.querySelector('p')?.replaceChildren('The camera is off.');
    stopBtn.hidden = true;
  };

  $('[data-cam]', main)?.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      msg.querySelector('p')?.replaceChildren('This browser cannot open the camera. Use the search below instead.');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch (err) {
      const denied = err instanceof DOMException && err.name === 'NotAllowedError';
      msg.querySelector('p')?.replaceChildren(denied ? 'Camera permission was declined. That is fine: use the choice below, or search by name.' : 'No camera was found. Use the choice below, or search by name.');
      return;
    }
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.autoplay = true;
    v.setAttribute('aria-label', 'Live camera view (not recorded)');
    v.srcObject = stream;
    vf.prepend(v);
    msg.hidden = true;
    stopBtn.hidden = false;
  });
  stopBtn.addEventListener('click', stop);
  window.addEventListener('pagehide', stop);

  $('[data-sim]', main)?.addEventListener('submit', (e) => {
    e.preventDefault();
    const sim = SIMULATIONS.find((s) => s.id === /** @type {HTMLSelectElement} */ ($('#sim', main)).value) ?? SIMULATIONS[3];
    const pct = Math.round(sim.confidence * 100);
    if (sim.confidence < THRESHOLD) {
      result.innerHTML = `<div class="p-result p-result--unknown" tabindex="-1">
        <p class="m-label m-label--muted" style="margin:0">Confidence ${pct}% · below the ${THRESHOLD * 100}% threshold</p>
        <h2 class="m-h2">I don't know.</h2>
        <p>I can't tell which place this is, so I won't guess. Try another angle or better light, or search by name.</p>
        <form action="/explore/" method="get" class="m-search" role="search"><label class="m-sr" for="cam-q">Search places</label>${icon.search}<input id="cam-q" name="q" type="search" placeholder="Search by name, e.g. Jagdish"></form>
      </div>`;
    } else {
      const p = getPlace(sim.id);
      const s = getStory(p?.storyIds[0]);
      result.innerHTML = `<div class="p-result" tabindex="-1">
        <p class="m-label m-label--blue" style="margin:0">Looks like ${esc(p?.name ?? '')} · confidence ${pct}% (simulated)</p>
        ${s ? `<div class="m-badges">${sourceBadge(s.sourceType)}${statusBadge(s.verification)}</div>
        <h2 class="m-h3">${esc(s.title)}</h2>
        <p>${esc(s.body[0])}</p>
        ${sourceBox(s)}
        <div class="m-actions"><a class="m-btn" href="/story/?id=${s.id}">Read the full story</a><a class="m-link" href="/place/?id=${p?.id}">Visit tips <span class="m-arrow" aria-hidden="true">→</span></a></div>`
        : `<p>There is no checked story for this place yet, so I have nothing to tell you. <a href="/place/?id=${p?.id}">See its profile</a>.</p>`}
      </div>`;
    }
    /** @type {HTMLElement} */ (result.firstElementChild).focus();
  });
}
