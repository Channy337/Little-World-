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
const coarse=window.matchMedia('(pointer: coarse)').matches;
let yaw=-0.3,pitch=0.06,zoom=1,raf=0,lastX=0,lastY=0,pinch=0,state=null,revision=-1,syncTimer=0,selectedId=null;
let drawQueued=false,interacting=false,interactionTimer=0,lastPulseFrame=0;
let geoFarms=[],geoBuildings=[],geoAgents=[];
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
const stars=Array.from({length:coarse?34:58},(_,i)=>({x:(i*83%997)/997,y:(i*211%991)/991,a:.18+((i*47)%70)/100}));
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function rotatePoint(lon,lat){const la=lat*Math.PI/180,lo=lon*Math.PI/180+yaw;let x=Math.cos(la)*Math.sin(lo),y=Math.sin(la),z=Math.cos(la)*Math.cos(lo);const cp=Math.cos(pitch),sp=Math.sin(pitch);return{x,y:y*cp-z*sp,z:y*sp+z*cp};}
function project(lon,lat,cx,cy,r){const p=rotatePoint(lon,lat);return p.z<=.012?null:{x:cx+p.x*r,y:cy-p.y*r,z:p.z};}
function scaleAt(p,r){return Math.max(.34,p.z)*Math.max(.72,r/240);}
function localToGeo(x,y){return{lon:marker.lon+(x-WORLD.W/2)*.075,lat:marker.lat-(y-WORLD.H/2)*.062};}
function traceLand(poly,cx,cy,r,fast){ctx.beginPath();let active=false;const step=fast?.12:.06;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];for(let t=0;t<1;t+=step){const p=project(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,cx,cy,r);if(!p){active=false;continue;}if(!active){ctx.moveTo(p.x,p.y);active=true;}else ctx.lineTo(p.x,p.y);}}}
function drawTree(p,r){const s=scaleAt(p,r);ctx.fillStyle='#183f27';ctx.fillRect(p.x-.7*s,p.y,1.4*s,5*s);ctx.fillStyle='#2f6d39';ctx.beginPath();ctx.moveTo(p.x,p.y-8*s);ctx.lineTo(p.x-5*s,p.y+1*s);ctx.lineTo(p.x+5*s,p.y+1*s);ctx.closePath();ctx.fill();ctx.fillStyle='#4b8c45';ctx.beginPath();ctx.moveTo(p.x,p.y-5*s);ctx.lineTo(p.x-4*s,p.y+2*s);ctx.lineTo(p.x+4*s,p.y+2*s);ctx.closePath();ctx.fill();}
function drawMountain(p,r){const s=scaleAt(p,r)*1.15;ctx.fillStyle='#6f7468';ctx.beginPath();ctx.moveTo(p.x,p.y-11*s);ctx.lineTo(p.x-9*s,p.y+6*s);ctx.lineTo(p.x+9*s,p.y+6*s);ctx.closePath();ctx.fill();ctx.fillStyle='#9b9d8d';ctx.beginPath();ctx.moveTo(p.x,p.y-11*s);ctx.lineTo(p.x,p.y+6*s);ctx.lineTo(p.x+9*s,p.y+6*s);ctx.closePath();ctx.fill();if(!interacting){ctx.fillStyle='#d9ded0';ctx.beginPath();ctx.moveTo(p.x,p.y-11*s);ctx.lineTo(p.x-3*s,p.y-5*s);ctx.lineTo(p.x,p.y-6*s);ctx.lineTo(p.x+3*s,p.y-4*s);ctx.closePath();ctx.fill();}}
function drawHill(p,r){const s=scaleAt(p,r);ctx.fillStyle='#557f43';ctx.beginPath();ctx.ellipse(p.x,p.y,8*s,4.5*s,-.15,Math.PI,Math.PI*2);ctx.fill();}
function drawHouseAt(p,r,lit){const s=scaleAt(p,r)*clamp(.7+zoom*.16,.8,1.55);ctx.fillStyle='#c49a63';ctx.fillRect(p.x-4*s,p.y-1*s,8*s,6*s);ctx.fillStyle='#6f4d3b';ctx.beginPath();ctx.moveTo(p.x-5*s,p.y);ctx.lineTo(p.x,p.y-5*s);ctx.lineTo(p.x+5*s,p.y);ctx.closePath();ctx.fill();if(!interacting){ctx.fillStyle=lit?'#ffd98b':'#6d583f';ctx.fillRect(p.x-1*s,p.y+1*s,2*s,3*s);}}
function drawFarmAt(p,r){const s=scaleAt(p,r)*.9;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-.3);ctx.fillStyle='#9a8244';ctx.fillRect(-7*s,-4*s,14*s,8*s);if(!interacting){ctx.strokeStyle='#d3bd65';ctx.lineWidth=Math.max(.7,s*.65);for(let y=-2.5;y<=2.5;y+=2.5){ctx.beginPath();ctx.moveTo(-6*s,y*s);ctx.lineTo(6*s,y*s);ctx.stroke();}}ctx.restore();}
function roleColor(role){return{woodcutter:'#c78650',farmer:'#6f9d60',miner:'#909aa4',trader:'#d0a44b'}[role]||'#9db29d';}
function drawAgent(entry,cx,cy,r){const p=project(entry.lon,entry.lat,cx,cy,r);if(!p)return null;const a=entry.a,s=scaleAt(p,r)*clamp(.72+zoom*.18,.8,1.7),rad=clamp(2.2*s,2.2,8);ctx.fillStyle=roleColor(a.role);ctx.beginPath();ctx.arc(p.x,p.y,rad,0,Math.PI*2);ctx.fill();if(!interacting){ctx.strokeStyle=a.id===selectedId?'#fff0b9':'rgba(255,255,255,.72)';ctx.lineWidth=a.id===selectedId?2.3:1;ctx.stroke();if(zoom>2.25){ctx.font=`600 ${clamp(9*s,10,15)}px system-ui,-apple-system,sans-serif`;ctx.textAlign='center';ctx.fillStyle='#fff7dc';ctx.fillText(a.name||'Villager',p.x,p.y-rad-5);}}return{x:p.x,y:p.y,id:a.id,a};}
function drawStatic(list,fn,cx,cy,r){for(let i=0;i<list.length;i++){const p=project(list[i][0],list[i][1],cx,cy,r);if(p)fn(p,r);}}
function rebuildGeoCache(){if(!state){geoFarms=[];geoBuildings=[];geoAgents=[];return;}geoFarms=(state.farms||[]).map(f=>{const g=localToGeo(f.x,f.y);return{lon:g.lon,lat:g.lat,f};});geoBuildings=(state.buildings||[]).map(b=>{const g=localToGeo(b.x,b.y);return{lon:g.lon,lat:g.lat,b};});geoAgents=(state.agents||[]).map(a=>{const g=localToGeo(a.x,a.y);return{lon:g.lon,lat:g.lat,a};});}
function drawWorldObjects(cx,cy,r){for(let i=0;i<geoFarms.length;i++){const e=geoFarms[i],p=project(e.lon,e.lat,cx,cy,r);if(p)drawFarmAt(p,r);}for(let i=0;i<geoBuildings.length;i++){const e=geoBuildings[i],p=project(e.lon,e.lat,cx,cy,r);if(p)drawHouseAt(p,r,e.b.type==='market'||zoom>1.5);}}
function draw(){drawQueued=false;if(!ctx)return;const w=canvas.clientWidth,h=canvas.clientHeight,cx=w/2,cy=h/2+Math.min(30,h*.035),r=Math.min(w,h)*.29*zoom;ctx.clearRect(0,0,w,h);ctx.fillStyle='#091312';ctx.fillRect(0,0,w,h);if(!interacting){for(let i=0;i<stars.length;i++){const s=stars[i];ctx.globalAlpha=s.a;ctx.fillStyle='#dce8df';ctx.beginPath();ctx.arc(s.x*w,s.y*h,s.a>.65?1:.6,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}const sea=ctx.createRadialGradient(cx-r*.34,cy-r*.4,r*.05,cx,cy,r);sea.addColorStop(0,'#79c7bd');sea.addColorStop(.4,'#3f9e9d');sea.addColorStop(1,'#123f59');ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=sea;ctx.fill();ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();for(let i=0;i<lands.length;i++){const land=lands[i];traceLand(land.pts,cx,cy,r,interacting);ctx.fillStyle=land.fill;ctx.fill();if(!interacting){ctx.strokeStyle=land.edge;ctx.globalAlpha=.42;ctx.lineWidth=Math.max(1,r*.006);ctx.stroke();ctx.globalAlpha=1;}}drawStatic(hills,drawHill,cx,cy,r);if(!interacting){drawStatic(forests,drawTree,cx,cy,r);drawStatic(mountains,drawMountain,cx,cy,r);}if(zoom>1.25)drawWorldObjects(cx,cy,r);const hits=[];if(state&&zoom>1.35){for(let i=0;i<geoAgents.length;i++){const hit=drawAgent(geoAgents[i],cx,cy,r);if(hit)hits.push(hit);}}canvas._agentHits=hits;ctx.restore();const shade=ctx.createRadialGradient(cx-r*.28,cy-r*.34,r*.2,cx,cy,r);shade.addColorStop(0,'rgba(255,255,255,.06)');shade.addColorStop(.72,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,5,12,.42)');ctx.fillStyle=shade;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(122,218,214,.28)';ctx.lineWidth=Math.max(2,r*.009);ctx.beginPath();ctx.arc(cx,cy,r+1,0,Math.PI*2);ctx.stroke();const mp=project(marker.lon,marker.lat,cx,cy,r);if(mp){const pulse=reduce.matches||interacting?1:1+Math.sin(performance.now()*.005)*.08,s=scaleAt(mp,r);ctx.strokeStyle='rgba(255,221,139,.95)';ctx.lineWidth=Math.max(1.4,2*s);ctx.beginPath();ctx.arc(mp.x,mp.y,10*s*pulse,0,Math.PI*2);ctx.stroke();if(zoom<2.25&&!interacting){ctx.font=`700 ${Math.max(10,12*s)}px system-ui,-apple-system,sans-serif`;ctx.textAlign='center';ctx.fillStyle='#fff0bd';ctx.fillText('CIVORIA',mp.x,mp.y-16*s);}}if(state){const pop=(state.agents||[]).length;status.textContent=`Day ${state.day} · ${pop} villager${pop===1?'':'s'} · ${zoom<1.35?'zoom closer to see them':'living on the globe'}`;}else status.textContent='Connecting to the shared world…';}
function requestDraw(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(draw);}
function markInteraction(){interacting=true;clearTimeout(interactionTimer);interactionTimer=setTimeout(()=>{interacting=false;requestDraw();},120);}
function resize(){const box=canvas.getBoundingClientRect();const dpr=coarse?1:Math.min(window.devicePixelRatio||1,1.35);canvas.width=Math.max(1,Math.round(box.width*dpr));canvas.height=Math.max(1,Math.round(box.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);requestDraw();}
function setZoom(v){zoom=clamp(v,.72,4.2);markInteraction();requestDraw();}
function focusCivoria(){yaw=-marker.lon*Math.PI/180;pitch=marker.lat*Math.PI/180*.55;zoom=Math.max(zoom,2.65);requestDraw();}
focusBtn.textContent='Focus Civoria';focusBtn.addEventListener('click',focusCivoria);
canvas.style.touchAction='none';canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom-e.deltaY*.0018);},{passive:false});
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture?.(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastX=e.clientX;lastY=e.clientY;markInteraction();if(pointers.size===2){const p=[...pointers.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;markInteraction();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinch)zoom=clamp(zoom+(d-pinch)*.007,.72,4.2);pinch=d;requestDraw();return;}yaw+=(e.clientX-lastX)*.008;pitch=clamp(pitch-(e.clientY-lastY)*.006,-1.05,1.05);lastX=e.clientX;lastY=e.clientY;requestDraw();});
function endPointer(e){pointers.delete(e.pointerId);if(pointers.size<2)pinch=0;markInteraction();}canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('click',e=>{if(!canvas._agentHits||!canvas._agentHits.length)return;const box=canvas.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top;let best=null,bd=22;for(let i=0;i<canvas._agentHits.length;i++){const h=canvas._agentHits[i],d=Math.hypot(h.x-x,h.y-y);if(d<bd){bd=d;best=h;}}if(best){selectedId=best.id;status.textContent=`${best.a.name} · ${best.a.role||'newcomer'} · ${best.a.state||'living'}`;requestDraw();}});
async function sync(){try{const response=await fetch('/api/tick',{method:'POST',cache:'no-store'});if(!response.ok)throw new Error('unavailable');const data=await response.json();if(data.state&&Array.isArray(data.state.agents)&&data.revision>=revision){state=data.state;revision=data.revision;rebuildGeoCache();requestDraw();}}catch(e){status.textContent=state?'Connection interrupted · showing last shared state':'Connecting to the shared world…';}clearTimeout(syncTimer);syncTimer=setTimeout(sync,5000);}
function idlePulse(now){if(!reduce.matches&&!interacting&&now-lastPulseFrame>80){lastPulseFrame=now;requestDraw();}raf=requestAnimationFrame(idlePulse);}
window.addEventListener('resize',resize,{passive:true});resize();sync();raf=requestAnimationFrame(idlePulse);
})();