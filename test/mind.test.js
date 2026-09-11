const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../lib/engine');
const {ensureMinds,observeExperience,enrichAIQueue,applyReflections,summarizeMind}=require('../lib/mind');
const {buildPrompt}=require('../lib/ai');

test('existing villagers are upgraded with bounded persistent minds',()=>{
  const s=engine(null,42).snapshot();
  assert.equal(s.agents[0].mind,undefined);
  ensureMinds(s);
  const m=s.agents[0].mind;
  assert.equal(m.version,1);
  assert.ok(Array.isArray(m.memories));
  assert.ok(Array.isArray(m.knowledge));
  assert.ok(Number.isFinite(m.emotions.curiosity));
  assert.ok(Number.isFinite(m.skills.woodcutting));
  const restored=JSON.parse(JSON.stringify(s));
  ensureMinds(restored);
  assert.deepEqual(restored.agents[0].mind,m);
});

test('lived experience creates skill, knowledge, memory and emotion changes',()=>{
  const before=engine(null,7).snapshot();
  ensureMinds(before);
  const after=JSON.parse(JSON.stringify(before));
  const a0=before.agents[0], a1=after.agents[0];
  a1.inv.wood+=1;
  a1.hunger=96;
  a1.energy=18;
  after.day=4;
  observeExperience(before,after);
  assert.ok(a1.mind.skills.woodcutting>0);
  assert.ok(a1.mind.knowledge.includes('Trees can provide wood when worked.'));
  assert.ok(a1.mind.memories.some(m=>m.text==='I gathered wood from a tree.'));
  assert.ok(a1.mind.emotions.stress>before.agents[0].mind.emotions.stress);
  assert.ok(a1.mind.emotions.fear>0);
});

test('social experience changes individual relationships without global knowledge',()=>{
  const before=engine(null,11).snapshot();
  ensureMinds(before);
  const after=JSON.parse(JSON.stringify(before));
  const a=after.agents[0], b=after.agents[1];
  const old=before.agents[0];
  old.state='socializing'; old.action={partnerId:b.id};
  a.state='idle';
  observeExperience(before,after);
  assert.ok(a.mind.relationships[String(b.id)].familiarity>0);
  assert.equal(a.mind.relationships[String(after.agents[2].id)],undefined);
});

test('AI request receives only the selected villager mind summary',()=>{
  const s=engine(null,19).snapshot();
  ensureMinds(s);
  s.agents[0].mind.knowledge.push('I learned a private fact.');
  s.agents[1].mind.knowledge.push('Another person knows a different fact.');
  const q=[{type:'priority',agentId:s.agents[0].id,name:s.agents[0].name,trait:s.agents[0].trait,role:'undecided',hunger:20,energy:80,social:70,food:0,wood:0,stone:0,coins:0,hasHome:false,day:s.day,timeOfDay:'Morning',nearby:'nobody nearby',world:null}];
  const enriched=enrichAIQueue(q,s);
  const prompt=buildPrompt(enriched[0]);
  assert.match(prompt,/I learned a private fact/);
  assert.doesNotMatch(prompt,/Another person knows a different fact/);
  assert.match(prompt,/must not magically know/);
});

test('AI reflection can update goals and beliefs without changing engine facts',()=>{
  const s=engine(null,23).snapshot();
  ensureMinds(s);
  const a=s.agents[0];
  const q=[{type:'priority',agentId:a.id}];
  applyReflections(s,q,[{goal:'Find enough food for tomorrow',reflection:'I should prepare earlier',lesson:'Hunger makes work harder',belief:'Planning ahead feels safer'}]);
  const m=summarizeMind(a,s);
  assert.equal(m.goal,'Find enough food for tomorrow');
  assert.equal(m.reflection,'I should prepare earlier');
  assert.ok(m.beliefs.includes('Planning ahead feels safer'));
  assert.ok(m.memories.some(x=>x.text==='Hunger makes work harder'));
});
