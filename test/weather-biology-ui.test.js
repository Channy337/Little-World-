'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('weather and body consequences are visible without making the browser authoritative',()=>{
  const html=fs.readFileSync('index.html','utf8'),game=fs.readFileSync('game.js','utf8'),panel=fs.readFileSync('mind-feed.js','utf8');
  assert.match(html,/id="weatherVal"/);assert.match(game,/function drawWeather/);assert.match(game,/precipitationMm/);assert.match(game,/body\.lastSymptoms/);
  assert.match(panel,/Body condition · visitor view/);assert.match(panel,/Hydration reserve/);
  assert.match(panel,/Sleep debt/);assert.match(game,/clockTimeLabel/);assert.match(game,/Alertness/);assert.match(html,/V0\.8\.0/);
  assert.doesNotMatch(game,/localStorage|api\/state[^\n]*POST/);
});
