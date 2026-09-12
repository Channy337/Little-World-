(function(){
  "use strict";

  var nativeFetch=window.fetch.bind(window);
  var visualAgents=new Map();
  var lastUpdate=nowMs();
  var VISUAL_MOVE_SPEED=4.2;
  var MAX_FRAME_SECONDS=6;
  function nowMs(){ return (window.performance&&performance.now)?performance.now():Date.now(); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function finite(v){ return typeof v==='number'&&Number.isFinite(v); }
  function distance(x1,y1,x2,y2){ return Math.hypot(x2-x1,y2-y1); }
  function boundsFor(s){var b=s&&s.worldBounds;return b&&finite(b.w)&&finite(b.h)?{w:b.w,h:b.h}:{w:480,h:304};}
  function moveToward(p,tx,ty,amount){ var dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy); if(d<=amount||d<.001){p.x=tx;p.y=ty;return true;} p.x+=dx/d*amount;p.y+=dy/d*amount;return false; }
  function phaseFor(id){ var n=Math.sin((Number(id)||1)*12.9898)*43758.5453; return (n-Math.floor(n))*Math.PI*2; }
  function weatherTravelFactor(s){
    var w=s&&s.weather||{},m=1,snow=Number(w.snowDepthCm)||0;
    if(snow>2)m*=clamp(1-snow*.018,.55,.96);
    if(w.hazard==='blizzard')m*=.55;
    else if(w.hazard==='flood')m*=.62;
    else if(w.hazard==='windstorm')m*=.8;
    if((w.windKph||0)>45)m*=.88;
    return clamp(m,.3,1);
  }
  function ambientOffset(a,t){ var phase=phaseFor(a.id),radius=0,speed=.2; if(a.state==='idle'){radius=4.6;speed=.34;} else if(a.state==='working'){radius=1.15;speed=.75;} else if(a.state==='socializing'){radius=.9;speed=.5;} else if(a.state==='resting'){radius=.22;speed=.18;} if(!radius)return{x:0,y:0}; return{x:Math.cos(t*speed+phase)*radius,y:Math.sin(t*speed*.72+phase)*radius*.55}; }
  function visualArrivalState(a){ if(a.pending&&a.pending.home)return'resting'; if(a.pending&&a.pending.targetType)return'working'; return'moving'; }
  function workTarget(a,s){
    var job=a.pending||a.action;
    if(job&&job.targetType==='buildsite'&&finite(a.tx)&&finite(a.ty)) return {x:a.tx,y:a.ty,id:'build-'+a.id,kind:'buildsite'};
    var lists={tree:s.trees||[],rock:s.rocks||[],farm:s.farms||[],bush:s.bushes||[],market:s.market?[s.market]:[]};
    if(job&&lists[job.targetType]){ var exact=lists[job.targetType].find(function(v){return v.id===job.targetId;}); if(exact)return{x:exact.x,y:exact.y,id:exact.id,kind:job.targetType}; return null; }
    var kind={woodcutter:'tree',miner:'rock',farmer:'farm',trader:'market'}[a.role],list=lists[kind]||[];
    var target=list.reduce(function(best,v){return !best||distance(a.x,a.y,v.x,v.y)<distance(a.x,a.y,best.x,best.y)?v:best;},null);
    return target?{x:target.x,y:target.y,id:target.id,kind:kind}:null;
  }
  function enhance(data){
    if(!data||!data.state||!Array.isArray(data.state.agents)) return data;
    var now=nowMs(),dt=clamp((now-lastUpdate)/1000,0,MAX_FRAME_SECONDS);lastUpdate=now;var t=now/1000,alive=new Set(),world=boundsFor(data.state),moveSpeed=VISUAL_MOVE_SPEED*weatherTravelFactor(data.state);
    data.state.agents.forEach(function(a){
      alive.add(a.id);var p=visualAgents.get(a.id);if(!p)p={x:a.x,y:a.y};
      if(p.canonicalX!==undefined&&distance(p.canonicalX,p.canonicalY,a.x,a.y)>Math.max(120,world.w*.3))p={x:a.x,y:a.y};p.canonicalX=a.x;p.canonicalY=a.y;
      var target=workTarget(a,data.state),displayState=a.state;
      if(target&&!a.pending?.home&&a.state!=='resting'&&a.state!=='socializing'&&a.action?.targetType!=='self'){
        var key=target.kind+':'+target.id;
        if(p.key!==key){p.key=key;p.phase='outbound';p.timer=0;var home=(data.state.buildings||[]).find(function(b){return b.id===a.home;});var base=home||data.state.market||data.state.well||{x:a.x,y:a.y};p.base={x:base.x,y:base.y};if(distance(p.base.x,p.base.y,target.x,target.y)<16)p.base={x:clamp(target.x-40,8,world.w-8),y:clamp(target.y+24,8,world.h-8)};}
        if(p.phase==='outbound'){displayState='moving';if(moveToward(p,target.x,target.y,moveSpeed*dt)){p.phase='work';p.timer=10;displayState='working';}}
        else if(p.phase==='work'){displayState='working';p.timer-=dt;if(p.timer<=0){p.phase='return';displayState='moving';}}
        else if(p.phase==='return'){displayState='moving';if(moveToward(p,p.base.x,p.base.y,moveSpeed*dt)){p.phase='pause';p.timer=5;displayState='idle';}}
        else{displayState='idle';p.timer-=dt;if(p.timer<=0)p.phase='outbound';}
        a.visualCarry=p.phase==='return'&&target.kind!=='buildsite'?target.kind:null;a.visualRoutine=p.phase;
      }else{p.key=null;p.phase=null;if(a.state==='moving'&&finite(a.tx)&&finite(a.ty)){if(moveToward(p,a.tx,a.ty,moveSpeed*dt))displayState=visualArrivalState(a);}else moveToward(p,a.x,a.y,moveSpeed*dt);}
      var off=p.key?{x:0,y:0}:ambientOffset({id:a.id,state:displayState},t);a.x=clamp(p.x+off.x,0,world.w);a.y=clamp(p.y+off.y,0,world.h);a.state=displayState;visualAgents.set(a.id,p);
    });
    visualAgents.forEach(function(_,id){if(!alive.has(id))visualAgents.delete(id);});return data;
  }
  function isTickRequest(input){var url=typeof input==='string'?input:(input&&input.url)||'';return /(?:^|\/)api\/tick(?:\?|$)/.test(url);}
  window.fetch=function(input,init){return nativeFetch(input,init).then(function(response){if(!isTickRequest(input)||!response||!response.ok)return response;return{ok:response.ok,status:response.status,statusText:response.statusText,headers:response.headers,url:response.url,redirected:response.redirected,type:response.type,json:function(){return response.json().then(enhance);}};});};
})();
