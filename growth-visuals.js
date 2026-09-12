(function(){
  "use strict";

  var previousFetch=window.fetch.bind(window);
  var latestState=null, seenBuildings=new Set(), initialized=false;
  var overlay=null, backdrop=null, stage=null, baseCanvas=null;
  var bornAt=new Map();
  var DISPLAY_W=480, DISPLAY_H=356, WORLD_W=480, WORLD_H=304, SCALE=2;

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function now(){return performance.now();}
  function hash(n){var x=Math.sin((Number(n)||1)*12.9898)*43758.5453;return x-Math.floor(x);}
  function boundsFor(state){var b=state&&state.worldBounds;return b&&Number.isFinite(b.w)&&Number.isFinite(b.h)?b:{w:WORLD_W,h:WORLD_H,level:0};}
  function growthAmount(state){
    var bounds=boundsFor(state);
    if(bounds.level>0) return 0;
    var buildings=(state&&state.buildings||[]).length;
    var pop=(state&&state.agents||[]).length;
    return clamp(((buildings-6)*.055)+((pop-10)*.009),0,.22);
  }
  function projectPoint(v,sx,sy){if(v&&Number.isFinite(v.x)&&Number.isFinite(v.y)){v.x*=sx;v.y*=sy;}}
  function projectState(state){
    var bounds=boundsFor(state),sx=WORLD_W/bounds.w,sy=WORLD_H/bounds.h;
    state.renderTerritory={w:bounds.w,h:bounds.h,level:bounds.level||0};
    if(Math.abs(sx-1)<1e-9&&Math.abs(sy-1)<1e-9) return state;
    ['trees','rocks','bushes','farms','buildings','agents'].forEach(function(k){(state[k]||[]).forEach(function(v){projectPoint(v,sx,sy);if(k==='agents'){if(Number.isFinite(v.tx))v.tx*=sx;if(Number.isFinite(v.ty))v.ty*=sy;}});});
    if(state.well)projectPoint(state.well,sx,sy);
    if(state.pond){projectPoint(state.pond,sx,sy);if(Number.isFinite(state.pond.w))state.pond.w*=sx;if(Number.isFinite(state.pond.h))state.pond.h*=sy;}
    return state;
  }
  function screenPoint(x,y,growth){
    var d=clamp(y/WORLD_H,0,1),spread=.76+.24*d;
    var sx=240+(x-240)*spread,sy=78+y*.78;
    var k=1-growth;
    return {x:240+(sx-240)*k,y:356-(356-sy)*k,scale:(.76+.36*d)*k};
  }
  function ensureLayers(){
    if(overlay) return;
    baseCanvas=document.getElementById('world');
    if(!baseCanvas) return;
    stage=baseCanvas.parentElement;
    stage.style.position='relative';
    stage.style.overflow='hidden';
    backdrop=document.createElement('canvas');
    overlay=document.createElement('canvas');
    backdrop.width=overlay.width=DISPLAY_W*SCALE;
    backdrop.height=overlay.height=DISPLAY_H*SCALE;
    [backdrop,overlay].forEach(function(c){
      c.style.position='absolute'; c.style.inset='0'; c.style.width='100%'; c.style.height='100%'; c.style.pointerEvents='none';
    });
    backdrop.style.zIndex='0'; overlay.style.zIndex='3';
    baseCanvas.style.position='relative'; baseCanvas.style.zIndex='2'; baseCanvas.style.transformOrigin='50% 100%';
    stage.insertBefore(backdrop,baseCanvas); stage.appendChild(overlay);
  }
  function rememberBuildings(state){
    var ids=(state.buildings||[]).map(function(b){return b.id;});
    if(!initialized){ ids.forEach(function(id){seenBuildings.add(id);}); initialized=true; return; }
    ids.forEach(function(id){ if(!seenBuildings.has(id)){ seenBuildings.add(id); bornAt.set(id,now()); } });
  }
  function capture(data){
    if(data&&data.state&&Array.isArray(data.state.agents)){
      rememberBuildings(data.state);
      projectState(data.state);
      latestState=data.state;
      ensureLayers();
    }
    return data;
  }
  window.fetch=function(input,init){
    return previousFetch(input,init).then(function(response){
      var url=typeof input==='string'?input:(input&&input.url)||'';
      if(!/(?:^|\/)api\/tick(?:\?|$)/.test(url)||!response||!response.ok||typeof response.json!=='function') return response;
      var originalJson=response.json.bind(response);
      response.json=function(){ return originalJson().then(capture); };
      return response;
    });
  };

  function drawBackdrop(ctx,growth,t){
    ctx.clearRect(0,0,DISPLAY_W,DISPLAY_H);
    var sky=ctx.createLinearGradient(0,0,0,120); sky.addColorStop(0,'#26394a'); sky.addColorStop(1,'#809d8d'); ctx.fillStyle=sky; ctx.fillRect(0,0,DISPLAY_W,DISPLAY_H);
    var ground=ctx.createLinearGradient(0,70,0,DISPLAY_H); ground.addColorStop(0,'#789667'); ground.addColorStop(1,'#4d6a48'); ctx.fillStyle=ground; ctx.fillRect(0,70,DISPLAY_W,DISPLAY_H-70);
    var territory=latestState&&latestState.renderTerritory,level=territory?territory.level:0;
    var band=18+Math.max(growth,level*.055)*120;
    ctx.fillStyle='rgba(45,75,48,.36)';
    ctx.fillRect(0,70,band,DISPLAY_H-70); ctx.fillRect(DISPLAY_W-band,70,band,DISPLAY_H-70);
    for(var i=0;i<70;i++){
      var edge=i%2===0?hash(i)*band:DISPLAY_W-hash(i)*band;
      var y=90+hash(i+91)*(DISPLAY_H-100);
      var r=2+hash(i+22)*5;
      ctx.fillStyle='rgba(42,81,45,.35)'; ctx.beginPath();ctx.arc(edge,y,r,0,Math.PI*2);ctx.fill();
    }
    if(level>0||growth>.02){
      ctx.strokeStyle='rgba(231,213,164,'+(0.18+Math.max(growth,level*.05)).toFixed(2)+')';ctx.setLineDash([5,8]);ctx.lineWidth=1;
      ctx.strokeRect(band*.35,86,DISPLAY_W-band*.7,DISPLAY_H-102);ctx.setLineDash([]);
    }
  }
  function constructionSiteFor(a){
    var job=a.pending||a.action;
    if(!job||job.targetType!=='buildsite') return null;
    if(Number.isFinite(a.tx)&&Number.isFinite(a.ty)) return {x:a.tx,y:a.ty,sub:job.sub||'structure',progress:a.action&&a.action.duration?clamp(1-a.action.timer/a.action.duration,0,1):.18};
    return {x:a.x,y:a.y,sub:job.sub||'structure',progress:.12};
  }
  function drawSite(ctx,site,growth,t){
    var p=screenPoint(site.x,site.y,growth),s=p.scale;
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s);
    ctx.fillStyle='rgba(77,58,39,.35)';ctx.beginPath();ctx.ellipse(0,5,18,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#8a6b48';ctx.fillRect(-14,1,28,4);
    var posts=site.progress>.45?18:11;
    ctx.strokeStyle='#75563a';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-12,2);ctx.lineTo(-12,-posts);ctx.moveTo(12,2);ctx.lineTo(12,-posts);ctx.moveTo(-12,-posts);ctx.lineTo(12,-posts);ctx.stroke();
    if(site.progress>.25){ctx.beginPath();ctx.moveTo(-12,-posts);ctx.lineTo(12,2);ctx.moveTo(12,-posts);ctx.lineTo(-12,2);ctx.stroke();}
    if(site.progress>.65){ctx.strokeStyle='#ad8758';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-15,-posts);ctx.lineTo(0,-posts-12);ctx.lineTo(15,-posts);ctx.stroke();}
    var pulse=(Math.sin(t*4+site.x)+1)/2;
    ctx.fillStyle='rgba(246,219,151,'+(.55+pulse*.3)+')';ctx.font='600 7px Arial';ctx.textAlign='center';ctx.fillText('BUILDING',0,-posts-17);
    ctx.restore();
  }
  function drawWorkEffect(ctx,a,growth,t){
    if(a.state!=='working') return;
    var p=screenPoint(a.x,a.y,growth),kind=(a.action&&a.action.targetType)||({woodcutter:'tree',miner:'rock',farmer:'farm',trader:'market'}[a.role]);
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.scale,p.scale);
    if(kind==='tree'){
      ctx.fillStyle='rgba(191,132,70,.72)'; for(var i=0;i<4;i++){var q=(t*3+i*.23)%1;ctx.fillRect(7+q*8,-8+i*2,2,1);}
    }else if(kind==='rock'){
      ctx.fillStyle='rgba(235,229,190,.78)'; for(i=0;i<4;i++){var ang=t*5+i*1.57;ctx.beginPath();ctx.arc(8+Math.cos(ang)*5,-7+Math.sin(ang)*4,1,0,Math.PI*2);ctx.fill();}
    }else if(kind==='farm'){
      ctx.fillStyle='rgba(166,132,82,.35)';ctx.beginPath();ctx.arc(7,-2,4+Math.sin(t*4)*1.5,0,Math.PI*2);ctx.fill();
    }else if(kind==='market'){
      ctx.fillStyle='rgba(221,185,98,.7)';ctx.fillRect(7,-9,6,5);ctx.strokeStyle='rgba(92,65,39,.7)';ctx.strokeRect(7,-9,6,5);
    }else if(kind==='experiment'||kind==='process'){
      ctx.strokeStyle='rgba(242,205,112,.9)';ctx.lineWidth=1.2;
      for(i=0;i<3;i++){var spin=t*2+i*2.09;ctx.beginPath();ctx.arc(Math.cos(spin)*7,-8+Math.sin(spin)*4,1.4,0,Math.PI*2);ctx.stroke();}
      ctx.fillStyle='rgba(126,78,42,.9)';ctx.fillRect(-7,-3,14,2.5);
    }
    ctx.restore();
  }
  function drawNewBuilding(ctx,b,growth,t){
    var born=bornAt.get(b.id); if(!born) return;
    var age=(now()-born)/1000; if(age>7){bornAt.delete(b.id);return;}
    var p=screenPoint(b.x,b.y,growth),wave=clamp(1-age/7,0,1);
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.scale,p.scale);
    ctx.strokeStyle='rgba(244,207,111,'+(wave*.8).toFixed(2)+')';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(0,-7,18+age*2,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='rgba(238,217,171,'+(wave*.28).toFixed(2)+')';
    for(var i=0;i<5;i++){var ang=i*1.27+t*.3;ctx.beginPath();ctx.arc(Math.cos(ang)*(12+age*2),-4+Math.sin(ang)*(7+age),1.6,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  function render(){
    requestAnimationFrame(render);
    if(!latestState) return;
    ensureLayers(); if(!overlay||!backdrop) return;
    var growth=growthAmount(latestState),t=performance.now()/1000;
    baseCanvas.style.transform='scale('+(1-growth).toFixed(3)+')';
    var bctx=backdrop.getContext('2d'),octx=overlay.getContext('2d');
    bctx.setTransform(SCALE,0,0,SCALE,0,0);octx.setTransform(SCALE,0,0,SCALE,0,0);
    drawBackdrop(bctx,growth,t);octx.clearRect(0,0,DISPLAY_W,DISPLAY_H);
    (latestState.agents||[]).forEach(function(a){var site=constructionSiteFor(a);if(site)drawSite(octx,site,growth,t);drawWorkEffect(octx,a,growth,t);});
    (latestState.buildings||[]).forEach(function(b){drawNewBuilding(octx,b,growth,t);});
    var territory=latestState.renderTerritory;
    if(territory&&territory.level>0){
      octx.fillStyle='rgba(28,47,33,.78)';octx.font='600 8px Arial';octx.textAlign='right';
      octx.fillText('TERRITORY '+territory.w+' × '+territory.h+' · FRONTIER '+territory.level,DISPLAY_W-12,DISPLAY_H-12);
    }else if(growth>.03){
      octx.fillStyle='rgba(28,47,33,.72)';octx.font='600 8px Arial';octx.textAlign='right';
      octx.fillText('SETTLEMENT EXPANDING',DISPLAY_W-12,DISPLAY_H-12);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',ensureLayers); else ensureLayers();
  requestAnimationFrame(render);
})();
