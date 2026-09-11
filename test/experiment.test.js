const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../lib/engine');
const {ensureMinds}=require('../lib/mind');
const {normalizeProposal,applyExperimentProposals,resolveExperiments}=require('../lib/experiment');

test('experiment proposals are open-ended but use grounded operations and carried materials',()=>{
  const s=engine(null,31).snapshot();ensureMinds(s);
  const a=s.agents[0];a.inv.wood=2;
  const q=[{type:'priority',agentId:a.id}];
  applyExperimentProposals(s,q,[{experiment:{hypothesis:'Stacked wood might support more weight',operation:'stack',materials:['wood'],hopedResult:'The stack stays upright longer'}}]);
  assert.equal(a.mind.experiments.length,1);
  assert.equal(a.mind.experiments[0].status,'proposed');
  assert.match(a.mind.memories.at(-1).text,/Stacked wood/);
});

test('a villager cannot test with materials they do not possess',()=>{
  const s=engine(null,32).snapshot();ensureMinds(s);
  const a=s.agents[0];a.inv.stone=0;
  applyExperimentProposals(s,[{type:'priority',agentId:a.id}],[{experiment:{hypothesis:'Stone might hold heat',operation:'heat',materials:['stone'],hopedResult:'Stone remains warm'}}]);
  assert.equal((a.mind.experiments||[]).length,0);
  assert.ok(a.mind.memories.some(x=>/do not have what I need/.test(x.text)));
});

test('proposals do not become facts immediately and resolve only after time passes',()=>{
  const s=engine(null,33).snapshot();ensureMinds(s);
  const a=s.agents[0];a.inv.wood=2;a.mind.emotions.curiosity=100;a.mind.emotions.stress=0;a.mind.skills.woodcutting=100;a.mind.experience=30;
  applyExperimentProposals(s,[{type:'priority',agentId:a.id}],[{experiment:{hypothesis:'Shaped wood might fit together more tightly',operation:'shape',materials:['wood'],hopedResult:'Two pieces sit with less wobble'}}]);
  assert.equal(a.mind.knowledge.some(x=>/Shaped wood/.test(x)),false);
  resolveExperiments(s);
  assert.equal(a.mind.experiments[0].status,'proposed');
  s.day++;
  resolveExperiments(s);
  assert.equal(a.mind.experiments[0].status,'promising');
  assert.ok(a.mind.beliefs.some(x=>/Shaped wood/.test(x)));
  assert.equal(a.mind.knowledge.some(x=>/Shaped wood/.test(x)),false);
});

test('invalid operation is rejected rather than becoming a hidden technology tree',()=>{
  assert.equal(normalizeProposal({hypothesis:'Make a reactor',operation:'nuclear',materials:['stone'],hopedResult:'power'}),null);
});
