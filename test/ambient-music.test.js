'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('V0.12.1 ships visitor-controlled ambient instrumental music',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const js=fs.readFileSync('ambient-music.js','utf8');
  const css=fs.readFileSync('ambient-music.css','utf8');
  const build=fs.readFileSync('scripts/build.js','utf8');
  assert.match(html,/V0\.12\.1/);
  assert.match(html,/id="musicToggle"/);
  assert.match(html,/aria-pressed="false"/);
  assert.match(html,/id="musicVolume"/);
  assert.match(html,/ambient-music\.js/);
  assert.match(html,/ambient-music\.css/);
  assert.match(build,/ambient-music\.js/);
  assert.match(build,/ambient-music\.css/);
  assert.match(js,/AudioContext/);
  assert.match(js,/addEventListener\('click'/);
  assert.match(js,/tempo=68/);
  assert.match(js,/melody=/);
  assert.match(css,/position:fixed/);
});

test('music remains presentation-only and requires a visitor gesture',()=>{
  const js=fs.readFileSync('ambient-music.js','utf8');
  assert.doesNotMatch(js,/fetch\(|\/api\/|POST|localStorage|sessionStorage/);
  assert.match(js,/toggle\.addEventListener\('click'/);
  assert.doesNotMatch(js,/window\.addEventListener\(['"]load['"].*start|DOMContentLoaded.*start/);
});
