'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const createEngine=require('../lib/engine');
const {ensureMinds}=require('../lib/mind');
const {ensureKnowledgeSystem,recordDiscovery,refreshHolders,transferKnowledge,createRecord}=require('../lib/knowledge');
const {resolveExperiments}=require('../lib/experiment');

function world(){const s=createEngine(null,91).snapshot();ensureMinds(s);ensureKnowledgeSystem(s);return s}

test('unshared knowledge dies with its last living holder',()=>{
  const s=world(),a=s.agents[0];recordDiscovery(s,{id:'test:secret',label:'A private method',agentId:a.id,day:s.day});
  s.agents=s.agents.filter(x=>x.id!==a.id);refreshHolders(s);
  assert.equal(s.discoveryGraph.nodes[0].status,'lost');
});

test('conversation transfers an instruction, not hidden executable knowledge',()=>{
  const s=world(),teacher=s.agents[0],learner=s.agents[1];teacher.mind.capabilities.push({id:'shape:wood',kind:'recipe',evidence:2,discoveredDay:1});
  let taught=null;for(let day=1;day<100&&!taught;day++){s.day=day;taught=transferKnowledge(s,teacher,learner)}
  assert.equal(taught,'shape:wood');
  assert.equal(learner.mind.instructions[0].status,'heard');
  assert.equal(learner.mind.capabilities.some(x=>x.id==='shape:wood'),false);
});

test('a taught method becomes executable only after the learner reproduces it twice',()=>{
  let s=world(),learner=s.agents[1],id=learner.id;learner.mind.instructions.push({id:'shape:wood',sourceAgentId:s.agents[0].id,day:1,status:'heard'});learner.inv.wood=3;learner.hunger=0;learner.energy=100;learner.social=100;
  for(let attempt=0;attempt<2;attempt++){
    const e=createEngine(s);for(let i=0;i<45;i++)e.step(.1);s=e.snapshot();resolveExperiments(s);learner=s.agents.find(x=>x.id===id);learner.state='idle';learner.action=null;
  }
  assert.ok(learner.mind.capabilities.some(x=>x.id==='shape:wood'));
  assert.equal(learner.mind.instructions[0].status,'validated');
});

test('durable knowledge requires both invented writing and a literate author',()=>{
  const s=world(),a=s.agents[0];a.mind.capabilities.push({id:'shape:wood',kind:'recipe',evidence:2,discoveredDay:1});
  assert.equal(createRecord(s,a,['shape:wood'],'clay'),null);
  a.mind.capabilities.push({id:'symbolic-writing'},{id:'durable-recording'});a.literacy=true;a.literacySystem='marks-v1';
  const record=createRecord(s,a,['shape:wood'],'clay');assert.ok(record);
  recordDiscovery(s,{id:'shape:wood',label:'Shaping wood',agentId:a.id,day:1});s.agents=s.agents.filter(x=>x.id!==a.id);refreshHolders(s);
  assert.equal(s.discoveryGraph.nodes[0].status,'recorded');
});
