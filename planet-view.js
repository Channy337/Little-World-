(function(){
  'use strict';
  var timer=null;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function title(v){return String(v||'').replace(/[-_]+/g,' ').replace(/^./,function(c){return c.toUpperCase();});}
  function colorFor(cell){
    if(!cell.land)return '#17364a';
    var b=cell.biome||'';
    if(b.indexOf('tundra')!==-1)return '#9aa89d';
    if(b.indexOf('desert')!==-1)return '#a68756';
    if(b.indexOf('grassland')!==-1)return '#738453';
    if(b.indexOf('rainforest')!==-1)return '#315b3e';
    if(b.indexOf('forest')!==-1)return '#426244';
    if(b.indexOf('alpine')!==-1)return '#8d8c83';
    return '#637453';
  }
  function drawMap(state){
    var canvas=document.getElementById('planetMap');if(!canvas)return;
    var p=state.planet,overview=p&&p.overview;if(!overview||!Array.isArray(overview.cells))return;
    var dpr=Math.min(2,window.devicePixelRatio||1),w=canvas.clientWidth||560,h=canvas.clientHeight||260;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    var ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#0b1820';ctx.fillRect(0,0,w,h);
    var cols=overview.cols||16,rows=overview.rows||10,cw=w/cols,ch=h/rows;
    overview.cells.forEach(function(c){
      ctx.fillStyle=colorFor(c);ctx.fillRect(c.x*cw,c.y*ch,cw+.5,ch+.5);
      if(c.river&&c.land){ctx.fillStyle='rgba(76,146,170,.85)';ctx.fillRect(c.x*cw+cw*.42,c.y*ch,cw*.16,ch);}
      if(c.land&&c.elevationM>1800){ctx.fillStyle='rgba(230,225,205,.27)';ctx.beginPath();ctx.moveTo(c.x*cw+cw*.25,c.y*ch+ch*.7);ctx.lineTo(c.x*cw+cw*.52,c.y*ch+ch*.2);ctx.lineTo(c.x*cw+cw*.78,c.y*ch+ch*.7);ctx.fill();}
    });
    if(p.current){
      var mx=(p.current.x/Math.max(1,(p.width||64)-1))*(cols-1),my=(p.current.y/Math.max(1,(p.height||40)-1))*(rows-1),x=(mx+.5)*cw,y=(my+.5)*ch;
      ctx.strokeStyle='#f4d878';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,Math.max(4,Math.min(cw,ch)*.28),0,Math.PI*2);ctx.stroke();ctx.fillStyle='#f4d878';ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();
    }
  }
  function animalSummary(state){
    var animals=(state.animals||[]).filter(function(a){return Number(a.population)>0;});
    if(!animals.length)return '<p class="planetEmpty">No animal populations recorded.</p>';
    return '<div class="ecoPills">'+animals.map(function(a){return '<span><b>'+esc(title(a.kind))+'</b> '+Math.max(0,Math.round(a.population))+'</span>';}).join('')+'</div>';
  }
  function plantSummary(state){
    var bushes=(state.bushes||[]).slice(0,4),plantings=state.plantings||[],stages={};plantings.forEach(function(p){stages[p.stage]=(stages[p.stage]||0)+1;});
    var stageText=Object.keys(stages).length?Object.keys(stages).map(function(k){return stages[k]+' '+k;}).join(' · '):'No deliberate ground placements growing yet';
    var morphology=bushes.length?'<div class="plantMorphology">'+bushes.map(function(b){return '<p><strong>'+esc(b.appearance||'Wild plant')+'</strong><span>'+esc(b.leafShape||'visible leaves')+(b.venation?' · '+esc(b.venation):'')+'</span></p>';}).join('')+'</div>':'<p class="planetEmpty">No local plant morphology recorded.</p>';
    return '<p class="growthState">'+esc(stageText)+'</p>'+morphology;
  }
  function render(state){
    var p=state.planet,meta=document.getElementById('planetRegionMeta'),eco=document.getElementById('planetEcology');if(!p||!meta||!eco)return;
    var c=p.localClimate||p.startingRegion||{};
    meta.innerHTML='<div><span>Region</span><strong>'+esc(title(c.biome||'unknown terrain'))+'</strong></div><div><span>Elevation</span><strong>'+Math.round(c.elevationM||0)+' m</strong></div><div><span>Annual moisture</span><strong>'+Math.round(c.precipitationMm||0)+' mm</strong></div><div><span>Soil</span><strong>'+esc(c.soil||'unknown')+'</strong></div><div><span>Water</span><strong>'+(c.river?'River valley':c.coastal?'Coastal':'Inland')+'</strong></div><div><span>World physics</span><strong>'+Number(p.gravityMps2||9.81).toFixed(2)+' m/s² · '+Math.round(p.rotationHours||24)+'h day</strong></div>';
    eco.innerHTML='<div class="ecoBlock"><h4>Animal populations</h4>'+animalSummary(state)+'</div><div class="ecoBlock"><h4>Plant growth attempts</h4>'+plantSummary(state)+'</div>';
    drawMap(state);
  }
  async function poll(){
    try{
      var state=window.CivoriaObserverState;
      if(!state){var res=await fetch('/api/state',{cache:'no-store'});if(!res.ok)return;var data=await res.json();state=data&&data.state;}
      if(state)render(state);
    }catch(e){}
  }
  function start(){poll();timer=setInterval(poll,7000);window.addEventListener('resize',function(){if(window.CivoriaObserverState)drawMap(window.CivoriaObserverState);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
