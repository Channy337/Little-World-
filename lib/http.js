'use strict';
const {randomUUID,timingSafeEqual}=require('node:crypto');
const {createWorldService}=require('./world');

function scheduled(req,env) {
  const expected=env.CRON_SECRET && 'Bearer '+env.CRON_SECRET;
  const actual=req.headers.authorization;
  return !!expected && typeof actual==='string' && Buffer.byteLength(actual)===Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(actual),Buffer.from(expected));
}
function makeHandler(kind,{service=createWorldService(),env=process.env,logger=console.error}={}) {
  return async function handler(req,res) {
    const requestId=randomUUID();
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Request-Id',requestId);
    if(kind==='state' && req.method!=='GET' || ['tick','heartbeat'].includes(kind) && !['GET','POST'].includes(req.method)) {
      res.setHeader('Allow',kind==='state'?'GET':'POST, GET');
      return res.status(405).json({error:'method_not_allowed',requestId});
    }
    if(kind==='heartbeat') {
      if(!scheduled(req,env)) return res.status(401).json({error:'unauthorized',requestId});
      if(req.body && (typeof req.body!=='object' || Object.keys(req.body).length)) return res.status(400).json({error:'body_not_allowed',requestId});
    }
    if(kind==='tick' && req.method==='GET' && !scheduled(req,env)) return res.status(401).json({error:'unauthorized',requestId});
    if(kind==='tick' && req.method==='POST') {
      const origin=req.headers.origin;
      let crossOrigin=false;
      if(origin){try{crossOrigin=new URL(origin).host!==req.headers.host;}catch{crossOrigin=true;}}
      if(crossOrigin || req.headers['sec-fetch-site']==='cross-site') return res.status(403).json({error:'cross_origin',requestId});
      // Client state, clock, speed, and reset commands are never accepted.
      if(req.body && (typeof req.body!=='object' || Object.keys(req.body).length)) return res.status(400).json({error:'body_not_allowed',requestId});
    }
    try {return res.status(200).json(await service[kind]());}
    catch(error) {
      const known=['storage_not_configured','storage_unavailable','storage_command_failed','world_invalid','world_missing_restore_required','preview_branch_missing','environment_missing','world_busy'];
      logger(JSON.stringify({event:'world_request_failed',requestId,kind,code:known.includes(error.message)?error.message:'internal_error'}));
      res.setHeader('Retry-After','5');
      return res.status(503).json({error:'world_unavailable',requestId});
    }
  };
}
module.exports={makeHandler};
