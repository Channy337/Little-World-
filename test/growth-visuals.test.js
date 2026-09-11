const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const growth=fs.readFileSync('growth-visuals.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const activity=fs.readFileSync('activity-clock.js','utf8');
const build=fs.readFileSync('scripts/build.js','utf8');

test('growth visuals are wired after activity clock and before renderer',()=>{
  assert.match(index,/growth-visuals\.js/);
  assert.ok(index.indexOf('activity-clock.js')<index.indexOf('growth-visuals.js'));
  assert.ok(index.indexOf('growth-visuals.js')<index.indexOf('game.js'));
  assert.match(build,/growth-visuals\.js/);
});

test('construction visuals respond to canonical buildsite activity and new buildings',()=>{
  assert.match(growth,/targetType!==['"]buildsite['"]/);
  assert.match(growth,/BUILDING/);
  assert.match(growth,/bornAt/);
  assert.match(growth,/state\.buildings/);
});

test('settlement expansion stays presentation only',()=>{
  assert.match(growth,/growthAmount/);
  assert.match(growth,/baseCanvas\.style\.transform/);
  assert.doesNotMatch(growth,/localStorage|sessionStorage|api\/heartbeat/);
});

test('activity clock routes builders to build sites',()=>{
  assert.match(activity,/job\.targetType===['"]buildsite['"]/);
  assert.match(activity,/kind:['"]buildsite['"]/);
});
