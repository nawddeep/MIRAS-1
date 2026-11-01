// Central data module. Components read data only through this file.

import { places, collections } from './places.js';
import { stories } from './stories.js';
import { artisans, products, services, workshops } from './makers.js';
import { events, reviews, markets, hiddenPlaces, phrases } from './community.js';
import { trails, itineraries, audioWalks, memories, badges } from './journeys.js';
import { media, scenes } from './media.js';

export { places, collections, stories, artisans, products, services, workshops, events, reviews, markets, hiddenPlaces, phrases, trails, itineraries, audioWalks, memories, badges, media, scenes };

/** Local tips are a filtered view of reviews, so they stay labelled apart. */
export const localTips = reviews.filter((r) => r.kind === 'Local tip');

/**
 * @template {{id: string}} T
 * @param {T[]} list
 * @returns {Map<string, T>}
 */
const index = (list) => new Map(list.map((x) => [x.id, x]));

const byId = {
  place: index(places), story: index(stories), artisan: index(artisans), workshop: index(workshops),
  event: index(events), product: index(products), trail: index(trails), walk: index(audioWalks),
  scene: index(scenes), memory: index(memories), badge: index(badges),
};

/** @param {string | null | undefined} id */
export const getPlace = (id) => (id ? byId.place.get(id) : undefined);
/** @param {string | null | undefined} id */
export const getStory = (id) => (id ? byId.story.get(id) : undefined);
/** @param {string | null | undefined} id */
export const getArtisan = (id) => (id ? byId.artisan.get(id) : undefined);
/** @param {string | null | undefined} id */
export const getWorkshop = (id) => (id ? byId.workshop.get(id) : undefined);
/** @param {string | null | undefined} id */
export const getEvent = (id) => (id ? byId.event.get(id) : undefined);
/** @param {string | null | undefined} id */
export const getProduct = (id) => (id ? byId.product.get(id) : undefined);
/** @param {string | null | undefined} id */
export const getTrail = (id) => (id ? byId.trail.get(id) : undefined);
/** @param {string | null | undefined} id */
export const getWalk = (id) => (id ? byId.walk.get(id) : undefined);
/** @param {string | null | undefined} id */
export const getScene = (id) => (id ? byId.scene.get(id) : undefined);
/** @param {string | null | undefined} id */
export const getMedia = (id) => (id ? media[id] : undefined);

/** @param {string} placeId */
export const storiesFor = (placeId) => stories.filter((s) => s.placeId === placeId);
/** @param {string} artisanId */
export const productsFor = (artisanId) => products.filter((p) => p.artisanId === artisanId);
/** @param {string} artisanId */
export const servicesFor = (artisanId) => services.filter((s) => s.artisanId === artisanId);
/** @param {string} artisanId */
export const workshopsFor = (artisanId) => workshops.filter((w) => w.artisanId === artisanId);
/** @param {string} placeId */
export const reviewsFor = (placeId) => reviews.filter((r) => r.placeId === placeId);
/** @param {string} placeId */
export const eventsAt = (placeId) => events.filter((e) => e.placeId === placeId);

/** Distance in km between two coordinates. @param {{lat:number,lng:number}} a @param {{lat:number,lng:number}} b */
export function distanceKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Places nearest to a point. @param {{lat:number,lng:number}} coords @param {number} [n] @param {string} [excludeId] */
export const placesNear = (coords, n = 3, excludeId = '') =>
  places.filter((p) => p.id !== excludeId)
    .map((p) => ({ place: p, km: distanceKm(coords, p.coords) }))
    .sort((a, b) => a.km - b.km).slice(0, n);

/** @param {import('./types.js').Place} place @param {number} [n] */
export const nearbyPlaces = (place, n = 3) => placesNear(place.coords, n, place.id);

/** @param {{lat:number,lng:number}} coords @param {number} [n] */
export const nearbyArtisans = (coords, n = 3) =>
  artisans.map((a) => ({ artisan: a, km: distanceKm(coords, a.coords) }))
    .sort((a, b) => a.km - b.km).slice(0, n);

// Integrity check: every cross-reference must point at a real record.
// Runs in development only, and logs rather than throwing.
if (import.meta.env?.DEV) {
  /** @type {string[]} */
  const problems = [];
  /** @param {boolean} ok @param {string} msg */
  const need = (ok, msg) => { if (!ok) problems.push(msg); };
  for (const p of places) {
    p.storyIds.forEach((s) => need(byId.story.has(s), `place ${p.id} → story ${s}`));
    if (p.quieter?.placeId) need(byId.place.has(p.quieter.placeId), `place ${p.id} → quieter ${p.quieter.placeId}`);
    if (p.imageId) need(!!media[p.imageId], `place ${p.id} → media ${p.imageId}`);
    if (p.sceneId) need(byId.scene.has(p.sceneId), `place ${p.id} → scene ${p.sceneId}`);
  }
  stories.forEach((s) => need(byId.place.has(s.placeId), `story ${s.id} → place ${s.placeId}`));
  artisans.forEach((a) => need(byId.place.has(a.nearPlaceId), `artisan ${a.id} → place ${a.nearPlaceId}`));
  [...products, ...services, ...workshops].forEach((x) => need(byId.artisan.has(x.artisanId), `${x.id} → artisan ${x.artisanId}`));
  workshops.forEach((w) => need(byId.place.has(w.placeId), `workshop ${w.id} → place ${w.placeId}`));
  events.forEach((e) => need(byId.place.has(e.placeId), `event ${e.id} → place ${e.placeId}`));
  reviews.forEach((r) => need(byId.place.has(r.placeId), `review ${r.id} → place ${r.placeId}`));
  markets.forEach((m) => need(byId.place.has(m.placeId), `market ${m.id} → place ${m.placeId}`));
  trails.forEach((t) => t.placeIds.forEach((id) => need(byId.place.has(id), `trail ${t.id} → place ${id}`)));
  itineraries.forEach((i) => i.plan.forEach((d) => d.placeIds.forEach((id) => need(byId.place.has(id), `itinerary ${i.id} → place ${id}`))));
  audioWalks.forEach((w) => w.chapters.forEach((c) => {
    need(byId.place.has(c.placeId), `walk ${w.id} → place ${c.placeId}`);
    if (c.storyId) need(byId.story.has(c.storyId), `walk ${w.id} → story ${c.storyId}`);
  }));
  memories.forEach((m) => {
    need(byId.place.has(m.placeId), `memory ${m.id} → place ${m.placeId}`);
    if (m.storyId) need(byId.story.get(m.storyId)?.placeId === m.placeId, `memory ${m.id} story must belong to its place`);
  });
  scenes.forEach((s) => { need(byId.place.has(s.placeId), `scene ${s.id} → place`); need(!!media[s.mediaId], `scene ${s.id} → media`); });
  if (problems.length) console.warn('[MIRAS data] Broken references:', problems);
}
