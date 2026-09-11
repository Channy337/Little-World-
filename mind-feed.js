(function(){
  'use strict';

  var originalFetch=window.fetch.bind(window);
  var lastThoughts=new Map();
  var events=[];
  var initialized=false;
  var maxEvents=8;
  var polling=false;

  function escapeHtml(value){
    return String(value).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

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
      feed.innerHTML='<div class="mind-empty">No AI thoughts have appeared in this browser session yet. Villagers still use their built-in instincts between AI moments.</div>';
      return;
    }

    feed.innerHTML=events.map(function(evt){
      return '<article class="mind-event">'+
        '<div class="mind-event-top"><strong>'+escapeHtml(evt.name)+'</strong><span>AI thought · Day '+escapeHtml(evt.day)+'</span></div>'+
        '<div class="mind-event-thought">“'+escapeHtml(evt.thought)+'”</div>'+
      '</article>';
    }).join('');
  }

  function processState(state){
    if(!state||!Array.isArray(state.agents)) return;

    state.agents.forEach(function(agent){
      var thought=agent.aiThought||null;
      var previous=lastThoughts.has(agent.id)?lastThoughts.get(agent.id):null;
      if(thought && (!initialized || thought!==previous)) rememberEvent(agent,thought,state.day);
      lastThoughts.set(agent.id,thought);
    });

    initialized=true;
    renderFeed(state);
  }

  function enhanceAgentCard(){
    var card=document.getElementById('agentCard');
    if(!card||card.classList.contains('hidden')) return;
    if(card.querySelector('.mind-source')) return;

    var thought=card.querySelector('.ac-thought');
    var badge=document.createElement('div');
    badge.className='mind-source '+(thought?'mind-source-ai':'mind-source-instinct');
    badge.textContent=thought?'AI-generated thought':'Instinct active · no AI thought stored yet';
    if(thought) card.insertBefore(badge,thought);
    else {
      var role=card.querySelector('.ac-role');
      if(role&&role.nextSibling) card.insertBefore(badge,role.nextSibling);
      else card.appendChild(badge);
    }
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
      .then(function(response){
        if(!response.ok) throw new Error('unavailable');
        return response.json();
      })
      .then(function(data){ processState(data&&data.state); })
      .catch(function(){
        var status=document.getElementById('mindStatus');
        if(status&&!initialized) status.textContent='AI minds reconnecting…';
      })
      .finally(function(){ polling=false; });
  }

  function boot(){
    var card=document.getElementById('agentCard');
    if(card){
      new MutationObserver(enhanceAgentCard).observe(card,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    }
    enhanceAgentCard();
    refreshMindState();
    setInterval(refreshMindState,15000);
    document.addEventListener('visibilitychange',function(){ if(!document.hidden) refreshMindState(); });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
