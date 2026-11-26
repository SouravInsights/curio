# Sprites deployment

A Sprite is a persistent, hardware-isolated Linux VM. Curio runs there so it can
keep its state and use a connector — the gateway only accepts calls that
originate inside a Sprite.

```bash
sprite create curio
sprite console -s curio
git clone <repo> /srv/curio && cd /srv/curio
cp .env.example .env         # fill DATABASE_URL + BETTER_AUTH_SECRET
bash deploy/sprites/boot.sh
bash deploy/sprites/check.sh
```

## The connector

1. Fly organization → **Connectors** → add **OpenRouter** (managed, or BYOK).
2. Grant access to the Sprite by name prefix or label. Deny-by-default.
3. Set the gateway base in `.env`:

   ```
   SPRITES_GATEWAY_URL=https://api.sprites.dev/v1/gateway/openrouter/<connection_id>/api/v1
   ```

No OpenRouter key enters the box. `src/kb/model.ts` reads that variable and uses
the gateway instead of a key; it is the only place that changes.

Optional second connector: **GitHub**, so the agent can commit a reading digest —
and so the connector is visibly doing work, not standing in for one.
