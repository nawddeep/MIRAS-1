import type { NextConfig } from "next";

// The trip planner's Python backend (Itinerary/backend, `npm run trip-api`). The browser only ever talks to this
// server: /api/trip/* is proxied there, so provider keys (Google, Geoapify, ...) stay server-side.
const tripBackend = process.env.TRIP_BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Live provider calls (e.g. OpenStreetMap rental lookups) can take longer than the 30 s default.
  experimental: { proxyTimeout: 90_000 },
  async rewrites() {
    return [{ source: "/api/trip/:path*", destination: `${tripBackend}/api/:path*` }];
  },
  // Cache Components is off on purpose: pages read local JSON/SQLite per request,
  // and the classic dynamic model is simpler to keep reliable for the demo.
  cacheComponents: false,
  devIndicators: false,
  // Lets a phone reach the dev server through a Cloudflare quick tunnel (camera access needs HTTPS off localhost).
  allowedDevOrigins: ["*.trycloudflare.com"],
  // The Tailwind loader also supports Webpack, for hosts that restrict
  // Turbopack's local worker ports during production builds.
  webpack(config) {
    config.module.rules.push({oneOf: [{test: /\.css$/,enforce: "pre",use: ["@tailwindcss/turbopack"]}]});
    return config;
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
