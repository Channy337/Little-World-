'use strict';
const fs=require('node:fs');
const test=require('node:test');
const assert=require('node:assert/strict');

test('mind feed is wired into the public viewer',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const js=fs.readFileSync('mind-feed.js','utf8');
  const build=fs.readFileSync('scripts/build.js','utf8');
  assert.match(html,/id="mindFeed"/);
  assert.match(html,/id="mindStatus"/);
  assert.match(html,/activity-clock\.js[\s\S]*mind-feed\.js[\s\S]*game\.js/);
  assert.match(js,/aiThought/);
  assert.match(js,/response\.clone\(\)\.json\(\)/);
  assert.match(build,/mind-feed\.js/);
});

test('mind visibility layer stays read-only',()=>{
  const js=fs.readFileSync('mind-feed.js','utf8');
  assert.doesNotMatch(js,/fetch\(['"]\/api\/(?:state|tick|heartbeat)/);
  assert.doesNotMatch(js,/method\s*:\s*['"]POST['"]/);
});
