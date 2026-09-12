'use strict';

const PLANTS=Object.freeze({
  redDrupe:{appearance:'small dull-red fruit',calories:420,water:18,toxin:0,spoilDays:5,fiberYield:.15},
  blueCluster:{appearance:'dark clustered fruit',calories:360,water:22,toxin:7,spoilDays:4,fiberYield:.1},
  palePod:{appearance:'pale dry pods',calories:620,water:5,toxin:0,spoilDays:12,fiberYield:.35},
  bitterLeaf:{appearance:'broad bitter leaves',calories:90,water:30,toxin:18,spoilDays:3,fiberYield:.5}
});
const SPECIES=Object.keys(PLANTS);
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function ensureEcology(state){
  if(!Array.isArray(state.animals))state.animals=[];
  if(!Array.isArray(state.waste))state.waste=[];
  if(!state.soil||typeof state.soil!=='object')state.soil={moisture:55,nutrients:70};
  if(!Number.isFinite(state.soil.moisture))state.soil.moisture=55;if(!Number.isFinite(state.soil.nutrients))state.soil.nutrients=70;
  if(state.pond&&!Number.isFinite(state.pond.contamination))state.pond.contamination=4;
  for(const bush of state.bushes||[]){if(!PLANTS[bush.species])bush.species=SPECIES[Math.abs(Number(bush.id)||0)%SPECIES.length];bush.appearance=PLANTS[bush.species].appearance;}
  if(!state.animals.length&&state.pond){
    state.animals.push({id:state.nextId++,kind:'fish',x:state.pond.x,y:state.pond.y,population:18,visible:false});
    state.animals.push({id:state.nextId++,kind:'small-grazer',x:state.pond.x+90,y:state.pond.y-70,population:7,visible:true});
  }
  for(const animal of state.animals){if(!Number.isFinite(animal.baseX))animal.baseX=animal.x;if(!Number.isFinite(animal.baseY))animal.baseY=animal.y;if(!Number.isFinite(animal.winterScarcity))animal.winterScarcity=0;}
  for(const a of state.agents||[]){if(!Array.isArray(a.foodItems))a.foodItems=[];if(!a.foodExperience||typeof a.foodExperience!=='object')a.foodExperience={};if(!Number.isFinite(a.wasteClock))a.wasteClock=0;}
  return state;
}
function forage(agent,bush,day){
  const profile=PLANTS[bush&&bush.species];if(!profile)return null;
  if(!Array.isArray(agent.foodItems))agent.foodItems=[];
  const item={sourceId:bush.id,appearance:profile.appearance,calories:profile.calories,water:profile.water,toxin:profile.toxin,gatheredDay:day,spoilsDay:day+profile.spoilDays,spoiled:false};
  agent.foodItems.push(item);if(agent.foodItems.length>16)agent.foodItems.splice(0,agent.foodItems.length-16);
  agent.inv.food=(agent.inv.food||0)+1;
  if(profile.fiberYield>=.3)agent.inv.fiber=(agent.inv.fiber||0)+1;
  return item;
}
function consume(agent,day){
  if(!Array.isArray(agent.foodItems)||!agent.foodItems.length)return null;
  if(!agent.foodExperience||typeof agent.foodExperience!=='object')agent.foodExperience={};
  const at=agent.foodItems.findIndex(x=>(agent.foodExperience[x.appearance]||0)>-2);if(at<0)return null;
  const item=agent.foodItems.splice(at,1)[0];agent.inv.food=Math.max(0,(agent.inv.food||0)-1);
  item.spoiled=day>=item.spoilsDay;
  const toxin=item.toxin+(item.spoiled?20:0);
  return {...item,toxin,nutrition:clamp(item.calories/620,.15,1.2)};
}
function canConsume(agent){
  const items=Array.isArray(agent.foodItems)?agent.foodItems:[],experience=agent.foodExperience||{};
  return Number(agent.inv&&agent.inv.food)>items.length||items.some(x=>(experience[x.appearance]||0)>-2);
}
function recordFoodOutcome(agent,item){
  if(!item)return;if(!agent.foodExperience||typeof agent.foodExperience!=='object')agent.foodExperience={};
  const prior=Number(agent.foodExperience[item.appearance])||0;agent.foodExperience[item.appearance]=clamp(prior+(item.toxin>3?-2:1),-6,6);
}
function drinkRisk(state){return clamp((state.pond&&state.pond.contamination||0)/100,0,1);}
function addWaste(state,agent){
  ensureEcology(state);const site={id:state.nextId++,x:agent.x,y:agent.y,day:state.day,pathogens:8};state.waste.push(site);if(state.waste.length>120)state.waste.splice(0,state.waste.length-120);
  if(state.pond&&Math.hypot(site.x-state.pond.x,site.y-state.pond.y)<75)state.pond.contamination=clamp(state.pond.contamination+.18,0,100);
  return site;
}
function advance(state,days){
  ensureEcology(state);const d=Math.max(0,days),weather=state.weather||{};
  state.soil.moisture=clamp(state.soil.moisture+((weather.precipitationMm||0)*.5-1.2)*d,0,100);
  state.soil.nutrients=clamp(state.soil.nutrients+.02*d-(state.farms||[]).filter(x=>x.planted).length*.01*d,0,100);
  if(state.pond)state.pond.contamination=clamp(state.pond.contamination-.12*d,0,100);
  const winter=weather.season==='winter',deepSnow=(weather.snowDepthCm||0)>=10,severe=weather.hazard==='blizzard'||weather.hazard==='cold snap';
  for(const animal of state.animals){
    let rate=state.soil.moisture>20?.015:-.04;
    if(winter){
      if(animal.kind==='small-grazer')rate-=deepSnow?.055:.028;
      else if(animal.kind==='fish')rate-=.006;
      animal.winterScarcity=clamp(animal.winterScarcity+d*(deepSnow?.05:.02),0,1);
    }else animal.winterScarcity=clamp(animal.winterScarcity-d*.035,0,1);
    if(severe&&animal.kind==='small-grazer')rate-=.035;
    animal.population=clamp(animal.population+rate*animal.population*d,0,80);
    if(animal.kind==='small-grazer'){
      const shift=winter?Math.min(36,12+(weather.snowDepthCm||0)*1.2):0;
      animal.x=clamp(animal.baseX+shift,8,(state.worldBounds&&state.worldBounds.w||480)-8);
      animal.y=clamp(animal.baseY-shift*.35,8,(state.worldBounds&&state.worldBounds.h||304)-8);
      animal.visible=animal.population>.8&&animal.winterScarcity<.82;
    }
  }
  for(const a of state.agents){for(const item of a.foodItems||[])if(state.day>=item.spoilsDay)item.spoiled=true;a.wasteClock+=d;if(a.wasteClock>=1){a.wasteClock-=1;addWaste(state,a);}}
  return state;
}
function sensoryFood(bush){const p=PLANTS[bush&&bush.species];return p?{appearance:p.appearance}:null;}

module.exports={PLANTS,ensureEcology,forage,consume,canConsume,recordFoodOutcome,drinkRisk,addWaste,advance,sensoryFood};
