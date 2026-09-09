(function(){
  "use strict";
  var TILE=16, CFG={W:480,H:304,cols:30,rows:19};
  var S=null, canvas, ctx;
  function findById(list,id){ return list.find(function(a){return a.id===id;}); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function hexToRgb(h){ h=h.replace('#',''); return {r:parseInt(h.substr(0,2),16), g:parseInt(h.substr(2,2),16), b:parseInt(h.substr(4,2),16)}; }
  function lerpColor(c1,c2,t){
    var a=hexToRgb(c1), b=hexToRgb(c2);
    var r=Math.round(a.r+(b.r-a.r)*t), g=Math.round(a.g+(b.g-a.g)*t), bl=Math.round(a.b+(b.b-a.b)*t);
    return 'rgb('+r+','+g+','+bl+')';
  }
  function hash2(x,y){
    var n=(x*374761393+y*668265263)>>>0;
    n=(Math.imul(n^(n>>>13),1274126177))>>>0;
    return ((n^(n>>>16))>>>0)/4294967295;
  }
  function roundedRect(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }
  function roleColor(role){
    return {woodcutter:'#c98e52', farmer:'#77b95b', miner:'#a9b1b7', trader:'#e1ad45'}[role] || '#c9d8c4';
  }
  function roleHat(role){
    return {woodcutter:'#59412d', farmer:'#cfb74c', miner:'#727f89', trader:'#496990'}[role] || '#6f5a47';
  }

  // ---------- richer villager sprites ----------
  var PX=3;
  function skinTone(id){ return ['#f0c49a','#dca77d','#c98962','#9d654a'][id%4]; }
  function hairTone(id){ return ['#34281f','#5b3a27','#7b5738','#292629','#8c6c49'][id%5]; }
  function drawVillagerSprite(a,sx,sy,walkFrame){
    var skin=skinTone(a.id), hair=hairTone(a.id), shirt=roleColor(a.role), hat=roleHat(a.role);
    ctx.fillStyle='#2c2f37';
    ctx.fillRect(Math.round(sx+2*PX),Math.round(sy+9*PX),PX*2,PX);
    ctx.fillRect(Math.round(sx+5*PX),Math.round(sy+9*PX),PX*2,PX);
    ctx.fillStyle='#201c18';
    ctx.fillRect(Math.round(sx+(walkFrame?1.5:2)*PX),Math.round(sy+10*PX),PX*2,PX);
    ctx.fillRect(Math.round(sx+(walkFrame?5.5:5)*PX),Math.round(sy+10*PX),PX*2,PX);
    ctx.fillStyle=shirt; ctx.fillRect(Math.round(sx+1*PX),Math.round(sy+5*PX),PX*7,PX*4);
    ctx.fillStyle='rgba(30,30,30,.18)'; ctx.fillRect(Math.round(sx+1*PX),Math.round(sy+8*PX),PX*7,PX);
    ctx.fillStyle=skin; ctx.fillRect(Math.round(sx),Math.round(sy+6*PX),PX,PX*2); ctx.fillRect(Math.round(sx+8*PX),Math.round(sy+6*PX),PX,PX*2);
    ctx.fillStyle=skin; ctx.fillRect(Math.round(sx+2*PX),Math.round(sy+1*PX),PX*5,PX*4);
    ctx.fillStyle=a.role?hat:hair;
    ctx.fillRect(Math.round(sx+2*PX),Math.round(sy),PX*5,PX);
    ctx.fillRect(Math.round(sx+1*PX),Math.round(sy+PX),PX,PX*2);
    if(a.role==='farmer') ctx.fillRect(Math.round(sx),Math.round(sy),PX*9,PX);
    if(a.role==='miner'){ ctx.fillStyle='#d7c35e'; ctx.fillRect(Math.round(sx+4*PX),Math.round(sy),PX,PX); }
    ctx.fillStyle='#2d241d';
    ctx.fillRect(Math.round(sx+3*PX),Math.round(sy+2*PX),PX,PX);
    ctx.fillRect(Math.round(sx+6*PX),Math.round(sy+2*PX),PX,PX);
    if(a.role==='trader'){ ctx.fillStyle='#7c3f34'; ctx.fillRect(Math.round(sx+4*PX),Math.round(sy+5*PX),PX,PX*3); }
  }

  var visualPositions=new Map(), receivedAt=0;
  function drawAgent(a,tNow){
    var before=visualPositions.get(a.id)||a;
    var blend=Math.min(1,(performance.now()-receivedAt)/5000);
    a=Object.assign({},a,{x:before.x+(a.x-before.x)*blend,y:before.y+(a.y-before.y)*blend,_bobPhase:a.id*1.618});
    var moving=a.state==='moving', working=a.state==='working';
    var bob=Math.sin(tNow*(moving?9:working?11:3)+a._bobPhase)*(moving?1.4:working?1.0:.45);
    var walkFrame=(moving&&Math.floor(tNow*8+a._bobPhase)%2===0)?1:0;
    var spriteW=9*PX,spriteH=11*PX,sx=a.x-spriteW/2,sy=a.y-spriteH+5-bob;

    ctx.fillStyle='rgba(12,18,12,.28)';
    ctx.beginPath(); ctx.ellipse(a.x,a.y+3,spriteW*.36,3,0,0,Math.PI*2); ctx.fill();
    drawVillagerSprite(a,sx,sy,walkFrame);

    if(working){
      var swing=Math.sin(tNow*10)*4;
      ctx.strokeStyle='#735235'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(a.x+8,sy+16); ctx.lineTo(a.x+11,sy+8+swing); ctx.stroke();
      ctx.fillStyle='#c6ced0'; ctx.fillRect(Math.round(a.x+9),Math.round(sy+7+swing),5,2);
    }

    if(a.id===S.selectedId){
      var ay=sy-9+Math.sin(tNow*5)*2;
      ctx.fillStyle='#fff1a8';
      ctx.beginPath(); ctx.moveTo(a.x,ay+6); ctx.lineTo(a.x-5,ay); ctx.lineTo(a.x+5,ay); ctx.closePath(); ctx.fill();
    }

    var icon=null,iconColor='#f4efe0';
    if(a.state==='resting') icon='z';
    else if(a.state==='socializing'){ icon='\u2665'; iconColor='#f1a1aa'; }
    else if(a.hunger>=72){ icon='!'; iconColor='#f2c45a'; }
    if(icon){
      var by=sy-6+Math.sin(tNow*3+a._bobPhase)*2;
      ctx.font='bold 10px monospace'; ctx.textAlign='center'; ctx.fillStyle=iconColor; ctx.fillText(icon,a.x,by);
    }
  }

  // ---------- richer scenery ----------
  function drawGround(){
    var shades=['#405a38','#46613d','#395435'];
    for(var gy=0;gy<CFG.rows;gy++){
      for(var gx=0;gx<CFG.cols;gx++){
        var base=shades[S.groundTiles[gy][gx]];
        ctx.fillStyle=base; ctx.fillRect(gx*TILE,gy*TILE,TILE,TILE);
        var n=hash2(gx,gy);
        if(n>.72){
          ctx.fillStyle=n>.91?'#d6c96f':'rgba(219,231,181,.32)';
          ctx.fillRect(gx*TILE+3+(n*7|0),gy*TILE+4+((n*13)%7|0),1,2);
        }
        if(n<.12){ ctx.fillStyle='rgba(24,49,27,.28)'; ctx.fillRect(gx*TILE+11,gy*TILE+9,2,1); }
      }
    }
    var g=ctx.createLinearGradient(0,0,0,CFG.H);
    g.addColorStop(0,'rgba(255,255,220,.035)'); g.addColorStop(1,'rgba(10,20,14,.12)');
    ctx.fillStyle=g; ctx.fillRect(0,0,CFG.W,CFG.H);
  }

  function drawPaths(){
    var center={x:S.well.x,y:S.well.y};
    var nodes=S.buildings.slice(0,16).map(function(b){return{x:b.x,y:b.y};});
    if(S.market) nodes.push({x:S.market.x,y:S.market.y});
    ctx.lineCap='round'; ctx.lineJoin='round';
    nodes.forEach(function(n){
      ctx.strokeStyle='rgba(69,53,37,.24)'; ctx.lineWidth=8; ctx.beginPath(); ctx.moveTo(center.x,center.y); ctx.lineTo(n.x,n.y); ctx.stroke();
      ctx.strokeStyle='rgba(184,155,104,.18)'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(center.x,center.y); ctx.lineTo(n.x,n.y); ctx.stroke();
    });
    ctx.lineCap='butt';
  }

  function drawZones(){
    ctx.fillStyle='rgba(41,64,36,.08)'; ctx.fillRect(325,8,152,292);
    ctx.fillStyle='rgba(100,105,103,.07)'; ctx.fillRect(6,185,122,107);
    ctx.fillStyle='rgba(185,170,91,.06)'; ctx.fillRect(138,12,196,98);
  }

  function drawPond(tNow){
    var p=S.pond,x=p.x-p.w/2,y=p.y-p.h/2;
    ctx.fillStyle='rgba(47,43,29,.35)'; roundedRect(x-4,y-4,p.w+8,p.h+8,8); ctx.fill();
    var water=ctx.createLinearGradient(x,y,x,y+p.h);
    water.addColorStop(0,'#3b7d8b'); water.addColorStop(1,'#245465');
    ctx.fillStyle=water; roundedRect(x,y,p.w,p.h,6); ctx.fill();
    ctx.strokeStyle='rgba(205,239,232,.24)'; ctx.lineWidth=1;
    for(var i=0;i<3;i++){
      var ry=y+8+i*9+Math.sin(tNow*1.1+i)*2;
      ctx.beginPath(); ctx.moveTo(x+8+i*4,ry); ctx.lineTo(x+p.w-10-i*5,ry); ctx.stroke();
    }
    for(i=0;i<3;i++){
      var lx=x+15+i*19,ly=y+p.h-12-(i%2)*8;
      ctx.fillStyle='#557d45'; ctx.beginPath(); ctx.ellipse(lx,ly,5,3,0,0,Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle='#5f7741'; ctx.lineWidth=2;
    for(i=0;i<8;i++){
      var rx=x-2+i*5;
      ctx.beginPath(); ctx.moveTo(rx,y+p.h+2); ctx.lineTo(rx+Math.sin(tNow+i),y+p.h-8-(i%3)*2); ctx.stroke();
    }
    ctx.fillStyle='rgba(255,250,215,.22)'; ctx.fillRect(x+8,y+6,p.w*.28,2);
  }

  function drawWell(){
    var w=S.well;
    ctx.fillStyle='rgba(12,16,12,.3)'; ctx.beginPath(); ctx.ellipse(w.x,w.y+10,14,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#77736b'; roundedRect(w.x-10,w.y-5,20,12,3); ctx.fill();
    ctx.fillStyle='#99958b'; ctx.fillRect(w.x-9,w.y-4,18,3);
    ctx.fillStyle='#51453b'; ctx.fillRect(w.x-12,w.y-16,3,16); ctx.fillRect(w.x+9,w.y-16,3,16);
    ctx.fillStyle='#694832'; ctx.fillRect(w.x-13,w.y-17,28,3);
    ctx.fillStyle='#2e4650'; ctx.beginPath(); ctx.ellipse(w.x,w.y-1,7,3,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#8c7250'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(w.x+2,w.y-14); ctx.lineTo(w.x+2,w.y-1); ctx.stroke();
  }

  function drawFarm(f){
    ctx.fillStyle='#4a3728'; roundedRect(f.x-16,f.y-11,32,22,3); ctx.fill();
    ctx.fillStyle='#664c34'; ctx.fillRect(f.x-14,f.y-9,28,18);
    for(var row=0;row<4;row++){
      var yy=f.y-7+row*5;
      ctx.strokeStyle='rgba(38,29,20,.5)'; ctx.beginPath(); ctx.moveTo(f.x-13,yy); ctx.lineTo(f.x+13,yy); ctx.stroke();
      if(f.planted){
        var h=2+Math.floor(clamp(f.growth,0,1)*5);
        for(var col=0;col<6;col++){
          var xx=f.x-11+col*5;
          ctx.fillStyle=f.growth>=1?'#d6bd55':'#6ea54e'; ctx.fillRect(xx,yy-h,1,h);
          if(f.growth>.55) ctx.fillRect(xx-1,yy-h+2,3,1);
        }
      }
    }
  }

  function drawBush(b){
    ctx.fillStyle='rgba(10,16,10,.25)'; ctx.beginPath(); ctx.ellipse(b.x,b.y+6,9,3,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#31512f'; ctx.beginPath(); ctx.arc(b.x-3,b.y,6,0,Math.PI*2); ctx.arc(b.x+3,b.y+1,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#4f7847'; ctx.beginPath(); ctx.arc(b.x,b.y-3,5,0,Math.PI*2); ctx.fill();
    for(var k=0;k<Math.min(b.food,5);k++){ ctx.fillStyle='#cf5a4f'; ctx.fillRect(b.x-6+k*3,b.y-2+(k%2)*3,2,2); }
  }

  function drawRock(r){
    var s=6+(r.stone/r.max)*5;
    ctx.fillStyle='rgba(10,14,10,.3)'; ctx.beginPath(); ctx.ellipse(r.x,r.y+s*.65,s,3,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#7d8589'; ctx.beginPath(); ctx.moveTo(r.x-s,r.y+s*.5); ctx.lineTo(r.x-s*.35,r.y-s); ctx.lineTo(r.x+s*.45,r.y-s*.65); ctx.lineTo(r.x+s,r.y+s*.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#aab0b2'; ctx.beginPath(); ctx.moveTo(r.x-s*.35,r.y-s); ctx.lineTo(r.x+s*.1,r.y-s*.35); ctx.lineTo(r.x-s*.55,r.y-s*.1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(48,54,55,.55)'; ctx.beginPath(); ctx.moveTo(r.x+1,r.y-s*.3); ctx.lineTo(r.x+4,r.y+2); ctx.stroke();
  }

  function drawTree(t){
    var sz=7+(t.wood/t.max)*6;
    ctx.fillStyle='rgba(10,16,10,.28)'; ctx.beginPath(); ctx.ellipse(t.x,t.y+12,sz*.85,3,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#5d422b'; ctx.fillRect(t.x-3,t.y-1,6,13);
    ctx.fillStyle='#7d5a36'; ctx.fillRect(t.x-1,t.y,2,11);
    ctx.fillStyle='#2f4d2d'; ctx.beginPath(); ctx.arc(t.x,t.y-sz*.45,sz,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#385f33'; ctx.beginPath(); ctx.arc(t.x-sz*.48,t.y-sz*.62,sz*.68,0,Math.PI*2); ctx.arc(t.x+sz*.5,t.y-sz*.7,sz*.7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#4b7741'; ctx.beginPath(); ctx.arc(t.x-sz*.16,t.y-sz,sz*.65,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(176,210,133,.25)'; ctx.beginPath(); ctx.arc(t.x-sz*.42,t.y-sz*1.03,sz*.25,0,Math.PI*2); ctx.fill();
  }

  function drawHouse(b,tNow){
    var night=Math.max(0,.65-Math.max(0,Math.sin(S.time*Math.PI)));
    ctx.fillStyle='rgba(10,14,10,.3)'; ctx.beginPath(); ctx.ellipse(b.x,b.y+9,17,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#b87947'; roundedRect(b.x-13,b.y-8,26,17,2); ctx.fill();
    ctx.fillStyle='#d49a5b'; ctx.fillRect(b.x-11,b.y-6,22,10);
    ctx.fillStyle='#65442d'; ctx.fillRect(b.x-12,b.y-1,24,2); ctx.fillRect(b.x-8,b.y-7,2,15); ctx.fillRect(b.x+6,b.y-7,2,15);
    ctx.fillStyle='#513825'; roundedRect(b.x-3,b.y,6,9,2); ctx.fill();
    ctx.fillStyle='#c5a168'; ctx.fillRect(b.x+1,b.y+4,1,1);
    ctx.fillStyle=night>.08?'rgba(255,207,92,'+(0.45+night*.6)+')':'#bcd6d3';
    ctx.fillRect(b.x+5,b.y-5,5,5);
    ctx.fillStyle='rgba(66,58,42,.55)'; ctx.fillRect(b.x+7,b.y-5,1,5); ctx.fillRect(b.x+5,b.y-3,5,1);
    ctx.fillStyle='#693c2e'; ctx.beginPath(); ctx.moveTo(b.x-16,b.y-7); ctx.lineTo(b.x,b.y-20); ctx.lineTo(b.x+16,b.y-7); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#824838'; ctx.beginPath(); ctx.moveTo(b.x-12,b.y-8); ctx.lineTo(b.x,b.y-17); ctx.lineTo(b.x+5,b.y-8); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#50352c'; ctx.fillRect(b.x+7,b.y-23,4,9);
    var puff=(Math.sin(tNow*1.4+b.id)+1)/2;
    ctx.fillStyle='rgba(225,225,214,'+(0.18+puff*.2)+')'; ctx.beginPath(); ctx.arc(b.x+9,b.y-26-puff*5,2.5+puff*1.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#8a775d'; ctx.fillRect(b.x-5,b.y+9,10,2);
  }

  function drawMarket(b,tNow){
    ctx.fillStyle='rgba(10,14,10,.3)'; ctx.beginPath(); ctx.ellipse(b.x,b.y+11,23,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#72523a'; roundedRect(b.x-19,b.y-3,38,13,2); ctx.fill();
    ctx.fillStyle='#9b7047'; ctx.fillRect(b.x-17,b.y,34,7);
    for(var i=0;i<5;i++){ ctx.fillStyle=i%2?'#e4b64e':'#b95548'; ctx.fillRect(b.x-20+i*8,b.y-12,8,9); }
    ctx.fillStyle='#513a2d'; ctx.fillRect(b.x-19,b.y-14,3,25); ctx.fillRect(b.x+16,b.y-14,3,25);
    ctx.fillStyle='#8d613b'; ctx.fillRect(b.x-14,b.y+5,8,7); ctx.fillRect(b.x+6,b.y+5,9,7);
    ctx.fillStyle='#c95745'; ctx.fillRect(b.x-12,b.y+3,2,2); ctx.fillStyle='#d0b64c'; ctx.fillRect(b.x-8,b.y+3,2,2);
    var flutter=Math.sin(tNow*2.2)*2;
    ctx.fillStyle='#d86551'; ctx.beginPath(); ctx.moveTo(b.x,b.y-27); ctx.lineTo(b.x+10+flutter,b.y-23); ctx.lineTo(b.x,b.y-19); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#463225'; ctx.fillRect(b.x-1,b.y-28,2,15);
  }

  function drawAmbient(tNow){
    var bright=Math.max(0,Math.sin(S.time*Math.PI));
    if(bright<.25){
      for(var i=0;i<12;i++){
        var x=(hash2(i,9)*CFG.W+Math.sin(tNow*.5+i)*8)%CFG.W;
        var y=40+hash2(i,15)*(CFG.H-80)+Math.cos(tNow*.7+i)*4;
        var alpha=.18+.35*(.5+.5*Math.sin(tNow*2+i));
        ctx.fillStyle='rgba(235,222,122,'+alpha.toFixed(2)+')'; ctx.fillRect(x,y,2,2);
      }
    }
    var vg=ctx.createRadialGradient(CFG.W/2,CFG.H/2,100,CFG.W/2,CFG.H/2,320);
    vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(5,12,8,.28)');
    ctx.fillStyle=vg; ctx.fillRect(0,0,CFG.W,CFG.H);
  }

  function draw(){
    var tNow=performance.now()/1000;
    drawGround(); drawZones(); drawPaths(); drawPond(tNow);
    var i,bd;
    for(i=0;i<S.farms.length;i++) drawFarm(S.farms[i]);
    drawWell();
    for(i=0;i<S.bushes.length;i++) drawBush(S.bushes[i]);
    for(i=0;i<S.rocks.length;i++) drawRock(S.rocks[i]);
    for(i=0;i<S.trees.length;i++) drawTree(S.trees[i]);
    for(i=0;i<S.buildings.length;i++){
      bd=S.buildings[i];
      if(bd.type==='house') drawHouse(bd,tNow); else drawMarket(bd,tNow);
    }
    var sorted=S.agents.slice().sort(function(p,q){ return p.y-q.y; });
    for(i=0;i<sorted.length;i++) drawAgent(sorted[i],tNow);

    var bright=Math.max(0,Math.sin(S.time*Math.PI));
    var nightAlpha=Math.max(0,.52-bright*.59);
    if(nightAlpha>0){ ctx.fillStyle='rgba(13,24,43,'+nightAlpha.toFixed(2)+')'; ctx.fillRect(0,0,CFG.W,CFG.H); }
    var duskFactor=Math.max(0,1-Math.abs(bright-.35)*2.4)*(S.time<.5?1:.65);
    if(duskFactor>.02){
      var dusk=ctx.createLinearGradient(0,0,CFG.W,CFG.H);
      dusk.addColorStop(0,'rgba(236,151,85,'+(duskFactor*.16).toFixed(2)+')');
      dusk.addColorStop(1,'rgba(126,72,106,'+(duskFactor*.08).toFixed(2)+')');
      ctx.fillStyle=dusk; ctx.fillRect(0,0,CFG.W,CFG.H);
    }
    drawAmbient(tNow);
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
      if(!S) return;
      var p = getWorldPos(e);
      var best=null, bd=16;
      for(var i=0;i<S.agents.length;i++){
        var a=S.agents[i], d=Math.hypot(a.x-p.x,a.y-p.y);
        if(d<bd){ bd=d; best=a; }
      }
      S.selectedId = best ? best.id : null;
      updateHUD();
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
    cctx.fillText('THE CLIVORIA', 16, sceneH+28);
    cctx.fillStyle = '#9fae9c';
    cctx.font = '12px monospace';
    var houses=0; for(var i=0;i<S.buildings.length;i++) if(S.buildings[i].type==='house') houses++;
    cctx.fillText('Day '+S.day+'  \u00b7  '+S.agents.length+' villagers  \u00b7  '+houses+' homes'+(S.market?'  \u00b7  market open':''), 16, sceneH+48);

    cctx.fillStyle = '#eef1ea';
    cctx.font = 'italic 14px Georgia, serif';
    var quote = moment ? moment.msg : 'A quiet day in The Clivoria.';
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
    if(!S) return;
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
      var file = new File([blob], 'the-clivoria-day'+S.day+'.png', {type:'image/png'});
      if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
        var shareBtn2 = document.getElementById('momentShareNow');
        if(shareBtn2){
          shareBtn2.onclick = function(){
            navigator.share({files:[file], title:'The Clivoria', text:'Day '+S.day+' in The Clivoria.'}).catch(function(){});
          };
        }
      }
    });
  }

  function downloadMoment(){
    var img = document.getElementById('momentImg');
    if(!img || !img.src) return;
    var a = document.createElement('a');
    a.href = img.src; a.download = 'the-clivoria-day'+S.day+'.png';
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
    if(!S) return;
    var url = location.href.split('#')[0];
    var houses=0; for(var i=0;i<S.buildings.length;i++) if(S.buildings[i].type==='house') houses++;
    var text = 'The Clivoria is on day '+S.day+' with '+S.agents.length+' villagers and '+houses+' homes built. Come watch what emerges:';
    if(navigator.share){
      navigator.share({title:'The Clivoria', text:text, url:url}).catch(function(){});
    } else if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(function(){ showToast('Link copied to clipboard!'); })
        .catch(function(){ showToast('Copy this page\u2019s address to share it.'); });
    } else {
      showToast('Copy this page\u2019s address to share it.');
    }
  }

  // The browser only displays authoritative snapshots. No local world writes.
  var revision=-1, stopped=false;
  function status(message){ document.getElementById('syncStatus').textContent=message; }
  async function sync(){
    if(document.hidden){ setTimeout(sync,5000); return; }
    try {
      var response=await fetch('/api/tick',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw new Error('unavailable');
      var data=await response.json();
      if(!data.state || !Array.isArray(data.state.agents)) throw new Error('invalid');
      if(data.revision>=revision){
        var selected=S ? S.selectedId : null;
        if(data.revision>revision){
          var blend=Math.min(1,(performance.now()-receivedAt)/5000);
          var previous=new Map();
          if(S) S.agents.forEach(function(a){var p=visualPositions.get(a.id)||a; previous.set(a.id,{x:p.x+(a.x-p.x)*blend,y:p.y+(a.y-p.y)*blend});});
          visualPositions=previous; receivedAt=performance.now();
        }
        S=data.state; S.selectedId=selected; revision=data.revision;
        updateHUD();
      }
      status('Shared world \u00b7 Live \u00b7 Day '+S.day+(data.catchUpSeconds ? ' \u00b7 caught up '+data.catchUpSeconds+'s' : ''));
      document.getElementById('liveLabel').textContent='live';
    } catch(e){
      document.getElementById('liveLabel').textContent=S ? 'reconnecting' : 'connecting';
      status(S ? 'Connection interrupted \u00b7 Showing last shared state \u00b7 Retrying\u2026' : 'Connecting to the shared world\u2026 Retrying shortly.');
    }
    if(!stopped) setTimeout(sync,5000);
  }
  function frame(){ if(S) draw(); requestAnimationFrame(frame); }
  function boot(){
    canvas=document.getElementById('world'); canvas.width=CFG.W; canvas.height=CFG.H;
    ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=false; wireUI(); sync(); requestAnimationFrame(frame);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();