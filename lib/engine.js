'use strict';
const {lookup:lookupAffordance,canPay,pay,produce,signature}=require('./affordances');
const {observation:matterObservation}=require('./matter');
const {ensureWeather,advanceWeather,sensoryDescription,waterLossPerDay,growthMultiplier}=require('./weather');
const {createBody,ensureBody,drink:drinkBody,eat:eatBody,advanceBody,advanceSleep,sleepNeed,functionalCapacity}=require('./biology');
const {ensurePerception,scan:scanEnvironment,nearestKnown,markObserved,sharePlace}=require('./perception');
const {evaluatePrototype}=require('./mechanics');
const {ensureEcology,forage:forageFood,consume:consumeFood,canConsume,recordFoodOutcome,drinkRisk,advance:advanceEcology}=require('./ecology');
const {ensureHealth,wound,inhaleSmoke,exposePathogens,advanceHealth}=require('./health');
const {ensureLife,sleepRequirementHours,tryConceive,advancePregnancies,careForDependent}=require('./lifecycle');
const {ensureCommunication,ensureCulture,interact:communicate,refreshInstitutions}=require('./communication');
const {makeFounderHeritage,inheritHeritage,ensureHeritage,describe:describeAppearance}=require('./heritage');
// Original village rules extracted from game.js at b878762. Each request owns its state.
module.exports = function createEngine(saved, seed = 1) {
  let rng = saved ? saved.rng : seed >>> 0;
  function random() { rng = (Math.imul(1664525, rng) + 1013904223) >>> 0; return rng / 4294967296; }
  var TILE = 16;
  var CFG = {
    W: 480, H: 304,
    maxPop: 34, initialPop: 9,
    dayLength: 55,
    hungerRate: 1.55,
    energyDecayIdle: 0.55, energyDecayWork: 1.3,
    socialDecay: 0.5,
    restHomeRate: 16, restFieldRate: 5,
    socializeRate: 22,
    moveSpeed: 42,
    actionDurations: {
      gatherWood:2.0, mineStone:2.6, plant:1.0, harvestFarm:1.6, forageBush:1.6,
      buildHouse:4.0, buildMarket:6.0, sellGoods:1.0, buyFood:1.0, eat:0.6, socialize:3.0,
      experiment:3.0, process:3.0, drink:0.8
    },
    houseCost:{total:9},
    marketCost:{total:24},
    farmGrowTime:26, farmYield:3,
    treeMaxWood:5, rockMaxStone:8,
    regenRate:0.06,
    keepReserve:{wood:3, stone:3, food:4},
    sellRate:1, foodPrice:2,
    lifespanMin:55, lifespanMax:95,
    birthCooldown:4, birthChance:0.4
  };
  CFG.cols = CFG.W/TILE; CFG.rows = CFG.H/TILE;

  var NAMES = ["Aria","Beno","Caro","Dax","Elin","Fenn","Gyla","Hux","Ines","Joro",
               "Kesh","Lira","Milo","Nyra","Orin","Pell","Quen","Rosk","Sana","Tavi",
               "Ulla","Vesh","Wren","Xara","Yolo","Zeke","Brin","Cael","Dova","Enzo"];

  var CHAT_LINES = [
    function(a,b){ return a+" and "+b+" trade stories about the day's work."; },
    function(a,b){ return a+" and "+b+" share a laugh together."; },
    function(a,b){ return a+" catches up with "+b+" for a while."; },
    function(a,b){ return a+" and "+b+" sit and talk as the light shifts."; }
    ];

  var TRAITS = ["curious","stubborn","cheerful","quiet","restless","gentle",
                "ambitious","dreamy","practical","warm-hearted","cautious","playful"];

  function timeOfDayLabel(t){
    if(t<0.16) return 'Night';
    if(t<0.30) return 'Dawn';
    if(t<0.47) return 'Morning';
    if(t<0.56) return 'Noon';
    if(t<0.75) return 'Afternoon';
    if(t<0.88) return 'Dusk';
    return 'Night';
  }
  var S = {};
var aiQueue = []; // priority + chat requests raised since the last drain

function rand(a,b){ return a + random()*(b-a); }
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function pick(arr){ return arr[Math.floor(random()*arr.length)]; }
function dist(a,b){ var dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }
function findById(list,id){ for(var i=0;i<list.length;i++) if(list[i].id===id) return list[i]; return null; }
function pickName(){ return NAMES[Math.floor(random()*NAMES.length)]; }

function nearbyDescription(a){
var near=[];
for(var i=0;i<S.agents.length && near.length<3;i++){
var o=S.agents[i];
if(o===a) continue;
if(dist(a,o)<90){var look=describeAppearance(o);near.push(o.name+(o.role?' the '+o.role:'')+' ('+look.skin+' skin, '+look.hair+' '+look.hairShade+' hair)');}
}
return near.length ? near.join(', ') : 'nobody nearby';
}
function recentMemoryFor(name){
var hits=[];
for(var i=0;i<S.log.length && hits.length<2;i++){
if(S.log[i].msg.indexOf(name)!==-1) hits.push(S.log[i].msg);
}
return hits.join(' ');
}
function visibleSurroundings(a){
var counts={};for(var p of a.perception&&a.perception.knownPlaces||[])if(p.source==='seen'&&p.lastSeenDay===S.day&&p.lastSeenAvailable!==false)counts[p.kind]=(counts[p.kind]||0)+1;
var labels={tree:'trees',rock:'rocks',bush:'fruiting plants',water:'surface water',animal:'moving animals',deposit:'exposed earth',fire:'flame and smoke',building:'made structures',farm:'worked ground'};
var seen=Object.entries(counts).map(function(x){return x[1]+' '+(labels[x[0]]||x[0]);});return seen.length?seen.join(', '):'no distinct resource nearby';
}

function requestPriorityThought(a){
if(a.aiPending) return;
a.aiPending = true;
aiQueue.push({
type:'priority', agentId:a.id,
name:a.name, trait:a.trait, role:a.role||'undecided',
hunger:Math.round(a.hunger), energy:Math.round(a.energy), social:Math.round(a.social),
food:a.inv.food, wood:a.inv.wood, stone:a.inv.stone, coins:a.coins, hasHome:!!a.home,
materials:{fiber:a.inv.fiber||0,clay:a.inv.clay||0,ore:a.inv.ore||0,bone:a.inv.bone||0,hide:a.inv.hide||0},
day:S.day, timeOfDay:timeOfDayLabel(S.time),
nearby:nearbyDescription(a), recent:recentMemoryFor(a.name),
surroundings:visibleSurroundings(a),
world:null,environment:sensoryDescription(S.weather),symptoms:(a.body&&a.body.lastSymptoms||[]).slice(-3),
hydration:Math.round(a.body&&a.body.waterReserve||100),
alertness:Math.round(a.body&&a.body.alertness||75),
communication:{gesture:Math.round(a.communication&&a.communication.gestureSkill||12),vocal:Math.round(a.communication&&a.communication.vocalSkill||3),sharedSigns:(a.communication&&a.communication.conventions||[]).length},
appearance:describeAppearance(a)
});
}
function requestChatLine(a, other){
var chatId = 'c'+S.day+'_'+a.id+'_'+other.id+'_'+Math.floor(random()*1e6);
a.action.chatId = chatId; other.action.chatId = chatId;
aiQueue.push({
type:'chat', chatId:chatId,
a:{name:a.name, role:a.role||'undecided', trait:a.trait},
b:{name:other.name, role:other.role||'undecided', trait:other.trait},
day:S.day, world:null
});
}
function requestRoleThought(){}

function log(msg,type){
S.log.unshift({msg:msg, type:type||'info'});
if(S.log.length>40) S.log.length = 40;
if(!S.chronicle) S.chronicle = [];
S.chronicle.push({msg:msg, type:type||'info', day:S.day});
if(S.chronicle.length>400) S.chronicle.splice(0, S.chronicle.length-400);
}

function createAgent(opts){
opts = opts || {};
var id=S.nextId++,name=pickName();
return {
id:id, name:name, role:opts.role||null, trait:pick(TRAITS),
x:opts.x, y:opts.y, tx:null, ty:null, pending:null,
state:'idle', action:null,
aiFocus:null, aiThought:null, aiPending:false, aiCooldown:rand(1,6),
hunger: opts.hunger!==undefined?opts.hunger:rand(10,35),
energy: opts.energy!==undefined?opts.energy:rand(65,100),
social: opts.social!==undefined?opts.social:rand(50,90),
inv:{wood:0, stone:0, timber:0, fiber:0, clay:0, ore:0, bone:0, hide:0, food: opts.age===0?0:Math.floor(rand(0,2))},
artifacts:[],
coins:0, home:null,
age: opts.age!==undefined?opts.age:rand(20,32),
lifespan: rand(CFG.lifespanMin, CFG.lifespanMax),
thirst:rand(8,28),health:100,pain:0,bodyTemperature:37,literacy:false,literacySystem:null,
tools:[],
perception:{knownPlaces:[],lastScanDay:0,visionRange:0},
life:{sex:S.nextId%2?'female':'male',parents:Array.isArray(opts.parents)?opts.parents.slice(0,2):[],pregnancy:null,stage:opts.age===0?'infant':'adult',dependentUntil:12},
communication:{gestureSkill:12,vocalSkill:3,encounters:0,conventions:[]},
heritage:opts.heritage||makeFounderHeritage(null,id+':'+name),
dead:false
};
}

function createBuilding(type,x,y,ownerId){
var b = { id:S.nextId++, type:type, x:x, y:y, ownerId:ownerId||null };
if(type==='market') b.stock = {wood:0, stone:0, food:0};
S.buildings.push(b);
return b;
}

function getBuilding(id){ return findById(S.buildings, id); }

function spendMaterials(a, total){
var takeWood = Math.min(a.inv.wood, total);
a.inv.wood -= takeWood; total -= takeWood;
var takeStone = Math.min(a.inv.stone, total);
a.inv.stone -= takeStone; total -= takeStone;
}

function initWorld(){
S.time = 0.3; S.day = 1; S.speed = 1; S.birthCooldownTimer = 0; S.selectedId = null;
S.log = []; S.chronicle = []; S.nextId = 1;S.fires=[];S.records=[];S.discoveryGraph={nodes:[],edges:[]};S.ambientTemperature=18;S.weatherHistory=[];
S.trees = []; S.rocks = []; S.bushes = []; S.farms = []; S.buildings = []; S.market = null; S.agents = [];S.deposits=[];

S.groundTiles = [];
for(var gy=0; gy<CFG.rows; gy++){
var grow=[];
for(var gx=0; gx<CFG.cols; gx++) grow.push(Math.floor(rand(0,3)));
S.groundTiles.push(grow);
}
S.pond = {x:220, y:272, w:76, h:32,substance:'water'};
S.well = null;

for(var i=0;i<12;i++) S.trees.push({id:S.nextId++, x:rand(330,466), y:rand(16,284), wood:CFG.treeMaxWood, max:CFG.treeMaxWood,primarySubstance:'cellulose'});
for(i=0;i<7;i++) S.rocks.push({id:S.nextId++, x:rand(14,120), y:rand(190,286), stone:CFG.rockMaxStone, max:CFG.rockMaxStone,primarySubstance:i%3===0?'ironOxide':'silica'});
for(i=0;i<6;i++) S.bushes.push({id:S.nextId++, x:rand(140,320), y:rand(150,232), food:3, max:3});
for(i=0;i<3;i++)S.deposits.push({id:S.nextId++,x:S.pond.x+rand(-55,55),y:S.pond.y-rand(5,28),material:'clay',amount:8});

for(i=0;i<CFG.initialPop;i++){
var person=createAgent({
x: clamp(S.pond.x+rand(-45,45), 20, CFG.W-20),
y: clamp(S.pond.y-28+rand(-12,12), 20, CFG.H-20)
});person.body=createBody(random);person.thirst=100-person.body.waterReserve;S.agents.push(person);
}
ensureWeather(S,random);S.pond.level=S.weather.pondLevel;
ensureEcology(S);
ensureCulture(S);
for(i=0;i<S.agents.length;i++)scanEnvironment(S,S.agents[i]);
log('A handful of people awaken beside the river with no homes, trades, tools, or shared recipes.', 'info');
}

function goTo(a,x,y,pending){
a.tx=x; a.ty=y; a.state='moving'; a.pending=pending||{};
}
function moveTowards(a,dt){
var dx=a.tx-a.x, dy=a.ty-a.y, d=Math.sqrt(dx*dx+dy*dy);
var step = CFG.moveSpeed*dt;
if(d<=step || d<3){ a.x=a.tx; a.y=a.ty; }
else { a.x += dx/d*step; a.y += dy/d*step; }
}
function arrived(a){ return Math.hypot(a.tx-a.x, a.ty-a.y) < 3.2; }

function wander(a){
var x = clamp(a.x+rand(-60,60), 15, CFG.W-15);
var y = clamp(a.y+rand(-60,60), 15, CFG.H-15);
goTo(a,x,y,{});
}

function rememberedTarget(a,kind){
if(kind!=='bush')return nearestKnown(a,kind);
var choices=(a.perception&&a.perception.knownPlaces||[]).filter(function(x){return x.kind==='bush'&&x.lastSeenAvailable!==false&&(Number(a.foodExperience&&a.foodExperience[x.sensoryTag])||0)>-2;});
choices.sort(function(x,y){return dist(a,x)-dist(a,y);});return choices[0]||null;
}

function findFoodTarget(a){
var cands=[];
var f=rememberedTarget(a,'farm');if(f)cands.push({x:f.x,y:f.y,targetType:'farm',targetId:f.id,sub:'harvest'});
var b=rememberedTarget(a,'bush');if(b)cands.push({x:b.x,y:b.y,targetType:'bush',targetId:b.id});
var market=rememberedTarget(a,'building');if(market&&S.market&&String(market.id)===String(S.market.id)&&a.coins>=CFG.foodPrice)cands.push({x:market.x,y:market.y,targetType:'market',targetId:market.id,sub:'buy'});
if(!cands.length) return null;
cands.sort(function(p,q){ return dist(a,p)-dist(a,q); });
return cands[0];
}

function findClearSpot(x,y){
var cx=x, cy=y, tries=0;
while(tries<10 && S.buildings.some(function(b){ return dist({x:cx,y:cy}, b) < 26; })){
cx = clamp(x+rand(-55,55), 18, CFG.W-18);
cy = clamp(y+rand(-55,55), 18, CFG.H-18);
tries++;
}
return {x:cx,y:cy};
}

function goToBuildSpot(a,kind){
var spot = findClearSpot(a.x,a.y);
goTo(a, spot.x, spot.y, {targetType:'buildsite', targetId:null, sub:kind});
}
function goToMarketSell(a){
goTo(a, S.market.x, S.market.y, {targetType:'market', targetId:S.market.id, sub:'sell'});
}

function hasCapability(a,id){return !!(a.mind&&Array.isArray(a.mind.capabilities)&&a.mind.capabilities.some(function(x){return x.id===id;}));}
function pendingExperiment(a){
var xs=a.mind&&Array.isArray(a.mind.experiments)?a.mind.experiments:[];
for(var i=xs.length-1;i>=0;i--)if(xs[i].status==='proposed')return xs[i];
return null;
}
function constructionUnits(a){return (a.inv.wood||0)+(a.inv.stone||0)+(a.inv.timber||0)*1.5;}
function beginExperiment(a,exp){
var rule=lookupAffordance(exp.operation,exp.materials);
if(exp.materials.length&&!exp.materials.every(function(k){return k==='body'||Number(a.inv[k])>0;})){
exp.status='blocked';exp.result='I no longer have the materials for this attempt.';return false;
}
a.state='working';a.action={targetType:'experiment',experimentDay:exp.day,signature:signature(exp.operation,exp.materials),timer:rule?rule.duration:CFG.actionDurations.experiment,duration:rule?rule.duration:CFG.actionDurations.experiment};return true;
}
function beginKnownProcess(a,id){
var rule=id==='shape:wood'&&lookupAffordance('shape',['wood']);
if(rule&&canPay(a.inv,rule.inputs)){a.state='working';a.action={targetType:'process',recipeId:id,timer:rule.duration,duration:rule.duration};return true;}
var cap=a.mind&&a.mind.capabilities&&a.mind.capabilities.find(function(x){return x.id===id&&x.method;});
if(!cap||!cap.method.materials.every(function(k){return Number(a.inv[k])>0;}))return false;
a.state='working';a.action={targetType:'process',recipeId:id,method:cap.method,timer:CFG.actionDurations.process,duration:CFG.actionDurations.process};return true;
}
function primitiveWork(a){
var heard=a.mind&&Array.isArray(a.mind.instructions)?a.mind.instructions.find(function(x){return x.id==='shape:wood'&&x.status!=='validated';}):null;
if(heard&&a.inv.wood>0&&!hasCapability(a,'shape:wood')&&!pendingExperiment(a)){
a.mind.experiments.push({hypothesis:'Shaping wood as I was shown may make a stronger piece.',operation:'shape',materials:['wood'],hopedResult:'A straighter, stronger piece of wood',status:'proposed',day:S.day,result:null,taughtBy:heard.sourceAgentId});
heard.status='testing';
}
var exp=pendingExperiment(a);if(exp&&beginExperiment(a,exp))return;
if(!a.home&&hasCapability(a,'shape:wood')&&constructionUnits(a)>=CFG.houseCost.total){goToBuildSpot(a,'house');return;}
if(hasCapability(a,'shape:wood')&&a.inv.wood>0&&a.inv.timber<3){if(beginKnownProcess(a,'shape:wood'))return;}
var artifactCap=a.mind&&a.mind.capabilities&&a.mind.capabilities.find(function(x){return x.kind==='artifact'&&x.method;});
if(a.aiFocus==='work'&&artifactCap&&(a.artifacts||[]).length<4){if(beginKnownProcess(a,artifactCap.id))return;}
var target;
if(a.inv.food<2){target=rememberedTarget(a,'bush');if(target){goTo(a,target.x,target.y,{targetType:'bush',targetId:target.id});return;}}
if((a.inv.wood||0)<5){target=rememberedTarget(a,'tree');if(target){goTo(a,target.x,target.y,{targetType:'tree',targetId:target.id});return;}}
if((a.inv.stone||0)<3){target=rememberedTarget(a,'rock');if(target){goTo(a,target.x,target.y,{targetType:'rock',targetId:target.id});return;}}
if((a.inv.clay||0)<2){target=rememberedTarget(a,'deposit');if(target){goTo(a,target.x,target.y,{targetType:'deposit',targetId:target.id});return;}}
wander(a);
}
function nearestFire(a){var best=null,bd=Infinity;for(var i=0;i<(S.fires||[]).length;i++){var d=dist(a,S.fires[i]);if(d<bd){bd=d;best=S.fires[i];}}return best?{fire:best,distance:bd}:null;}
function fleeFire(a,f){
var dx=a.x-f.x,dy=a.y-f.y,d=Math.max(1,Math.hypot(dx,dy));
goTo(a,clamp(a.x+dx/d*55,15,CFG.W-15),clamp(a.y+dy/d*55,15,CFG.H-15),{fleeing:'fire'});
}

function atOwnedShelter(a){var h=a.home&&getBuilding(a.home);return !!(h&&dist(a,h)<5);}
function beginSleep(a,home,forced){
a.state='resting';a.pending=null;a.tx=null;a.ty=null;
var required=sleepRequirementHours(a);
a.action={home:!!home,sleep:true,forced:!!forced,timer:CFG.dayLength*Math.min(.75,(required+3)/24)};
}
function seekSleep(a,forced){
var h=a.home&&getBuilding(a.home);
if(h&&!forced&&!atOwnedShelter(a)){goTo(a,h.x,h.y,{home:true,sleep:true,forced:false});return;}
beginSleep(a,!!h&&atOwnedShelter(a),forced);
}

function findSocialPartner(a){
var best=null, bd=90;
for(var i=0;i<S.agents.length;i++){
var o=S.agents[i];
if(o===a || o.state==='socializing') continue;
var d=dist(a,o);
if(d<bd){ bd=d; best=o; }
}
return best;
}
function initiateSocialize(a,other){
var dur = CFG.actionDurations.socialize;
a.state='socializing'; a.action={partnerId:other.id, timer:dur, initiator:true, chatLine:null};
other.state='socializing'; other.action={partnerId:a.id, timer:dur, initiator:false, chatLine:null};
requestChatLine(a, other);
}

function assignRole(a){
var counts = {woodcutter:0, farmer:0, miner:0, trader:0};
for(var i=0;i<S.agents.length;i++){ var o=S.agents[i]; if(o.role) counts[o.role]=(counts[o.role]||0)+1; }
var choices = ['woodcutter','farmer','miner'];
if(S.market && random()<0.25) choices.push('trader');
choices.sort(function(x,y){ return counts[x]-counts[y]; });
a.role = choices[0];
log(a.name+' takes up work as a '+a.role+'.', 'role');
}

function roleWork(a){
if(!a.home && (a.inv.wood+a.inv.stone)>=CFG.houseCost.total){
goToBuildSpot(a,'house'); return;
}
if(!S.market && (a.inv.wood+a.inv.stone)>=CFG.marketCost.total){
goToBuildSpot(a,'market'); return;
}
var t,r,b,ripe,empty;
switch(a.role){
case 'woodcutter':
if(a.inv.wood>=10 && S.market){ goToMarketSell(a); return; }
t = rememberedTarget(a,'tree');
if(t) goTo(a,t.x,t.y,{targetType:'tree',targetId:t.id}); else wander(a);
break;
case 'miner':
if(a.inv.stone>=10 && S.market){ goToMarketSell(a); return; }
r = rememberedTarget(a,'rock');
if(r) goTo(a,r.x,r.y,{targetType:'rock',targetId:r.id}); else wander(a);
break;
case 'farmer':
if(a.inv.food>=8 && S.market && a.hunger<50){ goToMarketSell(a); return; }
ripe = null;
for(var i=0;i<S.farms.length;i++){ if(S.farms[i].planted && S.farms[i].growth>=1){ ripe=S.farms[i]; break; } }
if(ripe){ goTo(a,ripe.x,ripe.y,{targetType:'farm',targetId:ripe.id,sub:'harvest'}); return; }
empty = null;
for(i=0;i<S.farms.length;i++){ if(!S.farms[i].planted){ empty=S.farms[i]; break; } }
if(empty){ goTo(a,empty.x,empty.y,{targetType:'farm',targetId:empty.id,sub:'plant'}); return; }
b = rememberedTarget(a,'bush');
if(b) goTo(a,b.x,b.y,{targetType:'bush',targetId:b.id}); else wander(a);
break;
case 'trader':
if(!S.market){ wander(a); break; }
if(a.inv.food===0 && a.hunger>40 && a.coins>=CFG.foodPrice && S.market.stock.food>0){
goTo(a,S.market.x,S.market.y,{targetType:'market',targetId:S.market.id,sub:'buy'}); return;
}
if(a.inv.wood>0 || a.inv.stone>0 || a.inv.food>0){ goToMarketSell(a); return; }
t = rememberedTarget(a,'tree');
if(t) goTo(a,t.x,t.y,{targetType:'tree',targetId:t.id}); else wander(a);
break;
default:
wander(a);
}
}

function decide(a){
if(a.aiCooldown<=0){
a.aiCooldown = rand(16,26);
requestPriorityThought(a);
}

var danger=nearestFire(a);if(danger&&danger.distance<38){fleeFire(a,danger.fire);return;}
if(a.thirst>=50){var water=rememberedTarget(a,'water');if(water){goTo(a,water.x,water.y,{targetType:'water',targetId:water.id,sub:'drink'});return;}}
if(a.hunger>=92){
if(canConsume(a)){ a.state='working'; a.action={targetType:'self', sub:'eat', timer:CFG.actionDurations.eat, duration:CFG.actionDurations.eat}; return; }
var urgentTarget = findFoodTarget(a);
if(urgentTarget){ goTo(a,urgentTarget.x,urgentTarget.y,{targetType:urgentTarget.targetType,targetId:urgentTarget.targetId,sub:urgentTarget.sub}); return; }
}
var need=sleepNeed(a.body,S.time),biologicalNight=(S.time<.27||S.time>.83);
if(need>=94||a.body.awakeHours>=24){seekSleep(a,true);return;}
if(need>=66&&(biologicalNight||a.body.sleepPressure>=76)){seekSleep(a,false);return;}
if(a.energy<=10){
seekSleep(a,false);return;
}

var candidates=[];
if(a.hunger>=72) candidates.push('hunger');
if(a.energy<=22) candidates.push('energy');
if(a.social<=25) candidates.push('social');
if(a.aiFocus && candidates.indexOf(a.aiFocus)!==-1){
candidates = [a.aiFocus].concat(candidates.filter(function(c){ return c!==a.aiFocus; }));
}

for(var i=0;i<candidates.length;i++){
if(candidates[i]==='hunger'){
if(canConsume(a)){ a.state='working'; a.action={targetType:'self', sub:'eat', timer:CFG.actionDurations.eat, duration:CFG.actionDurations.eat}; return; }
var target = findFoodTarget(a);
if(target){ goTo(a,target.x,target.y,{targetType:target.targetType,targetId:target.targetId,sub:target.sub}); return; }
} else if(candidates[i]==='energy'){
if(a.home){
var h = getBuilding(a.home);
if(h){
if(dist(a,h)<4){ beginSleep(a,true,false); } else { goTo(a,h.x,h.y,{home:true,sleep:true}); }
return;
}
}
beginSleep(a,false,false);return;
} else if(candidates[i]==='social'){
var partner = findSocialPartner(a);
if(partner){ initiateSocialize(a,partner); return; }
}
}

if(!a.role){primitiveWork(a);return;}
roleWork(a);
}

function startWorkingOnArrival(a){
var p = a.pending; a.pending = null;
if(!p){ a.state='idle'; return; }
if(p.home){ beginSleep(a,true,!!p.forced); return; }
if(p.targetType){
var dur = pickWorkDuration(p.targetType, p.sub);
a.state='working';
a.action={targetType:p.targetType, targetId:p.targetId, sub:p.sub, timer:dur, duration:dur};
return;
}
a.state='idle';
}

function pickWorkDuration(targetType,sub){
switch(targetType){
case 'tree': return CFG.actionDurations.gatherWood;
case 'rock': return CFG.actionDurations.mineStone;
case 'bush': return CFG.actionDurations.forageBush;
case 'deposit': return 1.8;
case 'farm': return sub==='plant' ? CFG.actionDurations.plant : CFG.actionDurations.harvestFarm;
case 'market': return sub==='buy' ? CFG.actionDurations.buyFood : CFG.actionDurations.sellGoods;
case 'buildsite': return sub==='market' ? CFG.actionDurations.buildMarket : CFG.actionDurations.buildHouse;
case 'experiment': return CFG.actionDurations.experiment;
case 'process': return CFG.actionDurations.process;
case 'water': return CFG.actionDurations.drink;
default: return 1.5;
}
}

function completeWork(a){
var act = a.action, t,r,b,f,m,i,res,keep,surplus,amt,price;
switch(act.targetType){
case 'experiment':
var experiments=a.mind&&Array.isArray(a.mind.experiments)?a.mind.experiments:[];
var exp=null;
for(i=experiments.length-1;i>=0;i--)if(experiments[i].status==='proposed'&&experiments[i].day===act.experimentDay){exp=experiments[i];break;}
if(exp){
var physicalRule=lookupAffordance(exp.operation,exp.materials);
if(physicalRule&&canPay(a.inv,physicalRule.inputs)){pay(a.inv,physicalRule.inputs);produce(a.inv,physicalRule.outputs);exp.physicalSuccess=true;}
else {
var grounded=exp.materials.length&&exp.materials.every(function(k){return k!=='body'&&Number(a.inv[k])>0;});
if(grounded){for(i=0;i<exp.materials.length;i++)a.inv[exp.materials[i]]-=1;exp.prototype=evaluatePrototype({operation:exp.operation,materials:exp.materials,form:exp.form||'rough',makerId:a.id,day:S.day});exp.physicalSuccess=!!exp.prototype.success;if(exp.physicalSuccess){if(!Array.isArray(a.artifacts))a.artifacts=[];a.artifacts.push({id:S.nextId++,...exp.prototype});if(a.artifacts.length>12)a.artifacts.splice(0,a.artifacts.length-12);}}
else exp.physicalSuccess=false;
}
exp.status='observed';exp.completedDay=S.day;
}
break;
case 'process':
var recipeRule=act.recipeId==='shape:wood'?lookupAffordance('shape',['wood']):null;
if(recipeRule&&hasCapability(a,act.recipeId)&&canPay(a.inv,recipeRule.inputs)){pay(a.inv,recipeRule.inputs);produce(a.inv,recipeRule.outputs);}
else if(act.method&&hasCapability(a,act.recipeId)&&act.method.materials.every(function(k){return Number(a.inv[k])>0;})){
for(i=0;i<act.method.materials.length;i++)a.inv[act.method.materials[i]]-=1;
var repeated=evaluatePrototype({operation:act.method.operation,materials:act.method.materials,form:act.method.form,makerId:a.id,day:S.day});
if(repeated.success){if(!Array.isArray(a.artifacts))a.artifacts=[];a.artifacts.push({id:S.nextId++,...repeated});if(a.artifacts.length>12)a.artifacts.splice(0,a.artifacts.length-12);}
}
break;
case 'water':
if(act.sub==='drink'){
drinkBody(a,70);
exposePathogens(a,drinkRisk(S)*6);
if(a.mind){if(!Array.isArray(a.mind.observations))a.mind.observations=[];var seen=matterObservation(S.pond.substance||'water',{level:0,temperature:S.ambientTemperature});var text='Pond water is a '+seen.appearance+' that relieves thirst.';if(!a.mind.observations.some(function(x){return x.text===text;}))a.mind.observations.push({text:text,day:S.day,source:'senses'});}
}
break;
case 'tree':
t = findById(S.trees, act.targetId);
if(t && t.wood>=1){ t.wood-=1; a.inv.wood+=1; }
markObserved(a,'tree',act.targetId,!!(t&&t.wood>=1),S.day);
break;
case 'rock':
r = findById(S.rocks, act.targetId);
if(r && r.stone>=1){ r.stone-=1; a.inv.stone+=1;if(r.primarySubstance==='ironOxide')a.inv.ore=(a.inv.ore||0)+1; }
markObserved(a,'rock',act.targetId,!!(r&&r.stone>=1),S.day);
break;
case 'bush':
b = findById(S.bushes, act.targetId);
if(b && b.food>=1){ b.food-=1;forageFood(a,b,S.day); }
markObserved(a,'bush',act.targetId,!!(b&&b.food>=1),S.day);
break;
case 'deposit':
var deposit=findById(S.deposits||[],act.targetId);if(deposit&&deposit.amount>0){deposit.amount--;a.inv[deposit.material]=(a.inv[deposit.material]||0)+1;}markObserved(a,'deposit',act.targetId,!!(deposit&&deposit.amount>0),S.day);
break;
case 'farm':
f = findById(S.farms, act.targetId);
if(f){
if(act.sub==='plant' && !f.planted){ f.planted=true; f.growth=0; }
else if(act.sub==='harvest' && f.planted && f.growth>=1){ f.planted=false; f.growth=0; a.inv.food+=CFG.farmYield; }
}
break;
case 'market':
m = S.market;
if(m){
if(act.sub==='buy'){
if(m.stock.food>0 && a.coins>=CFG.foodPrice){ m.stock.food-=1; a.coins-=CFG.foodPrice; a.inv.food+=1; }
} else {
var resources=['wood','stone','food'];
for(i=0;i<resources.length;i++){
res=resources[i]; keep=CFG.keepReserve[res];
surplus = Math.max(0, a.inv[res]-keep);
if(surplus>0){
amt = Math.min(surplus,5);
a.inv[res]-=amt; m.stock[res]+=amt;
price = res==='food' ? CFG.foodPrice : CFG.sellRate;
a.coins += amt*price;
}
}
}
}
break;
case 'buildsite':
if(act.sub==='market'){
if(!S.market && (a.inv.wood+a.inv.stone)>=CFG.marketCost.total){
spendMaterials(a, CFG.marketCost.total);
S.market = createBuilding('market', a.x, a.y);
log('The village market opens its stalls, funded by '+a.name+'.', 'market');
}
} else {
if(!a.home && constructionUnits(a)>=CFG.houseCost.total){
var used={wood:0,stone:0,timber:0},remaining=CFG.houseCost.total;
while(remaining>0&&a.inv.timber>0){a.inv.timber--;used.timber++;remaining-=1.5;}
while(remaining>0&&a.inv.wood>0){a.inv.wood--;used.wood++;remaining--;}
while(remaining>0&&a.inv.stone>0){a.inv.stone--;used.stone++;remaining--;}
var house = createBuilding('house', a.x, a.y, a.id);
house.materials=used;house.methods=used.timber?['shape:wood']:[];
a.home = house.id;
log(a.name+' builds a shelter'+(used.timber?' with shaped timber':'')+'.', 'build');
}
}
break;
case 'self':
if(act.sub==='eat' && a.inv.food>0){var meal=consumeFood(a,S.day);if(meal){eatBody(a,meal.nutrition);if(meal.water)drinkBody(a,meal.water*.35);if(meal.toxin){a.health=clamp(a.health-meal.toxin*.35,0,100);a.pain=clamp(a.pain+meal.toxin*.3,0,100);exposePathogens(a,meal.spoiled?meal.toxin:0);}recordFoodOutcome(a,meal);if(a.mind&&meal.toxin>3)a.mind.observations.push({text:'After eating '+meal.appearance+', my body became ill.',day:S.day,source:'body'});if(a.health<=0){a.dead=true;a.deathReason='poisoning';}}else if(a.inv.food>(a.foodItems||[]).length){a.inv.food-=1;eatBody(a,1);} }
break;
}
a.state='idle'; a.action=null;
}

function maybeBirth(a,partnerId){
if(S.agents.length>=CFG.maxPop) return;
if(S.birthCooldownTimer>0) return;
var other = findById(S.agents, partnerId);
if(!other) return;
if(a.hunger>60 || other.hunger>60) return;
var mother=tryConceive(a,other,S.day,random());if(!mother)return;
mother.life.pregnancy.childHeritage=inheritHeritage(a,other,random);
S.birthCooldownTimer=CFG.birthCooldown;
}

function completePregnancies(dt){
var due=advancePregnancies(S,dt/CFG.dayLength);
for(var i=0;i<due.length&&S.agents.length<CFG.maxPop;i++){
var mother=due[i].mother,other=findById(S.agents,due[i].otherParentId),x=clamp(mother.x+rand(-5,5),12,CFG.W-12),y=clamp(mother.y+rand(-5,5),12,CFG.H-12);
var child=createAgent({x:x,y:y,role:null,age:0,parents:[mother.id,due[i].otherParentId],heritage:due[i].heritage||(other&&inheritHeritage(mother,other,random))});child.home=mother.home||(other&&other.home)||null;child.body=createBody(random);child.body.fatReserveDays=3;child.body.glycogenReserve=55;S.agents.push(child);log(mother.name+' welcomes a newborn, '+child.name+'.','birth');
}
}

function continueSleep(a,dt){
if(!a.action)a.action={home:false,sleep:true,forced:false,timer:CFG.dayLength*Math.min(.75,(sleepRequirementHours(a)+3)/24)};
var rate=(a.action.home?CFG.restHomeRate:CFG.restFieldRate)*(a.body.sleepQuality||.5);
a.energy=clamp(a.energy+rate*dt,0,100);a.action.timer-=dt;
var required=sleepRequirementHours(a),rested=a.body.sleepEpisodeHours>=required&&sleepNeed(a.body,S.time)<48;
var urgent=a.thirst>=65||a.hunger>=94;
if(rested||a.body.sleepEpisodeHours>=required+3||urgent||a.action.timer<=0){a.state='idle';a.action=null;}
}

function updateAgent(a,dt){
if(Number.isFinite(a.health)&&a.health<=0){a.dead=true;var prior=a.healthState||{};a.deathReason=prior.oxygenSaturation<82?'oxygen deprivation':prior.bloodVolume<70?'blood loss':prior.infectionLoad>45?'infection':'burn injuries';return;}
a.age += dt/(CFG.dayLength*360);
var busy = (a.state==='moving' || a.state==='working');
a.hunger = clamp(a.hunger + CFG.hungerRate*dt, 0, 100);
a.energy = clamp(a.energy - (busy?CFG.energyDecayWork:CFG.energyDecayIdle)*dt, 0, 100);
a.social = clamp(a.social - CFG.socialDecay*dt, 0, 100);
a.health=clamp(Number.isFinite(a.health)?a.health:100,0,100);a.pain=clamp((Number.isFinite(a.pain)?a.pain:0)-1.4*dt,0,100);
a.aiCooldown -= dt;
ensureBody(a,random);
ensureHealth(a);
ensureLife(a);ensureCommunication(a);
ensurePerception(a);scanEnvironment(S,a);
var sleeping=a.state==='resting',sheltered=sleeping&&a.action&&a.action.home;
advanceSleep(a,{timeOfDay:S.time,days:dt/CFG.dayLength,sleeping:sleeping,sheltered:sheltered,weather:S.weather});
var bodyDeath=advanceBody(a,{weather:S.weather,active:busy,sheltered:sheltered,days:dt/CFG.dayLength,waterLossPerDay:waterLossPerDay(S.weather,busy)});
if(busy&&a.body.alertness<25&&random()<dt/CFG.dayLength*.12)wound(a,{severity:8+(25-a.body.alertness)*.35,contamination:a.state==='working'?5:2,cause:'exhausted accident'});

var fire=nearestFire(a);
if(fire&&fire.distance<34){
var exposure=(34-fire.distance)/34*(fire.fire.intensity||1)*dt;
inhaleSmoke(a,exposure*2.2);
a.bodyTemperature=clamp((a.bodyTemperature||37)+exposure*.35,30,45);
if(a.body)a.body.coreTemperature=a.bodyTemperature;
if(fire.distance<20){a.health=clamp(a.health-exposure*7,0,100);a.pain=clamp(a.pain+exposure*18,0,100);if(a.mind){if(!Array.isArray(a.mind.observations))a.mind.observations=[];if(!a.mind.observations.some(function(x){return x.text==='Approaching flame causes heat and pain.';}))a.mind.observations.push({text:'Approaching flame causes heat and pain.',day:S.day,source:'senses'});}}
if(a.state==='resting'){a.state='idle';a.action=null;fleeFire(a,fire.fire);return;}
}

var healthDeath=advanceHealth(a,{days:dt/CFG.dayLength,resting:sleeping});
if(a.mind&&a.body.lastSymptoms.length){if(!Array.isArray(a.mind.observations))a.mind.observations=[];for(var symptom of a.body.lastSymptoms)if(!a.mind.observations.some(function(x){return x.text===symptom;}))a.mind.observations.push({text:symptom,day:S.day,source:'body'});if(a.mind.observations.length>20)a.mind.observations.splice(0,a.mind.observations.length-20);}
if(bodyDeath||healthDeath){a.dead=true;a.deathReason=bodyDeath||healthDeath;return;}

if(a.health<=0){a.dead=true;a.deathReason='burn injuries';return;}
if(a.age>=a.lifespan){ a.dead=true; a.deathReason='old age'; return; }
if(a.age<12){
careForDependent(S,a,dt/CFG.dayLength);
if(a.state==='resting'){continueSleep(a,dt);return;}
if(a.state==='moving'||a.state==='working'||a.state==='socializing'){a.state='idle';a.action=null;a.pending=null;}
if(a.body.sleepPressure>=55)beginSleep(a,atOwnedShelter(a),false);
return;
}

if(a.state==='resting'){
continueSleep(a,dt);
return;
}
if(a.state==='socializing'){
a.social = clamp(a.social+CFG.socializeRate*dt, 0, 100);
a.action.timer -= dt;
if(a.action.timer<=0){
var wasInitiator = a.action.initiator, partnerId = a.action.partnerId, chatLine = a.action.chatLine;
a.state='idle'; a.action=null;
if(wasInitiator){
var partner = findById(S.agents, partnerId);
var pname = partner ? partner.name : 'a friend';
if(chatLine){ log(chatLine, 'social'); }
else if(random()<0.35){ log(pick(CHAT_LINES)(a.name,pname), 'social'); }
maybeBirth(a, partnerId);
if(partner){var clarity=communicate(S,a,partner);if(clarity>=.14)sharePlace(a,partner,S.day);}
}
}
return;
}
if(a.state==='moving'){
moveTowards(a,dt*functionalCapacity(a.body));
if(arrived(a)){ a.x=a.tx; a.y=a.ty; startWorkingOnArrival(a); }
return;
}
if(a.state==='working'){
a.action.timer -= dt*functionalCapacity(a.body);
if(a.action.timer<=0){ completeWork(a); }
return;
}
decide(a);
}

function update(dt){
var previousDay=S.day;
S.time += dt/CFG.dayLength;
if(S.time>=1){ S.time-=1; S.day++; }
if(S.day!==previousDay){advanceWeather(S,random);S.pond.level=S.weather.pondLevel;if(S.weather.storm)log('A strong storm crosses the land.', 'weather');else if(S.weather.hazard)log('A '+S.weather.hazard+' settles over the land.', 'weather');}
if(S.day!==previousDay&&S.weather.storm&&random()<.35&&S.trees.length){
var struck=pick(S.trees);if(struck.wood>0){S.fires.push({id:S.nextId++,x:struck.x,y:struck.y,intensity:1,fuel:Math.max(1,Math.min(4,struck.wood)),temperature:700,startedDay:S.day,cause:'lightning'});struck.wood=Math.max(0,struck.wood-1);log('Lightning ignites a tree in the wild.', 'fire');}
}
advanceEcology(S,dt/CFG.dayLength);
completePregnancies(dt);
var i;
for(i=(S.fires||[]).length-1;i>=0;i--){var flame=S.fires[i];flame.fuel-=dt*(.055+(S.weather.precipitationMm>0?.18:0));flame.intensity=clamp(flame.fuel/2,0,1.4);if(flame.fuel<=0)S.fires.splice(i,1);}
var growth=growthMultiplier(S.weather);
for(i=0;i<S.trees.length;i++) S.trees[i].wood = Math.min(S.trees[i].max, S.trees[i].wood + CFG.regenRate*growth*dt);
for(i=0;i<S.rocks.length;i++) S.rocks[i].stone = Math.min(S.rocks[i].max, S.rocks[i].stone + CFG.regenRate*0.6*dt);
for(i=0;i<S.bushes.length;i++) S.bushes[i].food = Math.min(S.bushes[i].max, S.bushes[i].food + CFG.regenRate*0.8*growth*dt);
for(i=0;i<S.farms.length;i++){ var f=S.farms[i]; if(f.planted) f.growth = Math.min(1, f.growth + dt/CFG.farmGrowTime); }
for(i=0;i<S.agents.length;i++) updateAgent(S.agents[i], dt);

var survivors=[];
for(i=0;i<S.agents.length;i++){
var a=S.agents[i];
if(a.dead) log(a.name+' has died of '+a.deathReason+'.', 'death');
else survivors.push(a);
}
S.agents = survivors;
S.birthCooldownTimer = Math.max(0, S.birthCooldownTimer-dt);
refreshInstitutions(S);
}

function drainAIRequests(){
var q = aiQueue;
aiQueue = [];
return { queue: q };
}
function applyAIResults(queue, priorityResults, chatResults){
queue.forEach(function(item, i){
if(item.type==='priority'){
var a = findById(S.agents, item.agentId);
if(a){
var r = priorityResults[i];
if(r && r.focus) a.aiFocus = r.focus;
if(r && r.thought) a.aiThought = r.thought;
a.aiPending = false;
}
} else if(item.type==='chat'){
var line = chatResults[item.chatId];
if(line){
for(var j=0;j<S.agents.length;j++){
var ag = S.agents[j];
if(ag.action && ag.action.chatId===item.chatId) ag.action.chatLine = line;
}
}
}
});
}

if(saved) {
S = structuredClone(saved);
S.market = S.market ? S.buildings.find(b=>b.id===S.market.id) : null;
if(!Array.isArray(S.fires))S.fires=[];if(!Array.isArray(S.records))S.records=[];if(!Array.isArray(S.deposits))S.deposits=[];if(!S.discoveryGraph)S.discoveryGraph={nodes:[],edges:[]};if(!Number.isFinite(S.ambientTemperature))S.ambientTemperature=18;if(!Array.isArray(S.weatherHistory))S.weatherHistory=[];ensureWeather(S,random);if(S.pond)S.pond.level=S.weather.pondLevel;ensureEcology(S);ensureCulture(S);
for(var savedAgent of S.agents){if(!savedAgent.inv)savedAgent.inv={wood:0,stone:0,food:0};for(var material of ['timber','fiber','clay','ore','bone','hide'])if(!Number.isFinite(savedAgent.inv[material]))savedAgent.inv[material]=0;if(!Array.isArray(savedAgent.artifacts))savedAgent.artifacts=[];if(!Array.isArray(savedAgent.foodItems))savedAgent.foodItems=[];if(!Number.isFinite(savedAgent.thirst))savedAgent.thirst=20;if(!Number.isFinite(savedAgent.health))savedAgent.health=100;if(!Number.isFinite(savedAgent.pain))savedAgent.pain=0;if(!Number.isFinite(savedAgent.bodyTemperature))savedAgent.bodyTemperature=37;if(typeof savedAgent.literacy!=='boolean')savedAgent.literacy=false;if(!Array.isArray(savedAgent.tools))savedAgent.tools=[];ensureBody(savedAgent,random);ensureHealth(savedAgent);ensureLife(savedAgent);ensureCommunication(savedAgent);ensurePerception(savedAgent);ensureHeritage(savedAgent);savedAgent.thirst=100-savedAgent.body.waterReserve;}
} else initWorld();
return { step: update, snapshot() { S.rng = rng; return structuredClone(S); }, drainAIRequests: drainAIRequests, applyAIResults: applyAIResults };
};
