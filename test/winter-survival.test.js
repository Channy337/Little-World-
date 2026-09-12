'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {growthMultiplier,travelMultiplier,windChillC}=require('../lib/weather');
const {createBody,advanceBody}=require('../lib/biology');
const {ensureEcology,advance:advanceEcology}=require('../lib/ecology');
const {evaluatePrototype}=require('../lib/mechanics');

function person(){return {health:100,hunger:10,thirst:0,body:createBody(()=>.5),inv:{food:0},foodItems:[],foodExperience:{},wasteClock:0};}

test('winter snow suppresses food growth and slows travel',()=>{
  const summer={season:'summer',temperatureC:25,soilMoisture:.6,snowDepthCm:0,windKph:8,hazard:null};
  const winter={season:'winter',temperatureC:-6,soilMoisture:.6,snowDepthCm:18,windKph:35,hazard:'blizzard'};
  assert.ok(growthMultiplier(winter)<growthMultiplier(summer)*.2);
  assert.ok(travelMultiplier(winter)<.6);
  assert.ok(windChillC(-6,35)<-6);
});

test('exposed severe cold drains more fuel and body heat than shelter',()=>{
  const weather={season:'winter',temperatureC:-12,feelsLikeC:-22,precipitationMm:9,snowDepthCm:16,windKph:38,hazard:'blizzard'};
  const exposed=person(),sheltered=person();
  advanceBody(exposed,{weather,active:false,sheltered:false,days:2,waterLossPerDay:24});
  advanceBody(sheltered,{weather,active:false,sheltered:true,days:2,waterLossPerDay:24});
  assert.ok(exposed.body.coreTemperature<sheltered.body.coreTemperature);
  assert.ok(exposed.body.fatReserveDays<sheltered.body.fatReserveDays);
  assert.ok(exposed.health<sheltered.health);
  assert.match(exposed.body.lastSymptoms.join(' '),/cold|shivering|clumsy/i);
});

test('deep winter makes grazing animals scarcer and shifts their range',()=>{
  const state={day:280,nextId:1,worldBounds:{w:480,h:304},pond:{x:220,y:272,contamination:4},bushes:[],farms:[],agents:[],animals:[{id:1,kind:'small-grazer',x:310,y:202,population:10,visible:true}],soil:{moisture:50,nutrients:70},weather:{season:'winter',temperatureC:-5,snowDepthCm:20,hazard:'blizzard',precipitationMm:4}};
  ensureEcology(state);const startX=state.animals[0].x,startPop=state.animals[0].population;
  advanceEcology(state,5);
  assert.ok(state.animals[0].population<startPop);
  assert.ok(state.animals[0].x>startX);
  assert.ok(state.animals[0].winterScarcity>0);
});

test('flexible hide and fiber sheets can physically insulate without a clothing unlock',()=>{
  const hide=evaluatePrototype({operation:'shape',materials:['hide'],form:'sheet',makerId:1,day:1});
  const fiber=evaluatePrototype({operation:'shape',materials:['fiber'],form:'sheet',makerId:1,day:1});
  assert.equal(hide.success,true);assert.equal(fiber.success,true);
  assert.ok(hide.functions.includes('can reduce heat loss when wrapped around a body'));
  assert.ok(fiber.functions.includes('can reduce heat loss when wrapped around a body'));
});

test('viewer travel layer responds to snow and severe weather without becoming authoritative',()=>{
  const js=fs.readFileSync('activity-clock.js','utf8');
  assert.match(js,/weatherTravelFactor/);
  assert.match(js,/snowDepthCm/);
  assert.match(js,/blizzard/);
  assert.doesNotMatch(js,/POST|localStorage/);
});
