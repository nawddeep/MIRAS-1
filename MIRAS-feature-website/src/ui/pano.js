// 360 preview. No real 360 captures exist yet, so this pans across a wide
// image and says so. Drag, swipe, arrow keys or the buttons move the view.

import { esc } from '../lib/dom.js';
import { icon } from './icons.js';
import { statusBadge, tag } from './components.js';
import { getMedia, getScene } from '../data/index.js';

/** @param {HTMLElement} el @param {string | null | undefined} sceneId @param {string} [placeName] */
export function mountPano(el, sceneId, placeName = 'this place') {
  const scene = getScene(sceneId);
  const media = getMedia(scene?.mediaId);
  if (!scene || !media) {
    el.innerHTML = `<div class="m-empty"><h3>No 360 preview for ${esc(placeName)} yet</h3><p>We only show a preview once we have an image we are allowed to use. Read the story and visit tips instead.</p></div>`;
    return;
  }
  const kindBadge = scene.kind === 'Reconstructed' ? statusBadge('Reconstructed') : scene.kind === 'Illustrative' ? statusBadge('Illustrative') : tag('Existing capture', 'local');
  el.innerHTML = `
    <figure class="m-pano" style="margin:0">
      <div class="m-pano-view" tabindex="0" role="img" aria-roledescription="panorama"
        aria-label="${esc(scene.title)}. ${esc(media.alt)}. Use the left and right arrow keys to look around."
        style="background-image:url('${media.src}')"></div>
      <div class="m-pano-hud">${kindBadge}${tag('Not a real 360 capture', 'neutral')}</div>
      <p class="m-pano-help" aria-hidden="true">Drag or use ← → to look around</p>
      <div class="m-pano-ctrl">
        <button type="button" data-dir="-1" aria-label="Look left">${icon.left}</button>
        <button type="button" data-dir="1" aria-label="Look right">${icon.right}</button>
      </div>
    </figure>
    <p class="m-body-sm m-muted" style="margin-top:10px"><strong style="color:var(--charcoal)">${esc(scene.title)}.</strong> ${esc(scene.note)} Image: ${esc(media.label)}; ${esc(media.creator)}.</p>`;

  const view = /** @type {HTMLElement} */ (el.querySelector('.m-pano-view'));
  view.style.backgroundRepeat = 'no-repeat';
  // Scale the image so it is wider than the frame, then pan within its edges (no fake wrap-around).
  let x = 0, minX = 0, w = 0, h = 0;
  const layout = () => {
    if (!w) return;
    const vw = view.clientWidth, vh = view.clientHeight;
    const s = Math.max(vh / h, (1.8 * vw) / w);
    view.style.backgroundSize = `${Math.round(w * s)}px ${Math.round(h * s)}px`;
    minX = vw - w * s;
    view.style.backgroundPositionY = `${Math.round((vh - h * s) / 2)}px`;
    x = x === 0 ? minX / 2 : Math.min(0, Math.max(minX, x));
    set();
  };
  const set = () => { x = Math.min(0, Math.max(minX, x)); view.style.backgroundPositionX = `${Math.round(x)}px`; };
  const probe = new Image();
  probe.onload = () => { w = probe.naturalWidth; h = probe.naturalHeight; layout(); };
  probe.onerror = () => {
    view.style.backgroundImage = 'none';
    view.innerHTML = '<p style="padding:24px">The preview image could not load. The rest of this page still works.</p>';
  };
  probe.src = media.src;
  new ResizeObserver(layout).observe(view);

  let dragging = false, lastX = 0;
  view.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; view.setPointerCapture(e.pointerId); });
  view.addEventListener('pointermove', (e) => { if (!dragging) return; x += e.clientX - lastX; lastX = e.clientX; set(); });
  const end = () => { dragging = false; };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  view.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { x += 60; set(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { x -= 60; set(); e.preventDefault(); }
  });
  el.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => {
    x -= Number(/** @type {HTMLElement} */ (b).dataset.dir) * 120; set();
  }));
}
