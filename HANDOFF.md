# Civoria — assistant handoff

Updated: 2026-09-09. This is the shared project checkpoint for the owner, ChatGPT/Codex, and Claude. Verify GitHub before editing and do not store secrets in this file.

## Current progress

| Field | Latest checkpoint |
|---|---|
| Status | Owner approved the stronger second-pass 2.5D visual redesign for production rollout; final CI gate is being retriggered before merge |
| Live site | https://www.thecivoria.com |
| Production branch | `main` at `14449c3a22834dee69ad926181114da1f9c67156`; unchanged until PR #3 merges |
| Active visual work | `beta/living-world-visuals`, PR #3; presentation-only living-world redesign |
| Current visual head before this checkpoint | `baefe2b16690f4e842f7ea6331a7dc94e3d714fb` |
| Visual preview | `https://little-world-git-beta-living-world-visuals-small-villager.vercel.app` |
| Visual preview verification | Vercel reports the approved preview Ready. Previous Beta checks passed before the final presentation commits; this checkpoint is intended to retrigger full `npm test` + `npm run build` against the final candidate before merge. |
| Owner approval | Explicit production rollout approval received 2026-09-09 after owner reviewed the stronger preview; yellow “Enter the living world” CTA removed before approval |
| Civoria 0.2 release | PR #2 merged as `1ffe7f42db1f148ba44cfe85020c9482ab6dcc97` |
| World storage | One canonical Upstash-backed world per environment |
| World pace | Approximately 1 Civoria day = 1 real day |
| Scheduler | GitHub Actions, minutes 2, 17, 32 and 47 of each hour |
| Scheduler auth | Short-lived GitHub Actions OIDC JWT; no new paid scheduler and no required static heartbeat secret |
| Catch-up fuse | Up to 7 real days per invocation; excess is discarded once and logged |
| Still pending | Fresh Beta checks for the final approved visual head, production merge/deployment verification, observe at least one heartbeat run whose GitHub event is `schedule`; server-side AI minds remain deferred to Civoria 0.3 |
| AI status | Persistent villagers currently use deterministic built-in instincts. Anthropic decision calls are intentionally disabled in the canonical engine. |

## Approved visual rollout — 2026-09-09

The owner reviewed the stronger `beta/living-world-visuals` preview and explicitly approved rolling it to production. The final approved presentation includes removal of the yellow “Enter the living world” CTA.

The visual branch changes only presentation files and this handoff note. It does not modify `lib/`, `/api`, Upstash configuration, heartbeat scheduling, canonical world state, or simulation mechanics.

Approved visual changes include:

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

## Civoria 0.2 behavior now live

The browser is a viewer of one shared server-side civilization. It does not own or save the canonical world. Upstash stores the world state, Vercel serves the state/tick/heartbeat endpoints, and GitHub Actions supplies the unattended pulse.

The original engine was tuned around a 55-second internal day. `lib/world.js` scales real elapsed time so 86,400 real seconds map to 55 internal engine seconds. This preserves the relative timing of hunger, energy, social needs, movement, work, farms, resources, aging, births and deaths while making one Civoria day approximately one real day.

`/api/heartbeat` advances the same canonical world as browser ticks. It records `lastHeartbeatAt` atomically, retries bounded write conflicts, never accepts client world state, and returns compact timing/revision/day metadata rather than the full village.

The GitHub Actions workflow `.github/workflows/heartbeat.yml` is scheduled at `2,17,32,47 * * * *`. It requests a short-lived OIDC token with audience `civoria-heartbeat`, then calls `https://www.thecivoria.com/api/heartbeat`. The server validates GitHub's signature and requires the expected repository, repository ID, owner ID, `main` ref, workflow ref, audience and permitted workflow event. A legacy `CRON_SECRET` remains supported as an optional fallback.

## Production verification completed for Civoria 0.2

- PR #2 was merged only after the latest Beta tests and build passed.
- Vercel reported the production deployment for merge `1ffe7f42db1f148ba44cfe85020c9482ab6dcc97` as successful.
- GitHub Actions immediately ran the Civoria heartbeat workflow from the merge-triggered `push` event.
- That production heartbeat job completed successfully. Its log reported `Heartbeat ok: revision=236 day=88 catchUpSeconds=302.7` after one retry during the Vercel rollout race.
- A separate normal `schedule` event has not yet been observed. Do not claim the recurring scheduler is fully observed until a later `schedule` run succeeds.

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

Existing services: GitHub, Vercel and Upstash. No new paid service was created for Civoria 0.2 or the visual rollout.

Upstash server variables remain managed in Vercel. Existing `ANTHROPIC_API_KEY` was not changed and is not used by the current canonical persistent engine. Never paste secret values into chats, commits or logs.

## Next exact action

1. Confirm fresh Beta checks pass on the final approved PR #3 head and Vercel preview remains Ready.
2. Merge PR #3 to `main` using the exact expected head SHA.
3. Confirm Vercel production deployment is Ready and `https://www.theclivoria.com` serves the approved living-world visuals.
4. Record the production merge/deployment checkpoint in this handoff.
5. Separately, observe and record the first successful `Civoria heartbeat` run whose GitHub event is `schedule`.
6. Persistent AI minds remain a separate Civoria 0.3 milestone and should not start without owner direction.

## Coordination rule

Only one assistant should edit/deploy at a time. Before starting, read this file and current GitHub state. Before handing off, record branch/commit/PR, tests, deployment state, blockers and the exact next action.

## Session history

- 2026-09-09 — ChatGPT traced the Vercel `little-world` deployment to `Channy337/Little-World-`, created `beta/living-world-visuals`, replaced the pixel-art presentation with an illustrated Canvas/UI pass, opened PR #3, confirmed Vercel preview Ready and Beta checks successful, and left production untouched.
- 2026-09-09 — At the owner's request, ChatGPT pushed the real renderer substantially further: perspective 2.5D camera, distant landscape layers, stronger buildings/citizen variation, depth sorting and atmospheric animation.
- 2026-09-09 — Owner requested removal of the yellow “Enter the living world” CTA, reviewed the updated preview, then explicitly approved production rollout. Final CI and production deployment verification are now in progress.
