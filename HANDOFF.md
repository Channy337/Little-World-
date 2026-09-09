# Civoria — assistant handoff

Updated: 2026-09-09. This is the shared project checkpoint for the owner, ChatGPT/Codex, and Claude. Verify GitHub before editing and do not store secrets in this file.

## Current progress

| Field | Latest checkpoint |
|---|---|
| Status | Production visuals are live; owner approved a follow-up two-clock viewer fix because 1:1 world time made villagers appear frozen |
| Live site | https://www.thecivoria.com |
| Production branch | `main`; approved visual release merged via PR #5 as `1facd30a1176548c6188ce74347af02552f741f2`; final documentation follow-up on main was `e7dfdf530408d43b34b7978aa9593d1fd470e3f2` |
| Active fix | `beta/two-clock-activity`; presentation-only activity clock for visible movement without accelerating canonical simulation |
| Active fix commits | `620308f8` adds `activity-clock.js`; `3768f59a` loads it before `game.js`; `610fafec` adds tests |
| World storage | One canonical Upstash-backed world per environment |
| World pace | Approximately 1 Civoria day = 1 real day; this remains unchanged |
| Scheduler | GitHub Actions, minutes 2, 17, 32 and 47 of each hour |
| Scheduler auth | Short-lived GitHub Actions OIDC JWT; no new paid scheduler and no required static heartbeat secret |
| Catch-up fuse | Up to 7 real days per invocation; excess is discarded once and logged |
| Still pending | Fresh Beta checks and Vercel preview for the two-clock viewer fix, then production rollout under the owner's explicit approval; observe and record at least one heartbeat run whose GitHub event is `schedule`; server-side AI minds remain deferred to Civoria 0.3 |
| AI status | Persistent villagers currently use deterministic built-in instincts. Anthropic decision calls are intentionally disabled in the canonical engine. |

## Two-clock activity fix — 2026-09-09

After the richer 2.5D visuals shipped, the owner noticed villagers appeared to stand in one place. The cause is real: Civoria 0.2 maps the original 55-second internal day to 24 real hours, so the engine's original movement speed of 42 world units per simulation second also became extremely slow in real time.

The owner explicitly approved keeping the 1:1 civilization clock but separating visible activity from long-term progression.

The implementation on `beta/two-clock-activity` deliberately does **not** modify `lib/engine.js`, `lib/world.js`, `/api`, Upstash state, resources, hunger, aging, crops, births, buildings, heartbeat behavior, or any other canonical mechanic. Instead:

- New `activity-clock.js` runs only in the browser and wraps the viewer's `/api/tick` response before `game.js` renders it.
- Canonical server state remains authoritative and untouched.
- Villagers in a canonical `moving` state are visually advanced toward their existing canonical `tx/ty` at about 4.2 world units per real second, so a typical 60-unit trip takes about 14 seconds to watch.
- If the visual proxy reaches its canonical target before the slow macro engine does, it switches only the browser's drawing state into a work/rest animation. No server action is completed early.
- Idle villagers take small local visual strolls around their canonical position so quiet periods still look alive.
- Working, socializing and resting villagers receive only small presentation offsets/animations. Long-term consequences continue at the real-time 1:1 pace.
- Large discrepancies re-anchor to canonical position to avoid inventing travel after restores or large catch-up events.
- The activity clock is loaded before `game.js`, so it affects the viewer without changing the canonical engine.

New tests verify visible real-time movement, visual arrival behavior, non-tick fetch pass-through, load order, absence of browser persistence hooks, and that the transformed viewer state cannot mutate the canonical server fixture.

## Production visual release — 2026-09-09

The owner reviewed the stronger `beta/living-world-visuals` preview and explicitly approved rolling it to production. During the final release check, `main` was found to have moved independently through a separate earlier graphics upgrade. To avoid overwriting or force-merging parallel work, the approved presentation files were rebased cleanly onto the then-current production `main` and released through PR #5.

The release changed presentation only. It did not modify `lib/`, `/api`, Upstash configuration, heartbeat scheduling, canonical world state, or simulation mechanics.

Released visual changes include:

- Perspective projection from the existing 480×304 simulation coordinate system into a taller 2.5D scene with a horizon and depth scaling.
- Distant sky, sun/moon, mountains, layered forest line, moving clouds and birds.
- A perspective meadow instead of a rectangular board, with depth-scaled ground texture and flowers.
- Perspective-scaled paths, pond, farms, resources, well, homes, market, villagers and click hit-testing; simulation coordinates themselves are unchanged.
- Depth sorting across villagers, buildings, trees, rocks, bushes and the well so foreground objects naturally overlap background objects.
- Larger and more varied homes with multiple palettes, fences/gardens, roof/wall detail, chimney smoke and night-window glow.
- A more substantial market with crates, produce, awning, flag and hanging lanterns.
- More distinctive villagers using deterministic visual variation only: multiple skin tones, hair colors/styles and role-specific silhouettes/accessories such as farmer hats, miner helmets, trader satchels and woodcutter accents.
- Animated breeze, drifting particles, dawn fog, fireflies, dusk/dawn color treatment, night lighting and foreground vegetation framing.
- Share-card rendering updated to the taller visual scene.
- Public-facing Clivoria branding and non-pixel UI treatment.
- Yellow “Enter the living world” hero CTA removed at the owner's request.

### Release verification

