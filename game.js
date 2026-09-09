(function(){
  "use strict";

  var WORLD={W:480,H:304};
  var CFG={W:480,H:356,horizon:78};
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
    var a=hexToRgb(c1),b=hexToRgb(c2);
    var r=Math.round(a.r+(b.r-a.r)*t),g=Math.round(a.g+(b.g-a.g)*t),bl=Math.round(a.b+(b.b-a.b)*t);
    return 'rgb('+r+','+g+','+bl+')';
  }
  function hash2(x,y){
    var n=Math.sin(Number(x)*127.1+Number(y)*311.7)*43758.5453123;
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
    return {woodcutter:'#b86f46',farmer:'#688f54',miner:'#727f89',trader:'#b48c3e'}[role]||'#748e73';
  }
  function roleDark(role){
    return {woodcutter:'#5b392a',farmer:'#40583a',miner:'#48515a',trader:'#64502d'}[role]||'#465747';
  }
  function roleTitle(role){ return role.charAt(0).toUpperCase()+role.slice(1); }

  function worldToScreen(x,y){
    var d=clamp(y/WORLD.H,0,1);
    var spread=.76+.24*d;
    return {
      x:CFG.W*.5+(x-WORLD.W*.5)*spread,
      y:CFG.horizon+y*.78,
      scale:.76+.36*d,
      depth:d
    };
  }
  function screenToWorld(x,y){
    var wy=(y-CFG.horizon)/.78;
    wy=clamp(wy,0,WORLD.H);
    var d=clamp(wy/WORLD.H,0,1);
    var spread=.76+.24*d;
    var wx=WORLD.W*.5+(x-CFG.W*.5)/spread;
    return {x:clamp(wx,0,WORLD.W),y:wy};
  }
  function withWorldTransform(x,y,fn,yscale){
    var p=worldToScreen(x,y);
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.scale(p.scale,p.scale*(yscale||1));
    fn(p);
    ctx.restore();
  }

  // ---------- living 2.5D world ----------
  function skyColors(){
    var bright=Math.max(0,Math.sin(S.time*Math.PI));
    var top=lerpColor('#142137','#7fabb1',bright);
    var bottom=lerpColor('#2b3345','#d8c69d',bright);
    return {top:top,bottom:bottom,bright:bright};
  }

  function drawSky(tNow){
    var sc=skyColors();
    var sky=ctx.createLinearGradient(0,0,0,CFG.horizon+52);
    sky.addColorStop(0,sc.top);
    sky.addColorStop(1,sc.bottom);
    ctx.fillStyle=sky;
    ctx.fillRect(0,0,CFG.W,CFG.H);

    var sunT=clamp((S.time-.12)/.76,0,1);
    if(S.time>.1&&S.time<.9){
      var sx=38+sunT*(CFG.W-76);
      var sy=58-Math.sin(sunT*Math.PI)*37;
      var rg=ctx.createRadialGradient(sx,sy,2,sx,sy,32);
      rg.addColorStop(0,'rgba(255,239,184,.94)');
      rg.addColorStop(.18,'rgba(255,221,143,.62)');
      rg.addColorStop(1,'rgba(255,215,126,0)');
      ctx.fillStyle=rg; ctx.fillRect(sx-34,sy-34,68,68);
      ctx.fillStyle='rgba(255,238,188,.82)';
      ctx.beginPath(); ctx.arc(sx,sy,6,0,Math.PI*2); ctx.fill();
    } else {
      var nightT=S.time<.1?S.time+.9:S.time-.1;
      var mx=60+nightT*(CFG.W-120);
      var my=48-Math.sin(nightT*Math.PI)*22;
      ctx.fillStyle='rgba(226,233,223,.76)';
      ctx.beginPath(); ctx.arc(mx,my,5.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(26,39,57,.76)';
      ctx.beginPath(); ctx.arc(mx+2,my-1,5.2,0,Math.PI*2); ctx.fill();
      for(var si=0;si<24;si++){
        var tw=.35+.65*((Math.sin(tNow*1.8+si*1.91)+1)/2);
        ctx.fillStyle='rgba(235,239,220,'+(.18*tw).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(hash2(si,81)*CFG.W,8+hash2(si,82)*64,.45+tw*.35,0,Math.PI*2); ctx.fill();
      }
    }

    for(var i=0;i<5;i++){
      var speed=3.5+i*.85;
      var cx=((tNow*speed+hash2(i,91)*560)%620)-70;
      var cy=20+hash2(i,92)*44;
      var alpha=.07+sc.bright*.11;
      ctx.fillStyle='rgba(247,242,224,'+alpha.toFixed(3)+')';
      var s=.65+hash2(i,93)*.7;
      ctx.beginPath();
      ctx.ellipse(cx,cy,24*s,7*s,0,0,Math.PI*2);
      ctx.ellipse(cx+18*s,cy+1,18*s,6*s,0,0,Math.PI*2);
      ctx.ellipse(cx-15*s,cy+2,15*s,5*s,0,0,Math.PI*2);
      ctx.fill();
    }
  }

  function drawDistantLandscape(){
    var sc=skyColors();
    var back=lerpColor('#263844','#607a6d',sc.bright);
    var mid=lerpColor('#1f3138','#4c6759',sc.bright);

    ctx.fillStyle=back;
    ctx.beginPath();
    ctx.moveTo(0,CFG.horizon+14);
    ctx.lineTo(0,55);
    ctx.lineTo(56,29); ctx.lineTo(99,58); ctx.lineTo(151,25); ctx.lineTo(211,60);
    ctx.lineTo(270,31); ctx.lineTo(320,58); ctx.lineTo(380,34); ctx.lineTo(432,60); ctx.lineTo(480,40);
    ctx.lineTo(480,CFG.horizon+18); ctx.closePath(); ctx.fill();

    ctx.fillStyle=mid;
    ctx.beginPath();
    ctx.moveTo(0,CFG.horizon+20);
    ctx.lineTo(0,68);
    ctx.bezierCurveTo(70,49,120,75,175,58);
    ctx.bezierCurveTo(240,39,297,75,352,57);
    ctx.bezierCurveTo(407,42,446,69,480,55);
    ctx.lineTo(480,CFG.horizon+22); ctx.closePath(); ctx.fill();

    for(var i=0;i<42;i++){
      var x=-12+i*12+hash2(i,101)*5;
      var y=CFG.horizon+2+hash2(i,102)*7;
      var r=8+hash2(i,103)*6;
      ctx.fillStyle=i%3===0?'#385745':'#2f4b3c';
      ctx.beginPath(); ctx.arc(x,y-r*.38,r,0,Math.PI*2); ctx.fill();
    }
  }

  function drawMeadow(tNow){
    var topL=worldToScreen(0,0),topR=worldToScreen(WORLD.W,0);
    var botL=worldToScreen(0,WORLD.H),botR=worldToScreen(WORLD.W,WORLD.H);
    var meadow=ctx.createLinearGradient(0,CFG.horizon,0,CFG.H);
    meadow.addColorStop(0,'#6f8a61');
    meadow.addColorStop(.52,'#789565');
    meadow.addColorStop(1,'#526f4d');
    ctx.fillStyle=meadow;
    ctx.beginPath();
    ctx.moveTo(topL.x,topL.y-2); ctx.lineTo(topR.x,topR.y-2);
    ctx.lineTo(botR.x,botR.y+45); ctx.lineTo(botL.x,botL.y+45); ctx.closePath(); ctx.fill();

    var edge=ctx.createLinearGradient(0,CFG.horizon,0,CFG.horizon+35);
    edge.addColorStop(0,'rgba(31,62,43,.48)');
    edge.addColorStop(1,'rgba(31,62,43,0)');
    ctx.fillStyle=edge;
    ctx.fillRect(topL.x,CFG.horizon-1,topR.x-topL.x,38);

    for(var i=0;i<145;i++){
      var wx=hash2(i,111)*WORLD.W,wy=hash2(i,112)*WORLD.H;
      var p=worldToScreen(wx,wy);
      var blade=1.5+p.scale*2.2;
      var sway=Math.sin(tNow*1.2+i)*.65;
      ctx.strokeStyle='rgba(39,79,42,'+(.09+.08*p.depth).toFixed(3)+')';
      ctx.lineWidth=.55+p.depth*.25;
      ctx.beginPath(); ctx.moveTo(p.x,p.y+1); ctx.quadraticCurveTo(p.x+sway,p.y-blade*.55,p.x+sway*.8,p.y-blade); ctx.stroke();
      if(hash2(i,113)>.88){
        ctx.fillStyle=hash2(i,114)>.5?'rgba(239,218,155,.48)':'rgba(222,178,169,.42)';
        ctx.beginPath(); ctx.arc(p.x+sway*.8,p.y-blade,0.7+p.depth*.4,0,Math.PI*2); ctx.fill();
      }
    }
  }

  function strokeWorldPath(x1,y1,x2,y2,width){
    var cx=(x1+x2)/2+(y2-y1)*.06;
    var cy=(y1+y2)/2;
    function path(){
      ctx.beginPath();
      for(var s=0;s<=22;s++){
        var t=s/22,mt=1-t;
        var wx=mt*mt*x1+2*mt*t*cx+t*t*x2;
        var wy=mt*mt*y1+2*mt*t*cy+t*t*y2;
        var p=worldToScreen(wx,wy);
        if(s===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y);
      }
    }
    var avg=worldToScreen((x1+x2)/2,(y1+y2)/2).scale;
    ctx.lineCap='round'; ctx.lineJoin='round';
    path(); ctx.strokeStyle='rgba(64,55,38,.23)'; ctx.lineWidth=width*avg+3.5; ctx.stroke();
    path(); ctx.strokeStyle='rgba(205,184,137,.50)'; ctx.lineWidth=width*avg; ctx.stroke();
    path(); ctx.strokeStyle='rgba(245,229,181,.10)'; ctx.lineWidth=Math.max(1,width*avg*.22); ctx.stroke();
  }

  function drawPaths(){
    if(!S||!S.well) return;
    for(var i=0;i<S.buildings.length;i++){
      strokeWorldPath(S.well.x,S.well.y,S.buildings[i].x,S.buildings[i].y+8,S.buildings[i].type==='market'?8:6);
    }
    for(i=0;i<S.farms.length;i++) if(i<4) strokeWorldPath(S.well.x,S.well.y,S.farms[i].x,S.farms[i].y,4.2);
  }

  function drawPond(tNow){
    var p=S.pond;
    withWorldTransform(p.x,p.y,function(){
      var w=p.w/2,h=p.h/2*.58;
      ctx.fillStyle='rgba(28,47,44,.24)';
      ctx.beginPath(); ctx.ellipse(2,5,w+6,h+4,-.04,0,Math.PI*2); ctx.fill();
      var water=ctx.createLinearGradient(-w,-h,w,h);
      water.addColorStop(0,'#82b2ac'); water.addColorStop(.52,'#568f91'); water.addColorStop(1,'#376b72');
      ctx.fillStyle=water;
      ctx.beginPath();
      ctx.moveTo(-w+6,-h+1);
      ctx.bezierCurveTo(-w-4,-h*.2,-w+1,h*.8,-w*.53,h);
      ctx.bezierCurveTo(-w*.06,h+3,w*.43,h*.92,w*.82,h*.5);
      ctx.bezierCurveTo(w+4,h*.08,w,-h*.65,w*.52,-h);
      ctx.bezierCurveTo(w*.12,-h-3,-w*.36,-h+1,-w+6,-h+1); ctx.closePath(); ctx.fill();
      for(var i=0;i<5;i++){
        var wave=Math.sin(tNow*1.1+i*1.8)*4;
        ctx.strokeStyle='rgba(251,244,216,'+(.09+i*.022)+')'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(-w*.72+i*3,-h*.42+i*4); ctx.quadraticCurveTo(-w*.12+wave,-h*.28+i*4,w*.38+wave,-h*.35+i*4); ctx.stroke();
      }
      ctx.strokeStyle='#506d45'; ctx.lineWidth=1.1;
      for(i=0;i<10;i++){
        var bx=-w-1+i*2.1,by=h*.45+Math.sin(i)*2.5;
        ctx.beginPath(); ctx.moveTo(bx,by+7); ctx.quadraticCurveTo(bx-1,by,bx+Math.sin(i)*2,by-7-hash2(i,123)*3); ctx.stroke();
      }
      for(i=0;i<3;i++){
        var lx=-w*.18+i*w*.34,ly=h*.17+(i%2)*4;
        ctx.fillStyle='rgba(67,103,64,.72)'; ctx.beginPath(); ctx.ellipse(lx,ly,4,2.2,-.2,0,Math.PI*2); ctx.fill();
      }
    },.9);
  }

  function drawFarm(f){
    var growth=clamp(f.growth||0,0,1);
    withWorldTransform(f.x,f.y,function(){
      ctx.scale(1,.7);
      ctx.fillStyle='rgba(43,42,29,.22)'; roundedRect(-18,-10,36,24,5); ctx.fill();
      var soil=ctx.createLinearGradient(0,-12,0,12); soil.addColorStop(0,'#806247'); soil.addColorStop(1,'#5a4333');
      ctx.fillStyle=soil; roundedRect(-17,-12,34,22,4); ctx.fill();
      for(var row=0;row<4;row++){
        var y=-8+row*5;
        ctx.strokeStyle='rgba(44,28,21,.38)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(-14,y); ctx.quadraticCurveTo(0,y+1,14,y); ctx.stroke();
        if(f.planted){
          for(var col=0;col<6;col++){
            var x=-12+col*4.8,hh=2+growth*6;
            ctx.strokeStyle=lerpColor('#6d8e4d','#c2aa43',growth); ctx.lineWidth=1;
            ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-hh); ctx.stroke();
            if(growth>.48){ ctx.fillStyle=growth>.87?'#d6bb4e':'#8fac50'; ctx.beginPath(); ctx.ellipse(x-1,y-hh*.55,1.8,.9,-.45,0,Math.PI*2); ctx.fill(); }
          }
        }
      }
    });
  }

  function drawBush(b){
    withWorldTransform(b.x,b.y,function(){
      var fullness=clamp((b.food||0)/Math.max(1,b.max||5),0,1);
      ctx.fillStyle='rgba(29,49,30,.22)'; ctx.beginPath(); ctx.ellipse(1,5,10,3,0,0,Math.PI*2); ctx.fill();
      var shades=['#3d663f','#4d7a48','#5d8c55'];
      var blobs=[[-5,0,5.5],[1,-3,6.5],[6,1,5],[-1,3,5.5]];
      for(var i=0;i<blobs.length;i++){ ctx.fillStyle=shades[i%shades.length]; ctx.beginPath(); ctx.arc(blobs[i][0],blobs[i][1],blobs[i][2],0,Math.PI*2); ctx.fill(); }
      var berries=Math.round(fullness*6);
      for(i=0;i<berries;i++){ var ang=i*2.17,rr=2.5+(i%2)*3.5; ctx.fillStyle='#bb5d57'; ctx.beginPath(); ctx.arc(Math.cos(ang)*rr,Math.sin(ang)*rr-1,1.25,0,Math.PI*2); ctx.fill(); }
    });
  }

  function drawRock(r){
    withWorldTransform(r.x,r.y,function(){
      var s=7+clamp((r.stone||0)/Math.max(1,r.max||1),0,1)*6;
      ctx.fillStyle='rgba(30,39,35,.25)'; ctx.beginPath(); ctx.ellipse(1,s*.7,s*1.08,2.8,0,0,Math.PI*2); ctx.fill();
      var rg=ctx.createLinearGradient(-s,-s,s,s); rg.addColorStop(0,'#cbc9c2'); rg.addColorStop(.52,'#8e9795'); rg.addColorStop(1,'#606d6b');
      ctx.fillStyle=rg; ctx.beginPath(); ctx.moveTo(-s,s*.55); ctx.lineTo(-s*.45,-s*.62); ctx.lineTo(s*.1,-s); ctx.lineTo(s*.72,-s*.34); ctx.lineTo(s,s*.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.24)'; ctx.beginPath(); ctx.moveTo(-s*.42,-s*.57); ctx.lineTo(s*.05,-s*.92); ctx.lineTo(s*.25,-s*.36); ctx.closePath(); ctx.fill();
      if(hash2(r.x,r.y)>.55){ ctx.fillStyle='rgba(106,132,83,.58)'; ctx.beginPath(); ctx.ellipse(-s*.35,s*.18,3,1.2,-.5,0,Math.PI*2); ctx.fill(); }
    });
  }

  function drawTree(t,tNow){
    withWorldTransform(t.x,t.y,function(){
      var fullness=clamp((t.wood||0)/Math.max(1,t.max||1),0,1);
      var sz=9+fullness*8,sway=Math.sin(tNow*.75+t.x*.03)*1.1;
      ctx.fillStyle='rgba(24,43,28,.24)'; ctx.beginPath(); ctx.ellipse(3,11,sz*.92,3.5,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#63482f'; ctx.lineWidth=4; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(0,9); ctx.quadraticCurveTo(sway*.2,-2,sway,-sz*.55); ctx.stroke();
      var tg=ctx.createRadialGradient(-4,-sz*.9,2,0,-sz*.55,sz*1.12); tg.addColorStop(0,'#7fa16a'); tg.addColorStop(.55,'#4e7a4b'); tg.addColorStop(1,'#2f5939');
      ctx.fillStyle=tg;
      ctx.beginPath(); ctx.arc(-5+sway,-sz*.7,sz*.78,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(5+sway*.8,-sz*.5,sz*.73,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(sway*.9,-sz,sz*.67,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(2+sway*.7,-sz*1.25,sz*.48,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(218,229,181,.16)'; ctx.beginPath(); ctx.arc(-6+sway,-sz*1.12,sz*.31,0,Math.PI*2); ctx.fill();
    });
  }

  function drawWell(){
    var w=S.well;
    withWorldTransform(w.x,w.y,function(){
      ctx.fillStyle='rgba(31,42,35,.25)'; ctx.beginPath(); ctx.ellipse(1,8,14,3.2,0,0,Math.PI*2); ctx.fill();
      var sg=ctx.createLinearGradient(-12,-8,12,8); sg.addColorStop(0,'#d0c0a1'); sg.addColorStop(1,'#776e60');
      ctx.fillStyle=sg; ctx.beginPath(); ctx.ellipse(0,0,11,5.5,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#2e5258'; ctx.beginPath(); ctx.ellipse(0,0,7.5,3.1,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#6b5039'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(-9,-1); ctx.lineTo(-9,-15); ctx.moveTo(9,-1); ctx.lineTo(9,-15); ctx.stroke();
      ctx.strokeStyle='#76543a'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-12,-16); ctx.lineTo(12,-16); ctx.stroke();
      ctx.strokeStyle='#9c8060'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,-15); ctx.lineTo(0,-3); ctx.stroke();
    });
  }

  function housePalette(b){
    var n=hash2(b.x,b.y);
    if(n<.33) return {wall1:'#d8bc88',wall2:'#b27f55',roof1:'#784b38',roof2:'#4f3128',trim:'#ede0bd'};
    if(n<.66) return {wall1:'#cbb38f',wall2:'#98765f',roof1:'#56604d',roof2:'#384136',trim:'#e6ddc6'};
    return {wall1:'#d3a982',wall2:'#aa7059',roof1:'#6d3f3f',roof2:'#493039',trim:'#f0dbb6'};
  }

  function drawHouse(b,tNow){
    withWorldTransform(b.x,b.y,function(){
      var pal=housePalette(b),night=Math.max(0,.64-Math.max(0,Math.sin(S.time*Math.PI))*.72);
      var variant=hash2(b.x+7,b.y+3);
      ctx.fillStyle='rgba(34,40,31,.30)'; ctx.beginPath(); ctx.ellipse(3,11,22,5,0,0,Math.PI*2); ctx.fill();

      if(variant>.44){
        ctx.strokeStyle='rgba(92,76,54,.48)'; ctx.lineWidth=1.4;
        ctx.beginPath(); ctx.moveTo(-22,8); ctx.lineTo(-22,-1); ctx.moveTo(-17,8); ctx.lineTo(-17,-1); ctx.moveTo(17,8); ctx.lineTo(17,-1); ctx.moveTo(22,8); ctx.lineTo(22,-1); ctx.moveTo(-24,3); ctx.lineTo(-14,3); ctx.moveTo(14,3); ctx.lineTo(24,3); ctx.stroke();
      }

      var wall=ctx.createLinearGradient(-15,-8,15,11); wall.addColorStop(0,pal.wall1); wall.addColorStop(1,pal.wall2);
      ctx.fillStyle=wall; roundedRect(-15,-9,30,21,3); ctx.fill();
      ctx.fillStyle='rgba(86,60,43,.13)'; for(var i=0;i<4;i++) ctx.fillRect(-14,-4+i*4.5,28,.75);

      var roof=ctx.createLinearGradient(0,-26,0,-6); roof.addColorStop(0,pal.roof1); roof.addColorStop(1,pal.roof2);
      ctx.fillStyle=roof; ctx.beginPath(); ctx.moveTo(-19,-8); ctx.lineTo(0,-27); ctx.lineTo(20,-8); ctx.quadraticCurveTo(0,-12,-19,-8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(250,222,177,.12)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(-17,-9); ctx.lineTo(0,-25); ctx.lineTo(18,-9); ctx.stroke();

      ctx.fillStyle='#584133'; roundedRect(-4,1,8,11,1.5); ctx.fill();
      ctx.fillStyle='#2e251f'; ctx.beginPath(); ctx.arc(1.5,6.3,.75,0,Math.PI*2); ctx.fill();

      var wa=.25+night*.92;
      ctx.fillStyle='rgba(255,211,108,'+wa.toFixed(2)+')';
      roundedRect(6,-2,5.8,5.5,1); ctx.fill();
      ctx.strokeStyle='rgba(91,64,45,.52)'; ctx.lineWidth=.7; ctx.beginPath(); ctx.moveTo(8.9,-2); ctx.lineTo(8.9,3.5); ctx.moveTo(6,.75); ctx.lineTo(11.8,.75); ctx.stroke();
      ctx.fillStyle=pal.trim; ctx.fillRect(-12,8,5,2);

      ctx.fillStyle='#5c4033'; ctx.fillRect(8,-25,4,9);
      var puff=(Math.sin(tNow*1.25+b.x*.02)+1)/2;
      for(i=0;i<3;i++){
        ctx.fillStyle='rgba(236,234,221,'+(.10+puff*.07-i*.018)+')';
        ctx.beginPath(); ctx.arc(10+i*3, -29-i*5-puff*(2+i),2.3+i*.3,0,Math.PI*2); ctx.fill();
      }

      if(variant>.62){
        ctx.fillStyle='#6f8d55'; ctx.beginPath(); ctx.arc(-19,7,3.3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#c58c75'; ctx.beginPath(); ctx.arc(-20,5.5,.8,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(-17.5,7,.7,0,Math.PI*2); ctx.fill();
      }
    });
  }

  function drawMarket(b,tNow){
    withWorldTransform(b.x,b.y,function(){
      ctx.fillStyle='rgba(34,40,31,.30)'; ctx.beginPath(); ctx.ellipse(2,13,29,5.5,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#594533'; ctx.lineWidth=2.7; ctx.beginPath(); ctx.moveTo(-22,-9); ctx.lineTo(-22,12); ctx.moveTo(22,-9); ctx.lineTo(22,12); ctx.stroke();
      ctx.fillStyle='#8e6544'; roundedRect(-24,3,48,12,2); ctx.fill();
      ctx.fillStyle='#6e4d36'; ctx.fillRect(-20,6,40,2);
      var awning=['#b95f4f','#ead29e'];
      for(var i=0;i<8;i++){
        ctx.fillStyle=awning[i%2]; ctx.beginPath(); ctx.moveTo(-25+i*6.3,-10); ctx.lineTo(-19+i*6.3,-10); ctx.lineTo(-17+i*6.3,2); ctx.lineTo(-27+i*6.3,2); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle='#d4a850'; for(i=0;i<5;i++){ ctx.beginPath(); ctx.arc(-14+i*7,5.5,1.7,0,Math.PI*2); ctx.fill(); }
      ctx.fillStyle='#7d5439'; roundedRect(-28,9,7,8,1); ctx.fill(); roundedRect(20,10,8,7,1); ctx.fill();
      ctx.fillStyle='#6f9255'; ctx.beginPath(); ctx.arc(-24,7,2.5,0,Math.PI*2); ctx.fill();
      var flutter=Math.sin(tNow*2.1)*2.5;
      ctx.strokeStyle='#574435'; ctx.lineWidth=1.8; ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(0,-31); ctx.stroke();
      ctx.fillStyle='#c06650'; ctx.beginPath(); ctx.moveTo(0,-31); ctx.lineTo(13+flutter,-26); ctx.lineTo(0,-21); ctx.closePath(); ctx.fill();
      var night=Math.max(0,.64-Math.max(0,Math.sin(S.time*Math.PI))*.72);
      for(i=0;i<4;i++){
        var lx=-16+i*10.5;
        ctx.strokeStyle='rgba(78,63,45,.7)'; ctx.lineWidth=.7; ctx.beginPath(); ctx.moveTo(lx,-10); ctx.lineTo(lx,-5); ctx.stroke();
        ctx.fillStyle='rgba(255,203,92,'+(.22+night*.75).toFixed(2)+')'; ctx.beginPath(); ctx.arc(lx,-3.5,1.6,0,Math.PI*2); ctx.fill();
      }
    });
  }

  function villagerStyle(a){
    var skin=['#f0c7a0','#ddb184','#c98f67','#a96f50','#7f523f'];
    var hair=['#30251f','#5c4030','#7a5a3e','#2e3033','#a16f46'];
    var idx=Number(a.id)||1;
    return {
      skin:skin[Math.floor(hash2(idx,141)*skin.length)%skin.length],
      hair:hair[Math.floor(hash2(idx,142)*hair.length)%hair.length],
      hairType:Math.floor(hash2(idx,143)*4),
      accent:hash2(idx,144)>.5?'#d4c29a':'#a7bac0'
    };
  }

  function drawAgent(a,tNow){
    var before=visualPositions.get(a.id)||a;
    var blend=Math.min(1,(performance.now()-receivedAt)/5000);
    var wx=before.x+(a.x-before.x)*blend,wy=before.y+(a.y-before.y)*blend;
    var p=worldToScreen(wx,wy),phase=a.id*1.618;
    var moving=a.state==='moving',working=a.state==='working';
    var bob=Math.sin(tNow*(moving?7.2:working?8.6:2.2)+phase)*(moving?1.25:working?.75:.35);
    var step=moving?Math.sin(tNow*7.8+phase)*2.5:0;
    var shirt=roleColor(a.role),dark=roleDark(a.role),st=villagerStyle(a);

    ctx.save(); ctx.translate(p.x,p.y); ctx.scale(p.scale,p.scale);
    var headY=-22-bob,bodyY=-14-bob;
    ctx.fillStyle='rgba(28,37,29,.30)'; ctx.beginPath(); ctx.ellipse(0,2,8.5,2.7,0,0,Math.PI*2); ctx.fill();

    if(a.id===S.selectedId){
      ctx.strokeStyle='rgba(255,229,153,.95)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.ellipse(0,1,11,4.5,0,0,Math.PI*2); ctx.stroke();
      var pulse=(Math.sin(tNow*4)+1)/2;
      ctx.fillStyle='rgba(255,240,191,'+(.48+pulse*.32)+')'; ctx.beginPath(); ctx.moveTo(0,headY-10-pulse*2); ctx.lineTo(-4,headY-15-pulse*2); ctx.lineTo(4,headY-15-pulse*2); ctx.closePath(); ctx.fill();
    }

    ctx.strokeStyle='#40352e'; ctx.lineWidth=2.4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-2.2,bodyY+10); ctx.lineTo(-2.2-step*.4,0); ctx.moveTo(2.2,bodyY+10); ctx.lineTo(2.2+step*.4,0); ctx.stroke();

    var bg=ctx.createLinearGradient(-7,bodyY,7,bodyY+12); bg.addColorStop(0,lerpColor(shirt,'#ffffff',.16)); bg.addColorStop(1,dark);
    ctx.fillStyle=bg; ctx.beginPath(); ctx.moveTo(-6.5,bodyY); ctx.quadraticCurveTo(0,bodyY-2.5,6.5,bodyY); ctx.lineTo(5.1,bodyY+11); ctx.quadraticCurveTo(0,bodyY+13,-5.1,bodyY+11); ctx.closePath(); ctx.fill();

    var armSwing=moving?step:working?Math.sin(tNow*8.7+phase)*3:0;
    ctx.strokeStyle=shirt; ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(-5,bodyY+2); ctx.lineTo(-8-armSwing*.3,bodyY+8+armSwing*.25); ctx.moveTo(5,bodyY+2); ctx.lineTo(8+armSwing*.3,bodyY+8-armSwing*.25); ctx.stroke();

    // Return-leg prop only; canonical inventory remains unchanged.
    if(a.visualCarry){
      ctx.fillStyle=a.visualCarry==='tree'?'#92613c':a.visualCarry==='rock'?'#a3aba8':'#b79b54';
      roundedRect(-7,bodyY+5,14,6,2);ctx.fill();
      ctx.strokeStyle='#594735';ctx.lineWidth=.8;ctx.stroke();
    }
    if(a.role==='trader'){
      ctx.strokeStyle='#7a5438'; ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(-4,bodyY); ctx.lineTo(5,bodyY+10); ctx.stroke();
      ctx.fillStyle='#8c603c'; roundedRect(4,bodyY+6,4,5,1); ctx.fill();
    }
    if(a.role==='woodcutter'){
      ctx.fillStyle='#8c4e3d'; ctx.beginPath(); ctx.moveTo(-5,bodyY-1); ctx.lineTo(5,bodyY-1); ctx.lineTo(3,bodyY+2); ctx.lineTo(-3,bodyY+2); ctx.closePath(); ctx.fill();
    }

    ctx.fillStyle=st.skin; ctx.beginPath(); ctx.arc(0,headY,5.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=st.hair;
    if(st.hairType===0){ ctx.beginPath(); ctx.arc(0,headY-1.8,5.2,Math.PI,Math.PI*2); ctx.lineTo(4,headY-1); ctx.quadraticCurveTo(0,headY-4.8,-4.6,headY-1); ctx.closePath(); ctx.fill(); }
    else if(st.hairType===1){ ctx.beginPath(); ctx.arc(-1,headY-2,5.1,Math.PI,Math.PI*2); ctx.lineTo(4.7,headY+1); ctx.lineTo(3.5,headY-1); ctx.closePath(); ctx.fill(); }
    else if(st.hairType===2){ ctx.beginPath(); ctx.ellipse(0,headY-2.5,5.4,3.8,0,Math.PI,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(-4.3,headY-1,1.6,0,Math.PI*2); ctx.arc(4.1,headY-1,1.4,0,Math.PI*2); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(-5,headY-1); ctx.quadraticCurveTo(-2,headY-6,1,headY-5); ctx.quadraticCurveTo(5,headY-5,5,headY-1); ctx.lineTo(3,headY-2); ctx.lineTo(1,headY); ctx.lineTo(-1,headY-2); ctx.closePath(); ctx.fill(); }

    if(a.role==='farmer'){
      ctx.fillStyle='#c6aa59'; ctx.beginPath(); ctx.ellipse(0,headY-5.1,6.7,1.6,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#a8873f'; ctx.fillRect(-3.7,headY-8.3,7.4,3.3);
    } else if(a.role==='miner'){
      ctx.fillStyle='#8e9698'; ctx.beginPath(); ctx.arc(0,headY-3.1,5.3,Math.PI,Math.PI*2); ctx.fill();
      ctx.fillStyle='#c7bf7a'; ctx.beginPath(); ctx.arc(0,headY-5.8,1.2,0,Math.PI*2); ctx.fill();
    }

    ctx.fillStyle='rgba(48,39,32,.74)'; ctx.beginPath(); ctx.arc(-1.7,headY+.5,.5,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(1.7,headY+.5,.5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(100,62,48,.5)'; ctx.lineWidth=.6; ctx.beginPath(); ctx.arc(0,headY+1.6,1.3,.1*Math.PI,.9*Math.PI); ctx.stroke();

    if(working){
      var swing=Math.sin(tNow*8.5+phase)*.58;
      ctx.save(); ctx.translate(9,bodyY+8); ctx.rotate(swing); ctx.strokeStyle='#69523b'; ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(0,6); ctx.stroke(); ctx.strokeStyle='#b7c0be'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(-3,-5); ctx.lineTo(3,-5); ctx.stroke(); ctx.restore();
    }

    var icon=null,iconColor='#fff2c2';
    if(a.state==='resting') icon='z'; else if(a.state==='socializing'){ icon='♥'; iconColor='#f0a2a0'; } else if(a.hunger>=72){ icon='!'; iconColor='#f4cd66'; }
    if(icon){
      var by=headY-12+Math.sin(tNow*2.8+phase)*1.5;
      ctx.fillStyle='rgba(27,40,32,.80)'; ctx.beginPath(); ctx.arc(0,by-1,5.6,0,Math.PI*2); ctx.fill();
      ctx.font='600 7px "DM Sans", Arial, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=iconColor; ctx.fillText(icon,0,by-1);
    }
    ctx.restore();
  }

  function drawAmbientLife(tNow){
    var sc=skyColors();
    for(var i=0;i<3;i++){
      var flight=((tNow*(4+i)+hash2(i,151)*520)%600)-60;
      var y=35+i*12+Math.sin(tNow*.7+i)*4;
      ctx.strokeStyle='rgba(42,50,44,'+(.22+.18*sc.bright).toFixed(2)+')'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.arc(flight,y,4,Math.PI*1.05,Math.PI*1.75); ctx.arc(flight+8,y,4,Math.PI*1.25,Math.PI*1.95); ctx.stroke();
    }

    for(i=0;i<18;i++){
      var px=(hash2(i,152)*CFG.W+tNow*(1.2+hash2(i,153)*2.5))%CFG.W;
      var py=CFG.horizon+25+hash2(i,154)*(CFG.H-CFG.horizon-65)+Math.sin(tNow*.8+i)*5;
      ctx.fillStyle='rgba(236,223,169,'+(.05+sc.bright*.13).toFixed(3)+')'; ctx.beginPath(); ctx.arc(px,py,.6+hash2(i,155)*.8,0,Math.PI*2); ctx.fill();
    }
  }

  function drawAtmosphere(tNow){
    var bright=Math.max(0,Math.sin(S.time*Math.PI));
    var nightAlpha=Math.max(0,.58-bright*.66);
    if(nightAlpha>0){
      ctx.fillStyle='rgba(17,29,48,'+nightAlpha.toFixed(3)+')'; ctx.fillRect(0,0,CFG.W,CFG.H);
      var glow=clamp(nightAlpha*1.65,0,.68);
      for(var bi=0;bi<S.buildings.length;bi++){
        var b=S.buildings[bi],p=worldToScreen(b.x,b.y);
        var radius=(b.type==='market'?26:18)*p.scale;
        var rg=ctx.createRadialGradient(p.x,p.y-5*p.scale,1,p.x,p.y-5*p.scale,radius);
        rg.addColorStop(0,'rgba(255,198,92,'+(glow*.24).toFixed(3)+')'); rg.addColorStop(1,'rgba(255,198,92,0)');
        ctx.fillStyle=rg; ctx.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);
      }
      for(var i=0;i<22;i++){
        var x=hash2(i,161)*CFG.W,y=CFG.horizon+35+hash2(i,162)*(CFG.H-CFG.horizon-65);
        var tw=.25+.75*((Math.sin(tNow*1.7+i*2.3)+1)/2);
        ctx.fillStyle='rgba(248,224,126,'+(glow*.55*tw).toFixed(3)+')'; ctx.beginPath(); ctx.arc(x,y,.7+tw*.65,0,Math.PI*2); ctx.fill();
      }
    }

    var dawn=Math.max(0,1-Math.abs(S.time-.23)*7),dusk=Math.max(0,1-Math.abs(S.time-.78)*6),warm=Math.max(dawn,dusk);
    if(warm>.01){
      var og=ctx.createLinearGradient(0,0,CFG.W,CFG.H); og.addColorStop(0,'rgba(255,182,111,'+(warm*.18).toFixed(3)+')'); og.addColorStop(1,'rgba(255,119,88,'+(warm*.06).toFixed(3)+')'); ctx.fillStyle=og; ctx.fillRect(0,0,CFG.W,CFG.H);
    }
    if(dawn>.08){
      for(var f=0;f<3;f++){
        var fy=CFG.horizon+35+f*34+Math.sin(tNow*.25+f)*4;
        var fg=ctx.createLinearGradient(0,fy-10,0,fy+16); fg.addColorStop(0,'rgba(225,231,211,0)'); fg.addColorStop(.5,'rgba(225,231,211,'+(dawn*.09).toFixed(3)+')'); fg.addColorStop(1,'rgba(225,231,211,0)');
        ctx.fillStyle=fg; ctx.fillRect(0,fy-12,CFG.W,30);
      }
    }
    var vg=ctx.createRadialGradient(CFG.W*.5,CFG.H*.47,CFG.H*.18,CFG.W*.5,CFG.H*.48,CFG.W*.66); vg.addColorStop(.62,'rgba(12,23,16,0)'); vg.addColorStop(1,'rgba(10,20,15,.31)'); ctx.fillStyle=vg; ctx.fillRect(0,0,CFG.W,CFG.H);
  }

  function drawForeground(tNow){
    ctx.save();
    var bottom=CFG.H;
    ctx.fillStyle='rgba(23,45,28,.72)';
    for(var i=0;i<15;i++){
      var side=i<8?0:1;
      var x=side?CFG.W-4-hash2(i,171)*38:4+hash2(i,171)*38;
      var y=bottom-5-hash2(i,172)*37;
      var r=7+hash2(i,173)*12;
      ctx.beginPath(); ctx.ellipse(x,y,r,r*.65,(side?-1:1)*.45,0,Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle='rgba(32,67,37,.72)'; ctx.lineWidth=1.1;
    for(i=0;i<48;i++){
      var gx=hash2(i,174)*CFG.W,gh=5+hash2(i,175)*18,sw=Math.sin(tNow*.9+i)*2;
      ctx.beginPath(); ctx.moveTo(gx,bottom+2); ctx.quadraticCurveTo(gx+sw*.2,bottom-gh*.55,gx+sw,bottom-gh); ctx.stroke();
    }
    ctx.restore();
  }

  function draw(){
    var tNow=performance.now()/1000;
    ctx.save(); ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);
    drawSky(tNow);
    drawDistantLandscape();
    drawMeadow(tNow);
    drawPaths();
    drawPond(tNow);
    for(var i=0;i<S.farms.length;i++) drawFarm(S.farms[i]);

    var queue=[];
    queue.push({y:S.well.y,kind:'well',v:S.well});
    for(i=0;i<S.bushes.length;i++) queue.push({y:S.bushes[i].y,kind:'bush',v:S.bushes[i]});
    for(i=0;i<S.rocks.length;i++) queue.push({y:S.rocks[i].y,kind:'rock',v:S.rocks[i]});
    for(i=0;i<S.trees.length;i++) queue.push({y:S.trees[i].y,kind:'tree',v:S.trees[i]});
    for(i=0;i<S.buildings.length;i++) queue.push({y:S.buildings[i].y,kind:S.buildings[i].type,v:S.buildings[i]});
    for(i=0;i<S.agents.length;i++) queue.push({y:S.agents[i].y,kind:'agent',v:S.agents[i]});
    queue.sort(function(a,b){ return a.y-b.y; });
    for(i=0;i<queue.length;i++){
      var q=queue[i];
      if(q.kind==='well') drawWell();
      else if(q.kind==='bush') drawBush(q.v);
      else if(q.kind==='rock') drawRock(q.v);
      else if(q.kind==='tree') drawTree(q.v,tNow);
      else if(q.kind==='house') drawHouse(q.v,tNow);
      else if(q.kind==='market') drawMarket(q.v,tNow);
      else drawAgent(q.v,tNow);
    }
    drawAmbientLife(tNow);
    drawAtmosphere(tNow);
    drawForeground(tNow);
    ctx.restore();
  }

  // ---------- HUD ----------
  function escapeHtml(s){ return String(s).replace(/[&<>]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }
  function bar(label,val){
    var v=Math.max(0,Math.min(100,Math.round(val)));
    return '<div class="ac-bar-row"><span>'+label+'</span><div class="ac-bar"><div class="ac-bar-fill" style="width:'+v+'%"></div></div></div>';
  }
  function timeOfDayLabel(t){
    if(t<.16) return 'Night'; if(t<.30) return 'Dawn'; if(t<.47) return 'Morning'; if(t<.56) return 'Noon'; if(t<.75) return 'Afternoon'; if(t<.88) return 'Dusk'; return 'Night';
  }
  function updateHUD(){
    clockLabel.textContent='Day '+S.day+' · '+timeOfDayLabel(S.time);
    dayVal.textContent=S.day; popVal.textContent=S.agents.length;
    var houses=0,i; for(i=0;i<S.buildings.length;i++) if(S.buildings[i].type==='house') houses++;
    houseVal.textContent=houses; marketVal.textContent=S.market?'Open':'Not yet';
    var avgH=0,avgE=0,avgS=0,n=Math.max(1,S.agents.length);
    for(i=0;i<S.agents.length;i++){ avgH+=S.agents[i].hunger; avgE+=S.agents[i].energy; avgS+=S.agents[i].social; }
    var mood=Math.round(((100-avgH/n)+(avgE/n)+(avgS/n))/3); moodVal.textContent=S.agents.length?mood+'%':'--';
    var html=''; for(i=0;i<S.log.length;i++) html+='<li class="log-'+S.log[i].type+'">'+escapeHtml(S.log[i].msg)+'</li>'; logList.innerHTML=html;
    if(S.selectedId!=null){
      var a=findById(S.agents,S.selectedId);
      if(a){
        agentCard.classList.remove('hidden');
        agentCard.innerHTML='<div class="ac-name">'+escapeHtml(a.name)+'</div>'+
          '<div class="ac-role">'+(a.role?roleTitle(a.role):'Newcomer')+' · '+escapeHtml(a.trait)+' · day '+Math.floor(a.age)+' of life</div>'+
          (a.aiThought?'<div class="ac-thought">“'+escapeHtml(a.aiThought)+'”</div>':'')+
          '<div class="ac-bars">'+bar('Hunger',100-a.hunger)+bar('Energy',a.energy)+bar('Social',a.social)+'</div>'+
          '<div class="ac-inv">Wood '+a.inv.wood+' · Stone '+a.inv.stone+' · Food '+a.inv.food+' · Coins '+a.coins+'</div>'+
          '<div class="ac-home">'+(a.home?'Has a home':'No home yet')+'</div>';
      } else { S.selectedId=null; agentCard.classList.add('hidden'); }
    } else agentCard.classList.add('hidden');
  }

  // ---------- input ----------
  function getWorldPos(evt){
    var rect=canvas.getBoundingClientRect();
    var cx=(evt.touches&&evt.touches.length)?evt.touches[0].clientX:evt.clientX;
    var cy=(evt.touches&&evt.touches.length)?evt.touches[0].clientY:evt.clientY;
    var sx=(cx-rect.left)*(CFG.W/rect.width),sy=(cy-rect.top)*(CFG.H/rect.height);
    return screenToWorld(sx,sy);
  }
  function wireUI(){
    dayVal=document.getElementById('dayVal'); popVal=document.getElementById('popVal'); houseVal=document.getElementById('houseVal'); marketVal=document.getElementById('marketVal'); moodVal=document.getElementById('moodVal'); logList=document.getElementById('logList'); agentCard=document.getElementById('agentCard'); clockLabel=document.getElementById('clockLabel');
    canvas.addEventListener('click',function(e){
      if(!S) return;
      var p=getWorldPos(e),best=null,bd=18;
      for(var i=0;i<S.agents.length;i++){ var a=S.agents[i],d=Math.hypot(a.x-p.x,a.y-p.y); if(d<bd){ bd=d; best=a; } }
      S.selectedId=best?best.id:null; updateHUD();
    });
    var shareBtn=document.getElementById('shareBtn'); if(shareBtn) shareBtn.addEventListener('click',shareVillage);
    var momentBtn=document.getElementById('momentBtn'); if(momentBtn) momentBtn.addEventListener('click',shareMoment);
    var momentClose=document.getElementById('momentClose'); if(momentClose) momentClose.addEventListener('click',function(){ document.getElementById('momentOverlay').classList.remove('show'); });
    var momentDownload=document.getElementById('momentDownload'); if(momentDownload) momentDownload.addEventListener('click',downloadMoment);
  }

  // ---------- sharing ----------
  function pickMomentEntry(){
    if(!S.chronicle||!S.chronicle.length) return null;
    var preferred=['birth','market','build','social'];
    for(var p=0;p<preferred.length;p++) for(var i=S.chronicle.length-1;i>=0;i--) if(S.chronicle[i].type===preferred[p]) return S.chronicle[i];
    return S.chronicle[S.chronicle.length-1];
  }
  function buildMomentCard(){
    var moment=pickMomentEntry(),cardW=720,sceneH=Math.round(CFG.H*1.5),textH=180;
    var card=document.createElement('canvas'); card.width=cardW; card.height=sceneH+textH;
    var cctx=card.getContext('2d'); cctx.fillStyle='#152119'; cctx.fillRect(0,0,cardW,sceneH+textH); cctx.drawImage(canvas,0,0,cardW,sceneH);
    var panel=cctx.createLinearGradient(0,sceneH,cardW,sceneH+textH); panel.addColorStop(0,'#17231b'); panel.addColorStop(1,'#223027'); cctx.fillStyle=panel; cctx.fillRect(0,sceneH,cardW,textH);
    cctx.fillStyle='#d9b96c'; cctx.font='600 15px "DM Sans", Arial, sans-serif'; cctx.textAlign='left'; cctx.fillText('CLIVORIA · LIVE WORLD',24,sceneH+34);
    cctx.fillStyle='#aebcad'; cctx.font='14px "DM Sans", Arial, sans-serif';
    var houses=0; for(var i=0;i<S.buildings.length;i++) if(S.buildings[i].type==='house') houses++;
    cctx.fillText('Day '+S.day+'  ·  '+S.agents.length+' villagers  ·  '+houses+' homes'+(S.market?'  ·  market open':''),24,sceneH+60);
    cctx.fillStyle='#f3f0e7'; cctx.font='italic 23px Georgia, serif'; var quote=moment?moment.msg:'A quiet day in the village.'; wrapText(cctx,'“'+quote+'”',24,sceneH+104,cardW-48,30); return card;
  }
  function wrapText(cctx,text,x,y,maxWidth,lineHeight){
    var words=text.split(' '),line='',lines=[]; for(var i=0;i<words.length;i++){ var test=line+words[i]+' '; if(cctx.measureText(test).width>maxWidth&&line){ lines.push(line); line=words[i]+' '; } else line=test; }
    lines.push(line); lines=lines.slice(0,3); for(i=0;i<lines.length;i++) cctx.fillText(lines[i].trim(),x,y+i*lineHeight);
  }
  function shareMoment(){
    if(!S) return;
    var card; try{ card=buildMomentCard(); }catch(e){ showToast('Could not build a share card right now.'); return; }
    var dataUrl=card.toDataURL('image/png'),overlay=document.getElementById('momentOverlay'),img=document.getElementById('momentImg'); if(overlay&&img){ img.src=dataUrl; overlay.classList.add('show'); }
    card.toBlob(function(blob){ if(!blob) return; var file=new File([blob],'clivoria-day'+S.day+'.png',{type:'image/png'}); if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){ var shareBtn2=document.getElementById('momentShareNow'); if(shareBtn2) shareBtn2.onclick=function(){ navigator.share({files:[file],title:'Clivoria',text:'Day '+S.day+' in the living world of Clivoria.'}).catch(function(){}); }; } });
  }
  function downloadMoment(){
    var img=document.getElementById('momentImg'); if(!img||!img.src) return; var a=document.createElement('a'); a.href=img.src; a.download='clivoria-day'+S.day+'.png'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  function showToast(msg){
    var t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); clearTimeout(showToast._h); showToast._h=setTimeout(function(){ t.classList.remove('show'); },2600);
  }
  function shareVillage(){
    if(!S) return;
    var url=location.href.split('#')[0],houses=0; for(var i=0;i<S.buildings.length;i++) if(S.buildings[i].type==='house') houses++;
    var text='Clivoria is on day '+S.day+' with '+S.agents.length+' villagers and '+houses+' homes. Come watch the same living world:';
    if(navigator.share) navigator.share({title:'Clivoria',text:text,url:url}).catch(function(){});
    else if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function(){ showToast('Link copied to clipboard.'); }).catch(function(){ showToast('Copy this page address to share it.'); });
    else showToast('Copy this page address to share it.');
  }

  // ---------- authoritative shared-world sync ----------
  function status(message){ document.getElementById('syncStatus').textContent=message; }
  async function sync(){
    if(document.hidden){ setTimeout(sync,5000); return; }
    try{
      var response=await fetch('/api/tick',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw new Error('unavailable');
      var data=await response.json(); if(!data.state||!Array.isArray(data.state.agents)) throw new Error('invalid');
      if(data.revision>=revision){
        var selected=S?S.selectedId:null;
        if(data.revision>revision){
          var blend=Math.min(1,(performance.now()-receivedAt)/5000),previous=new Map();
          if(S) S.agents.forEach(function(a){ var p=visualPositions.get(a.id)||a; previous.set(a.id,{x:p.x+(a.x-p.x)*blend,y:p.y+(a.y-p.y)*blend}); });
          visualPositions=previous; receivedAt=performance.now();
        }
        S=data.state; S.selectedId=selected; revision=data.revision; updateHUD();
      }
      status('Shared world · Live · Day '+S.day+(data.catchUpSeconds?' · caught up '+data.catchUpSeconds+'s':'')); document.getElementById('liveLabel').textContent='live';
    }catch(e){
      document.getElementById('liveLabel').textContent=S?'reconnecting':'connecting'; status(S?'Connection interrupted · Showing last shared state · Retrying…':'Connecting to the shared world… Retrying shortly.');
    }
    if(!stopped) setTimeout(sync,5000);
  }
  function frame(){ if(S) draw(); requestAnimationFrame(frame); }
  function boot(){
    canvas=document.getElementById('world'); canvas.width=CFG.W*RENDER_SCALE; canvas.height=CFG.H*RENDER_SCALE; ctx=canvas.getContext('2d',{alpha:false}); ctx.imageSmoothingEnabled=true; wireUI(); sync(); requestAnimationFrame(frame);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
