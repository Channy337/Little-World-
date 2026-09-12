'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {ensureEcology,canConsume,consume,foodSummary}=require('../lib/ecology');

function stateWith(agent,day=10){return {day,nextId:50,agents:[agent],animals:[],waste:[],soil:{moisture:55,nutrients:70},pond:{x:0,y:0,contamination:0},bushes:[],farms:[],worldBounds:{w:480,h:304},weather:{}};}
function baseAgent(){return {id:1,inv:{food:1,fiber:0},foodItems:[],foodExperience:{},wasteClock:0};}

test('known-dangerous carried food no longer counts as an available meal',()=>{
  const a=baseAgent();
  a.foodItems=[{appearance:'broad bitter leaves',calories:90,water:30,toxin:18,gatheredDay:1,spoilsDay:20,spoiled:false}];
  a.foodExperience={'broad bitter leaves':-2};
  ensureEcology(stateWith(a));
  assert.equal(a.inv.food,0);
  assert.equal(a.foodState.carried,1);
  assert.equal(a.foodState.usable,0);
  assert.equal(a.foodState.dangerous,1);
  assert.equal(canConsume(a),false);
  assert.equal(consume(a,10),null);
});

test('spoiled carried food is tracked separately and does not masquerade as edible food',()=>{
  const a=baseAgent();
  a.foodItems=[{appearance:'small dull-red fruit',calories:420,water:18,toxin:0,gatheredDay:1,spoilsDay:5,spoiled:false}];
  ensureEcology(stateWith(a,10));
  assert.equal(a.inv.food,0);
  assert.equal(a.foodState.carried,1);
  assert.equal(a.foodState.spoiled,1);
  assert.equal(a.foodState.usable,0);
  assert.equal(canConsume(a),false);
});

test('fresh food a Civorian has not rejected remains usable and is consumed reliably',()=>{
  const a=baseAgent();
  a.foodItems=[{appearance:'small dull-red fruit',calories:420,water:18,toxin:0,gatheredDay:9,spoilsDay:14,spoiled:false}];
  ensureEcology(stateWith(a,10));
  assert.equal(a.inv.food,1);
  assert.equal(a.foodState.risky,1);
  assert.equal(canConsume(a),true);
  const meal=consume(a,10);
  assert.equal(meal.appearance,'small dull-red fruit');
  assert.equal(a.inv.food,0);
  assert.equal(a.foodState.carried,0);
});

test('generic stored food remains edible and external harvest additions reconcile into food stock',()=>{
  const a=baseAgent();
  a.inv.food=2;
  ensureEcology(stateWith(a,10));
  assert.equal(a.foodStock,2);
  assert.equal(a.foodState.usable,2);
  assert.equal(consume(a,10).appearance,'stored food');
  assert.equal(a.inv.food,1);
  a.inv.food+=3;
  ensureEcology(stateWith(a,10));
  assert.equal(a.foodStock,4);
  assert.equal(a.foodState.usable,4);
});

test('food summary exposes carried, safe, risky, spoiled, and dangerous buckets',()=>{
  const a=baseAgent();
  a.foodStock=1;
  a.foodItems=[
    {appearance:'safe',spoiled:false},
    {appearance:'unknown',spoiled:false},
    {appearance:'spoiled',spoiled:true},
    {appearance:'danger',spoiled:false}
  ];
  a.foodExperience={safe:2,unknown:0,spoiled:2,danger:-2};
  assert.deepEqual(foodSummary(a,10),{carried:5,usable:3,safe:2,risky:1,spoiled:1,dangerous:1,generic:1});
});
