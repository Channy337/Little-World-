'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ANATOMY,HOURS_PER_DAY,createBody,advanceBody,advanceSleep,circadianSleepDrive,sleepNeed,sleepQuality,functionalCapacity,drink,eat,observation}=require('../lib/biology');

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

test('the biological clock produces more sleep drive at night than in daylight',()=>{
  assert.equal(HOURS_PER_DAY,24);
  const a=person();a.body.circadianOffsetHours=0;a.body.sleepPressure=45;a.body.sleepDebtHours=0;
  assert.ok(circadianSleepDrive(a.body,3/24)>circadianSleepDrive(a.body,15/24));
  assert.ok(sleepNeed(a.body,3/24)>sleepNeed(a.body,15/24));
});

test('wakefulness builds sleep pressure and real sleep relieves it',()=>{
  const a=person();a.body.sleepPressure=20;a.body.awakeHours=0;
  advanceSleep(a,{timeOfDay:.75,days:16/24,sleeping:false});
  assert.ok(a.body.sleepPressure>80);assert.equal(a.body.awakeHours,16);
  advanceSleep(a,{timeOfDay:.1,days:8/24,sleeping:true,sheltered:true,weather:{temperatureC:18}});
  assert.ok(a.body.sleepPressure<20);assert.equal(a.body.awakeHours,0);assert.ok(a.body.sleepEpisodeHours>=8);
});

test('weather and shelter change sleep quality without granting that knowledge',()=>{
  const a=person();a.thirst=0;a.hunger=0;
  const indoors=sleepQuality(a,{sheltered:true,weather:{temperatureC:4,precipitationMm:8,windKph:40}});
  const exposed=sleepQuality(a,{sheltered:false,weather:{temperatureC:4,precipitationMm:8,windKph:40}});
  assert.ok(indoors>exposed);
});

test('extreme sleep deprivation reduces alertness, function, and eventually health',()=>{
  const a=person();a.body.sleepPressure=20;a.body.awakeHours=0;
  for(let i=0;i<3;i++)advanceSleep(a,{timeOfDay:.5,days:1,sleeping:false});
  assert.ok(a.body.sleepDebtHours>24);assert.ok(a.body.alertness<30);assert.ok(functionalCapacity(a.body)<.65);assert.ok(a.health<100);
});
