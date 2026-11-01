import type { NextConfig } from "next";

// The browser only ever talks to this Next.js server. /api/* is proxied to the FastAPI
// backend, so provider keys stay on the server side.
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Live provider calls (e.g. OpenStreetMap rental lookups) can take longer than the 30 s default.
  experimental: { proxyTimeout: 90_000 },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
