'use strict';

const PLANT_SPECIES=Object.freeze({
  blackRaspberry:{scientificName:'Rubus occidentalis',appearance:'thorny cane with dark clustered fruit',leafShape:'three to five toothed leaflets',venation:'branching netted veins',seedAppearance:'tiny hard tan pieces inside dark fruit',growthHabit:'arching cane',calories:360,water:24,toxin:0,spoilDays:4,fiberYield:.12,germination:{minC:5,maxC:28,moistureMin:.34,moistureMax:.9,depthMinCm:.2,depthMaxCm:2.8,dormancyDays:18,germinationDays:16,maturityDays:150}},
  wildSunflower:{scientificName:'Helianthus annuus',appearance:'rough tall stem with a broad yellow flower head',leafShape:'broad heart-shaped rough leaves',venation:'three strong veins from the leaf base',seedAppearance:'striped hard kernels from a dry flower head',growthHabit:'upright annual',calories:690,water:4,toxin:0,spoilDays:30,fiberYield:.3,germination:{minC:7,maxC:34,moistureMin:.25,moistureMax:.78,depthMinCm:1,depthMaxCm:5,dormancyDays:2,germinationDays:9,maturityDays:105}},
  wildRice:{scientificName:'Zizania palustris',appearance:'tall narrow grass growing at the water edge',leafShape:'long flat blades',venation:'parallel veins',seedAppearance:'long dark grains that loosen from the seed head',growthHabit:'shallow-water grass',calories:640,water:9,toxin:0,spoilDays:20,fiberYield:.2,germination:{minC:4,maxC:24,moistureMin:.68,moistureMax:1,depthMinCm:.2,depthMaxCm:3,dormancyDays:28,germinationDays:20,maturityDays:120}},
  cattail:{scientificName:'Typha latifolia',appearance:'tall wetland stalk with a brown cylindrical head',leafShape:'long strap-like leaves',venation:'parallel veins',seedAppearance:'very small brown pieces held in pale fluff',growthHabit:'wetland clump',calories:160,water:18,toxin:0,spoilDays:8,fiberYield:.72,germination:{minC:8,maxC:30,moistureMin:.72,moistureMax:1,depthMinCm:0,depthMaxCm:1.2,dormancyDays:0,germinationDays:8,maturityDays:140}},
  pokeweed:{scientificName:'Phytolacca americana',appearance:'reddish stem with hanging dark-purple berry clusters',leafShape:'large smooth oval leaves',venation:'branching netted veins',seedAppearance:'small black lens-shaped pieces inside purple fruit',growthHabit:'upright branching herb',calories:70,water:28,toxin:28,spoilDays:3,fiberYield:.15,germination:{minC:8,maxC:30,moistureMin:.3,moistureMax:.88,depthMinCm:.3,depthMaxCm:3,dormancyDays:25,germinationDays:18,maturityDays:110}}
});
const SPECIES_KEYS=Object.keys(PLANT_SPECIES);
const LEGACY_PLANT_MAP=Object.freeze({redDrupe:'blackRaspberry',blueCluster:'pokeweed',palePod:'wildSunflower',bitterLeaf:'cattail'});
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function profileForBush(bush){
  if(!bush)return PLANT_SPECIES.blackRaspberry;
  if(!PLANT_SPECIES[bush.plantSpecies]){
    const migrated=LEGACY_PLANT_MAP[bush.species];
    bush.plantSpecies=PLANT_SPECIES[migrated]?migrated:SPECIES_KEYS[Math.abs(Number(bush.id)||0)%SPECIES_KEYS.length];
  }
  return PLANT_SPECIES[bush.plantSpecies];
}
function genomeFor(sourceId,profile){
  const n=Math.abs(Number(sourceId)||1),bias=((n*1103515245+12345)>>>0)/4294967296-.5;
  return {tempBiasC:Math.round(bias*24)/10,moistureBias:Math.round((((n*2654435761)>>>0)/4294967296-.5)*10)/100,depthBiasCm:Math.round((((n*2246822519)>>>0)/4294967296-.5)*10)/10,vigor:Math.round((.9+(((n*3266489917)>>>0)/4294967296)*.2)*100)/100,toxin:profile.toxin};
}
function ensureAgentSeeds(agent){
  if(!Array.isArray(agent.seeds))agent.seeds=[];
  if(!agent.cultivationEvidence||typeof agent.cultivationEvidence!=='object')agent.cultivationEvidence={};
  if(!agent.inv||typeof agent.inv!=='object')agent.inv={food:0};
  agent.inv.plantbit=agent.seeds.filter(x=>(x.viability||0)>0).length;
  return agent.seeds;
}
function ensureCultivation(state){
  if(!Array.isArray(state.plantings))state.plantings=[];
  for(const bush of state.bushes||[]){const p=profileForBush(bush);bush.appearance=p.appearance;bush.leafShape=p.leafShape;bush.venation=p.venation;if(!bush.plantGenome)bush.plantGenome=genomeFor(bush.id,p);}
  for(const a of state.agents||[])ensureAgentSeeds(a);
  return state;
}
function collectSeed(state,agent,bush,day){
  const seeds=ensureAgentSeeds(agent),p=profileForBush(bush),g=bush.plantGenome||genomeFor(bush.id,p);
  if(state)ensureCultivation(state);
  const id=state&&Number.isSafeInteger(state.nextId)?state.nextId++:'plantbit-'+String(bush.id)+'-'+String(day)+'-'+String(seeds.length+1);
  const seed={id,sourceId:bush.id,species:bush.plantSpecies,appearance:p.seedAppearance,collectedDay:day,viability:1,genome:{...g}};
  seeds.push(seed);if(seeds.length>24)seeds.splice(0,seeds.length-24);ensureAgentSeeds(agent);return seed;
}
function seedCount(agent){return ensureAgentSeeds(agent).filter(x=>(x.viability||0)>0).length;}
function firstViableSeed(agent){return ensureAgentSeeds(agent).find(x=>(x.viability||0)>0)||null;}
function plantSeed(state,agent,{x,y,depthCm=2,watered=false}={}){
  ensureCultivation(state);const seed=firstViableSeed(agent);if(!seed)return null;
  const at=agent.seeds.findIndex(x=>x.id===seed.id);agent.seeds.splice(at,1);ensureAgentSeeds(agent);
  const p=PLANT_SPECIES[seed.species]||PLANT_SPECIES.blackRaspberry;
  const planting={id:state.nextId++,ownerId:agent.id,seedId:seed.id,species:seed.species,appearance:p.seedAppearance,visiblePlant:p.appearance,x:Number.isFinite(x)?x:agent.x,y:Number.isFinite(y)?y:agent.y,depthCm:clamp(Number(depthCm)||0,0,12),watered:!!watered,moistureBoost:watered?.25:0,ageDays:0,viability:seed.viability,genome:{...seed.genome},stage:'dormant',germinatedDay:null,matureDay:null,seedHeads:0,recordedSuccess:false};
  state.plantings.push(planting);if(state.plantings.length>160)state.plantings.splice(0,state.plantings.length-160);return planting;
}
function waterPlanting(state,agent,plantingId){
  ensureCultivation(state);let p=state.plantings.find(x=>x.id===plantingId);if(!p){let best=null,bd=30;for(const x of state.plantings){const d=Math.hypot(x.x-agent.x,x.y-agent.y);if(d<bd){bd=d;best=x;}}p=best;}if(!p)return null;p.watered=true;p.moistureBoost=clamp((p.moistureBoost||0)+.3,0,.8);return p;
}
function addObservation(agent,text,day,kind='cultivation',importance=72){
  if(!agent.mind)return;if(!Array.isArray(agent.mind.observations))agent.mind.observations=[];if(!Array.isArray(agent.mind.memories))agent.mind.memories=[];
  if(!agent.mind.observations.some(x=>x.text===text))agent.mind.observations.push({text,day,source:'senses'});
  if(!agent.mind.memories.some(x=>x.text===text&&x.day===day))agent.mind.memories.push({text,day,kind,importance});
  if(agent.mind.observations.length>24)agent.mind.observations.splice(0,agent.mind.observations.length-24);if(agent.mind.memories.length>18)agent.mind.memories.splice(0,agent.mind.memories.length-18);
}
function recordSuccess(state,planting){
  if(planting.recordedSuccess)return;const agent=(state.agents||[]).find(a=>a.id===planting.ownerId);if(!agent)return;planting.recordedSuccess=true;
  const p=PLANT_SPECIES[planting.species]||PLANT_SPECIES.blackRaspberry,key=planting.appearance;
  ensureAgentSeeds(agent);agent.cultivationEvidence[key]=(agent.cultivationEvidence[key]||0)+1;
  addObservation(agent,'A small hard plant piece I placed in the ground became a living '+p.growthHabit+'.',state.day,'cultivation',84);
  if(agent.cultivationEvidence[key]>=2&&agent.mind){
    if(!Array.isArray(agent.mind.capabilities))agent.mind.capabilities=[];
    const id='cultivation:'+key;
    if(!agent.mind.capabilities.some(x=>x.id===id)){
      agent.mind.capabilities.push({id,kind:'process',evidence:agent.cultivationEvidence[key],discoveredDay:state.day,method:{operation:'bury',materials:['plantbit'],form:'ground placement',depthCm:planting.depthCm}});
      if(!Array.isArray(agent.mind.knowledge))agent.mind.knowledge=[];agent.mind.knowledge.push('Some small hard plant pieces can make new plants when placed in suitable ground.');
      addObservation(agent,'I have repeated this result and can deliberately try the same ground placement again.',state.day,'discovery',92);
    }
  }
}
function resolveBurialArtifacts(state){
  for(const agent of state.agents||[]){
    ensureAgentSeeds(agent);
    for(const artifact of agent.artifacts||[]){
      if(artifact.cultivationResolved||!['bury','place'].includes(artifact.operation))continue;
      const usedFood=(artifact.materials||[]).includes('food'),usedPlantBit=(artifact.materials||[]).includes('plantbit');
      if(!(usedFood||usedPlantBit)){artifact.cultivationResolved=true;continue;}
      const seed=firstViableSeed(agent);if(!seed){artifact.cultivationResolved=true;artifact.cultivationOutcome='No viable hard plant piece was present.';continue;}
      const depth=artifact.operation==='place'?.2:2.2;
      const planting=plantSeed(state,agent,{x:agent.x,y:agent.y,depthCm:depth,watered:false});
      artifact.cultivationResolved=true;artifact.plantingId=planting&&planting.id||null;artifact.cultivationOutcome=planting?'A small hard plant piece remains where it was placed in the ground.':'Nothing viable was placed.';
      if(planting)addObservation(agent,'I placed a small hard piece from a plant into the ground and marked the spot.',state.day,'experiment',67);
    }
  }
}
function advanceCultivation(state,days){
  ensureCultivation(state);resolveBurialArtifacts(state);
  const d=Math.max(0,Number(days)||0),w=state.weather||{},soilMoisture=clamp(Number.isFinite(w.soilMoisture)?w.soilMoisture:.5,0,1),temp=Number.isFinite(w.temperatureC)?w.temperatureC:18;
  for(const q of state.plantings){
    const p=PLANT_SPECIES[q.species]||PLANT_SPECIES.blackRaspberry,g=p.germination,gen=q.genome||{},effectiveTemp=temp-(Number(gen.tempBiasC)||0),effectiveMoisture=clamp(soilMoisture+(q.moistureBoost||0)-(Number(gen.moistureBias)||0),0,1),effectiveDepth=q.depthCm-(Number(gen.depthBiasCm)||0);
    q.ageDays+=d;q.moistureBoost=clamp((q.moistureBoost||0)-d*.06,0,.8);
    if(q.stage==='dormant'){
      const dormant=q.ageDays<g.dormancyDays,temperatureOk=effectiveTemp>=g.minC&&effectiveTemp<=g.maxC,moistureOk=effectiveMoisture>=g.moistureMin&&effectiveMoisture<=g.moistureMax,depthOk=effectiveDepth>=g.depthMinCm&&effectiveDepth<=g.depthMaxCm;
      if(!dormant&&temperatureOk&&moistureOk&&depthOk&&q.viability>0){q.stage='germinating';q.germinationProgress=0;}
      else if(q.ageDays>g.dormancyDays+35&&(!temperatureOk||!moistureOk||!depthOk))q.viability=clamp(q.viability-d*.012,0,1);
    }else if(q.stage==='germinating'){
      const moistureOk=effectiveMoisture>=g.moistureMin*.85&&effectiveMoisture<=Math.min(1,g.moistureMax+.08),temperatureOk=effectiveTemp>=g.minC-2&&effectiveTemp<=g.maxC+2;
      if(!moistureOk||!temperatureOk){q.viability=clamp(q.viability-d*.02,0,1);if(q.viability<=0)q.stage='failed';continue;}
      q.germinationProgress=(q.germinationProgress||0)+d*Math.max(.6,Number(gen.vigor)||1);if(q.germinationProgress>=g.germinationDays){q.stage='growing';q.germinatedDay=state.day;q.growth=0;}
    }else if(q.stage==='growing'){
      const moistureFit=effectiveMoisture>=g.moistureMin*.72&&effectiveMoisture<=Math.min(1,g.moistureMax+.12),temperatureFit=effectiveTemp>=g.minC-4&&effectiveTemp<=g.maxC+4;
      const fit=(moistureFit&&temperatureFit)?1:.28;q.growth=clamp((q.growth||0)+d/g.maturityDays*fit*(Number(gen.vigor)||1),0,1);
      if(q.growth>=1){q.stage='mature';q.matureDay=state.day;q.seedHeads=2+Math.floor((Number(gen.vigor)||1)*3);recordSuccess(state,q);}
    }
  }
  return state;
}
function sensoryPlant(bush){const p=profileForBush(bush);return {appearance:p.appearance,leafShape:p.leafShape,venation:p.venation,seedAppearance:p.seedAppearance,growthHabit:p.growthHabit};}
function hiddenIdentity(species){const p=PLANT_SPECIES[species];return p?p.scientificName:null;}

module.exports={PLANT_SPECIES,SPECIES_KEYS,ensureCultivation,ensureAgentSeeds,profileForBush,collectSeed,seedCount,firstViableSeed,plantSeed,waterPlanting,advanceCultivation,sensoryPlant,hiddenIdentity,resolveBurialArtifacts};
