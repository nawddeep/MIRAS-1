import Link from 'next/link';
import { formatDateIST, formatMoney } from '@/lib/city-format';
import type { LocalFriend, Tier } from '@/lib/services/abc-services';

const TIER: Record<Tier, string> = { new: '🌱 New Friend', trusted: '⭐ Trusted Friend', top: '🏅 Top Local', legend: '👑 Udaipur Legend' };
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function LocalFriendsView({ friends }: { friends: LocalFriend[] }) {
  return (
    <>
      <p className="city-safety">
        <strong>Local Friends are paid guides who are verified.</strong> Each one has linked DigiLocker; we keep only that it is verified, the document type and the date. Agree the fee directly with the local, meet in a public place and tell someone where you are going.
      </p>
      {friends.length ? (
        <ul className="city-list" data-testid="locals">
          {friends.map((f) => (
            <li key={f.id} className="city-card">
              <header>
                <div>
                  <h2>{f.name}</h2>
                  <p>{f.area}{f.yearsInCity ? ` · ${f.yearsInCity} years in Udaipur` : ''}</p>
                </div>
                <strong>{formatMoney(f.priceMinor)} <small className="city-note">/ {f.priceUnit}</small></strong>
              </header>
              <p>
                <span className="city-tag">DigiLocker verified {formatDateIST(f.verifiedAt)}</span>{' '}
                <span className="city-tag">{TIER[f.tier]}</span>
              </p>
              <p className="city-note">
                {f.rating ? `★ ${f.rating.toFixed(1)} (${f.reviewCount} reviews)` : 'No reviews yet'} · {f.hostedCount} trips hosted
                {f.responseRate != null ? ` · replies ${Math.round(f.responseRate * 100)}% of the time` : ''}
              </p>
              <p className="city-body">{f.about}</p>
              <p className="city-note">Speaks {f.languages.join(', ')} · {f.expertise.join(' · ')}</p>
              {f.reviews.map((r) => (
                <blockquote key={`${r.by}-${r.at}`} className="city-note">
                  <span aria-label={`${r.stars} out of 5`}>{stars(r.stars)}</span> {r.body} <em>— {r.by}</em>
                </blockquote>
              ))}
              <p className="city-note">Requests open with accounts. Until then, join a group that already has a Local Friend.</p>
            </li>
          ))}
        </ul>
      ) : (
        <section className="feature-empty">
          <h2>No Local Friends available yet</h2>
          <p>Verified locals will appear here as they join.</p>
          <Link className="feature-primary" href="/trails">Explore walking trails</Link>
        </section>
      )}
    </>
  );
}
