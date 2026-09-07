# Little World — persistent-world Beta milestone 1

The pixel-art canvas, villager cards, scenery, sharing, and Chronicle remain. The original simulation rules now run on the server. Every visitor to the same environment reads one authoritative Upstash world.

## Architecture

- `lib/engine.js`: the original simulation, extracted from commit `b878762e1bd431ee691929b223b3534097c8ed6c`; deterministic saved random sequence and request-local state.
- `lib/store.js`: Upstash REST commands with four-second timeouts. Atomic Lua initialization and compare-and-swap prevent lost updates. Reads run through EVAL on the primary.
- `lib/world.js`: versioned state, validation, bounded simulation, and structured logs.
- `GET /api/state`: reads the shared world; initializes only on the first visit.
- `POST /api/tick`: advances from server elapsed time, returns the resulting shared snapshot. No client state, time, speed, or reset accepted. Same-origin browser requests only.
- `GET /api/tick`: scheduler entry point; requires `Authorization: Bearer <CRON_SECRET>`.
- `game.js`: polls every five seconds while visible, animates pixel art and interpolates positions without simulating local outcomes. An interrupted connection retains the last snapshot and retries.
- `chronicle.html`: reads shared history every 15 seconds.

There is no production fallback to an in-memory or localStorage world. Existing browser saves are left untouched and never imported automatically. First initialization creates the original nine settlers. Preserving an individual browser civilization would require a separate reviewed import process.

## Database configuration

Use the existing Vercel integration variables on the server:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Do not use the read-only token. No database secrets enter browser code, logs, or Git. Missing variables return HTTP 503 with a request ID.

Production uses `little-world:{production}:v1`. Each preview branch gets its own hashed namespace; subsequent deployments of that branch resume the same preview world. Development uses a separate namespace. Preview without branch metadata fails closed. Keep Vercel system environment variables enabled.

World and initialization-marker keys have no expiration. If the state disappears but its marker remains, initialization refuses to replace it. Restore from a trusted backup; do not remove the marker to hide data loss. If both keys are deleted, no application can distinguish this from first use. Configure database retention/eviction appropriately and back up before rollout.

## Time and concurrency

Ticks use 100 ms simulation steps and a five-second minimum interval. At most 120 simulated seconds advance per request. Longer absences discard excess elapsed time, record `skippedMs` in logs, and consume that gap once. This intentionally avoids replaying weeks of births, deaths, and work in one invocation.

Two competing requests may compute the same interval, but only one can atomically commit. Losers return the latest saved world. Retrying after an ambiguous network failure cannot advance the same interval twice. Wall-clock rollback never rewinds the simulation.

The world persists with no browser open. **This milestone advances on visits unless an external scheduler is configured.** No paid scheduler or Vercel cron has been enabled. For unattended ticks, configure a scheduler to call authenticated `GET /api/tick`, set `CRON_SECRET` privately, and select a cadence permitted by the hosting plan. Preview schedulers must target only the preview deployment.

## Scope of this milestone

Villagers use the original built-in instincts. AI calls are disabled, including the legacy public `/api/decide` route, until server-side AI scheduling and atomic decision persistence are implemented. This avoids per-visitor AI spend and asynchronous decisions lost after a function exits. The existing Anthropic environment variable is not changed.

The public UI no longer offers global reset, pause, or speed controls. Selection and sharing remain local UI actions. Chronicle retains the original last 400 entries and the village log retains 40; this is not a permanent full-history archive. Public reads/tick requests still consume hosting/database resources; the cadence protects simulation time, not against arbitrary request floods.

## Run and test

Node 24, no production dependencies required:

```sh
node --test test/*.test.js
node scripts/build.js
node scripts/dev.js
```

The local test server at `http://127.0.0.1:3000` uses an explicit memory test store. It never loads Upstash credentials and resets when stopped. Production handlers never import that store. `npm test`, `npm run build`, and `npm run dev` are equivalent where npm is installed.

The build copies only the four public site files to `public/`; server modules, tests, and documentation are excluded from static hosting. Vercel builds `/api` functions separately.

## Preview rollout and rollback

The local `preserved/pre-beta-2026-09-07` tag records the exact original revision. `main` remains unchanged. Work is on `beta/persistent-world`.

1. Push the preservation tag and Beta branch with authorized GitHub write access.
2. Open a draft pull request against `main`. Use the Vercel Git integration preview; do not merge yet.
3. Verify preview environment variables and system branch metadata. Preview never reads or overwrites production keys.
4. Confirm two independent browsers see the same world, refresh/resume works, Chronicle matches, and logs show successful ticks. Test concurrent requests and catch-up on preview only.
5. Confirm the deployed Upstash write/read path and retained data across a redeployment. Local tests alone do not establish this.
6. Only then merge for a new production-environment build. Do not simply alias a preview build onto production: its runtime namespace may still be preview.

Rollback code to the preserved revision or the previous production deployment. The old UI resumes browser saves; the Upstash world remains untouched. Database rollback is a separate deliberate restore, never a side effect of code rollback.

Useful log events: `world_initialization_checked`, `world_tick` (revision, simulatedMs, skippedMs, population, day), `world_tick_conflict`, and `world_request_failed` (sanitized code and request ID). Do not add raw request headers, upstream response bodies, or environment values to logs.
