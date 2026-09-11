'use strict';

const MAX_DISCOVERIES=240,MAX_EDGES=480,MAX_RECORDS=120;
function ensureKnowledgeSystem(state){
  if(!state.discoveryGraph||typeof state.discoveryGraph!=='object')state.discoveryGraph={nodes:[],edges:[]};
  if(!Array.isArray(state.discoveryGraph.nodes))state.discoveryGraph.nodes=[];
  if(!Array.isArray(state.discoveryGraph.edges))state.discoveryGraph.edges=[];
  if(!Array.isArray(state.records))state.records=[];
  return state;
}
function clean(v,n=160){return String(v||'').trim().slice(0,n);}
function recordDiscovery(state,{id,label,kind='discovery',agentId,day,evidence=[],parents=[]}){
  ensureKnowledgeSystem(state);id=clean(id,80);if(!id)return null;
  let node=state.discoveryGraph.nodes.find(x=>x.id===id);
  if(!node){node={id,label:clean(label)||id,kind,status:'active',firstAgentId:agentId||null,firstDay:Number.isSafeInteger(day)?day:state.day,evidence:evidence.slice(0,8),holders:[]};state.discoveryGraph.nodes.push(node);}
  if(agentId!=null&&!node.holders.includes(agentId))node.holders.push(agentId);
  for(const parent of parents){const key=clean(parent,80)+'>'+id;if(!state.discoveryGraph.edges.some(x=>x.id===key))state.discoveryGraph.edges.push({id:key,from:clean(parent,80),to:id,type:'enabled'});}
  if(state.discoveryGraph.nodes.length>MAX_DISCOVERIES)state.discoveryGraph.nodes.splice(0,state.discoveryGraph.nodes.length-MAX_DISCOVERIES);
  if(state.discoveryGraph.edges.length>MAX_EDGES)state.discoveryGraph.edges.splice(0,state.discoveryGraph.edges.length-MAX_EDGES);
  return node;
}
function refreshHolders(state){
  ensureKnowledgeSystem(state);const living=new Set((state.agents||[]).map(a=>a.id));
  for(const node of state.discoveryGraph.nodes){
    node.holders=(node.holders||[]).filter(id=>living.has(id));
    const recorded=state.records.some(r=>r.intact!==false&&(r.knowledgeIds||[]).includes(node.id));
    node.status=node.holders.length?'active':recorded?'recorded':'lost';
  }
}
function transferKnowledge(state,teacher,learner){
  ensureKnowledgeSystem(state);if(!teacher||!learner||!teacher.mind||!learner.mind)return null;
  const known=teacher.mind.capabilities||[],candidate=known.find(c=>!(learner.mind.capabilities||[]).some(x=>x.id===c.id)&&!(learner.mind.instructions||[]).some(x=>x.id===c.id));
  if(!candidate)return null;
  const rel=learner.mind.relationships&&learner.mind.relationships[String(teacher.id)];
  const trust=rel?rel.trust:50,score=(teacher.id*31+learner.id*17+state.day*13)%100;
  if(score>Math.min(88,30+trust*.55))return null;
  if(!Array.isArray(learner.mind.instructions))learner.mind.instructions=[];
  learner.mind.instructions.push({id:candidate.id,sourceAgentId:teacher.id,day:state.day,status:'heard'});
  if(learner.mind.instructions.length>12)learner.mind.instructions.splice(0,learner.mind.instructions.length-12);
  state.discoveryGraph.edges.push({id:'teach-'+state.day+'-'+teacher.id+'-'+learner.id+'-'+candidate.id,from:candidate.id,to:candidate.id,type:'taught',fromAgentId:teacher.id,toAgentId:learner.id,day:state.day});
  return candidate.id;
}
function createRecord(state,agent,knowledgeIds,medium){
  ensureKnowledgeSystem(state);const caps=new Set((agent.mind&&agent.mind.capabilities||[]).map(x=>x.id));
  if(!caps.has('symbolic-writing')||!caps.has('durable-recording')||!agent.literacy)return null;
  const ids=(knowledgeIds||[]).filter(id=>caps.has(id)).slice(0,8);if(!ids.length)return null;
  const record={id:state.nextId++,authorId:agent.id,day:state.day,medium:clean(medium,40),knowledgeIds:ids,literacySystem:agent.literacySystem||'unknown',intact:true};
  state.records.push(record);if(state.records.length>MAX_RECORDS)state.records.splice(0,state.records.length-MAX_RECORDS);return record;
}

module.exports={ensureKnowledgeSystem,recordDiscovery,refreshHolders,transferKnowledge,createRecord};
