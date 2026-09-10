'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const createEngine = require('../lib/engine');
const {resolvePending, requestThought, MODEL} = require('../lib/ai');
const {createWorldService, decode} = require('../lib/world');
const {memoryStore} = require('./helpers');
const env = {CIVORIA_AI:'on'};
const replacer = (key, value) => ['aiPending','aiFocus','aiThought'].includes(key) ? undefined : value;

// Regenerated directly from git show 799e086:lib/engine.js, 20,000 steps of 0.1.
// These are fixed historical expectations, never generated from the engine under test.
const baseline = {
  1:'d0cd06ed00736d7f2d451bcc705e9982',
  42:'6689be8d9250a6fce3bab6aa3223a9a5',
  20260910:'dbf6fc1f9409c85240437510dca4ca4d'
};
for(const [seed, expected] of Object.entries(baseline)) {
  test(`pre-AI determinism: seed ${seed}, 20,000 steps, both flag states without answers`, () => {
    for(const aiEnabled of [false,true]) {
      const e = createEngine(null, Number(seed), {aiEnabled});
      for(let i=0;i<20000;i++) e.step(.1);
      const digest = createHash('sha256').update(JSON.stringify(e.snapshot(),replacer)).digest('hex').slice(0,32);
      assert.equal(digest,expected);
    }
  });
}
function fresh() {
  const state = createEngine(null,42,{aiEnabled:false}).snapshot();
  // Explicitly clear flags before every test that counts requests.
  for(const a of state.agents) Object.assign(a, {aiPending:false, aiFocus:null, aiThought:null,
    aiCooldown:100, hunger:20, energy:80, social:80, role:'woodcutter', state:'idle', action:null});
  return state;
}
function step(state, aiEnabled=true, dt=0) {
  const e=createEngine(state,1,{aiEnabled}); e.step(dt); return e.snapshot();
}
function record(state) { return {schemaVersion:1,revision:0,lastTickAt:1000000,state}; }
function serviceFixture(state, aiRequest, extra={}) {
  const store=memoryStore();store.corrupt(JSON.stringify(record(state)));
  let writes=0;
  const cas=store.compareAndSwap;
  store.compareAndSwap=async (...args)=>{writes++;return cas(...args);};
  return {store, writes:()=>writes, service:createWorldService({store,now:()=>1005000,logger:()=>{},env,aiRequest,...extra})};
}

