'use strict';
const fs=require('node:fs');
const esbuild=require('esbuild');

fs.mkdirSync('public',{recursive:true});
for(const file of ['chronicle.html','game.js','activity-clock.js','globe-fallback.js','globe-webgl.js','styles.css']) fs.copyFileSync(file,'public/'+file);

// Preview authentication can allow the HTML request while blocking follow-up module
// requests in iPhone in-app browsers. Bundle Three.js + the globe + its Canvas
// fallback into the HTML so the world starts from the single authenticated page.
fs.copyFileSync('node_modules/three/build/three.module.js','three.module.js');
fs.copyFileSync('node_modules/three/build/three.core.js','three.core.js');
const fallback=fs.readFileSync('globe-fallback.js','utf8');
let gpuSource=fs.readFileSync('globe-webgl.js','utf8');
gpuSource=gpuSource.replace(
  "const s=document.createElement('script');s.src='globe-fallback.js';document.body.appendChild(s);",
  "const s=document.createElement('script');s.textContent="+JSON.stringify(fallback)+";document.body.appendChild(s);"
);
const bundled=esbuild.buildSync({
  stdin:{contents:gpuSource,resolveDir:process.cwd(),sourcefile:'globe-webgl.js'},
  bundle:true,
  write:false,
  format:'iife',
  platform:'browser',
  target:['safari15'],
  minify:true
}).outputFiles[0].text;
fs.unlinkSync('three.module.js');
fs.unlinkSync('three.core.js');

const escapeScript=s=>s.replace(/<\/script/gi,'<\\/script');
const activity=escapeScript(fs.readFileSync('activity-clock.js','utf8'));
let html=fs.readFileSync('index.html','utf8');
html=html.replace(
  '<script src="activity-clock.js"></script>\n<script type="module" src="globe-webgl.js"></script>',
  '<script>'+activity+'</script>\n<script>'+escapeScript(bundled)+'</script>'
);
if(html.includes('src="globe-webgl.js"'))throw new Error('GPU globe was not inlined');
fs.writeFileSync('public/index.html',html);
