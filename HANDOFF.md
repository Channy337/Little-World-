# Civoria — assistant handoff

Updated: 2026-09-12 CDT / 2026-09-13 UTC. This is the shared checkpoint for the owner and any coding assistant. Verify GitHub and production before editing.

## Current progress

- **Canonical project name: Civoria.** Do not use `Clivoria`, `CLIVORIA`, or `A Little World` as the public/project name.
- Live site: `https://www.thecivoria.com` / `https://thecivoria.com`
- Repository: `Channy337/Little-World-`
- Production branch: `main`
- Current production release: **V0.12.2**
- V0.12.2 release merge: `cf22a49c8abacf9419e6f31911723ca010ee2e60`
- V0.12.2 production deployment: `dpl_6PsZvLh66P8N2s4EXA2UsNZbK9LW` — **READY**
- PR #33 is merged.
- Live production was fetched successfully and serves the corrected `Civoria` branding and V0.12.2.
- Production runtime error/warning/fatal check after release returned no matching logs.
- No implementation task is currently active.

### Naming rule

`Civoria` is the one true public/project name. V0.12.2 replaced legacy visitor-facing `Clivoria`, `CLIVORIA`, `A Little World`, and `clivoria-day*.png` strings with Civoria equivalents.

Do **not** blindly rename technical infrastructure identifiers. The GitHub repository remains `Channy337/Little-World-`, and persistence/deployment identifiers containing `little-world` are intentionally preserved because changing them could break GitHub/Vercel integration or disconnect the existing saved world. `test/branding.test.js` permanently guards this distinction.

## Released system state

### V0.11 — living planet foundation

Released and merged. Major additions:

- **1 real hour = 1 Civoria month** (30 Civoria days per real hour)
- biological aging remains 360 Civoria days per biological year
- deterministic Earth-like continent, terrain, rivers, groundwater, soils, climate and derived biomes
- climate-aware weather, including severe weather and coastal hurricane conditions
- physical plant pieces/seeds, germination and personally discovered cultivation
- canonical fish, deer, rabbit, fox and songbird populations
- grounded `place` and `bury` experimentation
- read-only Jarvis-style Civorian Life Profile
- Living Planet Observer
- personal Civorian knowledge remains separate from observer analysis and hidden deterministic world truth

### V0.12 — physical shelter construction

Released from PR #31. The useful shelter ideas from old PR #23 were rebuilt on top of the modern simulation rather than merging the obsolete V0.6 branch.

Current shelter behavior:

- no instant-house shortcut
- persistent construction sites
- actual wood gathering and delivery
- timber shaping must be personally discovered/learned
- construction expertise can build a shelter for a different future resident
- staged foundation → frame → roof work
- up to two coordinated workers
- urgent needs can interrupt work without deleting delivered materials
- partial sites survive persistence/restarts
- resident physically moves into a finished shelter
- construction workers use canonical server positions

**Do not merge old PR #23.** It is obsolete historical work now that its shelter concept has been integrated properly in V0.12.

Owner presentation decision: the large permanent **Shelter Project** panel should not be treated as a main visitor attraction. The shelter mechanic stays. Future UI work should make construction feel natural in-world, with detailed status available contextually through a clicked site/Civorian or observer/debug view, and major milestones surfaced through World News/Chronicle.

### V0.12.1 — ambient instrumental music

Released from PR #32.

- optional visitor-only instrumental ambience
- generated locally with Web Audio, not an external/licensed song file
- visitor must tap the music control to start because iPhone/modern browsers block unsolicited autoplay
- quiet default volume and volume slider
- music has no effect on canonical simulation state

### V0.12.2 — canonical Civoria branding

Released from PR #33.

- homepage title, metadata, navigation, hero, About and Share text use `Civoria`
- Discoveries uses `Civoria`
- Chronicle legacy `A Little World` branding was replaced with `Civoria`
- generated share cards and Web Share text use `Civoria`
- downloaded moment screenshots now use `civoria-day*.png`
- permanent regression test prevents legacy public names from returning
- technical repository/persistence identifiers were deliberately left unchanged
- exact-head Beta checks run #153 passed
- Vercel preview was READY and verified before merge
- production deployment was READY and live verification passed

## Core invariants

- Preserve the existing canonical production world. Never reset or reseed it to solve an implementation problem.
- Browser/UI layers are observers/presentation. Canonical facts and outcomes remain server-owned.
- Persistent personal minds may hypothesize; deterministic physical rules create facts, resources, executable capabilities and consequences.
- Do not give Civorians omniscient map/scientific/medical knowledge they did not personally sense, discover, remember, reproduce, or learn through grounded communication.
- Preserve the one-real-hour / one-Civoria-month clock unless the owner explicitly changes it.
- Use a preview branch, tests/build and preview verification before production changes unless the owner explicitly directs otherwise.

## Current technical notes

- Production is Vercel-backed and uses the existing versioned Upstash V2 world namespace.
- The old V1 world remains a recovery artifact and must not be deleted casually.
- GitHub Actions heartbeat advances the world without a browser and uses short-lived GitHub OIDC authentication.
- `README.md` contains older milestone wording in places; use current code and this HANDOFF as the operational checkpoint.
- `CLAUDE.md` and `AGENTS.md` instruct assistants to use this file as the shared checkpoint.

## Next action

No implementation is active. The next assistant should start from the latest `main`, read `CLAUDE.md`, `AGENTS.md`, and this file, verify production, and follow the owner's next instruction. Do not revive or directly merge old PR #23.
