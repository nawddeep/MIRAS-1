import { esc, param, fmtDate, fmtDuration, fmtKm, toast } from '../lib/dom.js';
import { getPlace, storiesFor, reviewsFor, nearbyPlaces, nearbyArtisans, eventsAt, workshops, distanceKm } from '../data/index.js';
import { isSaved } from '../lib/store.js';
import { frameImage, statusBadge, sourceBadge, saveButton, tag, note } from '../ui/components.js';
import { notFound, reveal } from '../ui/shell.js';
import { icon } from '../ui/icons.js';
import { mountPano } from '../ui/pano.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** @param {HTMLElement} main */
export function render(main) {
  const p = getPlace(param('id'));
  if (!p) { main.innerHTML = notFound('place', '/explore/', 'Browse all places'); return; }
  document.title = `${p.name} · MIRAS Udaipur`;
  const today = new Date().getDay();
  const tales = storiesFor(p.id);
  const revs = reviewsFor(p.id);
  const near = nearbyPlaces(p, 4);
  const makers = nearbyArtisans(p.coords, 3);
  const alt = p.quieter?.placeId ? getPlace(p.quieter.placeId) : null;
  const ws = workshops.filter((w) => w.placeId === p.id);
  const evs = eventsAt(p.id);
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${p.coords.lat},${p.coords.lng}`;

  const hoursHTML = p.hours
    ? `<table class="p-hours"><caption class="m-sr">Opening hours</caption><tbody>${DAYS.map((d, i) => {
      const slots = p.hours?.days[i] ?? [];
      return `<tr class="${i === today ? 'is-today' : ''}"><th scope="row">${d}${i === today ? ' (today)' : ''}</th><td>${slots.length ? slots.map(([a, b]) => `${a}–${b}`).join(', ') : 'Closed'}</td></tr>`;
    }).join('')}</tbody></table>
      <div style="margin-top:10px">${statusBadge(p.hours.status)}</div>
      <p class="m-body-sm m-muted" style="margin:8px 0 0">${esc(p.hours.note)}</p>`
    : `<p style="margin:0"><strong>No opening hours on file.</strong></p><p class="m-body-sm m-muted" style="margin:6px 0 0">We would rather show nothing than guess. Hours vary shop by shop here; ask locally. The trip planner will not schedule this place at a fixed time.</p>`;

  main.innerHTML = `
    <section class="p-hero"><div class="m-wrap">
      <a class="p-back" href="/explore/">${icon.back} All places</a>
      <div class="p-hero-grid">
        <div>
          <p class="m-label">${esc(p.category)} · ${esc(p.area)}</p>
          <h1 class="m-h1">${esc(p.name)}</h1>
          <p class="m-hi-title" lang="hi">${esc(p.nameHi)}</p>
          <p class="m-lead">${esc(p.summary)}</p>
          <div class="m-badges" style="margin-bottom:20px">${statusBadge(p.verification)}<span class="m-muted m-body-sm">Last updated ${fmtDate(p.lastUpdated)}</span></div>
          <div class="m-actions">
            ${saveButton(p.id, isSaved(p.id)).replace('m-btn--quiet m-btn--sm', '')}
            <a class="m-btn m-btn--ghost" href="${dir}" target="_blank" rel="noopener">${icon.route}<span>Directions</span><span class="m-sr">(opens Google Maps in a new tab)</span></a>
            <a class="m-link" href="#preview">360 preview <span class="m-arrow" aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div class="p-hero-media">
          ${frameImage({ mediaId: p.imageId, artKey: p.artKey, alt: p.name, ratio: '8 / 5', eager: true })}
          ${p.imageId ? '<p class="m-body-sm m-muted" style="margin:0">Illustrative image with unknown rights; not a photograph of the place. <a href="/labels/#rights">Image rights</a></p>' : '<p class="m-body-sm m-muted" style="margin:0">Line drawing. No photograph with cleared rights yet.</p>'}
        </div>
      </div>
    </div></section>

    <div class="m-wrap" style="padding-top:clamp(36px,5vw,64px);padding-bottom:clamp(48px,6vw,96px)">
      <div class="p-layout">
        <div>
          <section class="p-block" aria-labelledby="facts-h">
            <h2 id="facts-h">Facts and visit tips</h2>
            <dl class="m-kv">${p.facts.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd>`).join('')}<dt>Typical visit</dt><dd>${fmtDuration(p.visitMinutes)}</dd><dt>Location</dt><dd>${esc(p.area)} <span class="m-muted m-body-sm">(coordinates approximate)</span></dd></dl>
            <p class="m-body-sm m-muted" style="margin-top:14px">${icon.info.replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-2px"')} ${esc(p.factsSource)}</p>
            <h3 class="m-h4" style="margin:26px 0 10px">Visit tips</h3>
            <ul>${p.visitTips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
          </section>

          <section class="p-block" id="preview" aria-labelledby="pano-h" style="scroll-margin-top:90px">
            <p class="m-label m-label--blue">Look around</p>
            <h2 id="pano-h">360 preview</h2>
            <div data-pano></div>
          </section>

          <section class="p-block" aria-labelledby="stories-h">
            <h2 id="stories-h">Stories from here</h2>
            ${tales.length ? `<div style="display:grid;gap:22px">${tales.map((s) => `
              <article class="p-box">
                <div class="m-badges" style="margin-bottom:10px">${sourceBadge(s.sourceType)}${statusBadge(s.verification)}</div>
                <h3 class="m-h3" style="margin-bottom:8px"><a href="/story/?id=${s.id}">${esc(s.title)}</a></h3>
                <p>${esc(s.dek)}</p>
                <p class="m-body-sm"><strong>Source:</strong> <span class="m-muted">${esc(s.sourceReference)}</span></p>
                <div class="m-actions"><a class="m-link" href="/story/?id=${s.id}">Read or listen <span class="m-arrow" aria-hidden="true">→</span></a><a class="m-link" href="/stories/immersive/?story=${s.id}">AR story view (concept) <span class="m-arrow" aria-hidden="true">→</span></a></div>
              </article>`).join('')}</div>` : note('<p>No story has been written for this place yet. We add stories only once they have a source type and a reference.</p>', 'paper')}
          </section>

          <section class="p-block" aria-labelledby="respect-h">
            <h2 id="respect-h">Etiquette and access</h2>
            <div class="p-split">
              <div class="p-box"><h3>Etiquette</h3>${p.etiquette ? `<ul>${p.etiquette.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><div style="margin-top:10px">${statusBadge(p.etiquette.status)}</div>` : '<p class="m-muted" style="margin:0">No site-specific etiquette notes yet. General guidance is in <a href="/plan/responsible/">Travel responsibly</a>.</p>'}</div>
              <div class="p-box"><h3>Accessibility</h3>${p.accessibility ? `<ul>${p.accessibility.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><div style="margin-top:10px">${statusBadge(p.accessibility.status)}</div>` : '<p class="m-muted" style="margin:0">No checked accessibility information yet. We don\'t guess: please ask the site directly.</p>'}</div>
            </div>
          </section>

          <section class="p-block" aria-labelledby="reviews-h">
            <h2 id="reviews-h">Local tips and visitor reviews</h2>
            ${revs.length ? `<div class="p-reviews">${revs.map((r) => `
              <article class="p-review${r.kind === 'Local tip' ? ' p-review--tip' : ''}">
                <div class="m-badges">${r.kind === 'Local tip' ? tag('Local tip', 'local') : tag('Visitor review', 'neutral')}${statusBadge(r.verification)}</div>
                <blockquote>${esc(r.text)}</blockquote>
                <footer><span>${esc(r.author)} · ${fmtDate(r.date)}</span><button class="m-link" type="button" data-report="${r.id}" style="font-size:14px">${icon.flag.replace('<svg', '<svg style="width:14px;height:14px"')} Report a problem</button></footer>
              </article>`).join('')}</div>
              <p class="m-body-sm m-muted" style="margin-top:16px">All reviews here are sample text. MIRAS shows no star ratings or popularity counts, and sponsored content would always be labelled.</p>`
              : note('<p>No reviews or local tips for this place yet.</p>', 'paper')}
          </section>
        </div>

        <aside class="p-aside" aria-label="Plan your visit">
          <div class="p-box"><h3>${icon.clock.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px"')} Opening hours</h3>${hoursHTML}</div>
          ${p.quieter ? `<div class="p-quieter">
            <div class="m-badges">${tag('Estimate', 'estimate')}</div>
            <h3>Prefer it quieter?</h3>
            ${p.quieter.time ? `<p><strong>Try:</strong> ${esc(p.quieter.time)}.</p>` : ''}
            ${alt ? `<p><strong>Or nearby:</strong> <a href="/place/?id=${alt.id}">${esc(alt.name)}</a>, ${fmtKm(distanceKm(p.coords, alt.coords))} away.</p>` : ''}
            <p class="m-body-sm m-muted">${esc(p.quieter.basis)}</p>
          </div>` : ''}
          <div class="p-box"><h3>Nearby places</h3><ul class="p-near">${near.map(({ place, km }) => `<li><a href="/place/?id=${place.id}"><span>${esc(place.name)}</span><span class="m-muted">${fmtKm(km)}</span></a></li>`).join('')}</ul><a class="m-link" style="margin-top:10px" href="/explore/nearby/?from=${p.id}">Map and list <span class="m-arrow" aria-hidden="true">→</span></a></div>
          <div class="p-box"><h3>Makers nearby</h3><ul class="p-near">${makers.map(({ artisan, km }) => `<li><a href="/artisan/?id=${artisan.id}"><span>${esc(artisan.studio)}<br><span class="m-muted">${esc(artisan.craft)}</span></span><span class="m-muted">${fmtKm(km)}</span></a></li>`).join('')}</ul><p class="m-body-sm m-muted" style="margin:10px 0 0">Demonstration profiles.</p></div>
          ${ws.length || evs.length ? `<div class="p-box"><h3>Happening here</h3><ul class="p-near">${ws.map((w) => `<li><a href="/workshop/?id=${w.id}"><span>${esc(w.title)}</span><span class="m-muted">Workshop</span></a></li>`).join('')}${evs.map((e) => `<li><a href="/event/?id=${e.id}"><span>${esc(e.title)}</span><span class="m-muted">Event</span></a></li>`).join('')}</ul></div>` : ''}
        </aside>
      </div>
    </div>`;

  mountPano(/** @type {HTMLElement} */ (main.querySelector('[data-pano]')), p.sceneId, p.name);
  main.addEventListener('click', (e) => {
    const b = /** @type {HTMLButtonElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-report]'));
    if (!b) return;
    b.disabled = true;
    b.textContent = 'Reported (demo: nobody was notified)';
    toast('Thanks. In the real app a moderator would review this.');
  });
  reveal(main);
}
