'use strict';
// Persistent physical jobs. All numbers here use the engine's internal clock.
// At V0.6's scale, speed 220 is ~4.2 world units per real second.
const SPEED=220, TIMBER_REQUIRED=6, BUILD_WORK=3;
const {AFFORDANCES,canPay,pay,produce}=require('./affordances');
const shaping=AFFORDANCES['shape:wood'];
const knows=a=>!!a.mind?.capabilities?.some(c=>c.id==='shape:wood');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=(s,id)=>s.agents.find(a=>a.id===id&&!a.dead);
const project=s=>(s.constructionSites||[])[0];
function clear(a){delete a.shelterJob;delete a.workReason;a.state='idle';a.action=null;a.pending=null;a.tx=null;a.ty=null;}
function safe(a,s){return a.hunger<72&&a.thirst<50&&a.energy>22&&a.social>25&&!(s.fires||[]).some(f=>distance(a,f)<38);}
function move(a,p,dt){const d=distance(a,p),step=SPEED*dt;if(d<=step){a.x=p.x;a.y=p.y;return true;}a.x+=(p.x-a.x)/d*step;a.y+=(p.y-a.y)/d*step;return false;}
function phase(a,name,p){a.shelterJob.phase=name;a.shelterJob.timer=0;a.state='moving';a.tx=p.x;a.ty=p.y;}
function repair(s,log){
  const p=project(s);if(!p)return;
  let owner=alive(s,p.ownerId);
  if(!owner||owner.home){
    owner=s.agents.find(a=>!a.dead&&!a.home&&!a.pendingHome&&knows(a));
    if(owner){p.ownerId=owner.id;log(owner.name+' takes responsibility for the unfinished shelter.','build');}
  }
  p.workerIds=p.workerIds.filter(id=>alive(s,id)?.shelterJob?.siteId===p.id);
  p.blocked=!owner?'Waiting for a future resident who knows how to shape timber.':!s.agents.some(a=>!a.dead&&knows(a))?'Waiting for someone who knows how to shape timber.':null;
}
function spot(s){
  const bounds=s.worldBounds||{w:480,h:304},center=s.well;
  for(let ring=1;ring<=6;ring++)for(let i=0;i<12;i++){
    const angle=i*Math.PI/6,p={x:center.x+Math.cos(angle)*ring*38,y:center.y+Math.sin(angle)*ring*30};
    if(p.x<24||p.x>bounds.w-24||p.y<24||p.y>bounds.h-24)continue;
    if(distance(p,s.pond)<Math.max(s.pond.w||76,s.pond.h||32)/2+24)continue;
    if([s.well,...s.buildings,...s.farms,...s.trees,...s.rocks,...s.bushes,...(s.fires||[])].every(b=>distance(p,b)>28))return p;
  }
  return null;
}
function assign(s,a,log){
  if(!safe(a,s))return false;
  if(a.pendingHome){
    const home=s.buildings.find(b=>b.id===a.pendingHome);
    if(home){a.shelterJob={siteId:home.id,phase:'movein',timer:0};a.state='moving';a.action=null;a.pending=null;a.tx=home.x;a.ty=home.y;return true;}
    delete a.pendingHome;
  }
  if(!s.constructionSites)s.constructionSites=[];
  repair(s,log);let p=project(s);
  if(!p){
    const owner=s.agents.find(v=>!v.dead&&!v.home&&!v.pendingHome&&knows(v));
    if(!owner)return false;
    const pos=spot(s);if(!pos)return false;
    p={id:s.nextId++,x:pos.x,y:pos.y,ownerId:owner.id,workerIds:[],wood:0,timber:0,work:0,stage:'materials',blocked:null};
    s.constructionSites.push(p);log('A shelter site is marked for '+owner.name+'. Six shaped timbers are needed.','build');
  }
  if(p.blocked||p.workerIds.length>=Math.max(1,Math.min(2,Math.floor(s.agents.length/3))))return false;
  // Always leave the last crew place available for a knowledgeable builder.
  if(!knows(a)&&!p.workerIds.some(id=>knows(alive(s,id)||{}))&&p.workerIds.length>=1)return false;
  a.shelterJob={siteId:p.id,phase:'choose',timer:0};a.action=null;a.pending=null;a.state='idle';
  p.workerIds.push(a.id);a.workReason='Helping build shelter for '+(alive(s,p.ownerId)?.name||'a villager')+'.';
  return true;
}
function step(s,a,dt,log){
  const job=a.shelterJob;if(!job)return false;
  // Reservations are references to active jobs, not a second resource balance.
  if(!safe(a,s)){clear(a);return false;}
  if(job.phase==='movein'){
    const home=s.buildings.find(b=>b.id===job.siteId&&b.type==='house');
    if(!home){clear(a);return false;}
    a.state='moving';if(move(a,home,dt)){a.home=home.id;delete a.pendingHome;log(a.name+' moves into the new shelter.','build');clear(a);}return true;
  }
  const p=project(s);if(!p||p.id!==job.siteId){clear(a);return false;}
  if(p.blocked){clear(a);return false;}
  const resident=alive(s,p.ownerId);
  a.workReason='Shelter for '+(resident?.name||'a villager')+' · '+({choose:'choosing the next task',fetch:'walking to a tree',gather:'gathering wood',deliver:'carrying materials to the site',shape:'shaping delivered wood',build:'assembling the shelter'}[job.phase]||'working')+'.';
  if(job.phase==='choose'){
    const inTransit=p.workerIds.reduce((n,id)=>{const worker=alive(s,id);return n+(worker&&worker.shelterJob?.phase==='deliver'?(worker.inv.wood||0)+(worker.inv.timber||0):0);},0);
    if(p.timber>=TIMBER_REQUIRED){phase(a,'build',p);return true;}
    if((a.inv.timber||0)>0||((a.inv.wood||0)>0&&p.wood+p.timber<TIMBER_REQUIRED)){phase(a,'deliver',p);return true;}
    if(p.wood>0&&knows(a)){phase(a,'shape',p);return true;}
    if(p.wood+p.timber+inTransit>=TIMBER_REQUIRED){clear(a);return false;}
    const tree=s.trees.filter(t=>t.wood>=1&&!s.agents.some(v=>v.id!==a.id&&v.shelterJob?.treeId===t.id)).sort((x,y)=>distance(a,x)-distance(a,y))[0];
    if(!tree){p.blocked='Waiting for reachable wood or a free tree.';clear(a);return false;}
    job.treeId=tree.id;phase(a,'fetch',tree);return true;
  }
  if(job.phase==='fetch'||job.phase==='gather'){
    const tree=s.trees.find(t=>t.id===job.treeId);
    if(!tree||tree.wood<1){delete job.treeId;job.phase='choose';return true;}
    if(job.phase==='fetch'){a.state='moving';if(move(a,tree,dt)){job.phase='gather';job.timer=0;a.state='working';}return true;}
    a.state='working';job.timer+=dt;
    if(job.timer>=.35){tree.wood-=1;a.inv.wood=(a.inv.wood||0)+1;delete job.treeId;phase(a,'deliver',p);}return true;
  }
  if(job.phase==='deliver'){
    a.state='moving';if(!move(a,p,dt))return true;
    const timber=Math.min(a.inv.timber||0,TIMBER_REQUIRED-p.timber),wood=Math.min(a.inv.wood||0,Math.max(0,TIMBER_REQUIRED-p.timber-timber-p.wood));
    a.inv.timber-=timber;a.inv.wood-=wood;p.timber+=timber;p.wood+=wood;
    if(timber||wood)log(a.name+' delivers '+wood+' wood and '+timber+' timber to the shelter site.','build');
    job.phase='choose';a.state='idle';return true;
  }
  if(job.phase==='shape'){
    if(!knows(a)){job.phase='choose';return true;}
    if(distance(a,p)>.01){a.state='moving';move(a,p,dt);return true;}
    a.state='working';job.timer+=dt;
    // This is the already-discovered shape:wood recipe, with its existing cost/duration.
    if(job.timer>=shaping.duration){if(canPay(p,shaping.inputs)&&p.timber<TIMBER_REQUIRED){pay(p,shaping.inputs);produce(p,shaping.outputs);}job.phase='choose';job.timer=0;}return true;
  }
  if(job.phase==='build'){
    if(p.timber<TIMBER_REQUIRED){job.phase='choose';return true;}
    if(!knows(a)){clear(a);return false;}
    if(distance(a,p)>.01){a.state='moving';move(a,p,dt);return true;}
    a.state='working';p.work=Math.min(BUILD_WORK,p.work+dt);
    const stage=p.work<1?'foundation':p.work<2?'frame':'roof';
    if(p.stage!==stage){p.stage=stage;log('The shelter '+stage+' takes shape.','build');}
    if(p.work>=BUILD_WORK){
      if(!resident||resident.home){p.blocked='Waiting for a future resident.';return true;}
      s.buildings.push({id:p.id,type:'house',x:p.x,y:p.y,ownerId:p.ownerId,materials:{timber:TIMBER_REQUIRED},methods:['shape:wood']});
      // Any remaining deposited wood remains a physical stock in the finished building.
      s.buildings[s.buildings.length-1].stock={wood:p.wood,timber:p.timber-TIMBER_REQUIRED};
      s.constructionSites=[];log('The shelter for '+resident.name+' is complete.','build');
      for(const v of s.agents)if(v.shelterJob?.siteId===p.id)clear(v);
      resident.pendingHome=p.id;
      if(safe(resident,s)){resident.shelterJob={siteId:p.id,phase:'movein',timer:0};resident.workReason='Moving into the completed shelter.';resident.state='moving';resident.pending=null;resident.action=null;resident.tx=p.x;resident.ty=p.y;}
    }return true;
  }
  clear(a);return false;
}
function validate(s){
  const integer=n=>Number.isSafeInteger(n)&&n>=0;
  if(s.constructionSites!==undefined){
    if(!Array.isArray(s.constructionSites)||s.constructionSites.length>1)throw Error('world_invalid');
    for(const p of s.constructionSites){
      if(!integer(p.id)||!integer(p.ownerId)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||
        !integer(p.wood)||p.wood>6||!integer(p.timber)||p.timber>6||!Number.isFinite(p.work)||p.work<0||p.work>BUILD_WORK||
        !['materials','foundation','frame','roof'].includes(p.stage)||
        !Array.isArray(p.workerIds)||p.workerIds.length>2||new Set(p.workerIds).size!==p.workerIds.length||!p.workerIds.every(integer)||
        !(p.blocked===null||typeof p.blocked==='string'))throw Error('world_invalid');
    }
  }
  for(const a of s.agents){
    if(a.pendingHome!==undefined&&!integer(a.pendingHome))throw Error('world_invalid');
    const j=a.shelterJob;
    if(j&&(!integer(j.siteId)||!['choose','fetch','gather','deliver','shape','build','movein'].includes(j.phase)||!Number.isFinite(j.timer)||j.timer<0||j.treeId!==undefined&&!integer(j.treeId)))throw Error('world_invalid');
  }
}
module.exports={assign,step,repair,clear,knows,validate,TIMBER_REQUIRED,BUILD_WORK};
