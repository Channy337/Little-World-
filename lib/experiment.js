'use strict';

const MAX_EXPERIMENTS=8;
const OPERATIONS=new Set(['observe','combine','shape','stack','soak','dry','heat','compare']);
const {MATERIALS:PHYSICAL_MATERIALS,FORMS,OPERATIONS:MECHANICAL_OPERATIONS}=require('./mechanics');
for(const operation of MECHANICAL_OPERATIONS)OPERATIONS.add(operation);
const MATERIALS=new Set([...Object.keys(PHYSICAL_MATERIALS),'food','body']);
const {signature,lookup}=require('./affordances');
const {recordDiscovery}=require('./knowledge');

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function cleanText(v,max){return typeof v==='string'?v.trim().slice(0,max):'';}
function mind(agent,create=false){
  if(!agent.mind||typeof agent.mind!=='object') return null;
  if(!Array.isArray(agent.mind.experiments)){
    if(!create) return agent.mind;
    agent.mind.experiments=[];
  }
  if(Array.isArray(agent.mind.experiments)&&agent.mind.experiments.length>MAX_EXPERIMENTS){
    agent.mind.experiments=agent.mind.experiments.slice(-MAX_EXPERIMENTS);
  }
  return agent.mind;
}
function normalizeProposal(raw){
  if(!raw||typeof raw!=='object') return null;
  const hypothesis=cleanText(raw.hypothesis,160);
  const operation=cleanText(raw.operation,20).toLowerCase();
  const hopedResult=cleanText(raw.hopedResult,140);
  const form=FORMS.has(cleanText(raw.form,20).toLowerCase())?cleanText(raw.form,20).toLowerCase():'rough';
  const materials=Array.isArray(raw.materials)?[...new Set(raw.materials.map(x=>String(x).toLowerCase()).filter(x=>MATERIALS.has(x)))].slice(0,3):[];
  if(!hypothesis||!hopedResult||!OPERATIONS.has(operation)) return null;
  return {hypothesis,operation,materials,hopedResult,form};
}
function canGroundProposal(agent,proposal){
  if(!proposal.materials.length) return proposal.operation==='observe'||proposal.operation==='compare';
  return proposal.materials.every(m=>m==='body'||agent.inv&&Number(agent.inv[m])>0);
}
function addMemory(agent,text,day,kind='experiment',importance=60){
  const m=mind(agent,true); if(!m) return;
  if(!Array.isArray(m.memories)) m.memories=[];
  const clean=cleanText(text,220); if(!clean) return;
  if(m.memories.some(x=>x.text===clean&&x.day===day)) return;
  m.memories.push({text:clean,day:Number.isSafeInteger(day)?day:0,kind,importance:clamp(importance,0,100)});
  if(m.memories.length>16) m.memories.splice(0,m.memories.length-16);
}
function addBelief(agent,text){
  const m=mind(agent,true); if(!m) return;
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
    const m=mind(a,true); if(!m) return;
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
    const m=mind(a,false); if(!m||!Array.isArray(m.experiments)||!m.experiments.length) continue;
    const exp=[...m.experiments].reverse().find(x=>x.status==='observed');
    if(!exp) continue;
    const fixed=lookup(exp.operation,exp.materials),prototype=exp.prototype&&exp.prototype.success?exp.prototype:null;
    const key=fixed?signature(exp.operation,exp.materials):prototype&&prototype.signature,rule=fixed||(prototype?{outputs:{},result:prototype.observation,lesson:'This personally tested form can be reproduced.',label:'Tested '+prototype.form+' form made from '+prototype.materials.join(' and '),capabilityKind:'artifact'}:null);
    if(!exp.physicalSuccess||!rule){
      exp.status='failed';exp.result='The physical attempt did not produce a useful repeatable result.';
      addMemory(a,exp.result,state.day,'experiment',62);continue;
    }
    const evidence=m.experiments.filter(x=>(lookup(x.operation,x.materials)?signature(x.operation,x.materials):x.prototype&&x.prototype.signature)===key&&x.physicalSuccess).length;
    exp.evidence=evidence;exp.status='promising';
    const products=Object.keys(rule.outputs||{});
    exp.result=rule.result||(products.length?'The physical attempt produced '+products.join(', ')+'.':'The physical observation was repeatable.');
    addBelief(a,'My experiment may support this idea: '+exp.hypothesis);
    addMemory(a,exp.result,state.day,'experiment',74);m.experience=(m.experience||0)+1;
    if(evidence>=2){
      if(!Array.isArray(m.capabilities))m.capabilities=[];
      if(!m.capabilities.some(x=>x.id===key)){
        m.capabilities.push({id:key,kind:rule.capabilityKind||'recipe',evidence,discoveredDay:state.day,method:prototype?{operation:prototype.operation,materials:prototype.materials,form:prototype.form}:null});
        const instruction=(m.instructions||[]).find(x=>x.id===key);if(instruction)instruction.status='validated';
        m.knowledge.push(rule.lesson);if(m.knowledge.length>24)m.knowledge.splice(0,m.knowledge.length-24);
        addMemory(a,'I can now repeat this process reliably.',state.day,'discovery',90);
        const discoveryMessage=a.name+' establishes: '+(rule.label||key)+'.';
        state.log.unshift({msg:discoveryMessage,type:'discovery'});
        if(state.log.length>40)state.log.length=40;
        state.chronicle.push({msg:discoveryMessage,type:'discovery',day:state.day});
        if(state.chronicle.length>400)state.chronicle.splice(0,state.chronicle.length-400);
        recordDiscovery(state,{id:key,label:rule.label||key,kind:rule.capabilityKind==='observation'?'body-observation':rule.capabilityKind==='artifact'?'artifact':'process',agentId:a.id,day:state.day,evidence:m.experiments.filter(x=>(lookup(x.operation,x.materials)?signature(x.operation,x.materials):x.prototype&&x.prototype.signature)===key).map(x=>x.hypothesis)});
      }
    }
  }
  return state;
}
function experimentSummary(agent){
  const m=mind(agent,false); if(!m||!Array.isArray(m.experiments)) return [];
  return m.experiments.slice(-3).map(x=>({hypothesis:x.hypothesis,operation:x.operation,materials:x.materials,status:x.status,result:x.result}));
}
module.exports={OPERATIONS,normalizeProposal,applyExperimentProposals,resolveExperiments,experimentSummary,canGroundProposal};
