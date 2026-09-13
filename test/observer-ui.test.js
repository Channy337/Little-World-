'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('V0.11 ships the planet observer and deep life profile assets',()=>{
  const html=fs.readFileSync('index.html','utf8'),build=fs.readFileSync('scripts/build.js','utf8');
  for(const asset of ['jarvis-profile.js','planet-view.js','observer-ui.css']){
    assert.match(html,new RegExp(asset.replace('.','\\.')));
    assert.match(build,new RegExp(asset.replace('.','\\.')));
  }
  assert.match(html,/Living Planet Observer/);
  assert.match(html,/One real hour equals one Civoria month/);
});

test('observer interfaces stay read-only and separate personal knowledge from observer analysis',()=>{
  const profile=fs.readFileSync('jarvis-profile.js','utf8'),planet=fs.readFileSync('planet-view.js','utf8');
  assert.match(profile,/Civorian knowledge/);
  assert.match(profile,/Observer analysis/);
  assert.match(profile,/Visitor-only analysis/);
  assert.match(profile,/Personally observed/);
  assert.match(profile,/\/api\/state/);
  assert.match(planet,/Observer map/);
  assert.match(planet,/Civorians do not receive this map/);
  assert.doesNotMatch(profile+planet,/method\s*:\s*['"]POST|localStorage|\/api\/tick/);
});

test('profile is resilient to missing optional legacy fields and supports reduced motion',()=>{
  const profile=fs.readFileSync('jarvis-profile.js','utf8'),css=fs.readFileSync('observer-ui.css','utf8');
  assert.match(profile,/agent\.mind\|\|\{\}/);
  assert.match(profile,/agent\.body\|\|\{\}/);
  assert.match(profile,/agent\.healthState\|\|\{\}/);
  assert.match(profile,/agent\.seeds\|\|\[\]/);
  assert.match(css,/prefers-reduced-motion/);
});
