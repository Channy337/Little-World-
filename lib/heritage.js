'use strict';

// These are neutral, simplified polygenic appearance traits. They never modify
// intelligence, personality, culture, knowledge, health, or work capacity.
const TRAITS=Object.freeze({melanin:4,hairPigment:3,hairCurl:3,eyePigment:2,faceBreadth:3});
function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v));}
function seededRandom(value){
  let n=2166136261;for(const c of String(value||'founder')){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}
  return function(){n=(Math.imul(1664525,n)+1013904223)>>>0;return n/4294967296;};
}
function founderGenome(random){
  const genome={};for(const [trait,loci] of Object.entries(TRAITS)){const ancestryCenter=random();genome[trait]=Array.from({length:loci},()=>[clamp(ancestryCenter+(random()-.5)*.18),clamp(ancestryCenter+(random()-.5)*.18)]);}return genome;
}
function validGenome(genome){return genome&&Object.entries(TRAITS).every(([trait,loci])=>Array.isArray(genome[trait])&&genome[trait].length===loci&&genome[trait].every(pair=>Array.isArray(pair)&&pair.length===2&&pair.every(Number.isFinite)));}
function phenotype(genome){
  const out={};for(const trait of Object.keys(TRAITS)){const alleles=genome[trait].flat();out[trait]=clamp(alleles.reduce((n,x)=>n+x,0)/alleles.length);}
  return out;
}
function makeFounderHeritage(random,key){const source=typeof random==='function'?random:seededRandom(key);const genome=founderGenome(source);return {genome,phenotype:phenotype(genome)};}
function inheritedGenome(a,b,random){
  const genome={};for(const [trait,loci] of Object.entries(TRAITS))genome[trait]=Array.from({length:loci},(_,i)=>{
    const left=a[trait][i][random()<.5?0:1],right=b[trait][i][random()<.5?0:1];
    const mutate=x=>clamp(x+(random()<.015?(random()-.5)*.06:0));return [mutate(left),mutate(right)];
  });return genome;
}
function inheritHeritage(parentA,parentB,random=Math.random){
  const a=ensureHeritage(parentA).genome,b=ensureHeritage(parentB).genome,genome=inheritedGenome(a,b,random);return {genome,phenotype:phenotype(genome)};
}
function ensureHeritage(agent){
  if(!agent.heritage||!validGenome(agent.heritage.genome))agent.heritage=makeFounderHeritage(null,(agent.id||0)+':'+(agent.name||'person'));
  agent.heritage.phenotype=phenotype(agent.heritage.genome);return agent.heritage;
}
function describe(agent){
  const p=ensureHeritage(agent).phenotype;
  return {
    skin:p.melanin<.2?'very light':p.melanin<.4?'light':p.melanin<.6?'medium':p.melanin<.8?'deep':'very deep',
    hair:p.hairCurl<.22?'straight':p.hairCurl<.48?'wavy':p.hairCurl<.74?'curly':'tightly curled',
    hairShade:p.hairPigment<.3?'light':p.hairPigment<.68?'brown':'dark',
    eyes:p.eyePigment<.3?'light':p.eyePigment<.68?'medium':'dark'
  };
}

module.exports={TRAITS,founderGenome,phenotype,makeFounderHeritage,inheritHeritage,ensureHeritage,describe};
