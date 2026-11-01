import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDateIST } from '@/lib/city-format';
import { getPublicGroup } from '@/lib/services/abc-services';

export default async function GroupPage({ params }: PageProps<'/groups/[id]'>) {
  const { id } = await params;
  const group = getPublicGroup(id);
  if (!group) notFound();
  const days = [...new Set(group.itinerary.map((i) => i.day))];
  return (
    <div className="feature-preview">
      <Link href="/groups" className="feature-back">← All groups</Link>
      <header className="feature-page-heading">
        <span className="feature-status">{group.destination} · {formatDateIST(group.startDate)} to {formatDateIST(group.endDate)}</span>
        <h1>{group.name}</h1>
        <p>{group.description}</p>
      </header>
      <p>{group.vibes.map((v) => <span key={v} className="city-tag">{v}</span>)}</p>
      <p className="city-note">
        {group.memberCount} of {group.maxMembers} going · led by {group.leaderName}
        {group.localFriendName ? ` · Local Friend ${group.localFriendName} is joining` : ''}
      </p>
      <section className="city-card" style={{ marginTop: 16 }}>
        <h2>The plan</h2>
        {days.length ? (
          days.map((d) => (
            <div key={d}>
              <h3 className="city-note" style={{ marginTop: 14 }}>Day {d}</h3>
              <ul className="price-list" aria-label={`Day ${d}`}>
                {group.itinerary.filter((i) => i.day === d).map((i) => (
                  <li key={i.id}>
                    <strong>{i.time}</strong>
                    <span>{i.title}<small className="city-note"> · {[i.place, i.note].filter(Boolean).join(' · ')}</small></span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="city-note">The leader has not added stops yet.</p>
        )}
      </section>
      <section className="city-card" style={{ marginTop: 16 }}>
        <h2>Who is going</h2>
        <p className="city-body">{group.members.join(', ')}</p>
        <p className="city-note">Joining, suggesting changes, chat and polls open with accounts.</p>
      </section>
    </div>
  );
}
