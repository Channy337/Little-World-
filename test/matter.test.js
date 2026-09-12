'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const matter=require('../lib/matter');

test('the hidden world model contains the full periodic table',()=>{
  assert.equal(Object.keys(matter.ELEMENTS).length,118);
  assert.equal(matter.ELEMENTS.H.atomicNumber,1);
  assert.equal(matter.ELEMENTS.C.atomicNumber,6);
  assert.equal(matter.ELEMENTS.O.atomicNumber,8);
  assert.equal(matter.ELEMENTS.Og.atomicNumber,118);
});

test('ordinary senses do not leak molecular truth',()=>{
  const seen=matter.observation('water',{level:matter.toolLevel(null),temperature:18});
  assert.equal(seen.appearance,'clear liquid');
  assert.equal(seen.phase,'liquid');
  assert.equal(seen.formula,undefined);
  assert.equal(seen.composition,undefined);
});

test('instrument resolution gates what can actually be observed',()=>{
  const measure={capabilities:['measure'],resolution:1};
  const analyzer={capabilities:['analyze-composition'],resolution:1e-10};
  assert.equal(matter.observation('water',{level:matter.toolLevel(measure),mass:2}).formula,undefined);
  assert.equal(matter.observation('water',{level:matter.toolLevel(analyzer)}).formula,'H2O');
  assert.deepEqual(matter.observation('water',{level:matter.toolLevel(analyzer)}).composition,{H:2,O:1});
});

test('matter changes phase and transformations can be checked for atom conservation',()=>{
  assert.equal(matter.phaseAt('water',-1),'solid');
  assert.equal(matter.phaseAt('water',20),'liquid');
  assert.equal(matter.phaseAt('water',101),'gas');
  assert.equal(matter.conservesAtoms([{substance:'water',amount:1}],[{substance:'water',amount:1}]),true);
  assert.equal(matter.conservesAtoms([{substance:'water',amount:1}],[{substance:'oxygen',amount:1}]),false);
});
