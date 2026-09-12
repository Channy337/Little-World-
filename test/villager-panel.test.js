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

test('villager click card is enhanced into the life drawer without changing the renderer',()=>{
  const js=fs.readFileSync('mind-feed.js','utf8');
  const css=fs.readFileSync('styles.css','utf8');
  assert.match(js,/Recent thoughts/);
  assert.match(js,/Personality & mood/);
  assert.match(js,/Decisions/);
  assert.match(js,/Work & resources/);
  assert.match(js,/Relationships/);
  assert.match(js,/Life progress/);
  assert.match(js,/AI priority/);
  assert.match(js,/Action taken/);
  assert.match(js,/mind\.thoughts/);
  assert.match(css,/#agentCard\.villagerDrawer/);
  assert.match(css,/@media \(max-width:760px\)/);
});

test('live profile refresh preserves the reader scroll position',()=>{
  const js=fs.readFileSync('mind-feed.js','utf8');
  assert.match(js,/existingShell\.scrollTop/);
  assert.match(js,/data-villager-panel-id[^\n]+String\(agent\.id\)/);
  assert.match(js,/refreshedShell\.scrollTop=previousScroll/);
  assert.match(js,/feed\.scrollTop=previousScroll/);
});
