'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('V0.9.1 world news ticker is wired into the live page',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.match(html,/worldTicker/);
  assert.match(html,/World News/);
  assert.match(html,/V0\.9\.1/);
  assert.match(html,/world-ticker\.js/);
  assert.match(html,/world-ticker\.css/);
});

test('ticker only promotes recorded major milestones and promising experiments',()=>{
  const js=fs.readFileSync('world-ticker.js','utf8');
  assert.match(js,/MAJOR_TYPES/);
  assert.match(js,/birth/);
  assert.match(js,/market/);
  assert.match(js,/expansion/);
  assert.match(js,/status==='promising'/);
  assert.doesNotMatch(js,/tires/i);
});

test('ticker selects only the latest major headline for the top bar',()=>{
  const js=fs.readFileSync('world-ticker.js','utf8');
  assert.match(js,/selectLatestHeadline/);
  assert.match(js,/items\[0\]/);
  assert.doesNotMatch(js,/slice\(0,6\)/);
});

test('version badge is fixed to the lower right',()=>{
  const css=fs.readFileSync('world-ticker.css','utf8');
  assert.match(css,/\.versionBadge\{position:fixed;right:/);
  assert.match(css,/bottom:/);
});
