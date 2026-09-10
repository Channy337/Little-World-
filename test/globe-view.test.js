const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

const globe=fs.readFileSync('globe-view.js','utf8');
const fallback=fs.readFileSync('globe-fallback.js','utf8');
const html=fs.readFileSync('index.html','utf8');

test('globe viewer parses and is shipped as the homepage entry point',()=>{
  execFileSync(process.execPath,['--check','globe-view.js']);
  execFileSync(process.execPath,['--check','globe-fallback.js']);
  assert.match(html,/id="world-map"/);
  assert.match(html,/id="globeCanvas"/);
  assert.ok(html.indexOf('globe-fallback.js')<html.indexOf('globe-view.js'));
  assert.match(html,/<script src="globe-view\.js" type="module"><\/script>/);
});

test('globe shell stays presentation-only and preserves the activity-clock settlement path',()=>{
  assert.doesNotMatch(globe,/\/api\//);
  assert.doesNotMatch(fallback,/\/api\//);
  assert.doesNotMatch(globe,/UPSTASH|KV_REST|localStorage|heartbeat|world\.js|engine\.js/);
  assert.doesNotMatch(fallback,/UPSTASH|KV_REST|localStorage|heartbeat|world\.js|engine\.js/);
  assert.match(globe,/loadScript\('activity-clock\.js'\)\.then\(\(\) => loadScript\('game\.js'\)\)/);
});

test('globe includes desktop and mobile navigation plus reduced-motion support',()=>{
  assert.match(globe,/addEventListener\('wheel'/);
  assert.match(globe,/pointerdown/);
  assert.match(globe,/pointers\.size === 2/);
  assert.match(globe,/prefers-reduced-motion/);
  assert.match(globe,/deviceMemory|hardwareConcurrency/);
  assert.match(fallback,/pointerdown/);
  assert.match(fallback,/pointers\.size===2/);
  assert.match(fallback,/prefers-reduced-motion/);
  assert.match(fallback,/MutationObserver/);
});
