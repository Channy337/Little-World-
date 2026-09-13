# Civoria — assistant handoff

Updated: 2026-09-12 CDT / 2026-09-13 UTC. This is the shared checkpoint for the owner and any coding assistant. Verify GitHub and production before editing.

## Current progress

- **Canonical project name: Civoria.** Do not use `Clivoria`, `CLIVORIA`, or `A Little World` as the public/project name.
- Live site: `https://www.thecivoria.com` / `https://thecivoria.com`
- Repository: `Channy337/Little-World-`
- Production branch: `main`
- Current production release before the active branding PR: **V0.12.1**
- Current production merge before the active branding PR: `539f2abe9f11d81b3da59e974f8ecb8e572c07a6`
- Active branch: `beta/v0122-civoria-branding`
- Active PR: **#33 — V0.12.2: standardize Civoria branding**
- V0.12.2 changes only presentation/branding/tests/docs. It must not reset or alter canonical world state.

### Naming rule

`Civoria` is the one true public/project name. V0.12.2 replaces legacy visitor-facing `Clivoria`, `CLIVORIA`, `A Little World`, and `clivoria-day*.png` strings with Civoria equivalents.

Do **not** blindly rename technical infrastructure identifiers. The GitHub repository is still `Channy337/Little-World-`, and persistence/deployment identifiers containing `little-world` are intentionally preserved because changing them can break GitHub/Vercel integration or disconnect the existing saved world. A permanent regression test in `test/branding.test.js` guards this distinction.

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

Owner presentation decision: the large permanent **Shelter Project** panel should not be treated as a main visitor attraction. The shelter mechanic stays. Future UI work should make construction feel natural in-world, with detailed status available contextually (clicked site/Civorian or observer/debug view) and major milestones surfaced through World News/Chronicle.

### V0.12.1 — ambient instrumental music

Released from PR #32.

- optional visitor-only instrumental ambience
- generated locally with Web Audio, not an external/licensed song file
- visitor must tap the music control to start because iPhone/modern browsers block unsolicited autoplay
- quiet default volume and volume slider
- music has no effect on canonical simulation state
- production was verified after deployment with no runtime errors

## Active V0.12.2 branding patch

PR #33 standardizes all public branding to **Civoria** and bumps the visible version to V0.12.2.

The branch cleanup already:

- corrected homepage metadata, navigation/hero/about/share labels
- corrected Discoveries branding
- corrected Chronicle legacy `A Little World` branding
- corrected generated share-card text, Web Share title/text and downloaded screenshot filename in `game.js`
- updated release-label tests from V0.12.1 to V0.12.2
- added `test/branding.test.js`
- ran a repository public-brand scan with no legacy public names remaining in the guarded files
- ran `npm test` successfully
- ran `npm run build` successfully

The temporary cleanup workflow used to safely patch the large renderer was removed from the branch after it completed.

## Core invariants

- Preserve the existing canonical production world. Never reset/reseed it to solve an implementation problem.
- Browser/UI layers are observers/presentation. Canonical facts and outcomes remain server-owned.
- Persistent personal minds may hypothesize; deterministic physical rules create facts, resources, executable capabilities and consequences.
- Do not give Civorians omniscient map/scientific/medical knowledge that they did not personally sense, discover, remember, reproduce, or learn through grounded communication.
- Preserve the one-real-hour / one-Civoria-month clock unless the owner explicitly changes it.
- Use a preview branch, tests/build and preview verification before production changes unless the owner explicitly directs otherwise.

## Current technical notes

- Production is Vercel-backed and uses the existing versioned Upstash V2 world namespace.
- The old V1 world remains a recovery artifact and must not be deleted casually.
- GitHub Actions heartbeat advances the world without a browser and uses short-lived GitHub OIDC authentication.
- `README.md` contains older milestone wording in places; verify current code/HANDOFF rather than treating old release prose as the latest operational state.
- `CLAUDE.md` and `AGENTS.md` instruct assistants to use this file as the shared checkpoint.

## Next action

1. Finish GitHub Beta checks and Vercel preview verification for PR #33.
2. If clean, merge PR #33 only with owner authorization and verify production serves V0.12.2 with no runtime errors.
3. After release, update this checkpoint if any production SHA/deployment detail changed.
4. Do not revive or directly merge old PR #23.
