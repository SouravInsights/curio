# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Curio API image.
#
# Built from the repository root:
#   docker build -f apps/api/Dockerfile -t curio-api .
#
# Bun runs the TypeScript directly, so there is no build step. `turbo prune`
# narrows the workspace to exactly what @curio/api needs, which keeps the
# dependency install — and the image — small and cache-friendly.
# ---------------------------------------------------------------------------

# ---- prune: the smallest workspace that contains @curio/api -----------------
FROM oven/bun:1.4-alpine AS prepare
WORKDIR /app
RUN bun add -g turbo@2.11.13
COPY . .
RUN turbo prune @curio/api --docker

# ---- deps: install only the pruned dependency graph -------------------------
FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY --from=prepare /app/out/json/ ./
RUN bun install --frozen-lockfile --production

# ---- runner -----------------------------------------------------------------
FROM oven/bun:1.4-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S curio -g 1001 && adduser -S curio -u 1001

# Everything installed in the deps stage — the root and per-workspace
# node_modules both matter, because Bun keeps a workspace's dependencies in its
# own node_modules. `out/full` then overlays the source on top.
COPY --from=deps /app/ ./
COPY --from=prepare /app/out/full/ ./

USER curio

EXPOSE 8787
ENV API_HOST=0.0.0.0
ENV PORT=8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/health || exit 1

# Absolute path, no `run`: `bun run <path>` also consults package scripts, and
# the failure mode is a silent no-op.
CMD ["bun", "/app/apps/api/src/server.ts"]
