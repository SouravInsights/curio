import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, openAPI } from "better-auth/plugins";
import { db } from "@/db/index.ts";
import { env } from "@/config.ts";

/**
 * Auth, via better-auth. It owns identity: `user`, `session`, `account`,
 * `verification` (and `apikey` once the API-key plugin is on). Nothing here
 * hand-rolls a password hash or a session token.
 *
 * Two credential shapes, both from one library:
 * - the **app** uses the session cookie better-auth sets;
 * - the **harness** (CLI, MCP clients like pi/Codex/Claude) uses a bearer
 *   token, which is what the `bearer` plugin is for. The API-key plugin adds
 *   long-lived, revocable tokens with rate limits when we need them.
 *
 * Schema: `npx @better-auth/cli generate --config src/auth/index.ts` writes
 * `src/db/auth-schema.ts`. Regenerate after changing plugins.
 */
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL || undefined,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    // A personal reading app has no email infrastructure yet; flip this on
    // (and wire a sender) before letting the public sign up.
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    // The site's cookie style: revocable rows, SameSite=Lax, secure off only in dev.
    cookiePrefix: "curio",
  },
  plugins: [bearer(), openAPI()],
});

export type Auth = typeof auth;
