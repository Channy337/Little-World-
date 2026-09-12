'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const createEngine=require('../lib/engine');
const {ensureMinds}=require('../lib/mind');

test('primitive Civorians have thirst, health, pain, and no death protection',()=>{
  const s=createEngine(null,71).snapshot(),a=s.agents[0];
  assert.ok(Number.isFinite(a.thirst));assert.equal(a.health,100);assert.equal(a.pain,0);
  assert.equal(a.dead,false);
});

test('urgent thirst drives a Civorian to water and drinking relieves it',()=>{
  let s=createEngine(null,72).snapshot(),id=s.agents[0].id,a=s.agents[0];a.x=s.pond.x;a.y=s.pond.y;a.thirst=90;a.hunger=0;a.energy=100;a.social=100;
  const e=createEngine(s);for(let i=0;i<20;i++)e.step(.1);s=e.snapshot();a=s.agents.find(x=>x.id===id);
  assert.ok(a.thirst<30);
});

test('close fire causes physical injury and sensory learning',()=>{
  let s=createEngine(null,73).snapshot(),id=s.agents[0].id,a=s.agents[0];ensureMinds(s);s.fires=[{id:999,x:a.x,y:a.y,intensity:1,fuel:2,temperature:700}];
  const e=createEngine(s);e.step(.1);s=e.snapshot();a=s.agents.find(x=>x.id===id);
  assert.ok(a.health<100);assert.ok(a.pain>0);
  assert.ok(a.mind.observations.some(x=>/heat and pain/.test(x.text)));
});

test('fatal injury removes a Civorian from the living population',()=>{
  let s=createEngine(null,74).snapshot(),a=s.agents[0],id=a.id;a.health=0;
  const e=createEngine(s);e.step(.1);s=e.snapshot();
  assert.equal(s.agents.some(x=>x.id===id),false);
  assert.ok(s.chronicle.some(x=>x.type==='death'&&/burn injuries/.test(x.msg)));
});

test('a primitive month is not mechanically guaranteed to cause extinction',()=>{
  let s=createEngine(null,1).snapshot();ensureMinds(s);const e=createEngine(s);for(let i=0;i<16500;i++)e.step(.1);s=e.snapshot();
  assert.ok(s.agents.length>0&&s.agents.length<=9);
});

test('a tired Civorian sleeps even without a home and sleep is a physical action',()=>{
  let s=createEngine(null,75).snapshot(),id=s.agents[0].id,a=s.agents[0];
  s.time=.9;a.state='idle';a.action=null;a.hunger=0;a.energy=80;a.social=100;a.thirst=0;
  a.body.sleepPressure=92;a.body.awakeHours=19;a.body.sleepDebtHours=2;
  const e=createEngine(s);e.step(.1);s=e.snapshot();a=s.agents.find(x=>x.id===id);
  assert.equal(a.state,'resting');assert.equal(a.action.sleep,true);assert.equal(a.action.home,false);
});
