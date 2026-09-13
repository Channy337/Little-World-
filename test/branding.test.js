'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const publicBrandFiles=['index.html','chronicle.html','discoveries.html','game.js'];

test('Civoria is the only public project name',()=>{
  for(const file of publicBrandFiles){
    const text=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(text,/Clivoria|CLIVORIA|A Little World|clivoria-day/,
      `${file} contains a legacy public project name`);
  }
  const home=fs.readFileSync('index.html','utf8');
  assert.match(home,/<title>Civoria \| A living shared world<\/title>/);
  assert.match(home,/>CIVORIA</);
  assert.match(home,/>Civoria<span>/);
  assert.match(home,/About Civoria/);
  assert.match(home,/Share Civoria/);
  assert.match(home,/V0\.12\.2/);
});

test('technical repository and persistence identifiers are not renamed by branding cleanup',()=>{
  const oidc=fs.readFileSync('lib/github-oidc.js','utf8');
  const store=fs.readFileSync('lib/store.js','utf8');
  assert.match(oidc,/Channy337\/Little-World-/);
  assert.match(store,/little-world/);
});
