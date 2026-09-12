'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const createEngine=require('../lib/engine');
const {TRAITS,makeFounderHeritage,inheritHeritage,ensureHeritage,describe}=require('../lib/heritage');

test('founders have neutral polygenic appearance instead of a race behavior category',()=>{
  const s=createEngine(null,920).snapshot(),values=s.agents.map(a=>a.heritage.phenotype.melanin);
  assert.ok(values.every(x=>x>=0&&x<=1));assert.ok(new Set(values.map(x=>x.toFixed(2))).size>1);
  for(const a of s.agents){assert.equal(Object.hasOwn(a.heritage,'race'),false);assert.equal(Object.hasOwn(a.heritage,'intelligence'),false);}
});

test('a child receives one allele per locus from each parent',()=>{
  const heritage=value=>{const genome={};for(const [trait,count] of Object.entries(TRAITS))genome[trait]=Array.from({length:count},()=>[value,value]);return {genome};};
  const a={id:1,name:'A',heritage:heritage(.2)},b={id:2,name:'B',heritage:heritage(.8)};
  const child=inheritHeritage(a,b,()=>.5);
  for(const [trait,count] of Object.entries(TRAITS))for(let i=0;i<count;i++)assert.deepEqual(child.genome[trait][i],[.2,.8]);
  assert.equal(child.phenotype.melanin,.5);
});

test('legacy villagers gain stable appearance without consuming hidden knowledge',()=>{
  const a={id:7,name:'Rosk'},first=structuredClone(ensureHeritage(a));delete a.heritage;const second=ensureHeritage(a);
  assert.deepEqual(second,first);assert.ok(describe(a).hair);assert.equal(a.knowledge,undefined);
});

test('conception preserves inherited traits even if a parent later disappears',()=>{
  let s=createEngine(null,921).snapshot(),mother=s.agents.find(a=>a.life.sex==='female'),father=s.agents.find(a=>a.life.sex==='male');
  const expected=inheritHeritage(mother,father,()=>.5);mother.life.pregnancy={otherParentId:father.id,remainingDays:.001,conceivedDay:s.day,childHeritage:expected};
  s.agents=s.agents.filter(a=>a.id!==father.id);const e=createEngine(s);e.step(.1);s=e.snapshot();
  const child=s.agents.find(a=>a.age<.01);assert.ok(child);assert.deepEqual(child.heritage,expected);assert.deepEqual(child.life.parents,[mother.id,father.id]);
});

test('AI receives only visible appearance descriptions, not a race label',()=>{
  let s=createEngine(null,922).snapshot(),id=s.agents[0].id;s.agents[0].aiCooldown=0;const e=createEngine(s);e.step(.1);
  const item=e.drainAIRequests().queue.find(x=>x.agentId===id);assert.ok(item.appearance.skin);assert.match(item.nearby,/skin/);assert.equal(item.race,undefined);
});
