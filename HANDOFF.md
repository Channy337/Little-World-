# Civoria — assistant handoff

Updated: 2026-09-12 (CDT). This is the current shared checkpoint for the owner and any coding assistant. Verify GitHub before editing and do not store secrets here.

## Current production

- Live site: https://www.thecivoria.com
- Production branch: `main`
- Production release: **V0.10.1**
- Production head: `849ec951b64a3d8bfb1606d6a760f3729c41d0e1`
- Production was **not changed** by the V0.11 work below.
- Existing production already includes the V0.9 wildlife/cloud/severe-weather layer and the V0.10 winter/Fahrenheit survival work.

## Active candidate — V0.11 living planet

The owner instructed: **implement the remaining Civoria systems except shelter**. Work was started from the exact V0.10.1 production head on a new preview branch.

- Branch: `beta/v011-living-planet`
- Draft PR: **#29 — V0.11: living planet, one-hour month, cultivation, and observer profiles**
- Exact tested candidate: `7ef5be7638dbc6afbdbba156f0fe9ad8a81760b6`
- Base: `main` at `849ec951b64a3d8bfb1606d6a760f3729c41d0e1`
- GitHub Beta checks: **run #109 passed** on the exact candidate.
- CI verification: `npm test` passed and `npm run build` passed.
- Vercel preview deployment: `dpl_CFtW9JCB3iiF97Qe2b9Hky6GN7Aa` — **READY**.
- Exact preview URL: `https://little-world-2r3rak7y4-small-villager.vercel.app`
- Stable branch preview alias: `https://little-world-git-beta-v011-living-planet-small-villager.vercel.app`
- Preview root was fetched successfully with HTTP 200 and serves V0.11.0.
- Preview runtime error/warning/fatal log query returned no matching logs.
- The automated `agent-browser` binary was unavailable in the current execution runtime, so no automated screenshot/pixel-level browser inspection was claimed. Manual owner visual review is still appropriate before any merge.

### V0.11 implemented systems

1. **One real hour = one Civoria month**
   - Canonical pace is now 30 Civoria days per real hour (`720` Civoria days per real day).
   - Biological aging remains based on Civoria calendar days, preserving 360 Civoria days per biological year.
   - Catch-up stepping adapts for large elapsed windows so the faster clock does not require hundreds of millions of tiny simulation steps.
   - Tests verify thirty two-minute heartbeats advance exactly thirty Civoria days and scheduler cadence does not double-advance.

2. **Deterministic Earth-like planet truth**
   - `lib/planet.js` creates and persists one fixed-seed continent-scale physical world before exploration.
   - Includes Earth-like gravity, atmospheric pressure/oxygen, 24-hour rotation, axial tilt, latitude, oceans/land, elevation, western/eastern mountain belts, coast distance, a river system, groundwater, drainage, soils, temperature and precipitation.
   - Biomes derive from those physical values rather than visitor labels.
   - A habitable river-valley starting region is selected from the fixed seed.
   - A 16×10 observer overview and a 12×8 local terrain slice are persisted from the same canonical planet seed.

3. **Climate-aware weather**
   - Daily weather now reads regional climate when available.
   - Temperature and precipitation respond to latitude/elevation/coastal moisture rather than being only global random values.
   - Existing storm, rain, snow, blizzard, flood, windstorm, heatwave, cold-snap and drought consequences remain.
   - Warm coastal summer/autumn conditions can produce hurricane-class hazards.

4. **Real plant morphology, physical plant pieces and cultivation**
   - Added internally identified real plants including black raspberry, wild sunflower, wild rice, cattail and pokeweed.
   - Civorians receive only visible morphology: leaf form, venation, growth habit, fruit/seed appearance. Scientific names remain hidden engine truth.
   - Foraging now physically collects viable plant pieces/seeds into the individual inventory.
   - Plant pieces carry inherited variation affecting temperature/moisture/depth response and vigor.
   - Ground placement/burial is a physical experiment, not a named farming unlock.
   - Germination depends on species-specific temperature, moisture, burial depth, dormancy and viability whether anyone understands the cause or not.
   - Wrong conditions can fail without granting knowledge.
   - Repeated personally observed successful growth is required before that individual gains a reproducible cultivation method.
   - Discovery does not spawn a farm or alter physical truth.

