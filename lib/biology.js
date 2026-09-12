'use strict';

// This catalog is physical truth, not vocabulary granted to Civorians.
const ANATOMY=Object.freeze({
  brain:{system:'nervous',function:'coordinates sensation, thought, and movement',accessLevel:3},
  heart:{system:'circulatory',function:'moves blood through the body',accessLevel:2},
  lungs:{system:'respiratory',function:'exchange oxygen and carbon dioxide',accessLevel:2},
  kidneys:{system:'urinary',function:'regulate water and dissolved salts',accessLevel:4},
  liver:{system:'digestive',function:'stores fuel and processes substances',accessLevel:4},
  stomach:{system:'digestive',function:'begins chemical and mechanical digestion',accessLevel:2},
  intestines:{system:'digestive',function:'absorb nutrients and water',accessLevel:3},
  skin:{system:'integumentary',function:'protects tissue and regulates heat',accessLevel:0},
  bones:{system:'skeletal',function:'support and protect the body',accessLevel:1},
  muscles:{system:'muscular',function:'create movement and store usable fuel',accessLevel:1}
});
const HOURS_PER_DAY=24;

function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function createBody(random=()=>.5){return {
  waterReserve:100,glycogenReserve:85+random()*15,fatReserveDays:28+random()*18,muscleReserve:100,
  fastingDays:0,coreTemperature:37,
  circadianOffsetHours:(random()-.5)*2,sleepPressure:20+random()*12,sleepDebtHours:0,
  awakeHours:6+random()*2,sleepEpisodeHours:0,sleepQuality:1,alertness:78,sleepDamage:0,
  organs:{brain:100,heart:100,lungs:100,kidneys:100,liver:100},
  lastSymptoms:[]
};}
function ensureBody(agent,random){
  if(!agent.body||typeof agent.body!=='object')agent.body=createBody(random);
  const fresh=createBody(()=>.5);for(const k of ['waterReserve','glycogenReserve','fatReserveDays','muscleReserve','fastingDays','coreTemperature'])if(!Number.isFinite(agent.body[k]))agent.body[k]=fresh[k];
  for(const k of ['circadianOffsetHours','sleepPressure','sleepDebtHours','awakeHours','sleepEpisodeHours','sleepQuality','alertness','sleepDamage'])if(!Number.isFinite(agent.body[k]))agent.body[k]=fresh[k];
  if(!agent.body.organs||typeof agent.body.organs!=='object')agent.body.organs={...fresh.organs};
  for(const k of Object.keys(fresh.organs))if(!Number.isFinite(agent.body.organs[k]))agent.body.organs[k]=100;
  if(!Array.isArray(agent.body.lastSymptoms))agent.body.lastSymptoms=[];
  return agent.body;
}
function circadianSleepDrive(body,timeOfDay=.5){
  const hour=((timeOfDay*HOURS_PER_DAY+(body.circadianOffsetHours||0))%HOURS_PER_DAY+HOURS_PER_DAY)%HOURS_PER_DAY;
  return clamp(50+45*Math.cos((hour-3)/HOURS_PER_DAY*Math.PI*2),0,100);
}
function sleepNeed(body,timeOfDay=.5){
  return clamp(body.sleepPressure*.72+circadianSleepDrive(body,timeOfDay)*.28+body.sleepDebtHours*1.1,0,100);
}
function sleepQuality(agent,{weather={},sheltered=false}={}){
  let quality=sheltered?1:.72;
  const air=Number.isFinite(weather.temperatureC)?weather.temperatureC:18;
  if(!sheltered){
    quality-=Math.min(.32,Math.abs(air-18)*.018);
    if((weather.precipitationMm||0)>.2)quality-=.22;
    if((weather.windKph||0)>30)quality-=.1;
  }
  if((agent.thirst||0)>55)quality-=.12;
  if((agent.hunger||0)>80)quality-=.12;
  return clamp(quality,.2,1);
}
function advanceSleep(agent,{timeOfDay=.5,days=0,sleeping=false,sheltered=false,weather={}}={}){
  const b=ensureBody(agent),hours=Math.max(0,days)*HOURS_PER_DAY;
  if(sleeping){
    const quality=sleepQuality(agent,{weather,sheltered});
    b.sleepQuality=quality;b.sleepEpisodeHours+=hours;b.awakeHours=0;
    b.sleepPressure=clamp(b.sleepPressure-hours*11.5*quality,0,100);
    b.sleepDebtHours=clamp(b.sleepDebtHours-hours*.9*quality,0,96);
    b.sleepDamage=clamp(b.sleepDamage-hours*.35*quality,0,100);
  }else{
    const before=b.awakeHours;b.awakeHours+=hours;b.sleepEpisodeHours=0;b.sleepQuality=0;
    b.sleepPressure=clamp(b.sleepPressure+hours*4.25,0,100);
    const overtime=Math.max(0,b.awakeHours-16)-Math.max(0,before-16);
    b.sleepDebtHours=clamp(b.sleepDebtHours+overtime,0,96);
  }
  const need=sleepNeed(b,timeOfDay);
  b.alertness=clamp(100-need*.72,0,100);
  if(!sleeping&&b.awakeHours>36){
    const severity=Math.min(1,(b.awakeHours-36)/36);
    const damage=severity*10*Math.max(0,days);agent.health=clamp((Number.isFinite(agent.health)?agent.health:100)-damage,0,100);b.sleepDamage=clamp(b.sleepDamage+damage,0,100);
    b.organs.brain=clamp(b.organs.brain-severity*4*Math.max(0,days),0,100);
    b.organs.heart=clamp(b.organs.heart-severity*2*Math.max(0,days),0,100);
  }
  return {need,quality:b.sleepQuality,alertness:b.alertness};
}
function functionalCapacity(body){return clamp(.4+(Number.isFinite(body.alertness)?body.alertness:75)*.006,0.4,1);}
function drink(agent,amount=68){const b=ensureBody(agent);b.waterReserve=clamp(b.waterReserve+amount,0,100);agent.thirst=100-b.waterReserve;}
function eat(agent,amount=1){
  const b=ensureBody(agent);b.glycogenReserve=clamp(b.glycogenReserve+68*amount,0,100);b.fatReserveDays=clamp(b.fatReserveDays+.15*amount,0,70);b.fastingDays=Math.max(0,b.fastingDays-.75*amount);agent.hunger=Math.max(0,(agent.hunger||0)-48*amount);
}
function symptomTexts(body){
  const out=[];
  if(body.waterReserve<55)out.push('My mouth feels dry and I strongly want water.');
  if(body.waterReserve<30)out.push('I feel weak and dizzy after going without water.');
  if(body.waterReserve<15)out.push('My thoughts are confused and my body can barely continue without water.');
  if(body.glycogenReserve<20&&body.fastingDays<2)out.push('My stomach feels empty and my strength is fading.');
  if(body.fastingDays>=2)out.push('After long hunger, I feel weaker and my body is growing thinner.');
  if(body.coreTemperature>=39)out.push('My skin is hot and my thoughts are slowing.');
  if(body.coreTemperature<=35)out.push('I am shivering and losing control of my hands.');
  if(body.sleepPressure>=68)out.push('My eyelids feel heavy and I keep losing focus.');
  if(body.sleepDebtHours>=12)out.push('Even while awake, my thoughts and movements feel slow.');
  if(body.awakeHours>=30)out.push('I cannot stay fully alert and briefly drift toward sleep.');
  return out;
}
function advanceBody(agent,{weather={},active=false,sheltered=false,days=0,waterLossPerDay=24}={}){
  const b=ensureBody(agent),d=Math.max(0,days),demand=active?1.18:1;
  b.waterReserve=clamp(b.waterReserve-waterLossPerDay*d,0,100);
  let fuel=100*d*demand;
  const glycogenUsed=Math.min(b.glycogenReserve,fuel);b.glycogenReserve-=glycogenUsed;fuel-=glycogenUsed;
  if(fuel>0){const fatDaysUsed=fuel/100,available=b.fatReserveDays,unfed=Math.max(0,fatDaysUsed-available);b.fatReserveDays=Math.max(0,available-fatDaysUsed);b.fastingDays+=d;if(unfed>0)b.muscleReserve=clamp(b.muscleReserve-unfed*4,0,100);}else b.fastingDays=Math.max(0,b.fastingDays-d*.25);
  const air=Number.isFinite(weather.temperatureC)?weather.temperatureC:18;
  const exposure=sheltered?.22:1,target=37+Math.max(0,air-27)*.12*exposure-Math.max(0,8-air)*.18*exposure;
  b.coreTemperature+=clamp(target-b.coreTemperature,-1.2*d,1.2*d);
  if(b.waterReserve<20){const severity=(20-b.waterReserve)/20;b.organs.kidneys=clamp(b.organs.kidneys-45*severity*d,0,100);b.organs.brain=clamp(b.organs.brain-30*severity*d,0,100);agent.health=clamp((Number.isFinite(agent.health)?agent.health:100)-95*severity*d,0,100);}
  if(b.muscleReserve<30){const severity=(30-b.muscleReserve)/30;b.organs.heart=clamp(b.organs.heart-18*severity*d,0,100);agent.health=clamp((Number.isFinite(agent.health)?agent.health:100)-24*severity*d,0,100);}
  if(b.coreTemperature>40.5||b.coreTemperature<32.5)agent.health=clamp((Number.isFinite(agent.health)?agent.health:100)-80*d,0,100);
  agent.thirst=clamp(100-b.waterReserve,0,100);agent.bodyTemperature=b.coreTemperature;
  b.lastSymptoms=symptomTexts(b);
  if(agent.health<=0){
    if(b.waterReserve<20)return 'dehydration and organ failure';
    if(b.coreTemperature>40.5)return 'extreme heat';
    if(b.coreTemperature<32.5)return 'extreme cold';
    if(b.muscleReserve<30)return 'starvation and organ failure';
    if(b.sleepDamage>=40)return 'prolonged sleep deprivation';
    return 'organ failure';
  }
  return null;
}
function observation(level=0){
  if(level<=0)return {evidence:['A repeating pulse can be felt beneath the skin.','Breathing moves the chest and changes with effort.'],terms:[]};
  if(level===1)return {evidence:['Hard structures support the limbs.','Contracting tissue pulls the limbs into motion.'],terms:['bones','muscles']};
  if(level===2)return {evidence:['A central chamber repeatedly moves red fluid.','Paired soft chambers fill and empty with breath.'],terms:['heart','lungs']};
  return {evidence:Object.values(ANATOMY).map(x=>x.function),terms:Object.keys(ANATOMY)};
}

module.exports={ANATOMY,HOURS_PER_DAY,createBody,ensureBody,drink,eat,advanceBody,advanceSleep,circadianSleepDrive,sleepNeed,sleepQuality,functionalCapacity,symptomTexts,observation};
