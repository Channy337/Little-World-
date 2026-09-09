# Unattended world setup (preview work, not active in production)

The new `/api/heartbeat` accepts authenticated GET or POST requests. It advances the same canonical world as browser ticks and records `lastHeartbeatAt` atomically. Browser ticks preserve that timestamp but cannot set it. A successful response contains timing/revision/day information, not the full village. Conflicts retry twice, then return 503 so a scheduler can retry. Failed writes never claim a completed heartbeat.

## World pace

The owner selected a real-time calendar: approximately **one village day equals one real day**. The original simulation was tuned around a 55-second internal day, so the world service now scales elapsed real time before handing it to the existing engine. This preserves the relative behavior of hunger, energy, movement, work, farming, aging, births, and resource regeneration instead of changing only the displayed calendar.

At the selected two-minute heartbeat cadence, 720 on-time deliveries represent one real day and therefore approximately one village day. The existing 120-second catch-up cap remains in place, so a delayed or missed scheduler delivery can discard excess elapsed time rather than replaying an unbounded backlog.

## Remaining activation steps

1. Keep the owner-approved pace at one village day per real day. Do not restore the legacy 55-real-seconds-per-day pace.
2. Configure a strong random `CRON_SECRET` in Vercel for this preview branch only. Keep its value out of chat, source, URLs and logs. Production needs its own secret at release.
3. Configure an external scheduler against the preview branch's HTTPS `/api/heartbeat`, forwarding `Authorization: Bearer <CRON_SECRET>`. No request body is needed. Vercel preview protection may require a separate automation bypass credential; keep that out of source and logs too.
4. Confirm two automatic deliveries while all village browser pages are closed. Check successful `world_heartbeat` logs and increasing stored heartbeat timestamps. Opening a viewer and seeing movement alone does not establish unattended operation.
5. Only after preview verification and owner release approval, deploy and configure the production destination. Remove/pause the preview schedule when finished testing.

## Scheduler options checked 2026-09-08

- Vercel Hobby cron runs at most daily, unsuitable for this milestone: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Upstash QStash free allowance is 1,000 messages/day. Every two minutes is 720 scheduled deliveries/day, before retries or other usage. This is a separate product from the existing Redis integration and is not yet configured: https://upstash.com/pricing/qstash
- QStash schedules support an explicit schedule ID, forwarded authorization header, GET method and configurable retries. Use one stable schedule ID to prevent accidental duplicate schedules: https://upstash.com/docs/qstash/api-reference/schedules/create-a-schedule
- GitHub Actions is another option, but scheduled jobs can be delayed and five-minute cadence exceeds the current two-minute catch-up cap. It would need a reviewed timing change before use.

The current cap remains 120 real seconds per invocation. A long scheduler outage discards excess elapsed time once, logging `skippedMs`. This prevents unbounded work; it does not replay a full outage. A two-minute schedule can still lose small amounts of village time when delivery is late. No new account, scheduler or paid plan has been activated by this commit. AI decisions remain deferred.
