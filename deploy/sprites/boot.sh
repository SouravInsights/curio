#!/usr/bin/env bash
# Boot Curio on a Fly Sprite. The only Fly-aware code in the repo, on purpose:
# the app itself never learns where it runs.
set -euo pipefail

cd "$(dirname "$0")/../.."

if [ ! -f .env ]; then
  echo "no .env — copy .env.example and fill DATABASE_URL + BETTER_AUTH_SECRET" >&2
  exit 1
fi

echo "installing dependencies…"
bun install --frozen-lockfile 2>/dev/null || bun install

echo "applying migrations…"
bun run db:migrate

echo "starting curio…"
# A Sprite keeps services running and scales to zero when idle. If the Sprite
# has a Services supervisor, register this command with it; otherwise nohup is
# enough for the hackathon.
LOG="${CURIO_LOG:-/tmp/curio.log}"
nohup bun run start >"$LOG" 2>&1 &
echo "curio started (pid $!). logs: $LOG"
