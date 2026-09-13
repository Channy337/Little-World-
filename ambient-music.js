'use strict';
(()=>{
  const toggle=document.getElementById('musicToggle');
  const volume=document.getElementById('musicVolume');
  const status=document.getElementById('musicStatus');
  if(!toggle||!volume)return;

  const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(!AudioContext){
    toggle.disabled=true;
    toggle.textContent='Music unavailable';
    if(status)status.textContent='This browser does not support Web Audio.';
    return;
  }

  let ctx=null,master=null,reverb=null,reverbGain=null,timer=null;
  let playing=false,step=0,nextNoteTime=0;
  const tempo=68;
  const stepSeconds=60/tempo/2;
  const scheduleAhead=.25;
  const lookEveryMs=80;
  const melody=[
    293.66,null,329.63,null,369.99,null,329.63,null,
    261.63,null,293.66,null,329.63,null,293.66,null,
    220.00,null,261.63,null,293.66,null,261.63,null,
    246.94,null,277.18,null,329.63,null,293.66,null,
    293.66,null,369.99,null,440.00,null,369.99,null,
    261.63,null,329.63,null,392.00,null,329.63,null,
    220.00,null,293.66,null,329.63,null,293.66,null,
    246.94,null,293.66,null,277.18,null,246.94,null
  ];
  const chords=[
    [146.83,220.00,293.66],
    [130.81,196.00,261.63],
    [110.00,164.81,220.00],
    [123.47,185.00,246.94]
  ];

  function requestedGain(){return Math.max(0,Math.min(1,Number(volume.value)/100))*.24;}

  function makeReverb(context){
    const seconds=2.4,length=Math.floor(context.sampleRate*seconds),buffer=context.createBuffer(2,length,context.sampleRate);
    for(let ch=0;ch<2;ch++){
      const data=buffer.getChannelData(ch);
      for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,2.8);
    }
    const node=context.createConvolver();node.buffer=buffer;return node;
  }

  function ensureAudio(){
    if(ctx)return;
    ctx=new AudioContext();
    master=ctx.createGain();
    master.gain.value=0;
    const filter=ctx.createBiquadFilter();
    filter.type='lowpass';filter.frequency.value=3600;filter.Q.value=.3;
    reverb=makeReverb(ctx);reverbGain=ctx.createGain();reverbGain.gain.value=.16;
    master.connect(filter);filter.connect(ctx.destination);
    master.connect(reverb);reverb.connect(reverbGain);reverbGain.connect(ctx.destination);
  }

  function voice(freq,start,duration,type,peak,attack=.05,release=.5,detune=0){
    if(!ctx||!playing)return;
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=type;osc.frequency.value=freq;osc.detune.value=detune;
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),start+attack);
    gain.gain.setValueAtTime(Math.max(.0002,peak*.72),Math.max(start+attack,start+duration-release));
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain);gain.connect(master);
    osc.start(start);osc.stop(start+duration+.05);
  }

  function pad(chord,start){
    for(const f of chord){
      voice(f,start,stepSeconds*15.6,'sine',.18,.65,1.2,-4);
      voice(f*2,start+.03,stepSeconds*15.2,'triangle',.035,.8,1.1,4);
    }
  }

  function pluck(freq,start){
    voice(freq,start,.72,'triangle',.12,.012,.55,0);
    voice(freq*2,start+.008,.38,'sine',.035,.01,.31,3);
  }

  function scheduleStep(n,time){
    const loop=n%64;
    if(loop%16===0)pad(chords[Math.floor(loop/16)],time);
    const note=melody[loop];
    if(note)pluck(note,time);
    if(loop%8===0)voice(chords[Math.floor(loop/16)][0]/2,time,stepSeconds*7.6,'sine',.055,.3,.8,0);
  }

  function scheduler(){
    if(!ctx||!playing)return;
    while(nextNoteTime<ctx.currentTime+scheduleAhead){
      scheduleStep(step,nextNoteTime);
      nextNoteTime+=stepSeconds;
      step=(step+1)%64;
    }
  }

  async function start(){
    ensureAudio();
    if(ctx.state!=='running')await ctx.resume();
    playing=true;step=0;nextNoteTime=ctx.currentTime+.08;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(Math.max(.0001,master.gain.value),ctx.currentTime);
    master.gain.linearRampToValueAtTime(requestedGain(),ctx.currentTime+.35);
    scheduler();timer=setInterval(scheduler,lookEveryMs);
    toggle.setAttribute('aria-pressed','true');toggle.textContent='♫ Music on';
    if(status)status.textContent='Ambient instrumental playing.';
  }

  function stop(){
    playing=false;if(timer){clearInterval(timer);timer=null;}
    if(ctx&&master){
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(Math.max(.0001,master.gain.value),ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.28);
      setTimeout(()=>{if(ctx&&ctx.state==='running'&&!playing)ctx.suspend().catch(()=>{});},340);
    }
    toggle.setAttribute('aria-pressed','false');toggle.textContent='♫ Music';
    if(status)status.textContent='Music off.';
  }

  toggle.addEventListener('click',()=>{if(playing)stop();else start().catch(()=>{if(status)status.textContent='Tap again to start music.';});});
  volume.addEventListener('input',()=>{
    if(ctx&&master&&playing)master.gain.setTargetAtTime(requestedGain(),ctx.currentTime,.06);
    volume.setAttribute('aria-valuetext',volume.value+' percent');
  });
})();
