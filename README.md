# Civoria — persistent shared world

Civoria is a pixel-art civilization experiment backed by one canonical server-side world. Every visitor to the same environment sees the same villagers, buildings, resources and Chronicle. The browser is a viewer, not the owner of the simulation.

## Current milestone: Civoria 0.4 primitive origin

Civoria 0.4 begins a new primitive-origin world and adds the first executable personal discovery:

- **1 real day = 30 Civoria days = 1 Civoria month**
- no inherited homes, farms, market, trades or recipes
- physical experiments spend canonical time and materials
- two matching shaped-wood results give only the discoverer a repeatable timber recipe
- timber is a real resource recorded and rendered in construction
- one canonical world stored in Upstash
- browser-independent `/api/heartbeat`
- GitHub Actions heartbeat roughly every 15 minutes
- short-lived GitHub OIDC authentication, with no required static heartbeat password
- up to seven real days of bounded catch-up after an outage
- persistent AI minds propose hypotheses while the deterministic engine owns physical results

The release uses a new `v2` storage namespace to begin the primitive world. The earlier `v1` production key is left intact for recovery rather than deleted.

## Architecture

- `lib/engine.js`: deterministic simulation owning movement, needs, primitive work, executable processes, construction, births, deaths and the saved random sequence.
- `lib/affordances.js`: physical operation/material signatures. These are environmental laws, not knowledge granted to Civorians.
- `lib/store.js`: authenticated Upstash REST persistence with atomic initialization and compare-and-swap.
- `lib/world.js`: versioned canonical state, validation, real-time scaling, catch-up limits, heartbeat metadata and structured logs.
- `lib/http.js`: request guards, same-origin browser tick rules and scheduler authentication.
- `lib/github-oidc.js`: verifies short-lived GitHub Actions OIDC tokens and restricts them to this repository, `main`, the heartbeat workflow and the expected audience.
- `GET /api/state`: reads the current shared world.
- `POST /api/tick`: advances elapsed time for a visible browser and returns the shared snapshot. Client state, time, speed and reset commands are never accepted.
- `GET` or `POST /api/heartbeat`: authenticated unattended advancement endpoint. It returns timing/revision/day metadata, not the full village.
- `game.js`: polls the server while visible and renders/interpolates the shared state without simulating canonical outcomes locally.
- `chronicle.html`: reads the shared Chronicle from the server.
- `.github/workflows/heartbeat.yml`: production unattended scheduler.
- `.github/workflows/test.yml`: automated Beta tests and build checks.

There is no production fallback to an in-memory or `localStorage` civilization. Old browser saves are left untouched but are not imported automatically.

## Database configuration

The server uses the existing Vercel Upstash integration variables:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Do not use the read-only token for writes. Database credentials never belong in browser code, logs or Git.

Production uses `little-world:{production}:v2`. Preview branches use isolated `v2` namespaces derived from Vercel branch metadata. The recoverable pre-origin civilization remains under `v1`. Development is separate. Preview without required branch metadata fails closed.

World and initialization-marker keys have no application TTL. If established state disappears while its marker remains, initialization refuses to silently replace the civilization. Restore from a trusted backup rather than deleting safety markers.

## Time, ticking and catch-up

The original engine is tuned around a 55-second internal day. `lib/world.js` scales real elapsed time before handing it to the engine:

- 86,400 real seconds map to 1,650 internal engine seconds
- one internal day takes approximately 48 real minutes
- biological aging is decoupled: 360 internal days equal one year of age

The minimum normal tick interval is five real seconds. Competing requests can calculate the same interval, but compare-and-swap allows only one result to commit. Duplicate deliveries and wall-clock rollback do not double-run or rewind the world.

Civoria can replay at most seven real days of elapsed time in one invocation. Longer gaps consume the excess once and record it as `skippedMs`, preventing an unbounded backlog.

## Unattended heartbeat

The production workflow runs at minutes 2, 17, 32 and 47 of every hour:

```text
2,17,32,47 * * * *
```

Each job requests a short-lived GitHub Actions OIDC token with audience `civoria-heartbeat` and calls:

```text
https://www.thecivoria.com/api/heartbeat
```

The server verifies GitHub's signature plus the expected repository, repository ID, owner ID, `main` ref, workflow ref, audience and event. A legacy `CRON_SECRET` remains supported as an optional fallback, but the GitHub scheduler does not require one.

The release-triggered production heartbeat was verified successfully. A normal recurring `schedule` event should also be observed after release before treating scheduler operation as fully verified. GitHub scheduled workflows can be delayed, so elapsed-time catch-up is intentionally independent of exact delivery timing.

## AI scope

Persistent minds can form personal hypotheses. The AI cannot create resources, facts, recipes or structures. The canonical engine requires real materials and work, evaluates a physical affordance, and grants an executable capability only after repeated evidence.

## Public UI and history

The public UI has no global reset, pause or speed controls. Clicking a villager and sharing are local presentation actions only.

The recent village log retains 40 entries and the Chronicle retains 400. This is not yet a permanent archival history system.

## Run and test

Node 24, with no third-party production package required:

```sh
npm test
npm run build
npm run dev
```

The local development server uses an explicit memory-only test store. It never imports production Upstash credentials. Production handlers never use the development memory store.

The static build copies only the public site files into `public/`; Vercel builds `/api` functions separately.

## Release discipline

New civilization mechanics should be developed on a feature branch, tested, preview-deployed and reviewed before merging to `main`. Preserve production data and do not use a feature deployment against production keys.

Useful structured events include:

- `world_initialization_checked`
- `world_tick`
- `world_heartbeat`
- `world_tick_conflict`
- `world_request_failed`

Do not log raw authorization headers, OIDC tokens, Upstash credentials, Anthropic keys or upstream secret response bodies.

See `HANDOFF.md` for the latest operational checkpoint and `SCHEDULING.md` for the unattended-world scheduler design.
