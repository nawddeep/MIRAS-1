// Memories: a fully simulated, in-page demonstration. Moments are sample
// drawings, not photos. Nothing is uploaded, and nothing persists: reloading
// the page clears every choice.

import { esc, fmtDate, toast, reducedMotion } from '../lib/dom.js';
import { memories, getPlace, getStory } from '../data/index.js';
import { drawingFor, sourceBadge, statusBadge, note } from '../ui/components.js';
import { pageHead, reveal } from '../ui/shell.js';
import { icon, doodle } from '../ui/icons.js';

const MAX = 5;

/** @param {HTMLElement} main */
export function render(main) {
  /** @type {string[]} */
  let picked = [];
  /** @type {Record<string, 'blur' | 'remove' | 'confirm' | undefined>} */
  let faces = {};
  let removed = new Set();
  let frame = 0;
  let timer = 0;

  main.innerHTML = `
    ${pageHead({ label: 'Memories · demonstration', title: 'Keep the trip, not just the photos', titleHi: 'यादें', lead: 'Choose up to five moments. MIRAS pairs each with its story, only when a checked story really matches, and asks about faces before anything is shared.', art: doodle.postcard })}
    <section class="m-section" style="padding-top:40px"><div class="m-wrap">
      ${note('<p><strong>Everything here is simulated and stays on this page.</strong> The moments are sample drawings standing in for your clips. Nothing is uploaded or saved, and reloading clears it all. In the real app, moments and captions would be picked by AI and checked by you.</p>', 'demo')}
      <ol class="p-flow" style="margin-top:32px" aria-label="Steps"><li class="is-on" data-flow="1">Choose moments</li><li data-flow="2">Review the reel</li><li data-flow="3">Check faces</li><li data-flow="4">Consent and share</li></ol>

      <section aria-labelledby="m1" class="p-block" style="border-top:0;padding-top:8px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline"><h2 id="m1">1. Your saved moments</h2><p class="m-count" style="margin:0" data-picked aria-live="polite"></p></div>
        <div class="p-moments" data-moments></div>
        <div class="m-actions" style="margin-top:28px"><button class="m-btn" type="button" data-build>${icon.sparkle}<span>Make my reel</span></button></div>
      </section>

      <section aria-labelledby="m2" class="p-block" data-step="2" hidden>
        <h2 id="m2" tabindex="-1">2. Your highlight reel</h2>
        <div class="p-reel-player">
          <div class="p-reel-stage" data-stage aria-live="polite"></div>
          <div class="m-actions">
            <button class="m-btn m-btn--quiet m-btn--sm" type="button" data-prev>${icon.left}<span>Previous</span></button>
            <button class="m-btn m-btn--sm" type="button" data-playreel>${icon.play}<span>Play reel</span></button>
            <button class="m-btn m-btn--quiet m-btn--sm" type="button" data-next>${icon.right}<span>Next</span></button>
            <span class="m-body-sm m-muted">No music or narration: we have no licensed tracks yet.</span>
          </div>
          <div class="m-filmstrip" data-strip aria-label="Reel frames"></div>
        </div>
        <div class="m-actions" style="margin-top:24px"><button class="m-btn" type="button" data-tofaces>Next: check faces</button></div>
      </section>

      <section aria-labelledby="m3" class="p-block" data-step="3" hidden>
        <h2 id="m3" tabindex="-1">3. Faces of other people</h2>
        <p style="max-width:62ch">These moments are flagged as showing someone's face clearly. They did not agree to be in your reel, so choose what to do with each. <span class="m-muted">(Flags here are sample flags; no face detection runs.)</span></p>
        <div class="p-faces" data-faces></div>
        <div data-faceerr aria-live="assertive"></div>
        <div class="m-actions" style="margin-top:24px"><button class="m-btn" type="button" data-toconsent>Next: consent</button></div>
      </section>

      <section aria-labelledby="m4" class="p-block" data-step="4" hidden>
        <h2 id="m4" tabindex="-1">4. Before you share</h2>
        <form class="m-form" data-consent novalidate style="max-width:680px">
          <label class="m-check"><input type="checkbox" name="c1"> I have checked every face in this reel.</label>
          <label class="m-check"><input type="checkbox" name="c2"> I have permission from anyone clearly visible whose face I kept.</label>
          <label class="m-check"><input type="checkbox" name="c3"> I followed photography rules at the places shown.</label>
          <div data-consenterr aria-live="assertive"></div>
          <div class="m-actions"><button class="m-btn" type="submit">${icon.share}<span>Share reel (simulated)</span></button><button class="m-btn m-btn--quiet" type="button" data-savetrip>Keep it in my trip (simulated)</button></div>
          <div data-shared aria-live="polite"></div>
        </form>
      </section>

      <aside class="p-box p-box--paper" style="margin-top:48px" aria-labelledby="priv">
        <h3 id="priv">${icon.lock.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px"')} Privacy</h3>
        <div class="p-split">
          <ul style="margin:0">
            <li><strong>Stored:</strong> nothing. Your choices live only in this open page.</li>
            <li><strong>Uploaded:</strong> nothing. There is no server.</li>
            <li><strong>In the real app:</strong> clips would be stored only with your permission and deleted when you ask.</li>
          </ul>
          <div><p>Clear every choice on this page now:</p><button class="m-btn m-btn--danger" type="button" data-wipe>${icon.trash}<span>Delete all my choices</span></button></div>
        </div>
      </aside>
    </div></section>`;

  const $q = (/** @type {string} */ s) => /** @type {HTMLElement} */ (main.querySelector(s));
  const flow = (/** @type {number} */ n) => main.querySelectorAll('[data-flow]').forEach((li) => {
    const k = Number(/** @type {HTMLElement} */ (li).dataset.flow);
    li.classList.toggle('is-on', k === n); li.classList.toggle('is-done', k < n);
  });
  const showStep = (/** @type {number} */ n) => {
    main.querySelectorAll('[data-step]').forEach((s) => { /** @type {HTMLElement} */ (s).hidden = Number(/** @type {HTMLElement} */ (s).dataset.step) > n; });
    flow(n);
    /** @type {HTMLElement | null} */ (main.querySelector(`#m${n}`))?.focus();
  };
  const active = () => picked.filter((id) => !removed.has(id));

  const drawMoments = () => {
    $q('[data-moments]').innerHTML = memories.map((m, i) => {
      const p = getPlace(m.placeId);
      const on = picked.includes(m.id);
      const full = picked.length >= MAX && !on;
      return `<div class="p-moment" data-reveal>
        <input type="checkbox" id="mo-${m.id}" data-pick="${m.id}" ${on ? 'checked' : ''} ${full ? 'disabled' : ''} aria-describedby="mo-${m.id}-d">
        <label for="mo-${m.id}">
          <span class="p-moment-check" aria-hidden="true">${icon.tick}</span>
          <figure class="m-polaroid ${i % 2 ? 'm-tilt-r' : 'm-tilt-l'}" style="margin:0">
            <div class="m-frame-img" style="aspect-ratio:1"><div class="m-art">${drawingFor(m.artKey)}</div><span class="m-img-label">Sample ${m.kind} · drawing</span></div>
            <figcaption>${esc(m.caption)}</figcaption>
          </figure>
        </label>
        <p class="m-body-sm m-muted" id="mo-${m.id}-d" style="margin:10px 0 0">${esc(p?.name ?? '')} · ${fmtDate(m.date)}${m.faceFlag ? ' · face flagged' : ''}</p>
      </div>`;
    }).join('');
    $q('[data-picked]').textContent = `${picked.length} of ${MAX} chosen${picked.length >= MAX ? ' (that is the most)' : ''}`;
  };

  const frameHTML = (/** @type {string} */ id) => {
    const m = memories.find((x) => x.id === id);
    if (!m) return '';
    const p = getPlace(m.placeId);
    const s = getStory(m.storyId);
    const blurred = faces[id] === 'blur';
    return `<div class="m-frame-img"><div class="m-art" style="${blurred ? 'filter:blur(6px)' : ''}">${drawingFor(m.artKey)}</div>${blurred ? '<span class="m-img-label">Faces blurred</span>' : ''}</div>
      <div class="p-reel-caption">
        <p class="p-reel-stampline">${esc(p?.name ?? '')} · ${fmtDate(m.date)}</p>
        <p class="m-hand">${esc(m.caption)}</p>
        ${s ? `<div class="m-badges">${sourceBadge(s.sourceType)}${statusBadge(s.verification)}</div><p><strong>${esc(s.title)}.</strong> ${esc(s.dek)}</p>` : '<p>No checked story matches this moment, so none is added.</p>'}
        <p style="opacity:.7">Caption: sample text</p>
      </div>`;
  };
  const drawReel = () => {
    const list = active();
    if (!list.length) { $q('[data-stage]').innerHTML = '<p style="padding:24px">No moments left in the reel.</p>'; $q('[data-strip]').innerHTML = ''; return; }
    frame = Math.min(frame, list.length - 1);
    $q('[data-stage]').innerHTML = frameHTML(list[frame]);
    $q('[data-stage]').setAttribute('aria-label', `Frame ${frame + 1} of ${list.length}`);
    $q('[data-strip]').innerHTML = list.map((id, i) => {
      const m = memories.find((x) => x.id === id);
      return `<button type="button" class="p-reel-frame" data-frame="${i}" aria-label="Frame ${i + 1}: ${esc(m?.caption ?? '')}" aria-pressed="${i === frame}" style="border:0;cursor:pointer;${i === frame ? 'outline:3px solid var(--mustard);outline-offset:2px' : ''}">
        <div class="m-frame-img"><div class="m-art" style="${faces[id] === 'blur' ? 'filter:blur(5px)' : ''}">${drawingFor(m?.artKey)}</div></div><p class="m-hand">${esc(m?.caption ?? '')}</p></button>`;
    }).join('');
  };
  const stopReel = () => { clearInterval(timer); timer = 0; const b = $q('[data-playreel]'); b.innerHTML = `${icon.play}<span>Play reel</span>`; };

  const drawFaces = () => {
    const flagged = active().concat([...removed]).filter((id, i, arr) => arr.indexOf(id) === i).map((id) => memories.find((m) => m.id === id)).filter((m) => m?.faceFlag);
    $q('[data-faces]').innerHTML = flagged.length ? flagged.map((m) => {
      const st = removed.has(m?.id ?? '') ? 'remove' : faces[m?.id ?? ''];
      return `<div class="p-face${st === 'blur' ? ' is-blur' : ''}">
        <div class="m-frame-img"><div class="m-art">${drawingFor(m?.artKey)}</div></div>
        <div><p style="margin:0"><strong>${esc(m?.caption)}</strong></p>
          <p class="m-body-sm m-muted" style="margin:2px 0 0">${st ? { blur: 'Faces will be blurred.', remove: 'Removed from the reel.', confirm: 'Kept as is: you have their permission.' }[st] : 'Needs a decision.'}</p>
          <div class="p-face-actions" role="group" aria-label="What to do with faces in ${esc(m?.caption)}">
            <button class="m-btn m-btn--quiet m-btn--sm" type="button" data-face="blur" data-id="${m?.id}" aria-pressed="${st === 'blur'}">${icon.blur}<span>Blur faces</span></button>
            <button class="m-btn m-btn--quiet m-btn--sm" type="button" data-face="remove" data-id="${m?.id}" aria-pressed="${st === 'remove'}">${icon.trash}<span>Remove moment</span></button>
            <button class="m-btn m-btn--quiet m-btn--sm" type="button" data-face="confirm" data-id="${m?.id}" aria-pressed="${st === 'confirm'}">${icon.tick}<span>They agreed</span></button>
          </div></div></div>`;
    }).join('') : `<div class="m-status m-status--ok">${icon.check}<div><p style="margin:0">No faces flagged in the moments you chose.</p></div></div>`;
  };

  main.addEventListener('change', (e) => {
    const t = /** @type {HTMLInputElement} */ (e.target);
    if (!t.dataset.pick) return;
    if (t.checked && picked.length < MAX) picked.push(t.dataset.pick);
    if (!t.checked) picked = picked.filter((x) => x !== t.dataset.pick);
    drawMoments();
    /** @type {HTMLElement | null} */ (main.querySelector(`#mo-${t.dataset.pick}`))?.focus();
  });

  main.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (t.closest('[data-build]')) {
      if (!picked.length) { toast('Choose at least one moment first.'); return; }
      removed = new Set(); faces = {}; frame = 0;
      drawReel(); showStep(2);
    }
    if (t.closest('[data-prev]')) { stopReel(); frame = Math.max(0, frame - 1); drawReel(); }
    if (t.closest('[data-next]')) { stopReel(); frame = Math.min(active().length - 1, frame + 1); drawReel(); }
    const f = /** @type {HTMLElement | null} */ (t.closest('[data-frame]'));
    if (f) { stopReel(); frame = Number(f.dataset.frame); drawReel(); }
    if (t.closest('[data-playreel]')) {
      if (timer) { stopReel(); return; }
      const b = $q('[data-playreel]');
      b.innerHTML = `${icon.pause}<span>Pause</span>`;
      if (reducedMotion()) toast('Reduced motion is on: frames change without animation.');
      timer = window.setInterval(() => {
        if (frame >= active().length - 1) { stopReel(); return; }
        frame++; drawReel();
      }, 2600);
    }
    if (t.closest('[data-tofaces]')) { stopReel(); drawFaces(); showStep(3); }
    const fb = /** @type {HTMLElement | null} */ (t.closest('[data-face]'));
    if (fb?.dataset.id) {
      const id = fb.dataset.id, act = /** @type {'blur'|'remove'|'confirm'} */ (fb.dataset.face);
      if (act === 'remove') { removed.add(id); delete faces[id]; } else { removed.delete(id); faces[id] = act; }
      drawFaces(); drawReel();
      /** @type {HTMLElement | null} */ (main.querySelector(`[data-face="${act}"][data-id="${id}"]`))?.focus();
    }
    if (t.closest('[data-toconsent]')) {
      const pending = active().filter((id) => memories.find((m) => m.id === id)?.faceFlag && !faces[id]);
      if (pending.length) { $q('[data-faceerr]').innerHTML = `<p class="m-error">${pending.length} flagged ${pending.length === 1 ? 'moment needs' : 'moments need'} a decision before you can share.</p>`; return; }
      $q('[data-faceerr]').innerHTML = '';
      showStep(4);
    }
    if (t.closest('[data-savetrip]')) {
      $q('[data-shared]').innerHTML = `<div class="m-status">${icon.info}<div><p style="margin:0">Kept on this page only (simulated). It will be gone if you reload.</p></div></div>`;
    }
    if (t.closest('[data-wipe]')) {
      stopReel(); picked = []; faces = {}; removed = new Set(); frame = 0;
      drawMoments();
      main.querySelectorAll('[data-step]').forEach((s) => { /** @type {HTMLElement} */ (s).hidden = true; });
      flow(1);
      /** @type {HTMLFormElement} */ (main.querySelector('[data-consent]')).reset();
      $q('[data-shared]').innerHTML = '';
      toast('All choices deleted from this page.');
    }
  });

  /** @type {HTMLFormElement} */ (main.querySelector('[data-consent]')).addEventListener('submit', (e) => {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const ok = ['c1', 'c2', 'c3'].every((n) => /** @type {HTMLInputElement} */ (form.elements.namedItem(n)).checked);
    const err = $q('[data-consenterr]');
    if (!ok) { err.innerHTML = '<p class="m-error">Please confirm all three before sharing.</p>'; return; }
    if (!active().length) { err.innerHTML = '<p class="m-error">Your reel is empty. Go back and keep at least one moment.</p>'; return; }
    err.innerHTML = '';
    $q('[data-shared]').innerHTML = `<div class="m-status m-status--ok" tabindex="-1">${icon.check}<div><h3>Shared (simulated)</h3><p>${active().length} ${active().length === 1 ? 'moment' : 'moments'}${Object.values(faces).includes('blur') ? ', with faces blurred where you chose,' : ''} would now be shared.</p><p><strong>Nothing actually left this page.</strong></p></div></div>`;
    /** @type {HTMLElement} */ ($q('[data-shared]').firstElementChild).focus();
  });

  drawMoments();
  reveal(main);
}
