# Civoria — persistent shared world

Civoria is a pixel-art civilization experiment backed by one canonical server-side world. Every visitor to the same environment sees the same villagers, buildings, resources and Chronicle. The browser is a viewer, not the owner of the simulation.

## Current milestone: Civoria 0.2

Civoria 0.2 adds unattended world advancement and the owner-selected real-time calendar:

- approximately **1 Civoria day = 1 real day**
- one canonical world stored in Upstash
- browser-independent `/api/heartbeat`
- GitHub Actions heartbeat roughly every 15 minutes
- short-lived GitHub OIDC authentication, with no required static heartbeat password
- up to seven real days of bounded catch-up after an outage
- deterministic built-in villager instincts; persistent AI minds are deferred to Civoria 0.3

The existing civilization was not reset when 0.2 shipped. Earlier days created under the legacy accelerated clock remain part of the saved history.

## Architecture

- `lib/engine.js`: deterministic village simulation extracted from the original browser game. It owns movement, needs, jobs, resources, homes, market, farming, births, deaths and the saved random sequence.
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

Production uses `little-world:{production}:v1`. Preview branches use isolated namespaces derived from Vercel branch metadata. Development is separate. Preview without required branch metadata fails closed.

World and initialization-marker keys have no application TTL. If established state disappears while its marker remains, initialization refuses to silently replace the civilization. Restore from a trusted backup rather than deleting safety markers.

## Time, ticking and catch-up

The original engine was tuned around a 55-second internal day. Civoria 0.2 does **not** change every engine rule individually. Instead, `lib/world.js` scales real elapsed time before handing it to the engine:

- 86,400 real seconds map to 55 internal engine seconds
- hunger, energy, movement, work, farming, regeneration, aging, births and deaths therefore retain their original proportions
- one internal day now takes approximately one real day

The minimum normal tick interval is five real seconds. Competing requests can calculate the same interval, but compare-and-swap allows only one result to commit. Duplicate deliveries and wall-clock rollback do not double-run or rewind the world.

Civoria can replay at most seven real days of elapsed time in one invocation. Longer gaps consume the excess once and record it as `skippedMs`. At the real-time scale, seven real days equal only about 385 internal simulation seconds, so this gives ordinary scheduler outages plenty of recovery room without allowing an unbounded backlog.

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

Current persistent villagers use the original deterministic instincts. The old browser AI route is disabled for canonical decisions. The existing Anthropic environment variable is unchanged.

Civoria 0.3 is expected to restore AI as bounded server-side cognition with validated decisions, persistent memories, atomic writes and explicit spending controls. It should not restore per-visitor paid AI requests.

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
