// /api/decide.js — a Vercel serverless function.
// This is the only place the Anthropic API key ever touches — it lives in an
// environment variable on the server, never in any file the browser can see.
//
// The frontend (game.js) POSTs a small JSON payload here whenever a villager
// needs to "think." We turn that into a short prompt, ask Claude, and hand
// back a tiny structured answer. If anything goes wrong, we return a 200
// with a fallback flag (or let the request fail) — the game already knows
// how to carry on using its own rule-based behavior when that happens.

const MODEL = 'claude-haiku-4-5-20251001'; // cheap + fast, good fit for frequent small decisions
const MAX_TOKENS = 120;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Backend deployed, but no key set yet — fail quietly so the game just
    // keeps using its built-in behavior instead of erroring in the console.
    res.status(200).json({ fallback: true, reason: 'no_api_key' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const kind = body && body.kind;
  const context = (body && body.context) || {};

  const prompt = buildPrompt(kind, context);
  if (!prompt) {
    res.status(200).json({ fallback: true, reason: 'unknown_kind' });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!upstream.ok) {
      res.status(200).json({ fallback: true, reason: 'upstream_error', status: upstream.status });
      return;
    }

    const data = await upstream.json();
    const text = (data.content || []).map((b) => b.text || '').join('');
    const parsed = extractJSON(text);
    if (!parsed) {
      res.status(200).json({ fallback: true, reason: 'unparseable' });
      return;
    }
    res.status(200).json(parsed);
  } catch (e) {
    res.status(200).json({ fallback: true, reason: 'exception' });
  }
};

function extractJSON(text) {
  if (!text) return null;
  var trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch (e) {}
  var match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (e) {}
  }
  return null;
}

var SAFETY_NOTE = "Keep it cozy and low-stakes: no violence, no politics, no adult " +
  "content \u2014 this is a gentle little village sim. Respond with ONLY the JSON object, nothing else.";

function worldLine(world) {
  if (!world) return '';
  var bits = [world.weekday, world.season];
  if (world.moon) bits.push(world.moon.toLowerCase());
  var line = 'It is a real-world ' + bits.filter(Boolean).join(', ') + '.';
  if (world.holiday) line += ' It also happens to be ' + world.holiday + '.';
  return line;
}

function buildPrompt(kind, ctx) {
  if (kind === 'priority') {
    return [
      'You are the private inner voice of ' + ctx.name + ', a villager in a tiny simulated settlement called "A Little World."',
      'Personality: ' + ctx.trait + '. Trade: ' + ctx.role + '.',
      'Right now \u2014 hunger ' + ctx.hunger + '/100 (higher = hungrier), energy ' + ctx.energy + '/100 (higher = more rested), ' +
        'loneliness-relief ' + ctx.social + '/100 (higher = less lonely). ' +
        'Carrying ' + ctx.food + ' food, ' + ctx.wood + ' wood, ' + ctx.stone + ' stone, ' + ctx.coins + ' coins. ' +
        (ctx.hasHome ? 'Has a home.' : 'Has no home yet.'),
      'It is Day ' + ctx.day + ', ' + ctx.timeOfDay + '. ' + worldLine(ctx.world),
      'Nearby: ' + ctx.nearby + '.',
      ctx.recent ? ('Recently: ' + ctx.recent) : '',
      '',
      'What matters most to them right now? ' + SAFETY_NOTE,
      'Respond with ONLY this JSON: {"focus":"hunger"|"energy"|"social"|"work","thought":"a short first-person sentence, under 16 words, in their voice"}'
    ].filter(Boolean).join('\n');
  }
  if (kind === 'chat') {
    return [
      ctx.a.name + ' (' + ctx.a.trait + ', ' + ctx.a.role + ') runs into ' + ctx.b.name + ' (' + ctx.b.trait + ', ' + ctx.b.role + ') in the village.',
      'It is Day ' + ctx.day + '. ' + worldLine(ctx.world),
      'Write one short, warm, third-person sentence (under 20 words) narrating what they talk about \u2014 something small and human, flavored by who they are. ' + SAFETY_NOTE,
      'Respond with ONLY this JSON: {"line":"..."}'
    ].join('\n');
  }
  if (kind === 'role') {
    return [
      ctx.name + ', a ' + ctx.trait + ' villager, just took up work as a ' + ctx.role + ' on Day ' + ctx.day + '.',
      'Give one short first-person thought (under 16 words) about why, in their voice. ' + SAFETY_NOTE,
      'Respond with ONLY this JSON: {"thought":"..."}'
    ].join('\n');
  }
  return null;
}
