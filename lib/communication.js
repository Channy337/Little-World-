'use strict';

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function ensureCommunication(agent){
  if(!agent.communication||typeof agent.communication!=='object')agent.communication={gestureSkill:12,vocalSkill:3,encounters:0,conventions:[]};
  const c=agent.communication;for(const [k,v] of Object.entries({gestureSkill:12,vocalSkill:3,encounters:0}))if(!Number.isFinite(c[k]))c[k]=v;if(!Array.isArray(c.conventions))c.conventions=[];return c;
}
function ensureCulture(state){if(!state.culture||typeof state.culture!=='object')state.culture={conventions:[],institutions:[]};if(!Array.isArray(state.culture.conventions))state.culture.conventions=[];if(!Array.isArray(state.culture.institutions))state.culture.institutions=[];for(const a of state.agents||[])ensureCommunication(a);return state.culture;}
function clarity(a,b){const x=ensureCommunication(a),y=ensureCommunication(b),shared=x.conventions.filter(v=>y.conventions.includes(v)).length;return clamp((x.gestureSkill+y.gestureSkill+x.vocalSkill+y.vocalSkill)/400+shared*.08,.08,1);}
function interact(state,a,b){
  const culture=ensureCulture(state),x=ensureCommunication(a),y=ensureCommunication(b);x.encounters++;y.encounters++;x.gestureSkill=clamp(x.gestureSkill+.35,0,100);y.gestureSkill=clamp(y.gestureSkill+.35,0,100);x.vocalSkill=clamp(x.vocalSkill+.18,0,100);y.vocalSkill=clamp(y.vocalSkill+.18,0,100);
  if(Math.min(x.encounters,y.encounters)%4===0){const token='shared-sign-'+(culture.conventions.length+1);culture.conventions.push({id:token,createdDay:state.day,holders:[a.id,b.id]});x.conventions.push(token);y.conventions.push(token);}
  return clarity(a,b);
}
function refreshInstitutions(state){
  const culture=ensureCulture(state),counts={};for(const a of state.agents||[])for(const c of a.mind&&a.mind.capabilities||[])counts[c.id]=(counts[c.id]||0)+1;
  for(const [id,n] of Object.entries(counts))if(n>=3&&!culture.institutions.some(x=>x.knowledgeId===id))culture.institutions.push({id:'practice-'+id,kind:'shared-practice',knowledgeId:id,formedDay:state.day});
  if((state.records||[]).length>=3&&!culture.institutions.some(x=>x.kind==='archive'))culture.institutions.push({id:'archive-1',kind:'archive',formedDay:state.day});
  if(culture.institutions.length>80)culture.institutions.splice(0,culture.institutions.length-80);return culture;
}

module.exports={ensureCommunication,ensureCulture,clarity,interact,refreshInstitutions};
