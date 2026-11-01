import Link from "next/link";
import { ArtisanCard, CraftPattern, MediaImage } from "@/components/domain";
import { EmptyState, Label } from "@/components/ui";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { getVisibleArtisans } from "@/lib/services/artisans";
import { getMarketplace } from "@/lib/marketplace/store";

export default async function ArtisansPage() {
  const lang = await getLang();
  const sampleArtisans = getVisibleArtisans();
  const communityShops = getMarketplace().listPublishedShops();

  return (
    <div className="space-y-5">
      {/* Top Banner with Navigation */}
      <div className="bg-white/80 p-3 rounded-2xl border border-line flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-1.5">
          <Link
            href="/artisans"
            className="px-3.5 py-1.5 bg-[#101718] text-white text-xs font-semibold rounded-full"
          >
            Explore Artisans
          </Link>
          <Link
            href="/artisans/login"
            className="px-3.5 py-1.5 bg-paper hover:bg-white text-ink text-xs font-medium rounded-full border border-line transition"
          >
            Artisan Login
          </Link>
          <Link
            href="/artisans/register"
            className="px-3.5 py-1.5 bg-paper hover:bg-white text-ink text-xs font-medium rounded-full border border-line transition"
          >
            Register as Artisan
          </Link>
        </div>
        <Link
          href="/local-friends?role=artisan"
          className="text-xs text-muted-paper hover:text-ink transition underline px-1"
        >
          Artisan Local Friends ↗
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-3xl font-display">{t(lang, "meetArtisans")}</h1>
        <p className="text-sm text-ink-soft">
          Discover Udaipur’s living craft traditions, master makers, and registered artisan shops.
        </p>
      </header>

      {/* Community Artisan Shops */}
      {communityShops.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Community Artisan Shops</h2>
            <span className="text-xs text-muted-paper">{communityShops.length} listings</span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {communityShops.map((shop) => (
              <li key={shop.id}>
                <Link
                  href={`/shops/${shop.slug}`}
                  className="flex gap-3 rounded-card border border-line bg-paper-2 text-on-paper p-3 hover:bg-paper transition"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-mist">
                    {shop.profileImage || shop.coverImage ? (
                      <MediaImage src={shop.profileImage || shop.coverImage} alt={shop.name} />
                    ) : (
                      <CraftPattern className="h-full w-full" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Label tone="rose">{shop.craft}</Label>
                      {shop.verificationStatus === 'verified' && (
                        <span className="text-[10px] bg-[#101718] text-white px-2 py-0.5 rounded-full font-medium">
                          Verified Maker
                        </span>
                      )}
                    </div>
                    <h3 className="t-heading mt-1 font-medium">{shop.name}</h3>
                    <p className="text-xs text-muted-paper truncate">
                      {shop.locality || 'Udaipur'} {shop.openingHours ? `· ${shop.openingHours}` : ''}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Heritage Sample Artisans */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Heritage Makers &amp; Traditions</h2>
          <span className="text-xs text-muted-paper">Curated</span>
        </div>
        {sampleArtisans.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {sampleArtisans.map((a) => (
              <li key={a.id}>
                <ArtisanCard artisan={a} lang={lang} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t(lang, "emptyTitle")} />
        )}
      </section>
    </div>
  );
}
