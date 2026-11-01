// Story audio player. There are no recorded narrations, so it offers the
// browser's own text-to-speech, clearly labelled as a synthetic voice.
// It never autoplays, and the text is always on the page as the alternative.

import { esc } from '../lib/dom.js';
import { icon } from './icons.js';
import { tag } from './components.js';

const supported = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

/**
 * @param {HTMLElement} el
 * @param {{title: string, full: string, simple?: string, recorded?: boolean, onListened?: () => void}} o
 */
export function mountAudio(el, { title, full, simple, recorded = false, onListened }) {
  const id = 'au-' + Math.random().toString(36).slice(2, 7);
  const can = supported();
  el.innerHTML = `
    <div class="m-audio" role="group" aria-labelledby="${id}-t">
      <div class="m-audio-top">
        <button class="m-audio-play" type="button" data-play aria-describedby="${id}-s" ${can ? '' : 'disabled'} aria-label="Play ${esc(title)}">${icon.play}</button>
        <div style="flex:1;min-width:180px">
          <p class="m-audio-title" id="${id}-t">Listen: ${esc(title)}</p>
          <p class="m-audio-state" id="${id}-s" aria-live="polite">${can ? 'Ready. Press play when you want to listen.' : 'No audio available in this browser. The full text is on this page.'}</p>
        </div>
        <button class="m-btn m-btn--quiet m-btn--sm" type="button" data-stop ${can ? '' : 'disabled'}>${icon.stop}<span>Stop</span></button>
      </div>
      <div class="m-badges">${recorded ? '' : tag('No recorded narration', 'neutral')}${can ? tag('Synthetic voice', 'demo') : ''}</div>
      ${can ? `<div class="m-audio-opts">
        ${simple ? `<label class="m-check" style="font-size:14px"><input type="checkbox" data-simple> Listen to the simple version</label>` : ''}
        <label style="display:inline-flex;gap:8px;align-items:center">Speed
          <select data-rate class="m-input" style="min-height:36px;width:auto;padding:4px 30px 4px 10px">
            <option value="0.8">Slower</option><option value="1" selected>Normal</option><option value="1.2">Faster</option>
          </select></label>
      </div>
      <p class="m-body-sm m-muted" style="margin:0">Read aloud by your device's built-in text-to-speech, not a recorded narrator. Pronunciation of Hindi names may be wrong.</p>` : ''}
    </div>`;
  if (!can) return () => {};

  const synth = window.speechSynthesis;
  const play = /** @type {HTMLButtonElement} */ (el.querySelector('[data-play]'));
  const stopBtn = /** @type {HTMLButtonElement} */ (el.querySelector('[data-stop]'));
  const state = /** @type {HTMLElement} */ (el.querySelector(`#${id}-s`));
  const simpleBox = /** @type {HTMLInputElement | null} */ (el.querySelector('[data-simple]'));
  const rate = /** @type {HTMLSelectElement} */ (el.querySelector('[data-rate]'));
  /** @type {'idle' | 'playing' | 'paused'} */
  let mode = 'idle';
  let token = 0;

  const setMode = (/** @type {typeof mode} */ m, msg = '') => {
    mode = m;
    play.innerHTML = m === 'playing' ? icon.pause : icon.play;
    play.setAttribute('aria-label', `${m === 'playing' ? 'Pause' : 'Play'} ${title}`);
    state.textContent = msg || (m === 'playing' ? 'Playing…' : m === 'paused' ? 'Paused.' : 'Ready. Press play when you want to listen.');
  };

  const start = () => {
    synth.cancel();
    const my = ++token;
    const text = simpleBox?.checked && simple ? simple : full;
    // Speak sentence by sentence: some browsers cut long utterances short.
    const parts = text.match(/[^.!?]+[.!?]*/g) ?? [text];
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part.trim());
      u.lang = 'en-IN';
      u.rate = Number(rate.value);
      if (i === parts.length - 1) u.onend = () => { if (my === token) { setMode('idle', 'Finished.'); onListened?.(); } };
      u.onerror = () => { if (my === token) setMode('idle', 'Audio stopped. The full text is on this page.'); };
      synth.speak(u);
    });
    setMode('playing');
  };
  const stop = () => { token++; synth.cancel(); setMode('idle', 'Stopped.'); };

  play.addEventListener('click', () => {
    if (mode === 'idle') start();
    else if (mode === 'playing') { synth.pause(); setMode('paused'); }
    else { synth.resume(); setMode('playing'); }
  });
  stopBtn.addEventListener('click', stop);
  simpleBox?.addEventListener('change', () => { if (mode !== 'idle') stop(); });
  rate.addEventListener('change', () => { if (mode !== 'idle') stop(); });
  window.addEventListener('pagehide', () => synth.cancel());
  return stop;
}
