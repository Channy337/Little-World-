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
