'use strict';
const fs=require('node:fs');
fs.mkdirSync('public',{recursive:true});
for(const file of ['index.html','chronicle.html','game.js','activity-clock.js','growth-visuals.js','mind-feed.js','panel-scroll-fix.js','world-ticker.js','world-ticker.css','styles.css']) fs.copyFileSync(file,'public/'+file);
