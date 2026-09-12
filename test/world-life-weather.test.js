'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {generateDay}=require('../lib/weather');

function sequence(values){let i=0;return function(){return values[Math.min(i++,values.length-1)];};}

test('V0.9 ambient wildlife and weather layer is shipped after the world renderer',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const build=fs.readFileSync('scripts/build.js','utf8');
  const viewer=fs.readFileSync('world-life-weather.js','utf8');
  assert.match(html,/V0\.9\.0/);
  assert.ok(html.indexOf('game.js')<html.indexOf('world-life-weather.js'));
  assert.match(build,/world-life-weather\.js/);
  assert.match(viewer,/rabbit\(/);
  assert.match(viewer,/deer\(/);
  assert.match(viewer,/fox\(/);
  assert.match(viewer,/birds\(/);
  assert.match(viewer,/clouds\(/);
  assert.match(viewer,/precip\(/);
  assert.match(viewer,/\/api\/state/);
});

test('winter severe storm can become a blizzard',()=>{
  const random=sequence([0.01,0.5,0.5,0,0.8,0.8,0.8]);
  const w=generateDay(random,271,{pondLevel:.8,soilMoisture:.5});
  assert.equal(w.storm,true);
  assert.equal(w.temperatureC,2);
  assert.equal(w.hazard,'blizzard');
});

test('extreme rainfall near a full pond can become a flood',()=>{
  const random=sequence([0.01,0.5,0.5,0.5,0.8,0.5,0.9]);
  const w=generateDay(random,1,{pondLevel:.92,soilMoisture:.6});
  assert.equal(w.storm,true);
  assert.ok(w.precipitationMm>=40);
  assert.equal(w.hazard,'flood');
});
