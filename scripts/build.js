'use strict';
const fs=require('node:fs');
fs.mkdirSync('public',{recursive:true});
for(const file of ['index.html','chronicle.html','game.js','activity-clock.js','growth-visuals.js','mind-feed.js','styles.css']) fs.copyFileSync(file,'public/'+file);
