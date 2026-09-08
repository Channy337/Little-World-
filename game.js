(function(){
  "use strict";
  var TILE=16, CFG={W:480,H:304,cols:30,rows:19};
  var S=null, canvas, ctx;
  function findById(list,id){ return list.find(function(a){return a.id===id;}); }
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

  var visualPositions=new Map(), receivedAt=0;
  function drawAgent(a, tNow){
    var before=visualPositions.get(a.id) || a;
    var blend=Math.min(1,(performance.now()-receivedAt)/5000);
    a=Object.assign({},a,{x:before.x+(a.x-before.x)*blend,y:before.y+(a.y-before.y)*blend,_bobPhase:a.id*1.618});
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
      if(!S) return;
      var p = getWorldPos(e);
      var best=null, bd=14;
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
    if(!S) return;
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
      status('Shared world · Live · Day '+S.day+(data.catchUpSeconds ? ' · caught up '+data.catchUpSeconds+'s' : ''));
      document.getElementById('liveLabel').textContent='live';
    } catch(e){
      document.getElementById('liveLabel').textContent=S ? 'reconnecting' : 'connecting';
      status(S ? 'Connection interrupted · Showing last shared state · Retrying…' : 'Connecting to the shared world… Retrying shortly.');
    }
    if(!stopped) setTimeout(sync,5000);
  }
  function frame(){ if(S) draw(); requestAnimationFrame(frame); }
  function boot(){
    canvas=document.getElementById('world'); canvas.width=CFG.W; canvas.height=CFG.H;
    ctx=canvas.getContext('2d'); wireUI(); sync(); requestAnimationFrame(frame);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
