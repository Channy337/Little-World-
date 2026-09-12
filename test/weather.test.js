'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {seasonForDay,generateDay,ensureWeather,advanceWeather,waterLossPerDay,growthMultiplier}=require('../lib/weather');

function rng(seed){return function(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}}

test('weather is deterministic, seasonal, and persisted as canonical state',()=>{
  const a=generateDay(rng(12),1),b=generateDay(rng(12),1);assert.deepEqual(a,b);
  assert.equal(seasonForDay(1),'spring');assert.equal(seasonForDay(91),'summer');assert.equal(seasonForDay(181),'autumn');assert.equal(seasonForDay(271),'winter');
  const state={day:1};ensureWeather(state,rng(9));const first=state.weather;state.day=2;advanceWeather(state,rng(10));assert.equal(state.weather.day,2);assert.deepEqual(state.weatherHistory,[first]);
});

test('heat, humidity, and activity increase water loss',()=>{
  const mild={temperatureC:18,humidity:45},hot={temperatureC:37,humidity:85};
  assert.ok(waterLossPerDay(hot,true)>waterLossPerDay(mild,false));
});

test('soil moisture changes biological resource growth',()=>{
  assert.ok(growthMultiplier({soilMoisture:.9})>growthMultiplier({soilMoisture:.1}));
});
