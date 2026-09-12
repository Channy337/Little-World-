'use strict';

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function ensureHealth(agent){
  if(!agent.healthState||typeof agent.healthState!=='object')agent.healthState={bloodVolume:100,oxygenSaturation:98,infectionLoad:0,immunity:55,wounds:[],smokeExposure:0};
  const h=agent.healthState;for(const [k,v] of Object.entries({bloodVolume:100,oxygenSaturation:98,infectionLoad:0,immunity:55,smokeExposure:0}))if(!Number.isFinite(h[k]))h[k]=v;
  if(!Array.isArray(h.wounds))h.wounds=[];return h;
}
function wound(agent,{severity=10,contamination=2,cause='accident'}={}){
  const h=ensureHealth(agent),entry={severity:clamp(severity,1,100),bleeding:clamp(severity*.45,0,40),contamination:clamp(contamination,0,100),cause};
  h.wounds.push(entry);if(h.wounds.length>8)h.wounds.shift();agent.pain=clamp((agent.pain||0)+severity*.7,0,100);return entry;
}
function inhaleSmoke(agent,amount){const h=ensureHealth(agent);h.smokeExposure=clamp(h.smokeExposure+Math.max(0,amount),0,100);h.oxygenSaturation=clamp(h.oxygenSaturation-amount*.35,40,100);}
function exposePathogens(agent,amount){const h=ensureHealth(agent);h.infectionLoad=clamp(h.infectionLoad+Math.max(0,amount)*(1-h.immunity/140),0,100);}
function symptoms(agent){
  const h=ensureHealth(agent),out=[];
  if(h.bloodVolume<85)out.push('I feel faint, and a wound keeps losing warm fluid.');
  if(h.infectionLoad>28)out.push('I feel feverish and unusually weak around an injured place.');
  if(h.oxygenSaturation<90)out.push('My chest strains and I cannot get enough breath.');
  if(h.smokeExposure>22)out.push('My eyes sting and smoke makes me cough.');
  return out;
}
function advanceHealth(agent,{days=0,resting=false}={}){
  const h=ensureHealth(agent),d=Math.max(0,days);
  let bleed=0,contamination=0;
  for(const w of h.wounds){bleed+=w.bleeding;contamination+=w.contamination;w.bleeding=clamp(w.bleeding-(resting?8:4)*d,0,40);w.severity=clamp(w.severity-(resting?2:.7)*d,0,100);}
  h.wounds=h.wounds.filter(w=>w.severity>.5||w.bleeding>.2);
  h.bloodVolume=clamp(h.bloodVolume-bleed*.08*d+(bleed<1?.8*d:0),0,100);
  h.infectionLoad=clamp(h.infectionLoad+contamination*.025*d-h.immunity*.012*d,0,100);
  h.smokeExposure=clamp(h.smokeExposure-18*d,0,100);h.oxygenSaturation=clamp(h.oxygenSaturation+(98-h.oxygenSaturation)*.8*d,40,100);
  if(h.bloodVolume<70)agent.health=clamp(agent.health-(70-h.bloodVolume)*.18*d,0,100);
  if(h.infectionLoad>45)agent.health=clamp(agent.health-(h.infectionLoad-45)*.12*d,0,100);
  if(h.oxygenSaturation<82)agent.health=clamp(agent.health-(82-h.oxygenSaturation)*.6*d,0,100);
  if(h.bloodVolume>92&&h.infectionLoad<15&&h.oxygenSaturation>94&&h.wounds.length===0)agent.health=clamp(agent.health+.7*d,0,100);
  const felt=symptoms(agent);if(agent.body&&felt.length)agent.body.lastSymptoms=[...new Set([...(agent.body.lastSymptoms||[]),...felt])].slice(-8);
  if(agent.health<=0){if(h.oxygenSaturation<82)return 'oxygen deprivation';if(h.bloodVolume<70)return 'blood loss';if(h.infectionLoad>45)return 'infection';return 'untreated injury';}
  return null;
}

module.exports={ensureHealth,wound,inhaleSmoke,exposePathogens,symptoms,advanceHealth};
