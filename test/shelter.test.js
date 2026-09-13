'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const shelter=require('../lib/shelter'),engine=require('../lib/engine');
const {ensureMinds}=require('../lib/mind');
function fixture(){const s=engine(null,42).snapshot();ensureMinds(s);for(const a of s.agents){a.state='idle';a.action=null;a.pending=null;a.home=null;a.hunger=0;a.thirst=0;a.energy=100;a.social=100;a.inv={wood:0,stone:0,timber:0,food:4};}s.agents[0].mind.capabilities=[{id:'shape:wood'}];return s;}
function run(s,n,logs=[]){for(let i=0;i<n;i++){shelter.repair(s,(m)=>logs.push(m));for(const a of s.agents){if(!a.shelterJob)shelter.assign(s,a,m=>logs.push(m));if(a.shelterJob)shelter.step(s,a,.1,m=>logs.push(m));}}return s;}
const materials=s=>s.trees.reduce((n,t)=>n+t.wood,0)+s.agents.reduce((n,a)=>n+a.inv.wood+a.inv.timber,0)+(s.constructionSites||[]).reduce((n,p)=>n+p.wood+p.timber,0)+s.buildings.reduce((n,b)=>n+(b.materials?.timber||0)+(b.stock?.wood||0)+(b.stock?.timber||0),0);
test('unlearned shaping never creates a construction site or grants a recipe',()=>{const s=fixture();s.agents[0].mind.capabilities=[];run(s,100);assert.equal(s.constructionSites.length,0);assert.equal(s.buildings.length,0);});
test('gather, deliver, shape, build and move in conserve all construction material',()=>{
 const s=fixture(),total=materials(s),id=s.agents[0].id,logs=[];let seenDelivery=false,seenFrame=false;
 for(let i=0;i<1000&&!s.agents[0].home;i++){run(s,1,logs);seenDelivery ||= s.agents.some(a=>a.shelterJob?.phase==='deliver'&&a.inv.wood>0);seenFrame ||= s.constructionSites.some(p=>p.stage==='frame');assert.ok(Math.abs(materials(s)-total)<1e-8);assert.ok(s.constructionSites.length<=1);}
 assert.ok(seenDelivery);assert.ok(seenFrame);assert.equal(s.buildings.length,1);assert.equal(s.buildings[0].ownerId,id);assert.equal(s.agents[0].home,s.buildings[0].id);assert.deepEqual(s.buildings[0].materials,{timber:6});assert.ok(logs.some(x=>x.includes('moves into')));
});
test('partial site survives JSON restart with identical outcome',()=>{const a=fixture();run(a,65);const b=JSON.parse(JSON.stringify(a));run(a,800);run(b,800);assert.deepEqual(a,b);});
test('crew cap and resource reservations prevent duplicate tree claims',()=>{const s=fixture();run(s,2);const jobs=s.agents.filter(a=>a.shelterJob);assert.ok(jobs.length<=2);const trees=jobs.map(a=>a.shelterJob.treeId).filter(Boolean);assert.equal(new Set(trees).size,trees.length);});
test('urgent needs interrupt work without losing carried material',()=>{const s=fixture();run(s,40);const a=s.agents.find(a=>a.shelterJob);a.inv.wood=2;a.thirst=80;shelter.step(s,a,.1,()=>{});assert.equal(a.shelterJob,undefined);assert.equal(a.inv.wood,2);});
test('owner loss preserves site and reassigns only to a knowledgeable survivor',()=>{const s=fixture();run(s,5);const p=s.constructionSites[0],id=p.id;s.agents.shift();run(s,5);assert.equal(s.constructionSites[0].id,id);assert.ok(p.blocked);s.agents[0].mind.capabilities=[{id:'shape:wood'}];run(s,1);assert.equal(p.ownerId,s.agents[0].id);});
test('absent resources cannot create a completed building',()=>{const s=fixture();s.trees=[];run(s,400);assert.equal(s.buildings.length,0);assert.equal(s.constructionSites[0].timber,0);});
test('engine retains biology clock and executes physical shelter jobs',()=>{const s=fixture();s.agents[0].inv.timber=6;const before=s.agents[0].age,e=engine(s);for(let i=0;i<100;i++)e.step(.1);const after=e.snapshot();assert.ok(after.buildings.some(b=>b.type==='house'));assert.ok(Math.abs(after.agents[0].age-before-10/(55*360))<1e-8);});

test('excess carried wood does not trap the builder in empty deliveries',()=>{const s=fixture();s.agents[0].inv.wood=20;const total=materials(s);run(s,700);assert.ok(s.agents[0].home);assert.equal(materials(s),total);});

test('corrupt construction balances and job phases are rejected',()=>{const s=fixture();run(s,1);shelter.validate(s);s.constructionSites[0].timber=-1;assert.throws(()=>shelter.validate(s),/world_invalid/);s.constructionSites[0].timber=0;s.agents[0].shelterJob.phase='teleport';assert.throws(()=>shelter.validate(s),/world_invalid/);});
