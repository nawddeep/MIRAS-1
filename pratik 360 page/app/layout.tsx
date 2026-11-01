import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile-design.css";

export const metadata: Metadata = {
  title: "MIRAS · 360° & VR Studio",
  description: "On-device 360° camera studio, equirectangular panorama importer, WebGL sphere viewer, and VR headset preview.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e8f2f4",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh flex flex-col bg-[#e8f2f4] text-[#101718]">
        <main className="flex-1 mx-auto w-full max-w-[430px] px-4 py-4">
          {children}
        </main>
      </body>
    </html>
  );
}
