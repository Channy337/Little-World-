# Milestone 1 verification — September 7, 2026

## Local checks

19 Node tests passed for concurrency, initialization, bounded catch-up, recovery, namespace isolation, storage adapter requests and HTTP guards. Desktop/mobile Chrome checks passed using an explicit memory test store: identical state in independent contexts, old browser saves preserved and ignored, shared Chronicle, retained snapshot on simulated HTTP 503, automatic recovery, and no page errors. Public build passed.

## Hosted preview

GitHub write access was restored. Draft PR #1 and beta/persistent-world are published. Vercel Git integration reported Ready. Production main remains unchanged.

After signing into the preview through the in-app browser, the deployed village displayed Shared world · Live on Day 26 with 20 villagers, 7 homes and an open market. Reloading retained those values and history; Chronicle matched. This confirms the deployed frontend can read and advance server-backed state; no memory fallback exists in the production handlers.

Before the redeployment triggered by this documentation update, Chronicle showed Day 28, 19 villagers, 7 homes and an open market. Retained history includes Sana funding the market on Day 4 and Kesh building a home on Day 9. These are the baseline for the redeployment check; its result is pending.

## Remaining limitations

The Vercel connector still returns HTTP 403 for small-villager. The signed-in preview browser works, but direct account settings/logs inspection is unavailable. Browser navigation directly to /api/state was blocked by the browser; verification uses rendered application pages.

Persistence across this new deployment and multiple hosted views still require confirmation. Local concurrency and failure injection tests are not a substitute for full hosted fault testing. No production rollout, scheduler, new account, or paid service has been configured. AI decisions remain deferred. See README.md for clock policy, namespace isolation and rollout instructions.

## Redeployment result

PASS: preview deployment 6xUaD2DybiRYgSW8yv8ugS2TxVe2 for commit b45efe4 was Ready. Its unique URL, https://little-world-h0srwq2gc-small-villager.vercel.app, retained the original settlers, Sana's Day 4 market opening and Kesh's Day 9 home. The branch URL and unique deployment both showed Day 30, 17 villagers, 7 homes and an open market after advancing from the recorded Day 28 baseline.

Vercel runtime logs for this deployment showed HTTP 200 for GET /api/state and POST /api/tick. A world_tick entry recorded revision 118, simulatedMs 111300, skippedMs 0, population 17, day 30. The displayed log window showed zero Warning, Error and Fatal entries. This is a bounded observation, not a guarantee of no errors outside that window.

Two hosted views were compared in the same signed-in browser, not independent authenticated users. Hosted destructive fault injection was not performed; simulated outage and concurrency coverage remains local. Signed-in browser access now permits dashboard/log inspection even though the connector still returns 403. Production remains unchanged.

## Civoria 0.6 candidate verification — September 11, 2026

Draft PR #22 adds deterministic weather and physiology to the isolated primitive-origin preview. Unit coverage verifies seasonal deterministic weather, heat/humidity/activity water-loss pressure, soil-moisture growth effects, hidden anatomy access levels, multi-day dehydration, multi-week fasting across glycogen/fat/muscle reserves, food and water recovery, visible weather, symptom display, and repeated physical discovery of pulse and breathing. The browser remains read-only for canonical outcomes.

Four deterministic 60-day whole-world samples retained all nine settlers while consuming different fat reserves under shared weather and food competition. Three deterministic 120-day samples retained five to seven settlers, with deaths caused by starvation and organ failure when the population did not develop a stronger food system. These are balance observations, not scripted population targets or guarantees.

Production remains unchanged. Hosted preview visual review is required before any release.

## Civoria 0.7 sleep candidate verification — September 11, 2026

Draft PR #22 now adds a canonical 24-hour circadian system. Tests verify that night produces stronger circadian sleep drive than daylight; wakefulness accumulates sleep pressure and debt; a sheltered eight-hour sleep relieves pressure; exposed cold, wind and rain reduce sleep quality; severe deprivation reduces alertness, physical function and health; and a tired homeless Civorian will physically sleep on the ground. The visitor UI exposes alertness and sleep debt without giving those measurements to the Civorian mind, while AI cognition receives only alertness and personally felt symptoms.

All 95 automated tests pass, the public build passes and `git diff --check` passes. Four deterministic 60-day samples retained all nine settlers and spent 29.5–37.8% of agent-time asleep, approximately seven to nine in-world hours per day. Four deterministic 120-day samples ended with eight or nine settlers; the two deaths were starvation and organ failure, not sleep failures.

The local environment did not provide the `agent-browser` executable required by the browser-verification skill, so the lying sleep posture and 24-hour clock still require hosted visual review. Production remains unchanged.

## Civoria 0.8 foundational-realism candidate — September 11, 2026

The local candidate removes inherited wells and farms and adds personal perception, spatial memory and place sharing; property-based artifacts and physically generated behaviors; varied hidden food effects and personal food learning; wounds, bleeding, infection, smoke, oxygen, waste and water contamination; pregnancy, dependent childhood and life stages; and learned communication conventions and shared-practice institutions. The visitor can see animals, deposits, life stage, bodily condition and produced prototypes, while hidden species, chemistry, anatomy and safety facts remain unavailable to Civorian minds until physically evidenced.

All 110 automated tests pass, the public build passes, syntax checks for all new simulation modules pass and `git diff --check` passes. The suite includes regression coverage proving that a Civorian who personally associates a food's appearance with illness can reject it without becoming trapped in an eating loop or losing the ability to sleep. It also verifies age-dependent sleep requirements and a dependent child's longer physical sleep episode.

Four deterministic 60-day samples retained all nine settlers. At 120 days, two samples retained one settler and two became extinct between days 111 and 117; all observed deaths were starvation and organ failure. These runs intentionally used no AI-supplied experiments, so the settlers exhausted wild food without inventing a renewable food process. This is an allowed civilization outcome, not a scripted target or a guarantee about AI-enabled runs.

This candidate is a bounded first physical layer, not atom-scale arbitrary engineering. Its material properties and assembly behaviors can validate unfamiliar constructions without a named technology tree, but future releases still need richer thermodynamics, geology, aerodynamics, fluid flow, electricity, optics, farming experiments and tool-mediated measurement. Hosted visual review has not been performed. Production and the preserved v1 world remain unchanged.

### Inherited human diversity addition

The local 0.8 candidate now stores simplified polygenic appearance traits instead of fixed race categories. Founders receive varied continuous alleles for melanin, hair pigmentation and texture, eye pigmentation and face breadth. A child's genome is fixed at conception, takes one allele per locus from each parent, and remains available if a parent dies before birth. Existing saves receive stable deterministic appearance without consuming the canonical random sequence.

The renderer uses inherited pigmentation and hair texture, and the visitor profile shows a plain visible description. Civorian AI receives only visible appearance language for itself and nearby people, with no racial, cultural or behavioral label. Appearance has no path into intelligence, personality, motivation, knowledge, health or productive capacity.

All 115 automated tests pass. The public build, relevant syntax checks and `git diff --check` pass. Hosted visual review remains pending, and nothing has been pushed or deployed.
