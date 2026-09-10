'use strict';
// lib/ai.js — the only place ANTHROPIC_API_KEY is used. Resolves a batch of
// queued villager-cognition requests (built by lib/engine.js) against
// Claude. Never throws: any failure just resolves that item to null, and
// engine.applyAIResults() already falls back to deterministic behavior
// when a result is missing. A tick must never fail because of this module.

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 120;
const MAX_PER_INVOCATION = 20; // safety cap; comfortably inside the 30s function timeout

const SAFETY_NOTE = "Keep it cozy and low-stakes: no violence, no politics, no adult " +
  "content \u2014 this is a gentle little village sim. Respond with ONLY the JSON object, nothing else.";

function worldLine(world) {
  if (!world) return '';
  const bits = [world.weekday, world.season].filter(Boolean);
  if (world.moon) bits.push(world.moon.toLowerCase());
  let line = 'It is a real-world ' + bits.join(', ') + '.';
  if (world.holiday) line += ' It also happens to be ' + world.holiday + '.';
  return line;
}

function buildPrompt(item) {
  if (item.type === 'priority') {
    return [
      'You are the private inner voice of ' + item.name + ', a villager in a tiny simulated settlement called \"Civoria.\"',
      'Personality: ' + item.trait + '. Trade: ' + item.role + '.',
      'Right now \u2014 hunger ' + item.hunger + '/100 (higher = hungrier), energy ' + item.energy + '/100 (higher = more rested), ' +
        'loneliness-relief ' + item.social + '/100 (higher = less lonely). ' +
        'Carrying ' + item.food + ' food, ' + item.wood + ' wood, ' + item.stone + ' stone, ' + item.coins + ' coins. ' +
        (item.hasHome ? 'Has a home.' : 'Has no home yet.'),
      'It is Day ' + item.day + ', ' + item.timeOfDay + '. ' + worldLine(item.world),
      'Nearby: ' + item.nearby + '.',
      item.recent ? ('Recently: ' + item.recent) : '',
      '',
      'What matters most to them right now? ' + SAFETY_NOTE,
      'Respond with ONLY this JSON: {\"focus\":\"hunger\"|\"energy\"|\"social\"|\"work\",\"thought\":\"a short first-person sentence, under 16 words, in their voice\"}'
    ].filter(Boolean).join('\n');
  }
  if (item.type === 'chat') {
    return [
      item.a.name + ' (' + item.a.trait + ', ' + item.a.role + ') runs into ' + item.b.name + ' (' + item.b.trait + ', ' + item.b.role + ') in the village.',
      'It is Day ' + item.day + '. ' + worldLine(item.world),
      'Write one short, warm, third-person sentence (under 20 words) narrating what they talk about \u2014 something small and human, flavored by who they are. ' + SAFETY_NOTE,
      'Respond with ONLY this JSON: {\"line\":\"...\"}'
    ].join('\n');
  }
  return null;
}

function extractJSON(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch (e) {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch (e) {} }
  return null;
}

async function resolveOne(apiKey, item) {
  const prompt = buildPrompt(item);
  if (!prompt) return null;
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content: prompt }] })
    });
    if (!upstream.ok) return null;
    const data = await upstream.json();
    const text = (data.content || []).map((b) => b.text || '').join('');
    return extractJSON(text);
  } catch (e) {
    return null;
  }
}

async function resolveBatch(queue) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !queue.length) {
    return { priorityResults: queue.map(() => null), chatResults: {} };
  }
  const capped = queue.slice(0, MAX_PER_INVOCATION);
  const results = await Promise.all(capped.map((item) => resolveOne(apiKey, item)));
  const priorityResults = queue.map((item, i) => (i < capped.length ? results[i] : null));
  const chatResults = {};
  capped.forEach((item, i) => {
    if (item.type === 'chat' && results[i] && results[i].line) chatResults[item.chatId] = results[i].line;
  });
  return { priorityResults, chatResults };
}

module.exports = { resolveBatch, MODEL, MAX_PER_INVOCATION };
