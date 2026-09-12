'use strict';

const SEASONS=['spring','summer','autumn','winter'];
const BASE_TEMPERATURE={spring:18,summer:29,autumn:17,winter:7};

function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function seasonForDay(day){return SEASONS[Math.floor((((Number(day)||1)-1)%360)/90)];}
function round(v){return Math.round(v*10)/10;}
function windChillC(temperatureC,windKph){
  const t=Number(temperatureC),v=Number(windKph);
  if(!Number.isFinite(t)||!Number.isFinite(v)||t>10||v<4.8)return Number.isFinite(t)?round(t):18;
  const p=Math.pow(v,.16);
  return round(13.12+.6215*t-11.37*p+.3965*t*p);
}

function generateDay(random,day,previous){
  const season=seasonForDay(day),roll=random();
  const storm=roll<((season==='spring'||season==='summer')?.12:.07);
  const rain=storm||roll<(season==='winter'?.22:.32);
  const cloudCover=storm?round(85+random()*15):rain?round(62+random()*30):round(random()*58);
  const anomalyRoll=random(),anomaly=anomalyRoll<.04?-(8+random()*4):anomalyRoll>.96?8+random()*4:0;
  const temperatureC=round(BASE_TEMPERATURE[season]+(random()-.5)*10+anomaly);
  const humidity=round(rain?78+random()*20:38+random()*34);
  const windKph=round(storm?25+random()*35:3+random()*18);
  const precipitationMm=round(storm?14+random()*42:rain?2+random()*17:0);
  const evaporation=Math.max(0,temperatureC-8)*.0035+windKph*.0008;
  const priorPond=previous&&Number.isFinite(previous.pondLevel)?previous.pondLevel:.82;
  const priorSoil=previous&&Number.isFinite(previous.soilMoisture)?previous.soilMoisture:.58;
  const pondLevel=round(clamp(priorPond+precipitationMm*.004-evaporation,.18,1));
  const soilMoisture=round(clamp(priorSoil+precipitationMm*.008-evaporation*1.8,.08,1));
  const snowing=precipitationMm>0&&temperatureC<=2;
  const priorSnow=previous&&Number.isFinite(previous.snowDepthCm)?previous.snowDepthCm:0;
  const snowfall=snowing?precipitationMm*.72:0;
  const melt=temperatureC>1?(temperatureC-1)*1.55:0;
  const snowDepthCm=round(clamp(priorSnow+snowfall-melt,0,80));
  const feelsLikeC=windChillC(temperatureC,windKph);

  let hazard=null;
  if(season==='winter'&&storm&&temperatureC<=2)hazard='blizzard';
  else if(precipitationMm>=40&&(priorPond>=.82||pondLevel>=.95))hazard='flood';
  else if(storm&&windKph>=48)hazard='windstorm';
  else if(temperatureC>=37)hazard='heatwave';
  else if(temperatureC<=-4)hazard='cold snap';
  else if(!rain&&temperatureC>=31&&priorSoil<=.16)hazard='drought';

  return {day,season,condition:storm?'storm':snowing?'snow':rain?'rain':cloudCover>45?'cloudy':'clear',hazard,temperatureC,feelsLikeC,humidity,windKph,precipitationMm,cloudCover,storm,snowing,snowDepthCm,pondLevel,soilMoisture};
}

function ensureWeather(state,random){
  if(!state.weather||typeof state.weather!=='object')state.weather=generateDay(random||Math.random,state.day||1,null);
  if(!Number.isFinite(state.weather.snowDepthCm))state.weather.snowDepthCm=0;
  if(typeof state.weather.snowing!=='boolean')state.weather.snowing=(state.weather.precipitationMm||0)>0&&(state.weather.temperatureC||18)<=2;
  if(!Number.isFinite(state.weather.feelsLikeC))state.weather.feelsLikeC=windChillC(state.weather.temperatureC,state.weather.windKph);
  if(!Array.isArray(state.weatherHistory))state.weatherHistory=[];
  state.ambientTemperature=state.weather.temperatureC;
  return state.weather;
}

function advanceWeather(state,random){
  const prior=ensureWeather(state,random);
  if(prior.day===state.day)return prior;
  state.weatherHistory.push({...prior});if(state.weatherHistory.length>30)state.weatherHistory.splice(0,state.weatherHistory.length-30);
  state.weather=generateDay(random,state.day,prior);state.ambientTemperature=state.weather.temperatureC;
  return state.weather;
}

function sensoryDescription(weather){
  if(!weather)return 'ordinary outdoor conditions';
  const felt=Number.isFinite(weather.feelsLikeC)?weather.feelsLikeC:weather.temperatureC;
  const heat=felt>=32?'oppressive heat':felt>=25?'warm air':felt<=-5?'bitter freezing air':felt<=2?'freezing air':felt<=10?'cold air':'mild air';
  const sky=weather.hazard==='blizzard'?'driving snow and strong wind':weather.snowing?'falling snow':weather.condition==='storm'?'dark clouds, hard rain, and strong wind':weather.condition==='rain'?'rainfall':weather.condition==='cloudy'?'clouded skies':'clear skies';
  const ground=(weather.snowDepthCm||0)>=8?' over deep snow':(weather.snowDepthCm||0)>1?' over snow-covered ground':'';
  const danger=weather.hazard?' with unusually dangerous conditions':'';
  return heat+' with '+sky+ground+danger;
}

function waterLossPerDay(weather,active){
  const t=weather&&Number.isFinite(weather.temperatureC)?weather.temperatureC:18;
  const humidity=weather&&Number.isFinite(weather.humidity)?weather.humidity:50;
  const heat=Math.max(0,t-24)*1.05;
  const humidHeat=t>27?Math.max(0,humidity-65)*.12:0;
  const coldDry=t<2?Math.min(5,(2-t)*.22):0;
  const activity=active?7:0;
  return 24+heat+humidHeat+coldDry+activity;
}

function growthMultiplier(weather){
  const w=weather||{},moisture=Number.isFinite(w.soilMoisture)?w.soilMoisture:.5,temp=Number.isFinite(w.temperatureC)?w.temperatureC:18;
  const moistureFactor=clamp(.3+moisture*1.15,.25,1.4);
  const temperatureFactor=clamp((temp+2)/14,.04,1);
  const snowFactor=(w.snowDepthCm||0)>=15?.18:(w.snowDepthCm||0)>=3?.38:1;
  const seasonFactor=w.season==='winter'?.48:w.season==='autumn'?.82:1;
  return clamp(moistureFactor*temperatureFactor*snowFactor*seasonFactor,.03,1.4);
}

function travelMultiplier(weather){
  const w=weather||{};let m=1;
  const snow=Number(w.snowDepthCm)||0;
  if(snow>2)m*=clamp(1-snow*.018,.55,.96);
  if(w.hazard==='blizzard')m*=.55;
  else if(w.hazard==='flood')m*=.62;
  else if(w.hazard==='windstorm')m*=.8;
  if((w.windKph||0)>45)m*=.88;
  return clamp(m,.3,1);
}

module.exports={SEASONS,seasonForDay,generateDay,ensureWeather,advanceWeather,sensoryDescription,waterLossPerDay,growthMultiplier,travelMultiplier,windChillC};
