# Civoria — assistant handoff

Updated: 2026-09-09. This is the shared project checkpoint for the owner, ChatGPT/Codex, and Claude. Verify GitHub before editing and do not store secrets in this file.

## Current progress

| Field | Latest checkpoint |
|---|---|
| Status | Visible movement fix released with owner approval via PR #7; activity script now ships and work routines repeat. |
| Active work | PR #7 merged as 7291ff4778d8115da86a48a85a24270813257039; production deployment 4afhSiLsdPuKj5BfdLywr9Ky4EHH succeeded; no implementation active |
| Live site | https://www.thecivoria.com |
| Production branch | main; PR #7 movement release 7291ff4778d8115da86a48a85a24270813257039 |
| Two-clock verification | GitHub Beta checks run 28 passed on exact candidate `2d16d5a8baf09137cde2fd3ce841542ada25237f`; Vercel production status for merge `36ca79f8` reported success |
| Visual release | PR #5, **Release approved Clivoria living-world visuals**, merged earlier as `1facd30a1176548c6188ce74347af02552f741f2` |
| World storage | One canonical Upstash-backed world per environment |
| World pace | Approximately 1 Civoria day = 1 real day; unchanged by the viewer activity fix |
| Scheduler | GitHub Actions, minutes 2, 17, 32 and 47 of each hour |
| Scheduler auth | Short-lived GitHub Actions OIDC JWT; no new paid scheduler and no required static heartbeat secret |
| Catch-up fuse | Up to 7 real days per invocation; excess is discarded once and logged |
| Scheduler verification | Confirmed 2026-09-09. `Civoria heartbeat` runs #57-#62 all completed successfully with GitHub event `Scheduled` on `main`, latest at 20:16:48 CDT. Observed delivery gaps were 12-28 minutes rather than an exact 15-minute cadence; this is normal GitHub scheduler drift and is absorbed by the catch-up fuse. |
| Still pending | Server-side AI minds remain deferred to Civoria 0.3. No open implementation work. |
| AI status | Persistent villagers currently use deterministic built-in instincts. Anthropic decision calls are intentionally disabled in the canonical engine. |

## Visible routine follow-up — released 2026-09-09

Owner confirmed “it's moving now” and explicitly approved publication. PR #7 merged as 7291ff4778d8115da86a48a85a24270813257039. Final branch head 1678bec1 passed Beta checks run 31. Vercel production deployment 4afhSiLsdPuKj5BfdLywr9Ky4EHH succeeded. Earlier preview-pending statements below describe pre-release checkpoints.

Owner reported no actual travel, only animation. Codex found two problems: the previous viewer stops at a destination while waiting on the macro clock, and scripts/build.js omitted activity-clock.js entirely from public output. Earlier release/CI success did not establish browser delivery of the activity layer. PR #7 adds the missing build asset, an output-asset regression test, and repeating visual outbound/work/return/pause routines with a return-leg prop. No canonical resource, clock, API, or database changes. Seven targeted activity tests pass locally; full checks passed the first candidate, build-fix candidate 0a1ad232 passed full Beta checks run 30 and Vercel deployment. Hosted browser showed villagers dispersed to trees, farms and rocks after loading the exact preview. Repeated return cycles are verified by deterministic tests; no automated pixel-tracking assertion was used. Production is unchanged.

## Two-clock activity fix — released 2026-09-09

After the richer 2.5D visuals shipped, the owner noticed villagers appeared to stand in one place. The cause was the Civoria 0.2 real-time scale: the original 55-second internal day is mapped to 24 real hours, so the engine's original movement speed also became extremely slow in wall-clock time.

The owner explicitly approved keeping the 1:1 civilization clock while separating visible activity from long-term progression. The fix was implemented as a browser-only viewer layer rather than changing the canonical engine.

Production behavior now:

- `activity-clock.js` runs only in the browser and wraps the viewer's `/api/tick` response before `game.js` renders it.
- Canonical server state remains authoritative and untouched.
- Villagers in a canonical `moving` state are visually advanced toward their existing canonical `tx/ty` at about 4.2 world units per real second, so a typical 60-unit trip takes about 14 seconds to watch.
- If the visual proxy reaches its canonical target before the slow macro engine does, only the browser drawing state switches into a work/rest animation. No server action completes early.
- Idle villagers take small local visual strolls around their canonical position so quiet periods still look alive.
- Working, socializing and resting villagers receive only small presentation offsets/animations. Hunger, aging, crops, resources, births, buildings and other canonical consequences continue on the 1:1 world schedule.
- Large discrepancies re-anchor to canonical position to avoid inventing travel after restores or major catch-up events.
- The activity clock loads before `game.js` and has no write path back to the canonical world.

### Two-clock release verification

- Branch: `beta/two-clock-activity`.
- PR: #6, **Fix villager motion with a separate viewer activity clock**.
- Exact tested candidate: `2d16d5a8baf09137cde2fd3ce841542ada25237f`.
- First Beta check run 27 failed only because the arrival test expected a target after two capped visual updates instead of three; implementation behavior was correct. The test was corrected without changing the activity algorithm.
- Fresh Beta checks run 28: **success** (`npm test` and `npm run build`).
- Vercel preview on the final candidate: **success**.
- PR #6 merged to `main` as `36ca79f8f92910465d73948f6dd505042821066d`.
- Vercel production status for `36ca79f8`: **success**.
- No `lib/engine.js`, `lib/world.js`, `/api`, Upstash, scheduler, or canonical state changes were made by this fix.

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

### Visual release verification

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
- The two-clock activity layer is presentation-only and has no canonical write path.

