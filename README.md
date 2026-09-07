# A Little World

A pixel-art village where every villager's next move — and a short first-person
"thought" — comes from a real call to Claude. Four files:

- `index.html` — the page (hero, the game, an about section, share button)
- `styles.css` — all the styling
- `game.js` — the simulation, rendering, and the calls out to the AI backend
- `api/decide.js` — a small serverless function that holds the API key and
  talks to Claude on the villagers' behalf

The game runs perfectly well with **no backend at all** — it just uses its
original built-in instincts. The AI layer is additive: deploy the backend and
villagers start actually thinking; don't, and nothing breaks.

## 1. Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up.
2. Add a payment method (it's pay-per-use — no monthly minimum).
3. **Set a spending limit** under Settings → Billing so it can never surprise
   you. Start small (e.g. $5) and raise it once you know your usage.
4. Settings → API Keys → Create Key. Copy it somewhere safe — you won't be
   able to see it again.

This project uses Claude Haiku, the cheapest current model, specifically
because villagers "think" often — each thought costs a small fraction of a
cent, but it adds up if it's not the cheap model.

## 2. Deploy the backend + site to Vercel (free tier is plenty)

1. Go to [vercel.com](https://vercel.com) and sign up (GitHub login is
   easiest).
2. Put these four files/folders in a GitHub repo (or use the `vercel` CLI to
   deploy the folder directly — either works).
3. Import the repo in Vercel ("Add New… → Project"), or run `vercel` from
   this folder if you have the CLI installed.
4. Before (or right after) the first deploy, add the environment variable:
   **Settings → Environment Variables** → add `ANTHROPIC_API_KEY` with the
   key you copied above → redeploy.
5. Vercel gives you a live URL immediately, like
   `https://a-little-world.vercel.app`. Open it — villagers should now
   occasionally show a "thought" in their profile card, and the log should
   eventually show *"The village grows a mind of its own."*

## 3. Point your GoDaddy domain at it

GoDaddy is just the address book entry — the actual site lives on Vercel.

1. In Vercel: your project → **Settings → Domains** → add your domain
   (e.g. `alittleworld.com`). Vercel will show you a DNS record to add.
2. In GoDaddy: **My Products → DNS** for that domain → add the record Vercel
   showed you (usually an `A` record pointing at Vercel's IP, or a `CNAME`
   for a subdomain like `www`).
3. DNS changes can take a few minutes to a few hours to fully spread. Vercel's
   domain page will show a green check once it sees it correctly.

## Cost reality check

Each villager "thought" is roughly $0.001 (a tenth of a cent) on Haiku.
Villagers think on a per-agent cooldown (roughly once every 15–25 simulated
seconds, not every frame), so a single visitor watching one village for an
hour is well under a dime. Where it can add up is many people watching many
*separate* villages at once, since right now each visitor's browser runs and
"thinks for" its own private village. If this takes off and cost becomes a
concern, the natural next step is merging everyone into one shared village
that thinks on a server-side schedule regardless of how many people are
watching — cost stops scaling with visitors. Worth revisiting once you see
real usage.

## Notes

- Villager life autosaves to each visitor's own browser (`localStorage`) —
  everyone gets their own private village that resumes where they left off.
- If the AI call fails, times out, or the backend isn't deployed, a villager
  just falls back to their original built-in instincts for that decision —
  the game never breaks or freezes waiting on it.
- The real-world flavor (day of week, season, moon phase, a small set of
  whimsical real holidays) is computed from the visitor's own clock — no
  external API, no extra cost, no extra thing that can go down.
