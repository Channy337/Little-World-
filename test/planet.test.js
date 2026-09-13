'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {cell,startingRegion,ensurePlanet,atlasSample}=require('../lib/planet');

test('fixed planet seed produces the same physical world every time',()=>{
  assert.deepEqual(atlasSample(42),atlasSample(42));
  assert.deepEqual(cell(42,18,20),cell(42,18,20));
  assert.notDeepEqual(atlasSample(42),atlasSample(43));
});

test('starting region is a habitable land region selected before exploration',()=>{
  const start=startingRegion(42);
  assert.equal(start.land,true);
  assert.ok(start.temperatureMeanC>-10&&start.temperatureMeanC<30);
  assert.ok(start.precipitationMm>=180);
  assert.ok(start.elevationM>=0);
});

test('biome and climate are caused by latitude elevation and moisture inputs',()=>{
  const mountain=cell(42,18,19),lower=cell(42,31,23);
  assert.ok(mountain.elevationM>lower.elevationM);
  assert.ok(mountain.temperatureMeanC<=lower.temperatureMeanC);
  assert.ok(typeof lower.soil==='string'&&lower.soil.length>0);
  assert.ok(Number.isFinite(lower.groundwater)&&Number.isFinite(lower.drainage));
});

test('planet truth is persisted with a continent overview and local terrain',()=>{
  const state={day:1,rng:42};
  const p=ensurePlanet(state,42);
  assert.equal(p.rotationHours,24);
  assert.equal(p.gravityMps2,9.81);
  assert.equal(p.atmosphere.oxygenFraction,.2095);
  assert.equal(p.overview.cells.length,p.overview.cols*p.overview.rows);
  assert.equal(state.terrain.cells.length,state.terrain.cols*state.terrain.rows);
  const copy=JSON.parse(JSON.stringify(state));
  ensurePlanet(copy,999);
  assert.equal(copy.planet.seed,42);
  assert.deepEqual(copy.planet.startingRegion,state.planet.startingRegion);
});
