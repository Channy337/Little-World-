'use strict';

function stage(age){if(age<2)return'infant';if(age<12)return'child';if(age<18)return'adolescent';if(age<55)return'adult';return'elder';}
function ensureLife(agent){
  if(!agent.life||typeof agent.life!=='object')agent.life={sex:(Number(agent.id)||0)%2?'female':'male',parents:[],pregnancy:null,stage:stage(agent.age||0),dependentUntil:12};
  const l=agent.life;if(!['female','male'].includes(l.sex))l.sex=(Number(agent.id)||0)%2?'female':'male';if(!Array.isArray(l.parents))l.parents=[];
  l.stage=stage(agent.age||0);if(!Number.isFinite(l.dependentUntil))l.dependentUntil=12;
  if(l.pregnancy&&(!Number.isFinite(l.pregnancy.remainingDays)||!Number.isSafeInteger(l.pregnancy.otherParentId)))l.pregnancy=null;
  return l;
}
function sleepRequirementHours(agent){const s=ensureLife(agent).stage;return s==='infant'?14:s==='child'?10:s==='adolescent'?9:s==='elder'?8:8;}
function canConceive(agent){const l=ensureLife(agent),age=agent.age||0;return l.sex==='female'&&age>=18&&age<=45&&!l.pregnancy&&agent.health>55;}
function tryConceive(a,b,day,chance){
  ensureLife(a);ensureLife(b);const mother=canConceive(a)?a:canConceive(b)?b:null,other=mother===a?b:a;
  if(!mother||ensureLife(other).sex===mother.life.sex||(other.age||0)<18||(other.age||0)>65||chance>.18)return null;
  mother.life.pregnancy={otherParentId:other.id,remainingDays:270,conceivedDay:day,childHeritage:null};return mother;
}
function advancePregnancies(state,days){
  const due=[];for(const a of state.agents||[]){const l=ensureLife(a);if(!l.pregnancy)continue;l.pregnancy.remainingDays-=Math.max(0,days);if(l.pregnancy.remainingDays<=0){due.push({mother:a,otherParentId:l.pregnancy.otherParentId,heritage:l.pregnancy.childHeritage||null});l.pregnancy=null;}}
  return due;
}
function careForDependent(state,child,days=0){
  const l=ensureLife(child);if((child.age||0)>=l.dependentUntil)return false;
  const carers=(state.agents||[]).filter(a=>l.parents.includes(a.id)&&a.health>20).sort((a,b)=>Math.hypot(a.x-child.x,a.y-child.y)-Math.hypot(b.x-child.x,b.y-child.y));
  const carer=carers[0];if(!carer||Math.hypot(carer.x-child.x,carer.y-child.y)>85)return false;
  const d=Math.max(0,days);if(child.body){child.body.waterReserve=Math.min(100,child.body.waterReserve+36*d);child.body.glycogenReserve=Math.min(100,child.body.glycogenReserve+100*d);child.thirst=100-child.body.waterReserve;}
  child.hunger=Math.max(0,(child.hunger||0)-85*d);carer.energy=Math.max(0,(carer.energy||0)-10*d);return true;
}

module.exports={stage,ensureLife,sleepRequirementHours,canConceive,tryConceive,advancePregnancies,careForDependent};
