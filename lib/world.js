'use strict';
const {randomInt}=require('node:crypto');
const createEngine=require('./engine');
const {createStore}=require('./store');
const STEP_MS=100, MIN_TICK_MS=5000, MAX_CATCH_UP_MS=120000;
const ENGINE_DAY_SECONDS=55, REAL_DAY_MS=86400000, ENGINE_STEP_SECONDS=0.1;
// Preserve the original village behavior, but map its internal 55-second day to 24 real hours.
const SIMULATION_RATE=ENGINE_DAY_SECONDS/(REAL_DAY_MS/1000);

function decode(raw) {
  const record=JSON.parse(raw);
  const s=record?.state;
  if(record?.lastHeartbeatAt!==undefined && (!Number.isSafeInteger(record.lastHeartbeatAt) || record.lastHeartbeatAt<0)) throw new Error('world_invalid');
  if(record?.schemaVersion!==1 || !Number.isSafeInteger(record.revision) || record.revision<0 ||
    !Number.isSafeInteger(record.lastTickAt) || record.lastTickAt<0 || !s ||
    !Number.isSafeInteger(s.day) || !Number.isFinite(s.time) || s.time<0 || s.time>=1 ||
    !Number.isInteger(s.rng) || !s.pond || !s.well ||
    !['agents','trees','rocks','bushes','farms','buildings','groundTiles','log','chronicle'].every(k=>Array.isArray(s[k]))) {
    throw new Error('world_invalid');
  }
  const finite=v=>typeof v==='number'?Number.isFinite(v):!v||typeof v!=='object'||Object.values(v).every(finite);
  const positioned=list=>list.every(item=>item && Number.isSafeInteger(item.id) && Number.isFinite(item.x) && Number.isFinite(item.y));
  if(!finite(s) || s.agents.length>34 || s.log.length>40 || s.chronicle.length>400 ||
    !Number.isSafeInteger(s.nextId) || !Number.isFinite(s.birthCooldownTimer) ||
    !['agents','trees','rocks','bushes','farms','buildings'].every(k=>positioned(s[k])) ||
    !s.agents.every(a=>typeof a.name==='string' && typeof a.trait==='string' && a.inv &&
      ['hunger','energy','social','age','lifespan'].every(k=>Number.isFinite(a[k]))) ||
    !s.log.concat(s.chronicle).every(e=>e && typeof e.msg==='string' && /^[a-z]+$/.test(e.type)) ||
    s.groundTiles.length!==19 || !s.groundTiles.every(row=>Array.isArray(row)&&row.length===30&&row.every(n=>[0,1,2].includes(n))) ||
    s.market && !s.buildings.some(b=>b.id===s.market.id && b.type==='market' && b.stock)) throw new Error('world_invalid');
  return record;
}

function advanceEngine(engine,realMs) {
  let remaining=(realMs/1000)*SIMULATION_RATE;
  const total=remaining;
  while(remaining>1e-12) {
    const dt=Math.min(ENGINE_STEP_SECONDS,remaining);
    engine.step(dt);
    remaining-=dt;
  }
  return total;
}

function createWorldService({store,now=Date.now,seed=()=>randomInt(0,4294967296),logger=console.info}={}) {
  const storage=()=>store || (store=createStore());
  async function read() {
    let raw=await storage().read();
    if(raw===null) {
      const candidate={schemaVersion:1,revision:0,lastTickAt:now(),state:createEngine(null,seed()).snapshot()};
      raw=await storage().initialize(JSON.stringify(candidate));
      if(raw==='WORLD_MISSING') throw new Error('world_missing_restore_required');
      logger(JSON.stringify({event:'world_initialization_checked',revision:decode(raw).revision}));
    }
    return {raw,record:decode(raw)};
  }
  async function tick(heartbeat=false,attempt=0) {
    const {raw,record}=await read();
    const timestamp=now();
    const elapsed=Math.max(0,timestamp-record.lastTickAt);
    if(elapsed<MIN_TICK_MS && !heartbeat) return {...record,catchUpSeconds:0};
    const wholeMs=elapsed<MIN_TICK_MS?0:Math.floor(elapsed/STEP_MS)*STEP_MS;
    const simulatedMs=Math.min(wholeMs,MAX_CATCH_UP_MS);
    const skippedMs=wholeMs-simulatedMs;
    const engine=createEngine(record.state);
    const worldSecondsAdvanced=advanceEngine(engine,simulatedMs);
    const state=engine.snapshot();
    const next={...record,revision:record.revision+1,lastTickAt:record.lastTickAt+wholeMs,state};
    if(heartbeat) next.lastHeartbeatAt=Math.max(record.lastHeartbeatAt||0,timestamp);
    const nextRaw=JSON.stringify(next);
    decode(nextRaw); // Refuse to persist an invalid simulation result.
    if(await storage().compareAndSwap(raw,nextRaw)!==1) {
      logger(JSON.stringify({event:'world_tick_conflict',revision:record.revision}));
      // A successful heartbeat response must mean its timestamp was persisted.
      if(heartbeat){if(attempt<2)return tick(true,attempt+1);throw new Error('world_busy');}
      return {...(await read()).record,catchUpSeconds:0};
    }
    logger(JSON.stringify({event:heartbeat?'world_heartbeat':'world_tick',revision:next.revision,simulatedMs,skippedMs,worldSecondsAdvanced,population:state.agents.length,day:state.day}));
    return {...next,catchUpSeconds:simulatedMs/1000};
  }
  return {state:async()=> (await read()).record,tick:()=>tick(),heartbeat:async()=>{
    const record=await tick(true);
    return {revision:record.revision,lastHeartbeatAt:record.lastHeartbeatAt,lastTickAt:record.lastTickAt,day:record.state.day,catchUpSeconds:record.catchUpSeconds};
  }};
}
module.exports={createWorldService,decode,advanceEngine,STEP_MS,MIN_TICK_MS,MAX_CATCH_UP_MS,ENGINE_DAY_SECONDS,REAL_DAY_MS,SIMULATION_RATE};
