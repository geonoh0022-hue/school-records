import {readFile} from 'node:fs/promises';
import path from 'node:path';
export function validState(body){
 if(!body||!Number.isSafeInteger(body.revision)||body.revision<0||!body.values||Array.isArray(body.values)||typeof body.values!=='object')return false;
 if(Object.entries(body.values).some(([k,v])=>!/^teacher_workspace_v1(?:_[a-zA-Z0-9_]+)?$/.test(k)||typeof v!=='string'))return false;
 try {
  const d=JSON.parse(body.values.teacher_workspace_v1);
  return d.version===1&&Array.isArray(d.years)&&d.years.length>0&&d.years.every(y=>Number.isInteger(y)&&y>=2000&&y<=2200)&&['schools','students','counsel','contacts','notes','assessments','results','exams','tasks','subjectNotes'].every(k=>Array.isArray(d[k])&&d[k].length<=100000);
 }catch{return false;}
}
export function createHandler(store,publicDir){return async(req,res)=>{
 const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/healthz'&&req.method==='GET'){await store.health();return send(200,{ok:true});}
  if(url.pathname==='/api/state'){
   if(req.method==='GET')return send(200,await store.get());
   if(req.method!=='PUT')return send(405,{error:'Method not allowed'});
   if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Cross-site request rejected'});
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'Origin rejected'});
   if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});
   let size=0;const chunks=[];
   for await(const chunk of req){size+=chunk.length;if(size>25*1024*1024){send(413,{error:'Maximum 25 MB'});return;}chunks.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return send(400,{error:'Invalid JSON'});}
   if(!validState(body))return send(400,{error:'Invalid workspace data'});
   const result=await store.put(body.revision,body.values);
   return result?send(200,result):send(409,{error:'Revision conflict'});
  }
  const assets={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/cloud.js':['cloud.js','text/javascript']};
  if(req.method!=='GET'||!assets[url.pathname])return send(404,{error:'Not found'});
  const [name,type]=assets[url.pathname];const file=await readFile(path.join(publicDir,name));res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(file);
 }catch{console.error('Request failed');if(!res.headersSent)send(503,{error:'Server unavailable'});else res.end();}
};}