- Release candidate branch: `release/living-world-visuals`.
- Exact candidate commit: `cab9c38a2ba939ab2ee7654ff4646fee8c4cf965`.
- Fresh GitHub Beta checks run 26: **success** (`npm test` and `npm run build`).
- Vercel preview status on candidate: **success**.
- PR #5 merged to `main` as `1facd30a1176548c6188ce74347af02552f741f2`.
- Vercel production status for `1facd30a`: **success**.
- Superseded PR #3 was closed and not merged.

## Civoria 0.2 behavior now live

The browser is a viewer of one shared server-side civilization. It does not own or save the canonical world. Upstash stores the world state, Vercel serves the state/tick/heartbeat endpoints, and GitHub Actions supplies the unattended pulse.

The original engine was tuned around a 55-second internal day. `lib/world.js` scales real elapsed time so 86,400 real seconds map to 55 internal engine seconds. This keeps the long-term world pace at approximately one Civoria day per real day.

`/api/heartbeat` advances the same canonical world as browser ticks. It records `lastHeartbeatAt` atomically, retries bounded write conflicts, never accepts client world state, and returns compact timing/revision/day metadata rather than the full village.

The GitHub Actions workflow `.github/workflows/heartbeat.yml` is scheduled at `2,17,32,47 * * * *`. It requests a short-lived OIDC token with audience `civoria-heartbeat`, then calls `https://www.thecivoria.com/api/heartbeat`. The server validates GitHub's signature and requires the expected repository, repository ID, owner ID, `main` ref, workflow ref, audience and permitted workflow event. A legacy `CRON_SECRET` remains supported as an optional fallback.

## Key files

- `lib/engine.js` — deterministic village simulation and original built-in instincts.
- `lib/store.js` — Upstash REST persistence, initialization and compare-and-swap.
- `lib/world.js` — canonical world service, real-time scaling, seven-day catch-up fuse and heartbeat metadata.
- `lib/http.js` — HTTP guards and scheduler authentication.
- `lib/github-oidc.js` — GitHub Actions OIDC signature and claim validation.
- `api/state.js` — read shared state.
- `api/tick.js` — browser/server tick path.
- `api/heartbeat.js` — unattended advancement endpoint.
- `.github/workflows/heartbeat.yml` — recurring production heartbeat.
- `.github/workflows/test.yml` — Beta test/build checks.
- `SCHEDULING.md` — scheduler design and release notes.
- `activity-clock.js` — browser-only visible activity layer; must never write canonical state.
- `game.js` — shared-world viewer and visual renderer; no local canonical simulation.
- `chronicle.html` — shared Chronicle viewer.

## Safety/data guarantees

- No browser-provided state, speed, reset or clock commands are accepted.
- State writes use compare-and-swap to prevent double advancement from concurrent requests.
- Duplicate or backwards heartbeat deliveries cannot replay elapsed simulation.
- Corrupt or unsupported saved data fails closed rather than silently reseeding.
- Production and preview namespaces remain separate.
- World and initialization marker are persistent; do not delete keys to recover from an error without a reviewed restore plan.
- Chronicle is capped at 400 entries and the recent log at 40, so this is not yet a permanent historical archive.
- The two-clock activity layer is presentation-only and must not introduce any write path back to the canonical world.

## Services and secrets

Existing services: GitHub, Vercel and Upstash. No new paid service was created for Civoria 0.2, the visual release, or the activity-clock fix.

Upstash server variables remain managed in Vercel. Existing `ANTHROPIC_API_KEY` was not changed and is not used by the current canonical persistent engine. Never paste secret values into chats, commits or logs.

## Next exact action

1. Open a PR from `beta/two-clock-activity` to `main` and trigger fresh Beta checks.
2. Confirm `npm test`, `npm run build`, and Vercel preview all succeed on the exact candidate.
3. Under the owner's explicit approval to “go with that fix,” merge only after those checks pass.
4. Confirm Vercel production deployment succeeds and the live villagers visibly move while the world day remains on the existing 1:1 schedule.
5. Record the final production checkpoint here.
6. Separately, observe and record the first successful `Civoria heartbeat` run whose GitHub event is `schedule` if still pending.
7. Persistent AI minds remain a separate Civoria 0.3 milestone and should not start without owner direction.

## Coordination rule

Only one assistant should edit/deploy at a time. Before starting, read this file and current GitHub state. Before handing off, record branch/commit/PR, tests, deployment state, blockers and the exact next action.

## Session history

- 2026-09-09 — ChatGPT traced the Vercel `little-world` deployment to `Channy337/Little-World-`, created `beta/living-world-visuals`, replaced the pixel-art presentation with an illustrated Canvas/UI pass, and opened preview PR #3.
- 2026-09-09 — At the owner's request, ChatGPT pushed the real renderer substantially further: perspective 2.5D camera, distant landscape layers, stronger buildings/citizen variation, depth sorting and atmospheric animation.
- 2026-09-09 — Owner requested removal of the yellow “Enter the living world” CTA, reviewed the updated preview, then explicitly approved production rollout.
- 2026-09-09 — Final release detected a parallel earlier graphics change already on `main`. ChatGPT rebuilt the approved visuals cleanly on top of current production, opened PR #5, confirmed fresh Beta checks and Vercel preview success, merged as `1facd30a`, confirmed Vercel production success, and closed superseded PR #3.
- 2026-09-09 — Owner noticed villagers appeared frozen under the 1:1 real-time scale and approved a two-clock fix. ChatGPT created `beta/two-clock-activity` and implemented a browser-only activity layer plus tests, leaving the canonical engine and Upstash world untouched.
