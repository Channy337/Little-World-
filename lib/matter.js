'use strict';

// Civoria's people do not receive this catalog. It is the hidden physical
// truth used by the canonical engine when their senses or instruments interact
// with matter.
const ELEMENT_SYMBOLS=('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' ');
const ELEMENTS=Object.freeze(Object.fromEntries(ELEMENT_SYMBOLS.map((symbol,i)=>[symbol,{symbol,atomicNumber:i+1}])));
const SUBSTANCES=Object.freeze({
  water:{formula:'H2O',composition:{H:2,O:1},freeze:0,boil:100,density:1,perceptible:{appearance:'clear liquid',touch:'wet and usually cool'}},
  oxygen:{formula:'O2',composition:{O:2},boil:-183,density:.00143,perceptible:{appearance:'invisible gas'}},
  nitrogen:{formula:'N2',composition:{N:2},boil:-196,density:.00125,perceptible:{appearance:'invisible gas'}},
  carbonDioxide:{formula:'CO2',composition:{C:1,O:2},boil:-78.5,density:.00198,perceptible:{appearance:'invisible gas'}},
  cellulose:{formula:'(C6H10O5)n',composition:{C:6,H:10,O:5},ignition:260,density:1.5,perceptible:{appearance:'fibrous solid',touch:'firm and dry when seasoned'}},
  silica:{formula:'SiO2',composition:{Si:1,O:2},melt:1710,density:2.65,perceptible:{appearance:'hard pale grains or stone'}},
  ironOxide:{formula:'Fe2O3',composition:{Fe:2,O:3},melt:1565,density:5.24,perceptible:{appearance:'heavy reddish earth or stone'}},
  salt:{formula:'NaCl',composition:{Na:1,Cl:1},melt:801,density:2.16,perceptible:{appearance:'pale crystals',taste:'salty'}},
  smoke:{formula:null,composition:{C:1,O:.2},density:.001,perceptible:{appearance:'dark airborne particles',smell:'sharp and choking'}},
  ash:{formula:null,composition:{C:.1,Ca:.3,K:.1,O:.5},density:.7,perceptible:{appearance:'light gray powder'}}
});
const OBSERVATION_LEVELS=Object.freeze({senses:0,measure:1,magnify:2,analyze:3});

function substance(id){return SUBSTANCES[id]||null;}
function phaseAt(id,temperature){
  const s=substance(id);if(!s||!Number.isFinite(temperature))return 'unknown';
  if(Number.isFinite(s.freeze)&&temperature<=s.freeze)return 'solid';
  if(Number.isFinite(s.boil)&&temperature>=s.boil)return 'gas';
  return Number.isFinite(s.freeze)||Number.isFinite(s.boil)?'liquid':'solid';
}
function observation(id,{level=0,temperature=20,mass=null}={}){
  const s=substance(id);if(!s)return null;
  const out={sample:id,phase:phaseAt(id,temperature),...s.perceptible};
  if(level>=OBSERVATION_LEVELS.measure){out.temperature=temperature;if(Number.isFinite(mass))out.mass=mass;out.density=s.density;}
  if(level>=OBSERVATION_LEVELS.magnify)out.structure='smaller repeated structures are visible, but their composition is unresolved';
  if(level>=OBSERVATION_LEVELS.analyze){out.formula=s.formula;out.composition={...s.composition};}
  return out;
}
function toolLevel(tool){
  if(!tool||typeof tool!=='object')return 0;
  if(tool.capabilities&&tool.capabilities.includes('analyze-composition')&&tool.resolution<=1e-9)return 3;
  if(tool.capabilities&&tool.capabilities.includes('magnify')&&tool.resolution<=.01)return 2;
  if(tool.capabilities&&tool.capabilities.includes('measure'))return 1;
  return 0;
}
function conservesAtoms(inputs,outputs){
  const sum=list=>list.reduce((all,item)=>{const s=substance(item.substance);if(!s)return all;for(const [k,n] of Object.entries(s.composition))all[k]=(all[k]||0)+n*(item.amount||1);return all;},{});
  const a=sum(inputs||[]),b=sum(outputs||[]),keys=new Set([...Object.keys(a),...Object.keys(b)]);
  return [...keys].every(k=>Math.abs((a[k]||0)-(b[k]||0))<1e-9);
}

module.exports={ELEMENTS,SUBSTANCES,OBSERVATION_LEVELS,substance,phaseAt,observation,toolLevel,conservesAtoms};
