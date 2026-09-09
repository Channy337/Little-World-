# Civoria — assistant handoff

Updated: 2026-09-09. This is the shared project checkpoint for the owner, ChatGPT/Codex, and Claude. Verify GitHub before editing and do not store secrets in this file.

## Current progress

| Field | Latest checkpoint |
|---|---|
| Status | Civoria 0.2 remains released to production; a much stronger second-pass 2.5D visual redesign is live only on the preview branch for owner review |
| Live site | https://www.thecivoria.com |
| Production branch | `main` at `14449c3a22834dee69ad926181114da1f9c67156`; unchanged by visual preview work |
| Active visual work | `beta/living-world-visuals`, draft PR #3; presentation-only living-world redesign |
| Current visual head | `8aab81e1cd8aa69b22b77b865c05b7606312c528` |
| Visual preview | `https://little-world-git-beta-living-world-visuals-small-villager.vercel.app` |
| Visual preview verification | Vercel reports the current head Ready; `game.js` passed local `node --check`. GitHub Beta checks run 24 passed on the immediately previous preview checkpoint `a875e973`; no new Beta-check run was enqueued for the `8aab81e1` presentation-only commit, so fresh full CI is still required before any production merge. |
| Civoria 0.2 release | PR #2 merged as `1ffe7f42db1f148ba44cfe85020c9482ab6dcc97` |
| World storage | One canonical Upstash-backed world per environment |
| World pace | Approximately 1 Civoria day = 1 real day |
| Scheduler | GitHub Actions, minutes 2, 17, 32 and 47 of each hour |
| Scheduler auth | Short-lived GitHub Actions OIDC JWT; no new paid scheduler and no required static heartbeat secret |
| Catch-up fuse | Up to 7 real days per invocation; excess is discarded once and logged |
| Still pending | Owner review/approval of the stronger visual preview; fresh Beta checks before any merge; observe at least one heartbeat run whose GitHub event is `schedule`; server-side AI minds remain deferred to Civoria 0.3 |
| AI status | Persistent villagers currently use deterministic built-in instincts. Anthropic decision calls are intentionally disabled in the canonical engine. |

## Active visual preview — second pass, 2026-09-09

The owner asked to push the art much harder but explicitly not to generate a concept image. All work therefore remains in the actual simulation renderer on `beta/living-world-visuals`; production `main` is untouched.

The first pass removed the block-pixel rendering and established an illustrated Canvas/UI treatment. The second pass at `8aab81e1cd8aa69b22b77b865c05b7606312c528` changes the camera language and composition much more aggressively while preserving the exact canonical simulation state and coordinates.

Second-pass changes in `game.js` include:

- Perspective projection from the existing 480×304 simulation coordinate system into a taller 2.5D scene with a horizon and depth scaling.
- Distant sky, sun/moon, mountains, layered forest line, moving clouds and birds.
- A perspective meadow instead of a rectangular board, with depth-scaled ground texture and flowers.
- Perspective-scaled paths, pond, farms, resources, well, homes, market, villagers and click hit-testing; simulation coordinates themselves are unchanged.
- Depth sorting across villagers, buildings, trees, rocks, bushes and the well so foreground objects naturally overlap background objects.
- Larger and more varied homes with multiple palettes, fences/gardens, roof/wall detail, chimney smoke and night-window glow.
- A more substantial market with crates, produce, awning, flag and hanging lanterns.
- More distinctive villagers using deterministic visual variation only: multiple skin tones, hair colors/styles and role-specific silhouettes/accessories such as farmer hats, miner helmets, trader satchels and woodcutter accents. These are presentation details and do not change identity, traits or behavior.
- Animated breeze, drifting particles, dawn fog, fireflies, dusk/dawn color treatment, night lighting and foreground vegetation framing.
- Share-card rendering updated to the taller visual scene.

The branch preview deployment for this head is Ready in Vercel. Local JavaScript syntax validation passed with `node --check`. The repository's latest automated Beta checks are still run 24 from the immediately previous visual checkpoint; since no new run was enqueued for the second-pass game-only commit, rerun or retrigger full Beta checks before any merge to production.

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
- A separate normal `schedule` event has not yet been observed. Do not claim the recurring scheduler is fully observed until a later `schedule` run succeeds.

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

## Services and secrets

Existing services: GitHub, Vercel and Upstash. No new paid service was created for Civoria 0.2 or the visual preview.

Upstash server variables remain managed in Vercel. Existing `ANTHROPIC_API_KEY` was not changed and is not used by the current canonical persistent engine. Never paste secret values into chats, commits or logs.

## Next exact action

1. Owner reviews the current `beta/living-world-visuals` Vercel preview, specifically the stronger second-pass 2.5D renderer.
2. If the owner dislikes it, keep iterating only on the preview branch or revert the second pass; production remains unaffected.
3. If the owner explicitly approves production implementation, first retrigger fresh Beta checks for the current head and confirm Vercel Ready, then merge only after those checks pass.
4. Separately, observe and record the first successful `Civoria heartbeat` run whose GitHub event is `schedule`.
5. Persistent AI minds remain a separate Civoria 0.3 milestone and should not start without owner direction.

## Coordination rule

Only one assistant should edit/deploy at a time. Before starting, read this file and current GitHub state. Before handing off, record branch/commit/PR, tests, deployment state, blockers and the exact next action. The owner's prior release approvals are not blanket permission for unrelated future features.

## Session history

- 2026-09-09 — ChatGPT traced the Vercel `little-world` deployment to `Channy337/Little-World-`, created `beta/living-world-visuals`, replaced the pixel-art presentation with an illustrated Canvas/UI pass, opened draft PR #3, confirmed Vercel preview Ready and Beta checks successful, and left production untouched.
- 2026-09-09 — At the owner's request, ChatGPT pushed the real renderer substantially further on the same preview branch: perspective 2.5D camera, distant landscape layers, stronger buildings/citizen variation, depth sorting and atmospheric animation. Current visual head `8aab81e1`; Vercel Ready; production still untouched pending owner review.
