import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function Avatar({ user, size = 36 }) {
  const name = user?.name || '?';
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: user?.color || '#78716c' }} aria-hidden="true">
      {initials}
    </span>
  );
}

export function UserLine({ user, sub, right }) {
  return (
    <div className="userline">
      <Avatar user={user} />
      <div className="userline-text">
        <strong>{user?.name || 'Unknown traveller'}</strong>
        <span className="muted">@{user?.username}{sub ? <> · {sub}</> : null}</span>
      </div>
      {right && <div className="userline-right">{right}</div>}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // rendered in a portal so modals opened from inside a form (e.g. DigiLocker during sign-up)
  // don't nest forms; submit events are stopped so they never reach the outer form
  return createPortal(
    <div className="modal-backdrop" onSubmit={(e) => e.stopPropagation()} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h4>{title}</h4>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((text, tone = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.tone}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/** "Free" or "₹1,200 / day" */
export function priceLabel(p) {
  if (!p || p.mode === 'free') return 'Free';
  return `₹${Number(p.amount || 0).toLocaleString('en-IN')} / ${p.unit || 'day'}`;
}

export const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
export const fmtRange = (a, b) => `${fmtDate(a)} – ${fmtDate(b)}`;
export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
export function tripDays(g) {
  const n = Math.round((new Date(g.endDate) - new Date(g.startDate)) / 86400000) + 1;
  return Math.max(1, n || 1);
}
