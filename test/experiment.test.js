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

test('proposals become evidence only after a canonical physical work action',()=>{
  const s=engine(null,33).snapshot();ensureMinds(s);
  const a=s.agents[0];a.inv.wood=2;a.hunger=0;a.energy=100;a.social=100;
  applyExperimentProposals(s,[{type:'priority',agentId:a.id}],[{experiment:{hypothesis:'Shaped wood might fit together more tightly',operation:'shape',materials:['wood'],hopedResult:'Two pieces sit with less wobble'}}]);
  assert.equal(a.mind.knowledge.some(x=>/Shaped wood/.test(x)),false);
  resolveExperiments(s);
  assert.equal(a.mind.experiments[0].status,'proposed');
  const e=engine(s);for(let i=0;i<45;i++)e.step(.1);
  const after=e.snapshot();resolveExperiments(after);
  const person=after.agents.find(x=>x.id===a.id);
  assert.equal(person.mind.experiments[0].status,'promising');
  assert.equal(person.inv.wood,1);assert.equal(person.inv.timber,1);
  assert.ok(person.mind.beliefs.some(x=>/Shaped wood/.test(x)));
  assert.equal(person.mind.capabilities.length,0);
});

test('two physical results create only the discoverer personal executable recipe',()=>{
  let s=engine(null,34).snapshot();ensureMinds(s);
  let id=s.agents[0].id,a=s.agents[0];a.inv.wood=3;a.hunger=0;a.energy=100;a.social=100;
  const proposal=hypothesis=>({experiment:{hypothesis,operation:'shape',materials:['wood'],hopedResult:'A useful fitted piece'}});
  applyExperimentProposals(s,[{type:'priority',agentId:id}],[proposal('Flattened wood may make a useful piece')]);
  let e=engine(s);for(let i=0;i<45;i++)e.step(.1);s=e.snapshot();resolveExperiments(s);
  a=s.agents.find(x=>x.id===id);a.state='idle';a.action=null;
  applyExperimentProposals(s,[{type:'priority',agentId:id}],[proposal('Shaped wood may repeat the useful result')]);
  e=engine(s);for(let i=0;i<45;i++)e.step(.1);s=e.snapshot();resolveExperiments(s);
  a=s.agents.find(x=>x.id===id);
  assert.ok(a.mind.capabilities.some(x=>x.id==='shape:wood'));
  assert.ok(a.mind.knowledge.includes('Shaping wood repeatedly produces useful timber.'));
  assert.equal(s.agents[1].mind.capabilities.length,0);
});

test('a learned recipe is executable and shaped timber is recorded in visible construction',()=>{
  let s=engine(null,35).snapshot();ensureMinds(s);
  const id=s.agents[0].id,a=s.agents[0];
  a.mind.capabilities.push({id:'shape:wood',kind:'recipe',evidence:2,discoveredDay:s.day});
  a.inv.wood=1;a.inv.timber=0;a.hunger=0;a.energy=100;a.social=100;
  let e=engine(s);for(let i=0;i<100;i++)e.step(.1);s=e.snapshot();
  let person=s.agents.find(x=>x.id===id);
  assert.equal(person.inv.wood,0);assert.ok(s.constructionSites[0].timber>=1);
  person.inv.timber=6;person.state='idle';person.action=null;person.hunger=0;person.energy=100;
  e=engine(s);for(let i=0;i<120;i++)e.step(.1);s=e.snapshot();person=s.agents.find(x=>x.id===id);
  const shelter=s.buildings.find(x=>x.ownerId===id);
  assert.ok(shelter);assert.ok(shelter.materials.timber>0);assert.deepEqual(shelter.methods,['shape:wood']);
  assert.equal(person.home,shelter.id);
});

test('invalid operation is rejected rather than becoming a hidden technology tree',()=>{
  assert.equal(normalizeProposal({hypothesis:'Make a reactor',operation:'nuclear',materials:['stone'],hopedResult:'power'}),null);
});

test('Civorians can establish body patterns without receiving hidden anatomy names',()=>{
  let s=engine(null,39).snapshot();ensureMinds(s);const id=s.agents[0].id;
  const proposal=hypothesis=>({experiment:{hypothesis,operation:'observe',materials:['body'],hopedResult:'A repeating rhythm'}});
  for(let attempt=0;attempt<2;attempt++){
    const a=s.agents.find(x=>x.id===id);a.hunger=0;a.energy=100;a.social=100;a.state='idle';a.action=null;
    applyExperimentProposals(s,[{type:'priority',agentId:id}],[proposal(attempt?'My breath and pulse may repeat again':'My chest and wrist may repeat a rhythm')]);
    const e=engine(s);for(let i=0;i<35;i++)e.step(.1);s=e.snapshot();resolveExperiments(s);
  }
  const a=s.agents.find(x=>x.id===id);assert.ok(a.mind.capabilities.some(x=>x.id==='observe:body'));
  assert.ok(a.mind.knowledge.some(x=>/pulse and breathing/.test(x)));
  const node=s.discoveryGraph.nodes.find(x=>x.id==='observe:body');assert.ok(node);assert.equal(node.kind,'body-observation');
});
