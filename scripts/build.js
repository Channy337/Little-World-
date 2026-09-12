'use strict';
const fs=require('node:fs');
fs.mkdirSync('public',{recursive:true});
for(const file of ['index.html','chronicle.html','discoveries.html','us-map-option2.html','us-map-option2-rich.html','discovery-graph.js','game.js','activity-clock.js','growth-visuals.js','mind-feed.js','panel-scroll-fix.js','world-ticker.js','world-life-weather.js','fahrenheit-display.js','world-ticker.css','styles.css']) fs.copyFileSync(file,'public/'+file);
