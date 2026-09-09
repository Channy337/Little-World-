(function(){
  "use strict";

  var CFG={W:480,H:304,cols:30,rows:19};
  var RENDER_SCALE=2;
  var S=null, canvas, ctx;
  var visualPositions=new Map(), receivedAt=0;
  var revision=-1, stopped=false;
  var dayVal, popVal, houseVal, marketVal, moodVal, logList, agentCard, clockLabel;

  function findById(list,id){ return list.find(function(a){return a.id===id;}); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function hexToRgb(h){
    h=h.replace('#','');
    return {r:parseInt(h.substr(0,2),16),g:parseInt(h.substr(2,2),16),b:parseInt(h.substr(4,2),16)};
  }
  function lerpColor(c1,c2,t){
    var a=hexToRgb(c1), b=hexToRgb(c2);
    var r=Math.round(a.r+(b.r-a.r)*t), g=Math.round(a.g+(b.g-a.g)*t), bl=Math.round(a.b+(b.b-a.b)*t);
    return 'rgb('+r+','+g+','+bl+')';
  }
  function hash2(x,y){
    var n=Math.sin(x*127.1+y*311.7)*43758.5453123;
    return n-Math.floor(n);
  }
  function roundedRect(x,y,w,h,r){
    r=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }
  function roleColor(role){
    return {woodcutter:'#c78650',farmer:'#6f9d60',miner:'#7f8992',trader:'#c39b48'}[role] || '#8aa58b';
  }
  function roleDark(role){
    return {woodcutter:'#5f4332',farmer:'#4d6243',miner:'#535b63',trader:'#6a5630'}[role] || '#526052';
  }
  function roleTitle(role){ return role.charAt(0).toUpperCase()+role.slice(1); }

  // ---------- illustrated world rendering ----------
  function drawGround(tNow){
    var g=ctx.createLinearGradient(0,0,0,CFG.H);
    g.addColorStop(0,'#76916b');
    g.addColorStop(.45,'#789a6c');
    g.addColorStop(1,'#617f59');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,CFG.W,CFG.H);

    var hill=ctx.createLinearGradient(0,0,0,90);
    hill.addColorStop(0,'rgba(61,88,70,.78)');
    hill.addColorStop(1,'rgba(76,108,75,.08)');
    ctx.fillStyle=hill;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(0,42);
    ctx.bezierCurveTo(58,19,94,48,145,28);
    ctx.bezierCurveTo(200,6,238,45,291,26);
    ctx.bezierCurveTo(355,4,398,42,480,20);
    ctx.lineTo(480,0);
    ctx.closePath();
    ctx.fill();

    for(var gy=0; gy<19; gy++){
      for(var gx=0; gx<30; gx++){
        var n=hash2(gx,gy);
        if(n>.47){
          ctx.fillStyle=n>.73?'rgba(225,225,173,.055)':'rgba(32,70,41,.045)';
          ctx.beginPath();
          ctx.ellipse(gx*16+8,gy*16+8,11+n*8,6+n*5,n*2,0,Math.PI*2);
          ctx.fill();
        }
      }
    }

    ctx.lineCap='round';
    for(var i=0;i<95;i++){
      var rx=hash2(i,13)*CFG.W, ry=45+hash2(i,27)*(CFG.H-48);
      var size=1.3+hash2(i,41)*1.8;
      ctx.strokeStyle='rgba(39,78,42,'+(0.10+hash2(i,9)*.12)+')';
      ctx.lineWidth=.7;
      ctx.beginPath();
      ctx.moveTo(rx,ry+size);
      ctx.lineTo(rx+hash2(i,18)*1.6-0.8,ry-size);
      ctx.stroke();
      if(hash2(i,55)>.84){
        ctx.fillStyle=hash2(i,66)>.5?'rgba(245,225,162,.52)':'rgba(232,193,184,.48)';
        ctx.beginPath();
        ctx.arc(rx,ry-size,1,0,Math.PI*2);
        ctx.fill();
      }
    }

    var glow=ctx.createRadialGradient(120,35,10,120,35,290);
    glow.addColorStop(0,'rgba(255,234,178,.12)');
    glow.addColorStop(1,'rgba(255,234,178,0)');
    ctx.fillStyle=glow;
    ctx.fillRect(0,0,CFG.W,CFG.H);
  }

  function drawPaths(){
    if(!S || !S.well) return;
    var wx=S.well.x, wy=S.well.y;
    ctx.lineCap='round';
    ctx.lineJoin='round';

    function pathTo(x,y,width){
      var midX=(wx+x)/2+(y-wy)*.06;
      var midY=(wy+y)/2;
      ctx.strokeStyle='rgba(70,60,42,.18)';
      ctx.lineWidth=width+3;
      ctx.beginPath();
      ctx.moveTo(wx,wy);
      ctx.quadraticCurveTo(midX,midY,x,y);
      ctx.stroke();

      var pg=ctx.createLinearGradient(wx,wy,x,y);
      pg.addColorStop(0,'rgba(211,194,148,.52)');
      pg.addColorStop(1,'rgba(194,172,126,.42)');
      ctx.strokeStyle=pg;
      ctx.lineWidth=width;
      ctx.beginPath();
      ctx.moveTo(wx,wy);
      ctx.quadraticCurveTo(midX,midY,x,y);
      ctx.stroke();

      ctx.strokeStyle='rgba(255,244,205,.12)';
      ctx.lineWidth=Math.max(1,width*.22);
      ctx.beginPath();
      ctx.moveTo(wx,wy-1);
      ctx.quadraticCurveTo(midX,midY-1,x,y-1);
      ctx.stroke();
    }

    for(var i=0;i<S.buildings.length;i++){
      pathTo(S.buildings[i].x,S.buildings[i].y+8,S.buildings[i].type==='market'?8:6);
    }
    for(i=0;i<S.farms.length;i++){
      if(i<3) pathTo(S.farms[i].x,S.farms[i].y,4.2);
    }
  }

  function drawPond(tNow){
    var p=S.pond;
    ctx.save();
    ctx.translate(p.x,p.y);
    var w=p.w/2, h=p.h/2;

    ctx.fillStyle='rgba(31,51,46,.20)';
    ctx.beginPath();
    ctx.ellipse(2,5,w+4,h+3,-.05,0,Math.PI*2);
    ctx.fill();

    var water=ctx.createLinearGradient(-w,-h,w,h);
    water.addColorStop(0,'#6ea3a0');
    water.addColorStop(.55,'#4e8788');
    water.addColorStop(1,'#3c6d71');
    ctx.fillStyle=water;
    ctx.beginPath();
    ctx.moveTo(-w+5,-h+3);
    ctx.bezierCurveTo(-w-3,-h*.2,-w+2,h*.72,-w*.55,h);
    ctx.bezierCurveTo(-w*.04,h+3,w*.36,h*.91,w*.78,h*.53);
    ctx.bezierCurveTo(w+4,h*.12,w,-h*.61,w*.55,-h);
    ctx.bezierCurveTo(w*.1,-h-3,-w*.32,-h+1,-w+5,-h+3);
    ctx.closePath();
    ctx.fill();

    for(var i=0;i<4;i++){
      var wave=Math.sin(tNow*1.15+i*1.7)*3;
      ctx.strokeStyle='rgba(245,245,226,'+(0.11+i*.025)+')';
      ctx.lineWidth=1.1;
      ctx.beginPath();
      ctx.moveTo(-w*.72+i*4,-h*.42+i*5);
      ctx.quadraticCurveTo(-w*.15+wave,-h*.31+i*5,w*.34+wave,-h*.36+i*5);
      ctx.stroke();
    }

    ctx.strokeStyle='#536f47';
    ctx.lineWidth=1.2;
    for(i=0;i<9;i++){
      var bx=-w-2+i*2.2;
      var by=h*.45+Math.sin(i)*3;
      ctx.beginPath();
      ctx.moveTo(bx,by+7);
      ctx.quadraticCurveTo(bx-1,by,bx+Math.sin(i)*2,by-6-hash2(i,3)*3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFarm(f){
    var growth=clamp(f.growth||0,0,1);
    ctx.save();
    ctx.translate(f.x,f.y);

    ctx.fillStyle='rgba(36,42,29,.20)';
    roundedRect(-16,-8,32,21,5);
    ctx.fill();

    var soil=ctx.createLinearGradient(0,-10,0,10);
    soil.addColorStop(0,'#725a40');
    soil.addColorStop(1,'#5b4936');
    ctx.fillStyle=soil;
    roundedRect(-15,-10,30,19,4);
    ctx.fill();

    for(var row=0;row<4;row++){
      var y=-6+row*4.2;
      ctx.strokeStyle='rgba(43,30,23,.35)';
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(-12,y);
      ctx.quadraticCurveTo(0,y+1,12,y);
      ctx.stroke();

      if(f.planted){
        for(var col=0;col<5;col++){
          var x=-10+col*5;
          var hh=1.5+growth*4.5;
          ctx.strokeStyle=lerpColor('#718b54','#b8a943',growth);
          ctx.lineWidth=1;
          ctx.beginPath();
          ctx.moveTo(x,y);
          ctx.lineTo(x,y-hh);
          ctx.stroke();
          if(growth>.55){
            ctx.fillStyle=growth>.88?'#d4be58':'#91aa55';
            ctx.beginPath();
            ctx.ellipse(x-1,y-hh*.6,1.5,.8,-.5,0,Math.PI*2);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  }

  function drawBush(b){
    var fullness=clamp((b.food||0)/Math.max(1,b.max||5),0,1);
    ctx.fillStyle='rgba(30,50,29,.20)';
    ctx.beginPath(); ctx.ellipse(b.x,b.y+4,9,3,0,0,Math.PI*2); ctx.fill();

    var shades=['#436b42','#4f7c4c','#5c8b55'];
    var blobs=[[-4,0,5],[2,-2,6],[5,2,4],[-1,3,5]];
    for(var i=0;i<blobs.length;i++){
      ctx.fillStyle=shades[i%shades.length];
      ctx.beginPath(); ctx.arc(b.x+blobs[i][0],b.y+blobs[i][1],blobs[i][2],0,Math.PI*2); ctx.fill();
    }
    var berries=Math.round(fullness*5);
    for(i=0;i<berries;i++){
      var ang=i*2.17, rr=2.5+(i%2)*3;
      ctx.fillStyle='#b95f58';
      ctx.beginPath(); ctx.arc(b.x+Math.cos(ang)*rr,b.y+Math.sin(ang)*rr-1,1.2,0,Math.PI*2); ctx.fill();
    }
  }

  function drawRock(r){
    var s=6+clamp((r.stone||0)/Math.max(1,r.max||1),0,1)*5;
    ctx.fillStyle='rgba(30,39,35,.24)';
    ctx.beginPath(); ctx.ellipse(r.x,r.y+s*.72,s*1.05,2.8,0,0,Math.PI*2); ctx.fill();

    var rg=ctx.createLinearGradient(r.x-s,r.y-s,r.x+s,r.y+s);
    rg.addColorStop(0,'#c6c9c4');
    rg.addColorStop(.52,'#8e9795');
    rg.addColorStop(1,'#6d7775');
    ctx.fillStyle=rg;
    ctx.beginPath();
    ctx.moveTo(r.x-s,r.y+s*.55);
    ctx.lineTo(r.x-s*.45,r.y-s*.62);
    ctx.lineTo(r.x+s*.1,r.y-s);
    ctx.lineTo(r.x+s*.72,r.y-s*.34);
    ctx.lineTo(r.x+s,r.y+s*.6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle='rgba(255,255,255,.24)';
    ctx.beginPath();
    ctx.moveTo(r.x-s*.42,r.y-s*.57);
    ctx.lineTo(r.x+s*.05,r.y-s*.92);
    ctx.lineTo(r.x+s*.25,r.y-s*.36);
    ctx.closePath();
    ctx.fill();
  }

  function drawTree(t,tNow){
    var fullness=clamp((t.wood||0)/Math.max(1,t.max||1),0,1);
    var sz=7+fullness*6;
    var sway=Math.sin(tNow*.75+t.x*.03)*.75;

    ctx.fillStyle='rgba(29,49,31,.22)';
    ctx.beginPath(); ctx.ellipse(t.x+2,t.y+10,sz*.82,3,0,0,Math.PI*2); ctx.fill();

    ctx.strokeStyle='#644b35';
    ctx.lineWidth=3.2;
    ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(t.x,t.y+8);
    ctx.quadraticCurveTo(t.x+sway*.4,t.y+1,t.x+sway,t.y-sz*.35);
    ctx.stroke();

    var tg=ctx.createRadialGradient(t.x-3,t.y-sz*.72,2,t.x,t.y-sz*.5,sz*1.05);
    tg.addColorStop(0,'#6f9861');
    tg.addColorStop(.6,'#4f7b4d');
    tg.addColorStop(1,'#365f3d');
    ctx.fillStyle=tg;
    ctx.beginPath(); ctx.arc(t.x-3+sway,t.y-sz*.62,sz*.73,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(t.x+4+sway*.8,t.y-sz*.43,sz*.67,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(t.x+sway*.9,t.y-sz*.92,sz*.61,0,Math.PI*2); ctx.fill();

    ctx.fillStyle='rgba(211,228,180,.14)';
    ctx.beginPath(); ctx.arc(t.x-4+sway,t.y-sz*.96,sz*.28,0,Math.PI*2); ctx.fill();
  }

  function drawWell(){
    var w=S.well;
    ctx.fillStyle='rgba(31,42,35,.25)';
    ctx.beginPath(); ctx.ellipse(w.x,w.y+8,13,3.2,0,0,Math.PI*2); ctx.fill();

    var sg=ctx.createLinearGradient(w.x-10,w.y-8,w.x+10,w.y+8);
    sg.addColorStop(0,'#c6b9a0');
    sg.addColorStop(1,'#827969');
    ctx.fillStyle=sg;
    ctx.beginPath(); ctx.ellipse(w.x,w.y,10,5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#314e51';
    ctx.beginPath(); ctx.ellipse(w.x,w.y,7,3.1,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#6c5640'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(w.x-8,w.y-1); ctx.lineTo(w.x-8,w.y-13); ctx.moveTo(w.x+8,w.y-1); ctx.lineTo(w.x+8,w.y-13); ctx.stroke();
    ctx.strokeStyle='#75543a'; ctx.lineWidth=2.6;
    ctx.beginPath(); ctx.moveTo(w.x-10,w.y-14); ctx.lineTo(w.x+10,w.y-14); ctx.stroke();
  }

  function drawHouse(b,tNow){
    var night=Math.max(0,.62-Math.max(0,Math.sin(S.time*Math.PI))*.72);
    var x=b.x,y=b.y;

    ctx.fillStyle='rgba(36,43,33,.28)';
    ctx.beginPath(); ctx.ellipse(x+2,y+9,17,4,0,0,Math.PI*2); ctx.fill();

    var wall=ctx.createLinearGradient(x-11,y-7,x+12,y+9);
    wall.addColorStop(0,'#d6b783');
    wall.addColorStop(1,'#b8895d');
    ctx.fillStyle=wall;
    roundedRect(x-11,y-7,22,16,2.5); ctx.fill();

    ctx.fillStyle='rgba(94,63,42,.18)';
    for(var i=0;i<3;i++){ ctx.fillRect(x-10,y-3+i*4,20,.8); }

    var roof=ctx.createLinearGradient(x,y-20,x,y-6);
    roof.addColorStop(0,'#704333');
    roof.addColorStop(1,'#4f342b');
    ctx.fillStyle=roof;
    ctx.beginPath();
    ctx.moveTo(x-14,y-7);
    ctx.lineTo(x,y-20);
    ctx.lineTo(x+15,y-7);
    ctx.quadraticCurveTo(x,y-10,x-14,y-7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle='rgba(245,211,166,.15)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x-12,y-8); ctx.lineTo(x,y-18.5); ctx.lineTo(x+13,y-8); ctx.stroke();

    ctx.fillStyle='#594234';
    roundedRect(x-3,y,6,9,1.5); ctx.fill();
    ctx.fillStyle='#2f241d'; ctx.beginPath(); ctx.arc(x+1.5,y+4.5,.7,0,Math.PI*2); ctx.fill();

    var glowAlpha=.28+night*.85;
    ctx.fillStyle='rgba(255,211,105,'+glowAlpha.toFixed(2)+')';
    roundedRect(x+4,y-2,4.5,4.5,1); ctx.fill();
    ctx.strokeStyle='rgba(95,65,45,.5)'; ctx.lineWidth=.7;
    ctx.beginPath(); ctx.moveTo(x+6.25,y-2); ctx.lineTo(x+6.25,y+2.5); ctx.moveTo(x+4,y+.25); ctx.lineTo(x+8.5,y+.25); ctx.stroke();

    ctx.fillStyle='#5f4436'; ctx.fillRect(x+6,y-19,3.2,7);
    var puff=(Math.sin(tNow*1.3+b.x*.02)+1)/2;
    ctx.fillStyle='rgba(235,232,218,'+(0.13+puff*.10)+')';
    ctx.beginPath(); ctx.arc(x+8,y-22-puff*3,2+puff*.8,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x+10,y-26-puff*4,1.4+puff*.7,0,Math.PI*2); ctx.fill();
  }

  function drawMarket(b,tNow){
    var x=b.x,y=b.y;
    ctx.fillStyle='rgba(36,43,33,.28)';
    ctx.beginPath(); ctx.ellipse(x+1,y+10,22,4,0,0,Math.PI*2); ctx.fill();

    ctx.strokeStyle='#574435'; ctx.lineWidth=2.4;
    ctx.beginPath(); ctx.moveTo(x-17,y-8); ctx.lineTo(x-17,y+8); ctx.moveTo(x+17,y-8); ctx.lineTo(x+17,y+8); ctx.stroke();

    ctx.fillStyle='#8e6848';
    roundedRect(x-18,y+1,36,9,2); ctx.fill();
    ctx.fillStyle='#6f5038'; ctx.fillRect(x-15,y+3,30,2);

    var awning=['#c77457','#ead3a1'];
    for(var i=0;i<6;i++){
      ctx.fillStyle=awning[i%2];
      ctx.beginPath();
      ctx.moveTo(x-19+i*6.3,y-8);
      ctx.lineTo(x-13+i*6.3,y-8);
      ctx.lineTo(x-11+i*6.3,y);
      ctx.lineTo(x-21+i*6.3,y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle='#e5b95e';
    for(i=0;i<4;i++){
      ctx.beginPath(); ctx.arc(x-10+i*6,y+3.5,1.5,0,Math.PI*2); ctx.fill();
    }

    var flutter=Math.sin(tNow*2.2)*2.3;
    ctx.strokeStyle='#574435'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x,y-8); ctx.lineTo(x,y-24); ctx.stroke();
    ctx.fillStyle='#bf6855';
    ctx.beginPath(); ctx.moveTo(x,y-24); ctx.lineTo(x+10+flutter,y-20); ctx.lineTo(x,y-16); ctx.closePath(); ctx.fill();
  }

  function drawAgent(a,tNow){
    var before=visualPositions.get(a.id)||a;
    var blend=Math.min(1,(performance.now()-receivedAt)/5000);
    var ax=before.x+(a.x-before.x)*blend;
    var ay=before.y+(a.y-before.y)*blend;
    var phase=a.id*1.618;
    var moving=a.state==='moving', working=a.state==='working';
    var bob=Math.sin(tNow*(moving?7.5:working?9:2.4)+phase)*(moving?1.3:working?.8:.35);
    var step=moving?Math.sin(tNow*8+phase)*2.2:0;
    var shirt=roleColor(a.role), dark=roleDark(a.role);
    var headY=ay-19-bob, bodyY=ay-12-bob;

    ctx.fillStyle='rgba(31,40,32,.28)';
    ctx.beginPath(); ctx.ellipse(ax,ay+2,7.2,2.4,0,0,Math.PI*2); ctx.fill();

    if(a.id===S.selectedId){
      ctx.strokeStyle='rgba(255,232,166,.92)';
      ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.ellipse(ax,ay+1,9.5,4.2,0,0,Math.PI*2); ctx.stroke();
      var pulse=(Math.sin(tNow*4)+1)/2;
      ctx.fillStyle='rgba(255,240,191,'+(0.45+pulse*.3)+')';
      ctx.beginPath();
      ctx.moveTo(ax,headY-8-pulse*2);
      ctx.lineTo(ax-3.5,headY-13-pulse*2);
      ctx.lineTo(ax+3.5,headY-13-pulse*2);
      ctx.closePath(); ctx.fill();
    }

    ctx.strokeStyle='#44382f'; ctx.lineWidth=2.2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(ax-2,bodyY+8); ctx.lineTo(ax-2-step*.35,ay); ctx.moveTo(ax+2,bodyY+8); ctx.lineTo(ax+2+step*.35,ay); ctx.stroke();

    var bg=ctx.createLinearGradient(ax-6,bodyY,ax+6,bodyY+10);
    bg.addColorStop(0,lerpColor(shirt,'#ffffff',.14));
    bg.addColorStop(1,dark);
    ctx.fillStyle=bg;
    ctx.beginPath();
    ctx.moveTo(ax-5.4,bodyY);
    ctx.quadraticCurveTo(ax,bodyY-2,ax+5.4,bodyY);
    ctx.lineTo(ax+4.4,bodyY+9);
    ctx.quadraticCurveTo(ax,bodyY+11,ax-4.4,bodyY+9);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle=shirt; ctx.lineWidth=2.1;
    var armSwing=moving?step:working?Math.sin(tNow*9+phase)*3:0;
    ctx.beginPath();
    ctx.moveTo(ax-4,bodyY+2); ctx.lineTo(ax-7-armSwing*.25,bodyY+7+armSwing*.25);
    ctx.moveTo(ax+4,bodyY+2); ctx.lineTo(ax+7+armSwing*.25,bodyY+7-armSwing*.25);
    ctx.stroke();

    var skin='#dfb286';
    ctx.fillStyle=skin;
    ctx.beginPath(); ctx.arc(ax,headY,4.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=dark;
    ctx.beginPath();
    ctx.arc(ax,headY-1.3,4.6,Math.PI,Math.PI*2);
    ctx.lineTo(ax+3.5,headY-1.5);
    ctx.quadraticCurveTo(ax,headY-4,ax-4,headY-1);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle='rgba(54,43,33,.72)';
    ctx.beginPath(); ctx.arc(ax-1.5,headY+.4,.45,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(ax+1.5,headY+.4,.45,0,Math.PI*2); ctx.fill();

    if(working){
      var swing=Math.sin(tNow*8.5+phase)*.55;
      ctx.save();
      ctx.translate(ax+7,bodyY+7);
      ctx.rotate(swing);
      ctx.strokeStyle='#69523b'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(0,-4); ctx.lineTo(0,5); ctx.stroke();
      ctx.strokeStyle='#aeb6b4'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-2.5,-4); ctx.lineTo(2.5,-4); ctx.stroke();
      ctx.restore();
    }

    var icon=null, iconColor='#fff2c2';
    if(a.state==='resting'){ icon='z'; }
    else if(a.state==='socializing'){ icon='♥'; iconColor='#f1a7a5'; }
    else if(a.hunger>=72){ icon='!'; iconColor='#f3cd68'; }
    if(icon){
      var by=headY-10+Math.sin(tNow*2.8+phase)*1.4;
      ctx.fillStyle='rgba(34,44,36,.74)';
      ctx.beginPath(); ctx.arc(ax,by-1,5,0,Math.PI*2); ctx.fill();
      ctx.font='600 7px "DM Sans", Arial, sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle=iconColor; ctx.fillText(icon,ax,by-1);
    }
  }

  function drawAtmosphere(tNow){
    var bright=Math.max(0,Math.sin(S.time*Math.PI));
    var nightAlpha=Math.max(0,.56-bright*.64);

    if(nightAlpha>0){
      ctx.fillStyle='rgba(19,34,52,'+nightAlpha.toFixed(3)+')';
      ctx.fillRect(0,0,CFG.W,CFG.H);

      var fireAlpha=clamp(nightAlpha*1.6,0,.55);
      for(var i=0;i<18;i++){
        var x=hash2(i,71)*CFG.W;
        var y=55+hash2(i,72)*(CFG.H-72);
        var tw=.25+.75*((Math.sin(tNow*1.6+i*2.1)+1)/2);
        ctx.fillStyle='rgba(248,224,133,'+(fireAlpha*tw).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(x,y,0.6+tw*.65,0,Math.PI*2); ctx.fill();
      }
    }

    var dawn=Math.max(0,1-Math.abs(S.time-.23)*7);
    var dusk=Math.max(0,1-Math.abs(S.time-.78)*6);
    var warm=Math.max(dawn,dusk);
    if(warm>.01){
      var og=ctx.createLinearGradient(0,0,CFG.W,CFG.H);
      og.addColorStop(0,'rgba(255,181,111,'+(warm*.16).toFixed(3)+')');
      og.addColorStop(1,'rgba(255,126,89,'+(warm*.05).toFixed(3)+')');
      ctx.fillStyle=og; ctx.fillRect(0,0,CFG.W,CFG.H);
    }

    var vg=ctx.createRadialGradient(CFG.W*.5,CFG.H*.48,CFG.H*.18,CFG.W*.5,CFG.H*.48,CFG.W*.63);
    vg.addColorStop(.65,'rgba(18,30,22,0)');
    vg.addColorStop(1,'rgba(17,28,21,.24)');
    ctx.fillStyle=vg; ctx.fillRect(0,0,CFG.W,CFG.H);
  }

  function draw(){
    var tNow=performance.now()/1000;
    ctx.save();
    ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);
    drawGround(tNow);
    drawPaths();
    drawPond(tNow);

    var i,bd;
    for(i=0;i<S.farms.length;i++) drawFarm(S.farms[i]);
    drawWell();
    for(i=0;i<S.bushes.length;i++) drawBush(S.bushes[i]);
    for(i=0;i<S.rocks.length;i++) drawRock(S.rocks[i]);
    for(i=0;i<S.trees.length;i++) drawTree(S.trees[i],tNow);
    for(i=0;i<S.buildings.length;i++){
      bd=S.buildings[i];
      if(bd.type==='house') drawHouse(bd,tNow); else drawMarket(bd,tNow);
    }

    var sorted=S.agents.slice().sort(function(p,q){ return p.y-q.y; });
    for(i=0;i<sorted.length;i++) drawAgent(sorted[i],tNow);
    drawAtmosphere(tNow);
    ctx.restore();
  }

  // ---------- HUD ----------
  function escapeHtml(s){
    return String(s).replace(/[&<>]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; });
  }
  function bar(label,val){
    var v=Math.max(0,Math.min(100,Math.round(val)));
    return '<div class="ac-bar-row"><span>'+label+'</span><div class="ac-bar"><div class="ac-bar-fill" style="width:'+v+'%"></div></div></div>';
  }
  function timeOfDayLabel(t){
    if(t<.16) return 'Night';
    if(t<.30) return 'Dawn';
    if(t<.47) return 'Morning';
    if(t<.56) return 'Noon';
    if(t<.75) return 'Afternoon';
    if(t<.88) return 'Dusk';
    return 'Night';
  }
  function updateHUD(){
    clockLabel.textContent='Day '+S.day+' · '+timeOfDayLabel(S.time);
    dayVal.textContent=S.day;
    popVal.textContent=S.agents.length;
    var houses=0, i;
    for(i=0;i<S.buildings.length;i++) if(S.buildings[i].type==='house') houses++;
    houseVal.textContent=houses;
    marketVal.textContent=S.market?'Open':'Not yet';

    var avgH=0,avgE=0,avgS=0,n=Math.max(1,S.agents.length);
    for(i=0;i<S.agents.length;i++){ avgH+=S.agents[i].hunger; avgE+=S.agents[i].energy; avgS+=S.agents[i].social; }
    var mood=Math.round(((100-avgH/n)+(avgE/n)+(avgS/n))/3);
    moodVal.textContent=S.agents.length?mood+'%':'--';

    var html='';
    for(i=0;i<S.log.length;i++){ html+='<li class="log-'+S.log[i].type+'">'+escapeHtml(S.log[i].msg)+'</li>'; }
    logList.innerHTML=html;

    if(S.selectedId!=null){
      var a=findById(S.agents,S.selectedId);
      if(a){
        agentCard.classList.remove('hidden');
        agentCard.innerHTML=
          '<div class="ac-name">'+escapeHtml(a.name)+'</div>'+
          '<div class="ac-role">'+(a.role?roleTitle(a.role):'Newcomer')+' · '+escapeHtml(a.trait)+' · day '+Math.floor(a.age)+' of life</div>'+
          (a.aiThought?'<div class="ac-thought">“'+escapeHtml(a.aiThought)+'”</div>':'')+
          '<div class="ac-bars">'+bar('Hunger',100-a.hunger)+bar('Energy',a.energy)+bar('Social',a.social)+'</div>'+
          '<div class="ac-inv">Wood '+a.inv.wood+' · Stone '+a.inv.stone+' · Food '+a.inv.food+' · Coins '+a.coins+'</div>'+
          '<div class="ac-home">'+(a.home?'Has a home':'No home yet')+'</div>';
      } else {
        S.selectedId=null;
        agentCard.classList.add('hidden');
      }
    } else {
      agentCard.classList.add('hidden');
    }
  }

  // ---------- input ----------
  function getWorldPos(evt){
    var rect=canvas.getBoundingClientRect();
    var cx=(evt.touches&&evt.touches.length)?evt.touches[0].clientX:evt.clientX;
    var cy=(evt.touches&&evt.touches.length)?evt.touches[0].clientY:evt.clientY;
    var scaleX=CFG.W/rect.width, scaleY=CFG.H/rect.height;
    return {x:(cx-rect.left)*scaleX,y:(cy-rect.top)*scaleY};
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

    canvas.addEventListener('click',function(e){
      if(!S) return;
      var p=getWorldPos(e);
      var best=null,bd=16;
      for(var i=0;i<S.agents.length;i++){
        var a=S.agents[i],d=Math.hypot(a.x-p.x,a.y-p.y);
        if(d<bd){ bd=d; best=a; }
      }
      S.selectedId=best?best.id:null;
      updateHUD();
    });

    var shareBtn=document.getElementById('shareBtn');
    if(shareBtn) shareBtn.addEventListener('click',shareVillage);

    var momentBtn=document.getElementById('momentBtn');
    if(momentBtn) momentBtn.addEventListener('click',shareMoment);
    var momentClose=document.getElementById('momentClose');
    if(momentClose) momentClose.addEventListener('click',function(){
      document.getElementById('momentOverlay').classList.remove('show');
    });
    var momentDownload=document.getElementById('momentDownload');
    if(momentDownload) momentDownload.addEventListener('click',downloadMoment);
  }

  // ---------- sharing ----------
  function pickMomentEntry(){
    if(!S.chronicle||!S.chronicle.length) return null;
    var preferred=['birth','market','build','social'];
    for(var p=0;p<preferred.length;p++){
      for(var i=S.chronicle.length-1;i>=0;i--){
        if(S.chronicle[i].type===preferred[p]) return S.chronicle[i];
      }
    }
    return S.chronicle[S.chronicle.length-1];
  }

  function buildMomentCard(){
    var moment=pickMomentEntry();
    var cardW=720,sceneH=456,textH=180;
    var card=document.createElement('canvas');
    card.width=cardW; card.height=sceneH+textH;
    var cctx=card.getContext('2d');

    cctx.fillStyle='#152119';
    cctx.fillRect(0,0,cardW,sceneH+textH);
    cctx.drawImage(canvas,0,0,cardW,sceneH);

    var panel=cctx.createLinearGradient(0,sceneH,cardW,sceneH+textH);
    panel.addColorStop(0,'#17231b'); panel.addColorStop(1,'#223027');
    cctx.fillStyle=panel; cctx.fillRect(0,sceneH,cardW,textH);

    cctx.fillStyle='#d9b96c';
    cctx.font='600 15px "DM Sans", Arial, sans-serif';
    cctx.textAlign='left';
    cctx.fillText('CLIVORIA · LIVE WORLD',24,sceneH+34);

    cctx.fillStyle='#aebcad';
    cctx.font='14px "DM Sans", Arial, sans-serif';
    var houses=0;
    for(var i=0;i<S.buildings.length;i++) if(S.buildings[i].type==='house') houses++;
    cctx.fillText('Day '+S.day+'  ·  '+S.agents.length+' villagers  ·  '+houses+' homes'+(S.market?'  ·  market open':''),24,sceneH+60);

    cctx.fillStyle='#f3f0e7';
    cctx.font='italic 23px Georgia, serif';
    var quote=moment?moment.msg:'A quiet day in the village.';
    wrapText(cctx,'“'+quote+'”',24,sceneH+104,cardW-48,30);
    return card;
  }

  function wrapText(cctx,text,x,y,maxWidth,lineHeight){
    var words=text.split(' '),line='',lines=[];
    for(var i=0;i<words.length;i++){
      var test=line+words[i]+' ';
      if(cctx.measureText(test).width>maxWidth&&line){ lines.push(line); line=words[i]+' '; }
      else { line=test; }
    }
    lines.push(line);
    lines=lines.slice(0,3);
    for(i=0;i<lines.length;i++) cctx.fillText(lines[i].trim(),x,y+i*lineHeight);
  }

  function shareMoment(){
    if(!S) return;
    var card;
    try{ card=buildMomentCard(); }catch(e){ showToast('Could not build a share card right now.'); return; }
    var dataUrl=card.toDataURL('image/png');
    var overlay=document.getElementById('momentOverlay');
    var img=document.getElementById('momentImg');
    if(overlay&&img){ img.src=dataUrl; overlay.classList.add('show'); }

    card.toBlob(function(blob){
      if(!blob) return;
      var file=new File([blob],'clivoria-day'+S.day+'.png',{type:'image/png'});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        var shareBtn2=document.getElementById('momentShareNow');
        if(shareBtn2){
          shareBtn2.onclick=function(){
            navigator.share({files:[file],title:'Clivoria',text:'Day '+S.day+' in the living world of Clivoria.'}).catch(function(){});
          };
        }
      }
    });
  }

  function downloadMoment(){
    var img=document.getElementById('momentImg');
    if(!img||!img.src) return;
    var a=document.createElement('a');
    a.href=img.src; a.download='clivoria-day'+S.day+'.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function showToast(msg){
    var t=document.getElementById('toast');
    if(!t) return;
    t.textContent=msg;
    t.classList.add('show');
    clearTimeout(showToast._h);
    showToast._h=setTimeout(function(){ t.classList.remove('show'); },2600);
  }

  function shareVillage(){
    if(!S) return;
    var url=location.href.split('#')[0];
    var houses=0;
    for(var i=0;i<S.buildings.length;i++) if(S.buildings[i].type==='house') houses++;
    var text='Clivoria is on day '+S.day+' with '+S.agents.length+' villagers and '+houses+' homes. Come watch the same living world:';
    if(navigator.share){
      navigator.share({title:'Clivoria',text:text,url:url}).catch(function(){});
    } else if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(function(){ showToast('Link copied to clipboard.'); })
        .catch(function(){ showToast('Copy this page address to share it.'); });
    } else {
      showToast('Copy this page address to share it.');
    }
  }

  // ---------- authoritative shared-world sync ----------
  function status(message){ document.getElementById('syncStatus').textContent=message; }

  async function sync(){
    if(document.hidden){ setTimeout(sync,5000); return; }
    try{
      var response=await fetch('/api/tick',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw new Error('unavailable');
      var data=await response.json();
      if(!data.state||!Array.isArray(data.state.agents)) throw new Error('invalid');
      if(data.revision>=revision){
        var selected=S?S.selectedId:null;
        if(data.revision>revision){
          var blend=Math.min(1,(performance.now()-receivedAt)/5000);
          var previous=new Map();
          if(S){
            S.agents.forEach(function(a){
              var p=visualPositions.get(a.id)||a;
              previous.set(a.id,{x:p.x+(a.x-p.x)*blend,y:p.y+(a.y-p.y)*blend});
            });
          }
          visualPositions=previous;
          receivedAt=performance.now();
        }
        S=data.state;
        S.selectedId=selected;
        revision=data.revision;
        updateHUD();
      }
      status('Shared world · Live · Day '+S.day+(data.catchUpSeconds?' · caught up '+data.catchUpSeconds+'s':''));
      document.getElementById('liveLabel').textContent='live';
    }catch(e){
      document.getElementById('liveLabel').textContent=S?'reconnecting':'connecting';
      status(S?'Connection interrupted · Showing last shared state · Retrying…':'Connecting to the shared world… Retrying shortly.');
    }
    if(!stopped) setTimeout(sync,5000);
  }

  function frame(){
    if(S) draw();
    requestAnimationFrame(frame);
  }

  function boot(){
    canvas=document.getElementById('world');
    canvas.width=CFG.W*RENDER_SCALE;
    canvas.height=CFG.H*RENDER_SCALE;
    ctx=canvas.getContext('2d',{alpha:false});
    ctx.imageSmoothingEnabled=true;
    wireUI();
    sync();
    requestAnimationFrame(frame);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();