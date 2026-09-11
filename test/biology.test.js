'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ANATOMY,createBody,advanceBody,drink,eat,observation}=require('../lib/biology');

function person(){return {health:100,hunger:0,thirst:0,body:createBody(()=>.5)}}

test('human anatomy exists as hidden truth without automatic vocabulary',()=>{
  assert.ok(ANATOMY.heart&&ANATOMY.kidneys&&ANATOMY.brain);
  const sensed=observation(0);assert.deepEqual(sensed.terms,[]);assert.match(sensed.evidence.join(' '),/pulse/);
  assert.ok(observation(2).terms.includes('heart'));
});

test('water survival emerges from body reserves and environment rather than a fixed timer',()=>{
  const a=person(),weather={temperatureC:18};let cause=null,days=0;
  while(!cause&&days<10){cause=advanceBody(a,{weather,days:.1,waterLossPerDay:24});days+=.1;}
  assert.ok(days>3&&days<7);assert.match(cause,/dehydration/);
  const b=person();advanceBody(b,{weather,days:2,waterLossPerDay:24});drink(b,70);assert.ok(b.body.waterReserve>90);
});

test('food deprivation consumes glycogen, then fat, then muscle over weeks',()=>{
  const a=person(),weather={temperatureC:18};a.body.waterReserve=100;
  for(let day=0;day<20;day++){advanceBody(a,{weather,days:1,waterLossPerDay:0});}
  assert.equal(a.body.glycogenReserve,0);assert.ok(a.body.fatReserveDays>0);assert.ok(a.health>0);
  let cause=null;for(let day=0;day<80&&!cause;day++)cause=advanceBody(a,{weather,days:1,waterLossPerDay:0});
  assert.match(cause,/starvation/);assert.ok(a.body.muscleReserve<30);
});

test('food replenishes short-term fuel before adding a small long-term reserve',()=>{
  const a=person();a.body.glycogenReserve=0;a.body.fatReserveDays=10;a.body.fastingDays=2;eat(a,1);
  assert.equal(a.body.glycogenReserve,68);assert.ok(a.body.fatReserveDays>10);assert.ok(a.body.fastingDays<2);
});
