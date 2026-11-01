import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off on purpose: pages read local JSON/SQLite per request,
  // and the classic dynamic model is simpler to keep reliable for the demo.
  cacheComponents: false,
  devIndicators: false,
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
