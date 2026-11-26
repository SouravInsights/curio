#!/usr/bin/env bash
# Prove the Sprite is wired correctly: the app answers, and the connector
# gateway is reachable from inside the Sprite.
set -euo pipefail

PORT="${PORT:-8787}"

echo "— app —"
curl -fsS "http://localhost:${PORT}/health" && echo

echo "— gateway connectors —"
# Lists the connectors this Sprite can reach. A 401 here means the call did not
# originate inside a Sprite; a missing OpenRouter entry means the access policy
# has not granted this Sprite.
curl -fsS https://api.sprites.dev/v1/gateway/list | head -c 800 && echo

echo "— env —"
grep -E '^(SPRITES_GATEWAY_URL|BETTER_AUTH_URL)=' .env || true
