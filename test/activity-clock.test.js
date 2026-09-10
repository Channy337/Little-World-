const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function harness(){
  let clock=0;
  const canonical={state:{trees:[{id:2,x:70,y:100,wood:5}],well:{x:10,y:100},agents:[{id:1,x:10,y:100,tx:70,ty:100,state:'moving',pending:{targetType:'tree',targetId:2}}]}};
  const response={
    ok:true,status:200,statusText:'OK',headers:{},url:'/api/tick',redirected:false,type:'basic',
    json:async()=>JSON.parse(JSON.stringify(canonical))
  };
  const nativeFetch=async()=>response;
  const sandbox={
    window:{fetch:nativeFetch,performance:{now:()=>clock}},
    performance:{now:()=>clock},
    Date,Map,Set,Math,Number,Promise,console
  };
  sandbox.window.window=sandbox.window;
  vm.runInNewContext(fs.readFileSync('activity-clock.js','utf8'),sandbox,{filename:'activity-clock.js'});
  return {sandbox,canonical,response,setTime:ms=>{clock=ms;}};
}

test('activity clock moves a traveling villager at a visible real-time pace',async()=>{
  const h=harness();
  h.setTime(5000);
  const response=await h.sandbox.window.fetch('/api/tick',{method:'POST'});
  const data=await response.json();
  const a=data.state.agents[0];
  assert.ok(a.x>30&&a.x<32,'five real seconds should move about 21 world units');
  assert.equal(a.y,100);
  assert.equal(a.state,'moving');
  assert.equal(h.canonical.state.agents[0].x,10,'viewer animation must not mutate canonical server data');
});

test('activity clock turns visual arrival into a work animation without changing server state',async()=>{
  const h=harness();
  h.setTime(6000);
  let data=await (await h.sandbox.window.fetch('/api/tick')).json();
  assert.ok(data.state.agents[0].x>34);
  h.setTime(12000);
  data=await (await h.sandbox.window.fetch('/api/tick')).json();
  assert.ok(data.state.agents[0].x>60&&data.state.agents[0].x<61);
  h.setTime(18000);
  data=await (await h.sandbox.window.fetch('/api/tick')).json();
  assert.equal(data.state.agents[0].x,70);
  assert.equal(data.state.agents[0].state,'working');
  assert.equal(h.canonical.state.agents[0].state,'moving');
});

test('non-tick fetches pass through untouched',async()=>{
  const h=harness();
  const response=await h.sandbox.window.fetch('/api/state');
  assert.equal(response,h.response);
});

test('activity clock loads before the renderer and contains no persistence hooks',()=>{
  const globe=fs.readFileSync('globe-view.js','utf8');
  assert.match(globe,/loadScript\('activity-clock\.js'\)\.then\(\(\) => loadScript\('game\.js'\)\)/);
  const script=fs.readFileSync('activity-clock.js','utf8');
  assert.doesNotMatch(script,/localStorage|sessionStorage|\/api\/decide/);
});

test('stationary canonical worker repeats outbound, work and return for minutes without awarding resources',async()=>{
  const h=harness();const a=h.canonical.state.agents[0];a.state='working';a.pending=null;a.role='woodcutter';a.action={targetType:'tree',targetId:2};
  const before=JSON.stringify(h.canonical),phases=new Set();let returns=0,lastPhase;
  for(let t=5000;t<=240000;t+=5000){h.setTime(t);const d=await(await h.sandbox.window.fetch('/api/tick')).json();const v=d.state.agents[0];phases.add(v.visualRoutine);if(v.visualRoutine==='return'&&lastPhase!=='return')returns++;if(v.visualRoutine==='return')assert.equal(v.visualCarry,'tree');lastPhase=v.visualRoutine;}
  assert.deepEqual([...phases].sort(),['outbound','pause','return','work']);assert.ok(returns>=3);assert.equal(JSON.stringify(h.canonical),before);
});

test('long trips do not repeatedly reset to the slow canonical position',async()=>{
  const h=harness();h.canonical.state.trees[0].x=350;h.canonical.state.agents[0].tx=350;let reached=false;
  for(let t=5000;t<=100000;t+=5000){h.setTime(t);const d=await(await h.sandbox.window.fetch('/api/tick')).json();if(d.state.agents[0].x===350)reached=true;}
  assert.ok(reached);
});

test('rest and removed resource targets cancel work routines',async()=>{
  const h=harness();h.setTime(5000);await(await h.sandbox.window.fetch('/api/tick')).json();
  h.canonical.state.agents[0].state='resting';h.setTime(10000);let d=await(await h.sandbox.window.fetch('/api/tick')).json();assert.equal(d.state.agents[0].state,'resting');assert.equal(d.state.agents[0].visualCarry,undefined);
  h.canonical.state.agents[0].state='working';h.canonical.state.trees=[];h.setTime(15000);d=await(await h.sandbox.window.fetch('/api/tick')).json();assert.equal(d.state.agents[0].visualRoutine,undefined);
});
