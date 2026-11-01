// Voice-first maker onboarding: a frontend demonstration.
// The microphone is requested only when the visitor presses record. The recording
// stays in this tab (never uploaded or stored) and the "draft" comes from a fixed
// template for the chosen craft. Nothing publishes without explicit approval.

import { $, esc, toast } from '../lib/dom.js';
import { pageHead, subNav } from '../ui/shell.js';
import { icon, doodle } from '../ui/icons.js';
import { note } from '../ui/components.js';

const TEMPLATES = {
  painting: { cat: 'Miniature painting', catHi: 'लघु चित्रकला', titleHi: 'हाथ से बनी लघु चित्रकारी', title: 'Hand-painted miniatures',
    hi: 'हम गिलहरी के बालों के ब्रश और प्राकृतिक रंगों से, हाथ से बने काग़ज़ पर छोटे चित्र बनाते हैं।',
    en: 'We paint small pictures on handmade paper using squirrel-hair brushes and natural colours.' },
  textile: { cat: 'Textile dyeing', catHi: 'कपड़ा रंगाई', titleHi: 'हाथ से रंगा लहरिया और बंधेज', title: 'Hand-dyed leheriya and bandhej',
    hi: 'हम सूती कपड़े को बाँधकर और रंगकर लहरिया और बंधेज बनाते हैं।',
    en: 'We tie and dye cotton cloth by hand to make leheriya and bandhej.' },
  lac: { cat: 'Lac bangles', catHi: 'लाख की चूड़ियाँ', titleHi: 'हाथ से बनी लाख की चूड़ियाँ', title: 'Handmade lac bangles',
    hi: 'हम लाख को गरम करके हाथ से चूड़ियाँ बनाते हैं और उनमें काँच के नग लगाते हैं।',
    en: 'We heat lac and shape bangles by hand, setting glass stones into them.' },
  clay: { cat: 'Clay and terracotta', catHi: 'मिट्टी का काम', titleHi: 'हाथ से बनी मिट्टी की कला', title: 'Handmade terracotta',
    hi: 'हम स्थानीय मिट्टी से हाथ से मूर्तियाँ और बर्तन बनाते हैं।',
    en: 'We make figures and pots by hand from local clay.' },
};

