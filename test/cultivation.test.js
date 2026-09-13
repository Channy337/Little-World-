'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ensureCultivation,collectSeed,plantSeed,advanceCultivation,sensoryPlant,hiddenIdentity}=require('../lib/cultivation');

function fixture(){
  const agent={id:1,name:'Aria',x:100,y:100,inv:{food:2},seeds:[],mind:{observations:[],memories:[],capabilities:[],knowledge:[]}};
  const bush={id:1,x:100,y:100,food:3,max:3};
  const state={day:1,nextId:100,agents:[agent],bushes:[bush],plantings:[],weather:{temperatureC:20,soilMoisture:.55}};
  ensureCultivation(state);
  return {state,agent,bush};
}

test('foraged plants contain physical persistent pieces with inherited variation',()=>{
  const {state,agent,bush}=fixture();
  const a=collectSeed(state,agent,bush,1),b=collectSeed(state,agent,bush,2);
  assert.equal(agent.seeds.length,2);
  assert.equal(agent.inv.plantbit,2);
  assert.equal(a.species,b.species);
  assert.deepEqual(a.genome,b.genome);
  assert.ok(a.appearance.length>0);
});

test('wrong depth can prevent germination without changing prior knowledge',()=>{
  const {state,agent,bush}=fixture();collectSeed(state,agent,bush,1);
  const p=plantSeed(state,agent,{x:100,y:100,depthCm:10});
  for(let i=0;i<70;i++){state.day++;advanceCultivation(state,1);}
  assert.notEqual(p.stage,'growing');
  assert.notEqual(p.stage,'mature');
  assert.equal(agent.mind.capabilities.length,0);
});

test('a viable plant piece can germinate under suitable conditions before anyone knows cultivation',()=>{
  const {state,agent,bush}=fixture();collectSeed(state,agent,bush,1);
  const p=plantSeed(state,agent,{x:100,y:100,depthCm:2});
  assert.equal(agent.mind.capabilities.length,0);
  for(let i=0;i<45;i++){state.day++;advanceCultivation(state,1);}
  assert.ok(['growing','mature'].includes(p.stage));
  assert.equal(agent.mind.capabilities.some(x=>String(x.id).startsWith('cultivation:')),false);
});

test('two personally observed successful growth cycles create only that individuals reproducible method',()=>{
  const {state,agent,bush}=fixture();
  for(let run=0;run<2;run++){
    collectSeed(state,agent,bush,state.day);
    const p=plantSeed(state,agent,{x:100+run,y:100,depthCm:2,watered:true});
    for(let i=0;i<190&&p.stage!=='mature';i++){state.day++;advanceCultivation(state,1);}
    assert.equal(p.stage,'mature');
  }
  const cap=agent.mind.capabilities.find(x=>String(x.id).startsWith('cultivation:'));
  assert.ok(cap);
  assert.ok(cap.evidence>=2);
});

test('Civorian sensory plant description never exposes hidden scientific identity',()=>{
  const {state,bush}=fixture();const visible=sensoryPlant(bush),hidden=hiddenIdentity(bush.plantSpecies);
  assert.ok(hidden&&hidden.length>0);
  assert.ok(visible.leafShape&&visible.venation&&visible.seedAppearance);
  assert.doesNotMatch(JSON.stringify(visible),new RegExp(hidden.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
});
