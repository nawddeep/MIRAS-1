/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // stories up to ~150 MB (a 60 s 360 video) are uploaded through the API route
  experimental: { serverActions: { bodySizeLimit: '160mb' }, proxyClientMaxBodySize: '160mb' },
};
export default nextConfig;
