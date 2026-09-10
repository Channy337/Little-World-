'use strict';
const fs=require('node:fs');
fs.mkdirSync('public',{recursive:true});
for(const file of ['index.html','chronicle.html','game.js','activity-clock.js','globe-fallback.js','globe-webgl.js','styles.css']) fs.copyFileSync(file,'public/'+file);
fs.copyFileSync('node_modules/three/build/three.module.js','public/three.module.js');
