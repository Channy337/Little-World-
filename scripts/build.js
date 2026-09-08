'use strict';
const fs=require('node:fs');
fs.mkdirSync('public',{recursive:true});
for(const file of ['index.html','chronicle.html','game.js','styles.css']) fs.copyFileSync(file,'public/'+file);