5. **Canonical animal populations**
   - Canonical fish, deer, rabbit, fox and songbird populations now exist alongside the already released visitor wildlife layer.
   - Populations respond to winter scarcity, deep snow, severe weather and simple predator/prey availability.
   - Hidden scientific identity is separate from what Civorians can visibly perceive.

6. **Grounded experiment expansion**
   - Physical prototype mechanics now support `place` and `bury` operations plus a physical `plantbit` material.
   - AI prompts may propose placement/burial as hypotheses but are explicitly forbidden from jumping directly to a farming concept or claiming an outcome before the deterministic world tests it.

7. **Read-only Jarvis-style Civorian Life Profile**
   - `jarvis-profile.js` adds a deep visitor profile opened from the existing villager panel.
   - Separates **Civorian knowledge** from **observer analysis**.
   - Shows mind state, personal observations, beliefs, lessons, proven capabilities, experiments, relationships and personal timeline.
   - Observer-only section can show body/health measurements, inventory, artifacts and carried plant pieces without granting that information to the Civorian.
   - GET-only `/api/state`; no browser write path, no localStorage authority, no simulation advance.

8. **Living Planet Observer**
   - `planet-view.js` + `observer-ui.css` add a continent observer map, regional physical measurements, animal population summary and plant-growth attempts.
   - The map is visitor analysis only. Civorians do not receive an omniscient continent map.

9. **V0.11 presentation/build wiring**
   - `index.html` now labels the one-hour/month pace and serves V0.11.0.
   - New observer assets are included by `scripts/build.js`.
   - Existing two-clock visual motion, mind feed, scroll fix, world ticker, core renderer, wildlife/weather viewer and Fahrenheit overlay remain in place.

### Verification added or updated

Tests now cover:

- fixed-seed planet determinism;
- persisted planet/local terrain truth;
- terrain/climate causality;
- legacy food-state compatibility during real-plant migration;
- physical plant-piece collection and inherited variation;
- failed germination under wrong burial conditions;
- successful germination without prior cultivation knowledge;
- two successful personal growth cycles before reproducible cultivation knowledge;
- no scientific identity leakage through plant sensory descriptions;
- exact one-real-hour/one-Civoria-month clock behavior;
- scheduler catch-up under the faster clock;
- read-only visitor observer/profile boundaries;
- missing/legacy optional profile data;
- reduced-motion CSS;
- existing weather, wildlife, body, ticker, Fahrenheit, persistence, concurrency and long-simulation regressions.

## Explicitly excluded

### Shelter

Draft PR **#23** remains separate and was **not modified, merged, rebased or reconciled** during V0.11 work. Do not merge it as part of PR #29.

### Artwork redesign

No new character/sprite artwork was integrated. The OpenArt/character-style experiment is separate from this engineering candidate.

### Production

PR #29 is still a **draft**. Do not merge or deploy it to production without a fresh explicit instruction from the owner.

## Honest scope limits

V0.11 is a functional continent/climate/ecology/cultivation foundation, not a literal molecular Earth or a 1:1 geographic simulation. The current playable camera remains the existing local 2.5D settlement view, with the continent exposed through the new observer map. Regional long-distance travel/exploration across the whole continent is not yet a full agent navigation system. The biological model uses meaningful inherited functional loci rather than billions of literal DNA base pairs. Those limits are deliberate so the world stays deterministic, persistent and computationally practical.

The existing deeper realism roadmap still includes richer geology, erosion through time, fluid flow, thermodynamics, electricity, optics, broader disease/pathogen ecology, more complete food webs and long-distance regional migration/exploration. Do not represent those as already complete.

## Next action

1. Owner reviews PR #29 preview visually.
2. Fix any presentation or behavior issue found in preview.
3. Re-run Beta checks on the exact final head if any file changes.
4. Only after explicit owner approval, merge PR #29 to `main` and verify the production V2 world upgrades in place without reset.
5. Leave shelter PR #23 separate unless the owner later asks for it.
