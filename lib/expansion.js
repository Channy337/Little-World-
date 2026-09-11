'use strict';

const BASE={w:480,h:304};
const LEVELS=[
  {level:0,w:480,h:304},
  {level:1,w:640,h:405,buildings:10,population:18},
  {level:2,w:800,h:506,buildings:18,population:26},
  {level:3,w:960,h:608,buildings:28,population:36}
];

function hash(seed){
  let x=(seed>>>0)+0x9e3779b9;
  x=Math.imul(x^(x>>>16),0x21f0aaad);
  x=Math.imul(x^(x>>>15),0x735a2d97);
  return (x^(x>>>15))>>>0;
}
function unit(seed){return hash(seed)/4294967296;}
function ensureWorldBounds(state){
  if(!state.worldBounds||!Number.isFinite(state.worldBounds.w)||!Number.isFinite(state.worldBounds.h)){
    state.worldBounds={w:BASE.w,h:BASE.h,level:0};
  }
  if(!Number.isSafeInteger(state.worldBounds.level)||state.worldBounds.level<0) state.worldBounds.level=0;
  return state.worldBounds;
}
function targetLevel(state){
  const b=(state.buildings||[]).length,p=(state.agents||[]).length,current=ensureWorldBounds(state).level;
  let target=current;
  for(const cfg of LEVELS){
    if(cfg.level<=current) continue;
    if(b>=cfg.buildings||p>=cfg.population) target=cfg.level;
    else break;
  }
  return target;
}
function pointInNewLand(oldB,newB,seed){
  const right=unit(seed)<0.56;
  if(right) return {x:oldB.w+18+unit(seed+1)*Math.max(24,newB.w-oldB.w-36),y:18+unit(seed+2)*(newB.h-36)};
  return {x:18+unit(seed+1)*(newB.w-36),y:oldB.h+18+unit(seed+2)*Math.max(24,newB.h-oldB.h-36)};
}
function addResources(state,level,oldB,newB){
  const root=(state.rng>>>0)^Math.imul(level,2654435761);
  for(let i=0;i<7;i++){
    const p=pointInNewLand(oldB,newB,root+i*17);
    state.trees.push({id:state.nextId++,x:p.x,y:p.y,wood:5,max:5,discoveredDay:state.day,territoryLevel:level});
  }
  for(let i=0;i<4;i++){
    const p=pointInNewLand(oldB,newB,root+300+i*19);
    state.rocks.push({id:state.nextId++,x:p.x,y:p.y,stone:8,max:8,discoveredDay:state.day,territoryLevel:level});
  }
  for(let i=0;i<4;i++){
    const p=pointInNewLand(oldB,newB,root+600+i*23);
    state.bushes.push({id:state.nextId++,x:p.x,y:p.y,food:3,max:3,discoveredDay:state.day,territoryLevel:level});
  }
  for(let i=0;i<3;i++){
    const p=pointInNewLand(oldB,newB,root+900+i*29);
    state.farms.push({id:state.nextId++,x:p.x,y:p.y,planted:false,growth:0,territoryLevel:level});
  }
}
function logExpansion(state){
  const msg='Civoria expands its settled frontier into new land.';
  state.log.unshift({msg,type:'expansion'});if(state.log.length>40)state.log.length=40;
  state.chronicle.push({msg,type:'expansion',day:state.day});if(state.chronicle.length>400)state.chronicle.splice(0,state.chronicle.length-400);
}
function expandToLevel(state,level){
  ensureWorldBounds(state);
  while(state.worldBounds.level<level){
    const next=LEVELS[state.worldBounds.level+1];if(!next)break;
    const oldB={w:state.worldBounds.w,h:state.worldBounds.h};
    const newB={w:next.w,h:next.h};
    state.worldBounds={w:next.w,h:next.h,level:next.level};
    addResources(state,next.level,oldB,newB);
    logExpansion(state);
  }
  return state;
}
function maybeExpandWorld(state){return expandToLevel(state,targetLevel(state));}
function maxPopulationFor(state){return 34+ensureWorldBounds(state).level*12;}

module.exports={BASE,LEVELS,ensureWorldBounds,targetLevel,expandToLevel,maybeExpandWorld,maxPopulationFor};
