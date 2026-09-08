'use strict';
function memoryStore() {
  let raw=null, initialized=false;
  return {
    async read(){return raw;},
    async initialize(candidate){if(raw!==null)return raw;if(initialized)return 'WORLD_MISSING';initialized=true;return raw=candidate;},
    async compareAndSwap(before,after){if(raw!==before)return 0;raw=after;return 1;},
    corrupt(value){raw=value;},
  };
}
module.exports={memoryStore};
