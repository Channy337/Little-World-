'use strict';

const MAX_MEMORIES = 16;
const MAX_KNOWLEDGE = 24;
const MAX_BELIEFS = 12;
const MAX_RELATIONSHIPS = 20;
const MAX_THOUGHTS = 12;

function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function round(v){ return Math.round(v*100)/100; }

function traitCuriosity(trait){
  if(trait==='curious' || trait==='dreamy' || trait==='restless') return 68;
  if(trait==='cautious' || trait==='quiet') return 42;
  return 55;
}

function freshMind(agent){
  return {
    version:1,
    emotions:{joy:52,fear:8,stress:12,loneliness:round(100-(agent.social||50)),curiosity:traitCuriosity(agent.trait)},
    memories:[],
    thoughts:[],
    knowledge:[],
    beliefs:[],
    capabilities:[],
    instructions:[],
    observations:[],
    experiments:[],
    skills:{woodcutting:0,mining:0,farming:0,foraging:0,trading:0,building:0,social:0},
    relationships:{},
    goal:null,
    reflection:null,
    lastLesson:null,
    experience:0
  };
}

function sanitizeMind(agent){
  const m = agent.mind && typeof agent.mind==='object' ? agent.mind : freshMind(agent);
  m.version=1;
  m.emotions=m.emotions&&typeof m.emotions==='object'?m.emotions:{};
  for(const k of ['joy','fear','stress','loneliness','curiosity']){
    if(!Number.isFinite(m.emotions[k])) m.emotions[k]=freshMind(agent).emotions[k];
    m.emotions[k]=round(clamp(m.emotions[k],0,100));
  }
  m.memories=Array.isArray(m.memories)?m.memories.slice(-MAX_MEMORIES):[];
  m.thoughts=Array.isArray(m.thoughts)
    ? m.thoughts.filter(x=>x&&typeof x.text==='string').slice(-MAX_THOUGHTS).map(x=>({
        text:x.text.trim().slice(0,220),
        day:Number.isSafeInteger(x.day)?x.day:0,
        time:Number.isFinite(x.time)?round(clamp(x.time,0,1)):null,
        focus:typeof x.focus==='string'?x.focus.trim().slice(0,80):null
      })).filter(x=>x.text)
    : [];
  m.knowledge=Array.isArray(m.knowledge)?m.knowledge.slice(-MAX_KNOWLEDGE):[];
  m.beliefs=Array.isArray(m.beliefs)?m.beliefs.slice(-MAX_BELIEFS):[];
  m.capabilities=Array.isArray(m.capabilities)
    ? m.capabilities.filter(x=>x&&typeof x.id==='string').slice(-16).map(x=>({
        id:x.id.slice(0,80),kind:typeof x.kind==='string'?x.kind.slice(0,24):'recipe',
        evidence:Math.max(0,Math.floor(Number(x.evidence)||0)),
        discoveredDay:Number.isSafeInteger(x.discoveredDay)?x.discoveredDay:0,
        method:x.method&&typeof x.method==='object'?{
          operation:String(x.method.operation||'').slice(0,20),
          materials:Array.isArray(x.method.materials)?x.method.materials.map(String).slice(0,3):[],
          form:String(x.method.form||'rough').slice(0,20)
        }:null
      }))
    : [];
  m.instructions=Array.isArray(m.instructions)?m.instructions.filter(x=>x&&typeof x.id==='string').slice(-12):[];
  m.observations=Array.isArray(m.observations)?m.observations.filter(x=>x&&typeof x.text==='string').slice(-20):[];
  m.experiments=Array.isArray(m.experiments)?m.experiments.slice(-8):[];
  m.skills=m.skills&&typeof m.skills==='object'?m.skills:{};
  for(const k of ['woodcutting','mining','farming','foraging','trading','building','social']){
    if(!Number.isFinite(m.skills[k])) m.skills[k]=0;
    m.skills[k]=round(clamp(m.skills[k],0,100));
  }
  m.relationships=m.relationships&&typeof m.relationships==='object'?m.relationships:{};
  const ids=Object.keys(m.relationships).slice(-MAX_RELATIONSHIPS);
  const clean={};
  for(const id of ids){
    const r=m.relationships[id]||{};
    clean[id]={
      familiarity:round(clamp(Number.isFinite(r.familiarity)?r.familiarity:0,0,100)),
      trust:round(clamp(Number.isFinite(r.trust)?r.trust:50,0,100)),
      affection:round(clamp(Number.isFinite(r.affection)?r.affection:50,0,100)),
      lastDay:Number.isSafeInteger(r.lastDay)?r.lastDay:0
    };
  }
  m.relationships=clean;
  if(typeof m.goal!=='string') m.goal=null;
  if(typeof m.reflection!=='string') m.reflection=null;
  if(typeof m.lastLesson!=='string') m.lastLesson=null;
  if(!Number.isFinite(m.experience)) m.experience=0;
  m.experience=Math.max(0,Math.floor(m.experience));
  return m;
}

function ensureMinds(state){
  if(!state || !Array.isArray(state.agents)) return state;
  for(const a of state.agents) a.mind=sanitizeMind(a);
  return state;
}

