(function(){
  'use strict';

  function cToF(c){ return Math.round((Number(c)*9/5)+32); }

  async function refresh(){
    var el=document.getElementById('weatherVal');
    if(!el) return;
    try{
      var r=await fetch('/api/state',{cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!r.ok) return;
      var data=await r.json(),state=data&&data.state,w=state&&state.weather;
      if(!w||!w.condition||!Number.isFinite(Number(w.temperatureC))) return;
      el.textContent=cToF(w.temperatureC)+'°F · '+w.condition;
    }catch(e){}
  }

  refresh();
  setInterval(refresh,5000);
})();
