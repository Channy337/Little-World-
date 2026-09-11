(function(){
  'use strict';

  var originalFetch=window.fetch.bind(window);
  var lastThoughts=new Map();
  var events=[];
  var initialized=false;
  var maxEvents=8;
  var polling=false;
  var currentState=null;
  var dismissedSignature=null;

  function escapeHtml(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function cap(value,min,max){ return Math.max(min,Math.min(max,Number(value)||0)); }
  function title(value){
    return String(value||'').replace(/([A-Z])/g,' $1').replace(/^./,function(c){ return c.toUpperCase(); });
  }
  function roleTitle(role){
    return role ? title(role) : 'No inherited trade';
  }
  function timeLabel(t){
    if(!Number.isFinite(t)) return '';
    if(t<.16) return 'Night'; if(t<.30) return 'Dawn'; if(t<.47) return 'Morning';
    if(t<.56) return 'Noon'; if(t<.75) return 'Afternoon'; if(t<.88) return 'Dusk'; return 'Night';
  }
  function stateLabel(state){
    var labels={idle:'Taking a moment',moving:'On the move',working:'Working',resting:'Resting',socializing:'Spending time with someone'};
    return labels[state]||title(state||'Living');
  }
  function actionLabel(a,state){
    if(!a) return stateLabel(state);
    if(a.sub==='harvest') return 'Harvesting food';
    if(a.sub==='buy') return 'Buying food';
    if(a.kind) return title(a.kind);
    if(a.targetType) return title(a.targetType)+' work';
    if(a.partnerId) return 'Talking with another villager';
    return stateLabel(state);
  }
  function moodLabel(agent){
    var e=agent&&agent.mind&&agent.mind.emotions||{};
    var stress=cap(e.stress,0,100), joy=cap(e.joy,0,100), lonely=cap(e.loneliness,0,100), fear=cap(e.fear,0,100), curiosity=cap(e.curiosity,0,100);
    if(stress>=70) return 'Very stressed';
    if(fear>=55) return 'Uneasy';
    if(lonely>=65) return 'Lonely';
    if(joy>=68 && curiosity>=60) return 'Bright & curious';
    if(joy>=65) return 'Content';
    if(curiosity>=65) return 'Curious';
    if(stress>=45) return 'A little tense';
    return 'Steady';
  }
  function personalityBits(agent){
    var m=agent.mind||{}, e=m.emotions||{}, bits=[title(agent.trait||'individual')];
    if(cap(e.curiosity,0,100)>=62) bits.push('inquisitive');
    if(cap(e.joy,0,100)>=62) bits.push('upbeat');
    if(cap(e.fear,0,100)>=40) bits.push('guarded');
    if(cap(e.loneliness,0,100)<=30 && cap(agent.social,0,100)>=65) bits.push('socially connected');
    if(m.experience>=18) bits.push('seasoned'); else if(m.experience>=6) bits.push('learning');
    return bits.slice(0,4);
  }
  function strongestSkills(agent){
    var skills=agent&&agent.mind&&agent.mind.skills||{};
    return Object.keys(skills).map(function(k){ return [k,Number(skills[k])||0]; }).sort(function(a,b){ return b[1]-a[1]; }).filter(function(x){ return x[1]>0; }).slice(0,3);
  }
  function findAgentName(id){
    if(!currentState||!Array.isArray(currentState.agents)) return 'Someone';
    var found=currentState.agents.find(function(a){ return String(a.id)===String(id); });
    return found?found.name:'Someone';
  }
  function relationships(agent){
    var rel=agent&&agent.mind&&agent.mind.relationships||{};
    return Object.keys(rel).map(function(id){ return {id:id,data:rel[id],name:findAgentName(id)}; })
      .sort(function(a,b){ return (b.data.familiarity||0)-(a.data.familiarity||0); }).slice(0,4);
  }
  function notableMemories(agent){
    var memories=agent&&agent.mind&&Array.isArray(agent.mind.memories)?agent.mind.memories:[];
    return memories.slice().sort(function(a,b){ return (b.day||0)-(a.day||0)||(b.importance||0)-(a.importance||0); }).slice(0,4);
  }
  function thoughtHistory(agent){
    var thoughts=agent&&agent.mind&&Array.isArray(agent.mind.thoughts)?agent.mind.thoughts:[];
    return thoughts.slice().sort(function(a,b){ return (b.day||0)-(a.day||0)||((b.time||0)-(a.time||0)); }).slice(0,7);
  }
  function signature(agent){ return agent ? [agent.id,agent.name,agent.trait,Math.floor(agent.age||0)].join('|') : null; }

  function rememberEvent(agent,thought,day){
    events.unshift({name:agent.name,thought:thought,day:day});
    if(events.length>maxEvents) events.length=maxEvents;
  }

  function renderFeed(state){
    var feed=document.getElementById('mindFeed');
    var status=document.getElementById('mindStatus');
    if(!feed||!status) return;

    var active=state.agents.filter(function(a){ return !!a.aiThought; }).length;
    status.textContent=active
      ? 'AI minds active · '+active+' villager'+(active===1?'':'s')+' currently carrying an AI thought'
      : 'AI minds active · waiting for the next AI thought';

    if(!events.length){
      feed.innerHTML='<div class="mind-empty">No new AI thoughts have appeared in this browser session yet. Click a villager to see their persistent personal mind and thought history.</div>';
      return;
    }

    feed.innerHTML=events.map(function(evt){
      return '<article class="mind-event">'+
        '<div class="mind-event-top"><strong>'+escapeHtml(evt.name)+'</strong><span>AI thought · Day '+escapeHtml(evt.day)+'</span></div>'+
        '<div class="mind-event-thought">“'+escapeHtml(evt.thought)+'”</div>'+
      '</article>';
    }).join('');
  }

  function identifySelectedAgent(card){
    if(!currentState||!Array.isArray(currentState.agents)) return null;
    var nameNode=card.querySelector('.ac-name');
    if(!nameNode) return null;
    var name=nameNode.textContent.trim();
    var roleNode=card.querySelector('.ac-role');
    var detail=roleNode?roleNode.textContent:'';
    var candidates=currentState.agents.filter(function(a){ return a.name===name; });
    if(candidates.length===1) return candidates[0];
    var traitMatch=candidates.filter(function(a){ return detail.indexOf(a.trait)!==-1; });
    if(traitMatch.length===1) return traitMatch[0];
    var ageMatch=traitMatch.filter(function(a){ return detail.indexOf('day '+Math.floor(a.age||0)+' of life')!==-1; });
    return ageMatch[0]||traitMatch[0]||candidates[0]||null;
  }

  function metric(label,value){
    var v=Math.round(cap(value,0,100));
    return '<div class="vp-meter"><div class="vp-meter-top"><span>'+escapeHtml(label)+'</span><b>'+v+'</b></div><div class="vp-track"><i style="width:'+v+'%"></i></div></div>';
  }
  function section(titleText,body,extraClass){
    return '<section class="vp-section '+(extraClass||'')+'"><h3>'+escapeHtml(titleText)+'</h3>'+body+'</section>';
  }
  function empty(text){ return '<p class="vp-empty">'+escapeHtml(text)+'</p>'; }

  function renderVillagerPanel(agent){
    var card=document.getElementById('agentCard');
    if(!card||!agent) return;
    var sig=signature(agent);
    if(dismissedSignature===sig){ card.classList.add('hidden'); return; }

    var mind=agent.mind||{}, emotions=mind.emotions||{}, thoughts=thoughtHistory(agent), rels=relationships(agent), memories=notableMemories(agent), skills=strongestSkills(agent);
    var now='<div class="vp-now-grid">'+
      '<div><span>Doing</span><strong>'+escapeHtml(actionLabel(agent.action,agent.state))+'</strong></div>'+
      '<div><span>Mood</span><strong>'+escapeHtml(moodLabel(agent))+'</strong></div>'+
      '<div><span>Current focus</span><strong>'+escapeHtml(agent.aiFocus||mind.goal||'Getting through the day')+'</strong></div>'+
      '<div><span>Home</span><strong>'+(agent.home?'Has a home':'No home yet')+'</strong></div></div>';

    var currentThought=agent.aiThought
      ? '<div class="vp-current-thought"><span>Current thought</span><blockquote>“'+escapeHtml(agent.aiThought)+'”</blockquote></div>'
      : '<div class="vp-current-thought vp-current-thought-muted"><span>Current thought</span><p>No fresh AI thought stored right now. Built-in instincts are carrying the next action.</p></div>';

    var thoughtBody=thoughts.length ? '<div class="vp-timeline">'+thoughts.map(function(t){
      return '<article><div class="vp-time">Day '+escapeHtml(t.day)+(timeLabel(t.time)?' · '+escapeHtml(timeLabel(t.time)):'')+(t.focus?' · '+escapeHtml(t.focus):'')+'</div><p>“'+escapeHtml(t.text)+'”</p></article>';
    }).join('')+'</div>' : empty('This villager has not accumulated persistent AI thought history yet. New AI thoughts will appear here in newest-first order.');

    var personBits=personalityBits(agent).map(function(x){ return '<span>'+escapeHtml(x)+'</span>'; }).join('');
    var personality='<div class="vp-chips">'+personBits+'</div><div class="vp-meters">'+
      metric('Joy',emotions.joy)+metric('Curiosity',emotions.curiosity)+metric('Stress',emotions.stress)+metric('Loneliness',emotions.loneliness)+'</div>';

    var work='<div class="vp-work-title"><strong>'+escapeHtml(roleTitle(agent.role))+'</strong><span>'+escapeHtml(stateLabel(agent.state))+'</span></div>'+
      (skills.length?'<div class="vp-skills">'+skills.map(function(s){ return '<span>'+escapeHtml(title(s[0]))+' <b>'+Math.round(s[1])+'</b></span>'; }).join('')+'</div>':empty('Still building work experience.'))+
      '<p class="vp-small">Inventory: '+Math.round(agent.inv&&agent.inv.wood||0)+' wood · '+Math.round(agent.inv&&agent.inv.timber||0)+' timber · '+Math.round(agent.inv&&agent.inv.stone||0)+' stone · '+Math.round(agent.inv&&agent.inv.food||0)+' food</p>'+
      '<p class="vp-small">Proven capabilities: '+((mind.capabilities||[]).length?(mind.capabilities||[]).map(function(x){return escapeHtml(title(x.id));}).join(', '):'none yet')+'</p>';

    var relationshipBody=rels.length?'<div class="vp-rel-list">'+rels.map(function(r){
      var closeness=Math.round(((r.data.trust||50)+(r.data.affection||50)+(r.data.familiarity||0))/3);
      var word=closeness>=70?'Close':closeness>=55?'Warm':closeness>=40?'Familiar':'New connection';
      return '<div><strong>'+escapeHtml(r.name)+'</strong><span>'+word+' · familiarity '+Math.round(r.data.familiarity||0)+'</span></div>';
    }).join('')+'</div>':empty('No strong personal relationships recorded yet.');

    var decision='<div class="vp-decision">'+
      '<div><span>AI priority</span><strong>'+escapeHtml(agent.aiFocus||'No AI priority stored right now')+'</strong></div>'+
      '<div><span>Action taken</span><strong>'+escapeHtml(actionLabel(agent.action,agent.state))+'</strong></div>'+
      (mind.reflection?'<div><span>Latest reflection</span><strong>'+escapeHtml(mind.reflection)+'</strong></div>':'')+
      '</div>';

    var life='<div class="vp-life-grid">'+
      '<div><span>Life age</span><strong>'+Math.floor(agent.age||0)+' years</strong></div>'+
      '<div><span>Experience</span><strong>'+Math.floor(mind.experience||0)+' lived events</strong></div>'+
      '<div><span>Goal</span><strong>'+escapeHtml(mind.goal||'No long-term goal formed yet')+'</strong></div>'+
      '<div><span>Known lessons</span><strong>'+((mind.knowledge&&mind.knowledge.length)||0)+'</strong></div></div>'+
      (memories.length?'<div class="vp-memories"><h4>Recent life memories</h4>'+memories.map(function(m){ return '<p><span>Day '+escapeHtml(m.day)+'</span>'+escapeHtml(m.text)+'</p>'; }).join('')+'</div>':'');

    card.classList.remove('hidden');
    card.classList.add('villagerDrawer');
    card.setAttribute('data-villager-panel-id',String(agent.id));
    card.innerHTML='<div class="vp-shell">'+
      '<header class="vp-header"><div><p class="vp-kicker">Civorian profile · live</p><h2>'+escapeHtml(agent.name)+'</h2><p>'+escapeHtml(roleTitle(agent.role))+' · '+escapeHtml(agent.trait)+' · Age '+Math.floor(agent.age||0)+'</p></div><button type="button" class="vp-close" aria-label="Close villager profile">×</button></header>'+
      currentThought+
      section('Right now',now,'vp-first')+
      section('Recent thoughts',thoughtBody)+
      section('Personality & mood',personality)+
      section('Decisions',decision)+
      section('Work & resources',work)+
      section('Relationships',relationshipBody)+
      section('Life progress',life)+
      '<p class="vp-footnote">This panel separates what the AI is thinking from what the simulation actually does. Thoughts can influence priorities, but the shared world remains authoritative over physical outcomes.</p>'+
      '</div>';

    var close=card.querySelector('.vp-close');
    if(close) close.addEventListener('click',function(e){
      e.preventDefault(); e.stopPropagation(); dismissedSignature=sig; card.classList.add('hidden');
    });
  }

  function enhanceAgentCard(){
    var card=document.getElementById('agentCard');
    if(!card||card.classList.contains('hidden')) return;
    if(card.querySelector('.vp-shell')) return;
    var agent=identifySelectedAgent(card);
    if(agent) renderVillagerPanel(agent);
  }

  function refreshOpenPanel(){
    var card=document.getElementById('agentCard');
    if(!card||card.classList.contains('hidden')) return;
    var id=card.getAttribute('data-villager-panel-id');
    if(id&&currentState){
      var agent=currentState.agents.find(function(a){ return String(a.id)===String(id); });
      if(agent){ renderVillagerPanel(agent); return; }
    }
    enhanceAgentCard();
  }

  function processState(state){
    if(!state||!Array.isArray(state.agents)) return;
    currentState=state;
    state.agents.forEach(function(agent){
      var thought=agent.aiThought||null;
      var previous=lastThoughts.has(agent.id)?lastThoughts.get(agent.id):null;
      if(thought && (!initialized || thought!==previous)) rememberEvent(agent,thought,state.day);
      lastThoughts.set(agent.id,thought);
    });
    initialized=true;
    renderFeed(state);
    refreshOpenPanel();
  }

  window.fetch=function(input,init){
    return originalFetch(input,init).then(function(response){
      try{
        var url=typeof input==='string'?input:(input&&input.url)||'';
        if(response.ok && /\/api\/tick(?:\?|$)/.test(url)){
          response.clone().json().then(function(data){ processState(data&&data.state); }).catch(function(){});
        }
      }catch(e){}
      return response;
    });
  };

  function refreshMindState(){
    if(polling||document.hidden) return;
    polling=true;
    originalFetch('/api/state',{cache:'no-store'})
      .then(function(response){ if(!response.ok) throw new Error('unavailable'); return response.json(); })
      .then(function(data){ processState(data&&data.state); })
      .catch(function(){
        var status=document.getElementById('mindStatus');
        if(status&&!initialized) status.textContent='AI minds reconnecting…';
      })
      .finally(function(){ polling=false; });
  }

  function boot(){
    var card=document.getElementById('agentCard');
    if(card){ new MutationObserver(enhanceAgentCard).observe(card,{childList:true,subtree:true,attributes:true,attributeFilter:['class']}); }
    var canvas=document.getElementById('world');
    if(canvas) canvas.addEventListener('click',function(){ dismissedSignature=null; setTimeout(enhanceAgentCard,0); });
    enhanceAgentCard();
    refreshMindState();
    setInterval(refreshMindState,15000);
    document.addEventListener('visibilitychange',function(){ if(!document.hidden) refreshMindState(); });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
