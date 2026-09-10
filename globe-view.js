const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
const body=document.body;
const section=document.getElementById('world-map');
const canvas=document.getElementById('globeCanvas');
const statusEl=document.getElementById('globeStatus');
const fallback=document.getElementById('globeFallback');
const enterBtn=document.getElementById('enterSettlementBtn');
const worldBtn=document.getElementById('worldViewBtn');
const worldNav=document.getElementById('worldNav');
const aboutNav=document.querySelector('.siteNav a[href="#about"]');
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let scriptsPromise=null;
let entering=false;
let controller=null;

function loadScript(src){
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;
    script.onload=resolve;
    script.onerror=()=>reject(new Error(`Could not load ${src}`));
    document.body.appendChild(script);
  });
}
function loadSettlement(){
  if(!scriptsPromise) scriptsPromise=loadScript('activity-clock.js').then(()=>loadScript('game.js'));
  return scriptsPromise;
}
async function enterSettlement(target='live-world',instant=false){
  if(entering||body.classList.contains('settlement-mode')) return;
  entering=true;
  statusEl.textContent='Entering the inhabited region…';
  try{ await loadSettlement(); }
  catch(error){
    console.error(error);
    statusEl.textContent='Settlement viewer failed to load. Reload and try again.';
    entering=false;
    return;
  }
  controller?.pause();
  body.classList.remove('globe-mode');
  body.classList.add('settlement-mode');
  section.classList.add('is-leaving');
  const finish=()=>{
    section.classList.add('is-hidden');
    section.classList.remove('is-leaving');
    history.pushState(null,'',`#${target}`);
    document.getElementById(target)?.scrollIntoView({behavior:(instant||reduceMotion.matches)?'auto':'smooth',block:'start'});
    entering=false;
  };
  (instant||reduceMotion.matches)?finish():setTimeout(finish,560);
}
function reloadIntoGlobe(event){
  event?.preventDefault();
  if(body.classList.contains('globe-mode')){
    section.scrollIntoView({behavior:reduceMotion.matches?'auto':'smooth'});
    return;
  }
  history.replaceState(null,'','#world-map');
  location.reload();
}
enterBtn?.addEventListener('click',()=>enterSettlement());
worldBtn?.addEventListener('click',reloadIntoGlobe);
worldNav?.addEventListener('click',reloadIntoGlobe);
aboutNav?.addEventListener('click',event=>{
  if(!body.classList.contains('globe-mode')) return;
  event.preventDefault();
  enterSettlement('about');
});

