const test=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync,createSign}=require('node:crypto');
const {verifyGitHubOidc,ISSUER,AUDIENCE,REPOSITORY,REPOSITORY_ID,OWNER_ID,REF,WORKFLOW_REF}=require('../lib/github-oidc');

const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=publicKey.export({format:'jwk'});jwk.kid='test-key';jwk.alg='RS256';jwk.use='sig';
const nowMs=Date.UTC(2026,8,9,4,0,0), nowSeconds=Math.floor(nowMs/1000);

function token(overrides={}){
  const header=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:'test-key'})).toString('base64url');
  const claims={
    iss:ISSUER,aud:AUDIENCE,exp:nowSeconds+300,nbf:nowSeconds-30,iat:nowSeconds-30,
    repository:REPOSITORY,repository_id:REPOSITORY_ID,repository_owner_id:OWNER_ID,
    ref:REF,job_workflow_ref:WORKFLOW_REF,event_name:'schedule',...overrides
  };
  const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signingInput=header+'.'+payload;
  const signature=createSign('RSA-SHA256').update(signingInput).end().sign(privateKey).toString('base64url');
  return signingInput+'.'+signature;
}

function fetchMock(url){
  if(url===ISSUER+'/.well-known/openid-configuration') return Promise.resolve({ok:true,json:async()=>({issuer:ISSUER,jwks_uri:ISSUER+'/.well-known/jwks'})});
  if(url===ISSUER+'/.well-known/jwks') return Promise.resolve({ok:true,json:async()=>({keys:[jwk]})});
  throw new Error('unexpected_url');
}

test('valid GitHub scheduled workflow OIDC token is accepted',async()=>{
  assert.equal(await verifyGitHubOidc(token(),{fetchImpl:fetchMock,now:()=>nowMs}),true);
});

test('OIDC token must be for this repository, main ref, workflow and audience',async()=>{
  for(const overrides of [
    {repository:'other/repo'},
    {repository_id:'1'},
    {repository_owner_id:'2'},
    {ref:'refs/heads/other'},
    {job_workflow_ref:'other'},
    {aud:'other'},
    {event_name:'pull_request'},
    {exp:nowSeconds-120}
  ]) assert.equal(await verifyGitHubOidc(token(overrides),{fetchImpl:fetchMock,now:()=>nowMs}),false);
});

test('OIDC signature and discovery endpoints are validated',async()=>{
  const bad=token().slice(0,-2)+'aa';
  assert.equal(await verifyGitHubOidc(bad,{fetchImpl:fetchMock,now:()=>nowMs}),false);
  const hostile=async url=>url.endsWith('openid-configuration')?{ok:true,json:async()=>({issuer:ISSUER,jwks_uri:'https://evil.example/jwks'})}:{ok:false};
  assert.equal(await verifyGitHubOidc(token(),{fetchImpl:hostile,now:()=>nowMs}),false);
});
