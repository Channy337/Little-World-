'use strict';

const WORLD_CONSTANTS=Object.freeze({gravity:9.81,airDensity:1.225,waterDensity:1000,oxygenFraction:.2095});
const MATERIALS=Object.freeze({
  wood:{density:650,hardness:.35,tensile:.45,flexibility:.45,workability:.82,permeability:.5,heatResistance:.22},
  timber:{density:620,hardness:.38,tensile:.52,flexibility:.38,workability:.72,permeability:.45,heatResistance:.2},
  stone:{density:2600,hardness:.82,tensile:.12,flexibility:.02,workability:.22,permeability:.08,heatResistance:.85},
  fiber:{density:900,hardness:.12,tensile:.62,flexibility:.95,workability:.9,permeability:.82,heatResistance:.12},
  clay:{density:1700,hardness:.16,tensile:.08,flexibility:.3,workability:.96,permeability:.38,heatResistance:.58},
  ore:{density:4800,hardness:.65,tensile:.28,flexibility:.08,workability:.08,permeability:.02,heatResistance:.9},
  bone:{density:1900,hardness:.58,tensile:.34,flexibility:.12,workability:.45,permeability:.12,heatResistance:.35},
  hide:{density:980,hardness:.1,tensile:.58,flexibility:.86,workability:.74,permeability:.42,heatResistance:.18},
  food:{density:1050,hardness:.08,tensile:.05,flexibility:.5,workability:.95,permeability:.75,heatResistance:.05}
});
const FORMS=new Set(['rough','thin','flat','long','round','hollow','pointed','frame','sheet','cord']);
const OPERATIONS=new Set(['shape','combine','bind','stack','heat','soak','dry','balance','spin','channel']);

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function material(id){return MATERIALS[id]||null;}
function part(materialId,form='rough',makerId=null,day=0){
  const p=material(materialId);if(!p||!FORMS.has(form))return null;
  const geometry={area:1,volume:1,length:1,thickness:1,roundness:0,cavity:0,point:0};
  if(form==='thin'||form==='sheet'){geometry.area=3.2;geometry.volume=.55;geometry.thickness=.18;}
  if(form==='flat'){geometry.area=2.2;geometry.volume=.8;geometry.thickness=.32;}
  if(form==='long'){geometry.length=3;geometry.volume=1.15;}
  if(form==='round'){geometry.roundness=1;geometry.volume=.9;}
  if(form==='hollow'){geometry.cavity=.72;geometry.volume=.45;geometry.area=1.4;}
  if(form==='pointed'){geometry.point=1;geometry.length=1.4;}
  if(form==='frame'){geometry.area=2.4;geometry.volume=.65;geometry.cavity=.85;}
  if(form==='cord'){geometry.length=5;geometry.volume=.2;geometry.thickness=.08;}
  const mass=p.density*geometry.volume/1000;
  return {id:null,material:materialId,form,makerId,day,geometry,mass,properties:{...p}};
}
function functionsForPart(p){
  const out=[];if(!p)return out;
  if(p.geometry.point>.7&&p.properties.hardness>.45)out.push('concentrates force at a point');
  if(p.geometry.cavity>.6&&p.properties.permeability<.5)out.push('can hold loose matter or liquid briefly');
  if(p.form==='cord'&&p.properties.tensile>.45)out.push('can bind separated parts');
  if(p.geometry.area/p.mass>1.5)out.push('interacts strongly with moving air');
  if((p.form==='sheet'||p.form==='flat')&&p.properties.flexibility>.7&&(p.material==='hide'||p.material==='fiber'))out.push('can reduce heat loss when wrapped around a body');
  if(p.properties.density<WORLD_CONSTANTS.waterDensity)out.push('tends to float in water');
  if(p.form==='long'&&p.properties.tensile>.3)out.push('can carry force across a distance');
  return out;
}
function assemble(parts,connections=[]){
  const valid=(parts||[]).filter(Boolean);if(!valid.length)return null;
  const mass=valid.reduce((n,p)=>n+p.mass,0),area=valid.reduce((n,p)=>n+p.geometry.area,0),volume=valid.reduce((n,p)=>n+p.geometry.volume,0);
  const strength=Math.min(...valid.map(p=>p.properties.tensile))*(1+Math.min(1,connections.length*.18));
  const functions=[...new Set(valid.flatMap(functionsForPart))];
  if(connections.length&&valid.some(p=>p.geometry.roundness>.8)&&valid.some(p=>p.form==='long'))functions.push('can transfer motion through rotation');
  if(area/mass>1.8&&strength>.22)functions.push('can generate lift while moving through air');
  if(mass/Math.max(.01,volume)<WORLD_CONSTANTS.waterDensity&&connections.length)functions.push('can support joined matter on water');
  return {mass,area,volume,strength,connections:connections.slice(0,12),parts:valid,functions:[...new Set(functions)]};
}
function evaluatePrototype({operation,materials=[],form='rough',makerId=null,day=0}={}){
  if(!OPERATIONS.has(operation)||!materials.length)return {success:false,reason:'No physically grounded operation was available.'};
  const raw=materials.map(x=>part(x,form,makerId,day));if(raw.some(x=>!x))return {success:false,reason:'The material or form has no physical model yet.'};
  if(operation==='shape'&&raw[0].properties.workability<.15)return {success:false,reason:'The material resisted the available shaping effort.'};
  if(operation==='heat'){
    if(materials[0]==='clay')raw[0].properties={...raw[0].properties,hardness:.72,permeability:.06,workability:.08};
    else if(materials[0]==='wood')raw[0].properties={...raw[0].properties,hardness:.25,heatResistance:.5};
  }
  const connections=['combine','bind','stack'].includes(operation)?raw.slice(1).map((_,i)=>({a:i,b:i+1,type:operation})):[];
  const assembly=assemble(raw,connections),functions=assembly.functions;
  const signature=[operation,[...materials].sort().join('+'),form].join(':');
  return {success:true,signature,operation,materials:[...materials],form,assembly,functions,observation:functions.length?functions.join('; '):'The form exists, but no useful behavior is established yet.'};
}
function performance(prototype,{speed=0,fluid='air'}={}){
  if(!prototype||!prototype.assembly)return null;
  const a=prototype.assembly,density=fluid==='water'?WORLD_CONSTANTS.waterDensity:WORLD_CONSTANTS.airDensity;
  return {weightNewtons:a.mass*WORLD_CONSTANTS.gravity,dynamicForceNewtons:.5*density*speed*speed*a.area,liftPossible:fluid==='air'&&a.functions.includes('can generate lift while moving through air')};
}

module.exports={WORLD_CONSTANTS,MATERIALS,FORMS,OPERATIONS,material,part,functionsForPart,assemble,evaluatePrototype,performance};
