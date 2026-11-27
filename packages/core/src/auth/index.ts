/**
 * Auth, via better-auth. It owns identity: `user`, `session`, `account`,
 * `verification`. Nothing here hand-rolls a password hash or a session token.
 *
 * Two credential shapes, both from one library:
 * - the **app** uses the session cookie better-auth sets;
 * - the **harness** (CLI, MCP clients like pi/Codex/Claude) uses a bearer
 *   token, which is what the `bearer` plugin is for.
 *
 * Rate limiting is better-auth's own and is on by default: 3 attempts per 10s
 * on the sign-in, sign-up and password routes, and its global limit elsewhere.
 * It keys on the client IP, which is what `ipAddress` below is about.
 *
 * Schema: `npx @better-auth/cli generate --config src/auth/index.ts` writes
 * `src/db/auth-schema.ts`. Regenerate after changing plugins.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { db } from "@curio/core/db/index";
import { env } from "@curio/core/config";

/**
 * Origins a browser may call auth from. `BETTER_AUTH_URL` is the app's own
 * origin; the extra list covers the dev server, a preview deploy and any second
 * hostname. Without this a request carrying an `Origin` the server does not
 * recognise is rejected as `INVALID_ORIGIN` — and only a browser sends one, so
 * the failure never appears in a curl or a server-side call.
 */
const trustedOrigins = [env.BETTER_AUTH_URL, ...env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")]
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL || undefined,
  trustedOrigins,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Cache the session in a signed cookie. Without this, every API request
    // spends a database round-trip asking "is this session still valid", which
    // is the largest cost on a click. Five minutes of staleness is the trade.
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  advanced: {
    // The app's cookie style: revocable rows, SameSite=Lax, secure off only in dev.
    cookiePrefix: "curio",
    // Rate limits are keyed by client IP. Fly's edge writes the caller's
    // address to `Fly-Client-IP` and overwrites anything a client sends, so it
    // is the header that identifies a caller; `X-Forwarded-For` arrives
    // multi-hop, which better-auth will not trust on its own.
    ipAddress: {
      ipAddressHeaders: ["fly-client-ip", "x-forwarded-for"],
    },
  },
  plugins: [bearer()],
});

export type Auth = typeof auth;
