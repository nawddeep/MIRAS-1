// Visitor state kept in this browser only (localStorage). Nothing is sent anywhere.
// Memories are deliberately NOT stored here: they live in page memory and vanish on reload.

const KEYS = { saved: 'miras.savedPlaces', progress: 'miras.progress', consent: 'miras.passportConsent' };

/** @param {string} key @param {any} fallback */
function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
/** @param {string} key @param {any} value */
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be blocked; the UI still works for this page */ }
  window.dispatchEvent(new CustomEvent('miras:store', { detail: { key } }));
}

/** @returns {string[]} */
export const getSaved = () => read(KEYS.saved, []);
/** @param {string} id */
export const isSaved = (id) => getSaved().includes(id);
/** @param {string} id @returns {boolean} new state */
export function toggleSaved(id) {
  const list = getSaved();
  const on = !list.includes(id);
  write(KEYS.saved, on ? [...list, id] : list.filter((x) => x !== id));
  if (on && getSaved().length >= 3) markProgress('saved3');
  return on;
}
export const clearSaved = () => write(KEYS.saved, []);

/** Passport tracking only happens after the visitor opts in. */
export const hasPassportConsent = () => read(KEYS.consent, false) === true;
/** @param {boolean} on */
export function setPassportConsent(on) {
  write(KEYS.consent, on);
  if (!on) write(KEYS.progress, {});
}

/** Learning progress used to award badges. @returns {Record<string, boolean | string[]>} */
export const getProgress = () => read(KEYS.progress, {});
/** @param {string} key @param {string} [value] */
export function markProgress(key, value) {
  if (!hasPassportConsent()) return;
  const p = getProgress();
  if (value) {
    const list = Array.isArray(p[key]) ? /** @type {string[]} */ (p[key]) : [];
    if (!list.includes(value)) p[key] = [...list, value];
  } else {
    p[key] = true;
  }
  write(KEYS.progress, p);
}
export const clearProgress = () => write(KEYS.progress, {});
