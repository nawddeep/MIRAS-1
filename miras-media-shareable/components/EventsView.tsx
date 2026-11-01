'use client';

import { useMemo, useState } from 'react';
import { formatDateIST, formatDateTimeIST } from '@/lib/city-format';
import type { AppEvent } from '@/lib/services/abc-services';

const STATUS: Record<string, string> = { 'on-sale': 'Tickets on sale', 'few-left': 'Few left', 'sold-out': 'Sold out', free: 'Free', 'at-venue': 'Pay at the venue', tba: 'Dates to be announced', past: 'Past' };
type When = 'upcoming' | 'tba' | 'past';

function when(e: AppEvent, now: number): When {
  if (e.ticketStatus === 'past') return 'past';
  if (!e.startsAt) return 'tba';
  return Date.parse(e.endsAt ?? e.startsAt) < now ? 'past' : 'upcoming';
}

export function EventsView({ events }: { events: AppEvent[] }) {
  const [now] = useState(() => Date.now());
  const [view, setView] = useState<When>('upcoming');
  const [category, setCategory] = useState('all');
  const [freeOnly, setFreeOnly] = useState(false);
  const categories = useMemo(() => [...new Map(events.map((e) => [e.category.id, e.category])).values()], [events]);
  const shown = useMemo(
    () =>
      events
        .filter((e) => when(e, now) === view && (category === 'all' || e.category.id === category) && (!freeOnly || e.ticketStatus === 'free'))
        .sort((a, b) => (view === 'past' ? (b.startsAt ?? '').localeCompare(a.startsAt ?? '') : Number(b.featured) - Number(a.featured))),
    [events, view, category, freeOnly, now],
  );
  const counts = (w: When) => events.filter((e) => when(e, now) === w).length;

  return (
    <>
      <section className="feature-search-panel">
        <div className="feature-tabs" role="group" aria-label="When">
          {([['upcoming', 'Upcoming'], ['tba', 'Dates soon'], ['past', 'Past']] as const).map(([k, label]) => (
            <button type="button" key={k} aria-pressed={view === k} onClick={() => setView(k)}>{label} ({counts(k)})</button>
          ))}
        </div>
        <div className="feature-tabs" role="group" aria-label="Category">
          <button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>All</button>
          {categories.map((c) => (
            <button type="button" key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.emoji} {c.label}</button>
          ))}
          <button type="button" aria-pressed={freeOnly} onClick={() => setFreeOnly(!freeOnly)}>Free only</button>
        </div>
      </section>

      {shown.length ? (
        <ul className="city-list" data-testid="events">
          {shown.map((e) => (
            <li key={e.id} className="city-card" style={{ borderLeft: `4px solid ${e.category.color ?? 'var(--line-paper)'}` }}>
              <header>
                <div>
                  <h2>{e.title}</h2>
                  <p>{e.category.emoji} {e.category.label} · {e.organiser}</p>
                </div>
                {e.featured && <span className="feature-status">Featured</span>}
              </header>
              <p className="city-body">
                <strong>{e.startsAt ? formatDateTimeIST(e.startsAt) : e.expectedText ?? 'Dates to be announced'}</strong>
                {e.endsAt && e.startsAt && formatDateIST(e.endsAt) !== formatDateIST(e.startsAt) ? ` to ${formatDateIST(e.endsAt)}` : ''}
                {e.recurringText ? ` · ${e.recurringText}` : ''}
              </p>
              <p className="city-note">{e.venue} · {e.priceText} · {STATUS[e.ticketStatus]}</p>
              <p className="city-body">{e.about}</p>
              {e.tiers.length > 0 && (
                <ul className="price-list" aria-label={`Passes for ${e.title}`}>
                  {e.tiers.map((t) => (
                    <li key={t.name}>
                      <span>{t.name}{t.note ? <small className="city-note"> · {t.note}</small> : null}</span>
                      <strong>{t.priceText}</strong>
                      <span className="city-note">{STATUS[t.status] ?? t.status}</span>
                    </li>
                  ))}
                </ul>
              )}
              {e.includes.length > 0 && (
                <details>
                  <summary>What is included</summary>
                  <ul className="city-note">{e.includes.map((i) => <li key={i}>{i}</li>)}</ul>
                </details>
              )}
              <div className="feature-action-row">
                {e.bookingUrl && e.ticketStatus !== 'past' && (
                  <a className="feature-primary" href={e.bookingUrl} target="_blank" rel="noopener noreferrer">
                    {e.ticketStatus === 'tba' ? 'Organiser page' : 'Book'} on {e.bookingSite ?? 'organiser site'} ↗
                  </a>
                )}
              </div>
              <p className="city-note">Checked {formatDateIST(e.checkedOn)}. Confirm dates and tickets on the booking page.</p>
            </li>
          ))}
        </ul>
      ) : (
        <section className="feature-empty">
          <h2>Nothing here right now</h2>
          <p>Try another category or time.</p>
        </section>
      )}
    </>
  );
}
