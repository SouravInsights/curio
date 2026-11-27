/** @type {import('next').NextConfig} */
const apiUrl = process.env.API_URL ?? "http://localhost:8787";

/*
 * Dev and production both use Turbopack (`next dev`, `next build`).
 *
 * `agentRules: false` stops `next dev` writing a managed apps/web/AGENTS.md:
 * the repo has one real AGENTS.md at the root, and an auto-regenerated second
 * one is churn.
 */
const nextConfig = {
  reactStrictMode: true,
  agentRules: false,
  // `@curio/core` ships TypeScript source, so Next compiles it. No build step in
  // the package, no prebuilt artifacts to keep in sync.
  transpilePackages: ["@curio/core", "@curio/ui"],
  // Server-only packages that must not be bundled.
  serverExternalPackages: ["jsdom", "defuddle", "postgres", "puppeteer-core"],
  // The app talks to the API at same-origin `/api/v1/*`; Next forwards it.
  // Same-origin keeps the better-auth session cookie working — cross-origin
  // cookies would need SameSite=None and a CORS dance for no benefit.
  //
  // Scoped to `/api/v1/*` on purpose: `rewrites()` is `afterFiles`, which runs
  // before *dynamic* routes, and `/api/auth/[...all]` is dynamic. A broad
  // `/api/:path*` would therefore swallow the auth handler and forward sign-in
  // to the API, which does not serve it.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiUrl}/api/v1/:path*` }];
  },

  // The service worker must never be served from cache, or a deploy would not be
  // picked up until it expired. Everything else under `/_next/static` is
  // content-hashed and can be cached forever.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
