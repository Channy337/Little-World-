'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const createEngine=require('../lib/engine');
const {ensureMinds}=require('../lib/mind');
const {applyExperimentProposals,resolveExperiments}=require('../lib/experiment');
const {WORLD_CONSTANTS,part,assemble,evaluatePrototype,performance}=require('../lib/mechanics');
const {ensureEcology,forage,consume,canConsume,recordFoodOutcome,drinkRisk,addWaste}=require('../lib/ecology');
const {ensureHealth,wound,inhaleSmoke,exposePathogens,symptoms,advanceHealth}=require('../lib/health');
const {ensureLife,sleepRequirementHours,tryConceive,advancePregnancies,careForDependent}=require('../lib/lifecycle');
const {ensureCulture,interact,clarity,refreshInstitutions}=require('../lib/communication');

test('mechanisms use world constants and material properties instead of named technology unlocks',()=>{
  assert.equal(WORLD_CONSTANTS.gravity,9.81);const surface=part('wood','sheet'),beam=part('wood','long');
  const joined=assemble([surface,beam],[{a:0,b:1,type:'bind'}]);assert.ok(joined.functions.includes('can generate lift while moving through air'));
  const prototype=evaluatePrototype({operation:'bind',materials:['wood','fiber'],form:'sheet'});assert.equal(prototype.success,true);
  assert.equal(performance(prototype,{speed:12,fluid:'air'}).liftPossible,true);
});

test('a fresh primitive world contains no inherited well or farms',()=>{
  const s=createEngine(null,909).snapshot();assert.equal(s.well,null);assert.deepEqual(s.farms,[]);
});

test('a repeated property-based prototype becomes a personal reproducible artifact capability',()=>{
  let s=createEngine(null,910).snapshot();ensureMinds(s);const id=s.agents[0].id;
  const proposal=n=>({experiment:{hypothesis:'A hard narrow form may focus my push '+n,operation:'shape',materials:['stone'],form:'pointed',hopedResult:'The end presses into softer matter'}});
  for(let attempt=0;attempt<2;attempt++){
    const a=s.agents.find(x=>x.id===id);a.inv.stone=3;a.hunger=0;a.energy=100;a.social=100;a.state='idle';a.action=null;
    applyExperimentProposals(s,[{type:'priority',agentId:id}],[proposal(attempt)]);const e=createEngine(s);for(let i=0;i<45;i++)e.step(.1);s=e.snapshot();resolveExperiments(s);
  }
  let a=s.agents.find(x=>x.id===id),cap=a.mind.capabilities.find(x=>x.id==='shape:stone:pointed');assert.ok(cap&&cap.method);assert.equal(a.artifacts.length,2);
  a.inv.stone=1;a.aiFocus='work';a.state='idle';a.action=null;const e=createEngine(s);for(let i=0;i<45;i++)e.step(.1);a=e.snapshot().agents.find(x=>x.id===id);assert.equal(a.artifacts.length,3);
});

test('food has hidden species effects, spoilage, and no automatic safety label',()=>{
  const state={day:1,nextId:20,pond:{x:0,y:0,contamination:12},bushes:[{id:4,species:'redDrupe'}],agents:[],animals:[],waste:[],soil:{moisture:50,nutrients:70},farms:[]};ensureEcology(state);
  const a={inv:{food:0,fiber:0},foodItems:[]},item=forage(a,state.bushes[0],1);assert.match(item.appearance,/fruit/);assert.equal(Object.hasOwn(item,'edible'),false);
  const meal=consume(a,10);assert.equal(meal.spoiled,true);assert.ok(meal.toxin>0);assert.ok(drinkRisk(state)>0);
  addWaste(state,{x:1,y:1});assert.ok(state.pond.contamination>12);
});

