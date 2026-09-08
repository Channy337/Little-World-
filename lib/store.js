'use strict';
const { createHash } = require('node:crypto');

// EVAL reads on the primary; all world writes use atomic compare-and-swap.
const READ = `return redis.call('GET', KEYS[1])`;
const INIT = `
local existing = redis.call('GET', KEYS[1])
if existing then return existing end
if redis.call('EXISTS', KEYS[2]) == 1 then return 'WORLD_MISSING' end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], '1')
return ARGV[1]`;
const CAS = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1`;

function namespace(env) {
  if(env.VERCEL_ENV === 'production') return 'little-world:{production}:v1';
  if(env.VERCEL_ENV === 'preview') {
    if(!env.VERCEL_GIT_COMMIT_REF) throw new Error('preview_branch_missing');
    const branch = createHash('sha256').update(env.VERCEL_GIT_COMMIT_REF).digest('hex').slice(0,20);
    return `little-world:{preview-${branch}}:v1`;
  }
  if(env.VERCEL) throw new Error('environment_missing');
  return 'little-world:{development}:v1';
}

function createStore(env=process.env, fetchImpl=fetch) {
  const url=env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token=env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if(!url || !token || new URL(url).protocol!=='https:') throw new Error('storage_not_configured');
  const key=namespace(env);
  async function command(args) {
    // Neither upstream error bodies nor request credentials are logged/returned.
    const response=await fetchImpl(url,{
      method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify(args),signal:AbortSignal.timeout(4000)
    });
    if(!response.ok) throw new Error('storage_unavailable');
    const data=await response.json();
    if(data.error || !Object.hasOwn(data,'result')) throw new Error('storage_command_failed');
    return data.result;
  }
  return {
    read:()=>command(['EVAL',READ,1,key]),
    initialize:raw=>command(['EVAL',INIT,2,key,key+':initialized',raw]),
    compareAndSwap:(before,after)=>command(['EVAL',CAS,1,key,before,after])
  };
}
module.exports={createStore,namespace,READ,INIT,CAS};
