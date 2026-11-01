import { esc, param } from '../lib/dom.js';
import { getStory, getPlace, storiesFor } from '../data/index.js';
import { markProgress } from '../lib/store.js';
import { sourceBadge, statusBadge, sourceBox, frameImage } from '../ui/components.js';
import { notFound } from '../ui/shell.js';
import { icon } from '../ui/icons.js';
import { mountAudio } from '../ui/audio.js';

/** @param {HTMLElement} main */
export function render(main) {
  const s = getStory(param('id'));
  if (!s) { main.innerHTML = notFound('story', '/stories/', 'All stories'); return; }
  const p = getPlace(s.placeId);
  document.title = `${s.title} · MIRAS Udaipur`;
  const others = storiesFor(s.placeId).filter((x) => x.id !== s.id);

  main.innerHTML = `
    <div class="m-wrap">
      <header class="p-story-head">
        <a class="p-back" href="/stories/">${icon.back} All stories</a>
        <div class="m-badges">${sourceBadge(s.sourceType)}${statusBadge(s.verification)}</div>
        <h1 class="m-h1" style="margin-bottom:16px">${esc(s.title)}</h1>
        <p class="m-lead" style="margin:0">${esc(s.dek)}</p>
        ${p ? `<p class="m-body-sm" style="margin-top:16px">${icon.pin.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} <a href="/place/?id=${p.id}">${esc(p.name)}</a> <span lang="hi" class="m-muted">${esc(p.nameHi)}</span></p>` : ''}
      </header>
      <div class="p-layout" style="padding-bottom:clamp(56px,7vw,112px)">
        <article>
          ${sourceBox(s)}
          <div class="m-seg p-version-toggle" role="group" aria-label="Story version" style="margin-top:28px">
            <button type="button" data-v="full" aria-pressed="true">Full story</button>
            <button type="button" data-v="simple" aria-pressed="false">Simple language</button>
          </div>
          <div class="p-prose p-story-body" data-full>${s.body.map((b) => `<p>${esc(b)}</p>`).join('')}</div>
          <div class="p-simple" data-simple hidden>
            <h2>In simple words</h2>
            <p>${esc(s.simple)}</p>
            <p class="m-body-sm m-muted" style="margin-top:10px">Written from the full entry above without adding facts. Not yet checked by a second person.</p>
          </div>
          <div data-end aria-hidden="true" style="height:1px"></div>
          <div style="margin-top:32px" data-audio></div>
          <div class="m-actions" style="margin-top:28px">
            <a class="m-btn m-btn--ghost" href="/stories/immersive/?story=${s.id}">${icon.phone}<span>See it in AR (concept)</span></a>
            ${p ? `<a class="m-link" href="/place/?id=${p.id}">Visit tips for ${esc(p.name)} <span class="m-arrow" aria-hidden="true">→</span></a>` : ''}
          </div>
        </article>
        <aside class="p-aside">
          ${p ? `<figure class="m-polaroid m-tilt-r" style="margin:0">${frameImage({ artKey: p.artKey, alt: `Line drawing of ${p.name}`, ratio: '1 / 1', showLabel: false })}<figcaption>${esc(p.name)}</figcaption></figure>` : ''}
          ${others.length ? `<div class="p-box"><h3>More from ${esc(p?.name ?? 'here')}</h3><ul class="p-near">${others.map((o) => `<li><a href="/story/?id=${o.id}"><span>${esc(o.title)}</span><span class="m-muted">${esc(o.sourceType)}</span></a></li>`).join('')}</ul></div>` : ''}
          <div class="p-box p-box--paper"><h3>Spotted a mistake?</h3><p style="margin:0" class="m-body-sm">Stories are corrected when someone with a better source tells us. In this demonstration there is no inbox yet, so please note it for the team.</p></div>
        </aside>
      </div>
    </div>`;

  const full = /** @type {HTMLElement} */ (main.querySelector('[data-full]'));
  const simple = /** @type {HTMLElement} */ (main.querySelector('[data-simple]'));
  main.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
    const v = /** @type {HTMLElement} */ (b).dataset.v;
    full.hidden = v !== 'full';
    simple.hidden = v !== 'simple';
    main.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));

  const done = () => { markProgress('storyRead'); markProgress('sourceTypes', s.sourceType); };
  mountAudio(/** @type {HTMLElement} */ (main.querySelector('[data-audio]')), {
    title: s.title, full: [s.title, ...s.body].join(' '), simple: s.simple, onListened: done,
  });
  // Count a story as read once its end has reached the screen (or been scrolled past).
  const end = /** @type {HTMLElement | null} */ (main.querySelector('[data-end]'));
  if (end) {
    const check = () => {
      if (end.getBoundingClientRect().top < innerHeight) { done(); removeEventListener('scroll', check); }
    };
    addEventListener('scroll', check, { passive: true });
    check();
  }
}
