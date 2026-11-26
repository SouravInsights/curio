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
ARG API_URL=http://localhost:8787
ENV API_URL=$API_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/ ./
COPY --from=prepare /app/out/full/ ./
RUN cd apps/web && bun run build

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
