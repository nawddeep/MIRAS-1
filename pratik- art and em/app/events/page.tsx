import Link from "next/link";
import { Card, EmptyState, SampleBadge } from "@/components/ui";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { formatIST, getVisibleEvents } from "@/lib/services/events";
import { getMarketplace } from "@/lib/marketplace/store";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type = 'all' } = await searchParams;
  const lang = await getLang();
  const sampleEvents = getVisibleEvents();
  const communityEvents = getMarketplace().listEvents({
    eventType: type !== 'all' ? type : undefined,
    onlyUpcoming: false,
  });

  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'workshop', label: 'Workshops' },
    { key: 'heritage_walk', label: 'Heritage Walks' },
    { key: 'cultural_performance', label: 'Cultural' },
    { key: 'festival', label: 'Festivals' },
  ];

  return (
    <div className="space-y-5">
      {/* Top Banner with Navigation */}
      <div className="bg-white/80 p-3 rounded-2xl border border-line flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-1.5">
          <Link
            href="/events"
            className="px-3.5 py-1.5 bg-[#101718] text-white text-xs font-semibold rounded-full"
          >
            Explore Events
          </Link>
          <Link
            href="/events/login"
            className="px-3.5 py-1.5 bg-paper hover:bg-white text-ink text-xs font-medium rounded-full border border-line transition"
          >
            Event Manager Login
          </Link>
          <Link
            href="/events/register"
            className="px-3.5 py-1.5 bg-paper hover:bg-white text-ink text-xs font-medium rounded-full border border-line transition"
          >
            Register as Event Manager
          </Link>
        </div>
        <Link
          href="/local-friends?role=event_manager"
          className="text-xs text-muted-paper hover:text-ink transition underline px-1"
        >
          Event Local Friends ↗
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-3xl font-display">Events &amp; Workshops</h1>
        <p className="text-sm text-ink-soft">
          Heritage walks, artisan workshops, and cultural performances confirmed by their organizers.
        </p>
      </header>

      {/* Filter Tabs */}
      <div className="journal-tabs overflow-x-auto py-1" role="group" aria-label="Event categories">
        {filterTabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === 'all' ? '/events' : `/events?type=${tab.key}`}
            className={`px-4 py-2 text-xs font-medium rounded-full text-center whitespace-nowrap transition ${
              type === tab.key
                ? 'bg-[#101718] text-white'
                : 'text-muted-paper hover:text-ink hover:bg-paper'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Community Events */}
      {communityEvents.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-medium">Community Gatherings &amp; Workshops</h2>
          <ul className="space-y-3">
            {communityEvents.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="block group">
                  <Card className="hover:border-ink transition">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider bg-paper border border-line px-2.5 py-0.5 rounded-full">
                        {e.eventType.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-muted-paper">
                        {e.organizerRole === 'artisan' ? 'Artisan Workshop' : 'Community Event'}
                      </span>
                    </div>

                    <h3 className="mt-2 text-xl font-medium group-hover:underline">{e.title}</h3>
                    <p className="text-sm font-semibold text-lake-deep mt-0.5">{formatIST(e.startsAt)}</p>

                    <p className="text-xs text-muted-paper mt-1 line-clamp-2">{e.description}</p>

                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-line/60 pt-2.5">
                      <div>
                        <dt className="text-muted-paper">Organiser</dt>
                        <dd className="font-medium text-ink">{e.organizerName}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-paper">Location</dt>
                        <dd className="font-medium text-ink truncate">{e.location}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-paper">Cost</dt>
                        <dd className="font-medium text-ink">{e.cost}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-paper">Capacity</dt>
                        <dd className="font-medium text-ink">{e.capacity} spots</dd>
                      </div>
                    </dl>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sample Events */}
      {(type === 'all' || type === 'workshop') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Heritage &amp; Sample Events</h2>
            <span className="text-xs text-muted-paper">Curated</span>
          </div>

          {sampleEvents.length ? (
            <ul className="space-y-3" data-testid="events">
              {sampleEvents.map((e) => (
                <li key={e.id}>
                  <Card>
                    {e.isSample && <SampleBadge lang={lang} />}
                    <h3 className="mt-1 text-xl font-medium">{e.title}</h3>
                    <p className="text-sm font-semibold text-lake-deep">{formatIST(e.startsAt)}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                      <dt className="text-ink-soft">Organiser</dt>
                      <dd>{e.organiser}</dd>
                      <dt className="text-ink-soft">{t(lang, "duration")}</dt>
                      <dd>
                        {e.durationMinutes} {t(lang, "minutes")}
                      </dd>
                      <dt className="text-ink-soft">{t(lang, "language")}</dt>
                      <dd>{e.language}</dd>
                      <dt className="text-ink-soft">{t(lang, "cost")}</dt>
                      <dd>{e.cost}</dd>
                      <dt className="text-ink-soft">{t(lang, "howToBook")}</dt>
                      <dd className="min-w-0 break-words">{e.howToBook}</dd>
                    </dl>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t(lang, "emptyTitle")} />
          )}
        </section>
      )}
    </div>
  );
}
