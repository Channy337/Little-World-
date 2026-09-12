const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const engine=require('../lib/engine');
const {ensureMinds,applyReflections,summarizeMind}=require('../lib/mind');

test('AI thoughts are stored as bounded persistent villager history',()=>{
  const state=engine(null,31).snapshot();
  ensureMinds(state);
  const agent=state.agents[0];
  const queue=[{type:'priority',agentId:agent.id}];
  state.day=7;
  state.time=.64;
  applyReflections(state,queue,[{focus:'food',thought:'I should gather food before I get too tired.'}]);
  const summary=summarizeMind(agent,state);
  assert.equal(summary.thoughts.length,1);
  assert.equal(summary.thoughts[0].day,7);
  assert.equal(summary.thoughts[0].focus,'food');
  assert.match(summary.thoughts[0].text,/gather food/);

  for(let i=0;i<20;i++){
    state.day=8+i;
    state.time=.3;
    applyReflections(state,queue,[{focus:'work',thought:'Thought '+i}]);
  }
  assert.equal(agent.mind.thoughts.length,12);
  assert.equal(agent.mind.thoughts[0].text,'Thought 8');
  assert.equal(agent.mind.thoughts[11].text,'Thought 19');
});

test('villager click card is enhanced into the Jarvis life profile without changing the renderer',()=>{
  const js=fs.readFileSync('mind-feed.js','utf8');
  const css=fs.readFileSync('styles.css','utf8');
  assert.match(js,/Civorian life profile/);
  assert.match(js,/jarvis-profile/);
  assert.match(js,/data-tab/);
  assert.match(js,/Observer boundary/);
  assert.match(js,/Personally felt/);
  assert.match(js,/Observer analytics/);
  assert.match(js,/Personal observations/);
  assert.match(js,/Reproducible methods/);
  assert.match(js,/mind\.thoughts/);
  assert.match(css,/#agentCard\.villagerDrawer/);
  assert.match(css,/jarvis-profile/);
  assert.match(css,/--jarvis-cyan/);
  assert.match(css,/@media \(max-width:760px\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.doesNotMatch(js,/localStorage\.setItem/);
  assert.doesNotMatch(js,/fetch\(.*method:\s*['\"]POST['\"]/);
});

test('profile separates observer truth from personal knowledge labels',()=>{
  const js=fs.readFileSync('mind-feed.js','utf8');
  assert.match(js,/vp-badge observer/);
  assert.match(js,/vp-badge personal/);
  assert.match(js,/Visitor only/);
  assert.match(js,/never added to the Civorian/);
  assert.match(js,/never injected into AI prompts/);
});

test('profile handles missing legacy fields safely',()=>{
  const js=fs.readFileSync('mind-feed.js','utf8');
  assert.match(js,/agent\.body\|\|\{\}/);
  assert.match(js,/agent\.healthState\|\|\{\}/);
  assert.match(js,/agent\.life\|\|\{\}/);
  assert.match(js,/agent\.mind\|\|\{\}/);
  assert.match(js,/Array\.isArray\(mind\.observations\)/);
  assert.match(js,/Array\.isArray\(mind\.capabilities\)/);
});

test('build includes mind-feed and styles for profile assets',()=>{
  const build=fs.readFileSync('scripts/build.js','utf8');
  assert.match(build,/mind-feed\.js/);
  assert.match(build,/styles\.css/);
});
