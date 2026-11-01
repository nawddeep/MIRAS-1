import { esc, param, toast } from '../lib/dom.js';
import { getWalk, getPlace, getStory } from '../data/index.js';
import { markProgress } from '../lib/store.js';
import { statusBadge, tag, sourceBadge, note } from '../ui/components.js';
import { notFound } from '../ui/shell.js';
import { icon } from '../ui/icons.js';
import { mountAudio } from '../ui/audio.js';
import { sketchMap } from '../ui/map.js';

/** @param {HTMLElement} main */
export function render(main) {
  const w = getWalk(param('id'));
  if (!w) { main.innerHTML = notFound('walk', '/plan/walks/', 'All audio walks'); return; }
  document.title = `${w.title} · MIRAS Udaipur`;
  let current = 0, follow = false;
  main.innerHTML = `
    <div class="m-wrap">
      <header class="p-story-head">
        <a class="p-back" href="/plan/walks/">${icon.back} All audio walks</a>
        <div class="m-badges">${statusBadge(w.verification)}${tag('Synthetic voice', 'demo')}</div>
        <h1 class="m-h1" style="margin:14px 0">${esc(w.title)}</h1>
        <p class="m-lead">${esc(w.blurb)} About ${w.durationMin} minutes, in ${esc(w.language)}.</p>
      </header>
      <div class="p-layout" style="padding-bottom:clamp(56px,7vw,112px)">
        <div>
          <div data-player></div>
          <ol class="p-chapters" style="margin-top:28px" data-chapters></ol>
        </div>
        <aside class="p-aside">
          <div class="p-box">
            <h3>Play as I walk</h3>
            <label class="m-check"><input type="checkbox" data-follow> Play each chapter when I reach its stop</label>
            <p class="m-body-sm m-muted" style="margin:10px 0">Off unless you turn it on. In this demonstration your location is never read: use the button below to simulate arriving.</p>
            <button class="m-btn m-btn--ghost m-btn--sm" type="button" data-arrive disabled>${icon.pin}<span>Simulate arriving at the next stop</span></button>
          </div>
          ${sketchMap({ points: w.chapters.map((c, i) => { const p = getPlace(c.placeId); return { id: c.id, label: `${i + 1}. ${c.title}`, lat: p?.coords.lat ?? 0, lng: p?.coords.lng ?? 0 }; }), title: `Stops on ${w.title}` })}
          ${note('<p>Want it without signal? See the <a href="/plan/offline/">offline pack</a> (a simulation).</p>', 'paper')}
        </aside>
      </div>
    </div>`;

  const chapters = /** @type {HTMLElement} */ (main.querySelector('[data-chapters]'));
  const player = /** @type {HTMLElement} */ (main.querySelector('[data-player]'));
  const arrive = /** @type {HTMLButtonElement} */ (main.querySelector('[data-arrive]'));
  let stop = () => {};
  const drawPlayer = () => {
    stop();
    const c = w.chapters[current];
    stop = mountAudio(player, { title: `Chapter ${current + 1}: ${c.title}`, full: c.text + ' ' + (getStory(c.storyId)?.body[0] ?? ''), onListened: () => markProgress('listened') });
  };
  const draw = () => {
    chapters.innerHTML = w.chapters.map((c, i) => {
      const p = getPlace(c.placeId), s = getStory(c.storyId);
      return `<li class="p-chapter${i === current ? ' is-current' : ''}"${i === current ? ' aria-current="step"' : ''}>
        <span class="p-chapter-n">${i + 1}</span>
        <div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p>
          <p class="m-body-sm m-muted">Stop: <a href="/place/?id=${p?.id}">${esc(p?.name ?? '')}</a> · about ${Math.round(c.estSeconds / 60) || 1} min to listen</p>
          ${s ? `<p class="m-body-sm" style="margin:6px 0 0">${sourceBadge(s.sourceType)} <a href="/story/?id=${s.id}">${esc(s.title)}</a></p>` : '<p class="m-body-sm m-muted" style="margin:6px 0 0">No story attached to this stop.</p>'}
        </div>
        <button class="m-btn m-btn--quiet m-btn--sm" type="button" data-ch="${i}" aria-label="Choose chapter ${i + 1}: ${esc(c.title)}">${i === current ? 'Selected' : 'Choose'}</button>
      </li>`;
    }).join('');
  };
  main.addEventListener('click', (e) => {
    const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-ch]'));
    if (b) { current = Number(b.dataset.ch); draw(); drawPlayer(); }
  });
  /** @type {HTMLInputElement} */ (main.querySelector('[data-follow]')).addEventListener('change', (e) => {
    follow = /** @type {HTMLInputElement} */ (e.target).checked;
    arrive.disabled = !follow;
    toast(follow ? 'Chapters will play when you (simulate) arriving.' : 'Location playback turned off.');
  });
  arrive.addEventListener('click', () => {
    if (!follow) return;
    if (current >= w.chapters.length - 1) { toast('That was the last stop.'); return; }
    current++;
    draw(); drawPlayer();
    toast(`Arrived at stop ${current + 1} (simulated). Press play to listen.`);
    /** @type {HTMLElement | null} */ (player.querySelector('[data-play]'))?.focus();
  });
  draw(); drawPlayer();
}
