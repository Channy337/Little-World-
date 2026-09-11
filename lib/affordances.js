'use strict';

// These are properties of Civoria's environment, not knowledge granted to its
// people. A Civorian must physically try a signature before learning its result.
const AFFORDANCES={
  'shape:wood':{
    id:'shape:wood',operation:'shape',inputs:{wood:1},outputs:{timber:1},
    duration:3,skill:'woodcutting',lesson:'Shaping wood repeatedly produces useful timber.'
  }
};

function signature(operation,materials){
  const list=Array.isArray(materials)?[...new Set(materials.map(String).map(x=>x.toLowerCase()))].sort():[];
  return String(operation||'').toLowerCase()+':'+list.join('+');
}
function lookup(operation,materials){return AFFORDANCES[signature(operation,materials)]||null;}
function canPay(inv,inputs){return Object.entries(inputs||{}).every(([k,n])=>Number(inv&&inv[k])>=n);}
function pay(inv,inputs){for(const [k,n] of Object.entries(inputs||{}))inv[k]-=n;}
function produce(inv,outputs){for(const [k,n] of Object.entries(outputs||{}))inv[k]=(Number(inv[k])||0)+n;}

module.exports={AFFORDANCES,signature,lookup,canPay,pay,produce};