function addUnique(list,value,max){
  if(!value || typeof value!=='string') return;
  const clean=value.trim().slice(0,180);
  if(!clean) return;
  const existing=list.indexOf(clean);
  if(existing!==-1) list.splice(existing,1);
  list.push(clean);
  if(list.length>max) list.splice(0,list.length-max);
}

function addMemory(agent,text,day,kind='experience',importance=50){
  const m=sanitizeMind(agent);
  const clean=(text||'').trim().slice(0,220);
  if(!clean) return;
  if(m.memories.some(x=>x.text===clean && x.day===day)) return;
  m.memories.push({text:clean,day:Number.isSafeInteger(day)?day:0,kind:String(kind).slice(0,24),importance:round(clamp(importance,0,100))});
  if(m.memories.length>MAX_MEMORIES) m.memories.splice(0,m.memories.length-MAX_MEMORIES);
}

function addThought(agent,text,day,time,focus){
  const m=sanitizeMind(agent);
  const clean=(text||'').trim().slice(0,220);
  if(!clean) return;
  const latest=m.thoughts[m.thoughts.length-1];
  if(latest && latest.text===clean && latest.day===day) return;
  m.thoughts.push({
    text:clean,
    day:Number.isSafeInteger(day)?day:0,
    time:Number.isFinite(time)?round(clamp(time,0,1)):null,
    focus:typeof focus==='string'&&focus.trim()?focus.trim().slice(0,80):null
  });
  if(m.thoughts.length>MAX_THOUGHTS) m.thoughts.splice(0,m.thoughts.length-MAX_THOUGHTS);
}

function skillUp(agent,key,amount){
  const m=sanitizeMind(agent);
  if(!Object.hasOwn(m.skills,key)) return;
  m.skills[key]=round(clamp(m.skills[key]+amount,0,100));
  m.experience+=1;
}

function learn(agent,fact){
  const m=sanitizeMind(agent);
  addUnique(m.knowledge,fact,MAX_KNOWLEDGE);
}
function observe(agent,text,day,source='senses'){
  const m=sanitizeMind(agent),clean=String(text||'').trim().slice(0,180);if(!clean)return;
  if(m.observations.some(x=>x.text===clean&&x.day===day))return;
  m.observations.push({text:clean,day:Number.isSafeInteger(day)?day:0,source:String(source).slice(0,32)});
  if(m.observations.length>20)m.observations.splice(0,m.observations.length-20);
}

function relate(agent,otherId,day,amount=1){
  const m=sanitizeMind(agent);
  const id=String(otherId);
  const r=m.relationships[id]||{familiarity:0,trust:50,affection:50,lastDay:0};
  r.familiarity=round(clamp(r.familiarity+amount*2,0,100));
  r.trust=round(clamp(r.trust+amount*.35,0,100));
  r.affection=round(clamp(r.affection+amount*.25,0,100));
  r.lastDay=Number.isSafeInteger(day)?day:0;
  m.relationships[id]=r;
  const ids=Object.keys(m.relationships);
  if(ids.length>MAX_RELATIONSHIPS){
    ids.sort((a,b)=>(m.relationships[a].lastDay||0)-(m.relationships[b].lastDay||0));
    delete m.relationships[ids[0]];
  }
}

function updateEmotions(agent){
  const m=sanitizeMind(agent);
  const hunger=Number.isFinite(agent.hunger)?agent.hunger:0;
  const energy=Number.isFinite(agent.energy)?agent.energy:50;
  const alertness=agent.body&&Number.isFinite(agent.body.alertness)?agent.body.alertness:75;
  const social=Number.isFinite(agent.social)?agent.social:50;
  const safeHunger=clamp(hunger,0,100);
  const tired=Math.max(100-clamp(energy,0,100),100-clamp(alertness,0,100));
  m.emotions.stress=round(clamp(safeHunger*.45+tired*.28+(100-social)*.17,0,100));
  m.emotions.fear=round(clamp(safeHunger>90?(safeHunger-90)*4:Math.max(0,m.emotions.fear-.4),0,100));
  m.emotions.loneliness=round(clamp(100-social,0,100));
  m.emotions.joy=round(clamp(68-m.emotions.stress*.42-m.emotions.loneliness*.12+(agent.home?6:0),0,100));
  const base=traitCuriosity(agent.trait);
  m.emotions.curiosity=round(clamp(base-m.emotions.stress*.2,0,100));
}

function inventoryDelta(before,after,key){
  const a=after&&after.inv&&Number.isFinite(after.inv[key])?after.inv[key]:0;
  const b=before&&before.inv&&Number.isFinite(before.inv[key])?before.inv[key]:0;
  return a-b;
}

