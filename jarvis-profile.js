(function(){
  'use strict';

  var latestState=null,selectedId=null,pollTimer=null;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function cap(v,a,b){return Math.max(a,Math.min(b,Number(v)||0));}
  function title(v){return String(v||'').replace(/[-_:]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,function(c){return c.toUpperCase();});}
  function byId(id){return latestState&&Array.isArray(latestState.agents)?latestState.agents.find(function(a){return String(a.id)===String(id);}):null;}
  function relName(id){var a=byId(id);return a?a.name:'Another Civorian';}
  function meter(label,value){var n=Math.round(cap(value,0,100));return '<div class="jv-meter"><span>'+esc(label)+'</span><div><i style="width:'+n+'%"></i></div><b>'+n+'</b></div>';}
  function pills(items,empty){if(!items||!items.length)return '<p class="jv-empty">'+esc(empty)+'</p>';return '<div class="jv-pills">'+items.map(function(x){return '<span>'+esc(x)+'</span>';}).join('')+'</div>';}
  function list(items,empty){if(!items||!items.length)return '<p class="jv-empty">'+esc(empty)+'</p>';return '<div class="jv-list">'+items.map(function(x){return '<p>'+esc(x)+'</p>';}).join('')+'</div>';}
  function section(titleText,body,tag){return '<section class="jv-section"><div class="jv-section-head"><h3>'+esc(titleText)+'</h3>'+(tag?'<span>'+esc(tag)+'</span>':'')+'</div>'+body+'</section>';}
  function ensureOverlay(){
    var overlay=document.getElementById('jarvisProfile');
    if(overlay)return overlay;
    overlay=document.createElement('div');overlay.id='jarvisProfile';overlay.className='jarvisOverlay';overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML='<div class="jarvisBackdrop" data-jv-close></div><div class="jarvisPanel" role="dialog" aria-modal="true" aria-labelledby="jvTitle"><div id="jarvisProfileBody"></div></div>';
    document.body.appendChild(overlay);return overlay;
  }
  function observerBody(agent){
    var body=agent.body||{},health=agent.healthState||{},heritage=agent.heritage&&agent.heritage.phenotype||{},life=agent.life||{};
    var seeds=(agent.seeds||[]).filter(function(x){return (x.viability||0)>0;});
    var inventory=agent.inv||{};
    var inventoryBits=['wood','timber','stone','fiber','clay','ore','bone','hide','food'].filter(function(k){return Number(inventory[k])>0;}).map(function(k){return Math.round(inventory[k])+' '+k;});
    return '<div class="jv-grid">'+
      '<div><span>Life stage</span><strong>'+esc(title(life.stage||'adult'))+'</strong></div>'+
      '<div><span>Age</span><strong>'+Math.floor(agent.age||0)+' years</strong></div>'+
      '<div><span>Hydration</span><strong>'+Math.round(body.waterReserve==null?100:body.waterReserve)+'%</strong></div>'+
      '<div><span>Core temperature</span><strong>'+Number(body.coreTemperature==null?37:body.coreTemperature).toFixed(1)+'°C</strong></div>'+
      '<div><span>Alertness</span><strong>'+Math.round(body.alertness==null?75:body.alertness)+'%</strong></div>'+
      '<div><span>Blood oxygen</span><strong>'+Math.round(health.oxygenSaturation==null?100:health.oxygenSaturation)+'%</strong></div>'+
      '<div><span>Blood volume</span><strong>'+Math.round(health.bloodVolume==null?100:health.bloodVolume)+'%</strong></div>'+
      '<div><span>Infection pressure</span><strong>'+Math.round(health.infectionLoad||0)+'</strong></div>'+
      '<div><span>Carried plant pieces</span><strong>'+seeds.length+'</strong></div>'+
      '<div><span>Artifacts</span><strong>'+((agent.artifacts||[]).length)+'</strong></div></div>'+
      pills(inventoryBits,'Carrying no notable material inventory.')+
      '<p class="jv-observer-note">Observer measurements are shown here for visitors. They are not automatically known by this Civorian.</p>';
  }
  function civorianKnowledge(agent){
    var m=agent.mind||{},obs=(m.observations||[]).slice(-8).map(function(x){return x.text;}),beliefs=(m.beliefs||[]).slice(-6),knowledge=(m.knowledge||[]).slice(-8);
    var capabilities=(m.capabilities||[]).slice(-8).map(function(x){return title(x.id)+' · evidence '+Math.max(0,Math.floor(x.evidence||0));});
    var experiments=(m.experiments||[]).slice(-6).reverse().map(function(x){return (x.status||'idea')+': '+x.hypothesis+(x.result?' → '+x.result:'');});
    return section('Personally observed',list(obs,'No durable observation recorded yet.'),'Civorian knowledge')+
      section('Beliefs & lessons',list(beliefs.concat(knowledge),'No durable beliefs or lessons recorded yet.'),'Civorian knowledge')+
      section('Proven capabilities',list(capabilities,'No personally proven capability yet.'),'Civorian knowledge')+
      section('Experiments',list(experiments,'No personal experiment history yet.'),'Civorian knowledge');
  }
  function relationships(agent){
    var rel=agent.mind&&agent.mind.relationships||{};
    var rows=Object.keys(rel).map(function(id){return {id:id,r:rel[id]||{}};}).sort(function(a,b){return (b.r.familiarity||0)-(a.r.familiarity||0);}).slice(0,8);
    if(!rows.length)return '<p class="jv-empty">No durable relationship history yet.</p>';
    return '<div class="jv-relationships">'+rows.map(function(x){return '<div><strong>'+esc(relName(x.id))+'</strong><span>Familiarity '+Math.round(x.r.familiarity||0)+' · trust '+Math.round(x.r.trust||50)+' · affection '+Math.round(x.r.affection||50)+'</span></div>';}).join('')+'</div>';
  }
  function timeline(agent){
    var m=agent.mind||{},items=[];
    (m.memories||[]).forEach(function(x){items.push({day:x.day||0,text:x.text,kind:x.kind||'memory'});});
    (m.thoughts||[]).forEach(function(x){items.push({day:x.day||0,text:'Thought: '+x.text,kind:'thought'});});
    items.sort(function(a,b){return b.day-a.day;});
    if(!items.length)return '<p class="jv-empty">No personal timeline entries yet.</p>';
    return '<div class="jv-timeline">'+items.slice(0,14).map(function(x){return '<article><span>Day '+esc(x.day)+' · '+esc(title(x.kind))+'</span><p>'+esc(x.text)+'</p></article>';}).join('')+'</div>';
  }
  function render(agent){
    var overlay=ensureOverlay(),body=document.getElementById('jarvisProfileBody');if(!body||!agent)return;
    var mind=agent.mind||{},em=mind.emotions||{};
    body.innerHTML='<header class="jv-header"><div><p class="jv-kicker">Civorian Life Profile · Read only</p><h2 id="jvTitle">'+esc(agent.name)+'</h2><p>'+esc(title(agent.trait||'individual'))+' · '+esc(agent.role?title(agent.role):'no chosen trade')+' · '+esc(title(agent.state||'living'))+'</p></div><button class="jv-close" data-jv-close aria-label="Close life profile">×</button></header>'+
      '<div class="jv-separation"><span>Civorian knowledge</span><i></i><span>Observer analysis</span></div>'+
      '<div class="jv-dashboard">'+
        section('Mind state','<div class="jv-meters">'+meter('Joy',em.joy)+meter('Curiosity',em.curiosity)+meter('Stress',em.stress)+meter('Loneliness',em.loneliness)+'</div>'+(agent.aiThought?'<blockquote>“'+esc(agent.aiThought)+'”</blockquote>':'<p class="jv-empty">No fresh AI thought is stored right now.</p>'),'Civorian experience')+
        section('Observer body analysis',observerBody(agent),'Visitor-only analysis')+
        civorianKnowledge(agent)+
        section('Relationships',relationships(agent),'Civorian history')+
        section('Life timeline',timeline(agent),'Civorian history')+
      '</div>';
    overlay.classList.add('show');overlay.setAttribute('aria-hidden','false');document.body.classList.add('jv-open');
    var close=body.querySelector('.jv-close');if(close)close.focus();
  }
  function close(){var overlay=ensureOverlay();overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');document.body.classList.remove('jv-open');}
  function injectLauncher(){
    var card=document.getElementById('agentCard');if(!card||card.classList.contains('hidden'))return;
    var id=card.getAttribute('data-villager-panel-id');if(!id)return;selectedId=id;
    var shell=card.querySelector('.vp-shell');if(!shell||shell.querySelector('.jarvisLaunch'))return;
    var row=document.createElement('div');row.className='jarvisLaunch';row.innerHTML='<button type="button">Open Life Profile</button><span>Deep read-only observer view</span>';
    row.querySelector('button').addEventListener('click',function(){var agent=byId(selectedId);if(agent)render(agent);});
    shell.insertBefore(row,shell.firstChild&&shell.firstChild.nextSibling?shell.firstChild.nextSibling:shell.firstChild);
  }
  function watchCard(){
    var card=document.getElementById('agentCard');if(!card)return;
    new MutationObserver(function(){injectLauncher();var id=card.getAttribute('data-villager-panel-id');if(id)selectedId=id;}).observe(card,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-villager-panel-id']});
    injectLauncher();
  }
  async function poll(){
    try{var res=await fetch('/api/state',{cache:'no-store'});if(!res.ok)return;var data=await res.json();latestState=data&&data.state;if(latestState)window.CivoriaObserverState=latestState;injectLauncher();
      var overlay=ensureOverlay();if(overlay.classList.contains('show')&&selectedId){var a=byId(selectedId);if(a)render(a);}
    }catch(e){}
  }
  document.addEventListener('click',function(e){if(e.target&&e.target.closest('[data-jv-close]'))close();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){ensureOverlay();watchCard();poll();pollTimer=setInterval(poll,5000);});
  else{ensureOverlay();watchCard();poll();pollTimer=setInterval(poll,5000);}
})();
