import * as THREE from './three.module.js';

const canvas=document.getElementById('globeCanvas');
const status=document.getElementById('globeStatus');
const focusBtn=document.getElementById('enterSettlementBtn');
const fallback=document.getElementById('globeFallback');
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse=window.matchMedia('(pointer: coarse)').matches;
const WORLD={W:480,H:304};
const MARKER={lon:28,lat:14};
let renderer,scene,camera,planet,terrain,raf=0,revision=-1,state=null,syncTimer=0;
let rotX=0.06,rotY=-0.3,targetRotX=rotX,targetRotY=rotY,cameraZ=3.15,targetCameraZ=cameraZ;
let dragging=false,lastX=0,lastY=0,pinch=0;
const pointers=new Map();
const villagerMeshes=new Map();

const lands=[
 [[-150,55],[-132,70],[-102,69],[-78,55],[-62,39],[-72,20],[-98,13],[-128,28]],
 [[-83,13],[-66,9],[-49,-5],[-51,-29],[-65,-50],[-77,-31]],
 [[-10,69],[24,70],[58,60],[91,51],[121,33],[137,10],[108,0],[78,20],[47,27],[19,39],[-7,34]],
 [[-18,34],[8,38],[31,21],[40,-3],[25,-32],[3,-35],[-13,-11]],
 [[112,-10],[153,-12],[161,-37],[136,-46],[113,-31]],
 [[-48,82],[-25,78],[-18,66],[-42,61],[-59,70]]
];
const forests=[[-133,44],[-121,35],[-88,48],[-73,30],[-60,-12],[-56,-25],[7,52],[18,44],[40,35],[66,35],[85,24],[18,5],[7,-20],[116,5],[132,-21]];
const mountains=[[-111,53],[-95,62],[28,55],[55,48],[83,39],[31,20],[9,-5],[-66,-18],[139,-30]];
const farms=[[18,18],[22,17],[16,14],[-75,3],[-72,0],[106,-8]];

