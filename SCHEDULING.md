# Civoria unattended world scheduler

`/api/heartbeat` advances the same canonical Upstash-backed world as browser ticks and records `lastHeartbeatAt` atomically. Browser ticks preserve that timestamp but cannot forge it. A successful heartbeat returns timing, revision and day metadata, never the full village. Conflicts retry twice; failed writes never claim a completed heartbeat.

## World pace

The owner selected a compressed calendar: **one real day equals thirty Civoria days, or one Civoria month**.

The original village engine was tuned around a 55-second internal day. The world service now maps one internal day to about 48 real minutes. Biological age is separately divided across a 360-day Civoria year, preventing the faster calendar from aging people one year per day.

## Scheduler selected for Beta 0.2

Beta 0.2 uses **GitHub Actions** rather than adding another paid scheduler service. `.github/workflows/heartbeat.yml` calls the production heartbeat at minutes 2, 17, 32 and 47 of each hour, or roughly every 15 minutes.

The workflow does not store a long-lived heartbeat password. It requests a short-lived GitHub Actions OIDC token with audience `civoria-heartbeat`. The server validates the JWT signature against GitHub's OIDC keys and requires all of the following claims:

- issuer: GitHub Actions OIDC
- audience: `civoria-heartbeat`
- repository: `Channy337/Little-World-`
- repository ID: `1360527457`
- repository owner ID: `326168246`
- ref: `refs/heads/main`
- workflow: `.github/workflows/heartbeat.yml` on `main`
- event: `schedule`, `workflow_dispatch`, or the one-time `push` activation path

A legacy `CRON_SECRET` remains supported as a fallback, but Beta 0.2 does not require one for GitHub Actions.

## Catch-up behavior

The service allows up to **seven real days** of elapsed time to be replayed in one invocation. At the current scale that is 210 Civoria days. The limit remains the safety fuse against unbounded catch-up.

If the world has been unattended for more than seven real days without any browser tick or scheduler heartbeat, the excess is deliberately discarded once and logged as `skippedMs`. This is the safety fuse against unbounded catch-up.

## Release and verification

GitHub scheduled workflows only run from the repository's default branch, so the schedule is inert while this file remains on `beta/unattended-world`.

Release procedure:

1. Run the full automated test suite and static build on the Beta branch.
2. Confirm the Vercel preview build succeeds.
3. Merge PR #2 to `main`. This deploys the corrected real-time pace and heartbeat endpoint together.
4. The workflow's `push` activation path should make one immediate authenticated production heartbeat after merge.
5. Confirm at least one later run whose event is `schedule`, with all village browser pages closed.
6. Verify the heartbeat response succeeds and `lastHeartbeatAt` advances.
7. If any production heartbeat fails repeatedly, disable or fix the workflow before changing simulation rules.

## Known Beta limitation

GitHub says scheduled Actions can be delayed during high load, and scheduled workflows in public repositories may be disabled after 60 days with no repository activity. Civoria's elapsed-time catch-up makes ordinary delays harmless, but long-term production should eventually move to a dedicated scheduler if the experiment becomes inactive at the code level for long periods.

AI decision-making is still deferred to Civoria 0.3. The heartbeat only advances the deterministic persistent-world engine.
