# Civoria — assistant handoff

Updated: 2026-09-09. This is the shared project checkpoint for the owner, ChatGPT/Codex, and Claude. Verify GitHub before editing and do not store secrets in this file.

## Current progress

| Field | Latest checkpoint |
|---|---|
| Status | Civoria 0.3 villager cognition implemented by Claude; PR #8 open on `beta/civoria-0.3-ai-cognition`, all 3 Beta checks passed, Vercel preview deployed successfully. Awaiting owner review of the live preview and merge decision. Not yet in production. |
| Active work | PR #8, three commits (`lib/engine.js` rewrite, new `lib/ai.js`, `lib/world.js` edit). Owner has not yet reviewed the preview or merged. |
| Live site | https://www.thecivoria.com (still running 0.2 deterministic instincts — PR #8 not merged) |
| Production branch | main; last production merge remains PR #7 (`7291ff47`) |
| World storage | One canonical Upstash-backed world per environment |
| World pace | Approximately 1 Civoria day = 1 real day; unchanged by PR #8 |
| Scheduler | GitHub Actions, minutes 2, 17, 32 and 47 of each hour |
| Scheduler auth | Short-lived GitHub Actions OIDC JWT; legacy `CRON_SECRET` fallback supported |
| Catch-up fuse | Up to 7 real days per invocation; excess is discarded once and logged |
| AI status | Still deterministic instincts in production. PR #8 (unmerged) adds real Anthropic-backed cognition for the `priority` (focus + first-person thought) and `chat` (narrated conversation line) hooks; the third original hook, `requestRoleThought`, is deliberately left a no-op in this first cut. |
| Still pending | Owner review of PR #8's Vercel preview (specifically: confirm a villager's card shows a real `aiThought`, since the frontend hook for this already existed unchanged); then merge decision. After merge: watch console.anthropic.com usage for a few days against the $5 cap to validate the real cost. |

## Civoria 0.3 villager cognition — PR #8 opened, not yet merged (2026-09-09)

Owner asked to bring AI decisions back, but wanted real cost visibility first. Claude modeled cost against the actual 0.2 real-time-scaled architecture (not the original pixel-art browser cadence): each villager's existing `aiCooldown` (16–26 *internal* seconds, already present but unused in `decide()`) lands at roughly once per 8–9 *real* hours per villager at the current ~1 day/day pace, implying on the order of 40–70 Anthropic calls/day total for the whole shared world regardless of visitor count (~$1.50–$2.70/month on Haiku). Owner approved building it on that basis.

Claude read the actual current `lib/engine.js`, `lib/world.js`, `lib/heartbeat` path and `vercel.json` directly from GitHub (via a connected browser) before writing any code, rather than assuming — confirming the three AI hooks (`requestPriorityThought`, `requestChatLine`, `requestRoleThought`) already existed as no-ops from 0.2, and that `game.js`'s `updateHUD()` already renders `a.aiThought` in the villager card unchanged, so **no frontend work was needed.**

**Implementation, isolated as instructed:**
- `lib/engine.js`: the three no-op hooks now push structured requests onto a module-scoped `aiQueue` (guarded by the existing `a.aiPending` flag so nothing double-queues). New exports `drainAIRequests()` and `applyAIResults(queue, priorityResults, chatResults)` let the caller resolve requests outside the synchronous stepping loop. No canonical timing, mechanics, or existing behavior changed for anything else.
- `lib/ai.js` (new): the only file touching `ANTHROPIC_API_KEY`. Model `claude-haiku-4-5-20251001`, capped at 20 resolutions per invocation, every failure mode (missing key, network error, bad JSON) resolves to `null` rather than throwing — `applyAIResults` already treats a missing result as "keep deterministic behavior."
- `lib/world.js`: one insertion point in `tick()`, between `advanceEngine()` and `engine.snapshot()` — drains the queue, awaits `resolveBatch()`, applies results, then proceeds exactly as before (validation via `decode()`, compare-and-swap, logging) unchanged.

**A real bug caught and fixed before this ever reached GitHub:** the first draft deferred a socialize interaction's log line to be resolved in the same tick as its AI request, copying the pattern from Claude's own earlier (unmerged) browser-based prototype. Verified against the real `advanceEngine`/heartbeat cadence, one heartbeat (15 real minutes) only advances the simulation ~0.57 internal seconds, while a socialize action lasts ~3 internal seconds — so a conversation almost always spans 5+ separate heartbeat invocations, each of which creates a fresh `engine` from saved state. The same-tick assumption would have made every AI-written chat line silently discard itself in production. Fixed by writing the resolved line straight onto the persisted `a.action.chatLine` (keyed by a `chatId` set at request time) — the existing, *unmodified* completion check already reads that field whenever the interaction naturally ends, however many ticks later that is.

**Testing performed (isolated sandbox, mocked KV + mocked Anthropic, before any GitHub commit):**
- Engine stability over 65+ simulated days with the new queuing plumbing — no regressions vs. pre-0.3 behavior.
- Full `createWorldService` integration test simulating 200 heartbeats at real 15-minute spacing: confirmed multiple conversations resolved with the *real* AI-written line (not the canned fallback) despite spanning multiple heartbeats — this is the test that would have caught the bug above.
- Graceful degradation: no `ANTHROPIC_API_KEY` set at all, and separately, every AI call throwing — both cases produce a normal-looking world with zero `aiThought`s set and no crashes or stuck `aiPending` flags.
- `decode()`'s strict state validator was not touched and did not reject states carrying the (already-existing) `aiFocus`/`aiThought`/`aiPending`/`aiCooldown` agent fields.