test('every intention starts once, logs once, then ordinary work resumes',()=>{
  for(const focus of ['wander','visit:well','visit:pond','visit:market','seek:Friend','work:farmer','work:miner','work:trader']) {
    const s=fresh();
    const market={id:s.nextId++,type:'market',x:200,y:150,stock:{wood:0,stone:0,food:0}};
    s.buildings.push(market);s.market=market;
    s.agents[1].name='Friend';
    Object.assign(s.agents[0],{aiFocus:focus,aiThought:'I want a little change.'});
    const after=step(s), a=after.agents[0];
    assert.equal(a.aiFocus,null,focus);
    assert.equal(a.aiThought,null);
    assert.equal(a.role,'woodcutter');
    assert.equal(a.state,'moving');
    assert.equal(after.log.filter(e=>e.type==='thought').length,1);
    if(focus.startsWith('visit:')) {
      const target=after[focus.slice(6)];
      assert.deepEqual([a.tx,a.ty,a.pending.targetType],[target.x,target.y,'landmark']);
      a.x=a.tx;a.y=a.ty;
      const arrived=step(after);
      assert.equal(arrived.agents[0].action.duration,1.5);
    }
    if(focus==='seek:Friend') assert.deepEqual([a.tx,a.ty],[s.agents[1].x,s.agents[1].y]);
    if(focus==='work:farmer') assert.equal(a.pending.targetType,'farm');
    if(focus==='work:miner') assert.equal(a.pending.targetType,'rock');
    Object.assign(a,{state:'idle',action:null,pending:null});
    const again=step(after);
    assert.equal(again.agents[0].pending.targetType,'tree');
    assert.equal(again.log.filter(e=>e.type==='thought').length,1);
  }
});
test('uncomfortable villagers preserve intentions and follow needs or ordinary work',()=>{
  for(const needs of [{hunger:60},{energy:35},{hunger:93},{energy:9}]) {
    const s=fresh();Object.assign(s.agents[0],needs,{aiFocus:'visit:well',aiThought:'Later.'});
    const after=step(s), a=after.agents[0];
    assert.equal(a.aiFocus,'visit:well');assert.equal(a.aiThought,'Later.');
    assert.equal(after.log.filter(e=>e.type==='thought').length,0);
    assert.notEqual(a.pending?.targetType,'landmark');
    if(needs.energy===9) assert.equal(a.state,'resting');
  }
});
test('soft social needs precede comfortable intentions',()=>{
  const s=fresh();Object.assign(s.agents[0],{social:10,aiFocus:'wander'});
  const a=step(s).agents[0];assert.equal(a.state,'socializing');assert.equal(a.aiFocus,'wander');
  assert.equal(a.action.chatLine,null);assert.equal(a.action.chatId,undefined);
});
test('intention tier runs before the night rule',()=>{
  const s=fresh();s.time=.95;
  const home={id:s.nextId++,type:'house',x:s.agents[0].x,y:s.agents[0].y};s.buildings.push(home);
  Object.assign(s.agents[0],{home:home.id,aiFocus:'visit:pond'});
  assert.equal(step(s).agents[0].pending.targetType,'landmark');
});
test('unknown intentions and absent targets drop silently and normal work continues',()=>{
  for(const focus of ['bad','visit:castle','visit:market','seek:Missing','work:wizard','work:woodcutter',42,{}]) {
    const s=fresh();Object.assign(s.agents[0],{aiFocus:focus,aiThought:'Do not log this.'});
    const after=step(s);assert.equal(after.agents[0].aiFocus,null);
    assert.equal(after.agents[0].pending.targetType,'tree');
    assert.equal(after.log.filter(e=>e.type==='thought').length,0);
  }
});
test('comfort gates requests but never skips the cooldown random draw',()=>{
  for(const needs of [{hunger:60},{energy:35},{hunger:20,energy:80}]) {
    const s=fresh();Object.assign(s.agents[0],needs,{aiCooldown:0});
    const on=step(s), off=step(s,false);
    assert.equal(on.agents[0].aiPending,needs.hunger===20);
    assert.equal(on.agents[0].aiCooldown,off.agents[0].aiCooldown);
    assert.equal(on.rng,off.rng);
    assert.ok(on.agents[0].aiCooldown>=16 && on.agents[0].aiCooldown<=26);
  }
});
test('flag off suppresses intentions and requests even when pending focus is saved',async()=>{
  for(const value of [undefined,'off','ON','true']) {
    const s=fresh();Object.assign(s.agents[0],{aiPending:true,aiFocus:'visit:well'});
    let calls=0;const f=serviceFixture(s,()=>{calls++;},{env:{CIVORIA_AI:value}});
    await f.service.heartbeat();assert.equal(calls,0);
    const saved=decode(await f.store.read()).state;
    assert.equal(saved.agents[0].pending.targetType,'tree');
    assert.equal(saved.agents[0].aiPending,false);
  }
});
test('hostile AI text becomes bounded strings and still passes decode after logging',async()=>{
  for(const thought of ['hi\n\r\t   there '+ 'x'.repeat(400),400,{bad:'type'},['many','words'],null]) {
    const s=fresh();s.agents[0].aiPending=true;
    await resolvePending(s,{env,request:async()=>({focus:'visit:well',thought,type:'BAD\nTYPE'})});
    const a=s.agents[0];assert.equal(typeof a.aiThought,'string');assert.ok(a.aiThought.length<=90);
    assert.doesNotMatch(a.aiThought,/\s{2}|[\r\n\t]/);
    assert.doesNotThrow(()=>decode(JSON.stringify(record(step(s)))));
    assert.ok(step(s).log.every(e=>/^[a-z]+$/.test(e.type)));
  }
});
test('garbage responses never enter the world record',async()=>{
  for(const answer of [null,42,'garbage',[],{focus:42},{focus:{}},{focus:'hack'},{focus:'wander'.padEnd(400,'x')}]) {
    const s=fresh();s.agents[0].aiPending=true;
    await resolvePending(s,{env,request:async()=>answer});
    assert.equal(s.agents[0].aiFocus,null);assert.equal(s.agents[0].aiPending,false);
    assert.doesNotThrow(()=>decode(JSON.stringify(record(s))));
  }
});
test('dead and uncomfortable requesters are skipped and every pending flag clears',async()=>{
  const s=fresh();s.agents.forEach(a=>a.aiPending=true);
  s.agents[0].dead=true;s.agents[1].hunger=60;s.agents[2].energy=35;
  const ids=[];await resolvePending(s,{env,request:async a=>{ids.push(a.id);return null;}});
  assert.deepEqual(ids,s.agents.slice(3).map(a=>a.id));
  assert.ok(s.agents.every(a=>!a.aiPending));
});
test('parallel answers match by id even after removal and reordering',async()=>{
  const s=fresh();s.agents.slice(0,3).forEach(a=>a.aiPending=true);
  const ids=s.agents.slice(0,3).map(a=>a.id), callbacks=[];
  const pending=resolvePending(s,{env,request:a=>new Promise(resolve=>callbacks.push({id:a.id,resolve}))});
  await Promise.resolve();
  assert.equal(callbacks.length,3); // All calls started before any answer.
  s.agents=s.agents.filter(a=>a.id!==ids[0]).reverse();
  for(const c of callbacks.reverse()) c.resolve({focus:'wander',thought:'For '+c.id});
  await pending;
  for(const id of ids.slice(1)) assert.equal(s.agents.find(a=>a.id===id).aiThought,'For '+id);
  assert.ok(!s.agents.some(a=>a.id===ids[0]));
});
test('eight-call cap clears overflow without creating a backlog',async()=>{
  const s=fresh();s.agents.forEach(a=>a.aiPending=true);let calls=0;
  await resolvePending(s,{env,request:async()=>{calls++;return {focus:'wander',thought:'A stroll.'};}});
  assert.equal(calls,8);assert.ok(s.agents.every(a=>!a.aiPending));
  await resolvePending(s,{env,request:async()=>{calls++;}});assert.equal(calls,8);
});
test('browser tick never calls AI, heartbeat writes answer, subsequent tick acts',async()=>{
  const s=fresh();Object.assign(s.agents[0],{aiPending:true,state:'resting',action:{home:false,timer:0}});
  let calls=0;
  const f=serviceFixture(s,async()=>{calls++;return {focus:'visit:well',thought:'Water sounds peaceful.'};});
  await f.service.tick();assert.equal(calls,0);
  const before=decode(await f.store.read());
  // A heartbeat with no additional elapsed simulation still resolves saved pending flags.
  await f.service.heartbeat();assert.equal(calls,1);
  const after=decode(await f.store.read());
  assert.equal(after.state.agents[0].aiFocus,'visit:well');
  assert.equal(after.state.log.filter(e=>e.type==='thought').length,0);
  assert.equal(after.revision,before.revision+1);
  Object.assign(after.state.agents[0],{state:'idle',action:null});
  assert.equal(step(after.state).agents[0].pending.targetType,'landmark');
});
test('throwing AI still lets heartbeat succeed and write exactly once',async()=>{
  const s=fresh();s.agents[0].aiPending=true;
  const f=serviceFixture(s,()=>{throw new Error('private upstream failure');});
  const result=await f.service.heartbeat();assert.equal(result.revision,1);assert.equal(f.writes(),1);
  const saved=decode(await f.store.read());assert.equal(saved.state.agents[0].aiPending,false);
  assert.doesNotMatch(await f.store.read(),/private upstream/);
});
test('hard timeout aborts stuck clients and late answers cannot mutate saved state',async()=>{
  const s=fresh();s.agents[0].aiPending=true;let signal,finish;
  const f=serviceFixture(s,(_a,_s,opts)=>{signal=opts.signal;return new Promise(r=>finish=r);},{aiTimeoutMs:10});
  await f.service.heartbeat();assert.equal(signal.aborted,true);assert.equal(f.writes(),1);
  const saved=await f.store.read();finish({focus:'wander',thought:'Too late.'});await Promise.resolve();
  assert.equal(await f.store.read(),saved);assert.equal(decode(saved).state.agents[0].aiFocus,null);
});
test('heartbeat conflict retries share one budget of eight calls',async()=>{
  const s=fresh();s.agents.forEach(a=>a.aiPending=true);let calls=0;
  const f=serviceFixture(s,async()=>{calls++;return {focus:'wander',thought:'A stroll.'};});
  const cas=f.store.compareAndSwap;let attempts=0;
  f.store.compareAndSwap=async(...args)=>++attempts===1?0:cas(...args);
  await f.service.heartbeat();assert.equal(calls,8);assert.equal(attempts,2);
  assert.ok(decode(await f.store.read()).state.agents.every(a=>!a.aiPending));
});
test('Anthropic client sends Haiku with signal and parses the same response for focus and thought',async()=>{
  const s=fresh(), signal=new AbortController().signal;let calls=0;
  const answer=await requestThought(s.agents[0],s,{env:{...env,ANTHROPIC_API_KEY:'test-only'},signal,fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://api.anthropic.com/v1/messages');assert.equal(options.signal,signal);
    const body=JSON.parse(options.body);assert.equal(body.model,MODEL);
    assert.match(body.messages[0].content,/visit:well/);
    return {ok:true,json:async()=>({content:[{type:'text',text:'{"focus":"wander","thought":"A stroll."}'}]})};
  }});
  assert.equal(calls,1);assert.deepEqual(answer,{focus:'wander',thought:'A stroll.'});
});

