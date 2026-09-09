(function(){
  "use strict";

  // Clivoria's canonical civilization still advances at roughly one world day per real day.
  // This viewer-only activity clock keeps villagers visually alive without accelerating
  // hunger, aging, crops, births, resources, buildings, or any server-side world state.
  var nativeFetch=window.fetch.bind(window);
  var visualAgents=new Map();
  var lastUpdate=nowMs();
  var VISUAL_MOVE_SPEED=4.2; // world units per real second: ~60 units in 14 seconds
  var MAX_FRAME_SECONDS=6;

  function nowMs(){ return (window.performance&&performance.now)?performance.now():Date.now(); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function finite(v){ return typeof v==='number'&&Number.isFinite(v); }
  function distance(x1,y1,x2,y2){ return Math.hypot(x2-x1,y2-y1); }
  function moveToward(p,tx,ty,amount){
    var dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy);
    if(d<=amount||d<.001){ p.x=tx;p.y=ty;return true; }
    p.x+=dx/d*amount;p.y+=dy/d*amount;return false;
  }
  function phaseFor(id){
    var n=Math.sin((Number(id)||1)*12.9898)*43758.5453;
    return (n-Math.floor(n))*Math.PI*2;
  }
  function ambientOffset(a,t){
    var phase=phaseFor(a.id),radius=0,speed=.2;
    if(a.state==='idle'){ radius=4.6;speed=.34; }
    else if(a.state==='working'){ radius=1.15;speed=.75; }
    else if(a.state==='socializing'){ radius=.9;speed=.5; }
    else if(a.state==='resting'){ radius=.22;speed=.18; }
    if(!radius) return {x:0,y:0};
    return {x:Math.cos(t*speed+phase)*radius,y:Math.sin(t*speed*.72+phase)*radius*.55};
  }
  function visualArrivalState(a){
    if(a.pending&&a.pending.home) return 'resting';
    if(a.pending&&a.pending.targetType) return 'working';
    return 'moving';
  }
  function workTarget(a,s){
    var lists={tree:s.trees||[],rock:s.rocks||[],farm:s.farms||[],bush:s.bushes||[],market:s.market?[s.market]:[]};
    var job=a.pending||a.action;
    if(job&&lists[job.targetType]){
      var exact=lists[job.targetType].find(function(v){return v.id===job.targetId;});
      if(exact)return {x:exact.x,y:exact.y,id:exact.id,kind:job.targetType};
      // Missing targets must not keep an obsolete routine alive.
      return null;
    }
    var kind={woodcutter:'tree',miner:'rock',farmer:'farm',trader:'market'}[a.role];
    var list=lists[kind]||[];
    var target=list.reduce(function(best,v){return !best||distance(a.x,a.y,v.x,v.y)<distance(a.x,a.y,best.x,best.y)?v:best;},null);
    return target?{x:target.x,y:target.y,id:target.id,kind:kind}:null;
  }
  function enhance(data){
    if(!data||!data.state||!Array.isArray(data.state.agents)) return data;
    var now=nowMs();
    var dt=clamp((now-lastUpdate)/1000,0,MAX_FRAME_SECONDS);
    lastUpdate=now;
    var t=now/1000,alive=new Set();

    data.state.agents.forEach(function(a){
      alive.add(a.id);
      var p=visualAgents.get(a.id);
      if(!p) p={x:a.x,y:a.y};

      // Compare canonical snapshots, not the visual proxy: a legitimate long trip
      // can be far from its slow server position without being a restore.
      if(p.canonicalX!==undefined&&distance(p.canonicalX,p.canonicalY,a.x,a.y)>120) p={x:a.x,y:a.y};
      p.canonicalX=a.x;p.canonicalY=a.y;
      var target=workTarget(a,data.state);
      var displayState=a.state;
      if(target&&!a.pending?.home&&a.state!=='resting'&&a.state!=='socializing'&&a.action?.targetType!=='self'){
        var key=target.kind+':'+target.id;
        if(p.key!==key){
          p.key=key;p.phase='outbound';p.timer=0;
          var home=(data.state.buildings||[]).find(function(b){return b.id===a.home;});
          var base=home||data.state.market||data.state.well||{x:a.x,y:a.y};
          p.base={x:base.x,y:base.y};
          if(distance(p.base.x,p.base.y,target.x,target.y)<16)
            p.base={x:clamp(target.x-40,8,472),y:clamp(target.y+24,8,296)};
        }
        // These are presentation phases only. Never complete work or grant inventory here.
        if(p.phase==='outbound'){
          displayState='moving';
          if(moveToward(p,target.x,target.y,VISUAL_MOVE_SPEED*dt)){p.phase='work';p.timer=10;displayState='working';}
        }else if(p.phase==='work'){
          displayState='working';p.timer-=dt;
          if(p.timer<=0){p.phase='return';displayState='moving';}
        }else if(p.phase==='return'){
          displayState='moving';
          if(moveToward(p,p.base.x,p.base.y,VISUAL_MOVE_SPEED*dt)){p.phase='pause';p.timer=5;displayState='idle';}
        }else{
          displayState='idle';p.timer-=dt;
          if(p.timer<=0)p.phase='outbound';
        }
        a.visualCarry=p.phase==='return'?target.kind:null;
        a.visualRoutine=p.phase;
      }else{
        p.key=null;p.phase=null;
        if(a.state==='moving'&&finite(a.tx)&&finite(a.ty)){
          if(moveToward(p,a.tx,a.ty,VISUAL_MOVE_SPEED*dt))displayState=visualArrivalState(a);
        }else moveToward(p,a.x,a.y,VISUAL_MOVE_SPEED*dt);
      }
      var off=p.key?{x:0,y:0}:ambientOffset({id:a.id,state:displayState},t);
      a.x=clamp(p.x+off.x,0,480);a.y=clamp(p.y+off.y,0,304);
      a.state=displayState;
      visualAgents.set(a.id,p);
    });

    visualAgents.forEach(function(_,id){ if(!alive.has(id)) visualAgents.delete(id); });
    return data;
  }
  function isTickRequest(input){
    var url=typeof input==='string'?input:(input&&input.url)||'';
    return /(?:^|\/)api\/tick(?:\?|$)/.test(url);
  }

  window.fetch=function(input,init){
    return nativeFetch(input,init).then(function(response){
      if(!isTickRequest(input)||!response||!response.ok) return response;
      return {
        ok:response.ok,
        status:response.status,
        statusText:response.statusText,
        headers:response.headers,
        url:response.url,
        redirected:response.redirected,
        type:response.type,
        json:function(){ return response.json().then(enhance); }
      };
    });
  };
})();
