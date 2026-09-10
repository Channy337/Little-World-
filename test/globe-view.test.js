const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

const globe=fs.readFileSync('globe-fallback.js','utf8');
const html=fs.readFileSync('index.html','utf8');

test('living globe parses and remains the homepage world view',()=>{
  execFileSync(process.execPath,['--check','globe-fallback.js']);
  assert.match(html,/id="world-map"/);
  assert.match(html,/id="globeCanvas"/);
  assert.match(html,/Zoom closer to see villagers/);
  assert.doesNotMatch(globe,/settlement-mode|loadSettlement|game\.js/);
});

test('activity clock loads before globe so visual movement stays viewer-only',()=>{
  const activity=html.indexOf('<script src="activity-clock.js"></script>');
  const globeScript=html.indexOf('<script src="globe-fallback.js"></script>');
  assert.ok(activity>=0&&globeScript>activity);
  assert.match(globe,/fetch\('\/api\/tick'/);
  assert.doesNotMatch(globe,/UPSTASH|KV_REST|localStorage|heartbeat|engine\.js/);
});

test('globe renders authoritative world objects and villagers on its surface',()=>{
  assert.match(globe,/state\.agents/);
  assert.match(globe,/state\.buildings/);
  assert.match(globe,/state\.farms/);
  assert.match(globe,/localToGeo/);
  assert.match(globe,/drawAgent/);
  assert.match(globe,/Focus Civoria|focusCivoria/);
});

test('mobile and desktop navigation stay supported',()=>{
  assert.match(globe,/addEventListener\('wheel'/);
  assert.match(globe,/pointerdown/);
  assert.match(globe,/pointers\.size===2/);
  assert.match(globe,/prefers-reduced-motion/);
});