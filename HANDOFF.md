# Civoria — assistant handoff

Updated: 2026-09-09. This is the shared project checkpoint for the owner, ChatGPT/Codex, and Claude. Verify GitHub before editing and do not store secrets in this file.

## Current progress

| Field | Latest checkpoint |
|---|---|
| Status | Civoria 0.2 remains released to production; first authenticated production heartbeat succeeded; first normal `schedule` delivery still awaiting observation |
| Live site | https://www.thecivoria.com |
| Production branch | `main` at `14449c3a22834dee69ad926181114da1f9c67156`; unchanged by the visual preview work |
| Active visual work | `beta/living-world-visuals`, draft PR #3; presentation-only illustrated-world redesign |
| Visual preview verification | Vercel preview Ready; GitHub `Beta checks` run 23 completed successfully (`npm test` and `npm run build`) |
| Civoria 0.2 release | PR #2 merged as `1ffe7f42db1f148ba44cfe85020c9482ab6dcc97` |
| World storage | One canonical Upstash-backed world per environment |
| World pace | Approximately 1 Civoria day = 1 real day |
| Scheduler | GitHub Actions, minutes 2, 17, 32 and 47 of each hour |
| Scheduler auth | Short-lived GitHub Actions OIDC JWT; no new paid scheduler and no required static heartbeat secret |
| Catch-up fuse | Up to 7 real days per invocation; excess is discarded once and logged |
| Verification | Latest Beta Node tests pass, static build passes, Vercel visual preview is Ready, production Vercel deploy passes, release-triggered production heartbeat passes |
| Still pending | Owner review/approval of the visual preview; observe at least one heartbeat run whose GitHub event is `schedule`; server-side AI minds remain deferred to Civoria 0.3 |
| AI status | Persistent villagers currently use deterministic built-in instincts. Anthropic decision calls are intentionally disabled in the canonical engine. |

## Active visual preview — 2026-09-09

The owner requested replacing the pixel-art presentation with a richer living-world look while keeping the actual simulation intact. ChatGPT created `beta/living-world-visuals` from the current production `main` and opened draft PR #3, **Preview: illustrated living-world visual overhaul**.

The work changes only `game.js`, `styles.css`, `index.html` and this handoff note. It does not modify `lib/`, `/api`, Upstash configuration, heartbeat scheduling, canonical world state, or simulation mechanics.

Implemented visual changes include:

- 2x high-resolution Canvas rendering instead of block-pixel sprites.
- Smooth illustrated villagers with role colors, movement, work animation, selection markers and status bubbles.
- Richer meadow, organic water, paths, crops, bushes, rocks, trees, well, homes, market, smoke and atmospheric day/night lighting.
- Removal of forced `image-rendering: pixelated` styling and the Press Start 2P visual treatment.
- A larger responsive world stage and redesigned HUD/cards.
- Public branding updated from the prototype-facing “A Little World” language to Clivoria while accurately describing Civoria 0.2 and explicitly not claiming persistent AI minds are live.

Latest implementation head before this documentation commit: `8f900d41158ec9f9cc914d4586ec092c4cb1b60e`. Vercel reported the branch preview Ready at `little-world-git-beta-living-world-visuals-small-villager.vercel.app`. GitHub Beta checks run 23 completed successfully after draft PR #3 opened. Production has not been merged or changed. Do not merge PR #3 without fresh owner approval after preview review.

## Civoria 0.2 behavior now live

The browser is a viewer of one shared server-side civilization. It does not own or save the canonical world. Upstash stores the world state, Vercel serves the state/tick/heartbeat endpoints, and GitHub Actions supplies the unattended pulse.

The original engine was tuned around a 55-second internal day. `lib/world.js` now scales real elapsed time so 86,400 real seconds map to 55 internal engine seconds. This preserves the relative timing of hunger, energy, social needs, movement, work, farms, resources, aging, births and deaths while making one Civoria day approximately one real day.

