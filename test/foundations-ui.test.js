'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('foundational consequences are visible while canonical state remains server-owned',()=>{
  const html=fs.readFileSync('index.html','utf8'),game=fs.readFileSync('game.js','utf8'),panel=fs.readFileSync('mind-feed.js','utf8');
  assert.match(html,/V0\.8\.0/);assert.match(html,/No invisible map/);assert.match(html,/physical prototypes/i);
  assert.match(game,/function drawAnimal/);assert.match(game,/function drawDeposit/);assert.match(game,/made\.form/);
  assert.match(panel,/Life stage/);assert.match(panel,/Inherited appearance/);assert.match(panel,/Communication/);assert.match(panel,/Physical prototypes/);assert.match(panel,/Blood oxygen/);assert.match(panel,/Infection pressure/);
  assert.doesNotMatch(game,/localStorage|api\/state[^\n]*POST/);
});
