'use client';

import { useMemo, useState } from 'react';
import { directionsUrl, distanceKm, formatDateIST, formatMoney, isDialable, telHref, type Point } from '@/lib/city-format';
import type { Lang } from '@/lib/i18n';
import type { RentalShop, Stay } from '@/lib/services/city-services';
import { ArrowIcon } from './icons';
import { SampleBadge } from './ui';

/** The visitor's position stays in this browser: it is only used to sort the list, never sent anywhere. */
function useNearMe() {
  const [pos, setPos] = useState<Point | null>(null);
  const [status, setStatus] = useState('');
  function ask() {
    if (!('geolocation' in navigator)) return setStatus('Location is not available on this device, so results stay in name order.');
    setStatus('Finding you…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStatus('');
      },
      () => setStatus('Location is off, so results stay in their usual order. You can allow it in your browser settings.'),
      { timeout: 10_000, maximumAge: 60_000 },
    );
  }
  return { pos, status, ask };
}

const away = (pos: Point | null, to: Point) => (pos ? ` · ${distanceKm(pos, to).toFixed(1)} km away` : '');
const mapsSearch = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const STAY_KIND: Record<string, string> = { hotel: 'Hotel', hostel: 'Hostel', homestay: 'Homestay', guesthouse: 'Guesthouse', heritage_haveli: 'Heritage haveli', other: 'Stay' };

