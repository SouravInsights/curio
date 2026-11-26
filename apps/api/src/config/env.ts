import { z } from "zod";

/**
 * The API's environment, parsed once at startup. One schema, so a missing or
 * malformed variable fails the boot with a readable list rather than surfacing
 * as `undefined` deep in a request.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  API_HOST: z.string().default("0.0.0.0"),
  API_PUBLIC_URL: z.string().default("http://localhost:8787"),
  /** Comma-separated browser origins. Empty means "dev only, allow all". */
  API_CORS_ORIGINS: z.string().default(""),
  LOG_LEVEL: z.string().default("info"),
  APP_VERSION: z.string().default("0.1.0"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

export type ApiConfig = z.infer<typeof schema>;

export function loadConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  const parsed = schema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n  ${issues.join("\n  ")}`);
  }
  return parsed.data;
}
