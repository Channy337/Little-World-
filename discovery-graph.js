(function(){
  'use strict';
  var selected=null;
  function clean(v){return String(v==null?'':v)}
  function escapeHtml(v){return clean(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function renderDetail(node,state){
    var names=new Map((state.agents||[]).map(function(a){return [a.id,a.name]}));
    var holderNames=(node.holders||[]).map(function(id){return names.get(id)||'Unknown Civorian'});
    document.getElementById('graphDetail').innerHTML='<h2>'+escapeHtml(node.label||node.id)+'</h2>'+
      '<div>Status: '+escapeHtml(node.status||'unknown')+' · First established on Day '+Number(node.firstDay||1)+'</div>'+
      '<div>Current holders: '+escapeHtml(holderNames.join(', ')||'none')+'</div>'+
      '<div>Evidence: '+escapeHtml((node.evidence||[]).join(' · ')||'physical result recorded by the world')+'</div>';
  }
  function render(state){
    var graph=state&&state.discoveryGraph||{nodes:[],edges:[]},nodes=graph.nodes||[],canvas=document.getElementById('graphCanvas'),host=document.getElementById('graphNodes'),svg=document.getElementById('graphEdges');
    if(!nodes.length){host.innerHTML='<div class="emptyGraph">No physically validated discovery has happened yet. The map will grow from Civorian evidence, not a preset technology tree.</div>';svg.innerHTML='';return}
    var byId=new Map(),positions=new Map(),columns=new Map();
    nodes.forEach(function(n){byId.set(n.id,n);var day=Number(n.firstDay)||1;if(!columns.has(day))columns.set(day,[]);columns.get(day).push(n)});
    var days=Array.from(columns.keys()).sort(function(a,b){return a-b}),width=Math.max(760,days.length*250+80),height=Math.max(440,Math.max.apply(null,days.map(function(d){return columns.get(d).length}))*125+80);canvas.style.width=width+'px';canvas.style.height=height+'px';svg.setAttribute('viewBox','0 0 '+width+' '+height);
    host.innerHTML='';days.forEach(function(day,ci){columns.get(day).forEach(function(n,ri){var x=40+ci*250,y=45+ri*125;positions.set(n.id,{x:x,y:y});var button=document.createElement('button');button.className='discoveryNode '+clean(n.status||'active');button.style.left=x+'px';button.style.top=y+'px';button.innerHTML='<strong>'+escapeHtml(n.label||n.id)+'</strong><small>Day '+Number(n.firstDay||1)+' · '+escapeHtml(n.status||'active')+'</small>';button.onclick=function(){selected=n.id;renderDetail(n,state)};host.appendChild(button)})});
    var lines=[];(graph.edges||[]).filter(function(e){return e.from!==e.to&&positions.has(e.from)&&positions.has(e.to)}).forEach(function(e){var a=positions.get(e.from),b=positions.get(e.to);lines.push('<path d="M '+(a.x+190)+' '+(a.y+41)+' C '+(a.x+220)+' '+(a.y+41)+', '+(b.x-30)+' '+(b.y+41)+', '+b.x+' '+(b.y+41)+'" fill="none" stroke="#718b76" stroke-width="2"/>')});svg.innerHTML=lines.join('');
    if(selected&&byId.has(selected))renderDetail(byId.get(selected),state);
  }
  function refresh(){fetch('/api/state',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error();return r.json()}).then(function(x){render(x.state)}).catch(function(){document.getElementById('graphNodes').innerHTML='<div class="emptyGraph">The shared discovery record is temporarily unavailable.</div>'})}
  refresh();setInterval(refresh,15000);
})();