test('a Civorian can personally reject harmful-looking food without being trapped trying to eat it',()=>{
  const a={inv:{food:1},foodItems:[{appearance:'broad bitter leaves',toxin:18}],foodExperience:{}};
  recordFoodOutcome(a,a.foodItems[0]);assert.equal(a.foodExperience['broad bitter leaves'],-2);
  assert.equal(canConsume(a),false);assert.equal(consume(a,1),null);assert.equal(a.inv.food,1);

  let s=createEngine(null,911).snapshot(),person=s.agents[0];
  s.time=.95;person.hunger=90;person.energy=80;person.social=100;person.thirst=0;
  person.inv.food=1;person.foodItems=[{appearance:'broad bitter leaves',toxin:18,gatheredDay:1,spoilsDay:5}];
  person.foodExperience={'broad bitter leaves':-2};person.body.sleepPressure=92;person.body.awakeHours=19;person.body.sleepDebtHours=2;
  const e=createEngine(s);e.step(.1);person=e.snapshot().agents.find(x=>x.id===person.id);
  assert.equal(person.state,'resting');assert.equal(person.action.sleep,true);
});

test('wounds, bleeding, infection, smoke, and oxygen are physical health state',()=>{
  const a={health:100,pain:0,body:{lastSymptoms:[]}};ensureHealth(a);wound(a,{severity:30,contamination:35});inhaleSmoke(a,30);exposePathogens(a,25);
  assert.ok(symptoms(a).length>0);for(let i=0;i<5;i++)advanceHealth(a,{days:1,resting:false});
  assert.ok(a.healthState.bloodVolume<100);assert.ok(a.healthState.infectionLoad>0);
});

test('pregnancy takes time and young children depend on living carers',()=>{
  const mother={id:1,age:25,health:100,energy:100,x:0,y:0,body:{waterReserve:100,glycogenReserve:100},life:{sex:'female',parents:[],pregnancy:null,stage:'adult',dependentUntil:12}};
  const father={id:2,age:27,health:100,energy:100,x:0,y:0,life:{sex:'male',parents:[],pregnancy:null,stage:'adult',dependentUntil:12}};
  assert.equal(tryConceive(mother,father,1,.1),mother);const state={agents:[mother,father]};assert.equal(advancePregnancies(state,269).length,0);assert.equal(advancePregnancies(state,1).length,1);
  const child={id:3,age:1,health:100,hunger:60,thirst:50,x:1,y:1,body:{waterReserve:50,glycogenReserve:20},life:{sex:'female',parents:[1,2],pregnancy:null,stage:'infant',dependentUntil:12}};
  state.agents.push(child);assert.equal(careForDependent(state,child,1),true);assert.ok(child.hunger<60);
});

test('human life stages have age-dependent sleep requirements',()=>{
  assert.equal(sleepRequirementHours({id:1,age:0}),14);
  assert.equal(sleepRequirementHours({id:2,age:7}),10);
  assert.equal(sleepRequirementHours({id:3,age:15}),9);
  assert.equal(sleepRequirementHours({id:4,age:30}),8);
});

test('a dependent child completes a longer physical sleep episode',()=>{
  let s=createEngine(null,912).snapshot(),child=s.agents[0],id=child.id;
  child.age=7;child.life.stage='child';child.life.parents=[];child.hunger=0;child.thirst=0;child.energy=50;
  child.state='resting';child.action={home:false,sleep:true,forced:false,timer:40};child.body.sleepEpisodeHours=0;child.body.sleepPressure=90;
  const e=createEngine(s);let longest=0;for(let i=0;i<260;i++){e.step(.1);child=e.snapshot().agents.find(x=>x.id===id);longest=Math.max(longest,child.body.sleepEpisodeHours);}
  assert.ok(child);assert.ok(longest>=10);assert.equal(child.state,'idle');
});

test('communication conventions and institutions emerge from repeated shared behavior',()=>{
  const a={id:1,communication:{gestureSkill:12,vocalSkill:3,encounters:0,conventions:[]},mind:{capabilities:[{id:'x'}]}},b={id:2,communication:{gestureSkill:12,vocalSkill:3,encounters:0,conventions:[]},mind:{capabilities:[{id:'x'}]}},c={id:3,mind:{capabilities:[{id:'x'}]}};
  const state={day:4,agents:[a,b,c],records:[],culture:{conventions:[],institutions:[]}};ensureCulture(state);const before=clarity(a,b);for(let i=0;i<4;i++)interact(state,a,b);assert.ok(clarity(a,b)>before);assert.equal(state.culture.conventions.length,1);
  refreshInstitutions(state);assert.ok(state.culture.institutions.some(x=>x.knowledgeId==='x'));
});
