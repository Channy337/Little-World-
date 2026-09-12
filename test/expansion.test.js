const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../lib/engine');
const {ensureWorldBounds,targetLevel,expandToLevel,maybeExpandWorld}=require('../lib/expansion');

test('old saves gain base world bounds without moving anything',()=>{
  const state=engine(null,42).snapshot();
  const before=state.agents.map(a=>[a.id,a.x,a.y]);
  delete state.worldBounds;
  ensureWorldBounds(state);
  assert.deepEqual(state.worldBounds,{w:480,h:304,level:0});
  assert.deepEqual(state.agents.map(a=>[a.id,a.x,a.y]),before);
});

test('settlement growth unlocks deterministic canonical land outside the original map',()=>{
  const state=engine(null,42).snapshot();
  state.buildings=Array.from({length:10},(_,i)=>({id:1000+i,type:'house',x:200+i,y:150,ownerId:null}));
  state.nextId=2000;
  ensureWorldBounds(state);
  assert.equal(targetLevel(state),1);
  maybeExpandWorld(state);
  assert.deepEqual(state.worldBounds,{w:640,h:405,level:1});
  const frontier=[...state.trees,...state.rocks,...state.bushes,...state.farms].filter(v=>v.territoryLevel===1);
  assert.equal(frontier.length,15);
  assert.ok(frontier.every(v=>v.x>480||v.y>304));
  assert.ok(frontier.every(v=>v.x>=0&&v.x<=640&&v.y>=0&&v.y<=405));
  assert.ok(state.log.some(e=>e.type==='expansion'));
});

test('expansion is idempotent and later stages add land rather than replacing old land',()=>{
  const state=engine(null,7).snapshot();
  state.nextId=3000;
  expandToLevel(state,1);
  const ids=new Set([...state.trees,...state.rocks,...state.bushes,...state.farms].map(v=>v.id));
  const count=ids.size;
  expandToLevel(state,1);
  assert.equal(new Set([...state.trees,...state.rocks,...state.bushes,...state.farms].map(v=>v.id)).size,count);
  expandToLevel(state,2);
  assert.deepEqual(state.worldBounds,{w:800,h:506,level:2});
  for(const id of ids) assert.ok([...state.trees,...state.rocks,...state.bushes,...state.farms].some(v=>v.id===id));
  assert.ok([...state.trees,...state.rocks,...state.bushes,...state.farms].some(v=>v.territoryLevel===2&&(v.x>640||v.y>405)));
});

test('viewer and activity clock understand canonical world bounds',()=>{
  const fs=require('node:fs');
  const growth=fs.readFileSync('growth-visuals.js','utf8');
  const activity=fs.readFileSync('activity-clock.js','utf8');
  assert.match(growth,/worldBounds/);
  assert.match(growth,/projectState/);
  assert.match(growth,/renderTerritory/);
  assert.match(activity,/boundsFor/);
  assert.match(activity,/world\.w/);
  assert.match(activity,/world\.h/);
});
