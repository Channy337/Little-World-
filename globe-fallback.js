(function(){
  'use strict';
  const body=document.body;
  const section=document.getElementById('world-map');
  const canvas=document.getElementById('globeCanvas');
  const fallback=document.getElementById('globeFallback');
  const status=document.getElementById('globeStatus');
  const enter=document.getElementById('enterSettlementBtn');
  const worldBtn=document.getElementById('worldViewBtn');
  const worldNav=document.getElementById('worldNav');
  const aboutNav=document.querySelector('.siteNav a[href="#about"]');
  if(!canvas||!section||!enter)return;

  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  let scriptsPromise=null,entering=false,ctx=null,raf=0,yaw=-0.2,pitch=0.08,zoom=1;
  let lastX=0,lastY=0,pinch=0;
  const pointers=new Map();
  const continents=[
    [[-155,58],[-135,70],[-105,68],[-78,52],[-62,45],[-75,25],[-100,18],[-125,32]],
    [[-82,12],[-67,8],[-52,-8],[-55,-32],[-68,-52],[-78,-28]],
    [[-12,70],[25,72],[60,60],[92,52],[120,35],[135,12],[105,3],[76,22],[45,27],[18,40],[-8,35]],
    [[-18,34],[8,37],[31,20],[39,-5],[25,-32],[3,-35],[-13,-10]],
    [[112,-10],[153,-12],[160,-38],[135,-46],[113,-31]],
    [[-47,82],[-25,78],[-18,66],[-43,61],[-58,70]]
  ];
  const marker={lon:28,lat:14};

  function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load '+src));document.body.appendChild(s);});}
  function loadSettlement(){if(!scriptsPromise)scriptsPromise=loadScript('activity-clock.js').then(()=>loadScript('game.js'));return scriptsPromise;}
  async function enterSettlement(target='live-world'){
    if(entering||body.classList.contains('settlement-mode'))return;
    entering=true;status.textContent='Entering the inhabited region…';
    try{await loadSettlement();}catch(e){console.error(e);status.textContent='Settlement viewer failed to load. Reload and try again.';entering=false;return;}
    if(raf){cancelAnimationFrame(raf);raf=0;}
    body.classList.remove('globe-mode');body.classList.add('settlement-mode');section.classList.add('is-hidden');
    history.pushState(null,'','#'+target);document.getElementById(target)?.scrollIntoView({behavior:reduce.matches?'auto':'smooth',block:'start'});entering=false;
  }
  function showGlobe(e){e?.preventDefault();if(!body.classList.contains('globe-mode')){history.replaceState(null,'','#world-map');location.reload();return;}section.scrollIntoView({behavior:reduce.matches?'auto':'smooth'});}
  enter.addEventListener('click',()=>enterSettlement());
  worldBtn?.addEventListener('click',showGlobe);worldNav?.addEventListener('click',showGlobe);
  aboutNav?.addEventListener('click',e=>{if(!body.classList.contains('globe-mode'))return;e.preventDefault();enterSettlement('about');});

  function rotatePoint(lon,lat){const la=lat*Math.PI/180,lo=lon*Math.PI/180+yaw;let x=Math.cos(la)*Math.sin(lo),y=Math.sin(la),z=Math.cos(la)*Math.cos(lo);const cp=Math.cos(pitch),sp=Math.sin(pitch);return{x,y:y*cp-z*sp,z:y*sp+z*cp};}
  function project(lon,lat,cx,cy,r){const p=rotatePoint(lon,lat);return p.z<=0?null:{x:cx+p.x*r,y:cy-p.y*r,z:p.z};}
  function resize(){if(!ctx)return;const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
  function draw(){
    if(!ctx)return;const w=canvas.clientWidth,h=canvas.clientHeight,cx=w/2,cy=h/2+Math.min(28,h*.03),r=Math.min(w,h)*.34*zoom;
    ctx.clearRect(0,0,w,h);const bg=ctx.createRadialGradient(cx,cy,r*.15,cx,cy,r*1.65);bg.addColorStop(0,'rgba(20,70,54,.38)');bg.addColorStop(1,'rgba(4,12,9,0)');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    const sea=ctx.createRadialGradient(cx-r*.32,cy-r*.34,r*.08,cx,cy,r);sea.addColorStop(0,'#4e8b90');sea.addColorStop(.45,'#25616c');sea.addColorStop(1,'#102d3f');ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=sea;ctx.fill();
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();ctx.strokeStyle='rgba(218,232,213,.10)';ctx.lineWidth=1;
    for(let lat=-60;lat<=60;lat+=30){ctx.beginPath();let on=false;for(let lon=-180;lon<=180;lon+=4){const p=project(lon,lat,cx,cy,r);if(p){if(!on){ctx.moveTo(p.x,p.y);on=true;}else ctx.lineTo(p.x,p.y);}else on=false;}ctx.stroke();}
    for(let lon=-150;lon<=180;lon+=30){ctx.beginPath();let on=false;for(let lat=-85;lat<=85;lat+=3){const p=project(lon,lat,cx,cy,r);if(p){if(!on){ctx.moveTo(p.x,p.y);on=true;}else ctx.lineTo(p.x,p.y);}else on=false;}ctx.stroke();}
    continents.forEach((poly,i)=>{const pts=[];for(let s=0;s<poly.length;s++){const a=poly[s],b=poly[(s+1)%poly.length];for(let t=0;t<1;t+=.08)pts.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}ctx.beginPath();let on=false;pts.forEach(([lon,lat])=>{const p=project(lon,lat,cx,cy,r);if(!p){on=false;return;}if(!on){ctx.moveTo(p.x,p.y);on=true;}else ctx.lineTo(p.x,p.y);});ctx.fillStyle=i%2?'#66835a':'#4e7859';ctx.fill();});ctx.restore();
    const rim=ctx.createRadialGradient(cx,cy,r*.84,cx,cy,r*1.05);rim.addColorStop(0,'rgba(110,180,183,0)');rim.addColorStop(.86,'rgba(112,184,188,.05)');rim.addColorStop(1,'rgba(130,205,207,.28)');ctx.fillStyle=rim;ctx.beginPath();ctx.arc(cx,cy,r*1.06,0,Math.PI*2);ctx.fill();
    const mp=project(marker.lon,marker.lat,cx,cy,r);if(mp){const pulse=reduce.matches?1:1+Math.sin(performance.now()*.005)*.12;ctx.strokeStyle='#e6c879';ctx.lineWidth=3;ctx.beginPath();ctx.arc(mp.x,mp.y,10*pulse,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffe5a1';ctx.beginPath();ctx.arc(mp.x,mp.y,4.5,0,Math.PI*2);ctx.fill();ctx.font='600 13px system-ui,-apple-system,sans-serif';ctx.textAlign='center';ctx.fillStyle='#f2e5bc';ctx.fillText('CIVORIA',mp.x,mp.y-18);const centered=Math.hypot(mp.x-cx,mp.y-cy)<r*.26;if(zoom>1.5)status.textContent=centered?'Civoria settlement · pinch closer to enter':'Rotate the Civoria marker toward the center';if(zoom>=1.9&&centered)enterSettlement();}
  }
  function frame(){draw();raf=requestAnimationFrame(frame);}
  function setZoom(v){zoom=Math.max(.8,Math.min(2.05,v));draw();}
  canvas.style.touchAction='none';canvas.hidden=false;if(fallback)fallback.hidden=true;ctx=canvas.getContext('2d');
  if(!ctx){if(fallback)fallback.hidden=false;return;}
  status.textContent='Civoria settlement · inhabited';
  window.addEventListener('resize',resize,{passive:true});
  canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom-e.deltaY*.0015);},{passive:false});
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture?.(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastX=e.clientX;lastY=e.clientY;if(pointers.size===2){const p=[...pointers.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinch)setZoom(zoom+(d-pinch)*.006);pinch=d;return;}const dx=e.clientX-lastX,dy=e.clientY-lastY;yaw+=dx*.008;pitch=Math.max(-1.05,Math.min(1.05,pitch-dy*.006));lastX=e.clientX;lastY=e.clientY;draw();});
  const up=e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=0;};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  resize();if(!reduce.matches)raf=requestAnimationFrame(frame);else draw();
})();