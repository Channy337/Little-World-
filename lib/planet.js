'use strict';

const VERSION=1;
const WIDTH=64;
const HEIGHT=40;
const GRAVITY_MPS2=9.81;
const AXIAL_TILT_DEG=23.44;

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function hash32(seed,x=0,y=0,salt=0){
  let n=(seed>>>0)^Math.imul((x+1)>>>0,0x9e3779b1)^Math.imul((y+1)>>>0,0x85ebca77)^Math.imul((salt+1)>>>0,0xc2b2ae3d);
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return (n^(n>>>16))>>>0;
}
function unit(seed,x,y,salt){return hash32(seed,x,y,salt)/4294967296;}
function ellipse(x,y,cx,cy,rx,ry){const dx=(x-cx)/rx,dy=(y-cy)/ry;return dx*dx+dy*dy;}
function landScore(seed,x,y){
  const body=Math.min(ellipse(x,y,29,19,20,14),ellipse(x,y,20,10,15,8.5),ellipse(x,y,44,11,14,8.5),ellipse(x,y,31,30,7.5,10));
  let score=1-body;
  score+=(unit(seed,x,y,2)-.5)*.24;
  if(ellipse(x,y,36,9,6,4.4)<1)score-=1.1; // inland bay
  if(ellipse(x,y,39,27,8,5)<1)score-=.72; // gulf indentation
  if(x>50&&y>19)score-=.35;
  return score;
}
function isLand(seed,x,y){return landScore(seed,x,y)>.02;}
function latitudeFor(y){return 72-(y/(HEIGHT-1))*52;}
function riverAxis(y){return 27.5+Math.sin((y-7)*.24)*2.2+(y-7)*.16;}
function riverDistance(x,y){return Math.abs(x-riverAxis(y));}
function coastDistance(seed,x,y){
  let best=8;
  for(let r=1;r<=7;r++){
    for(let dx=-r;dx<=r;dx++){
      for(const dy of [-r,r])if(x+dx>=0&&x+dx<WIDTH&&y+dy>=0&&y+dy<HEIGHT&&!isLand(seed,x+dx,y+dy))return r;
    }
    for(let dy=-r+1;dy<r;dy++){
      for(const dx of [-r,r])if(x+dx>=0&&x+dx<WIDTH&&y+dy>=0&&y+dy<HEIGHT&&!isLand(seed,x+dx,y+dy))return r;
    }
  }
  return best;
}
function cell(seed,x,y){
  x=clamp(Math.round(x),0,WIDTH-1);y=clamp(Math.round(y),0,HEIGHT-1);
  const land=isLand(seed,x,y),latitude=latitudeFor(y);
  if(!land)return {x,y,land:false,latitude,biome:'ocean',elevationM:-Math.round(300+unit(seed,x,y,4)*3500),temperatureMeanC:clamp(26-Math.abs(latitude-25)*.22,-2,28),precipitationMm:1100+Math.round(unit(seed,x,y,5)*900),river:false,coastal:true,soil:'marine',groundwater:1,drainage:1};
  const westMountains=Math.exp(-Math.pow((x-18)/4.2,2))*2400;
  const eastMountains=Math.exp(-Math.pow((x-46)/4.8,2))*850;
  const highNorth=Math.max(0,(14-y))*32;
  const lowNoise=(unit(seed,x,y,8)-.5)*420;
  const riverValley=(y>=7&&y<=34)?Math.max(0,1-riverDistance(x,y)/3.2)*420:0;
  const elevationM=Math.max(5,Math.round(130+westMountains+eastMountains+highNorth+lowNoise-riverValley));
  const coast=coastDistance(seed,x,y);
  const coastal=coast<=2;
  const maritime=clamp((8-coast)/8,0,1);
  const temp=clamp(29-Math.abs(latitude-28)*.48-elevationM*.006-maritime*1.5,-20,29);
  const pacificMoisture=clamp(1-(x-9)/29,0,1);
  const gulfMoisture=clamp(1-Math.hypot(x-38,y-31)/24,0,1);
  const atlanticMoisture=clamp((x-35)/22,0,1);
  const rainShadow=Math.exp(-Math.pow((x-24)/5.5,2))*.55;
  const precipitationMm=Math.round(clamp(330+950*pacificMoisture+830*gulfMoisture+520*atlanticMoisture+unit(seed,x,y,9)*420-rainShadow*900,180,2600));
  const river=y>=7&&y<=34&&riverDistance(x,y)<.72&&elevationM<1100;
  const groundwater=clamp(.18+precipitationMm/2600*.55+(river?.25:0)-elevationM/6000,0,1);
  const drainage=clamp(.25+elevationM/3200+(coastal?.12:0)-(river?.18:0),.08,1);
  let biome;
  if(elevationM>2500)biome=temp<1?'alpine tundra':'alpine';
  else if(temp<0)biome=precipitationMm>550?'tundra':'cold desert';
  else if(temp<7)biome=precipitationMm>700?'boreal forest':'cold grassland';
  else if(temp>22&&precipitationMm>1500)biome='temperate rainforest';
  else if(temp>20&&precipitationMm<520)biome='warm desert';
  else if(precipitationMm<520)biome='dry grassland';
  else if(precipitationMm<900)biome='grassland';
  else if(precipitationMm>1500)biome='wet forest';
  else biome='temperate forest';
  let soil='loam';
  if(river)soil='alluvial loam';else if(biome.includes('desert'))soil='sandy arid soil';else if(biome.includes('forest'))soil='forest loam';else if(elevationM>1800)soil='thin rocky soil';
  return {x,y,land:true,latitude:Math.round(latitude*10)/10,biome,elevationM,temperatureMeanC:Math.round(temp*10)/10,precipitationMm,river,coastal,soil,groundwater:Math.round(groundwater*100)/100,drainage:Math.round(drainage*100)/100};
}
function startingRegion(seed){
  let best=null,bestScore=-Infinity;
  for(let y=15;y<=29;y++)for(let x=24;x<=40;x++){
    const c=cell(seed,x,y);if(!c.land)continue;
    const score=(c.river?6:0)-(Math.abs(c.temperatureMeanC-15)*.16)-(Math.abs(c.precipitationMm-1050)/500)-(Math.abs(c.elevationM-180)/520)+(c.soil==='alluvial loam'?2:0);
    if(score>bestScore){bestScore=score;best=c;}
  }
  return best||cell(seed,31,23);
}
function localTerrain(seed,center,cols=12,rows=8){
  const out=[];
  for(let gy=0;gy<rows;gy++)for(let gx=0;gx<cols;gx++){
    const px=clamp(center.x+gx-Math.floor(cols/2),0,WIDTH-1),py=clamp(center.y+gy-Math.floor(rows/2),0,HEIGHT-1);
    const c=cell(seed,px,py);
    out.push({gx,gy,land:c.land,biome:c.biome,elevationM:c.elevationM,river:c.river,soil:c.soil,groundwater:c.groundwater,drainage:c.drainage});
  }
  return out;
}
function regionSummary(c){return {x:c.x,y:c.y,latitude:c.latitude,biome:c.biome,elevationM:c.elevationM,temperatureMeanC:c.temperatureMeanC,precipitationMm:c.precipitationMm,river:c.river,coastal:c.coastal,soil:c.soil,groundwater:c.groundwater,drainage:c.drainage};}
function ensurePlanet(state,seed){
  if(!state.planet||state.planet.version!==VERSION){
    const s=(Number.isInteger(seed)?seed:(Number.isInteger(state.rng)?state.rng:1))>>>0;
    const start=startingRegion(s);
    state.planet={version:VERSION,seed:s,width:WIDTH,height:HEIGHT,gravityMps2:GRAVITY_MPS2,axialTiltDeg:AXIAL_TILT_DEG,rotationHours:24,atmosphere:{pressureKPa:101.3,oxygenFraction:.2095},current:{x:start.x,y:start.y},startingRegion:regionSummary(start),discoveredRegions:[{x:start.x,y:start.y,firstSeenDay:state.day||1}]};
  }
  if(!state.planet.current)state.planet.current={x:state.planet.startingRegion.x,y:state.planet.startingRegion.y};
  const current=cell(state.planet.seed,state.planet.current.x,state.planet.current.y);
  state.planet.localClimate=regionSummary(current);
  state.terrain={version:VERSION,region:{x:current.x,y:current.y},cols:12,rows:8,cells:localTerrain(state.planet.seed,current,12,8)};
  return state.planet;
}
function climateForState(state){const p=ensurePlanet(state);return p.localClimate;}
function atlasSample(seed,cols=16,rows=10){
  const out=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const c=cell(seed,Math.round(x*(WIDTH-1)/(cols-1)),Math.round(y*(HEIGHT-1)/(rows-1)));
    out.push({x,y,land:c.land,biome:c.biome,elevationM:c.elevationM,river:c.river});
  }
  return {cols,rows,cells:out};
}

module.exports={VERSION,WIDTH,HEIGHT,GRAVITY_MPS2,AXIAL_TILT_DEG,hash32,cell,startingRegion,localTerrain,ensurePlanet,climateForState,atlasSample};
