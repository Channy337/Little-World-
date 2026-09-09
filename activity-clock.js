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

      // A very large discrepancy means this is a genuinely different canonical position,
      // such as a restore or major catch-up. Re-anchor rather than animating across the map.
      if(distance(p.x,p.y,a.x,a.y)>120){ p.x=a.x;p.y=a.y; }

      var displayState=a.state;
      if(a.state==='moving'&&finite(a.tx)&&finite(a.ty)){
        var arrived=moveToward(p,a.tx,a.ty,VISUAL_MOVE_SPEED*dt);
        if(arrived) displayState=visualArrivalState(a);
      }else{
        // Ease the visual proxy back to the authoritative position whenever the canonical
        // state is no longer traveling. This preserves shared-world truth while avoiding snaps.
        moveToward(p,a.x,a.y,Math.max(.35,VISUAL_MOVE_SPEED*.55*dt));
      }

      var off=ambientOffset(a,t);
      a.x=clamp(p.x+off.x,0,480);
      a.y=clamp(p.y+off.y,0,304);

      // Idle villagers take small local strolls so a quiet macro state still reads as alive.
      // This changes only the drawing state returned to this browser, never canonical behavior.
      if(a.state==='idle'&&Math.abs(off.x)+Math.abs(off.y)>.2) displayState='moving';
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