test('HTTP heartbeat requests once; later browser ticks consume the intention through normal simulation',async()=>{
  const {makeHandler}=require('../lib/http');
  const s=fresh();s.agents=s.agents.slice(0,1);
  Object.assign(s.agents[0],{aiCooldown:0,inv:{food:4,wood:0,stone:0}});
  const store=memoryStore();store.corrupt(JSON.stringify(record(s)));
  let now=1600000,calls=0;
  const service=createWorldService({store,now:()=>now,logger:()=>{},env,
    aiRequest:async()=>{calls++;return {focus:'visit:well',thought:'I want to see the well.'};}});
  async function invoke(kind,req) {
    const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await makeHandler(kind,{service,env:{CRON_SECRET:'test-only'},logger:()=>{}})(req,res);
    assert.equal(res.code,200);return res.body;
  }
  await invoke('heartbeat',{method:'POST',headers:{authorization:'Bearer test-only'}});
  let saved=decode(await store.read());
  assert.equal(calls,1);assert.equal(saved.state.agents[0].aiFocus,'visit:well');
  assert.equal(saved.state.chronicle.filter(e=>e.type==='thought').length,0);
  const browser={method:'POST',headers:{origin:'https://civoria.test',host:'civoria.test'}};
  for(let i=0;i<12;i++){now+=1800000;await invoke('tick',browser);}
  saved=decode(await store.read());
  assert.equal(calls,1);assert.equal(saved.state.agents[0].aiFocus,null);
  assert.equal(saved.state.chronicle.filter(e=>e.type==='thought').length,1);
  assert.equal(saved.state.chronicle.find(e=>e.type==='thought').msg,'I want to see the well.');
});

test('malformed Anthropic responses still persist the heartbeat through the real client parser',async()=>{
  for(const response of [
    {ok:false},
    {ok:true,json:async()=>{throw new Error('invalid upstream JSON');}},
    {ok:true,json:async()=>({content:[{type:'text',text:'not JSON'}]})},
    {ok:true,json:async()=>({content:{bad:'shape'}})}
  ]) {
    const s=fresh();s.agents[0].aiPending=true;
    const f=serviceFixture(s,(a,state,opts)=>requestThought(a,state,{...opts,
      env:{...env,ANTHROPIC_API_KEY:'test-only'},fetchImpl:async()=>response}));
    await f.service.heartbeat();
    const saved=decode(await f.store.read());
    assert.equal(saved.revision,1);assert.equal(f.writes(),1);
    assert.equal(saved.state.agents[0].aiPending,false);assert.equal(saved.state.agents[0].aiFocus,null);
  }
});
