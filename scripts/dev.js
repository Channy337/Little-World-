'use strict';
// Local-only test harness. Never imported by a Vercel function.
const http=require('node:http'),fs=require('node:fs');
const {makeHandler}=require('../lib/http');
const {createWorldService}=require('../lib/world');
const {memoryStore}=require('../test/helpers');
const service=createWorldService({store:memoryStore(),seed:()=>42});
const routes={'/api/state':makeHandler('state',{service}),'/api/tick':makeHandler('tick',{service})};
const files={'/':'index.html','/index.html':'index.html','/chronicle.html':'chronicle.html','/game.js':'game.js','/styles.css':'styles.css'};
http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  res.status=function(code){this.statusCode=code;return this;};
  res.json=function(body){this.setHeader('Content-Type','application/json');this.end(JSON.stringify(body));};
  if(routes[pathname]){
    let body='';for await(const chunk of req){body+=chunk;if(body.length>1024){res.status(413).end();return;}}
    if(body){try{req.body=JSON.parse(body);}catch{res.status(400).end();return;}}
    return routes[pathname](req,res);
  }
  const file=files[pathname];if(!file){res.status(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript');
  fs.createReadStream(file).pipe(res);
}).listen(3000,'127.0.0.1',()=>console.info('Local test village: http://127.0.0.1:3000 (memory only; never production)'));
