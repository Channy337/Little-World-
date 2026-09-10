(function(){
  'use strict';
  const canvas=document.getElementById('globeCanvas');
  const fallback=document.getElementById('globeFallback');
  const status=document.getElementById('globeStatus');
  const enter=document.getElementById('enterSettlementBtn');
  if(!canvas||!fallback||!enter)return;

  let active=false,ctx=null,raf=0,yaw=-0.2,pitch=0.08,zoom=1,dragging=false,lastX=0,lastY=0,pinch=0,moved=false;
  const pointers=new Map();
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  const continents=[
    [[-155,58],[-135,70],[-105,68],[-78,52],[-62,45],[-75,25],[-100,18],[-125,32]],
    [[-82,12],[-67,8],[-52,-8],[-55,-32],[-68,-52],[-78,-28]],
    [[-12,70],[25,72],[60,60],[92,52],[120,35],[135,12],[105,3],[76,22],[45,27],[18,40],[-8,35]],
    [[-18,34],[8,37],[31,20],[39,-5],[25,-32],[3,-35],[-13,-10]],
    [[112,-10],[153,-12],[160,-38],[135,-46],[113,-31]],
    [[-47,82],[-25,78],[-18,66],[-43,61],[-58,70]]
  ];
  const marker={lon:28,lat:14};

  function activate(){
    if(active)return;
    active=true;
    fallback.hidden=true;
    canvas.hidden=false;
    canvas.style.touchAction='none';
    ctx=canvas.getContext('2d');
    status.textContent='Civoria settlement · compatible globe mode';
    resize();
    bind();
    if(!reduce.matches)raf=requestAnimationFrame(frame);else draw();
  }

  function resize(){
    if(!active)return;
    const r=canvas.getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=Math.max(1,Math.round(r.width*dpr));
    canvas.height=Math.max(1,Math.round(r.height*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    draw();
  }

  function rotatePoint(lon,lat){
    const la=lat*Math.PI/180,lo=lon*Math.PI/180+yaw;
    let x=Math.cos(la)*Math.sin(lo),y=Math.sin(la),z=Math.cos(la)*Math.cos(lo);
    const cp=Math.cos(pitch),sp=Math.sin(pitch);
    const y2=y*cp-z*sp,z2=y*sp+z*cp;
    return{x,y:y2,z:z2};
  }

  function project(lon,lat,cx,cy,r){
    const p=rotatePoint(lon,lat);
    if(p.z<=0)return null;
    return{x:cx+p.x*r,y:cy-p.y*r,z:p.z};
  }

  function draw(){
    if(!active||!ctx)return;
    const w=canvas.clientWidth,h=canvas.clientHeight,cx=w/2,cy=h/2+Math.min(28,h*.03),r=Math.min(w,h)*.34*zoom;
    ctx.clearRect(0,0,w,h);
    const bg=ctx.createRadialGradient(cx,cy,r*.15,cx,cy,r*1.65);
    bg.addColorStop(0,'rgba(20,70,54,.38)');bg.addColorStop(1,'rgba(4,12,9,0)');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    const sea=ctx.createRadialGradient(cx-r*.32,cy-r*.34,r*.08,cx,cy,r);
    sea.addColorStop(0,'#4e8b90');sea.addColorStop(.45,'#25616c');sea.addColorStop(1,'#102d3f');
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=sea;ctx.fill();
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();

    ctx.strokeStyle='rgba(218,232,213,.10)';ctx.lineWidth=1;
    for(let lat=-60;lat<=60;lat+=30){
      ctx.beginPath();let started=false;for(let lon=-180;lon<=180;lon+=4){const p=project(lon,lat,cx,cy,r);if(p){if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);}}ctx.stroke();
    }
    for(let lon=-150;lon<=180;lon+=30){
      ctx.beginPath();let started=false;for(let lat=-85;lat<=85;lat+=3){const p=project(lon,lat,cx,cy,r);if(p){if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);}}ctx.stroke();
    }

    continents.forEach((poly,i)=>{
      const pts=[];for(let s=0;s<poly.length;s++){const a=poly[s],b=poly[(s+1)%poly.length];for(let t=0;t<1;t+=.1)pts.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
      ctx.beginPath();let started=false;pts.forEach(([lon,lat])=>{const p=project(lon,lat,cx,cy,r);if(!p){started=false;return;}if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);});
      ctx.fillStyle=i%2?'#66835a':'#4e7859';ctx.fill();
    });
    ctx.restore();

    const rim=ctx.createRadialGradient(cx,cy,r*.84,cx,cy,r*1.05);rim.addColorStop(0,'rgba(110,180,183,0)');rim.addColorStop(.86,'rgba(112,184,188,.05)');rim.addColorStop(1,'rgba(130,205,207,.28)');ctx.fillStyle=rim;ctx.beginPath();ctx.arc(cx,cy,r*1.06,0,Math.PI*2);ctx.fill();

    const mp=project(marker.lon,marker.lat,cx,cy,r);
    if(mp){
      const pulse=reduce.matches?1:1+Math.sin(performance.now()*.005)*.12;
      ctx.strokeStyle='#e6c879';ctx.lineWidth=3;ctx.beginPath();ctx.arc(mp.x,mp.y,10*pulse,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#ffe5a1';ctx.beginPath();ctx.arc(mp.x,mp.y,4.5,0,Math.PI*2);ctx.fill();
      ctx.font='600 13px system-ui,-apple-system,sans-serif';ctx.textAlign='center';ctx.fillStyle='#f2e5bc';ctx.fillText('CIVORIA',mp.x,mp.y-18);
      const nearCenter=Math.hypot(mp.x-cx,mp.y-cy)<r*.26;
      if(zoom>1.55)status.textContent=nearCenter?'Civoria settlement · zoom to enter':'Rotate the Civoria marker toward the center';
      if(zoom>=1.9&&nearCenter)enter.click();
    }
  }

  function frame(){draw();raf=requestAnimationFrame(frame);}
  function setZoom(v){zoom=Math.max(.8,Math.min(2.05,v));draw();}

  function bind(){
    window.addEventListener('resize',resize,{passive:true});
    canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom-e.deltaY*.0015);},{passive:false});
    canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture?.(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});dragging=true;moved=false;lastX=e.clientX;lastY=e.clientY;if(pointers.size===2){const p=[...pointers.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
    canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinch)setZoom(zoom+(d-pinch)*.006);pinch=d;moved=true;return;}const dx=e.clientX-lastX,dy=e.clientY-lastY;if(Math.abs(dx)+Math.abs(dy)>2)moved=true;yaw+=dx*.008;pitch=Math.max(-1.05,Math.min(1.05,pitch-dy*.006));lastX=e.clientX;lastY=e.clientY;draw();});
    const up=e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=0;if(!pointers.size)dragging=false;};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  }

  const observer=new MutationObserver(()=>{if(!fallback.hidden)activate();});
  observer.observe(fallback,{attributes:true,attributeFilter:['hidden']});
  setTimeout(()=>{if(!fallback.hidden)activate();},0);
})();