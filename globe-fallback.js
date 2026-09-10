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
  let scriptsPromise=null,entering=false,ctx=null,raf=0,yaw=-0.3,pitch=0.06,zoom=1;
  let lastX=0,lastY=0,pinch=0;
  const pointers=new Map();

  const lands=[
    {fill:'#5d8b4f',edge:'#9cc579',pts:[[-150,55],[-132,70],[-102,69],[-78,55],[-62,39],[-72,20],[-98,13],[-128,28]]},
    {fill:'#6c9650',edge:'#a9c77f',pts:[[-83,13],[-66,9],[-49,-5],[-51,-29],[-65,-50],[-77,-31]]},
    {fill:'#507e49',edge:'#92bb70',pts:[[-10,69],[24,70],[58,60],[91,51],[121,33],[137,10],[108,0],[78,20],[47,27],[19,39],[-7,34]]},
    {fill:'#6e9250',edge:'#b2c57a',pts:[[-18,34],[8,38],[31,21],[40,-3],[25,-32],[3,-35],[-13,-11]]},
    {fill:'#6f9258',edge:'#b4cb88',pts:[[112,-10],[153,-12],[161,-37],[136,-46],[113,-31]]},
    {fill:'#708f61',edge:'#b8c994',pts:[[-48,82],[-25,78],[-18,66],[-42,61],[-59,70]]}
  ];

  const hills=[[-118,48],[-103,58],[-72,41],[18,52],[39,45],[74,44],[92,31],[26,13],[13,-8],[-60,-13],[128,-27]];
  const mountains=[[-111,53],[-95,62],[28,55],[55,48],[83,39],[31,20],[9,-5],[-66,-18],[139,-30]];
  const forests=[[-133,44],[-121,35],[-88,48],[-73,30],[-60,-12],[-56,-25],[7,52],[18,44],[40,35],[66,35],[85,24],[18,5],[7,-20],[116,5],[132,-21]];
  const farms=[[18,18],[22,17],[16,14],[-75,3],[-72,0],[106,-8]];
  const ruins=[[-27,39],[72,16],[-120,8]];
  const volcanoes=[[102,49],[-144,-11]];
  const marker={lon:28,lat:14};
  const civoriaHomes=[[26.3,14.8],[28.1,15.3],[29.4,13.7],[26.9,12.9],[30.1,15.5]];
  const stars=Array.from({length:72},(_,i)=>({x:(i*83%997)/997,y:(i*211%991)/991,a:.18+((i*47)%70)/100}));

  function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load '+src));document.body.appendChild(s);});}
  function loadSettlement(){if(!scriptsPromise)scriptsPromise=loadScript('activity-clock.js').then(()=>loadScript('game.js'));return scriptsPromise;}
  async function enterSettlement(target='live-world'){
    if(entering||body.classList.contains('settlement-mode'))return;
    entering=true;status.textContent='Descending toward Civoria…';section.classList.add('is-leaving');
    try{await loadSettlement();}catch(e){console.error(e);status.textContent='Settlement viewer failed to load. Reload and try again.';section.classList.remove('is-leaving');entering=false;return;}
    if(raf){cancelAnimationFrame(raf);raf=0;}
    setTimeout(()=>{
      body.classList.remove('globe-mode');body.classList.add('settlement-mode');section.classList.add('is-hidden');section.classList.remove('is-leaving');
      history.pushState(null,'','#'+target);document.getElementById(target)?.scrollIntoView({behavior:reduce.matches?'auto':'smooth',block:'start'});entering=false;
    },reduce.matches?0:420);
  }
  function showGlobe(e){e?.preventDefault();if(!body.classList.contains('globe-mode')){history.replaceState(null,'','#world-map');location.reload();return;}section.scrollIntoView({behavior:reduce.matches?'auto':'smooth'});}
  enter.addEventListener('click',()=>enterSettlement());
  worldBtn?.addEventListener('click',showGlobe);worldNav?.addEventListener('click',showGlobe);
  aboutNav?.addEventListener('click',e=>{if(!body.classList.contains('globe-mode'))return;e.preventDefault();enterSettlement('about');});

  function rotatePoint(lon,lat){const la=lat*Math.PI/180,lo=lon*Math.PI/180+yaw;let x=Math.cos(la)*Math.sin(lo),y=Math.sin(la),z=Math.cos(la)*Math.cos(lo);const cp=Math.cos(pitch),sp=Math.sin(pitch);return{x,y:y*cp-z*sp,z:y*sp+z*cp};}
  function project(lon,lat,cx,cy,r){const p=rotatePoint(lon,lat);return p.z<=.015?null:{x:cx+p.x*r,y:cy-p.y*r,z:p.z};}
  function scaleAt(p,r){return Math.max(.35,p.z)*Math.max(.72,r/240);}
  function traceLand(poly,cx,cy,r){ctx.beginPath();let active=false;const dense=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];for(let t=0;t<1;t+=.045)dense.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}dense.forEach(([lon,lat])=>{const p=project(lon,lat,cx,cy,r);if(!p){active=false;return;}if(!active){ctx.moveTo(p.x,p.y);active=true;}else ctx.lineTo(p.x,p.y);});}

  function drawTree(p,r){const s=scaleAt(p,r);ctx.fillStyle='rgba(22,42,22,.45)';ctx.beginPath();ctx.ellipse(p.x+1*s,p.y+4*s,4*s,2*s,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#183f27';ctx.fillRect(p.x-.7*s,p.y,1.4*s,5*s);ctx.fillStyle='#2f6d39';ctx.beginPath();ctx.moveTo(p.x,p.y-8*s);ctx.lineTo(p.x-5*s,p.y+1*s);ctx.lineTo(p.x+5*s,p.y+1*s);ctx.closePath();ctx.fill();ctx.fillStyle='#4b8c45';ctx.beginPath();ctx.moveTo(p.x,p.y-5*s);ctx.lineTo(p.x-4*s,p.y+2*s);ctx.lineTo(p.x+4*s,p.y+2*s);ctx.closePath();ctx.fill();}
  function drawMountain(p,r,snow=true){const s=scaleAt(p,r)*1.15;ctx.fillStyle='rgba(18,31,25,.35)';ctx.beginPath();ctx.ellipse(p.x+2*s,p.y+5*s,8*s,3*s,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#6f7468';ctx.beginPath();ctx.moveTo(p.x,p.y-11*s);ctx.lineTo(p.x-9*s,p.y+6*s);ctx.lineTo(p.x+9*s,p.y+6*s);ctx.closePath();ctx.fill();ctx.fillStyle='#8a8d7d';ctx.beginPath();ctx.moveTo(p.x,p.y-11*s);ctx.lineTo(p.x,p.y+6*s);ctx.lineTo(p.x+9*s,p.y+6*s);ctx.closePath();ctx.fill();if(snow){ctx.fillStyle='#d9ded0';ctx.beginPath();ctx.moveTo(p.x,p.y-11*s);ctx.lineTo(p.x-3.2*s,p.y-5*s);ctx.lineTo(p.x,p.y-6.5*s);ctx.lineTo(p.x+3.5*s,p.y-4.3*s);ctx.closePath();ctx.fill();}}
  function drawHill(p,r){const s=scaleAt(p,r);ctx.fillStyle='#557f43';ctx.beginPath();ctx.ellipse(p.x,p.y,8*s,4.5*s,-.15,Math.PI,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(194,218,152,.25)';ctx.lineWidth=Math.max(1,s*.7);ctx.stroke();}
  function drawHouse(p,r,lit=false){const s=scaleAt(p,r)*.9;ctx.fillStyle='rgba(20,29,21,.4)';ctx.beginPath();ctx.ellipse(p.x+1*s,p.y+4*s,5*s,2*s,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c49a63';ctx.fillRect(p.x-4*s,p.y-1*s,8*s,6*s);ctx.fillStyle='#6f4d3b';ctx.beginPath();ctx.moveTo(p.x-5*s,p.y);ctx.lineTo(p.x,p.y-5*s);ctx.lineTo(p.x+5*s,p.y);ctx.closePath();ctx.fill();ctx.fillStyle=lit?'#ffd98b':'#6d583f';ctx.fillRect(p.x-1*s,p.y+1*s,2*s,3*s);}
  function drawFarm(p,r){const s=scaleAt(p,r);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-.3);ctx.fillStyle='#9a8244';ctx.fillRect(-7*s,-4*s,14*s,8*s);ctx.strokeStyle='#d3bd65';ctx.lineWidth=Math.max(.7,s*.65);for(let y=-2.5;y<=2.5;y+=2.5){ctx.beginPath();ctx.moveTo(-6*s,y*s);ctx.lineTo(6*s,y*s);ctx.stroke();}ctx.restore();}
  function drawRuin(p,r){const s=scaleAt(p,r);ctx.strokeStyle='#9e9a84';ctx.lineWidth=Math.max(1.2,s*1.2);ctx.beginPath();ctx.moveTo(p.x-5*s,p.y+4*s);ctx.lineTo(p.x-3*s,p.y-5*s);ctx.lineTo(p.x,p.y-1*s);ctx.lineTo(p.x+2*s,p.y-7*s);ctx.lineTo(p.x+5*s,p.y+4*s);ctx.stroke();}
  function drawVolcano(p,r){const s=scaleAt(p,r)*1.2;ctx.fillStyle='#4b4039';ctx.beginPath();ctx.moveTo(p.x,p.y-9*s);ctx.lineTo(p.x-9*s,p.y+6*s);ctx.lineTo(p.x+9*s,p.y+6*s);ctx.closePath();ctx.fill();ctx.fillStyle='#df6a35';ctx.beginPath();ctx.arc(p.x,p.y-8*s,3*s,0,Math.PI*2);ctx.fill();if(!reduce.matches){ctx.fillStyle='rgba(255,150,72,.18)';ctx.beginPath();ctx.arc(p.x,p.y-8*s,7*s+Math.sin(performance.now()*.004)*2*s,0,Math.PI*2);ctx.fill();}}

  function drawProjected(list,fn,cx,cy,r){list.map(([lon,lat])=>project(lon,lat,cx,cy,r)).filter(Boolean).sort((a,b)=>a.z-b.z).forEach(p=>fn(p,r));}
  function resize(){if(!ctx)return;const box=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(box.width*dpr));canvas.height=Math.max(1,Math.round(box.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
  function draw(){
    if(!ctx)return;
    const w=canvas.clientWidth,h=canvas.clientHeight,cx=w/2,cy=h/2+Math.min(30,h*.035),r=Math.min(w,h)*.315*zoom;
    ctx.clearRect(0,0,w,h);
    const space=ctx.createLinearGradient(0,0,w,h);space.addColorStop(0,'#08110f');space.addColorStop(.5,'#0a1716');space.addColorStop(1,'#091018');ctx.fillStyle=space;ctx.fillRect(0,0,w,h);
    stars.forEach(s=>{ctx.globalAlpha=s.a;ctx.fillStyle='#dce8df';ctx.beginPath();ctx.arc(s.x*w,s.y*h,s.a>.65?1.15:.7,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
    const halo=ctx.createRadialGradient(cx,cy,r*.75,cx,cy,r*1.55);halo.addColorStop(0,'rgba(83,176,177,.08)');halo.addColorStop(.68,'rgba(83,176,177,.05)');halo.addColorStop(1,'rgba(83,176,177,0)');ctx.fillStyle=halo;ctx.fillRect(cx-r*1.7,cy-r*1.7,r*3.4,r*3.4);
    const sea=ctx.createRadialGradient(cx-r*.34,cy-r*.4,r*.05,cx,cy,r);sea.addColorStop(0,'#79c7bd');sea.addColorStop(.33,'#3f9e9d');sea.addColorStop(.68,'#247783');sea.addColorStop(1,'#123f59');ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=sea;ctx.fill();
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
    ctx.strokeStyle='rgba(215,239,229,.055)';ctx.lineWidth=1;for(let lat=-60;lat<=60;lat+=30){ctx.beginPath();let on=false;for(let lon=-180;lon<=180;lon+=5){const p=project(lon,lat,cx,cy,r);if(p){if(!on){ctx.moveTo(p.x,p.y);on=true;}else ctx.lineTo(p.x,p.y);}else on=false;}ctx.stroke();}
    lands.forEach((land)=>{traceLand(land.pts,cx,cy,r);ctx.fillStyle=land.fill;ctx.fill();ctx.strokeStyle=land.edge;ctx.globalAlpha=.55;ctx.lineWidth=Math.max(1,r*.008);ctx.stroke();ctx.globalAlpha=1;});
    drawProjected(farms,drawFarm,cx,cy,r);drawProjected(hills,drawHill,cx,cy,r);drawProjected(forests,drawTree,cx,cy,r);drawProjected(mountains,drawMountain,cx,cy,r);drawProjected(ruins,drawRuin,cx,cy,r);drawProjected(volcanoes,drawVolcano,cx,cy,r);
    const homePts=civoriaHomes.map(([lon,lat])=>{const p=project(lon,lat,cx,cy,r);if(p)p.lit=true;return p;}).filter(Boolean).sort((a,b)=>a.z-b.z);homePts.forEach(p=>drawHouse(p,r,true));
    ctx.restore();

    const shade=ctx.createRadialGradient(cx-r*.28,cy-r*.34,r*.2,cx,cy,r);shade.addColorStop(0,'rgba(255,255,255,.08)');shade.addColorStop(.68,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,5,12,.48)');ctx.fillStyle=shade;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(122,218,214,.34)';ctx.lineWidth=Math.max(2,r*.01);ctx.beginPath();ctx.arc(cx,cy,r+1,0,Math.PI*2);ctx.stroke();

    const mp=project(marker.lon,marker.lat,cx,cy,r);if(mp){const pulse=reduce.matches?1:1+Math.sin(performance.now()*.005)*.11;const s=scaleAt(mp,r);ctx.strokeStyle='rgba(255,221,139,.95)';ctx.lineWidth=Math.max(1.6,2.2*s);ctx.beginPath();ctx.arc(mp.x,mp.y,11*s*pulse,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffe6a1';ctx.beginPath();ctx.arc(mp.x,mp.y,3.2*s,0,Math.PI*2);ctx.fill();ctx.font=`700 ${Math.max(10,12*s)}px system-ui,-apple-system,sans-serif`;ctx.textAlign='center';ctx.fillStyle='#fff0bd';ctx.shadowColor='rgba(0,0,0,.8)';ctx.shadowBlur=5;ctx.fillText('CIVORIA',mp.x,mp.y-17*s);ctx.shadowBlur=0;const centered=Math.hypot(mp.x-cx,mp.y-cy)<r*.3;if(zoom>1.45)status.textContent=centered?'Civoria settlement · keep zooming to descend':'Rotate Civoria toward the center';else status.textContent='Inhabited · drag the tiny planet to explore';if(zoom>=2.18&&centered)enterSettlement();}
  }
  function frame(){draw();raf=requestAnimationFrame(frame);}
  function setZoom(v){zoom=Math.max(.82,Math.min(2.35,v));draw();}
  canvas.style.touchAction='none';canvas.hidden=false;if(fallback)fallback.hidden=true;ctx=canvas.getContext('2d');
  if(!ctx){if(fallback)fallback.hidden=false;return;}
  status.textContent='Inhabited · drag the tiny planet to explore';
  window.addEventListener('resize',resize,{passive:true});
  canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom-e.deltaY*.0014);},{passive:false});
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture?.(e.pointerId);canvas.classList.add('is-dragging');pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastX=e.clientX;lastY=e.clientY;if(pointers.size===2){const p=[...pointers.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinch)setZoom(zoom+(d-pinch)*.0055);pinch=d;return;}const dx=e.clientX-lastX,dy=e.clientY-lastY;yaw+=dx*.008;pitch=Math.max(-1.02,Math.min(1.02,pitch-dy*.006));lastX=e.clientX;lastY=e.clientY;draw();});
  const up=e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=0;if(!pointers.size)canvas.classList.remove('is-dragging');};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  resize();if(!reduce.matches)raf=requestAnimationFrame(frame);else draw();
})();