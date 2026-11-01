import Link from "next/link";
import { getMarketplace } from "@/lib/marketplace/store";
import { getVisibleArtisans } from "@/lib/services/artisans";
import { getVisibleEvents } from "@/lib/services/events";

export default function HomePage() {
  const marketplace = getMarketplace();
  const communityShops = marketplace.listPublishedShops();
  const sampleArtisans = getVisibleArtisans();
  const communityEvents = marketplace.listEvents({ onlyUpcoming: false });
  const sampleEvents = getVisibleEvents();
  const friendProfiles = marketplace.listPublicLocalFriends();

  return (
    <div className="space-y-8 py-2">
      {/* Hero Header */}
      <header className="space-y-2 text-center max-w-lg mx-auto">
        <p className="discovery-eyebrow">MIRAS UDAIPUR</p>
        <h1 className="text-3xl md:text-4xl font-display font-medium text-[#101718]">
          Artisan Marketplace &amp; Event Management
        </h1>
        <p className="text-sm text-muted-paper">
          A dedicated three-role platform for master artisans, heritage event organizers, and cultural visitors in Udaipur.
        </p>
      </header>

      {/* Demo Credentials Card */}
      <section className="bg-white p-5 rounded-3xl border-2 border-[#101718] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-bold tracking-wider text-[#101718]">
            🔑 Instant Demo Credentials
          </span>
          <span className="text-[11px] bg-[#101718] text-white px-2.5 py-0.5 rounded-full font-medium">
            Pre-Seeded &amp; Ready
          </span>
        </div>
        <p className="text-xs text-muted-paper leading-relaxed">
          The local SQLite database (<code>data/miras.db</code>) is pre-configured with a universal demo account that can access both workspaces:
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs bg-paper p-3 rounded-2xl border border-line">
          <div>
            <span className="text-muted-paper block">Username:</span>
            <strong className="text-sm font-mono text-ink">123</strong>
          </div>
          <div>
            <span className="text-muted-paper block">Password:</span>
            <strong className="text-sm font-mono text-ink">123</strong>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            href="/artisans/login"
            className="w-full text-center py-2.5 bg-[#101718] text-white rounded-full font-medium text-xs transition hover:opacity-90"
          >
            Sign in as Artisan ↗
          </Link>
          <Link
            href="/events/login"
            className="w-full text-center py-2.5 border border-[#101718] bg-white text-ink rounded-full font-medium text-xs transition hover:bg-paper"
          >
            Sign in as Event Mgr ↗
          </Link>
        </div>
      </section>

      {/* Main Two-Pillar Showcase */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Pillar 1: Artisans */}
        <section className="bg-white p-5 rounded-3xl border border-line shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-paper">
                Maker Portal
              </span>
              <span className="text-xs bg-paper border border-line px-2 py-0.5 rounded-full">
                {communityShops.length + sampleArtisans.length} Listings
              </span>
            </div>
            <h2 className="text-xl font-medium">Artisans &amp; Craft Shops</h2>
            <p className="text-xs text-muted-paper leading-relaxed">
              Explore master miniature painters, potters, traditional textile weavers, and craft workshops. Artisans can manage their online shop catalogue, inventory, pricing, custom orders, and direct visitor inquiries.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-line/60">
            <Link
              href="/artisans"
              className="w-full block text-center py-2.5 bg-[#101718] text-white rounded-full font-medium text-xs transition hover:opacity-90"
            >
              Explore Artisan Directory ↗
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/artisans/login"
                className="text-center py-2 border border-line bg-paper/60 rounded-full font-medium text-xs text-ink hover:bg-paper transition"
              >
                Artisan Login
              </Link>
              <Link
                href="/artisans/register"
                className="text-center py-2 border border-line bg-paper/60 rounded-full font-medium text-xs text-ink hover:bg-paper transition"
              >
                Register Shop
              </Link>
            </div>
          </div>
        </section>

        {/* Pillar 2: Events */}
        <section className="bg-white p-5 rounded-3xl border border-line shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-paper">
                Experience Portal
              </span>
              <span className="text-xs bg-paper border border-line px-2 py-0.5 rounded-full">
                {communityEvents.length + sampleEvents.length} Events
              </span>
            </div>
            <h2 className="text-xl font-medium">Events &amp; Cultural Walks</h2>
            <p className="text-xs text-muted-paper leading-relaxed">
              Discover heritage walking tours, stepwell explorations, lakeside cultural performances, and hands-on workshops. Event Managers can publish schedules, manage booking inquiries, and monitor attendance.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-line/60">
            <Link
              href="/events"
              className="w-full block text-center py-2.5 bg-[#101718] text-white rounded-full font-medium text-xs transition hover:opacity-90"
            >
              Explore Events Calendar ↗
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/events/login"
                className="text-center py-2 border border-line bg-paper/60 rounded-full font-medium text-xs text-ink hover:bg-paper transition"
              >
                Event Mgr Login
              </Link>
              <Link
                href="/events/register"
                className="text-center py-2 border border-line bg-paper/60 rounded-full font-medium text-xs text-ink hover:bg-paper transition"
              >
                Register Organizer
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Local Friend & Universal Hub */}
      <section className="bg-white/80 p-5 rounded-3xl border border-line space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium">🤝 Local Friends &amp; Community Hub</h3>
          <span className="text-xs text-muted-paper">{friendProfiles.length} verified guides</span>
        </div>
        <p className="text-xs text-muted-paper leading-relaxed">
          Both master artisans and event managers can opt in to act as verified Local Friends, helping travelers navigate old Udaipur authentically.
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            href="/local-friends"
            className="text-center py-2 border border-line bg-white rounded-full font-medium text-xs text-ink hover:bg-paper transition"
          >
            Local Friends Network ↗
          </Link>
          <Link
            href="/account"
            className="text-center py-2 border border-line bg-white rounded-full font-medium text-xs text-ink hover:bg-paper transition"
          >
            Universal Account Hub ↗
          </Link>
        </div>
      </section>
    </div>
  );
}
