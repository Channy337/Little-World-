'use strict';
// lib/ai.js is the only place ANTHROPIC_API_KEY is used. It resolves queued
// villager cognition requests. Failures return null so the deterministic
// engine remains authoritative and a tick never depends on AI availability.

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 170;
const MAX_PER_INVOCATION = 20;

const SAFETY_NOTE = "Keep it cozy and low-stakes: no graphic violence, no adult content. " +
  "Treat this as one person's limited point of view. They may invent, infer, combine ideas, and propose experiments from what they personally know or physically have. " +
  "Do not claim a hypothesis is true before Civoria tests it. Respond with ONLY the JSON object, nothing else.";

function worldLine(world) {
  if (!world) return '';
  const bits = [world.weekday, world.season].filter(Boolean);
  if (world.moon) bits.push(world.moon.toLowerCase());
  let line = 'It is a real-world ' + bits.join(', ') + '.';
  if (world.holiday) line += ' It also happens to be ' + world.holiday + '.';
  return line;
}

function mindLine(mind) {
  if (!mind) return 'They have little personal history yet.';
  const memories=(mind.memories||[]).map(x=>x.text).join(' | ') || 'none yet';
  const knowledge=(mind.knowledge||[]).join(' | ') || 'little confirmed knowledge yet';
  const beliefs=(mind.beliefs||[]).join(' | ') || 'none formed yet';
  const e=mind.emotions||{};
  return [
    'Private emotional state: joy '+Math.round(e.joy||0)+', fear '+Math.round(e.fear||0)+', stress '+Math.round(e.stress||0)+', loneliness '+Math.round(e.loneliness||0)+', curiosity '+Math.round(e.curiosity||0)+'.',
    'Personal memories: '+memories+'.',
    'Things personally learned: '+knowledge+'.',
    'Current beliefs: '+beliefs+'.',
    mind.goal ? ('Current personal goal: '+mind.goal+'.') : '',
    mind.reflection ? ('Previous reflection: '+mind.reflection+'.') : ''
  ].filter(Boolean).join('\n');
}

function buildPrompt(item) {
  if (item.type === 'priority') {
    return [
      'You are the private inner voice of ' + item.name + ', one person living in a tiny simulated settlement called "Civoria."',
      'Personality: ' + item.trait + '. Present trade: ' + item.role + '.',
      'Right now: hunger ' + item.hunger + '/100 (higher = hungrier), energy ' + item.energy + '/100, social comfort ' + item.social + '/100. ' +
        'Carrying ' + item.food + ' food, ' + item.wood + ' wood, ' + item.stone + ' stone, ' + item.coins + ' coins. ' +
        (item.hasHome ? 'Has a home.' : 'Has no home yet.'),
      'It is Day ' + item.day + ', ' + item.timeOfDay + '. ' + worldLine(item.world),
      'Nearby right now: ' + item.nearby + '.',
      mindLine(item.mind),
      '',
      'Think as this individual, not as a game controller. Their personality, feelings, memories, relationships, skill, and limited knowledge should matter. They may be uncertain or wrong.',
      'They are allowed to wonder about new uses for things, make connections, and propose an experiment. An experiment is a hypothesis, not instant knowledge.',
      'If they have a concrete idea worth testing, use only these broad operations: observe, combine, shape, stack, soak, dry, heat, compare. Materials may only name wood, stone, or food, and only when they are carrying that material. Otherwise set experiment to null.',
      'A hopedResult is only what they expect to notice, not a fact. Never jump from an idea to a proven technology or recipe.',
      'Choose what matters most right now. ' + SAFETY_NOTE,
      'Respond with ONLY this JSON: {"focus":"hunger"|"energy"|"social"|"work","thought":"first-person, under 14 words","goal":"personal goal under 12 words","reflection":"what this experience means to them, under 12 words","lesson":"only a lesson supported by their memories/current evidence, under 10 words or empty","belief":"subjective belief grounded in their experience, under 10 words or empty","experiment":null|{"hypothesis":"idea under 18 words","operation":"observe|combine|shape|stack|soak|dry|heat|compare","materials":["wood"|"stone"|"food"],"hopedResult":"expected observation under 14 words"}}'
    ].filter(Boolean).join('\n');
  }
  if (item.type === 'chat') {
    return [
      item.a.name + ' (' + item.a.trait + ', ' + item.a.role + ') meets ' + item.b.name + ' (' + item.b.trait + ', ' + item.b.role + ') in Civoria.',
      'It is Day ' + item.day + '. ' + worldLine(item.world),
      item.a.mind ? (item.a.name+' remembers: '+(item.a.mind.memories||[]).map(x=>x.text).slice(-2).join(' | ')+'.') : '',
      item.b.mind ? (item.b.name+' remembers: '+(item.b.mind.memories||[]).map(x=>x.text).slice(-2).join(' | ')+'.') : '',
      'Write one short third-person sentence under 20 words about what they talk about. Use only what either person could plausibly know. ' + SAFETY_NOTE,
      'Respond with ONLY this JSON: {"line":"..."}'
    ].filter(Boolean).join('\n');
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

module.exports = { resolveBatch, MODEL, MAX_PER_INVOCATION, buildPrompt };