/** @param {HTMLElement} main */
export function render(main) {
  main.innerHTML = `
    ${pageHead({ label: 'For makers · demonstration', title: 'Add your workshop by speaking', titleHi: 'बोलकर अपनी दुकान जोड़िए', lead: 'Talk about your craft in Hindi, add a photo, check the draft, and approve it. Or type, if you prefer.', art: doodle.mic })}
    ${subNav('artisans')}
    <section class="m-section"><div class="m-wrap">
      ${note('<p><strong>Demonstration only.</strong> No speech recognition or AI runs here. Your recording and photo stay in this browser tab and are never uploaded or saved. The draft comes from a fixed sample for the craft you choose. Nothing is published.</p>', 'demo')}
      <ol class="p-flow" style="margin-top:32px" aria-label="Steps">
        <li data-step="1" class="is-on">Speak or type</li><li data-step="2">Photo</li><li data-step="3">Check the draft</li><li data-step="4">Approve or reject</li>
      </ol>
      <div class="p-demo-grid">
        <div>
          <section data-panel="1" aria-labelledby="s1">
            <h2 class="m-h3" id="s1" style="margin-bottom:14px">1. Tell us about your craft</h2>
            <div class="m-form">
              <div class="m-field"><label for="j-craft">What do you make?</label>
                <select id="j-craft"><option value="painting">Miniature painting · लघु चित्रकला</option><option value="textile">Textile dyeing · कपड़ा रंगाई</option><option value="lac">Lac bangles · लाख की चूड़ियाँ</option><option value="clay">Clay and terracotta · मिट्टी का काम</option></select>
                <p class="m-hint">In the real app this would be worked out from what you say. Here it picks which sample draft to show.</p></div>
              <div class="p-box">
                <p class="m-field-label" style="margin:0 0 10px">Speak (Hindi or English)</p>
                <div class="p-rec">
                  <button class="m-btn" type="button" data-rec>${icon.mic}<span>Start recording</span></button>
                  <span data-recstate class="m-body-sm m-muted" aria-live="polite">Your browser will ask for the microphone only when you press this.</span>
                </div>
                <div data-playback style="margin-top:12px"></div>
              </div>
              <div class="m-field"><label for="j-text">Or type instead</label><textarea id="j-text" placeholder="For example: हम हाथ से चूड़ियाँ बनाते हैं… / We make bangles by hand…"></textarea></div>
              <div class="m-actions"><button class="m-btn" type="button" data-next="2">Next: add a photo</button></div>
            </div>
          </section>

          <section data-panel="2" aria-labelledby="s2" hidden>
            <h2 class="m-h3" id="s2" style="margin-bottom:14px">2. Show us your work</h2>
            <div class="m-form">
              <div class="m-field m-file"><label for="j-photo">Choose or take a photo (optional)</label><input id="j-photo" type="file" accept="image/*" capture="environment"><p class="m-hint">Only of your own work, and never of people who have not agreed. It is shown here and nowhere else.</p></div>
              <div data-photo></div>
              <div class="m-actions"><button class="m-btn m-btn--quiet" type="button" data-next="1">Back</button><button class="m-btn" type="button" data-make>Make my draft</button></div>
            </div>
          </section>

          <section data-panel="3" aria-labelledby="s3" hidden>
            <h2 class="m-h3" id="s3" style="margin-bottom:6px">3. Check the draft</h2>
            <p class="m-muted">Change anything that is wrong. You know your work better than any draft.</p>
            <form class="p-draft" data-draft novalidate></form>
          </section>

          <section data-panel="4" aria-labelledby="s4" hidden tabindex="-1">
            <h2 class="m-h3" id="s4" style="margin-bottom:14px">4. Done</h2>
            <div data-final></div>
          </section>
        </div>

        <aside class="p-aside">
          <div class="p-box p-box--paper"><h3>Why speaking?</h3><p style="margin:0">Many makers would rather talk than type, and few have time to keep a profile up to date. Speaking for a minute removes the biggest barrier.</p></div>
          <div class="p-box"><h3>What is always true</h3><ul>
            <li>Nothing goes live without your approval.</li>
            <li>You can always type instead.</li>
            <li>You can change or remove your page at any time.</li>
            <li>Photos of other people need their consent.</li>
          </ul></div>
        </aside>
      </div>
    </div></section>`;

  /** @type {MediaRecorder | null} */
  let rec = null;
  /** @type {MediaStream | null} */
  let stream = null;
  /** @type {string | null} */
  let audioUrl = null, photoUrl = null;
  let timer = 0, secs = 0;

  const show = (/** @type {number} */ n) => {
    main.querySelectorAll('[data-panel]').forEach((p) => { /** @type {HTMLElement} */ (p).hidden = /** @type {HTMLElement} */ (p).dataset.panel !== String(n); });
    main.querySelectorAll('[data-step]').forEach((s) => {
      const k = Number(/** @type {HTMLElement} */ (s).dataset.step);
      s.classList.toggle('is-on', k === n);
      s.classList.toggle('is-done', k < n);
      k === n ? s.setAttribute('aria-current', 'step') : s.removeAttribute('aria-current');
    });
    const panel = /** @type {HTMLElement} */ (main.querySelector(`[data-panel="${n}"] h2`));
    panel?.setAttribute('tabindex', '-1');
    panel?.focus();
  };

  const recBtn = /** @type {HTMLButtonElement} */ ($('[data-rec]', main));
  const recState = /** @type {HTMLElement} */ ($('[data-recstate]', main));
  const playback = /** @type {HTMLElement} */ ($('[data-playback]', main));

  const stopTracks = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  const discardAudio = () => { if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = null; playback.innerHTML = ''; };

  recBtn.addEventListener('click', async () => {
    if (rec && rec.state === 'recording') { rec.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      recState.textContent = 'This browser cannot record audio. Please type instead.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      recState.textContent = denied ? 'Microphone permission was declined. That is fine: type below instead.' : 'No microphone was found. Please type below instead.';
      /** @type {HTMLElement} */ ($('#j-text', main)).focus();
      return;
    }
    discardAudio();
    /** @type {Blob[]} */
    const chunks = [];
    rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      clearInterval(timer);
      stopTracks();
      const blob = new Blob(chunks, { type: rec?.mimeType || 'audio/webm' });
      audioUrl = URL.createObjectURL(blob);
      recBtn.innerHTML = `${icon.mic}<span>Record again</span>`;
      recState.textContent = `Recorded ${secs} seconds. It stays in this tab only.`;
      playback.innerHTML = `<audio controls src="${audioUrl}" style="width:100%"></audio><button class="m-btn m-btn--quiet m-btn--sm" type="button" data-discard style="margin-top:8px">${icon.trash}<span>Delete recording</span></button>`;
    };
    rec.start();
    secs = 0;
    recBtn.innerHTML = `${icon.stop}<span>Stop recording</span>`;
    recState.innerHTML = '<span class="p-rec-dot" aria-hidden="true" style="display:inline-block;vertical-align:middle;margin-right:8px"></span>Recording… 0 s';
    timer = window.setInterval(() => {
      secs++;
      recState.innerHTML = `<span class="p-rec-dot" aria-hidden="true" style="display:inline-block;vertical-align:middle;margin-right:8px"></span>Recording… ${secs} s`;
      if (secs >= 90 && rec?.state === 'recording') rec.stop();
    }, 1000);
  });

  const photoIn = /** @type {HTMLInputElement} */ ($('#j-photo', main));
  photoIn.addEventListener('change', () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    const f = photoIn.files?.[0];
    const box = /** @type {HTMLElement} */ ($('[data-photo]', main));
    if (!f) { box.innerHTML = ''; photoUrl = null; return; }
    if (!f.type.startsWith('image/')) { box.innerHTML = '<p class="m-error">That file is not an image. Choose a photo instead.</p>'; photoIn.value = ''; return; }
    photoUrl = URL.createObjectURL(f);
    box.innerHTML = `<figure class="m-polaroid m-tilt-r" style="max-width:260px;margin:0"><div class="m-frame-img" style="aspect-ratio:1"><img src="${photoUrl}" alt="Your chosen photo (shown only in this tab)"></div><figcaption>your work</figcaption></figure>`;
  });

  const draftForm = /** @type {HTMLFormElement} */ ($('[data-draft]', main));
  const makeDraft = () => {
    const key = /** @type {keyof typeof TEMPLATES} */ (/** @type {HTMLSelectElement} */ ($('#j-craft', main)).value);
    const t = TEMPLATES[key];
    const typed = /** @type {HTMLTextAreaElement} */ ($('#j-text', main)).value.trim();
    draftForm.innerHTML = `
      <div class="m-badges">${icon.pencil.replace('<svg', '<svg style="width:16px;height:16px;color:var(--terracotta)"')}<span class="m-body-sm">Sample draft from a fixed template${audioUrl ? '. Your recording was not analysed' : ''}${typed ? '. Your typed words are added below' : ''}.</span></div>
      <div class="m-form-row">
        <div class="m-field"><label for="d-title-hi">Title (Hindi)</label><input id="d-title-hi" class="p-draft-hi" lang="hi" value="${esc(t.titleHi)}" required></div>
        <div class="m-field"><label for="d-title">Title (English)</label><input id="d-title" value="${esc(t.title)}" required></div>
      </div>
      <div class="m-field"><label for="d-cat">Category</label><input id="d-cat" value="${esc(t.cat)} · ${esc(t.catHi)}"></div>
      <div class="m-field"><label for="d-hi">Description (Hindi)</label><textarea id="d-hi" class="p-draft-hi" lang="hi" required>${esc(t.hi)}${typed ? '\n' + esc(typed) : ''}</textarea></div>
      <div class="m-field"><label for="d-en">Description (English)</label><textarea id="d-en" required>${esc(t.en)}</textarea><p class="m-hint">Check the English carefully: translations can get details wrong.</p></div>
      ${photoUrl ? `<p class="m-body-sm">${icon.image.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} Your photo is attached to this draft (in this tab only).</p>` : '<p class="m-body-sm m-muted">No photo attached.</p>'}
      <fieldset class="m-field" style="gap:10px"><legend>Before approving</legend>
        <label class="m-check"><input type="checkbox" name="checked"> I have read the draft and the details are correct.</label>
        <label class="m-check"><input type="checkbox" name="consent"> I agree for this listing${photoUrl ? ' and photo' : ''} to be shown on MIRAS.</label>
      </fieldset>
      <div data-err aria-live="assertive"></div>
      <div class="m-actions">
        <button class="m-btn" type="submit">${icon.tick}<span>Approve listing</span></button>
        <button class="m-btn m-btn--danger" type="button" data-reject>Reject draft</button>
        <button class="m-btn m-btn--quiet" type="button" data-next="1">Start again</button>
      </div>`;
    show(3);
  };
  $('[data-make]', main)?.addEventListener('click', makeDraft);

  draftForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const err = /** @type {HTMLElement} */ ($('[data-err]', draftForm));
    const checked = /** @type {HTMLInputElement} */ (draftForm.querySelector('[name=checked]')).checked;
    const consent = /** @type {HTMLInputElement} */ (draftForm.querySelector('[name=consent]')).checked;
    const empty = [...draftForm.querySelectorAll('[required]')].find((n) => !/** @type {HTMLInputElement} */ (n).value.trim());
    if (empty) { err.innerHTML = '<p class="m-error">A title or description is empty. Fill it in, or reject the draft.</p>'; /** @type {HTMLElement} */ (empty).focus(); return; }
    if (!checked || !consent) { err.innerHTML = '<p class="m-error">Please tick both boxes to approve. Nothing is shown without your agreement.</p>'; return; }
    const title = /** @type {HTMLInputElement} */ ($('#d-title', draftForm)).value;
    finish(`<div class="m-status m-status--ok">${icon.check}<div><h3>Approved: “${esc(title)}”</h3><p>In the real app this listing would now go live, and you could change it at any time.</p><p><strong>This is a demonstration: nothing was published, uploaded or stored.</strong></p></div></div>`);
    toast('Approved locally. Nothing was published.');
  });
  main.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const n = /** @type {HTMLElement | null} */ (t.closest('[data-next]'));
    if (n) show(Number(n.dataset.next));
    if (t.closest('[data-discard]')) { discardAudio(); recState.textContent = 'Recording deleted.'; recBtn.innerHTML = `${icon.mic}<span>Start recording</span>`; }
    if (t.closest('[data-reject]')) finish(`<div class="m-status">${icon.info}<div><h3>Draft rejected</h3><p>Nothing was published. You can start again, or ask someone you trust to help.</p></div></div>`);
  });

  /** @param {string} html */
  function finish(html) {
    /** @type {HTMLElement} */ ($('[data-final]', main)).innerHTML = `${html}<div class="m-actions" style="margin-top:20px"><button class="m-btn m-btn--ghost" type="button" data-restart>Try again</button><a class="m-link" href="/artisans/">See the maker directory <span class="m-arrow" aria-hidden="true">→</span></a></div>`;
    discardAudio();
    show(4);
  }
  main.addEventListener('click', (e) => {
    if (!/** @type {HTMLElement} */ (e.target).closest('[data-restart]')) return;
    /** @type {HTMLTextAreaElement} */ ($('#j-text', main)).value = '';
    photoIn.value = '';
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = null;
    /** @type {HTMLElement} */ ($('[data-photo]', main)).innerHTML = '';
    recState.textContent = 'Your browser will ask for the microphone only when you press this.';
    show(1);
  });
  window.addEventListener('pagehide', () => { stopTracks(); discardAudio(); if (photoUrl) URL.revokeObjectURL(photoUrl); });
}