function terrainTexture(THREE,lowPower){
  const c=document.createElement('canvas');
  c.width=lowPower?512:1024;c.height=c.width/2;
  const x=c.getContext('2d'),w=c.width,h=c.height;
  const sea=x.createLinearGradient(0,0,0,h);
  sea.addColorStop(0,'#15394e');sea.addColorStop(.52,'#286b72');sea.addColorStop(1,'#15384a');
  x.fillStyle=sea;x.fillRect(0,0,w,h);
  const land=(points,color)=>{
    x.beginPath();x.moveTo(points[0][0]*w,points[0][1]*h);
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      x.quadraticCurveTo(a[0]*w,a[1]*h,(a[0]+b[0])*.5*w,(a[1]+b[1])*.5*h);
    }
    const last=points.at(-1),first=points[0];
    x.quadraticCurveTo(last[0]*w,last[1]*h,first[0]*w,first[1]*h);x.closePath();x.fillStyle=color;x.fill();
  };
  land([[.04,.27],[.13,.14],[.28,.18],[.33,.32],[.26,.47],[.14,.49],[.07,.39]],'#47755b');
  land([[.17,.58],[.28,.49],[.36,.58],[.32,.80],[.23,.89],[.16,.75]],'#71875d');
  land([[.40,.23],[.52,.11],[.68,.18],[.73,.33],[.63,.43],[.52,.37],[.45,.45],[.38,.34]],'#527b58');
  land([[.60,.50],[.73,.41],[.85,.48],[.92,.64],[.84,.79],[.69,.77],[.61,.67]],'#748d61');
  land([[.82,.17],[.92,.13],[.98,.24],[.93,.37],[.84,.33]],'#456d55');
  land([[.43,.62],[.51,.56],[.57,.68],[.52,.81],[.43,.76],[.39,.68]],'#6b845a');
  let seed=3389;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<(lowPower?700:1500);i++){
    x.fillStyle=rand()>.48?`rgba(232,238,197,${.015+rand()*.05})`:`rgba(5,28,30,${.015+rand()*.05})`;
    x.fillRect(rand()*w,rand()*h,1+rand()*2,1+rand()*2);
  }
  x.strokeStyle='rgba(220,235,217,.075)';x.lineWidth=1;
  for(let i=1;i<6;i++){x.beginPath();x.moveTo(0,i*h/6);x.lineTo(w,i*h/6);x.stroke();}
  for(let i=1;i<12;i++){x.beginPath();x.moveTo(i*w/12,0);x.lineTo(i*w/12,h);x.stroke();}
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function labelTexture(THREE){
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const x=c.getContext('2d');
  x.fillStyle='rgba(10,19,14,.88)';x.fillRect(12,18,488,92);
  x.strokeStyle='rgba(229,200,119,.75)';x.lineWidth=3;x.strokeRect(12,18,488,92);
  x.fillStyle='#f2e5bc';x.font='700 42px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('CIVORIA',256,64);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
async function createGlobe(){
  const coarse=matchMedia('(pointer: coarse)').matches;
  const lowPower=coarse||innerWidth<720||(navigator.deviceMemory&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);
  let THREE;
  try{ THREE=await import(THREE_URL); }
  catch(error){console.error(error);canvas.hidden=true;fallback.hidden=false;statusEl.textContent='3D globe unavailable · settlement is still accessible';return null;}
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!lowPower,powerPreference:'high-performance'});}
  catch(error){console.error(error);canvas.hidden=true;fallback.hidden=false;statusEl.textContent='WebGL unavailable · settlement is still accessible';return null;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,lowPower?1.25:1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x08110d,0);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.z=3.3;
  const world=new THREE.Group();scene.add(world);
  scene.add(new THREE.HemisphereLight(0xb8d6cf,0x17251b,2.1));
  const sun=new THREE.DirectionalLight(0xffe0a0,2.7);sun.position.set(4,3,5);scene.add(sun);
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,lowPower?48:80,lowPower?32:56),new THREE.MeshStandardMaterial({map:terrainTexture(THREE,lowPower),roughness:.84,metalness:.02}));world.add(sphere);
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(1.055,lowPower?36:64,lowPower?24:40),new THREE.MeshBasicMaterial({color:0x79aeba,transparent:true,opacity:.1,side:THREE.BackSide}));world.add(atmosphere);
  const direction=new THREE.Vector3(.31,.22,.925).normalize();
  const marker=new THREE.Group();marker.position.copy(direction.clone().multiplyScalar(1.018));marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);world.add(marker);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.074,.012,10,48),new THREE.MeshBasicMaterial({color:0xe5c877}));marker.add(ring);
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.026,16,12),new THREE.MeshBasicMaterial({color:0xffe5a1}));dot.position.z=.016;marker.add(dot);
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture(THREE),transparent:true,depthWrite:false}));label.scale.set(.42,.105,1);label.position.copy(direction.clone().multiplyScalar(1.18));world.add(label);
  const starCount=lowPower?160:360,positions=new Float32Array(starCount*3);let seed=97;const rand=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  for(let i=0;i<starCount;i++){const r=5+rand()*6,t=rand()*Math.PI*2,p=Math.acos(2*rand()-1);positions[i*3]=r*Math.sin(p)*Math.cos(t);positions[i*3+1]=r*Math.cos(p);positions[i*3+2]=r*Math.sin(p)*Math.sin(t);}
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(positions,3));scene.add(new THREE.Points(sg,new THREE.PointsMaterial({size:lowPower?.012:.018,color:0xdce8dd,transparent:true,opacity:.55})));
  world.rotation.set(-.1,-.06,0);
  const pointers=new Map(),raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2(),tmp=new THREE.Vector3();
  let raf=0,running=true,dragging=false,moved=false,lastX=0,lastY=0,pinch=0,interacted=false,lastFrame=performance.now();
  const MIN=1.88,MAX=4.35,ENTER=2.18;
  const resize=()=>{const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};
  const markerCentered=()=>{marker.getWorldPosition(tmp);if(tmp.z<.18)return false;const p=tmp.clone().project(camera);return Math.hypot(p.x,p.y)<.34;};
  const zoomTo=value=>{camera.position.z=THREE.MathUtils.clamp(value,MIN,MAX);if(camera.position.z<2.65)statusEl.textContent=markerCentered()?'Civoria settlement · zoom to enter':'Rotate the Civoria marker toward the center';if(camera.position.z<=ENTER&&markerCentered())enterSettlement();};
  canvas.addEventListener('wheel',event=>{event.preventDefault();interacted=true;zoomTo(camera.position.z+event.deltaY*.0021);},{passive:false});
  canvas.addEventListener('pointerdown',event=>{canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});interacted=true;dragging=true;moved=false;lastX=event.clientX;lastY=event.clientY;canvas.classList.add('is-dragging');if(pointers.size===2){const p=[...pointers.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
  canvas.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinch){zoomTo(camera.position.z-(d-pinch)*.008);if(Math.abs(d-pinch)>2)moved=true;}pinch=d;return;}const dx=event.clientX-lastX,dy=event.clientY-lastY;if(Math.abs(dx)+Math.abs(dy)>1.5)moved=true;world.rotation.y+=dx*.0065;world.rotation.x=THREE.MathUtils.clamp(world.rotation.x+dy*.0048,-1.05,1.05);lastX=event.clientX;lastY=event.clientY;});
  const release=event=>{const tap=!moved&&pointers.size===1;pointers.delete(event.pointerId);if(pointers.size<2)pinch=0;if(!pointers.size){dragging=false;canvas.classList.remove('is-dragging');}if(tap){const r=canvas.getBoundingClientRect();ndc.set((event.clientX-r.left)/r.width*2-1,-((event.clientY-r.top)/r.height*2-1));raycaster.setFromCamera(ndc,camera);if(raycaster.intersectObjects([ring,dot,label],true).length)enterSettlement();}};
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  const frame=now=>{if(!running||document.hidden||!body.classList.contains('globe-mode')){raf=0;return;}const dt=Math.min(.05,(now-lastFrame)/1000||0);lastFrame=now;if(!reduceMotion.matches&&!dragging&&!interacted)world.rotation.y+=dt*.045;if(!reduceMotion.matches)ring.scale.setScalar(1+Math.sin(now*.004)*.08);renderer.render(scene,camera);raf=requestAnimationFrame(frame);};
  const pause=()=>{running=false;if(raf){cancelAnimationFrame(raf);raf=0;}};
  const resume=()=>{running=true;resize();lastFrame=performance.now();if(!raf&&!document.hidden)raf=requestAnimationFrame(frame);};
  new ResizeObserver(resize).observe(canvas);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else if(body.classList.contains('globe-mode'))resume();});
  resize();raf=requestAnimationFrame(frame);return{pause,resume};
}

if(location.hash==='#live-world'||location.hash==='#about'){
  body.classList.remove('globe-mode');body.classList.add('settlement-mode');section.classList.add('is-hidden');
  loadSettlement();
}else{
  body.classList.add('globe-mode');
  createGlobe().then(value=>{controller=value;});
}
