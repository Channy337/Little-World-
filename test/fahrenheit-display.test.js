'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('V0.10.0 displays visitor weather in Fahrenheit without changing canonical Celsius',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const js=fs.readFileSync('fahrenheit-display.js','utf8');
  assert.match(html,/V0\.10\.0/);
  assert.match(html,/fahrenheit-display\.js/);
  assert.match(js,/temperatureC/);
  assert.match(js,/\*9\/5/);
  assert.match(js,/°F/);
  assert.doesNotMatch(js,/POST|localStorage|temperatureC\s*=/);
});
