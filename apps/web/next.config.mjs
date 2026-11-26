/** @type {import('next').NextConfig} */
const apiUrl = process.env.API_URL ?? "http://localhost:8787";

const nextConfig = {
  reactStrictMode: true,
  // `@curio/core` ships TypeScript source, so Next compiles it. No build step in
  // the package, no prebuilt artifacts to keep in sync.
  transpilePackages: ["@curio/core"],
  // Server-only packages that must not be bundled.
  serverExternalPackages: ["jsdom", "defuddle", "postgres", "puppeteer-core"],
  // The app talks to the API at same-origin `/api`; Next forwards it. Same-origin
  // keeps the better-auth session cookie working — cross-origin cookies would
  // need SameSite=None and a CORS dance for no benefit.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