function fallbackToCanvas(err){
  console.warn('GPU globe unavailable, using Canvas fallback.',err);
  if(renderer)renderer.dispose();
  cancelAnimationFrame(raf);
  const replacement=canvas.cloneNode(false);
  canvas.replaceWith(replacement);
  if(fallback)fallback.hidden=true;
  const s=document.createElement('script');s.src='globe-fallback.js';document.body.appendChild(s);
}
function lonX(lon,w){return (lon+180)/360*w;}
function latY(lat,h){return (90-lat)/180*h;}
function makeTexture(){
  const c=document.createElement('canvas'),w=coarse?1024:1536,h=w/2;c.width=w;c.height=h;
  const x=c.getContext('2d');
  const sea=x.createLinearGradient(0,0,0,h);sea.addColorStop(0,'#4a9da1');sea.addColorStop(.55,'#287786');sea.addColorStop(1,'#123f59');x.fillStyle=sea;x.fillRect(0,0,w,h);
  lands.forEach((poly,i)=>{x.beginPath();poly.forEach(([lon,lat],j)=>{const px=lonX(lon,w),py=latY(lat,h);j?x.lineTo(px,py):x.moveTo(px,py);});x.closePath();x.fillStyle=i%2?'#6d9554':'#567f4c';x.fill();x.strokeStyle='rgba(190,220,145,.5)';x.lineWidth=Math.max(2,w/700);x.stroke();});
  forests.forEach(([lon,lat])=>{x.fillStyle='#285f35';x.beginPath();x.arc(lonX(lon,w),latY(lat,h),w/180,0,Math.PI*2);x.fill();x.fillStyle='#3c7d40';x.beginPath();x.arc(lonX(lon,w)+w/450,latY(lat,h)-w/500,w/260,0,Math.PI*2);x.fill();});
  mountains.forEach(([lon,lat])=>{const px=lonX(lon,w),py=latY(lat,h),s=w/220;x.fillStyle='#777c70';x.beginPath();x.moveTo(px,py-s);x.lineTo(px-s,py+s);x.lineTo(px+s,py+s);x.closePath();x.fill();x.fillStyle='#dde2d4';x.beginPath();x.moveTo(px,py-s);x.lineTo(px-s*.32,py-s*.35);x.lineTo(px+s*.35,py-s*.28);x.closePath();x.fill();});
  farms.forEach(([lon,lat])=>{const px=lonX(lon,w),py=latY(lat,h),s=w/260;x.save();x.translate(px,py);x.rotate(-.25);x.fillStyle='#a68a46';x.fillRect(-s,-s*.55,s*2,s*1.1);x.strokeStyle='#d9c76f';for(let i=-.35;i<=.35;i+=.35){x.beginPath();x.moveTo(-s,i*s);x.lineTo(s,i*s);x.stroke();}x.restore();});
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=coarse?1:2;tex.needsUpdate=true;return tex;
}
function geoToVec(lon,lat,r=1){const phi=(90-lat)*Math.PI/180,theta=(lon+180)*Math.PI/180;return new THREE.Vector3(-r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta));}
function localToGeo(x,y){return{lon:MARKER.lon+(x-WORLD.W/2)*.075,lat:MARKER.lat-(y-WORLD.H/2)*.062};}
function makeDotTexture(color){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.clearRect(0,0,64,64);x.fillStyle='rgba(0,0,0,.28)';x.beginPath();x.ellipse(32,43,14,6,0,0,Math.PI*2);x.fill();x.fillStyle=color;x.beginPath();x.arc(32,28,12,0,Math.PI*2);x.fill();x.strokeStyle='rgba(255,255,255,.8)';x.lineWidth=3;x.stroke();const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
function roleColor(role){return{woodcutter:'#c78650',farmer:'#6f9d60',miner:'#909aa4',trader:'#d0a44b'}[role]||'#9db29d';}
function makeHouse(){const g=new THREE.Group();const base=new THREE.Mesh(new THREE.BoxGeometry(.025,.022,.025),new THREE.MeshLambertMaterial({color:0xc49a63}));const roof=new THREE.Mesh(new THREE.ConeGeometry(.022,.022,4),new THREE.MeshLambertMaterial({color:0x704d3b}));roof.position.y=.022;roof.rotation.y=Math.PI/4;g.add(base,roof);return g;}
function orientSurfaceObject(obj,pos){obj.position.copy(pos);obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),pos.clone().normalize());}
function rebuildLiveObjects(){
  if(!state)return;
  [...planet.children].filter(o=>o.userData.live).forEach(o=>planet.remove(o));
  villagerMeshes.clear();
  (state.buildings||[]).forEach(b=>{const g=localToGeo(b.x,b.y),h=makeHouse();h.userData.live=true;orientSurfaceObject(h,geoToVec(g.lon,g.lat,1.015));planet.add(h);});
  (state.agents||[]).forEach(a=>{const g=localToGeo(a.x,a.y);const mat=new THREE.SpriteMaterial({map:makeDotTexture(roleColor(a.role)),transparent:true,depthWrite:false});const s=new THREE.Sprite(mat);s.scale.set(.045,.045,.045);s.userData={live:true,id:a.id,name:a.name,role:a.role,target:geoToVec(g.lon,g.lat,1.025)};s.position.copy(s.userData.target);planet.add(s);villagerMeshes.set(a.id,s);});
}
function updateVillagers(){
  if(!state)return;
  (state.agents||[]).forEach(a=>{const mesh=villagerMeshes.get(a.id);if(!mesh)return;const g=localToGeo(a.x,a.y);mesh.userData.target=geoToVec(g.lon,g.lat,1.025);mesh.userData.name=a.name;mesh.userData.role=a.role;});
}
function resize(){const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
function focusCivoria(){targetRotY=-MARKER.lon*Math.PI/180;targetRotX=MARKER.lat*Math.PI/180*.55;targetCameraZ=Math.min(targetCameraZ,1.75);}
function setZoom(delta){targetCameraZ=Math.max(1.35,Math.min(4.2,targetCameraZ+delta));}
function animate(){
  const ease=dragging?1:.16;rotX+=(targetRotX-rotX)*ease;rotY+=(targetRotY-rotY)*ease;cameraZ+=(targetCameraZ-cameraZ)*(dragging?1:.18);planet.rotation.x=rotX;planet.rotation.y=rotY;camera.position.z=cameraZ;
  villagerMeshes.forEach(m=>m.position.lerp(m.userData.target,.12));
  renderer.render(scene,camera);
  if(state){const pop=(state.agents||[]).length;status.textContent=`Day ${state.day} · ${pop} villager${pop===1?'':'s'} · ${cameraZ<2.35?'close world view':'drag or pinch to explore'}`;}
  raf=requestAnimationFrame(animate);
}
async function sync(){try{const response=await fetch('/api/tick',{method:'POST',cache:'no-store'});if(!response.ok)throw new Error('unavailable');const data=await response.json();if(data.state&&Array.isArray(data.state.agents)&&data.revision>=revision){const first=!state;state=data.state;revision=data.revision;if(first||villagerMeshes.size!==(state.agents||[]).length)rebuildLiveObjects();else updateVillagers();}}catch(e){status.textContent=state?'Connection interrupted · showing last shared state':'Connecting to the shared world…';}clearTimeout(syncTimer);syncTimer=setTimeout(sync,5000);}

try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:!coarse,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(coarse?1:Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x07100f);camera=new THREE.PerspectiveCamera(42,1,.1,20);camera.position.set(0,0,cameraZ);
  planet=new THREE.Group();scene.add(planet);
  terrain=new THREE.Mesh(new THREE.SphereGeometry(1,coarse?64:96,coarse?48:64),new THREE.MeshLambertMaterial({map:makeTexture()}));planet.add(terrain);
  const glow=new THREE.Mesh(new THREE.SphereGeometry(1.018,coarse?48:72,coarse?32:48),new THREE.MeshBasicMaterial({color:0x75d7d0,transparent:true,opacity:.06,side:THREE.BackSide}));planet.add(glow);
  scene.add(new THREE.HemisphereLight(0xcfe6dc,0x10243a,2.2));const sun=new THREE.DirectionalLight(0xffefd0,2.4);sun.position.set(-3,4,5);scene.add(sun);
  const starsGeo=new THREE.BufferGeometry();const starCount=coarse?350:700,arr=new Float32Array(starCount*3);for(let i=0;i<starCount;i++){const r=5+Math.random()*4,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);arr[i*3]=r*Math.sin(phi)*Math.cos(theta);arr[i*3+1]=r*Math.cos(phi);arr[i*3+2]=r*Math.sin(phi)*Math.sin(theta);}starsGeo.setAttribute('position',new THREE.BufferAttribute(arr,3));scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0xcfe0d8,size:.018,sizeAttenuation:true})));
  focusBtn.textContent='Focus Civoria';focusBtn.addEventListener('click',focusCivoria);canvas.style.touchAction='none';
  canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(e.deltaY*.0025);},{passive:false});
  canvas.addEventListener('pointerdown',e=>{dragging=true;canvas.setPointerCapture?.(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastX=e.clientX;lastY=e.clientY;if(pointers.size===2){const p=[...pointers.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinch)setZoom(-(d-pinch)*.008);pinch=d;return;}targetRotY+=(e.clientX-lastX)*.006;targetRotX=Math.max(-1.15,Math.min(1.15,targetRotX+(e.clientY-lastY)*.005));lastX=e.clientX;lastY=e.clientY;});
  const end=e=>{pointers.delete(e.pointerId);if(pointers.size===0)dragging=false;if(pointers.size<2)pinch=0;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  window.addEventListener('resize',resize,{passive:true});resize();sync();animate();
}catch(err){fallbackToCanvas(err);}
