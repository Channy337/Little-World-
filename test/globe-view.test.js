const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const gpu=fs.readFileSync('globe-webgl.js','utf8');
const fallback=fs.readFileSync('globe-fallback.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const build=fs.readFileSync('scripts/build.js','utf8');

test('GPU globe is the homepage world view',()=>{
  assert.match(html,/id="world-map"/);
  assert.match(html,/id="globeCanvas"/);
  assert.match(html,/type="module" src="globe-webgl\.js"/);
  assert.doesNotMatch(html,/<script src="globe-fallback\.js"><\/script>/);
  assert.match(gpu,/new THREE\.WebGLRenderer/);
  assert.match(gpu,/new THREE\.SphereGeometry/);
});

test('activity clock loads before GPU globe and authoritative tick stays unchanged',()=>{
  const activity=html.indexOf('<script src="activity-clock.js"></script>');
  const globeScript=html.indexOf('<script type="module" src="globe-webgl.js"></script>');
  assert.ok(activity>=0&&globeScript>activity);
  assert.match(gpu,/fetch\('\/api\/tick'/);
  assert.doesNotMatch(gpu,/UPSTASH|KV_REST|localStorage|heartbeat|engine\.js/);
});

test('GPU globe keeps villagers and buildings on the sphere at every zoom',()=>{
  assert.match(gpu,/state\.agents/);
  assert.match(gpu,/state\.buildings/);
  assert.match(gpu,/localToGeo/);
  assert.match(gpu,/villagerMeshes/);
  assert.match(gpu,/focusCivoria/);
  assert.doesNotMatch(gpu,/settlement-mode|game\.js/);
});

test('mobile interaction is GPU transformed and Canvas remains fallback only',()=>{
  assert.match(gpu,/powerPreference:'high-performance'/);
  assert.match(gpu,/addEventListener\('wheel'/);
  assert.match(gpu,/pointerdown/);
  assert.match(gpu,/pointers\.size===2/);
  assert.match(gpu,/fallbackToCanvas/);
  assert.match(fallback,/getContext\('2d'\)/);
  assert.match(build,/three\.module\.js/);
});
