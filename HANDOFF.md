# Civoria — assistant handoff

Updated: 2026-09-13 UTC. This is the shared checkpoint for the owner and any coding assistant. Verify GitHub and production before editing.

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
- Active implementation: PR #34, open and not merged. See Active work below.

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

## Active work - PR #34 (open, not merged)

Branch preview/seed-perception-and-food-relearning, titled "Restore seed perception and food relearning". Four commits, +27 -8. Beta checks run #154 passed. Vercel preview deployed and healthy. Production untouched.

Fixes two defects found while investigating mass starvation in the saved world.

**Seeds were imperceptible.** Every Civorian carries up to 24 seeds. The planting chain works end to end - a buried seed germinates, grows, matures and teaches its owner - but nothing ever made a Civorian aware the seeds existed. Three gaps: collectSeed in lib/cultivation.js stored seeds silently with no observation; requestPriorityThought in lib/engine.js omitted plantbit from the carried-materials summary; and buildPrompt in lib/ai.js excluded plantbit from the material names and from the allowed materials in the response schema. Cultivation was undiscoverable in practice, not merely undiscovered.

**A bad meal blacklisted a plant permanently.** recordFoodOutcome in lib/ecology.js scores spoiled food and genuinely toxic food identically, and at -2 a food type is dropped by consume, canConsume and bush targeting with no route back. Harmless plants were written off for good after being eaten spoiled. This is why the only bushes still holding full fruit were the ones survivors refused to approach. New relaxFoodAversion, called from advance, lets a negative score drift back toward zero at .05 per day. Caution retained; permanent ban removed.

Also: lib/engine.js now passes world state into forageFood so seeds receive real IDs.

Owner rule governing this work: **do not make them plant.** No planting behaviour, no farming instruction, no nudge. These changes restore senses and learning only. Cultivation must be discovered by the Civorians themselves, and they may never manage it.

## Saved world status

Collapsing from starvation. Day 72 at the start of the investigation, day 101 by the end of the session; population fell from 8 to 2 (Joro and Elin), both starving. Deaths recorded as starvation and organ failure. Zero farms, zero plantings, zero buildings, zero construction sites. Four of six bushes stripped; the two still full are the ones scored -2 and avoided.

Do not reset or reseed to rescue this. If the settlement dies out, report it and wait for the owner decision.

## Known gap - hunting does not exist

Deer, rabbit, fox, songbird and fish live, breed, move seasonally and are visible to Civorians. But hunger only ever routes an agent to a farm, a bush or the market. There is no hunt, trap, kill, fish or butcher path anywhere in the engine, and nothing ever reduces an animal population. Consequences: bone and hide are unobtainable materials, and fish are flagged invisible. This is unbuilt work rather than a bug. When built it must be discovered the same way - not a hunt button.

## Cognition cost findings

Verified 2026-09-13. Claude Haiku 4.5 is $1 per million input tokens and $5 per million output. Cached input is 90% cheaper; batch processing is 50% cheaper.

- One priority thought costs roughly 0.15 cents (about 800 input tokens, 130 output). Roughly 700 thoughts per dollar.
- At the current clock (30 Civoria days per real hour) with a 16-26 second thought cooldown, each Civorian would generate about 78 thoughts per real hour. Nine alive is about $1/hour and $730/month; 34 alive is about $2,700/month.
- Actual spend today is far lower because ticks are infrequent and each drains at most 20 requests.
- Genuine per-decision agency at the current clock would be $2,000-3,500/month. Not viable.

These are estimates from reading the prompt. Instrument real token usage over one hour of world time before committing to a design.

## Design direction - toward real decisions

The owner goal is Civorians who decide from what is actually in front of them. Today the AI only re-ranks needs the rules already selected and proposes an occasional experiment; the rules decide everything else, and the world runs identically with the AI switched off.

Proposed path, not yet approved or built:

- Slow the world clock. Speed is the dominant cost multiplier; 30 days per real hour down to about 4 cuts cost roughly sevenfold and changes nothing else about the world.
- Use the Batch API. The world already advances asynchronously on a heartbeat, so the delay costs nothing.
- Use prompt caching. The rules and schema are identical in every call and are currently paid for in full each time.
- Let the AI choose actions at every non-routine moment, leaving routine body maintenance to the rules.

Stacked, nine Civorians with real decision-making lands near $15-25/month. Suggested budget $20/month with a hard spend cap. AI failures already return null and the world continues without them.

A deliberate world restart may be appropriate once a new cognition design is built. It is not appropriate as a rescue for the current starvation.

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

Verify main, production and PR #34 before anything else. Then: decide with the owner whether to merge PR #34 (checks pass, preview healthy, production untouched); re-check the saved world day and population, since it may have died out; and if the owner proceeds on real decision-making, instrument one hour of token usage before building anything. Do not revive or directly merge old PR #23.

## Session history

- 2026-09-13 - Claude. Read the repo and live world. Diagnosed the starvation: seeds imperceptible to Civorian minds, and permanent food blacklisting. Opened PR #34 with both fixes plus the forage state-passing tidy-up; checks green, preview healthy, not merged. Found hunting entirely unbuilt. Priced Civorian cognition and recorded a design direction for real per-decision agency. No production code merged this session.
