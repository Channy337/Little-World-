# Civoria — assistant handoff

Updated: 2026-09-08. Prepared by Codex for the owner and Claude.
This is a project status record, not permission to deploy or change accounts. Follow the owner's current instructions and verify the current repository before editing.

## Current progress

| Field | Latest checkpoint |
|---|---|
| Updated | 2026-09-08; see Git commit timestamp for exact time |
| Last assistant | Codex |
| Status | Preview heartbeat code ready; awaiting scheduler/pace choices and service setup |
| Last completed task | Released persistent-world Beta; added shared progress and assistant startup instructions |
| Production | main; milestone release af3804602839b888bc4adcf52ebf5c6e5dd4ff2e; later commits are documentation |
| Work branch / PR | beta/unattended-world; draft PR #2 https://github.com/Channy337/Little-World-/pull/2; implementation 160c46e0b6d8444c3c6eedc091c3cfaeb1f21aa0 |
| Completed verification | 24 local tests pass and static build succeeds for heartbeat branch; previous production verification retained below |
| Not implemented | External scheduler activation/hosted heartbeat verification, pace adjustment, server-side AI decisions, Civoria UI rebranding |
| Next action | Resolve pending owner scheduler/pace choices; configure preview CRON_SECRET and scheduler; verify two automatic deliveries with all viewer pages closed. See branch SCHEDULING.md. Do not release yet. |
| Access | GitHub works; Vercel connector team scope failed, but owner's signed-in browser worked |
| Local-only work | Old Codex Beta checkout may lag main and contains a verification-document edit; inspect it before reuse |
| Claude checkpoint | No Claude progress report received yet; do not infer Claude has read this |

Each assistant replaces this table with its latest checkpoint and appends a short entry to Session history. Check both main and any active work branch before resuming.

## Session history

- **2026-09-08 — Codex:** Prepared authenticated heartbeat on beta/unattended-world, draft PR #2. Added api/heartbeat.js, test/heartbeat.test.js, SCHEDULING.md; edited lib/world.js and lib/http.js. All 24 tests and build pass locally. No scheduler, credentials, account or production change activated. Hosted testing and pace adjustment unfinished. Local worktree Little-World-unattended contains the same five published file changes; original checkout preserved.

- **2026-09-08 — Codex:** Persistent-world milestone released through PR #1, production verified. Created HANDOFF.md, then AGENTS.md and CLAUDE.md startup instructions. No new feature work active. Next milestone awaits owner direction. No secrets added.
- **Claude:** No session entry received yet.

## Start here

- Repository: https://github.com/Channy337/Little-World-
- Live site: https://www.thecivoria.com
- Production branch: main.
- Released milestone: PR #1, https://github.com/Channy337/Little-World-/pull/1
- Verified release merge: af3804602839b888bc4adcf52ebf5c6e5dd4ff2e.
- Preview branch: beta/persistent-world.
- Preview: https://little-world-git-beta-persistent-world-small-villager.vercel.app/
- Vercel team/project: Small Villager (small-villager) / little-world; Hobby plan at last inspection.
- Domain registrar: GoDaddy. The owner configured the domain for Vercel.
- Read this file, README.md, VERIFICATION.md, current Git status and recent commits before proceeding.
- Earlier statements in README, VERIFICATION, and PR #1 saying production is unchanged or release is pending describe earlier checkpoints. The owner subsequently approved release; PR #1 is merged and the production site was verified.

## What is live

One canonical world per environment is persisted in the existing Upstash Redis integration. The frontend and Chronicle use server data instead of browser world saves. Existing pixel art, scenery, villager cards, and sharing were retained. Production started a fresh shared village with nine settlers; preview data was deliberately not imported. Existing localStorage saves were left untouched.

The production site was observed showing Shared world · Live on Day 1 with nine settlers after release. Its Chronicle showed the same settlers and initial history. This is an observation at release, not the current population.

## File map

Added:
- lib/engine.js: original simulation extracted into request-local server code; persisted deterministic random sequence; reconnects market/building identity after JSON restoration.
- lib/store.js: authenticated Upstash REST, four-second request timeout, primary reads through EVAL, atomic initialization and compare-and-swap.
- lib/world.js: schema/version/revision, validation, server elapsed time, fixed steps, bounded catch-up and structured logs.
- lib/http.js: method/body/origin checks, scheduler authentication, no-store responses and sanitized error IDs.
- api/state.js: GET shared state; safe first-use initialization.
- api/tick.js: POST advances elapsed time and returns shared state; authenticated GET supports a future scheduler.
- package.json: Node 24; test/build/dev scripts; no third-party production packages.
- vercel.json: static output and Node functions, 30-second max duration.
- scripts/build.js: copies only index.html, chronicle.html, game.js, styles.css to public/.
- scripts/dev.js: explicit local memory-only test server; never imported by production handlers.
- test/helpers.js, test/world.test.js: test store and 19 tests.
- .gitignore: excludes credentials, generated output, dependencies and test artifacts.
- VERIFICATION.md: verification timeline and limitations.

Edited:
- game.js: viewer of server snapshots; visible-page polling every five seconds, interpolated drawing, stale-state/retry messages. No local simulation or persistence.
- chronicle.html: shared history reads every 15 seconds.
- index.html: shared-world description/status, removed public reset/pause/speed controls.
- api/decide.js: old public AI route disabled; returns an explicit fallback.
- README.md: architecture, setup, clock behavior, limitations and rollback.

No tracked files deleted. styles.css retained. HANDOFF.md is documentation added after the release.

## Timing and data guarantees

