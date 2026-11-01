import { esc, param, openDialog } from '../lib/dom.js';
import { stories, scenes, getStory, getPlace, getMedia } from '../data/index.js';
import { frameImage, sourceBadge, statusBadge, tag, conceptBadge, note, drawingFor } from '../ui/components.js';
import { pageHead, subNav, reveal } from '../ui/shell.js';
import { icon } from '../ui/icons.js';
import { mountPano } from '../ui/pano.js';

/** @param {HTMLElement} main */
export function render(main) {
  let story = getStory(param('story')) ?? /** @type {import('../data/types.js').Story} */ (getStory('s-jagdish-steps'));
  let sceneId = scenes[0].id;
  main.innerHTML = `
    ${pageHead({ label: 'Stories · concepts', title: 'Stories where you stand', titleHi: 'जहाँ आप खड़े हैं, वहीं कहानी', lead: 'Two ideas for later: a story placed in your camera view on site, and scenes you can step back into at home. Both are concepts, and labelled that way.', art: icon.headset })}
    ${subNav('stories')}
    <section class="m-section" aria-labelledby="ar-h"><div class="m-wrap p-demo-grid">
      <div>
        <div class="m-badges" style="margin-bottom:12px">${conceptBadge()}</div>
        <h2 class="m-h2" id="ar-h" style="margin-bottom:14px">AR story view</h2>
        <p style="max-width:56ch">The idea: hold up your phone at a monument and its story appears in the camera view, anchored to the building. <strong>Nothing here uses your camera or location.</strong></p>
        ${note('<p>Whether AR location features work at Udaipur\'s sites has <strong>not been checked</strong>, so we do not promise it. Until it is, every story is available as normal text and audio.</p>', 'paper')}
        <div class="m-field" style="margin:24px 0 16px;max-width:420px"><label for="ar-story">Story to preview</label>
          <select id="ar-story">${stories.map((s) => `<option value="${s.id}"${s.id === story.id ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}</select></div>
        <a class="m-btn" data-fallback href="/story/?id=${story.id}">${icon.arrow}<span>Read the normal story instead</span></a>
      </div>
      <div data-ar style="justify-self:center"></div>
    </div></section>

    <section class="m-section m-section--paper" aria-labelledby="vr-h"><div class="m-wrap">
      <div class="m-sechead"><div>
        <div class="m-badges" style="margin-bottom:12px">${conceptBadge()}</div>
        <h2 class="m-h2" id="vr-h">VR replay and scenes</h2>
        <p>Relive a place at home in 360, on a phone or, later, in a headset. Each scene says whether it is an existing capture, a reconstruction or an illustration. Today there are no real captures.</p>
      </div><button class="m-btn m-btn--ghost" type="button" data-headset>${icon.headset}<span>Headset mode (concept)</span></button></div>
      <div class="p-scenes" data-scenes role="group" aria-label="Choose a scene"></div>
      <div style="margin-top:32px" data-viewer></div>
    </div></section>`;

  const drawAR = () => {
    const p = getPlace(story.placeId);
    /** @type {HTMLElement} */ (main.querySelector('[data-ar]')).innerHTML = `
      <figure style="margin:0">
        <div class="p-ar" role="img" aria-label="Mock-up of a phone showing ${esc(p?.name ?? '')} with the story card overlaid">
          <div class="m-frame-img"><div class="m-art" style="background:#fff">${drawingFor(p?.artKey)}</div></div>
          <span class="p-ar-pin" aria-hidden="true"></span>
          <div class="p-ar-card">
            <div class="m-badges">${sourceBadge(story.sourceType)}${statusBadge(story.verification)}</div>
            <h3>${esc(story.title)}</h3>
            <p>${esc(story.dek)}</p>
          </div>
        </div>
        <figcaption class="m-hand" style="text-align:center;margin-top:12px">mock-up · ${esc(p?.name ?? '')}</figcaption>
      </figure>`;
    /** @type {HTMLAnchorElement} */ (main.querySelector('[data-fallback]')).href = `/story/?id=${story.id}`;
  };
  const drawScenes = () => {
    /** @type {HTMLElement} */ (main.querySelector('[data-scenes]')).innerHTML = scenes.map((s) => {
      const m = getMedia(s.mediaId);
      const badge = s.kind === 'Existing capture' ? tag('Existing capture', 'local') : statusBadge(s.kind === 'Reconstructed' ? 'Reconstructed' : 'Illustrative');
      return `<button class="p-scene" type="button" data-scene="${s.id}" aria-pressed="${s.id === sceneId}">
        ${frameImage({ mediaId: s.mediaId, alt: m?.alt ?? s.title, ratio: '16 / 10' })}
        <div class="m-badges">${badge}</div>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.note)}</p>
      </button>`;
    }).join('');
    mountPano(/** @type {HTMLElement} */ (main.querySelector('[data-viewer]')), sceneId);
    reveal(main);
  };
  /** @type {HTMLSelectElement} */ (main.querySelector('#ar-story')).addEventListener('change', (e) => {
    story = getStory(/** @type {HTMLSelectElement} */ (e.target).value) ?? story; drawAR();
  });
  main.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const s = /** @type {HTMLElement | null} */ (t.closest('[data-scene]'));
    if (s) { sceneId = s.dataset.scene ?? sceneId; drawScenes(); /** @type {HTMLElement | null} */ (main.querySelector(`[data-scene="${sceneId}"]`))?.focus(); }
    if (t.closest('[data-headset]')) openDialog({
      title: 'Headset mode is a concept',
      body: `<div class="m-badges" style="margin-bottom:14px">${conceptBadge()}</div><p>Later, scenes could open in a VR headset for a fuller sense of a place. It is not built, and needs 360 captures we are allowed to use.</p><ul><li>Reconstructed scenes would always be labelled as interpretations.</li><li>Every scene would list who made it and what it may be used for.</li></ul><p class="m-muted">For now, use the drag-to-look preview on this page.</p><button class="m-btn" type="button" data-close>Close</button>`,
    });
  });
  drawAR(); drawScenes();
}
