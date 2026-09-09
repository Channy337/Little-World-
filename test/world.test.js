const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldService,MAX_CATCH_UP_MS,SIMULATION_RATE}=require('../lib/world');
const engine=require('../lib/engine');
const {memoryStore}=require('./helpers');
const {namespace,createStore,INIT,CAS,READ}=require('../lib/store');
const {makeHandler}=require('../lib/http');

function fixture(){
  let time=1000000;
  const store=memoryStore(), logs=[];
  const options={store,now:()=>time,seed:()=>42,logger:s=>logs.push(JSON.parse(s))};
  return {store,logs,service:createWorldService(options),options,advance:ms=>time+=ms};
}
function advanceControl(e,realMs){
  let remaining=(realMs/1000)*SIMULATION_RATE;
  while(remaining>1e-12){const dt=Math.min(.1,remaining);e.step(dt);remaining-=dt;}
}
test('concurrent first visitors receive exactly one initialized world',async()=>{
  const f=fixture();
  const records=await Promise.all(Array.from({length:20},()=>createWorldService({...f.options,seed:()=>Math.floor(Math.random()*10000)}).state()));
  for(const r of records) assert.deepEqual(r,records[0]);
  assert.equal(records[0].state.agents.length,9);
});
test('concurrent ticks advance one revision, not one per visitor',async()=>{
  const f=fixture(); const first=await f.service.state(); f.advance(10000);
  const records=await Promise.all(Array.from({length:20},()=>createWorldService(f.options).tick()));
  assert.ok(records.every(r=>r.revision===1));
  const e=engine(first.state);advanceControl(e,10000);
  assert.deepEqual((await f.service.state()).state,JSON.parse(JSON.stringify(e.snapshot())));
});
test('repeated calls cannot accelerate the simulation',async()=>{
  const f=fixture();await f.service.state();f.advance(5000);
  const first=await f.service.tick();
  for(let i=0;i<20;i++)assert.equal((await f.service.tick()).revision,first.revision);
});
test('720 two-minute heartbeats equal one village day',async()=>{
  const f=fixture();const before=await f.service.state();
  for(let i=0;i<720;i++){f.advance(120000);await f.service.heartbeat();}
  const after=await f.service.state();
  assert.equal(after.state.day,before.state.day+1);
  assert.ok(Math.abs(after.state.time-before.state.time)<1e-9);
});
test('long absence catches up at most two minutes and discards excess once',async()=>{
  const f=fixture();const before=await f.service.state();f.advance(7*86400000);
  const after=await f.service.tick();
  assert.equal(after.catchUpSeconds,MAX_CATCH_UP_MS/1000);
  assert.equal(after.lastTickAt-before.lastTickAt,7*86400000);
  assert.equal((await f.service.tick()).revision,1);
  assert.ok(f.logs.find(x=>x.event==='world_tick').skippedMs>0);
});
test('backwards clock never rewinds or ticks',async()=>{
  const f=fixture();const before=await f.service.state();f.advance(-10000);
  const after=await f.service.tick();assert.equal(after.revision,0);assert.equal(after.lastTickAt,before.lastTickAt);
});
test('read endpoint does not advance existing state',async()=>{
  const f=fixture();const a=await f.service.state();f.advance(50000);assert.deepEqual(await f.service.state(),a);
});
test('process restart resumes saved state and random sequence',async()=>{
  const f=fixture();await f.service.state();f.advance(10000);const a=await f.service.tick();
  assert.deepEqual(await createWorldService(f.options).state(),JSON.parse(JSON.stringify({schemaVersion:a.schemaVersion,revision:a.revision,lastTickAt:a.lastTickAt,state:a.state})));
});
test('corrupt or unsupported data is never overwritten',async()=>{
  for(const raw of ['garbage','{}','{"schemaVersion":2}']){
    const f=fixture();f.store.corrupt(raw);await assert.rejects(f.service.tick());assert.equal(await f.store.read(),raw);
  }
});
test('missing established state needs restore, never reseeds',async()=>{
  const f=fixture();await f.service.state();f.store.corrupt(null);
  await assert.rejects(f.service.tick(),/world_missing_restore_required/);
  assert.equal(await f.store.read(),null);
});
test('failed writes leave last known world intact',async()=>{
  const f=fixture();const a=await f.service.state();f.advance(5000);
  f.store.compareAndSwap=async()=>{throw new Error('storage_unavailable');};
  await assert.rejects(f.service.tick());assert.deepEqual(await f.service.state(),a);
});
test('preview, production, development and separate branches have distinct keys',()=>{
  const p=namespace({VERCEL_ENV:'production'}),a=namespace({VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'beta/a'}),b=namespace({VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'beta/b'}),d=namespace({});
  assert.equal(new Set([p,a,b,d]).size,4);
  assert.throws(()=>namespace({VERCEL_ENV:'preview'}));
  assert.throws(()=>namespace({VERCEL:'1'}));
});
test('engine preserves market identity across JSON restores',()=>{
  const s=engine(null,1).snapshot();const market={id:999,type:'market',x:200,y:200,stock:{food:8,wood:0,stone:0}};
  s.buildings.push(market);s.market=market;
  const snapshot=engine(JSON.parse(JSON.stringify(s))).snapshot();
  assert.equal(snapshot.market,snapshot.buildings.find(b=>b.id===999));
});
test('long simulation remains finite with bounded history and population',()=>{
  const e=engine(null,42);for(let i=0;i<60000;i++)e.step(.1);
  const s=e.snapshot();assert.ok(s.agents.length<=34);assert.ok(s.log.length<=40);assert.ok(s.chronicle.length<=400);
  function finite(v){if(typeof v==='number')assert.ok(Number.isFinite(v));else if(v&&typeof v==='object')Object.values(v).forEach(finite);}
  finite(s);
});
test('Upstash adapter uses authenticated POST and exact atomic scripts',async()=>{
  const calls=[];
  const store=createStore({KV_REST_API_URL:'https://example.upstash.io',KV_REST_API_TOKEN:'test-only'},async(url,opts)=>{
    calls.push({url,opts});return {ok:true,json:async()=>({result:1})};
  });
  await store.read();await store.initialize('a');await store.compareAndSwap('a','b');
  assert.deepEqual(calls.map(c=>JSON.parse(c.opts.body)[1]),[READ,INIT,CAS]);
  assert.ok(calls.every(c=>c.opts.headers.Authorization==='Bearer test-only'&&c.opts.signal&&c.opts.method==='POST'));
});
test('Upstash adapter never leaks upstream error details',async()=>{
  const store=createStore({UPSTASH_REDIS_REST_URL:'https://example.upstash.io',UPSTASH_REDIS_REST_TOKEN:'test-only'},async()=>({ok:true,json:async()=>({error:'secret upstream body'})}));
  await assert.rejects(store.read(),/^Error: storage_command_failed$/);
  assert.throws(()=>createStore({}),/storage_not_configured/);
});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(v){this.body=v;return this;}};}
test('HTTP rejects methods, cross origin, client state, and unauthenticated scheduler',async()=>{
  const handler=makeHandler('tick',{service:{tick:()=>{throw new Error('should not execute');}}});
  for(const [req,code] of [[{method:'PUT'},405],[{method:'GET'},401],[{method:'POST',headers:{origin:'https://evil.example',host:'village.example'}},403],[{method:'POST',body:{speed:100}},400]]){
    const res=response();await handler({headers:{},...req},res);assert.equal(res.code,code);
  }
});
test('HTTP returns shared state, no-store, and authenticated scheduler',async()=>{
  const f=fixture();
  for(const [kind,req] of [['state',{method:'GET'}],['tick',{method:'POST'}],['tick',{method:'GET',headers:{authorization:'Bearer test-only'}}]]){
    const res=response();await makeHandler(kind,{service:f.service,env:{CRON_SECRET:'test-only'}})({headers:{},...req},res);
    assert.equal(res.code,200);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.body.state.agents.length,9);
  }
});
test('HTTP error logging and responses redact unexpected error strings',async()=>{
  const logs=[],res=response();
  await makeHandler('state',{service:{state:async()=>{throw new Error('token secret');}},logger:s=>logs.push(s)})({method:'GET',headers:{}},res);
  assert.equal(res.code,503);assert.ok(!JSON.stringify([logs,res]).includes('token secret'));
});
test('frontend and Chronicle contain no local state persistence or AI requests',()=>{
  const fs=require('node:fs');
  for(const file of ['game.js','chronicle.html']) assert.doesNotMatch(fs.readFileSync(file,'utf8'),/localStorage|window\.storage|\/api\/decide/);
});
