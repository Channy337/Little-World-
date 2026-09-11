(function(){
  'use strict';

  var savedTop=0;
  var savedId=null;
  var restoring=false;

  function card(){ return document.getElementById('agentCard'); }

  function currentId(el){
    return el ? el.getAttribute('data-villager-panel-id') : null;
  }

  function cleanEmptyThoughtText(el){
    if(!el) return;
    var text=el.querySelector('.vp-current-thought-muted p');
    if(text && text.textContent!=='No fresh AI thought stored right now.'){
      text.textContent='No fresh AI thought stored right now.';
    }
  }

  function remember(el){
    if(!el || restoring || el.classList.contains('hidden')) return;
    var id=currentId(el);
    if(!id) return;
    if(savedId!==id){ savedId=id; savedTop=0; }
    savedTop=el.scrollTop;
  }

  function restore(el){
    if(!el || el.classList.contains('hidden')) return;
    var id=currentId(el);
    if(!id) return;
    if(savedId!==id){ savedId=id; savedTop=0; return; }
    if(Math.abs(el.scrollTop-savedTop)<2) return;
    restoring=true;
    el.scrollTop=savedTop;
    requestAnimationFrame(function(){
      el.scrollTop=savedTop;
      restoring=false;
    });
  }

  function boot(){
    var el=card();
    if(!el) return;

    cleanEmptyThoughtText(el);
    el.addEventListener('scroll',function(){ remember(el); },{passive:true});

    new MutationObserver(function(){
      cleanEmptyThoughtText(el);
      var id=currentId(el);
      if(id && savedId===id) restore(el);
      else if(id){ savedId=id; savedTop=0; }
    }).observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-villager-panel-id']});

    var canvas=document.getElementById('world');
    if(canvas) canvas.addEventListener('click',function(){
      setTimeout(function(){
        cleanEmptyThoughtText(el);
        var next=currentId(el);
        if(next!==savedId){ savedId=next; savedTop=0; }
      },0);
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();