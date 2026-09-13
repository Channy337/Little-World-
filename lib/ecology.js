'use strict';

const {ensureCultivation,profileForBush,collectSeed,advanceCultivation,sensoryPlant}=require('./cultivation');

// Legacy food profiles remain readable for old saves/tests; live bushes are upgraded
// to real plant profiles by cultivation.js without exposing scientific names to Civorians.
const PLANTS=Object.freeze({
  redDrupe:{appearance:'small dull-red fruit',calories:420,water:18,toxin:0,spoilDays:5,fiberYield:.15},
  blueCluster:{appearance:'dark clustered fruit',calories:360,water:22,toxin:7,spoilDays:4,fiberYield:.1},
  palePod:{appearance:'pale dry pods',calories:620,water:5,toxin:0,spoilDays:12,fiberYield:.35},
  bitterLeaf:{appearance:'broad bitter leaves',calories:90,water:30,toxin:18,spoilDays:3,fiberYield:.5}
});
const SPECIES=Object.keys(PLANTS);
const ANIMAL_SPECIES=Object.freeze({
  fish:{scientificName:'Lepomis macrochirus',appearance:'small deep-bodied freshwater fish',diet:'aquatic invertebrates',reproduction:.028,winterCost:.006},
  deer:{scientificName:'Odocoileus virginianus',appearance:'long-legged brown grazer with a pale tail',diet:'leaves and tender shoots',reproduction:.014,winterCost:.04},
  rabbit:{scientificName:'Sylvilagus floridanus',appearance:'small brown grazer with long ears',diet:'grasses and low plants',reproduction:.035,winterCost:.035},
  fox:{scientificName:'Vulpes vulpes',appearance:'slender reddish hunter with a bushy tail',diet:'small animals',reproduction:.009,winterCost:.01},
  songbird:{scientificName:'Turdus migratorius',appearance:'small dark-backed bird moving through open ground',diet:'insects and fruit',reproduction:.02,winterCost:.045}
});
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function foodSummary(agent,day){
  const items=Array.isArray(agent.foodItems)?agent.foodItems:[],experience=agent.foodExperience||{};
  let safe=0,risky=0,spoiled=0,dangerous=0;
  for(const item of items){
    const isSpoiled=!!item.spoiled||(Number.isFinite(day)&&Number.isFinite(item.spoilsDay)&&day>=item.spoilsDay);
    const exp=Number(experience[item.appearance])||0;
    if(isSpoiled)spoiled++;
    if(exp<=-2){dangerous++;continue;}
    if(isSpoiled||exp<=0)risky++;else safe++;
  }
  const generic=Math.max(0,Number(agent.foodStock)||0);
  return {carried:generic+items.length,usable:generic+safe+risky,safe:generic+safe,risky,spoiled,dangerous,generic};
}
function syncFoodState(agent,day){
  if(!agent.inv||typeof agent.inv!=='object')agent.inv={food:0};
  if(!Array.isArray(agent.foodItems))agent.foodItems=[];
  if(!agent.foodExperience||typeof agent.foodExperience!=='object')agent.foodExperience={};
  const prior=agent.foodState&&Number.isFinite(agent.foodState.usable)?agent.foodState.usable:null;
  if(!Number.isFinite(agent.foodStock))agent.foodStock=Math.max(0,(Number(agent.inv.food)||0)-agent.foodItems.length);
  else if(prior!==null){
    const delta=(Number(agent.inv.food)||0)-prior;
    if(delta!==0)agent.foodStock=Math.max(0,agent.foodStock+delta);
  }
  for(const item of agent.foodItems)if(Number.isFinite(day)&&Number.isFinite(item.spoilsDay)&&day>=item.spoilsDay)item.spoiled=true;
  agent.foodState=foodSummary(agent,day);
  agent.inv.food=agent.foodState.usable;
  return agent.foodState;
}
function ensureAnimal(state,kind,x,y,population,visible=true){
  let animal=state.animals.find(a=>a.kind===kind);
  if(!animal){animal={id:state.nextId++,kind,x,y,population,visible};state.animals.push(animal);}
  const profile=ANIMAL_SPECIES[kind];if(profile){animal.appearance=profile.appearance;animal.hiddenSpecies=profile.scientificName;}
  if(!Number.isFinite(animal.baseX))animal.baseX=animal.x;if(!Number.isFinite(animal.baseY))animal.baseY=animal.y;if(!Number.isFinite(animal.winterScarcity))animal.winterScarcity=0;
  return animal;
}
function ensureEcology(state){
  if(!Array.isArray(state.animals))state.animals=[];
  if(!Array.isArray(state.waste))state.waste=[];
  if(!state.soil||typeof state.soil!=='object')state.soil={moisture:55,nutrients:70};
  if(!Number.isFinite(state.soil.moisture))state.soil.moisture=55;if(!Number.isFinite(state.soil.nutrients))state.soil.nutrients=70;
  if(state.pond&&!Number.isFinite(state.pond.contamination))state.pond.contamination=4;
  for(const bush of state.bushes||[]){if(!PLANTS[bush.species])bush.species=SPECIES[Math.abs(Number(bush.id)||0)%SPECIES.length];}
  ensureCultivation(state);
  if(state.pond){
    const legacy=state.animals.find(a=>a.kind==='small-grazer');if(legacy)legacy.kind='deer';
    ensureAnimal(state,'fish',state.pond.x,state.pond.y,18,false);
    ensureAnimal(state,'deer',state.pond.x+90,state.pond.y-70,7,true);
    ensureAnimal(state,'rabbit',state.pond.x+54,state.pond.y-42,12,true);
    ensureAnimal(state,'fox',state.pond.x+120,state.pond.y-88,3,true);
    ensureAnimal(state,'songbird',state.pond.x-72,state.pond.y-92,16,true);
  }
  for(const a of state.agents||[]){if(!Number.isFinite(a.wasteClock))a.wasteClock=0;syncFoodState(a,state.day);}
  return state;
}
function forage(agent,bush,day,state){
  const profile=profileForBush(bush);if(!profile)return null;
  if(!Array.isArray(agent.foodItems))agent.foodItems=[];
  if(!agent.foodExperience||typeof agent.foodExperience!=='object')agent.foodExperience={};
  if(!Number.isFinite(agent.foodStock))agent.foodStock=Math.max(0,(Number(agent.inv&&agent.inv.food)||0)-agent.foodItems.length);
  const item={sourceId:bush.id,appearance:profile.appearance,calories:profile.calories,water:profile.water,toxin:profile.toxin,gatheredDay:day,spoilsDay:day+profile.spoilDays,spoiled:false};
  agent.foodItems.push(item);if(agent.foodItems.length>16)agent.foodItems.splice(0,agent.foodItems.length-16);
  syncFoodState(agent,day);
  if(profile.fiberYield>=.3)agent.inv.fiber=(agent.inv.fiber||0)+1;
  collectSeed(state||null,agent,bush,day);
  return item;
}
function consume(agent,day){
  if(!Array.isArray(agent.foodItems))agent.foodItems=[];
  if(!agent.foodExperience||typeof agent.foodExperience!=='object')agent.foodExperience={};
  const at=agent.foodItems.findIndex(x=>(agent.foodExperience[x.appearance]||0)>-2);
  if(at>=0){
    const item=agent.foodItems.splice(at,1)[0];
    item.spoiled=!!item.spoiled||(Number.isFinite(day)&&Number.isFinite(item.spoilsDay)&&day>=item.spoilsDay);
    const toxin=item.toxin+(item.spoiled?20:0);
    syncFoodState(agent,day);
    return {...item,toxin,nutrition:clamp(item.calories/620,.15,1.2)};
  }
  if(Number(agent.foodStock)>0){
    agent.foodStock=Math.max(0,agent.foodStock-1);syncFoodState(agent,day);
    return {appearance:'stored food',calories:620,water:5,toxin:0,spoiled:false,nutrition:1};
  }
  return null;
}
function canConsume(agent){
  const items=Array.isArray(agent.foodItems)?agent.foodItems:[],experience=agent.foodExperience||{};
  return Number(agent.foodStock)>0||items.some(x=>(experience[x.appearance]||0)>-2);
}
function recordFoodOutcome(agent,item){
  if(!item)return;if(!agent.foodExperience||typeof agent.foodExperience!=='object')agent.foodExperience={};
  const prior=Number(agent.foodExperience[item.appearance])||0;agent.foodExperience[item.appearance]=clamp(prior+(item.toxin>3?-2:1),-6,6);
}
function relaxFoodAversion(agent,days){
if(!agent||!agent.foodExperience||typeof agent.foodExperience!=='object')return;
const step=Math.max(0,Number(days)||0)*.05;
if(step<=0)return;
for(const key of Object.keys(agent.foodExperience)){
const value=Number(agent.foodExperience[key])||0;
if(value<0)agent.foodExperience[key]=Math.min(0,value+step);
}
return agent.foodExperience;
}
function drinkRisk(state){return clamp((state.pond&&state.pond.contamination||0)/100,0,1);}
function addWaste(state,agent){
  ensureEcology(state);const site={id:state.nextId++,x:agent.x,y:agent.y,day:state.day,pathogens:8};state.waste.push(site);if(state.waste.length>120)state.waste.splice(0,state.waste.length-120);
  if(state.pond&&Math.hypot(site.x-state.pond.x,site.y-state.pond.y)<75)state.pond.contamination=clamp(state.pond.contamination+.18,0,100);
  return site;
}
function advanceAnimals(state,d,weather){
  const winter=weather.season==='winter',deepSnow=(weather.snowDepthCm||0)>=10,severe=['blizzard','cold snap','hurricane','flood'].includes(weather.hazard);
  const rabbits=state.animals.find(a=>a.kind==='rabbit'),deer=state.animals.find(a=>a.kind==='deer');
  for(const animal of state.animals){
    const profile=ANIMAL_SPECIES[animal.kind]||ANIMAL_SPECIES.deer;let rate=profile.reproduction;
    if(state.soil.moisture<20&&animal.kind!=='fox')rate-=.04;
    if(winter){rate-=profile.winterCost*(deepSnow?1.5:1);animal.winterScarcity=clamp(animal.winterScarcity+d*(deepSnow?.05:.02),0,1);}else animal.winterScarcity=clamp(animal.winterScarcity-d*.035,0,1);
    if(severe)rate-=animal.kind==='fox'?.012:.025;
    if(animal.kind==='fox'){const prey=(rabbits&&rabbits.population||0)+(deer&&deer.population||0)*.18;rate+=prey>10?.006:-.018;}
    animal.population=clamp(animal.population+rate*animal.population*d,0,90);
    const shift=winter&&animal.kind!=='fish'?Math.min(36,12+(weather.snowDepthCm||0)*1.2):0;
    animal.x=clamp(animal.baseX+shift,8,(state.worldBounds&&state.worldBounds.w||480)-8);animal.y=clamp(animal.baseY-shift*.35,8,(state.worldBounds&&state.worldBounds.h||304)-8);
    animal.visible=animal.kind!=='fish'&&animal.population>.7&&animal.winterScarcity<.9;
  }
}
function advance(state,days){
  ensureEcology(state);const d=Math.max(0,days),weather=state.weather||{};
  state.soil.moisture=clamp(state.soil.moisture+((weather.precipitationMm||0)*.5-1.2)*d,0,100);
  state.soil.nutrients=clamp(state.soil.nutrients+.02*d-(state.farms||[]).filter(x=>x.planted).length*.01*d,0,100);
  if(state.pond)state.pond.contamination=clamp(state.pond.contamination-.12*d,0,100);
  advanceAnimals(state,d,weather);advanceCultivation(state,d);
  for(const a of state.agents){relaxFoodAversion(a,d);syncFoodState(a,state.day);a.wasteClock+=d;if(a.wasteClock>=1){a.wasteClock-=1;addWaste(state,a);}}
  return state;
}
function sensoryFood(bush){return sensoryPlant(bush);}
function sensoryAnimal(animal){const p=ANIMAL_SPECIES[animal&&animal.kind];return p?{appearance:p.appearance}:null;}

module.exports={PLANTS,ANIMAL_SPECIES,ensureEcology,forage,consume,canConsume,recordFoodOutcome,foodSummary,syncFoodState,drinkRisk,addWaste,advance,sensoryFood,sensoryAnimal,relaxFoodAversion};