`/api/heartbeat` advances the same canonical world as browser ticks. It records `lastHeartbeatAt` atomically, retries bounded write conflicts, never accepts client world state, and returns compact timing/revision/day metadata rather than the full village.

The GitHub Actions workflow `.github/workflows/heartbeat.yml` is scheduled at `2,17,32,47 * * * *`. It requests a short-lived OIDC token with audience `civoria-heartbeat`, then calls `https://www.thecivoria.com/api/heartbeat`. The server validates GitHub's signature and requires the expected repository, repository ID, owner ID, `main` ref, workflow ref, audience and permitted workflow event. A legacy `CRON_SECRET` path remains only as an optional fallback.

## Production verification completed

- PR #2 was merged only after the latest Beta tests and build passed.
- Vercel reported the production deployment for merge `1ffe7f42db1f148ba44cfe85020c9482ab6dcc97` as successful.
- GitHub Actions immediately ran the Civoria heartbeat workflow from the merge-triggered `push` event.
- That production heartbeat job completed successfully. Its log reported `Heartbeat ok: revision=236 day=88 catchUpSeconds=302.7` after one retry during the Vercel rollout race.
- The successful call proves production OIDC authentication, the `/api/heartbeat` route, Upstash read/write, and server-side advancement work independently of a browser request.
- A separate normal `schedule` event has not yet been observed. The workflow was merged seconds before the first scheduled minute, so that initial slot was not enqueued. Do not claim the recurring scheduler is fully observed until a later `schedule` run succeeds.

The world was already on Day 88 at the release heartbeat because the previous production engine advanced at the legacy fast pace whenever visitors were watching. Existing history was deliberately preserved rather than reset. From the 0.2 release onward, elapsed time uses the corrected real-time scale.

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
- `game.js` — shared-world viewer; no local canonical simulation.
- `chronicle.html` — shared Chronicle viewer.

## Safety/data guarantees

- No browser-provided state, speed, reset or clock commands are accepted.
- State writes use compare-and-swap to prevent double advancement from concurrent requests.
- Duplicate or backwards heartbeat deliveries cannot replay elapsed simulation.
- Corrupt or unsupported saved data fails closed rather than silently reseeding.
- Production and preview namespaces remain separate.
- World and initialization marker are persistent; do not delete keys to recover from an error without a reviewed restore plan.
- Chronicle is capped at 400 entries and the recent log at 40, so this is not yet a permanent historical archive.

## Services and secrets

Existing services: GitHub, Vercel and Upstash. No new paid scheduler was created for Civoria 0.2 or for the visual preview.

Upstash server variables remain managed in Vercel. Existing `ANTHROPIC_API_KEY` was not changed and is not used by the current canonical persistent engine. Never paste secret values into chats, commits or logs.

## Next exact action

1. Owner reviews the `beta/living-world-visuals` Vercel preview from draft PR #3.
2. If changes are requested, keep iterating only on that preview branch.
3. If the owner explicitly approves production release, re-check the PR head/status and merge PR #3; do not infer approval from earlier Civoria 0.2 release permission.
4. Separately, observe and record the first successful `Civoria heartbeat` run whose GitHub event is `schedule`.
5. Persistent AI minds remain a separate Civoria 0.3 milestone and should not start without owner direction.

## Coordination rule

Only one assistant should edit/deploy at a time. Before starting, read this file and current GitHub state. Before handing off, record branch/commit/PR, tests, deployment state, blockers and the exact next action. The owner's prior release approvals are not blanket permission for unrelated future features.

## Session history

- 2026-09-09 — ChatGPT traced the Vercel `little-world` deployment to `Channy337/Little-World-`, created `beta/living-world-visuals`, replaced the pixel-art presentation with an illustrated Canvas/UI pass, opened draft PR #3, confirmed Vercel preview Ready and Beta checks run 23 successful, and left production `main` untouched pending owner review.