## Services and secrets

Existing services: GitHub, Vercel and Upstash. No new paid service was created for Civoria 0.2, the visual release, or the activity-clock fix.

Upstash server variables remain managed in Vercel. Existing `ANTHROPIC_API_KEY` was not changed and is not used by the current canonical persistent engine. Never paste secret values into chats, commits or logs.

## Production verification — 2026-09-09 (Claude)

Read-only checks against production. No code, configuration, canonical state or deployment was changed by this pass.

- `Civoria heartbeat` workflow: 62 total runs. The six most recent all report event `Scheduled`, branch `main`, completed successfully — 20:16:48, 19:48:36, 19:23:33, 18:55:48, 18:43:54 and 18:30:07 CDT. This closes the previously pending scheduled-event requirement.
- Observed delivery gaps were 12-28 minutes, not the exact 15 implied by `2,17,32,47 * * * *`. Treat the cron as approximate; the 7-day catch-up fuse absorbs the drift.
- `activity-clock.js` returns HTTP 200 from `https://www.thecivoria.com` and appears in the served page script tags ahead of `game.js`. This objectively confirms the PR #7 build-output fix reached production.
- `/api/state`: day 89, revision 3912, 22 agents. `lastHeartbeatAt` was roughly six minutes before the check and matches the most recent scheduled run.
- Canonical motion sampled twice 12.1 seconds apart: agent `Vesh` moved from (262.15, 210.36) to (262.51, 210.55), about 0.41 units, or roughly 0.034 world units per real second. A second agent changed state from `resting` to `idle` in the same window.
- That canonical rate against the viewer's approximately 4.2 units per real second is a factor of about 124, which is the measured justification for the two-clock design.

Not verified in this pass: on-screen rendering of villager travel was not observed directly. Delivery and loading of the activity layer were confirmed; visible motion remains attested by the owner's own pre-release review rather than by an independent observation.

## Next exact action

Review PR #7 preview: https://little-world-mancil1fq-small-villager.vercel.app/index.html#live-world . Owner confirmed preview movement and approved release; PR #7 is now merged and production deployment succeeded. The local routine-fix directory contains the presentation files and focused tests; build/test additions are saved on GitHub. Do not use the older local village checkouts to overwrite current main.

1. Done 2026-09-09 — the scheduled-event heartbeat requirement is verified. See "Production verification". No further action.
2. Optional — confirm on-screen villager travel by direct visual observation, which has not been independently checked since PR #7 shipped.
3. Before any Civoria 0.3 work, produce a cost model for server-side AI decisions. Required input from the owner: the intended decision cadence, whether per internal engine day, per state change, or per heartbeat. With 22 agents these differ by orders of magnitude, so do not assume one.
4. Open design question: the Chronicle caps at 400 entries and the recent log at 40, so world history is silently discarded over time. Decide whether history is archival or disposable before the project is promoted as a persistent civilization.
5. Owner may continue presentation tuning or choose the next milestone.
6. Persistent AI minds remain a separate Civoria 0.3 milestone and should not start without owner direction.

## Coordination rule

Only one assistant should edit/deploy at a time. Before starting, read this file and current GitHub state. Before handing off, record branch/commit/PR, tests, deployment state, blockers and the exact next action.

## Session history

- 2026-09-09 — ChatGPT traced the Vercel `little-world` deployment to `Channy337/Little-World-`, created `beta/living-world-visuals`, replaced the pixel-art presentation with an illustrated Canvas/UI pass, and opened preview PR #3.
- 2026-09-09 — At the owner's request, ChatGPT pushed the real renderer substantially further: perspective 2.5D camera, distant landscape layers, stronger buildings/citizen variation, depth sorting and atmospheric animation.
- 2026-09-09 — Owner requested removal of the yellow “Enter the living world” CTA, reviewed the updated preview, then explicitly approved production rollout.
- 2026-09-09 — Final visual release detected a parallel earlier graphics change already on `main`. ChatGPT rebuilt the approved visuals cleanly on top of current production, opened PR #5, confirmed fresh Beta checks and Vercel preview success, merged as `1facd30a`, confirmed Vercel production success, and closed superseded PR #3.
- 2026-09-09 — Owner noticed villagers appeared frozen under the 1:1 real-time scale and approved a two-clock fix. ChatGPT created `beta/two-clock-activity`, implemented a browser-only activity layer plus tests, corrected one test expectation caught by CI, passed Beta checks run 28, merged PR #6 as `36ca79f8`, and confirmed Vercel production success without changing canonical simulation mechanics.

- 2026-09-09 — Codex: PR #7 fixes missing deployment of activity-clock.js and adds repeated presentation work routines. Changed activity-clock.js, game.js, scripts/build.js, test/activity-clock.test.js; added test/build-assets.test.js. Exact candidate 0a1ad232 passed Beta checks run 30 and Vercel; hosted travel observed. No production or canonical data changes. Next: owner preview review, then authorized release.

- 2026-09-09 — Codex: Owner approved PR #7 release after confirming preview movement. Merged exact tested head 1678bec1 as 7291ff47; Vercel production succeeded. Existing saved civilization and real-time progression preserved. Dashboard reads this release checkpoint automatically.

- 2026-09-09 — Claude: read-only production verification. Confirmed recurring `Civoria heartbeat` runs with GitHub event `Scheduled` completing successfully, latest at 20:16:48 CDT, confirmed `activity-clock.js` is served and loaded in production, and sampled `/api/state` at day 89, revision 3912, 22 agents with measurable canonical villager motion of about 0.034 world units per real second. No branch, commit, deployment or canonical data change. Updated this file only.
