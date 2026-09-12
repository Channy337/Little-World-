'use strict';

const MAX_PLACES=96;
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function distance(a,b){return Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));}
function ensurePerception(agent){
  if(!agent.perception||typeof agent.perception!=='object')agent.perception={knownPlaces:[],lastScanDay:0,visionRange:0};
  if(!Array.isArray(agent.perception.knownPlaces))agent.perception.knownPlaces=[];
  agent.perception.knownPlaces=agent.perception.knownPlaces.filter(x=>x&&typeof x.kind==='string'&&Number.isFinite(x.x)&&Number.isFinite(x.y)).slice(-MAX_PLACES);
  if(!Number.isFinite(agent.perception.lastScanDay))agent.perception.lastScanDay=0;
  if(!Number.isFinite(agent.perception.visionRange))agent.perception.visionRange=0;
  return agent.perception;
}
function sightRange(state){
  const daylight=Math.max(0,Math.sin((Number(state.time)||0)*Math.PI));
  const weather=state.weather||{};
  let range=34+daylight*78;
  range-=Math.min(28,(weather.precipitationMm||0)*2.2);
  range-=Math.min(18,(weather.cloudCover||0)*.16);
  return clamp(range,24,112);
}
function visibleObjects(state){
  const out=[];
  for(const [kind,list,key] of [['tree',state.trees,'wood'],['rock',state.rocks,'stone'],['bush',state.bushes,'food'],['farm',state.farms,'growth'],['fire',state.fires,'fuel'],['building',state.buildings,null]]){
    for(const item of list||[])out.push({kind,id:item.id,x:item.x,y:item.y,available:key?Number(item[key])>=1:true,sensoryTag:item.appearance||null});
  }
  for(const animal of state.animals||[])if(animal.visible!==false&&animal.population>0)out.push({kind:'animal',id:animal.id,x:animal.x,y:animal.y,available:true});
  for(const deposit of state.deposits||[])out.push({kind:'deposit',id:deposit.id,x:deposit.x,y:deposit.y,available:(deposit.amount||0)>0});
  if(state.pond)out.push({kind:'water',id:'pond',x:state.pond.x,y:state.pond.y,available:(state.pond.level||0)>0});
  return out;
}
function remember(agent,place,day,source='seen'){
  const p=ensurePerception(agent),id=String(place.id),at=p.knownPlaces.findIndex(x=>x.kind===place.kind&&String(x.id)===id);
  const entry={kind:place.kind,id:place.id,x:place.x,y:place.y,lastSeenDay:Number.isSafeInteger(day)?day:0,lastSeenAvailable:place.available!==false,source,sensoryTag:place.sensoryTag||null};
  if(at>=0)p.knownPlaces.splice(at,1);
  p.knownPlaces.push(entry);if(p.knownPlaces.length>MAX_PLACES)p.knownPlaces.splice(0,p.knownPlaces.length-MAX_PLACES);
  return entry;
}
function scan(state,agent){
  const p=ensurePerception(agent),range=sightRange(state);p.visionRange=range;p.lastScanDay=state.day;
  for(const obj of visibleObjects(state))if(distance(agent,obj)<=range)remember(agent,obj,state.day,'seen');
  return p;
}
function nearestKnown(agent,kinds,{availableOnly=true}={}){
  const wanted=new Set(Array.isArray(kinds)?kinds:[kinds]),p=ensurePerception(agent);
  let best=null,bestDistance=Infinity;
  for(const place of p.knownPlaces){
    if(!wanted.has(place.kind)||(availableOnly&&place.lastSeenAvailable===false))continue;
    const d=distance(agent,place);if(d<bestDistance){bestDistance=d;best=place;}
  }
  return best?{...best}:null;
}
function markObserved(agent,kind,id,available,day){
  const p=ensurePerception(agent),found=p.knownPlaces.find(x=>x.kind===kind&&String(x.id)===String(id));
  if(found){found.lastSeenAvailable=!!available;found.lastSeenDay=day;found.source='seen';}
}
function sharePlace(teacher,learner,day){
  const known=ensurePerception(teacher).knownPlaces,learnerKnown=ensurePerception(learner).knownPlaces;
  const candidate=[...known].reverse().find(x=>!learnerKnown.some(y=>y.kind===x.kind&&String(y.id)===String(x.id)));
  return candidate?remember(learner,candidate,day,'told-by-'+teacher.id):null;
}

module.exports={MAX_PLACES,ensurePerception,sightRange,scan,nearestKnown,markObserved,sharePlace};
