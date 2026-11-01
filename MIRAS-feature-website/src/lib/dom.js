// Small DOM helpers shared by every page.

/** @param {string} s @param {ParentNode} [el] @returns {HTMLElement | null} */
export const $ = (s, el = document) => el.querySelector(s);
/** @param {string} s @param {ParentNode} [el] @returns {HTMLElement[]} */
export const $$ = (s, el = document) => /** @type {HTMLElement[]} */ ([...el.querySelectorAll(s)]);

/** Escape text for safe use inside HTML templates. @param {unknown} v */
export const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Read a query-string parameter. @param {string} key */
export const param = (key) => new URLSearchParams(location.search).get(key);

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Format minutes as "1 h 30 min". @param {number} min */
export const fmtDuration = (min) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
};

/** @param {string} iso */
export const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** @param {number} amount */
export const fmtINR = (amount) => '₹' + amount.toLocaleString('en-IN');

/** @param {number} km */
export const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000 / 50) * 50} m` : `${km.toFixed(1)} km`);

let toastEl = /** @type {HTMLElement | null} */ (null);
let toastTimer = 0;
/** Show a short status message. Also announced to screen readers. @param {string} msg */
export function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'm-toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove('is-on'), 3600);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keep keyboard focus inside `el` until the returned function is called.
 * @param {HTMLElement} el
 * @param {() => void} onEscape
 */
export function trapFocus(el, onEscape) {
  const prev = /** @type {HTMLElement | null} */ (document.activeElement);
  /** @param {KeyboardEvent} e */
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onEscape(); return; }
    if (e.key !== 'Tab') return;
    const items = $$(FOCUSABLE, el).filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey);
  const first = $$(FOCUSABLE, el)[0];
  (first || el).focus();
  return () => {
    document.removeEventListener('keydown', onKey);
    prev?.focus?.();
  };
}

/**
 * Open a modal dialog. Returns a close function.
 * @param {{title: string, body: string, wide?: boolean, onOpen?: (root: HTMLElement, close: () => void) => void, onClose?: () => void}} opts
 */
export function openDialog({ title, body, wide = false, onOpen, onClose }) {
  const id = 'dlg-' + Math.random().toString(36).slice(2, 8);
  const back = document.createElement('div');
  back.className = 'm-dialog-backdrop m-scope';
  back.innerHTML = `
    <div class="m-dialog${wide ? ' m-dialog--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${id}" tabindex="-1">
      <button class="m-close" type="button" data-close aria-label="Close dialog">${CLOSE_ICON}</button>
      <h2 id="${id}">${esc(title)}</h2>
      <div class="m-dialog-body">${body}</div>
    </div>`;
  document.body.appendChild(back);
  document.documentElement.style.overflow = 'hidden';
  const dialog = /** @type {HTMLElement} */ (back.firstElementChild);
  let release = () => {};
  const close = () => {
    release();
    back.remove();
    document.documentElement.style.overflow = '';
    onClose?.();
  };
  back.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (t === back || t.closest('[data-close]')) close();
  });
  release = trapFocus(dialog, close);
  onOpen?.(dialog, close);
  return close;
}

const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
