const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const body=document.body;
const globeSection=document.getElementById('world-map');
const globeCanvas=document.getElementById('globeCanvas');
const globeStatus=document.getElementById('globeStatus');
const globeFallback=document.getElementById('globeFallback');
const enterButton=document.getElementById('enterSettlementBtn');
const worldButton=document.getElementById('worldViewBtn');
const worldNav=document.getElementById('worldNav');
const aboutNav=document.querySelector('.siteNav a[href="#about"]');
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

let settlementScriptsPromise=null;
let globeController=null;
let transitioning=false;

function loadScript(src){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[data-civoria-src="${src}"]`);
    if(existing){
      if(existing.dataset.loaded==='true') resolve();
      else existing.addEventListener('load',resolve,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=src;
    script.dataset.civoriaSrc=src;
    script.addEventListener('load',()=>{script.dataset.loaded='true';resolve();},{once:true});
    script.addEventListener('error',()=>reject(new Error(`Could not load ${src}`)),{once:true});
    document.body.appendChild(script);
  });
}

function ensureSettlementScripts(){
  if(!settlementScriptsPromise){
    settlementScriptsPromise=loadScript('activity-clock.js').then(()=>loadScript('game.js'));
  }
  return settlementScriptsPromise;
}

async function enterSettlement(options={}){
  if(transitioning||body.classList.contains('settlement-mode')) return;
  transitioning=true;
  if(globeStatus) globeStatus.textContent='Entering the inhabited region…';

  const instant=Boolean(options.instant||reducedMotion.matches);
  try{
    await ensureSettlementScripts();
  }catch(error){
    console.error(error);
    if(globeStatus) globeStatus.textContent='The settlement viewer could not load. Try reloading the page.';
    transitioning=false;
    return;
  }

  body.classList.remove('globe-mode');
  body.classList.add('settlement-mode');
  globeSection?.classList.add('is-leaving');
  globeController?.pause();

  const finish=()=>{
    globeSection?.classList.add('is-hidden');
    globeSection?.classList.remove('is-leaving');
    const settlement=document.getElementById('live-world');
    if(options.updateHash!==false) history.pushState(null,'','#live-world');
    if(options.scroll!==false) settlement?.scrollIntoView({behavior:instant?'auto':'smooth',block:'start'});
    transitioning=false;
  };

  if(instant) finish();
  else window.setTimeout(finish,620);
}

function showGlobe(options={}){
  transitioning=false;
  body.classList.remove('settlement-mode');
  body.classList.add('globe-mode');
  globeSection?.classList.remove('is-hidden','is-leaving');
  globeController?.resume();
  if(globeStatus) globeStatus.textContent='Civoria settlement · inhabited';
  if(options.updateHash!==false) history.pushState(null,'','#world-map');
  globeSection?.scrollIntoView({behavior:reducedMotion.matches?'auto':'smooth',block:'start'});
}

enterButton?.addEventListener('click',()=>enterSettlement());
worldButton?.addEventListener('click',()=>showGlobe());
worldNav?.addEventListener('click',(event)=>{event.preventDefault();showGlobe();});
aboutNav?.addEventListener('click',(event)=>{
  if(!body.classList.contains('globe-mode')) return;
  event.preventDefault();
  enterSettlement({updateHash:false}).then?.(()=>{});
  window.setTimeout(()=>document.getElementById('about')?.scrollIntoView({behavior:reducedMotion.matches?'auto':'smooth'}),700);
});

window.addEventListener('popstate',()=>{
  if(location.hash==='#world-map'||!location.hash) showGlobe({updateHash:false});
  else if(location.hash==='#live-world') enterSettlement({instant:true,updateHash:false,scroll:false});
});

function makeTerrainTexture(THREE,lowPower){
  const canvas=document.createElement('canvas');
  canvas.width=lowPower?512:1024;
  canvas.height=canvas.width/2;
  const ctx=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height;

  const ocean=ctx.createLinearGradient(0,0,0,h);
  ocean.addColorStop(0,'#183f55');
  ocean.addColorStop(.5,'#245f6c');
  ocean.addColorStop(1,'#15384a');
  ctx.fillStyle=ocean;
  ctx.fillRect(0,0,w,h);

  function land(points,fill){
    ctx.beginPath();
    ctx.moveTo(points[0][0]*w,points[0][1]*h);
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      const mx=(a[0]+b[0])*.5*w,my=(a[1]+b[1])*.5*h;
      ctx.quadraticCurveTo(a[0]*w,a[1]*h,mx,my);
    }
    const last=points[points.length-1],first=points[0];
    ctx.quadraticCurveTo(last[0]*w,last[1]*h,first[0]*w,first[1]*h);
    ctx.closePath();
    ctx.fillStyle=fill;
    ctx.fill();
  }

  land([[.05,.28],[.13,.16],[.26,.18],[.31,.32],[.26,.45],[.17,.49],[.09,.40]],'#47745a');
  land([[.18,.57],[.29,.49],[.35,.58],[.32,.78],[.24,.88],[.17,.76]],'#63815a');
  land([[.42,.22],[.53,.12],[.67,.18],[.72,.34],[.62,.42],[.52,.37],[.45,.44],[.39,.34]],'#537b58');
  land([[.61,.49],[.72,.42],[.84,.48],[.91,.63],[.84,.78],[.70,.77],[.62,.67]],'#70895b');
  land([[.82,.18],[.91,.13],[.97,.24],[.93,.36],[.85,.34]],'#466d54');
  land([[.45,.62],[.51,.57],[.56,.67],[.52,.79],[.44,.76],[.40,.68]],'#6f8559');

  let seed=1337;
  const rand=()=>{
    seed=(seed*1664525+1013904223)>>>0;
    return seed/4294967296;
  };
  for(let i=0;i<(lowPower?900:1800);i++){
    const x=rand()*w,y=rand()*h;
    const alpha=.018+rand()*.055;
    ctx.fillStyle=rand()>.46?`rgba(223,231,187,${alpha})`:`rgba(7,26,31,${alpha})`;
    ctx.fillRect(x,y,1+rand()*2,1+rand()*2);
  }

  ctx.strokeStyle='rgba(210,228,210,.09)';
  ctx.lineWidth=Math.max(1,w/900);
  for(let lat=1;lat<6;lat++){
    const y=(lat/6)*h;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
  }
  for(let lon=1;lon<12;lon++){
    const x=(lon/12)*w;
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
  }

  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=lowPower?1:4;
  return texture;
}

function makeLabelTexture(THREE){
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='rgba(10,19,14,.84)';
  ctx.strokeStyle='rgba(233,207,137,.72)';
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.roundRect(9,12,494,104,32);
  ctx.fill();ctx.stroke();
  ctx.fillStyle='#f2e5bc';
  ctx.font='700 42px DM Sans, Arial, sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('CIVORIA',256,64);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

async function createGlobe(){
  if(!globeCanvas||!globeSection) return null;

  const coarsePointer=window.matchMedia('(pointer: coarse)').matches;
  const lowPower=coarsePointer||window.innerWidth<720||(navigator.deviceMemory&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);

  let THREE;
  try{
    THREE=await import(THREE_URL);
  }catch(error){
    console.error(error);
    globeCanvas.hidden=true;
    globeFallback.hidden=false;
    if(globeStatus) globeStatus.textContent='3D globe unavailable · settlement remains accessible';
    return null;
  }

  let renderer;
  try{
    renderer=new THREE.WebGLRenderer({canvas:globeCanvas,antialias:!lowPower,alpha:true,powerPreference:'high-performance'});
  }catch(error){
    console.error(error);
    globeCanvas.hidden=true;
    globeFallback.hidden=false;
    if(globeStatus) globeStatus.textContent='WebGL unavailable · settlement remains accessible';
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowPower?1.25:1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor(0x08110d,0);

  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(42,1,.1,100);
  camera.position.set(0,0,3.3);

  const worldGroup=new THREE.Group();
  scene.add(worldGroup);

  scene.add(new THREE.HemisphereLight(0xb9d7d0,0x17241a,2.15));
  const sun=new THREE.DirectionalLight(0xffe1a0,2.8);
  sun.position.set(4,3,5);
  scene.add(sun);

  const texture=makeTerrainTexture(THREE,lowPower);
  const globe=new THREE.Mesh(
    new THREE.SphereGeometry(1,lowPower?48:80,lowPower?32:56),
    new THREE.MeshStandardMaterial({map:texture,roughness:.84,metalness:.02})
  );
  worldGroup.add(globe);

  const atmosphere=new THREE.Mesh(
    new THREE.SphereGeometry(1.055,lowPower?36:64,lowPower?24:40),
    new THREE.MeshBasicMaterial({color:0x78aeb9,transparent:true,opacity:.10,side:THREE.BackSide})
  );
  worldGroup.add(atmosphere);

  const markerAnchor=new THREE.Group();
  const markerDirection=new THREE.Vector3(.31,.22,.925).normalize();
  markerAnchor.position.copy(markerDirection.clone().multiplyScalar(1.018));
  markerAnchor.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),markerDirection);
  worldGroup.add(markerAnchor);

  const ring=new THREE.Mesh(
    new THREE.TorusGeometry(.074,.012,10,48),
    new THREE.MeshBasicMaterial({color:0xe5c877,transparent:true,opacity:.96})
  );
  markerAnchor.add(ring);
  const core=new THREE.Mesh(new THREE.SphereGeometry(.026,18,12),new THREE.MeshBasicMaterial({color:0xffe5a1}));
  core.position.z=.016;
  markerAnchor.add(core);

  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:makeLabelTexture(THREE),transparent:true,depthWrite:false}));
  label.scale.set(.42,.105,1);
  label.position.copy(markerDirection.clone().multiplyScalar(1.18));
  worldGroup.add(label);

  const starsGeometry=new THREE.BufferGeometry();
  const starCount=lowPower?180:420;
  const positions=new Float32Array(starCount*3);
  let seed=91;
  const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  for(let i=0;i<starCount;i++){
    const r=5+rand()*6,theta=rand()*Math.PI*2,phi=Math.acos(2*rand()-1);
    positions[i*3]=r*Math.sin(phi)*Math.cos(theta);
    positions[i*3+1]=r*Math.cos(phi);
    positions[i*3+2]=r*Math.sin(phi)*Math.sin(theta);
  }
  starsGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const stars=new THREE.Points(starsGeometry,new THREE.PointsMaterial({size:lowPower?.012:.018,color:0xdce8dd,transparent:true,opacity:.58,sizeAttenuation:true}));
  scene.add(stars);

  worldGroup.rotation.x=-.10;
  worldGroup.rotation.y=-.06;

  const pointers=new Map();
  let dragging=false;
  let moved=false;
  let lastX=0,lastY=0,pinchDistance=0;
  let interacted=false;
  let raf=0;
  let running=true;
  let lastFrame=performance.now();
  const MIN_Z=1.88,MAX_Z=4.35,ENTER_Z=2.18;
  const raycaster=new THREE.Raycaster();
  const pointerNdc=new THREE.Vector2();
  const tmpMarker=new THREE.Vector3();

  function resize(){
    const rect=globeCanvas.getBoundingClientRect();
    if(!rect.width||!rect.height) return;
    renderer.setSize(rect.width,rect.height,false);
    camera.aspect=rect.width/rect.height;
    camera.updateProjectionMatrix();
  }

  function markerIsCentered(){
    markerAnchor.getWorldPosition(tmpMarker);
    if(tmpMarker.z<.18) return false;
    const projected=tmpMarker.clone().project(camera);
    return Math.hypot(projected.x,projected.y)<.34;
  }

  function maybeEnter(){
    if(camera.position.z<=ENTER_Z&&markerIsCentered()) enterSettlement();
  }

  function setZoom(next){
    camera.position.z=THREE.MathUtils.clamp(next,MIN_Z,MAX_Z);
    const progress=1-(camera.position.z-MIN_Z)/(MAX_Z-MIN_Z);
    if(globeStatus&&progress>.58) globeStatus.textContent=markerIsCentered()?'Civoria settlement · zoom to enter':'Rotate Civoria toward the center to enter';
    maybeEnter();
  }

  globeCanvas.addEventListener('wheel',(event)=>{
    event.preventDefault();
    interacted=true;
    setZoom(camera.position.z+event.deltaY*.0021);
  },{passive:false});

  globeCanvas.addEventListener('pointerdown',(event)=>{
    globeCanvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    interacted=true;dragging=true;moved=false;lastX=event.clientX;lastY=event.clientY;
    globeCanvas.classList.add('is-dragging');
    if(pointers.size===2){
      const pts=[...pointers.values()];
      pinchDistance=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
    }
  });

  globeCanvas.addEventListener('pointermove',(event)=>{
    if(!pointers.has(event.pointerId)) return;
    const previous=pointers.get(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});

    if(pointers.size===2){
      const pts=[...pointers.values()];
      const distance=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      if(pinchDistance){
        setZoom(camera.position.z-(distance-pinchDistance)*.008);
        if(Math.abs(distance-pinchDistance)>2) moved=true;
      }
      pinchDistance=distance;
      return;
    }

    const dx=event.clientX-lastX,dy=event.clientY-lastY;
    if(Math.abs(dx)+Math.abs(dy)>1.5) moved=true;
    worldGroup.rotation.y+=dx*.0065;
    worldGroup.rotation.x=THREE.MathUtils.clamp(worldGroup.rotation.x+dy*.0048,-1.05,1.05);
    lastX=event.clientX;lastY=event.clientY;
    previous.x=event.clientX;previous.y=event.clientY;
  });

  function releasePointer(event){
    const wasTap=!moved&&pointers.size===1;
    pointers.delete(event.pointerId);
    if(pointers.size<2) pinchDistance=0;
    if(!pointers.size){dragging=false;globeCanvas.classList.remove('is-dragging');}

    if(wasTap){
      const rect=globeCanvas.getBoundingClientRect();
      pointerNdc.x=((event.clientX-rect.left)/rect.width)*2-1;
      pointerNdc.y=-((event.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(pointerNdc,camera);
      if(raycaster.intersectObjects([ring,core,label],true).length) enterSettlement();
    }
  }
  globeCanvas.addEventListener('pointerup',releasePointer);
  globeCanvas.addEventListener('pointercancel',releasePointer);

  function frame(now){
    if(!running||document.hidden||body.classList.contains('settlement-mode')){raf=0;return;}
    const dt=Math.min(.05,(now-lastFrame)/1000||0);lastFrame=now;
    if(!reducedMotion.matches&&!dragging&&!interacted) worldGroup.rotation.y+=dt*.045;
    if(!reducedMotion.matches){
      ring.scale.setScalar(1+Math.sin(now*.004)*.08);
      label.material.opacity=.84+Math.sin(now*.0028)*.12;
    }
    renderer.render(scene,camera);
    raf=requestAnimationFrame(frame);
  }

  function resume(){
    if(!running) running=true;
    resize();
    lastFrame=performance.now();
    if(!raf&&!document.hidden&&!body.classList.contains('settlement-mode')) raf=requestAnimationFrame(frame);
  }
  function pause(){
    running=false;
    if(raf){cancelAnimationFrame(raf);raf=0;}
  }

  const resizeObserver=new ResizeObserver(()=>resize());
  resizeObserver.observe(globeCanvas);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){if(raf){cancelAnimationFrame(raf);raf=0;}}
    else if(body.classList.contains('globe-mode')){running=true;resume();}
  });

  resize();
  raf=requestAnimationFrame(frame);
  return {pause,resume};
}

if(location.hash==='#live-world'){
  enterSettlement({instant:true,updateHash:false,scroll:false});
}else{
  body.classList.add('globe-mode');
  createGlobe().then(controller=>{globeController=controller;});
}
