const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
test('build deploys every local script referenced by the homepage',()=>{
 execFileSync(process.execPath,['scripts/build.js']);
 const html=fs.readFileSync('public/index.html','utf8');
 for(const match of html.matchAll(/<script\s+src="([^"]+)"/g)){
  if(/^https?:/.test(match[1]))continue;
  assert.equal(fs.readFileSync('public/'+match[1],'utf8'),fs.readFileSync(match[1],'utf8'));
 }
});