**How the branch/PR got created:** Claude has no GitHub API/CLI access this session (no GitHub connector exists in its toolset) — files were written via a connected Chrome browser automating GitHub's own web editor (clipboard-paste into the CodeMirror editor, verified by screenshot after each paste, one commit per file) directly onto a new branch `beta/civoria-0.3-ai-cognition`, then PR #8 opened against `main`. This is slower than CLI/API access but exercises the exact same GitHub UI the owner uses.

### PR #8 verification so far
- Branch: `beta/civoria-0.3-ai-cognition`.
- PR: #8, three commits (`562eede` engine.js, `c3f6e8e` ai.js, `d74ef75` world.js), all showing Verified.
- GitHub Beta checks: **3 successful checks, all passed.**
- Vercel preview: deployed successfully, no merge conflicts with `main`.
- **Not yet reviewed by the owner on the live preview. Not merged. Not in production.**

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

- `lib/engine.js` — deterministic village simulation and original built-in instincts. **PR #8 (unmerged) adds AI request queuing (`drainAIRequests`/`applyAIResults`) to the three previously no-op hooks.**
- `lib/ai.js` — **new in PR #8 (unmerged).** The only file touching `ANTHROPIC_API_KEY`; resolves queued cognition requests against Claude Haiku.
- `lib/store.js` — Upstash REST persistence, initialization and compare-and-swap.
- `lib/world.js` — canonical world service, real-time scaling, seven-day catch-up fuse and heartbeat metadata. **PR #8 (unmerged) inserts one AI-resolution step between stepping and snapshotting.**
- `lib/http.js` — HTTP guards and scheduler authentication.
- `lib/github-oidc.js` — GitHub Actions OIDC signature and claim validation.
- `api/state.js` — read shared state.
- `api/tick.js` — browser/server tick path.
- `api/heartbeat.js` — unattended advancement endpoint.
- `.github/workflows/heartbeat.yml` — recurring production heartbeat.
- `.github/workflows/test.yml` — Beta test/build checks.
- `SCHEDULING.md` — scheduler design and release notes.
- `activity-clock.js` — browser-only visible activity layer; must never write canonical state.
- `game.js` — shared-world viewer and visual renderer; no local canonical simulation. Already renders `a.aiThought` unchanged — confirmed by Claude before starting PR #8, so no frontend change was needed.
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
- PR #8 (unmerged): any AI failure degrades silently to the pre-existing deterministic instincts; no tick can fail because of the AI layer.

## Services and secrets

Existing services: GitHub, Vercel and Upstash. No new paid service was created for Civoria 0.2, the visual release, the activity-clock fix, or PR #8.

Upstash server variables remain managed in Vercel. Existing `ANTHROPIC_API_KEY` was not changed. As of PR #8 (unmerged), once merged this key will be actively used by `lib/ai.js` for the first time since 0.2 disabled it — owner should watch console.anthropic.com usage for a few days after merging. Never paste secret values into chats, commits or logs.

## Next exact action

1. **Owner: open PR #8's Vercel preview and watch it for a few minutes.** Tap a villager and confirm their card shows a real quoted `aiThought` (may take a while to appear given the ~8-9 real hour per-villager cadence — the preview world may need to accumulate some time, or the owner can trust the isolated test results if nothing shows up quickly in a short preview session).
2. If satisfied, merge PR #8 via the normal button — no code changes needed first, checks already pass and there are no conflicts with `main`.
3. After merging, watch console.anthropic.com's usage dashboard for a few days to validate the estimated $1.50–$2.70/month cost against real usage.
4. `requestRoleThought` remains a no-op — a reasonable, low-priority future addition, not required for 0.3 to be considered complete.

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
- 2026-09-09 — Claude: owner asked to bring AI decisions back with real cost visibility first. Claude modeled cost against the true 0.2 real-time-scaled cadence (not the original browser cadence), estimated ~40-70 calls/day (~$1.50-2.70/month) for the whole shared world regardless of visitor count, and got owner approval on that basis. Read the real `lib/engine.js`/`lib/world.js`/`vercel.json` from GitHub via a connected browser before writing anything (no GitHub API/CLI access this session). Implemented AI request queuing in the three pre-existing no-op hooks, a new isolated `lib/ai.js`, and one insertion point in `lib/world.js`'s `tick()`. Caught and fixed a real bug pre-commit: a conversation's AI line was assumed resolvable within one tick, but at this world's real pace a ~3-second conversation spans 5+ separate heartbeats, so the fix persists the resolved line onto `a.action.chatLine` directly (read by the existing, unmodified completion check) instead of a same-tick deferred log. Verified via isolated engine tests, a 200-heartbeat integration test proving the fix works across real tick boundaries, and two degraded-mode tests (no key; all calls failing) confirming clean fallback with no crashes. Confirmed `game.js` already renders `aiThought` unchanged — no frontend work needed. Built the branch/PR entirely through GitHub's web UI via a connected Chrome browser (clipboard-paste per file, screenshot-verified). Opened PR #8 on `beta/civoria-0.3-ai-cognition`; all 3 Beta checks passed, Vercel preview deployed successfully, no conflicts with `main`. **Not yet reviewed on the live preview or merged — owner's explicit next action.**
