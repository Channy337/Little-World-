(function(){
  "use strict";

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
      buildHouse:4.0, buildMarket:6.0, sellGoods:1.0, buyFood:1.0, eat:0.6, socialize:3.0
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

  // A small curated set of real, whimsical "international day" observances,
  // keyed "M-D". Purely decorative context fed to the AI — no external API needed.
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
    // Northern-hemisphere approximation
    if(m===11||m===0||m===1) return 'winter';
    if(m>=2&&m<=4) return 'spring';
    if(m>=5&&m<=7) return 'summer';
    return 'autumn';
  }
  function moonPhaseName(date){
    var synodic = 29.530588853;
    var known = Date.UTC(2000,0,6,18,14,0)/1000; // a known new moon
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

  var S = {};
  var canvas, ctx;

  function rand(a,b){ return a + Math.random()*(b-a); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function dist(a,b){ var dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }
  function findById(list,id){ for(var i=0;i<list.length;i++) if(list[i].id===id) return list[i]; return null; }
  function pickName(){ return NAMES[Math.floor(Math.random()*NAMES.length)]; }

  // ---------- AI layer ----------
  // Every call is fire-and-forget from the simulation's point of view: if the
  // backend isn't deployed yet, is slow, or errors out, these just resolve to
  // null and the tested rule-based behavior carries on exactly as before.
  function askAI(kind, context){
    if(typeof fetch==='undefined') return Promise.resolve(null);
    return fetch('/api/decide', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({kind:kind, context:context})
    }).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(res){
        if(res && !S.aiEverConnected){ S.aiEverConnected = true; log('The village grows a mind of its own.', 'info'); }
        return res;
      })
      .catch(function(){ return null; });
  }

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
    var ctx = {
      name:a.name, trait:a.trait, role:a.role||'undecided',
      hunger:Math.round(a.hunger), energy:Math.round(a.energy), social:Math.round(a.social),
      food:a.inv.food, wood:a.inv.wood, stone:a.inv.stone, coins:a.coins, hasHome:!!a.home,
      day:S.day, timeOfDay:timeOfDayLabel(S.time),
      nearby:nearbyDescription(a), recent:recentMemoryFor(a.name),
      world:realWorldContext()
    };
    askAI('priority', ctx).then(function(res){
      a.aiPending = false;
      if(res && res.focus){ a.aiFocus = res.focus; }
      if(res && res.thought){ a.aiThought = res.thought; }
    });
  }

  function requestChatLine(a, other){
    var ctx = {
      a:{name:a.name, role:a.role||'undecided', trait:a.trait},
      b:{name:other.name, role:other.role||'undecided', trait:other.trait},
      day:S.day, world:realWorldContext()
    };
    askAI('chat', ctx).then(function(res){
      if(res && res.line && a.action && a.action.partnerId===other.id){
        a.action.chatLine = res.line;
      }
    });
  }

  function requestRoleThought(a){
    var ctx = { name:a.name, trait:a.trait, role:a.role, day:S.day };
    askAI('role', ctx).then(function(res){
      if(res && res.thought) log('\u201c'+res.thought+'\u201d \u2014 '+a.name, 'social');
    });
  }

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
      inv:{wood:0, stone:0, food: opts.age===0?0:Math.floor(rand(0,2))},
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
    for(var r=0;r<3;r++) for(var c=0;c<3;c++) S.farms.push({id:S.nextId++, x:150+c*55, y:26+r*36, planted:false, growth:0});
    for(i=0;i<6;i++) S.bushes.push({id:S.nextId++, x:rand(140,320), y:rand(150,232), food:3, max:3});

    for(i=0;i<CFG.initialPop;i++){
      S.agents.push(createAgent({
        x: clamp(230+rand(-40,40), 20, CFG.W-20),
        y: clamp(150+rand(-30,30), 20, CFG.H-20)
      }));
    }
    log('A handful of wanderers settle by the river bend.', 'info');
  }

  // ---------- movement helpers ----------
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
    if(S.market && Math.random()<0.25) choices.push('trader');
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

    // hard safety floors: no AI hiccup should ever actually starve or collapse a villager
    if(a.hunger>=92){
      if(a.inv.food>0){ a.state='working'; a.action={targetType:'self', sub:'eat', timer:CFG.actionDurations.eat, duration:CFG.actionDurations.eat}; return; }
      var urgentTarget = findFoodTarget(a);
      if(urgentTarget){ goTo(a,urgentTarget.x,urgentTarget.y,{targetType:urgentTarget.targetType,targetId:urgentTarget.targetId,sub:urgentTarget.sub}); return; }
    }
    if(a.energy<=10){
      if(a.home){ var hh=getBuilding(a.home); if(hh){ if(dist(a,hh)<4){ a.state='resting'; a.action={home:true,timer:30}; } else { goTo(a,hh.x,hh.y,{home:true}); } return; } }
      a.state='resting'; a.action={home:false,timer:18}; return;
    }

    // soft needs: order can be nudged by the AI's suggested focus
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
    var isNewRole = !a.role;
    if(isNewRole){ assignRole(a); }
    if(isNewRole && Math.random()<0.5){ requestRoleThought(a); }
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
      default: return 1.5;
    }
  }

  function completeWork(a){
    var act = a.action, t,r,b,f,m,i,res,keep,surplus,amt,price;
    switch(act.targetType){
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
          if(!a.home && (a.inv.wood+a.inv.stone)>=CFG.houseCost.total){
            spendMaterials(a, CFG.houseCost.total);
            var house = createBuilding('house', a.x, a.y, a.id);
            a.home = house.id;
            log(a.name+' builds a home.', 'build');
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
    if(!a.role || !other.role) return;
    if(a.hunger>60 || other.hunger>60) return;
    if(Math.random()>CFG.birthChance) return;
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
    a.age += dt/CFG.dayLength;
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
          else if(Math.random()<0.35){ log(pick(CHAT_LINES)(a.name,pname), 'social'); }
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

  // ---------- rendering ----------
  function hexToRgb(h){ h=h.replace('#',''); return {r:parseInt(h.substr(0,2),16), g:parseInt(h.substr(2,2),16), b:parseInt(h.substr(4,2),16)}; }
  function lerpColor(c1,c2,t){
    var a=hexToRgb(c1), b=hexToRgb(c2);
    var r=Math.round(a.r+(b.r-a.r)*t), g=Math.round(a.g+(b.g-a.g)*t), bl=Math.round(a.b+(b.b-a.b)*t);
    return 'rgb('+r+','+g+','+bl+')';
  }
  function roleColor(role){
    return {woodcutter:'#c99a5b', farmer:'#8fcf6e', miner:'#b7c0c6', trader:'#f0c25a'}[role] || '#d8dfd2';
  }
  function roleHat(role){
    return {woodcutter:'#6b4a2f', farmer:'#e8cf4a', miner:'#8b96a0', trader:'#4a72a8'}[role] || '#5a4a3a';
  }

  // ---------- pixel villager sprite ----------
  // 8 wide x 10 tall grid, drawn as blocky pixels at PX scale.
  var PX = 3;
  var PALETTE_BASE = { k:'#e8b98a', e:'#2a2015', p:'#3b3b46', b:'#241f1a' };

  function drawVillagerSprite(a, sx, sy, walkFrame){
    var rows = [
      "  hhhh  ",
      " hkkkkh ",
      " kekkek ",
      " kkkkkk ",
      " cccccc ",
      " cccccc ",
      " cccccc ",
      " pppppp ",
      " pppppp ",
      (walkFrame===1) ? "bb    bb" : " bb  bb "
    ];
    var shirt = roleColor(a.role), hair = a.role ? roleHat(a.role) : '#7a6a58';
    var pal = { h:hair, k:PALETTE_BASE.k, e:PALETTE_BASE.e, c:shirt, p:PALETTE_BASE.p, b:PALETTE_BASE.b };
    for(var ry=0; ry<rows.length; ry++){
      var row = rows[ry];
      for(var rx=0; rx<row.length; rx++){
        var ch = row[rx];
        if(ch===' ') continue;
        ctx.fillStyle = pal[ch];
        ctx.fillRect(Math.round(sx+rx*PX), Math.round(sy+ry*PX), PX, PX);
      }
    }
  }

  function drawAgent(a, tNow){
    a._bobPhase = a._bobPhase || Math.random()*10;
    var moving = a.state==='moving';
    var working = a.state==='working';
    var bobAmp = moving ? 1.4 : (working ? 1.1 : 0.6);
    var bobSpeed = moving ? 9 : (working ? 12 : 3);
    var bob = Math.sin(tNow*bobSpeed + a._bobPhase) * bobAmp;
    var walkFrame = (moving && Math.floor(tNow*8 + a._bobPhase) % 2 === 0) ? 1 : 0;

    var spriteW = 8*PX, spriteH = 10*PX;
    var sx = a.x - spriteW/2;
    var sy = a.y - spriteH + 4 - bob;

    // shadow
    ctx.fillStyle = 'rgba(10,14,10,0.35)';
    ctx.beginPath(); ctx.ellipse(a.x, a.y+3, spriteW*0.34, 2.6, 0, 0, Math.PI*2); ctx.fill();

    drawVillagerSprite(a, sx, sy, walkFrame);

    // work tool flick
    if(working){
      var swing = Math.sin(tNow*10)*3;
      ctx.fillStyle = '#cfd6c9';
      ctx.fillRect(Math.round(a.x + spriteW*0.32), Math.round(sy + spriteH*0.45 + swing), PX, PX*2);
    }

    // selection marker: bouncing pixel arrow
    if(a.id===S.selectedId){
      var ay = sy - 8 + Math.sin(tNow*5)*2;
      ctx.fillStyle = '#f4efe0';
      ctx.beginPath();
      ctx.moveTo(a.x, ay+6); ctx.lineTo(a.x-4, ay); ctx.lineTo(a.x+4, ay);
      ctx.closePath(); ctx.fill();
    }

    // status bubble
    var icon=null, iconColor='#f4efe0';
    if(a.state==='resting'){ icon='z'; }
    else if(a.state==='socializing'){ icon='\u2665'; iconColor='#f2a9b0'; }
    else if(a.hunger>=72){ icon='!'; iconColor='#f0c25a'; }
    if(icon){
      var by = sy - 6 + Math.sin(tNow*3 + a._bobPhase)*2;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign='center';
      ctx.fillStyle=iconColor;
      ctx.fillText(icon, a.x, by);
    }
  }

  // ---------- scenery ----------
  function drawGround(){
    var shades = ['#3a5233','#3f5837','#365030'];
    for(var gy=0; gy<CFG.rows; gy++){
      for(var gx=0; gx<CFG.cols; gx++){
        ctx.fillStyle = shades[S.groundTiles[gy][gx]];
        ctx.fillRect(gx*TILE, gy*TILE, TILE, TILE);
      }
    }
  }
  function drawZones(){
    ctx.fillStyle='rgba(60,70,50,0.18)'; ctx.fillRect(325,8,152,292);
    ctx.fillStyle='rgba(120,120,120,0.16)'; ctx.fillRect(6,185,122,107);
    ctx.fillStyle='rgba(150,170,90,0.14)'; ctx.fillRect(138,12,196,98);
  }
  function drawPond(tNow){
    var p = S.pond;
    var shimmer = 0.5 + 0.5*Math.sin(tNow*1.3);
    ctx.fillStyle = lerpColor('#2c5a68','#3a7385', shimmer);
    ctx.fillRect(p.x-p.w/2, p.y-p.h/2, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(p.x-p.w/2+6, p.y-p.h/2+4, p.w*0.28, 3);
    // reeds
    ctx.fillStyle='#4c6b3c';
    for(var i=0;i<5;i++){
      var rx = p.x - p.w/2 - 4 + i*3;
      ctx.fillRect(rx, p.y+p.h/2-6, 2, 10);
    }
  }
  function drawWell(){
    var w = S.well;
    ctx.fillStyle='rgba(10,14,10,0.3)'; ctx.beginPath(); ctx.ellipse(w.x,w.y+9,12,3,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#8b8378'; ctx.fillRect(w.x-9,w.y-4,18,10);
    ctx.fillStyle='#6b645a'; ctx.fillRect(w.x-9,w.y-4,18,3);
    ctx.fillStyle='#4a4038'; ctx.fillRect(w.x-11,w.y-12,4,10); ctx.fillRect(w.x+7,w.y-12,4,10);
    ctx.fillStyle='#6b4a2f'; ctx.fillRect(w.x-12,w.y-14,26,3);
  }
  function drawFarm(f){
    ctx.fillStyle = f.planted ? lerpColor('#5b4630','#6fb654',f.growth) : '#5b4630';
    ctx.fillRect(f.x-14, f.y-9, 28, 18);
    ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=1;
    for(var row=0; row<3; row++){ ctx.beginPath(); ctx.moveTo(f.x-14,f.y-9+row*6); ctx.lineTo(f.x+14,f.y-9+row*6); ctx.stroke(); }
    if(f.planted && f.growth>=1){
      ctx.fillStyle='#e8c94a';
      ctx.fillRect(f.x-3,f.y-14,3,6); ctx.fillRect(f.x+2,f.y-13,3,6);
    }
  }
  function drawBush(b){
    ctx.fillStyle='#3f5c33';
    ctx.beginPath(); ctx.arc(b.x,b.y,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#547a45';
    ctx.beginPath(); ctx.arc(b.x-2,b.y-2,4,0,Math.PI*2); ctx.fill();
    for(var k=0;k<b.food;k++){ ctx.fillStyle='#d1584f'; ctx.fillRect(b.x-4+k*4, b.y-2, 2, 2); }
  }
  function drawRock(r){
    var s=6+(r.stone/r.max)*5;
    ctx.fillStyle='rgba(10,14,10,0.3)'; ctx.beginPath(); ctx.ellipse(r.x,r.y+s*0.6,s*0.9,2.4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#9aa0a6';
    ctx.beginPath(); ctx.moveTo(r.x-s,r.y+s*0.6); ctx.lineTo(r.x-s*0.3,r.y-s); ctx.lineTo(r.x+s*0.5,r.y-s*0.5); ctx.lineTo(r.x+s,r.y+s*0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#c3c8cc';
    ctx.beginPath(); ctx.moveTo(r.x-s*0.3,r.y-s); ctx.lineTo(r.x,r.y-s*0.3); ctx.lineTo(r.x-s*0.6,r.y-s*0.1); ctx.closePath(); ctx.fill();
  }
  function drawTree(t){
    var sz=6+(t.wood/t.max)*6;
    ctx.fillStyle='rgba(10,14,10,0.3)'; ctx.beginPath(); ctx.ellipse(t.x,t.y+11,sz*0.7,2.4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#5c4128'; ctx.fillRect(t.x-2,t.y,4,11);
    ctx.fillStyle='#345a2f';
    ctx.beginPath(); ctx.arc(t.x, t.y-sz*0.6, sz, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#4a7a3f';
    ctx.beginPath(); ctx.arc(t.x-sz*0.3, t.y-sz*0.9, sz*0.65, 0, Math.PI*2); ctx.fill();
  }
  function drawHouse(b, tNow){
    ctx.fillStyle='rgba(10,14,10,0.32)'; ctx.beginPath(); ctx.ellipse(b.x,b.y+7,13,3,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#c98a4b'; ctx.fillRect(b.x-10,b.y-6,20,13);
    ctx.fillStyle='#a8703a'; ctx.fillRect(b.x-10,b.y+3,20,4);
    ctx.fillStyle='#5c3a22'; ctx.fillRect(b.x-3,b.y,6,7);
    ctx.fillStyle='#dce8e0'; ctx.fillRect(b.x+3,b.y-3,4,4);
    ctx.fillStyle='#7a3f2c';
    ctx.beginPath(); ctx.moveTo(b.x-12,b.y-6); ctx.lineTo(b.x,b.y-16); ctx.lineTo(b.x+12,b.y-6); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#5c2e20'; ctx.fillRect(b.x+5,b.y-20,3,7);
    var puff = (Math.sin(tNow*1.4)+1)/2;
    ctx.fillStyle='rgba(230,230,225,'+(0.25+puff*0.2)+')';
    ctx.beginPath(); ctx.arc(b.x+6, b.y-22-puff*4, 2+puff*1.5, 0, Math.PI*2); ctx.fill();
  }
  function drawMarket(b, tNow){
    ctx.fillStyle='rgba(10,14,10,0.32)'; ctx.beginPath(); ctx.ellipse(b.x,b.y+9,20,3.5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#8b6a4a'; ctx.fillRect(b.x-16,b.y-2,32,10);
    for(var i=0;i<4;i++){ ctx.fillStyle= i%2? '#d9a441':'#c96a4f'; ctx.fillRect(b.x-16+i*8,b.y-10,8,8); }
    ctx.fillStyle='#5c4636'; ctx.fillRect(b.x-16,b.y-12,3,22); ctx.fillRect(b.x+13,b.y-12,3,22);
    var flutter = Math.sin(tNow*2.2)*2;
    ctx.fillStyle='#e0725a';
    ctx.beginPath(); ctx.moveTo(b.x,b.y-24); ctx.lineTo(b.x+8+flutter,b.y-20); ctx.lineTo(b.x,b.y-16); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#4a3626'; ctx.fillRect(b.x-1,b.y-24,2,12);
  }

  var NIGHT_TINT='#0d1a2e', DUSK_TINT='#3a2a40';
  function draw(){
    var tNow = performance.now()/1000;
    drawGround();
    drawZones();
    drawPond(tNow);

    var i,f,b,r,t,a,bd;
    for(i=0;i<S.farms.length;i++) drawFarm(S.farms[i]);
    drawWell();
    for(i=0;i<S.bushes.length;i++) drawBush(S.bushes[i]);
    for(i=0;i<S.rocks.length;i++) drawRock(S.rocks[i]);
    for(i=0;i<S.trees.length;i++) drawTree(S.trees[i]);
    for(i=0;i<S.buildings.length;i++){
      bd=S.buildings[i];
      if(bd.type==='house') drawHouse(bd, tNow); else drawMarket(bd, tNow);
    }
    // sort agents by y so ones lower on screen draw on top (simple depth)
    var sorted = S.agents.slice().sort(function(p,q){ return p.y-q.y; });
    for(i=0;i<sorted.length;i++) drawAgent(sorted[i], tNow);

    // day/night lighting overlay
    var bright = Math.max(0, Math.sin(S.time*Math.PI));
    var nightAlpha = Math.max(0, 0.55 - bright*0.62);
    if(nightAlpha>0){
      ctx.fillStyle = 'rgba(13,26,46,'+nightAlpha.toFixed(2)+')';
      ctx.fillRect(0,0,CFG.W,CFG.H);
    }
    var duskFactor = Math.max(0, 1 - Math.abs(bright-0.35)*2.4) * (S.time<0.5?1:0.6);
    if(duskFactor>0.02){
      ctx.fillStyle = 'rgba(214,120,70,'+(duskFactor*0.14).toFixed(2)+')';
      ctx.fillRect(0,0,CFG.W,CFG.H);
    }
  }

  // ---------- HUD ----------
  function escapeHtml(s){ return s.replace(/[&<>]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }
  function bar(label,val){
    var v=Math.max(0,Math.min(100,Math.round(val)));
    return '<div class="ac-bar-row"><span>'+label+'</span><div class="ac-bar"><div class="ac-bar-fill" style="width:'+v+'%"></div></div></div>';
  }
  function roleTitle(role){ return role.charAt(0).toUpperCase()+role.slice(1); }

  var dayVal, popVal, houseVal, marketVal, moodVal, logList, agentCard, clockLabel;

  function timeOfDayLabel(t){
    if(t<0.16) return 'Night';
    if(t<0.30) return 'Dawn';
    if(t<0.47) return 'Morning';
    if(t<0.56) return 'Noon';
    if(t<0.75) return 'Afternoon';
    if(t<0.88) return 'Dusk';
    return 'Night';
  }

  function updateHUD(){
    clockLabel.textContent = 'Day '+S.day+' \u00b7 '+timeOfDayLabel(S.time);
    dayVal.textContent = S.day;
    popVal.textContent = S.agents.length;
    var houses=0; for(var i=0;i<S.buildings.length;i++) if(S.buildings[i].type==='house') houses++;
    houseVal.textContent = houses;
    marketVal.textContent = S.market ? 'Open' : 'Not yet';

    var avgH=0,avgE=0,avgS=0,n=Math.max(1,S.agents.length);
    for(i=0;i<S.agents.length;i++){ avgH+=S.agents[i].hunger; avgE+=S.agents[i].energy; avgS+=S.agents[i].social; }
    var mood = Math.round(((100-avgH/n)+(avgE/n)+(avgS/n))/3);
    moodVal.textContent = S.agents.length ? mood+'%' : '--';

    var html='';
    for(i=0;i<S.log.length;i++){ html += '<li class="log-'+S.log[i].type+'">'+escapeHtml(S.log[i].msg)+'</li>'; }
    logList.innerHTML = html;

    if(S.selectedId!=null){
      var a = findById(S.agents, S.selectedId);
      if(a){
        agentCard.classList.remove('hidden');
        agentCard.innerHTML =
          '<div class="ac-name pixel">'+escapeHtml(a.name)+'</div>'+
          '<div class="ac-role">'+(a.role?roleTitle(a.role):'Newcomer')+' &middot; '+escapeHtml(a.trait)+' &middot; day '+Math.floor(a.age)+' of life</div>'+
          (a.aiThought ? '<div class="ac-thought">\u201c'+escapeHtml(a.aiThought)+'\u201d</div>' : '')+
          '<div class="ac-bars">'+bar('Hunger',100-a.hunger)+bar('Energy',a.energy)+bar('Social',a.social)+'</div>'+
          '<div class="ac-inv">Wood '+a.inv.wood+' &middot; Stone '+a.inv.stone+' &middot; Food '+a.inv.food+' &middot; Coins '+a.coins+'</div>'+
          '<div class="ac-home">'+(a.home?'Has a home':'No home yet')+'</div>';
      } else {
        S.selectedId = null; agentCard.classList.add('hidden');
      }
    } else {
      agentCard.classList.add('hidden');
    }
  }

  // ---------- input ----------
  function getWorldPos(evt){
    var rect = canvas.getBoundingClientRect();
    var cx = (evt.touches && evt.touches.length) ? evt.touches[0].clientX : evt.clientX;
    var cy = (evt.touches && evt.touches.length) ? evt.touches[0].clientY : evt.clientY;
    var scaleX = CFG.W/rect.width, scaleY = CFG.H/rect.height;
    return {x:(cx-rect.left)*scaleX, y:(cy-rect.top)*scaleY};
  }

  function wireUI(){
    dayVal=document.getElementById('dayVal');
    popVal=document.getElementById('popVal');
    houseVal=document.getElementById('houseVal');
    marketVal=document.getElementById('marketVal');
    moodVal=document.getElementById('moodVal');
    logList=document.getElementById('logList');
    agentCard=document.getElementById('agentCard');
    clockLabel=document.getElementById('clockLabel');

    canvas.addEventListener('click', function(e){
      var p = getWorldPos(e);
      var best=null, bd=14;
      for(var i=0;i<S.agents.length;i++){
        var a=S.agents[i], d=Math.hypot(a.x-p.x,a.y-p.y);
        if(d<bd){ bd=d; best=a; }
      }
      S.selectedId = best ? best.id : null;
    });

    var spdBtns = document.querySelectorAll('.spdBtn');
    spdBtns.forEach(function(btn){
      btn.addEventListener('click', function(){
        S.speed = parseFloat(btn.getAttribute('data-speed'));
        spdBtns.forEach(function(b){ b.classList.toggle('active', b===btn); });
      });
    });
    document.getElementById('resetBtn').addEventListener('click', function(){
      initWorld();
      syncSpeedButtons();
      saveState();
    });

    var shareBtn = document.getElementById('shareBtn');
    if(shareBtn) shareBtn.addEventListener('click', shareVillage);

    var momentBtn = document.getElementById('momentBtn');
    if(momentBtn) momentBtn.addEventListener('click', shareMoment);
    var momentClose = document.getElementById('momentClose');
    if(momentClose) momentClose.addEventListener('click', function(){
      document.getElementById('momentOverlay').classList.remove('show');
    });
    var momentDownload = document.getElementById('momentDownload');
    if(momentDownload) momentDownload.addEventListener('click', downloadMoment);
  }

  function pickMomentEntry(){
    if(!S.chronicle || !S.chronicle.length) return null;
    var preferred = ['birth','market','build','social'];
    for(var p=0;p<preferred.length;p++){
      for(var i=S.chronicle.length-1;i>=0;i--){
        if(S.chronicle[i].type===preferred[p]) return S.chronicle[i];
      }
    }
    return S.chronicle[S.chronicle.length-1];
  }

  function buildMomentCard(){
    var moment = pickMomentEntry();
    var cardW = 480, sceneH = CFG.H, textH = 150;
    var card = document.createElement('canvas');
    card.width = cardW; card.height = sceneH + textH;
    var cctx = card.getContext('2d');

    cctx.fillStyle = '#161f19';
    cctx.fillRect(0,0,cardW, sceneH+textH);
    cctx.drawImage(canvas, 0, 0, cardW, sceneH);

    cctx.fillStyle = '#1b2620';
    cctx.fillRect(0, sceneH, cardW, textH);
    cctx.fillStyle = '#e8b23d';
    cctx.font = '13px monospace';
    cctx.textAlign = 'left';
    cctx.fillText('A LITTLE WORLD', 16, sceneH+28);
    cctx.fillStyle = '#9fae9c';
    cctx.font = '12px monospace';
    var houses=0; for(var i=0;i<S.buildings.length;i++) if(S.buildings[i].type==='house') houses++;
    cctx.fillText('Day '+S.day+'  \u00b7  '+S.agents.length+' villagers  \u00b7  '+houses+' homes'+(S.market?'  \u00b7  market open':''), 16, sceneH+48);

    cctx.fillStyle = '#eef1ea';
    cctx.font = 'italic 14px Georgia, serif';
    var quote = moment ? moment.msg : 'A quiet day in the village.';
    wrapText(cctx, '\u201c'+quote+'\u201d', 16, sceneH+78, cardW-32, 20);

    return card;
  }

  function wrapText(cctx, text, x, y, maxWidth, lineHeight){
    var words = text.split(' '), line = '', lines=[];
    for(var i=0;i<words.length;i++){
      var test = line + words[i] + ' ';
      if(cctx.measureText(test).width > maxWidth && line){ lines.push(line); line = words[i]+' '; }
      else { line = test; }
    }
    lines.push(line);
    lines = lines.slice(0,3);
    for(i=0;i<lines.length;i++) cctx.fillText(lines[i].trim(), x, y + i*lineHeight);
  }

  function shareMoment(){
    var card;
    try{ card = buildMomentCard(); }catch(e){ showToast('Could not build a share card right now.'); return; }
    var dataUrl = card.toDataURL('image/png');

    var overlay = document.getElementById('momentOverlay');
    var img = document.getElementById('momentImg');
    if(overlay && img){
      img.src = dataUrl;
      overlay.classList.add('show');
    }

    card.toBlob(function(blob){
      if(!blob) return;
      var file = new File([blob], 'a-little-world-day'+S.day+'.png', {type:'image/png'});
      if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
        var shareBtn2 = document.getElementById('momentShareNow');
        if(shareBtn2){
          shareBtn2.onclick = function(){
            navigator.share({files:[file], title:'A Little World', text:'Day '+S.day+' in my village.'}).catch(function(){});
          };
        }
      }
    });
  }

  function downloadMoment(){
    var img = document.getElementById('momentImg');
    if(!img || !img.src) return;
    var a = document.createElement('a');
    a.href = img.src; a.download = 'a-little-world-day'+S.day+'.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  function showToast(msg){
    var t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._h);
    showToast._h = setTimeout(function(){ t.classList.remove('show'); }, 2600);
  }

  function shareVillage(){
    var url = location.href.split('#')[0];
    var houses=0; for(var i=0;i<S.buildings.length;i++) if(S.buildings[i].type==='house') houses++;
    var text = 'My little village is on day '+S.day+' with '+S.agents.length+' villagers and '+houses+' homes built. Come watch it grow:';
    if(navigator.share){
      navigator.share({title:'A Little World', text:text, url:url}).catch(function(){});
    } else if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(function(){ showToast('Link copied to clipboard!'); })
        .catch(function(){ showToast('Copy this page\u2019s address to share it.'); });
    } else {
      showToast('Copy this page\u2019s address to share it.');
    }
  }

  function syncSpeedButtons(){
    var spdBtns = document.querySelectorAll('.spdBtn');
    spdBtns.forEach(function(b){
      b.classList.toggle('active', parseFloat(b.getAttribute('data-speed'))===S.speed);
    });
  }

  // ---------- persistence ----------
  // Uses Claude's artifact storage when available (previewing inside claude.ai),
  // otherwise falls back to plain localStorage so a real hosted copy of this
  // site still remembers your village between visits.
  var storageBackend = (function(){
    if(typeof window!=='undefined' && window.storage) return 'claude';
    try{
      if(typeof localStorage!=='undefined'){
        var k='__lw_test__'; localStorage.setItem(k,'1'); localStorage.removeItem(k);
        return 'local';
      }
    }catch(e){}
    return null;
  })();

  function saveState(){
    if(storageBackend==='claude'){
      try{ window.storage.set('villageState', JSON.stringify(S), false).catch(function(){}); }catch(e){}
    } else if(storageBackend==='local'){
      try{ localStorage.setItem('villageState', JSON.stringify(S)); }catch(e){}
    }
  }
  function tryRestore(){
    if(storageBackend==='claude'){
      return window.storage.get('villageState', false).then(function(res){
        if(!res || !res.value) return false;
        var saved = JSON.parse(res.value);
        if(!saved || !saved.agents || !saved.trees) return false;
        Object.assign(S, saved);
        return true;
      }).catch(function(){ return false; });
    }
    if(storageBackend==='local'){
      try{
        var raw = localStorage.getItem('villageState');
        if(!raw) return Promise.resolve(false);
        var saved = JSON.parse(raw);
        if(!saved || !saved.agents || !saved.trees) return Promise.resolve(false);
        Object.assign(S, saved);
        return Promise.resolve(true);
      }catch(e){ return Promise.resolve(false); }
    }
    return Promise.resolve(false);
  }

  // ---------- main loop ----------
  var lastT=null, hudAcc=0, saveAcc=0;
  function frame(ts){
    if(lastT==null) lastT=ts;
    var raw = (ts-lastT)/1000; lastT=ts;
    raw = Math.min(raw, 0.1);
    if(S.speed>0){ update(raw*S.speed); }
    draw();
    hudAcc += raw;
    if(hudAcc>0.15){ hudAcc=0; updateHUD(); }
    saveAcc += raw;
    if(saveAcc>5){ saveAcc=0; saveState(); }
    requestAnimationFrame(frame);
  }

  function boot(){
    canvas = document.getElementById('world');
    canvas.width = CFG.W; canvas.height = CFG.H;
    ctx = canvas.getContext('2d');
    wireUI();
    tryRestore().then(function(restored){
      if(!restored) initWorld();
      syncSpeedButtons();
      requestAnimationFrame(frame);
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