export function StaysView({ stays, lang }: { stays: Stay[]; lang: Lang }) {
  const [sustainableOnly, setSustainableOnly] = useState(false);
  const [sort, setSort] = useState<'price' | 'near'>('price');
  const { pos, status, ask } = useNearMe();
  const shown = useMemo(() => {
    const lowest = (s: Stay) => Math.min(Number.MAX_SAFE_INTEGER, ...s.prices.map((p) => p.priceMinor));
    return stays
      .filter((s) => !sustainableOnly || s.sustainable)
      .sort(sort === 'near' && pos ? (a, b) => distanceKm(pos, a) - distanceKm(pos, b) : (a, b) => lowest(a) - lowest(b));
  }, [stays, sustainableOnly, sort, pos]);

  return (
    <>
      <section className="feature-search-panel">
        <h2>Compare before you book</h2>
        <div className="feature-tabs" role="group" aria-label="Sort and filter stays">
          <button type="button" aria-pressed={sort === 'price'} onClick={() => setSort('price')}>Lowest price</button>
          <button type="button" aria-pressed={sort === 'near'} onClick={() => { setSort('near'); if (!pos) ask(); }}>Nearest to me</button>
          <button type="button" aria-pressed={sustainableOnly} onClick={() => setSustainableOnly(!sustainableOnly)}>Sustainable only</button>
        </div>
        {status && <p className="feature-muted" role="status">{status}</p>}
        <p className="feature-muted">Your location stays in your browser and is only used to sort this list.</p>
      </section>

      {shown.length ? (
        <ul className="city-list" data-testid="stays">
          {shown.map((s) => (
            <li key={s.id} className="city-card">
              <header>
                <div>
                  <h2>{s.name}</h2>
                  <p>{STAY_KIND[s.kind] ?? 'Stay'}{s.area ? ` · ${s.area}` : ''}{away(pos, s)}</p>
                </div>
                {s.isSample && <SampleBadge lang={lang} />}
              </header>
              {s.sustainable && <span className="city-tag">Sustainable stay</span>}
              {s.sustainable && s.practices.length > 0 && <p className="city-note">{s.practices.join(' · ')}</p>}
              {s.description && <p className="city-body">{s.description}</p>}
              {s.prices.length > 0 ? (
                <ul className="price-list" aria-label={`Prices for ${s.name}`}>
                  {s.prices.map((p) => (
                    <li key={`${p.source}-${p.roomType}`} data-cheapest={p.cheapest && s.prices.filter((q) => q.roomType === p.roomType).length > 1}>
                      <span>{p.source}{p.roomType ? ` · ${p.roomType}` : ''}</span>
                      <strong>{formatMoney(p.priceMinor, p.currency)}</strong>
                      {p.cheapest && s.prices.filter((q) => q.roomType === p.roomType).length > 1 && <span className="feature-status">Lowest</span>}
                      {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer">Book ↗</a>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="city-note">No prices checked yet. Use the directions or call the stay to ask.</p>
              )}
              {s.prices.length > 0 && (
                <p className="city-note">
                  Checked {formatDateIST(s.prices.reduce((a, p) => (p.checkedAt > a ? p.checkedAt : a), ''))}. Taxes and cancellation terms differ, so confirm on the booking site.
                  {s.isSample && ' Sample prices, not real.'}
                </p>
              )}
              <div className="feature-action-row">
                {!s.isSample && isDialable(s.phone) && <a className="feature-primary" href={telHref(s.phone)}>Call</a>}
                <a className="feature-secondary" href={directionsUrl(s)} target="_blank" rel="noopener noreferrer">Directions <ArrowIcon size={18} /></a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className="feature-empty">
          <h2>{stays.length ? 'No stays match these filters' : 'No stays listed yet'}</h2>
          <p>{stays.length ? 'Try turning a filter off.' : 'Verified stays and their prices will appear here as they are added.'}</p>
        </section>
      )}
      <a className="feature-secondary" target="_blank" rel="noopener noreferrer" href={mapsSearch('hotels in Udaipur')}>Search more on Google Maps ↗</a>
    </>
  );
}

const VEHICLES = [['cycle', 'Cycle'], ['bike', 'Bike'], ['scooter', 'Scooter'], ['car', 'Car']] as const;

export function RentalsView({ shops, lang }: { shops: RentalShop[]; lang: Lang }) {
  const [kind, setKind] = useState<'all' | (typeof VEHICLES)[number][0]>('all');
  const [nearest, setNearest] = useState(false);
  const { pos, status, ask } = useNearMe();
  const present = VEHICLES.filter(([k]) => shops.some((s) => s.offers.some((o) => o.vehicleKind === k)));
  const shown = useMemo(() => {
    const list = shops
      .map((s) => ({ ...s, offers: kind === 'all' ? s.offers : s.offers.filter((o) => o.vehicleKind === kind) }))
      .filter((s) => kind === 'all' || s.offers.length);
    return nearest && pos ? list.sort((a, b) => distanceKm(pos, a) - distanceKm(pos, b)) : list;
  }, [shops, kind, nearest, pos]);

  return (
    <>
      <section className="feature-search-panel">
        <h2>Find your next ride</h2>
        <div className="feature-tabs" role="group" aria-label="Vehicle type">
          <button type="button" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>All</button>
          {present.map(([k, label]) => (
            <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{label}</button>
          ))}
          <button type="button" aria-pressed={nearest} onClick={() => { setNearest(!nearest); if (!pos) ask(); }}>Nearest to me</button>
        </div>
        {status && <p className="feature-muted" role="status">{status}</p>}
        <p className="feature-muted">Your location stays in your browser and is only used to sort this list. Call the shop to book.</p>
      </section>

      {shown.length ? (
        <ul className="city-list" data-testid="rentals">
          {shown.map((s) => (
            <li key={s.id} className="city-card">
              <header>
                <div>
                  <h2>{s.name}</h2>
                  <p>{[s.area, s.hoursText].filter(Boolean).join(' · ')}{away(pos, s)}</p>
                </div>
                {s.isSample && <SampleBadge lang={lang} />}
              </header>
              {s.offers.length > 0 && (
                <ul className="price-list" aria-label={`Vehicles at ${s.name}`}>
                  {s.offers.map((o) => (
                    <li key={o.id}>
                      <span>
                        {VEHICLES.find(([k]) => k === o.vehicleKind)?.[1]}{o.model ? ` · ${o.model}` : ''}
                        {o.depositMinor ? <small className="city-note"> · Deposit {formatMoney(o.depositMinor)}</small> : null}
                      </span>
                      {o.priceMinor != null && <strong>{formatMoney(o.priceMinor)} / {o.per}</strong>}
                    </li>
                  ))}
                </ul>
              )}
              {s.isSample && <p className="city-note">Sample listing: the phone number and prices appear once the shop is verified.</p>}
              <div className="feature-action-row">
                {!s.isSample && isDialable(s.phone) && <a className="feature-primary" href={telHref(s.phone)}>Call {s.name}</a>}
                <a className="feature-secondary" href={directionsUrl(s)} target="_blank" rel="noopener noreferrer">Directions <ArrowIcon size={18} /></a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className="feature-empty">
          <h2>{shops.length ? 'No shops offer that vehicle' : 'No rental shops listed yet'}</h2>
          <p>{shops.length ? 'Try another vehicle type.' : 'Verified rental shops will appear here as they are added.'}</p>
        </section>
      )}
      <a className="feature-secondary" target="_blank" rel="noopener noreferrer" href={mapsSearch('bike and car rental in Udaipur')}>Search more on Google Maps ↗</a>
    </>
  );
}
