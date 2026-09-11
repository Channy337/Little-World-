(function(){
  'use strict';

  var seenKey='';
  var polling=false;
  var MAJOR_TYPES=new Set(['birth','death','build','market','expansion','discovery','invention','milestone']);

  function clean(value){ return String(value==null?'':value).trim(); }

  function headlineFromChronicle(evt){
    if(!evt||!MAJOR_TYPES.has(clean(evt.type).toLowerCase())) return null;
    var msg=clean(evt.msg);
    if(!msg) return null;
    return {day:Number(evt.day)||0,text:msg};
  }

  function experimentHeadlines(state){
    var out=[];
    (state.agents||[]).forEach(function(agent){
      var exps=agent&&agent.mind&&Array.isArray(agent.mind.experiments)?agent.mind.experiments:[];
      exps.forEach(function(exp){
        if(exp&&exp.status==='promising'&&clean(exp.hypothesis)){
          out.push({
            day:Number(exp.day)||Number(state.day)||0,
            text:'Research milestone: '+clean(agent.name||'A Civorian')+' found promising evidence for “'+clean(exp.hypothesis)+'”.'
          });
        }
      });
    });
    return out;
  }

  function selectLatestHeadline(state){
    var items=[];
    (state.chronicle||[]).forEach(function(evt){
      var h=headlineFromChronicle(evt); if(h) items.push(h);
    });
    items=items.concat(experimentHeadlines(state));
    items.sort(function(a,b){ return b.day-a.day; });
    return items.length?items[0]:null;
  }

  function render(state){
    var track=document.getElementById('worldTickerTrack');
    if(!track||!state) return;
    var headline=selectLatestHeadline(state);
    if(!headline){
      headline={day:Number(state.day)||0,text:'Civilization watch: no major new milestone recorded yet.'};
    }
    var key=headline.day+'|'+headline.text;
    if(key===seenKey) return;
    seenKey=key;
    var text='DAY '+headline.day+'  •  '+headline.text;
    track.textContent=text+'     ◆     '+text;
  }

  function refresh(){
    if(polling||document.hidden) return;
    polling=true;
    fetch('/api/state',{cache:'no-store'})
      .then(function(r){ if(!r.ok) throw new Error('unavailable'); return r.json(); })
      .then(function(data){ render(data&&data.state); })
      .catch(function(){})
      .finally(function(){ polling=false; });
  }

  function boot(){
    refresh();
    setInterval(refresh,15000);
    document.addEventListener('visibilitychange',function(){ if(!document.hidden) refresh(); });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
