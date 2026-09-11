'use strict';
const {lookup:lookupAffordance,canPay,pay,produce,signature}=require('./affordances');
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
      experiment:3.0, process:3.0
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

  var HOLIDAYS = {
    "1-1":"New Year's Day", "2-2":"World Wetlands Day", "3-14":"Pi Day",
    "3-20":"International Day of Happiness", "4-22":"Earth Day", "5-4":"Star Wars Day",
    "5-20":"World Bee Day", "6-5":"World Environment Day", "6-21":"World Music Day",
    "7-7":"World Chocolate Day", "7-30":"International Day of Friendship",
    "8-8":"International Cat Day", "8-19":"World Photography Day",
    "9-19":"Talk Like a Pirate Day", "9-21":"International Day of Peace",
    "10-1":"International Coffee Day", "10-31":"Halloween",
    "11-13":"World Kindness Day", "12-11":"International Mountain Day", "12-25":"Christmas Day"
  };

  function seasonForMonth(m){
    if(m===11||m===0||m===1) return 'winter';
    if(m>=2&&m<=4) return 'spring';
    if(m>=5&&m<=7) return 'summer';
    return 'autumn';
  }
  function moonPhaseName(date){
    var synodic = 29.530588853;
    var known = Date.UTC(2000,0,6,18,14,0)/1000;
    var days = ((date.getTime()/1000) - known) / 86400;
    var phase = ((days % synodic) + synodic) % synodic / synodic;
    var names=['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous',
               'Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
    return names[Math.floor(phase*8+0.5)%8];
  }
  function realWorldContext(){
    var now = new Date();
    return {
      weekday: now.toLocaleDateString(undefined,{weekday:'long'}),
      season: seasonForMonth(now.getMonth()),
      moon: moonPhaseName(now),
      holiday: HOLIDAYS[(now.getMonth()+1)+'-'+now.getDate()] || null
    };
  }
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
if(dist(a,o)<90) near.push(o.name+(o.role?' the '+o.role:''));
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

function requestPriorityThought(a){
if(a.aiPending) return;
a.aiPending = true;
aiQueue.push({
type:'priority', agentId:a.id,
name:a.name, trait:a.trait, role:a.role||'undecided',
hunger:Math.round(a.hunger), energy:Math.round(a.energy), social:Math.round(a.social),
food:a.inv.food, wood:a.inv.wood, stone:a.inv.stone, coins:a.coins, hasHome:!!a.home,
day:S.day, timeOfDay:timeOfDayLabel(S.time),
nearby:nearbyDescription(a), recent:recentMemoryFor(a.name),
world:realWorldContext()
});
}
function requestChatLine(a, other){
var chatId = 'c'+S.day+'_'+a.id+'_'+other.id+'_'+Math.floor(random()*1e6);
a.action.chatId = chatId; other.action.chatId = chatId;
aiQueue.push({
type:'chat', chatId:chatId,
a:{name:a.name, role:a.role||'undecided', trait:a.trait},
b:{name:other.name, role:other.role||'undecided', trait:other.trait},
day:S.day, world:realWorldContext()
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
return {
id:S.nextId++, name:pickName(), role:opts.role||null, trait:pick(TRAITS),
x:opts.x, y:opts.y, tx:null, ty:null, pending:null,
state:'idle', action:null,
aiFocus:null, aiThought:null, aiPending:false, aiCooldown:rand(1,6),
hunger: opts.hunger!==undefined?opts.hunger:rand(10,35),
energy: opts.energy!==undefined?opts.energy:rand(65,100),
social: opts.social!==undefined?opts.social:rand(50,90),
inv:{wood:0, stone:0, timber:0, food: opts.age===0?0:Math.floor(rand(0,2))},
coins:0, home:null,
age: opts.age!==undefined?opts.age:rand(20,32),
lifespan: rand(CFG.lifespanMin, CFG.lifespanMax),
starveTimer:0, dead:false
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
S.log = []; S.chronicle = []; S.nextId = 1;
S.trees = []; S.rocks = []; S.bushes = []; S.farms = []; S.buildings = []; S.market = null; S.agents = [];

S.groundTiles = [];
for(var gy=0; gy<CFG.rows; gy++){
var grow=[];
for(var gx=0; gx<CFG.cols; gx++) grow.push(Math.floor(rand(0,3)));
S.groundTiles.push(grow);
}
S.pond = {x:220, y:272, w:76, h:32};
S.well = {x:230, y:150};

for(var i=0;i<12;i++) S.trees.push({id:S.nextId++, x:rand(330,466), y:rand(16,284), wood:CFG.treeMaxWood, max:CFG.treeMaxWood});
for(i=0;i<7;i++) S.rocks.push({id:S.nextId++, x:rand(14,120), y:rand(190,286), stone:CFG.rockMaxStone, max:CFG.rockMaxStone});
for(i=0;i<6;i++) S.bushes.push({id:S.nextId++, x:rand(140,320), y:rand(150,232), food:3, max:3});

for(i=0;i<CFG.initialPop;i++){
S.agents.push(createAgent({
x: clamp(230+rand(-40,40), 20, CFG.W-20),
y: clamp(150+rand(-30,30), 20, CFG.H-20)
}));
}
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

function nearestWithResource(list,key,a){
var best=null, bd=Infinity;
for(var i=0;i<list.length;i++){
var o=list[i];
if(o[key]>=1){ var d=dist(a,o); if(d<bd){ bd=d; best=o; } }
}
return best;
}

function findFoodTarget(a){
var cands=[];
for(var i=0;i<S.farms.length;i++){ var f=S.farms[i]; if(f.planted && f.growth>=1) cands.push({x:f.x,y:f.y,targetType:'farm',targetId:f.id,sub:'harvest'}); }
for(i=0;i<S.bushes.length;i++){ var b=S.bushes[i]; if(b.food>=1) cands.push({x:b.x,y:b.y,targetType:'bush',targetId:b.id}); }
if(S.market && S.market.stock.food>0 && a.coins>=CFG.foodPrice) cands.push({x:S.market.x,y:S.market.y,targetType:'market',targetId:S.market.id,sub:'buy'});
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
if(exp.materials.length&&!exp.materials.every(function(k){return Number(a.inv[k])>0;})){
exp.status='blocked';exp.result='I no longer have the materials for this attempt.';return false;
}
a.state='working';a.action={targetType:'experiment',experimentDay:exp.day,signature:signature(exp.operation,exp.materials),timer:rule?rule.duration:CFG.actionDurations.experiment,duration:rule?rule.duration:CFG.actionDurations.experiment};return true;
}
function beginKnownProcess(a,id){
var rule=lookupAffordance('shape',['wood']);
if(id!=='shape:wood'||!rule||!canPay(a.inv,rule.inputs))return false;
a.state='working';a.action={targetType:'process',recipeId:id,timer:rule.duration,duration:rule.duration};return true;
}
function primitiveWork(a){
var exp=pendingExperiment(a);if(exp&&beginExperiment(a,exp))return;
if(!a.home&&hasCapability(a,'shape:wood')&&constructionUnits(a)>=CFG.houseCost.total){goToBuildSpot(a,'house');return;}
if(hasCapability(a,'shape:wood')&&a.inv.wood>0&&a.inv.timber<3){if(beginKnownProcess(a,'shape:wood'))return;}
var target;
if(a.inv.food<2){target=nearestWithResource(S.bushes,'food',a);if(target){goTo(a,target.x,target.y,{targetType:'bush',targetId:target.id});return;}}
if((a.inv.wood||0)<5){target=nearestWithResource(S.trees,'wood',a);if(target){goTo(a,target.x,target.y,{targetType:'tree',targetId:target.id});return;}}
if((a.inv.stone||0)<3){target=nearestWithResource(S.rocks,'stone',a);if(target){goTo(a,target.x,target.y,{targetType:'rock',targetId:target.id});return;}}
wander(a);
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
t = nearestWithResource(S.trees,'wood',a);
if(t) goTo(a,t.x,t.y,{targetType:'tree',targetId:t.id}); else wander(a);
break;
case 'miner':
if(a.inv.stone>=10 && S.market){ goToMarketSell(a); return; }
r = nearestWithResource(S.rocks,'stone',a);
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
b = nearestWithResource(S.bushes,'food',a);
if(b) goTo(a,b.x,b.y,{targetType:'bush',targetId:b.id}); else wander(a);
break;
case 'trader':
if(!S.market){ wander(a); break; }
if(a.inv.food===0 && a.hunger>40 && a.coins>=CFG.foodPrice && S.market.stock.food>0){
goTo(a,S.market.x,S.market.y,{targetType:'market',targetId:S.market.id,sub:'buy'}); return;
}
if(a.inv.wood>0 || a.inv.stone>0 || a.inv.food>0){ goToMarketSell(a); return; }
t = nearestWithResource(S.trees,'wood',a);
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

if(a.hunger>=92){
if(a.inv.food>0){ a.state='working'; a.action={targetType:'self', sub:'eat', timer:CFG.actionDurations.eat, duration:CFG.actionDurations.eat}; return; }
var urgentTarget = findFoodTarget(a);
if(urgentTarget){ goTo(a,urgentTarget.x,urgentTarget.y,{targetType:urgentTarget.targetType,targetId:urgentTarget.targetId,sub:urgentTarget.sub}); return; }
}
if(a.energy<=10){
if(a.home){ var hh=getBuilding(a.home); if(hh){ if(dist(a,hh)<4){ a.state='resting'; a.action={home:true,timer:30}; } else { goTo(a,hh.x,hh.y,{home:true}); } return; } }
a.state='resting'; a.action={home:false,timer:18}; return;
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
if(a.inv.food>0){ a.state='working'; a.action={targetType:'self', sub:'eat', timer:CFG.actionDurations.eat, duration:CFG.actionDurations.eat}; return; }
var target = findFoodTarget(a);
if(target){ goTo(a,target.x,target.y,{targetType:target.targetType,targetId:target.targetId,sub:target.sub}); return; }
} else if(candidates[i]==='energy'){
if(a.home){
var h = getBuilding(a.home);
if(h){
if(dist(a,h)<4){ a.state='resting'; a.action={home:true,timer:30}; } else { goTo(a,h.x,h.y,{home:true}); }
return;
}
}
a.state='resting'; a.action={home:false,timer:18}; return;
} else if(candidates[i]==='social'){
var partner = findSocialPartner(a);
if(partner){ initiateSocialize(a,partner); return; }
}
}

var night = (S.time<0.16 || S.time>0.88);
if(night && a.home){
var h2 = getBuilding(a.home);
if(h2){
if(dist(a,h2)<4){ a.state='resting'; a.action={home:true,timer:10}; }
else { goTo(a,h2.x,h2.y,{home:true}); }
return;
}
}
if(!a.role){primitiveWork(a);return;}
roleWork(a);
}

function startWorkingOnArrival(a){
var p = a.pending; a.pending = null;
if(!p){ a.state='idle'; return; }
if(p.home){ a.state='resting'; a.action={home:true,timer:30}; return; }
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
case 'farm': return sub==='plant' ? CFG.actionDurations.plant : CFG.actionDurations.harvestFarm;
case 'market': return sub==='buy' ? CFG.actionDurations.buyFood : CFG.actionDurations.sellGoods;
case 'buildsite': return sub==='market' ? CFG.actionDurations.buildMarket : CFG.actionDurations.buildHouse;
case 'experiment': return CFG.actionDurations.experiment;
case 'process': return CFG.actionDurations.process;
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
else {for(i=0;i<exp.materials.length;i++)if(Number(a.inv[exp.materials[i]])>0)a.inv[exp.materials[i]]-=1;exp.physicalSuccess=false;}
exp.status='observed';exp.completedDay=S.day;
}
break;
case 'process':
var recipeRule=act.recipeId==='shape:wood'?lookupAffordance('shape',['wood']):null;
if(recipeRule&&hasCapability(a,act.recipeId)&&canPay(a.inv,recipeRule.inputs)){pay(a.inv,recipeRule.inputs);produce(a.inv,recipeRule.outputs);}
break;
case 'tree':
t = findById(S.trees, act.targetId);
if(t && t.wood>=1){ t.wood-=1; a.inv.wood+=1; }
break;
case 'rock':
r = findById(S.rocks, act.targetId);
if(r && r.stone>=1){ r.stone-=1; a.inv.stone+=1; }
break;
case 'bush':
b = findById(S.bushes, act.targetId);
if(b && b.food>=1){ b.food-=1; a.inv.food+=1; }
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
if(act.sub==='eat' && a.inv.food>0){ a.inv.food-=1; a.hunger=Math.max(0,a.hunger-45); }
break;
}
a.state='idle'; a.action=null;
}

function maybeBirth(a,partnerId){
if(S.agents.length>=CFG.maxPop) return;
if(S.birthCooldownTimer>0) return;
var other = findById(S.agents, partnerId);
if(!other) return;
if(!a.home && !other.home) return;
if(a.hunger>60 || other.hunger>60) return;
if(random()>CFG.birthChance) return;
var homeId = a.home || other.home || null;
var x = clamp((a.x+other.x)/2 + rand(-8,8), 12, CFG.W-12);
var y = clamp((a.y+other.y)/2 + rand(-8,8), 12, CFG.H-12);
var child = createAgent({x:x, y:y, role:null, age:0});
child.home = homeId;
S.agents.push(child);
S.birthCooldownTimer = CFG.birthCooldown;
log(a.name+' and '+other.name+' welcome a newborn, '+child.name+'.', 'birth');
}

function updateAgent(a,dt){
a.age += dt/(CFG.dayLength*360);
var busy = (a.state==='moving' || a.state==='working');
a.hunger = clamp(a.hunger + CFG.hungerRate*dt, 0, 100);
a.energy = clamp(a.energy - (busy?CFG.energyDecayWork:CFG.energyDecayIdle)*dt, 0, 100);
a.social = clamp(a.social - CFG.socialDecay*dt, 0, 100);
a.aiCooldown -= dt;

if(a.hunger>=99) a.starveTimer=(a.starveTimer||0)+dt; else a.starveTimer=0;
if(a.starveTimer>10){ a.dead=true; a.deathReason='hunger'; return; }
if(a.age>=a.lifespan){ a.dead=true; a.deathReason='old age'; return; }

if(a.state==='resting'){
var rate = a.action.home ? CFG.restHomeRate : CFG.restFieldRate;
a.energy = clamp(a.energy+rate*dt, 0, 100);
a.action.timer -= dt;
if(a.energy>=95 || a.action.timer<=0){ a.state='idle'; a.action=null; }
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
}
}
return;
}
if(a.state==='moving'){
moveTowards(a,dt);
if(arrived(a)){ a.x=a.tx; a.y=a.ty; startWorkingOnArrival(a); }
return;
}
if(a.state==='working'){
a.action.timer -= dt;
if(a.action.timer<=0){ completeWork(a); }
return;
}
decide(a);
}

function update(dt){
S.time += dt/CFG.dayLength;
if(S.time>=1){ S.time-=1; S.day++; }
var i;
for(i=0;i<S.trees.length;i++) S.trees[i].wood = Math.min(S.trees[i].max, S.trees[i].wood + CFG.regenRate*dt);
for(i=0;i<S.rocks.length;i++) S.rocks[i].stone = Math.min(S.rocks[i].max, S.rocks[i].stone + CFG.regenRate*0.6*dt);
for(i=0;i<S.bushes.length;i++) S.bushes[i].food = Math.min(S.bushes[i].max, S.bushes[i].food + CFG.regenRate*0.8*dt);
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
for(var savedAgent of S.agents){if(!savedAgent.inv)savedAgent.inv={wood:0,stone:0,food:0};if(!Number.isFinite(savedAgent.inv.timber))savedAgent.inv.timber=0;}
} else initWorld();
return { step: update, snapshot() { S.rng = rng; return structuredClone(S); }, drainAIRequests: drainAIRequests, applyAIResults: applyAIResults };
};
