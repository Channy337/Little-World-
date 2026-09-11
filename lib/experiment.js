'use strict';

const MAX_EXPERIMENTS=8;
const OPERATIONS=new Set(['observe','combine','shape','stack','soak','dry','heat','compare']);
const MATERIALS=new Set(['wood','stone','food']);

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function cleanText(v,max){return typeof v==='string'?v.trim().slice(0,max):'';}
function hash(text){
  let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
function ensure(agent){
  if(!agent.mind||typeof agent.mind!=='object') return null;
  if(!Array.isArray(agent.mind.experiments)) agent.mind.experiments=[];
  if(agent.mind.experiments.length>MAX_EXPERIMENTS) agent.mind.experiments=agent.mind.experiments.slice(-MAX_EXPERIMENTS);
  return agent.mind;
}
function normalizeProposal(raw){
  if(!raw||typeof raw!=='object') return null;
  const hypothesis=cleanText(raw.hypothesis,160);
  const operation=cleanText(raw.operation,20).toLowerCase();
  const hopedResult=cleanText(raw.hopedResult,140);
  const materials=Array.isArray(raw.materials)?[...new Set(raw.materials.map(x=>String(x).toLowerCase()).filter(x=>MATERIALS.has(x)))].slice(0,3):[];
  if(!hypothesis||!hopedResult||!OPERATIONS.has(operation)) return null;
  return {hypothesis,operation,materials,hopedResult};
}
function canGroundProposal(agent,proposal){
  if(!proposal.materials.length) return proposal.operation==='observe'||proposal.operation==='compare';
  return proposal.materials.every(m=>agent.inv&&Number(agent.inv[m])>0);
}
function addMemory(agent,text,day,kind='experiment',importance=60){
  const m=ensure(agent); if(!m) return;
  if(!Array.isArray(m.memories)) m.memories=[];
  const clean=cleanText(text,220); if(!clean) return;
  if(m.memories.some(x=>x.text===clean&&x.day===day)) return;
  m.memories.push({text:clean,day:Number.isSafeInteger(day)?day:0,kind,importance:clamp(importance,0,100)});
  if(m.memories.length>16) m.memories.splice(0,m.memories.length-16);
}
function addBelief(agent,text){
  const m=ensure(agent); if(!m) return;
  if(!Array.isArray(m.beliefs)) m.beliefs=[];
  const clean=cleanText(text,180); if(!clean) return;
  const at=m.beliefs.indexOf(clean); if(at!==-1)m.beliefs.splice(at,1);
  m.beliefs.push(clean); if(m.beliefs.length>12)m.beliefs.splice(0,m.beliefs.length-12);
}
function applyExperimentProposals(state,queue,priorityResults){
  const agents=new Map((state.agents||[]).map(a=>[a.id,a]));
  queue.forEach((item,i)=>{
    if(item.type!=='priority') return;
    const a=agents.get(item.agentId), r=priorityResults[i];
    if(!a||!r) return;
    const p=normalizeProposal(r.experiment); if(!p) return;
    const m=ensure(a); if(!m) return;
    if(m.experiments.some(x=>x.status==='proposed')) return;
    if(!canGroundProposal(a,p)){
      addMemory(a,'I had an idea, but I do not have what I need to test it.',state.day,'experiment',48);
      return;
    }
    m.experiments.push({...p,status:'proposed',day:state.day,result:null});
    if(m.experiments.length>MAX_EXPERIMENTS)m.experiments.splice(0,m.experiments.length-MAX_EXPERIMENTS);
    addMemory(a,'I want to test this idea: '+p.hypothesis,state.day,'experiment',64);
  });
  return state;
}
function resolveExperiments(state){
  for(const a of state.agents||[]){
    const m=ensure(a); if(!m) continue;
    const exp=[...m.experiments].reverse().find(x=>x.status==='proposed');
    if(!exp) continue;
    if(exp.day>=state.day) continue;
    if(!canGroundProposal(a,exp)){
      exp.status='blocked'; exp.result='I could not repeat the attempt with the materials I had.';
      addMemory(a,exp.result,state.day,'experiment',52); continue;
    }
    const emotions=m.emotions||{}, skills=m.skills||{};
    const skill=Math.max(0,...Object.values(skills).filter(Number.isFinite));
    const curiosity=Number.isFinite(emotions.curiosity)?emotions.curiosity:50;
    const stress=Number.isFinite(emotions.stress)?emotions.stress:20;
    const experience=Number.isFinite(m.experience)?m.experience:0;
    const ability=curiosity*.42+skill*.24+Math.min(30,experience)*.45-stress*.18;
    const variation=(hash(a.id+'|'+exp.day+'|'+exp.hypothesis)%1000)/1000*35;
    const score=ability+variation;
    if(score>=55){
      exp.status='promising';
      exp.result='The attempt gave me enough evidence to keep investigating: '+exp.hopedResult;
      addBelief(a,'My experiment may support this idea: '+exp.hypothesis);
      addMemory(a,exp.result,state.day,'experiment',74);
      m.experience=(m.experience||0)+1;
    } else if(score>=38){
      exp.status='inconclusive';
      exp.result='The attempt was inconclusive. I need another way to test it.';
      addMemory(a,exp.result,state.day,'experiment',58);
    } else {
      exp.status='failed';
      exp.result='The attempt did not show what I expected.';
      addMemory(a,exp.result,state.day,'experiment',62);
    }
  }
  return state;
}
function experimentSummary(agent){
  const m=ensure(agent); if(!m) return [];
  return m.experiments.slice(-3).map(x=>({hypothesis:x.hypothesis,operation:x.operation,materials:x.materials,status:x.status,result:x.result}));
}
module.exports={OPERATIONS,normalizeProposal,applyExperimentProposals,resolveExperiments,experimentSummary,canGroundProposal};
