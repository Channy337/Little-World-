'use strict';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_PER_HEARTBEAT = 8;
const ROLES = ['woodcutter', 'farmer', 'miner', 'trader'];

function sanitizeText(value) {
  try {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, 90);
  } catch { return ''; }
}

function validateFocus(value, state, agent) {
  if(typeof value !== 'string') return null;
  const focus = sanitizeText(value);
  if(focus === 'wander') return focus;
  if(['visit:well', 'visit:pond', 'visit:market'].includes(focus)) {
    return state[focus.slice(6)] ? focus : null;
  }
  if(focus.startsWith('work:') && ROLES.includes(focus.slice(5)) && focus.slice(5) !== agent.role) return focus;
  if(focus.startsWith('seek:') && state.agents.some(a => !a.dead && a.id !== agent.id && a.name === focus.slice(5))) return focus;
  return null;
}

// Native fetch keeps this client dependency-free. The batch supplies its abort signal.
async function requestThought(agent, state, {signal, env = process.env, fetchImpl = fetch} = {}) {
  if(env.CIVORIA_AI !== 'on' || !env.ANTHROPIC_API_KEY) return null;
  const intentions = ['wander', ...['well', 'pond', 'market'].filter(k => state[k]).map(k => 'visit:' + k),
    ...ROLES.filter(r => r !== agent.role).map(r => 'work:' + r),
    ...state.agents.filter(a => !a.dead && a.id !== agent.id).map(a => 'seek:' + a.name)];
  const context = {name:agent.name, trait:agent.trait, role:agent.role, hunger:agent.hunger,
    energy:agent.energy, social:agent.social, day:state.day};
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method:'POST', signal,
    headers:{'content-type':'application/json', 'x-api-key':env.ANTHROPIC_API_KEY, 'anthropic-version':'2023-06-01'},
    body:JSON.stringify({model:MODEL, max_tokens:120, messages:[{role:'user', content:
      'Choose one small personal intention for this comfortable villager. Return only JSON with focus and thought. ' +
      'thought is a first-person reason in one sentence, at most 90 characters. Choose focus exactly from the allowed list. ' +
      JSON.stringify({villager:context, allowed:intentions})}]})
  });
  if(!response.ok) return null;
  const data = await response.json();
  return JSON.parse(data.content.filter(b => b.type === 'text').map(b => b.text).join(''));
}

async function resolvePending(state, {env = process.env, request = requestThought, timeoutMs = 4000,
  budget = {remaining:MAX_PER_HEARTBEAT}} = {}) {
  const requesters = state.agents.filter(a => a.aiPending);
  // Clear everybody, including dead, uncomfortable and over-cap villagers. No backlog.
  for(const a of requesters) a.aiPending = false;
  if(env.CIVORIA_AI !== 'on') return;
  const selected = requesters.filter(a => !a.dead && a.hunger < 60 && a.energy > 35)
    .slice(0, Math.max(0, Math.min(MAX_PER_HEARTBEAT, budget.remaining)));
  budget.remaining -= selected.length;
  await Promise.all(selected.map(async agent => {
    const id = agent.id;
    const controller = new AbortController();
    let timer;
    try {
      // Race covers the entire response, including JSON parsing and clients ignoring abort.
      const timeout = new Promise(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs);
      });
      const answer = await Promise.race([
        Promise.resolve().then(() => request(structuredClone(agent), structuredClone(state), {signal:controller.signal, env})),
        timeout
      ]);
      const current = state.agents.find(a => a.id === id && !a.dead);
      if(!current || !answer || typeof answer !== 'object') return;
      const focus = validateFocus(answer.focus, state, current);
      if(!focus) return;
      current.aiFocus = focus;
      current.aiThought = sanitizeText(answer.thought);
    } catch {
      // Invalid text, unavailable upstreams and timeouts never prevent world persistence.
    } finally { clearTimeout(timer); }
  }));
}

module.exports = {MODEL, MAX_PER_HEARTBEAT, sanitizeText, validateFocus, requestThought, resolvePending};
