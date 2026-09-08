# Unattended world setup (preview work, not active in production)

The new `/api/heartbeat` accepts authenticated GET or POST requests. It advances the same canonical world as browser ticks and records `lastHeartbeatAt` atomically. Browser ticks preserve that timestamp but cannot set it. A successful response contains timing/revision/day information, not the full village. Conflicts retry twice, then return 503 so a scheduler can retry. Failed writes never claim a completed heartbeat.

## Remaining activation steps

1. Choose cadence and world pace with the owner. This branch retains the existing 55 real seconds per village day. Continuous operation at that speed advances approximately 1,571 village days per real day. Do not activate production until pace is settled.
2. Configure a strong random `CRON_SECRET` in Vercel for this preview branch only. Keep its value out of chat, source, URLs and logs. Production needs its own secret at release.
3. Configure an external scheduler against the preview branch's HTTPS `/api/heartbeat`, forwarding `Authorization: Bearer <CRON_SECRET>`. No request body is needed. Vercel preview protection may require a separate automation bypass credential; keep that out of source and logs too.
4. Confirm two automatic deliveries while all village browser pages are closed. Check successful `world_heartbeat` logs and increasing stored heartbeat timestamps. Opening a viewer and seeing movement alone does not establish unattended operation.
5. Only after preview verification and owner release approval, deploy and configure the production destination. Remove/pause the preview schedule when finished testing.

## Scheduler options checked 2026-09-08

- Vercel Hobby cron runs at most daily, unsuitable for this milestone: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Upstash QStash free allowance is 1,000 messages/day. Every two minutes is 720 scheduled deliveries/day, before retries or other usage. This is a separate product from the existing Redis integration and is not yet configured: https://upstash.com/pricing/qstash
- QStash schedules support an explicit schedule ID, forwarded authorization header, GET method and configurable retries. Use one stable schedule ID to prevent accidental duplicate schedules: https://upstash.com/docs/qstash/api-reference/schedules/create-a-schedule
- GitHub Actions is another option, but scheduled jobs can be delayed and five-minute cadence exceeds the current two-minute catch-up cap. It would need a reviewed timing change before use.

The current cap remains 120 simulated seconds per invocation. A long scheduler outage discards excess elapsed time once, logging `skippedMs`. This prevents unbounded work; it does not replay a full outage. A two-minute schedule can still lose small amounts of simulation time when delivery is late. No new account, scheduler or paid plan has been activated by this commit. AI decisions remain deferred.