function observeExperience(beforeState,afterState){
  ensureMinds(afterState);
  const prior=new Map((beforeState&&beforeState.agents||[]).map(a=>[a.id,a]));
  for(const a of afterState.agents){
    const b=prior.get(a.id);
    updateEmotions(a);
    if(!b){
      addMemory(a,'I am beginning my own life in Civoria.',afterState.day,'life',70);
      continue;
    }
    const wood=inventoryDelta(b,a,'wood');
    const stone=inventoryDelta(b,a,'stone');
    const food=inventoryDelta(b,a,'food');
    if(wood>0){ skillUp(a,'woodcutting',1.5*wood); learn(a,'Trees can provide wood when worked.'); addMemory(a,'I gathered wood from a tree.',afterState.day,'work',46); }
    if(stone>0){ skillUp(a,'mining',1.5*stone); learn(a,'Rock can provide stone when worked.'); addMemory(a,'I gathered stone from rock.',afterState.day,'work',46); }
    if(food>0){
      if(b.state==='working'&&b.action&&b.action.targetType==='farm'){ skillUp(a,'farming',1.6); learn(a,'Worked farms can produce food.'); }
      else if(b.state==='working'&&b.action&&b.action.targetType==='bush'){ skillUp(a,'foraging',1.2); learn(a,'Some bushes can provide food.'); }
    }
    if(!b.home && a.home){ skillUp(a,'building',3); learn(a,'Wood and stone can be used in construction.'); addMemory(a,'I finished a home of my own.',afterState.day,'milestone',88); }
    if(b.coins!==a.coins){ skillUp(a,'trading',.8); learn(a,'The market can exchange goods and coins.'); }
    if(b.state==='socializing' && a.state!=='socializing' && b.action && b.action.partnerId){
      relate(a,b.action.partnerId,afterState.day,2);
      skillUp(a,'social',.8);
      const teacher=afterState.agents.find(x=>x.id===b.action.partnerId);
      const taught=require('./knowledge').transferKnowledge(afterState,teacher,a);
      if(taught)addMemory(a,'I heard a method from '+teacher.name+', but I still need to prove it.',afterState.day,'teaching',64);
    }
  }
  const previousLogs=new Set((beforeState&&beforeState.log||[]).map(e=>e.day+'|'+e.type+'|'+e.msg));
  for(const entry of afterState.log||[]){
    if(previousLogs.has(entry.day+'|'+entry.type+'|'+entry.msg)) continue;
    for(const a of afterState.agents){
      if(entry.msg.includes(a.name)) addMemory(a,entry.msg,entry.day,entry.type,entry.type==='death'||entry.type==='birth'?90:58);
    }
  }
  return afterState;
}

function summarizeMind(agent,state){
  const m=sanitizeMind(agent);
  const names=new Map((state.agents||[]).map(a=>[String(a.id),a.name]));
  const relationships=Object.entries(m.relationships)
    .sort((x,y)=>y[1].familiarity-x[1].familiarity)
    .slice(0,4)
    .map(([id,r])=>({name:names.get(id)||'someone',familiarity:Math.round(r.familiarity),trust:Math.round(r.trust),affection:Math.round(r.affection)}));
  return {
    emotions:m.emotions,
    memories:m.memories.slice(-5),
    thoughts:m.thoughts.slice(-6),
    knowledge:m.knowledge.slice(-8),
    beliefs:m.beliefs.slice(-5),
    capabilities:m.capabilities.slice(-8),
    instructions:m.instructions.slice(-6),
    observations:m.observations.slice(-8),
    skills:m.skills,
    relationships,
    goal:m.goal,
    reflection:m.reflection,
    lastLesson:m.lastLesson,
    experience:m.experience
  };
}

function enrichAIQueue(queue,state){
  ensureMinds(state);
  const agents=new Map(state.agents.map(a=>[a.id,a]));
  return queue.map(item=>{
    if(item.type==='priority'){
      const a=agents.get(item.agentId);
      return a?{...item,mind:summarizeMind(a,state)}:item;
    }
    if(item.type==='chat'){
      const a=state.agents.find(x=>x.name===item.a.name);
      const b=state.agents.find(x=>x.name===item.b.name);
      return {...item,a:{...item.a,mind:a?summarizeMind(a,state):null},b:{...item.b,mind:b?summarizeMind(b,state):null}};
    }
    return item;
  });
}

function applyReflections(state,queue,priorityResults){
  ensureMinds(state);
  const agents=new Map(state.agents.map(a=>[a.id,a]));
  queue.forEach((item,i)=>{
    if(item.type!=='priority') return;
    const a=agents.get(item.agentId), r=priorityResults[i];
    if(!a||!r) return;
    const m=sanitizeMind(a);
    if(typeof r.thought==='string') addThought(a,r.thought,state.day,state.time,r.focus);
    if(typeof r.goal==='string') m.goal=r.goal.trim().slice(0,140)||m.goal;
    if(typeof r.reflection==='string') m.reflection=r.reflection.trim().slice(0,180)||m.reflection;
    if(typeof r.lesson==='string'){
      const lesson=r.lesson.trim().slice(0,160);
      if(lesson){ m.lastLesson=lesson; addMemory(a,lesson,state.day,'reflection',52); }
    }
    if(typeof r.belief==='string') addUnique(m.beliefs,r.belief,MAX_BELIEFS);
  });
  return state;
}

module.exports={ensureMinds,observeExperience,enrichAIQueue,applyReflections,summarizeMind,freshMind,observe};
