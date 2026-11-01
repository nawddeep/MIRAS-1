import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Hind, Tiro_Devanagari_Hindi } from "next/font/google";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ServiceWorker } from "@/components/ServiceWorker";
import { BottomNav, TopBar } from "@/components/shell";
import { getConfig } from "@/lib/config";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import "./globals.css";
import "./mobile-design.css";

const tiro = Tiro_Devanagari_Hindi({
  variable: "--font-tiro",
  weight: "400",
  subsets: ["latin", "devanagari"],
  display: "swap",
});

const hind = Hind({
  variable: "--font-hind",
  weight: ["400", "500", "600"],
  subsets: ["latin", "devanagari"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MIRAS: Udaipur heritage and local makers",
  description: "Find a heritage site, read a sourced story, and meet a local artisan in Udaipur.",
  applicationName: "MIRAS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MIRAS",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#e8f2f4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  const { demoMode } = getConfig();
  return (
    <html data-scroll-behavior="smooth" lang={lang} className={`${tiro.variable} ${hind.variable} h-full antialiased`}>
      <body className="miras-body flex min-h-full flex-col">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <ServiceWorker />
        <InstallPrompt />
        {demoMode && (
          <div className="demo-notice bg-ink px-4 py-1.5 text-center text-xs text-on-dark">
            Demo mode: sample content is shown and badged. Nothing marked sample is real.
          </div>
        )}
        <TopBar appName={t(lang, "appName")} right={<LanguageSwitch lang={lang} />} />
        <main id="main-content" className="miras-main mx-auto w-full max-w-3xl flex-1 px-5 py-5">{children}</main>
        <footer className="miras-footer pb-nav border-t border-line px-5 pt-6 text-center text-xs text-muted-paper">
          <p>MIRAS · Udaipur, hour by hour.</p>
          <Link href="/profile" className="inline-flex min-h-11 items-center underline">Your saved places &amp; travel tools</Link>
        </footer>
        <BottomNav
          labels={{
            home: t(lang, "navHome"),
            places: lang === "hi" ? "खोजें" : "Explore",
            immersive: t(lang, "nav360"),
            plan: lang === "hi" ? "योजना" : "Plan",
            stories: t(lang, "navStories"),
            makers: lang === "hi" ? "प्रोफ़ाइल" : "Profile",
          }}
        />
      </body>
    </html>
  );
}
