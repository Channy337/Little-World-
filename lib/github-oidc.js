'use strict';
const {createPublicKey,verify}=require('node:crypto');

const ISSUER='https://token.actions.githubusercontent.com';
const CONFIG_URL=ISSUER+'/.well-known/openid-configuration';
const AUDIENCE='civoria-heartbeat';
const REPOSITORY='Channy337/Little-World-';
const REPOSITORY_ID='1360527457';
const OWNER_ID='326168246';
const REF='refs/heads/main';
const WORKFLOW_REF='Channy337/Little-World-/.github/workflows/heartbeat.yml@refs/heads/main';
const ALLOWED_EVENTS=new Set(['schedule','workflow_dispatch','push']);

function decodeJson(part){
  try{return JSON.parse(Buffer.from(part,'base64url').toString('utf8'));}catch{return null;}
}

async function loadJwks(fetchImpl){
  const options={headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)};
  const configResponse=await fetchImpl(CONFIG_URL,options);
  if(!configResponse.ok) throw new Error('oidc_config_unavailable');
  const config=await configResponse.json();
  if(config.issuer!==ISSUER || typeof config.jwks_uri!=='string') throw new Error('oidc_config_invalid');
  const jwksUrl=new URL(config.jwks_uri);
  if(jwksUrl.origin!==ISSUER || jwksUrl.protocol!=='https:') throw new Error('oidc_config_invalid');
  const jwksResponse=await fetchImpl(jwksUrl.href,options);
  if(!jwksResponse.ok) throw new Error('oidc_keys_unavailable');
  const jwks=await jwksResponse.json();
  if(!jwks || !Array.isArray(jwks.keys)) throw new Error('oidc_keys_invalid');
  return jwks.keys;
}

function audienceMatches(aud){
  return aud===AUDIENCE || Array.isArray(aud) && aud.includes(AUDIENCE);
}

async function verifyGitHubOidc(token,{fetchImpl=fetch,now=Date.now}={}){
  try{
    if(typeof token!=='string' || token.length>12000) return false;
    const parts=token.split('.');
    if(parts.length!==3) return false;
    const header=decodeJson(parts[0]), claims=decodeJson(parts[1]);
    if(!header || !claims || header.alg!=='RS256' || typeof header.kid!=='string') return false;
    const keys=await loadJwks(fetchImpl);
    const jwk=keys.find(key=>key && key.kid===header.kid && key.kty==='RSA');
    if(!jwk) return false;
    const validSignature=verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url'));
    if(!validSignature) return false;
    const nowSeconds=Math.floor(now()/1000), skew=60;
    if(claims.iss!==ISSUER || !audienceMatches(claims.aud)) return false;
    if(!Number.isFinite(claims.exp) || claims.exp<nowSeconds-skew) return false;
    if(Number.isFinite(claims.nbf) && claims.nbf>nowSeconds+skew) return false;
    if(Number.isFinite(claims.iat) && claims.iat>nowSeconds+skew) return false;
    if(claims.repository!==REPOSITORY || String(claims.repository_id)!==REPOSITORY_ID || String(claims.repository_owner_id)!==OWNER_ID) return false;
    if(claims.ref!==REF || claims.workflow_ref!==WORKFLOW_REF || !ALLOWED_EVENTS.has(claims.event_name)) return false;
    return true;
  }catch{return false;}
}

module.exports={verifyGitHubOidc,ISSUER,AUDIENCE,REPOSITORY,REPOSITORY_ID,OWNER_ID,REF,WORKFLOW_REF};
