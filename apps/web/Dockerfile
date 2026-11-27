# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Curio web image (Next.js).
#
# Built from the repository root:
#   docker build -f apps/web/Dockerfile --build-arg API_URL=https://… -t curio-web .
#
# `API_URL` is a **build** argument, not a runtime env var: Next compiles its
# rewrites into the routes manifest, so the API's origin is fixed when the image
# is built. Changing it means rebuilding.
# ---------------------------------------------------------------------------

FROM oven/bun:1.4-alpine AS prepare
WORKDIR /app
RUN bun add -g turbo@2.11.13
COPY . .
RUN turbo prune @curio/web --docker

FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY --from=prepare /app/out/json/ ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.4-alpine AS build
WORKDIR /app
# Next shells out to `npm` during the build (package-manager detection); the Bun
# image has none. Node is only needed for the build, not the runtime.
RUN apk add --no-cache nodejs npm
# `next build` collects page data for /api/auth/[...all], which imports the
# database module, which needs DATABASE_URL to construct its client. The build
# needs no real database, and this value is never used at runtime — the runner
# stage gets the real one from the platform.
ENV DATABASE_URL="postgres://build:build@127.0.0.1:5432/build"
ENV BETTER_AUTH_SECRET="build-only-not-a-real-secret"
ARG API_URL=http://localhost:8787
ENV API_URL=$API_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/ ./
COPY --from=prepare /app/out/full/ ./
# A fresh id per image, written both into the client bundle (Next inlines
# `NEXT_PUBLIC_*`) and into a static file the running client can fetch.
# Comparing the two is how an installed app learns a new build exists: the
# worker file itself changes rarely, so `registration.update()` alone misses
# most deploys. The source `COPY` above invalidates this layer, so the id is
# new whenever the app changes.
RUN BUILD_ID="$(date +%s)" \
 && printf '{"buildId":"%s"}' "$BUILD_ID" > apps/web/public/version.json \
 && cd apps/web && NEXT_PUBLIC_BUILD_ID="$BUILD_ID" bun run build

FROM oven/bun:1.4-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S curio -g 1001 && adduser -S curio -u 1001
COPY --from=build /app/ ./
USER curio
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["bun", "run", "start"]
