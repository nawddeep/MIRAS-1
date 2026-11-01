import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Hind, Tiro_Devanagari_Hindi } from "next/font/google";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ServiceWorker } from "@/components/ServiceWorker";
import { BottomNav, TopBar } from "@/components/shell";
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
  title: "MIRAS — Artisans & Event Management Platform",
  description: "Explore authentic Udaipur master artisans, heritage walks, cultural events, and community workshops.",
  applicationName: "MIRAS Artisan & Event Portal",
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
};

export const viewport: Viewport = {
  themeColor: "#e8f2f4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getLang();

  return (
    <html data-scroll-behavior="smooth" lang={lang} className={`${tiro.variable} ${hind.variable} h-full antialiased`}>
      <body className="miras-body flex min-h-full flex-col">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <ServiceWorker />
        <InstallPrompt />

        <div className="demo-notice bg-[#101718] px-4 py-1.5 text-center text-xs text-white">
          Demo Testing Credentials: Username: <strong>123</strong> · Password: <strong>123</strong>
        </div>

        <TopBar appName="MIRAS" right={<LanguageSwitch lang={lang} />} />
        <main id="main-content" className="miras-main mx-auto w-full max-w-3xl flex-1 px-5 py-5 pb-24">
          {children}
        </main>
        <footer className="miras-footer pb-24 border-t border-line px-5 pt-6 text-center text-xs text-muted-paper">
          <p>MIRAS Artisan &amp; Event Management Portal · Udaipur</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link href="/artisans" className="underline">Artisans</Link>
            <Link href="/events" className="underline">Events</Link>
            <Link href="/local-friends" className="underline">Local Friends</Link>
            <Link href="/account" className="underline">Account</Link>
          </div>
        </footer>
        <BottomNav />
      </body>
    </html>
  );
}
