const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function harness(){
  let clock=0;
  const canonical={state:{agents:[{id:1,x:10,y:100,tx:70,ty:100,state:'moving',pending:{targetType:'tree',targetId:2}}]}};
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
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.indexOf('activity-clock.js')<html.indexOf('game.js'));
  const script=fs.readFileSync('activity-clock.js','utf8');
  assert.doesNotMatch(script,/localStorage|sessionStorage|\/api\/decide/);
});
