(function(){
'use strict';
const canvas=document.getElementById('globeCanvas');
const status=document.getElementById('globeStatus');
const focusBtn=document.getElementById('enterSettlementBtn');
const fallback=document.getElementById('globeFallback');
if(!canvas||!status||!focusBtn)return;
const ctx=canvas.getContext('2d');
if(!ctx){if(fallback)fallback.hidden=false;return;}
if(fallback)fallback.hidden=true;
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
let yaw=-0.3,pitch=0.06,zoom=1,raf=0,lastX=0,lastY=0,pinch=0,state=null,revision=-1,syncTimer=0,selectedId=null;
const pointers=new Map();
const marker={lon:28,lat:14};
const WORLD={W:480,H:304};
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
const ruins=[[-27,39],[72,16],[-120,8]];
const volcanoes=[[102,49],[-144,-11]];
const stars=Array.from({length:76},(_,i)=>({x:(i*83%997)/997,y:(i*211%991)/991,a:.18+((i*47)%70)/100}));
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function rotatePoint(lon,lat){const la=lat*Math.PI/180,lo=lon*Math.PI/180+yaw;let x=Math.cos(la)*Math.sin(lo),y=Math.sin(la),z=Math.cos(la)*Math.cos(lo);const cp=Math.cos(pitch),sp=Math.sin(pitch);return{x,y:y*cp-z*sp,z:y*sp+z*cp};}
function project(lon,lat,cx,cy,r){const p=rotatePoint(lon,lat);return p.z<=.012?null:{x:cx+p.x*r,y:cy-p.y*r,z:p.z};}
function scaleAt(p,r){return Math.max(.34,p.z)*Math.max(.72,r/240);}
function localToGeo(x,y){return{lon:marker.lon+(x-WORLD.W/2)*.075,lat:marker.lat-(y-WORLD.H/2)*.062};}
function traceLand(poly,cx,cy,r){ctx.beginPath();let active=false;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];for(let t=0;t<1;t+=.045){const p=project(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,cx,cy,r);if(!p){active=false;continue;}if(!active){ctx.moveTo(p.x,p.y);active=true;}else ctx.lineTo(p.x,p.y);}}}
function drawTree(p,r){const s=scaleAt(p,r);ctx.fillStyle='#183f27';ctx.fillRect(p.x-.7*s,p.y,1.4*s,5*s);ctx.fillStyle='#2f6d39';ctx.beginPath();ctx.moveTo(p.x,p.y-8*s);ctx.lineTo(p.x-5*s,p.y+1*s);ctx.lineTo(p.x+5*s,p.y+1*s);ctx.closePath();ctx.fill();ctx.fillStyle='#4b8c45';ctx.beginPath();ctx.moveTo(p.x,p.y-5*s);ctx.lineTo(p.x-4*s,p.y+2*s);ctx.lineTo(p.x+4*s,p.y+2*s);ctx.closePath();ctx.fill();}
function drawMountain(p,r){const s=scaleAt(p,r)*1.15;ctx.fillStyle='#6f7468';ctx.beginPath();ctx.moveTo(p.x,p.y-11*s);ctx.lineTo(p.x-9*s,p.y+6*s);ctx.lineTo(p.x+9*s,p.y+6*s);ctx.closePath();ctx.fill();ctx.fillStyle='#9b9d8d';ctx.beginPath();ctx.moveTo(p.x,p.y-11*s);ctx.lineTo(p.x,p.y+6*s);ctx.lineTo(p.x+9*s,p.y+6*s);ctx.closePath();ctx.fill();ctx.fillStyle='#d9ded0';ctx.beginPath();ctx.moveTo(p.x,p.y-11*s);ctx.lineTo(p.x-3*s,p.y-5*s);ctx.lineTo(p.x,p.y-6*s);ctx.lineTo(p.x+3*s,p.y-4*s);ctx.closePath();ctx.fill();}
function drawHill(p,r){const s=scaleAt(p,r);ctx.fillStyle='#557f43';ctx.beginPath();ctx.ellipse(p.x,p.y,8*s,4.5*s,-.15,Math.PI,Math.PI*2);ctx.fill();}
function drawHouseAt(p,r,lit){const s=scaleAt(p,r)*clamp(.7+zoom*.16,.8,1.55);ctx.fillStyle='#c49a63';ctx.fillRect(p.x-4*s,p.y-1*s,8*s,6*s);ctx.fillStyle='#6f4d3b';ctx.beginPath();ctx.moveTo(p.x-5*s,p.y);ctx.lineTo(p.x,p.y-5*s);ctx.lineTo(p.x+5*s,p.y);ctx.closePath();ctx.fill();ctx.fillStyle=lit?'#ffd98b':'#6d583f';ctx.fillRect(p.x-1*s,p.y+1*s,2*s,3*s);}
function drawFarmAt(p,r){const s=scaleAt(p,r)*.9;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-.3);ctx.fillStyle='#9a8244';ctx.fillRect(-7*s,-4*s,14*s,8*s);ctx.strokeStyle='#d3bd65';ctx.lineWidth=Math.max(.7,s*.65);for(let y=-2.5;y<=2.5;y+=2.5){ctx.beginPath();ctx.moveTo(-6*s,y*s);ctx.lineTo(6*s,y*s);ctx.stroke();}ctx.restore();}
function roleColor(role){return{woodcutter:'#c78650',farmer:'#6f9d60',miner:'#909aa4',trader:'#d0a44b'}[role]||'#9db29d';}
function drawAgent(a,cx,cy,r){const g=localToGeo(a.x,a.y),p=project(g.lon,g.lat,cx,cy,r);if(!p)return null;const s=scaleAt(p,r)*clamp(.72+zoom*.18,.8,1.7),rad=clamp(2.2*s,2.2,8);ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(p.x,p.y+rad*.9,rad*.9,rad*.35,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=roleColor(a.role);ctx.beginPath();ctx.arc(p.x,p.y,rad,0,Math.PI*2);ctx.fill();ctx.strokeStyle=a.id===selectedId?'#fff0b9':'rgba(255,255,255,.72)';ctx.lineWidth=a.id===selectedId?2.3:1;ctx.stroke();if(zoom>2.25){ctx.font=`600 ${clamp(9*s,10,15)}px system-ui,-apple-system,sans-serif`;ctx.textAlign='center';ctx.fillStyle='#fff7dc';ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=4;ctx.fillText(a.name||'Villager',p.x,p.y-rad-5);ctx.shadowBlur=0;}return{x:p.x,y:p.y,id:a.id,a};}
function drawStatic(list,fn,cx,cy,r){list.map(v=>project(v[0],v[1],cx,cy,r)).filter(Boolean).sort((a,b)=>a.z-b.z).forEach(p=>fn(p,r));}
function drawWorldObjects(cx,cy,r){if(!state)return;const farms=(state.farms||[]).map(f=>{const g=localToGeo(f.x,f.y);return project(g.lon,g.lat,cx,cy,r);}).filter(Boolean).sort((a,b)=>a.z-b.z);farms.forEach(p=>drawFarmAt(p,r));const buildings=(state.buildings||[]).map(b=>{const g=localToGeo(b.x,b.y);const p=project(g.lon,g.lat,cx,cy,r);return p?{p,b}:null;}).filter(Boolean).sort((a,b)=>a.p.z-b.p.z);buildings.forEach(({p,b})=>drawHouseAt(p,r,b.type==='market'||zoom>1.5));}
function draw(){if(!ctx)return;const w=canvas.clientWidth,h=canvas.clientHeight,cx=w/2,cy=h/2+Math.min(30,h*.035),r=Math.min(w,h)*.29*zoom;ctx.clearRect(0,0,w,h);const space=ctx.createLinearGradient(0,0,w,h);space.addColorStop(0,'#08110f');space.addColorStop(.55,'#0a1716');space.addColorStop(1,'#091018');ctx.fillStyle=space;ctx.fillRect(0,0,w,h);stars.forEach(s=>{ctx.globalAlpha=s.a;ctx.fillStyle='#dce8df';ctx.beginPath();ctx.arc(s.x*w,s.y*h,s.a>.65?1.1:.65,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;const sea=ctx.createRadialGradient(cx-r*.34,cy-r*.4,r*.05,cx,cy,r);sea.addColorStop(0,'#79c7bd');sea.addColorStop(.33,'#3f9e9d');sea.addColorStop(.68,'#247783');sea.addColorStop(1,'#123f59');ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=sea;ctx.fill();ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();lands.forEach(land=>{traceLand(land.pts,cx,cy,r);ctx.fillStyle=land.fill;ctx.fill();ctx.strokeStyle=land.edge;ctx.globalAlpha=.48;ctx.lineWidth=Math.max(1,r*.006);ctx.stroke();ctx.globalAlpha=1;});drawStatic(hills,drawHill,cx,cy,r);drawStatic(forests,drawTree,cx,cy,r);drawStatic(mountains,drawMountain,cx,cy,r);if(zoom>1.25)drawWorldObjects(cx,cy,r);const hits=[];if(state&&zoom>1.35)(state.agents||[]).forEach(a=>{const hit=drawAgent(a,cx,cy,r);if(hit)hits.push(hit);});canvas._agentHits=hits;ctx.restore();const shade=ctx.createRadialGradient(cx-r*.28,cy-r*.34,r*.2,cx,cy,r);shade.addColorStop(0,'rgba(255,255,255,.08)');shade.addColorStop(.68,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,5,12,.48)');ctx.fillStyle=shade;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(122,218,214,.34)';ctx.lineWidth=Math.max(2,r*.01);ctx.beginPath();ctx.arc(cx,cy,r+1,0,Math.PI*2);ctx.stroke();const mp=project(marker.lon,marker.lat,cx,cy,r);if(mp){const pulse=reduce.matches?1:1+Math.sin(performance.now()*.005)*.09,s=scaleAt(mp,r);ctx.strokeStyle='rgba(255,221,139,.95)';ctx.lineWidth=Math.max(1.4,2*s);ctx.beginPath();ctx.arc(mp.x,mp.y,10*s*pulse,0,Math.PI*2);ctx.stroke();if(zoom<2.25){ctx.font=`700 ${Math.max(10,12*s)}px system-ui,-apple-system,sans-serif`;ctx.textAlign='center';ctx.fillStyle='#fff0bd';ctx.fillText('CIVORIA',mp.x,mp.y-16*s);}}
if(state){const pop=(state.agents||[]).length;status.textContent=`Day ${state.day} · ${pop} villager${pop===1?'':'s'} · ${zoom<1.35?'zoom closer to see them':'living on the globe'}`;}else status.textContent='Connecting to the shared world…';}
function resize(){const box=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(box.width*dpr));canvas.height=Math.max(1,Math.round(box.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
function setZoom(v){zoom=clamp(v,.72,4.2);draw();}
function focusCivoria(){yaw=-marker.lon*Math.PI/180;pitch=marker.lat*Math.PI/180*.55;setZoom(Math.max(zoom,2.65));}
focusBtn.textContent='Focus Civoria';focusBtn.addEventListener('click',focusCivoria);
canvas.style.touchAction='none';canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom-e.deltaY*.0018);},{passive:false});
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture?.(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastX=e.clientX;lastY=e.clientY;if(pointers.size===2){const p=[...pointers.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinch)setZoom(zoom+(d-pinch)*.007);pinch=d;return;}yaw+=(e.clientX-lastX)*.008;pitch=clamp(pitch-(e.clientY-lastY)*.006,-1.05,1.05);lastX=e.clientX;lastY=e.clientY;draw();});
function endPointer(e){pointers.delete(e.pointerId);if(pointers.size<2)pinch=0;}canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('click',e=>{if(!canvas._agentHits||!canvas._agentHits.length)return;const box=canvas.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top;let best=null,bd=22;canvas._agentHits.forEach(h=>{const d=Math.hypot(h.x-x,h.y-y);if(d<bd){bd=d;best=h;}});if(best){selectedId=best.id;status.textContent=`${best.a.name} · ${best.a.role||'newcomer'} · ${best.a.state||'living'}`;draw();}});
async function sync(){try{const response=await fetch('/api/tick',{method:'POST',cache:'no-store'});if(!response.ok)throw new Error('unavailable');const data=await response.json();if(data.state&&Array.isArray(data.state.agents)&&data.revision>=revision){state=data.state;revision=data.revision;draw();}}catch(e){status.textContent=state?'Connection interrupted · showing last shared state':'Connecting to the shared world…';}clearTimeout(syncTimer);syncTimer=setTimeout(sync,5000);}
function frame(){draw();raf=requestAnimationFrame(frame);}window.addEventListener('resize',resize,{passive:true});resize();sync();if(!reduce.matches)raf=requestAnimationFrame(frame);
})();