const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldService}=require('../lib/world');
const {makeHandler}=require('../lib/http');
const {memoryStore}=require('./helpers');
function fixture(){
  let time=1000000;
  const store=memoryStore();
  const service=createWorldService({store,now:()=>time,seed:()=>42,logger:()=>{}});
  return {store,service,advance:ms=>time+=ms};
}
test('scheduled calls advance a village with no browser present',async()=>{
  const f=fixture(),first=await f.service.state();
  for(let i=0;i<5;i++){f.advance(120000);const h=await f.service.heartbeat();assert.equal(h.catchUpSeconds,120);assert.equal(h.state,undefined);}
  const last=await f.service.state();
  assert.ok(last.state.day>first.state.day);assert.equal(last.lastHeartbeatAt,1600000);
  f.advance(5000);await f.service.tick();assert.equal((await f.service.state()).lastHeartbeatAt,1600000);
});
test('concurrent browser and heartbeat do not double advance',async()=>{
  const f=fixture();await f.service.state();f.advance(10000);
  await Promise.all([f.service.tick(),f.service.heartbeat(),f.service.tick()]);
  const state=await f.service.state();assert.equal(state.lastTickAt,1010000);assert.equal(state.lastHeartbeatAt,1010000);
  const control=fixture();await control.service.state();control.advance(10000);await control.service.tick();
  assert.deepEqual(state.state,(await control.service.state()).state);
});
test('heartbeat failure cannot report success or overwrite saved state',async()=>{
  const f=fixture(),first=await f.service.state();f.advance(120000);
  f.store.compareAndSwap=async()=>0;
  await assert.rejects(f.service.heartbeat(),/world_busy/);assert.deepEqual(await f.service.state(),first);
});
test('duplicate and backwards heartbeat deliveries never replay simulation',async()=>{
  const f=fixture();await f.service.state();f.advance(120000);await f.service.heartbeat();
  const first=await f.service.state();await f.service.heartbeat();f.advance(-5000);await f.service.heartbeat();
  const last=await f.service.state();assert.deepEqual(last.state,first.state);assert.equal(last.lastTickAt,first.lastTickAt);assert.equal(last.lastHeartbeatAt,first.lastHeartbeatAt);
});
test('heartbeat always requires server authorization and rejects client commands',async()=>{
  let calls=0;
  for(const [method,authorization,body,code] of [['GET',undefined,undefined,401],['POST',undefined,undefined,401],['POST','Bearer wrong',undefined,401],['POST','Bearer test-only',{speed:4},400],['GET','Bearer test-only',undefined,200],['POST','Bearer test-only',{},200],['DELETE','Bearer test-only',undefined,405]]){
    const res={setHeader(){},status(c){this.code=c;return this;},json(b){this.body=b;return this;}};
    await makeHandler('heartbeat',{env:{CRON_SECRET:'test-only'},service:{heartbeat:async()=>{calls++;return {day:1};}}})({method,headers:{authorization},body},res);
    assert.equal(res.code,code);
  }
  assert.equal(calls,2);
});
