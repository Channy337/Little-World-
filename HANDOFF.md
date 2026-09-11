# Civoria — assistant handoff

Updated: 2026-09-11. This is the shared project checkpoint for the owner, ChatGPT/Codex, and Claude. Verify GitHub before editing and do not store secrets in this file.

## Current progress

> 2026-09-11 shelter checkpoint — Codex, branch `beta/v06-shelter`, based on V0.6 PR #22 (`dcae6e5`). Owner explicitly selected this preview base. Implemented physical wood gathering, delivery to a persisted construction site, learned timber shaping, foundation/frame/roof work, and resident move-in. Needs and fire interrupt work; deposits and carried materials survive interruption/restart. Maximum one site and two workers; owner loss reassigns the unfinished site. Viewer displays site inventory, progress, crew and work reasons, and uses canonical positions for shelter workers. 102 local tests passed (including restart, conservation, crew reservations, excess inventory, biology clock and viewer bypass); production is unchanged. No new services, accounts or environment variables. Hosted preview/visual verification is pending. Next action: publish this branch checkpoint, open a stacked PR into `beta/primitive-invention-runtime`, and verify its preview. Other activity routines retain the existing cosmetic viewer behavior; a fresh village still must discover shaping before construction starts. Earlier checkpoints below describe the parent V0.6 work, not a production release.

> 2026-09-11 checkpoint: Codex expanded draft PR #22 on `beta/primitive-invention-runtime` into the owner-approved Civoria 0.6 weather and human-biology foundation. Production remains untouched and this branch must stay preview-only until owner review. The earlier primitive-origin, hidden-matter, physical experimentation, personal knowledge, 1-real-day/1-Civoria-month, visible fire and Discovery Map work remains. Added deterministic seasonal weather with temperature, humidity, wind, rain, storms, extremes, pond/soil moisture, fire suppression and resource-growth effects; body water, glycogen, fat, muscle, core temperature and organ condition; physiology-based dehydration/starvation instead of fixed death timers; symptom-only AI access; non-invasive physical discovery of pulse and breathing; visitor weather and body-condition rendering; and removal of real-world holiday/weekday knowledge from primitive AI prompts. Direct physiology tests place ordinary no-water survival in a several-day range and no-food survival across weeks with individual fat reserves. Whole-world runs show the primitive population can persist for months but can lose people to starvation if it never develops a better food system. The existing v1 world remains recoverable and v2 is not live. Draft PR: https://github.com/Channy337/Little-World-/pull/22. Do not merge before owner preview review.

| Field | Latest checkpoint |
|---|---|
| Status | Civoria 0.6 weather, human biology, matter, knowledge-transfer and discovery-map work is implemented on draft PR #22; preview verification pending. |
| Active work | `beta/primitive-invention-runtime`; draft PR #22; do not merge or deploy production before owner preview approval. |
| Live site | https://www.thecivoria.com |
| Production branch | main; PR #7 movement release 7291ff4778d8115da86a48a85a24270813257039 |
| Two-clock verification | GitHub Beta checks run 28 passed on exact candidate `2d16d5a8baf09137cde2fd3ce841542ada25237f`; Vercel production status for merge `36ca79f8` reported success |
| Visual release | PR #5, **Release approved Clivoria living-world visuals**, merged earlier as `1facd30a1176548c6188ce74347af02552f741f2` |
| World storage | One canonical Upstash-backed world per environment |
| World pace | Candidate: 1 real day = 30 Civoria days; biological aging remains 360 Civoria days per year. Production remains unchanged. |
| Scheduler | GitHub Actions, minutes 2, 17, 32 and 47 of each hour |
| Scheduler auth | Short-lived GitHub Actions OIDC JWT; no new paid scheduler and no required static heartbeat secret |
| Catch-up fuse | Up to 7 real days per invocation; excess is discarded once and logged |
| Scheduler verification | Confirmed 2026-09-09. `Civoria heartbeat` runs #57-#62 all completed successfully with GitHub event `Scheduled` on `main`, latest at 20:16:48 CDT. Observed delivery gaps were 12-28 minutes rather than an exact 15-minute cadence; this is normal GitHub scheduler drift and is absorbed by the catch-up fuse. |
| Still pending | Hosted visual review of weather, fire, body-condition UI and Discovery Map; owner review; release authorization. |
| AI status | Persistent personal minds may hypothesize; deterministic physical rules alone create facts, resources and executable capabilities. |

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

- 2026-09-11 — Codex: owner approved starting civilization over. Implemented V0.4 primitive-origin candidate with a recoverable v2 namespace, 30 Civoria days per real day, age/calendar separation, physical experiment actions, personal repeated-evidence recipes, executable timber production, timber-backed shelters, and corresponding UI/visual changes. Published draft PR #22; Beta checks run #77 passed and Vercel preview deployment is READY but authentication-protected. Production and v1 data are unchanged.


## AI decision cost model — measured 2026-09-10

Answered. Do not re-run this. lib/engine.js was extracted from main and run directly in a sandbox: 5 villages, 90 simulated days each, 8,027 villager-days total.

Measured firing rates, per villager per day:

| Stub | Rate |
|---|---|
| requestPriorityThought | 2.35 |
| requestChatLine | 0.26 |
| requestRoleThought | 0.007 |

At 22 villagers that is 52 priority thoughts a day, 1,549 a month. At an estimated 200 input and 40 output tokens per call: about $0.60/month on Haiku 4.5, $1.25 on Sonnet 5, $3.10 on Opus 5. The token count is an estimate, not a measurement; the villager state JSON is 275 characters. Everything else is measured. Treat these figures as a ceiling.

Corrections to earlier sessions. First, requestChatLine is NOT the cost risk: priority thoughts outnumber chat lines 9 to 1, because the social meter is a tighter brake than the cooldown. Second, do not feed the engine large dt: lib/world.js caps every step at ENGINE_STEP_SECONDS = 0.1 and the engine assumes it. Third, calling the AI on every decision rather than on the cooldown is 13x more calls, 690 a day at 22 villagers, roughly $8/month on Haiku, $17 on Sonnet 5 and $41 on Opus 5; population caps at 34.

Decision: proceed with AI villagers on Haiku 4.5, aiCooldown unchanged. Cost is not a blocker.

Session note, 2026-09-10 (Claude): documentation only. No code, branch, deployment or canonical state change.
