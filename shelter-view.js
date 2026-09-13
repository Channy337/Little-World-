(function(){
  'use strict';
  var previousFetch=window.fetch.bind(window),latest=null,canvas=null,ctx=null,stage=null;
  function find(list,id){return (list||[]).find(function(x){return x.id===id;});}
  function ensureOverlay(){
    if(canvas)return;
    var base=document.getElementById('world');if(!base)return;
    stage=base.parentElement;stage.style.position='relative';
    canvas=document.createElement('canvas');canvas.width=base.width||960;canvas.height=base.height||712;
    canvas.style.position='absolute';canvas.style.inset='0';canvas.style.width='100%';canvas.style.height='100%';canvas.style.pointerEvents='none';canvas.style.zIndex='4';
    stage.appendChild(canvas);ctx=canvas.getContext('2d');
  }
  function message(s){
    var panel=document.getElementById('shelterProgress');if(!panel)return;
    var site=(s.constructionSites||[])[0],resident=site&&find(s.agents,site.ownerId);
    if(site){
      var crew=(site.workerIds||[]).map(function(id){var a=find(s.agents,id);return a&&a.name;}).filter(Boolean).join(', ');
      var stageName=site.stage==='materials'?'gathering materials':site.stage+' work';
      panel.textContent='Shelter for '+(resident?resident.name:'a future resident')+' · '+site.wood+' raw wood · '+site.timber+'/6 shaped timbers · '+Math.floor((site.work||0)/3*100)+'% built · '+stageName+' · '+(site.blocked||('Crew: '+(crew||'waiting for rested workers')));
      return;
    }
    var pending=(s.agents||[]).find(function(a){return a.pendingHome;});
    var knows=(s.agents||[]).some(function(a){return a.mind&&Array.isArray(a.mind.capabilities)&&a.mind.capabilities.some(function(c){return c.id==='shape:wood';});});
    if(pending)panel.textContent=pending.name+' is ready to move into the completed shelter.';
    else if((s.agents||[]).length&&(s.agents||[]).every(function(a){return !!a.home;}))panel.textContent='Everyone currently has shelter.';
    else if(knows)panel.textContent='The timber-shaping method is known. Shelter work will begin when a healthy, rested worker can take it on.';
    else panel.textContent='No shelter can be built yet. A Civorian must first discover a repeatable way to shape wood into usable timber.';
  }
  function draw(){
    if(!ctx||!canvas)return;ctx.clearRect(0,0,canvas.width,canvas.height);if(!latest)return;
    var site=(latest.constructionSites||[])[0];if(!site)return;
    var bounds=latest.renderTerritory||latest.worldBounds||{w:480,h:304};
    var wx=site.x*(480/(bounds.w||480)),wy=site.y*(304/(bounds.h||304));
    var d=Math.max(0,Math.min(1,wy/304)),spread=.76+.24*d;
    var sx=240+(wx-240)*spread,sy=78+wy*.78,scale=.76+.36*d;
    var base=document.getElementById('world'),cw=(base&&base.width)||480,ch=(base&&base.height)||356;
    var x=sx/480*cw,y=sy/356*ch,k=scale*(cw/480);
    ctx.save();ctx.translate(x,y);ctx.scale(k,k);
    ctx.fillStyle='rgba(34,40,31,.32)';ctx.beginPath();ctx.ellipse(0,14,26,6,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#796343';ctx.fillRect(-21,-8,42,21);
    ctx.strokeStyle='#dab77c';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.strokeRect(-21,-8,42,21);ctx.setLineDash([]);
    for(var i=0;i<(site.timber||0);i++){ctx.fillStyle='#b18650';ctx.fillRect(-20+i*3,13,2,5);}
    if((site.work||0)>0){ctx.strokeStyle='#b5a58b';ctx.lineWidth=3;ctx.strokeRect(-16,-5,32,15);}
    if((site.work||0)>=1){ctx.strokeStyle='#c09763';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-15,8);ctx.lineTo(-15,-16);ctx.moveTo(15,8);ctx.lineTo(15,-16);ctx.moveTo(-15,-15);ctx.lineTo(15,-15);ctx.stroke();}
    if((site.work||0)>=2){ctx.fillStyle='#8b6047';ctx.beginPath();ctx.moveTo(-20,-15);ctx.lineTo(0,-31);ctx.lineTo(20,-15);ctx.closePath();ctx.fill();}
    ctx.fillStyle='#15251c';ctx.fillRect(-23,23,46,5);ctx.fillStyle='#d8b965';ctx.fillRect(-22,24,44*((site.work||0)/3),3);
    ctx.fillStyle='#fff4d2';ctx.font='6px sans-serif';ctx.textAlign='center';ctx.fillText((site.work||0)>0?Math.floor((site.work||0)/3*100)+'% built':(site.timber||0)+'/6 timber',0,36);
    ctx.restore();
    requestAnimationFrame(draw);
  }
  function capture(data){if(data&&data.state){latest=data.state;ensureOverlay();message(latest);}return data;}
  function isTick(input){var u=typeof input==='string'?input:(input&&input.url)||'';return /(?:^|\/)api\/tick(?:\?|$)/.test(u);}
  window.fetch=function(input,init){return previousFetch(input,init).then(function(response){if(!isTick(input)||!response||!response.ok||typeof response.json!=='function')return response;var original=response.json.bind(response);response.json=function(){return original().then(capture);};return response;});};
  requestAnimationFrame(draw);
})();