const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

const globe=fs.readFileSync('globe-fallback.js','utf8');
const html=fs.readFileSync('index.html','utf8');

test('self-contained globe viewer parses and is the homepage entry point',()=>{
  execFileSync(process.execPath,['--check','globe-fallback.js']);
  assert.match(html,/id="world-map"/);
  assert.match(html,/id="globeCanvas"/);
  assert.match(html,/<script src="globe-fallback\.js"><\/script>/);
  assert.doesNotMatch(html,/three\.module|cdn\.jsdelivr|globe-view\.js/);
});

test('globe stays presentation-only and preserves the activity-clock settlement path',()=>{
  assert.doesNotMatch(globe,/\/api\//);
  assert.doesNotMatch(globe,/UPSTASH|KV_REST|localStorage|heartbeat|world\.js|engine\.js/);
  assert.match(globe,/loadScript\('activity-clock\.js'\)\.then\(\(\)=>loadScript\('game\.js'\)\)/);
});

test('globe includes mobile and desktop navigation without external 3D dependencies',()=>{
  assert.match(globe,/addEventListener\('wheel'/);
  assert.match(globe,/pointerdown/);
  assert.match(globe,/pointers\.size===2/);
  assert.match(globe,/prefers-reduced-motion/);
  assert.doesNotMatch(globe,/import\(|THREE|WebGLRenderer|cdn\.jsdelivr/);
});
