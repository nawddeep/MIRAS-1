import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { BottomNav } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Trip Trail: plan and explore Udaipur",
  description: "Plan a day-by-day Udaipur trip from live data, or explore what is around you. Information only: bookings happen on the provider's site.",
};

export const viewport: Viewport = {
  themeColor: "#e8f2f4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <div className="app-canvas">
          <main id="main">{children}</main>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
