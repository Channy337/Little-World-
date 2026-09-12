'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ensurePerception,sightRange,scan,nearestKnown,sharePlace}=require('../lib/perception');
const createEngine=require('../lib/engine');

function state(){return {day:1,time:.5,weather:{cloudCover:0,precipitationMm:0},pond:{x:20,y:20,level:1},trees:[{id:1,x:40,y:20,wood:2},{id:2,x:400,y:20,wood:2}],rocks:[],bushes:[],farms:[],fires:[],buildings:[]};}

test('personal scans reveal only objects inside current sensory range',()=>{
  const a={id:9,x:20,y:20};scan(state(),a);
  assert.ok(nearestKnown(a,'tree'));assert.equal(nearestKnown(a,'tree').id,1);
  assert.equal(a.perception.knownPlaces.some(x=>x.id===2),false);
});

test('darkness and bad weather reduce sight without changing physical objects',()=>{
  const fair=state(),storm=state();storm.time=0;storm.weather={cloudCover:100,precipitationMm:12};
  assert.ok(sightRange(fair)>sightRange(storm));
});

test('one Civorian can communicate a remembered place without globalizing it',()=>{
  const teacher={id:1,x:0,y:0,perception:{knownPlaces:[{kind:'water',id:'pond',x:90,y:90,lastSeenDay:1,lastSeenAvailable:true,source:'seen'}]}};
  const learner={id:2,x:0,y:0};assert.ok(sharePlace(teacher,learner,2));assert.equal(nearestKnown(learner,'water').source,'told-by-1');
});

test('fresh Civorians know nearby water but not the whole map',()=>{
  const s=createEngine(null,901).snapshot();
  for(const a of s.agents){ensurePerception(a);assert.ok(nearestKnown(a,'water'));assert.ok(a.perception.knownPlaces.length<s.trees.length+s.rocks.length+s.bushes.length+1);}
});
