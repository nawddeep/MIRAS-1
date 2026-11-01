import Link from 'next/link';
import { connection } from 'next/server';
import { ArrowIcon } from '@/components/icons';
import { formatDateIST } from '@/lib/city-format';
import { getPublicGroups } from '@/lib/services/abc-services';

export default async function GroupsPage() {
  await connection();
  const groups = getPublicGroups();
  return (
    <div className="feature-preview">
      <Link href="/discover" className="feature-back">← All MIRAS features</Link>
      <header className="feature-page-heading">
        <span className="feature-status">Public groups</span>
        <h1>Travel together</h1>
        <p>Join a group heading out in Udaipur, or travel solo and meet people on the way.</p>
      </header>
      <p className="city-safety">Private groups are invite-only and are not listed. Joining and group chat open with accounts.</p>
      {groups.length ? (
        <ul className="city-list" data-testid="groups">
          {groups.map((g) => (
            <li key={g.id} className="city-card">
              <header>
                <div>
                  <h2><Link href={`/groups/${g.id}`}>{g.name}</Link></h2>
                  <p>{g.destination} · {formatDateIST(g.startDate)} to {formatDateIST(g.endDate)}</p>
                </div>
              </header>
              <p className="city-body">{g.description}</p>
              <p>{g.vibes.map((v) => <span key={v} className="city-tag">{v}</span>)}</p>
              <p className="city-note">{g.memberCount} of {g.maxMembers} going · led by {g.leaderName}{g.localFriendName ? ` · with Local Friend ${g.localFriendName}` : ''}</p>
              <div className="feature-action-row">
                <Link className="feature-secondary" href={`/groups/${g.id}`}>See the plan <ArrowIcon size={18} /></Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className="feature-empty">
          <h2>No public groups yet</h2>
          <p>Groups open to everyone will appear here.</p>
        </section>
      )}
    </div>
  );
}
