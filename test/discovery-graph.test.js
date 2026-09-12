'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('the read-only discovery map is linked and deployed',()=>{
  const home=fs.readFileSync('index.html','utf8'),page=fs.readFileSync('discoveries.html','utf8'),js=fs.readFileSync('discovery-graph.js','utf8'),build=fs.readFileSync('scripts/build.js','utf8');
  assert.match(home,/href="discoveries\.html"/);assert.match(page,/Discovery Map/);assert.match(page,/discovery-graph\.js/);assert.match(build,/discoveries\.html/);
  assert.match(js,/fetch\('\/api\/state'/);assert.doesNotMatch(js,/api\/tick|method\s*:\s*['"]POST/);
  assert.match(page,/active/);assert.match(page,/recorded/);assert.match(page,/lost/);
});
