'use strict';
const fs=require('node:fs');
fs.mkdirSync('public',{recursive:true});
for(const file of ['index.html','chronicle.html','discoveries.html','discovery-graph.js','game.js','activity-clock.js','growth-visuals.js','mind-feed.js','panel-scroll-fix.js','jarvis-profile.js','planet-view.js','shelter-view.js','world-ticker.js','world-life-weather.js','fahrenheit-display.js','ambient-music.js','world-ticker.css','observer-ui.css','ambient-music.css','styles.css']) fs.copyFileSync(file,'public/'+file);