- Fixed simulation step: 100 ms; minimum advance interval: five seconds.
- Maximum advance per invocation: 120 simulated seconds. Longer elapsed gaps are discarded once and logged as skippedMs, rather than replayed indefinitely.
- No background scheduler configured. Visits wake the simulation; saved data persists while nobody visits.
- Two requests can compute simultaneously; compare-and-swap allows only one to commit the same starting state.
- No client-provided world, reset, speed or clock is accepted.
- State and initialization marker have no application TTL. If state is missing but its marker remains, fail rather than silently reseed.
- Corrupt/unsupported records fail closed. Do not delete keys to clear an error.
- Both state and marker being deleted cannot be distinguished from first initialization.
- Chronicle capped at 400 entries, recent log at 40. Not an unlimited historical archive.
- Production namespace: little-world:{production}:v1.
- Preview namespace is derived from a hash of VERCEL_GIT_COMMIT_REF; each branch is isolated and survives redeployment.
- Development namespace is separate. Never point a preview at production keys.

## Services and secrets

Uses existing GitHub, Vercel and Upstash accounts. No new paid service/account was created.

Server variables:
- KV_REST_API_URL and KV_REST_API_TOKEN, OR
- UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
- VERCEL_ENV and VERCEL_GIT_COMMIT_REF are Vercel system metadata.
- CRON_SECRET is optional for a future authenticated GET /api/tick scheduler. It was not configured by Codex.
- Existing ANTHROPIC_API_KEY was not changed. Current release does not call Claude.

Never paste secret values into this file, chats, logs or commits. Do not use the read-only Redis token for writes. No secret values are needed for a handoff.

GitHub write access now works. Codex's Vercel connector continued returning 403 for small-villager, but the owner's signed-in in-app browser successfully accessed deployment pages and runtime logs. This was not evidence that Claude's access blocked Codex; each assistant has its own authorization.

## Validation completed

- 19 local Node tests: first-use races, concurrent ticks, repeated calls, catch-up, clock reversal, read-only retrieval, restart, invalid/missing data, failed writes, namespace isolation, market identity, long-run bounds, REST adapter shape/error redaction and HTTP guards.
- Local desktop/mobile Chrome checks with independent browser contexts: matching state, old browser save ignored/preserved, no new local save, rendering, shared Chronicle, recovery from injected HTTP 503, no page errors.
- Hosted preview reload retained world and Chronicle.
- Fresh preview deployment 6xUaD2DybiRYgSW8yv8ugS2TxVe2 at commit b45efe4 retained original history and homes. Its unique URL and branch URL showed the same world.
- Runtime logs on that deployment showed HTTP 200 state/tick responses and world_tick revision 118; inspected window had zero warning/error/fatal counts.
- Owner confirmed phone and desktop match when both use the Beta URL. Initial mismatch was because the phone opened the old production site instead.
- PR #1 was merged only after the owner's explicit release approval.
- Production deployment 97e23muNdW9UQabi4hvGqS7PGY3U reported success; live domain and production Chronicle verified.

Limits: local Redis adapter tests are mocked, hosted destructive database fault injection was not performed, and log observations cover a bounded window. No claim of a full reliability/load audit.

## Deferred work and suggested next step

1. Inspect current implementation and report findings before editing. This handoff does not start a new feature.
2. Discuss unattended ticking with the owner: desired real-world pace, lifecycle/starvation implications, scheduler cadence, hosting plan and budget. Research current limits before selecting a scheduler.
3. Restore AI only as bounded server-side decisions with validation, timeouts, a spending budget and persistence coordinated with canonical state. Do not re-enable per-visitor paid AI requests.
4. Consider durable long-term history/backups, operational monitoring and abuse controls. Public polling still consumes database/hosting resources.
5. Civoria branding is not implemented: the UI still says A Little World. Confirm desired branding scope before changing it.
6. Keep documentation aligned with the current release.

## Coordination protocol for Claude and Codex

- Neither assistant can assume access to the other's private chat history.
- The owner chooses which assistant is active; only one should edit/merge/deploy at a time.
- Before starting: read this file, inspect main and open PRs, check local uncommitted work, and state the task you are taking.
- Use a feature/preview branch for new implementation. Preserve production data and test before release.
- Do not treat the previous release approval as blanket authorization for new features or deployments.
- Before handing off: record changed files, branch/commit/PR, test evidence, uncommitted changes, blockers, and the exact next action.
- Do not store auth tokens or request a teammate to copy secrets.
- Ask the owner to resolve conflicting edits rather than overwriting another assistant's work.

## Current handoff checkpoint

Last completed task: released persistent-world milestone, then prepared this handoff.
Next owner decisions: scheduler provider and village pace; pending questions propose QStash every two minutes and one village day per real hour.
Unattended heartbeat preparation is saved in draft PR #2; scheduler activation and pace choice remain unfinished. Production is unchanged.
The owner has not yet confirmed that Claude has read this document.

Local-only recovery artifacts from the Codex workspace: full-history Little-World-beta.bundle and preserved/pre-beta-2026-09-07 tag at baseline b878762e1bd431ee691929b223b3534097c8ed6c. The original local bundle predates later verification commits and production merge; use GitHub for latest history. A local checkout may remain on the old Beta commit with a documentation edit; do not assume it matches origin/main.

## Template for the next handoff

- Updated (date/time):
- Active assistant / owner-assigned task:
- Branch and last commit:
- PR / deployment URL:
- Changed files and behavior:
- Checks run and results:
- Uncommitted work:
- Remaining work / blocker:
- Exact next action:
- Production/data changes, if any:
