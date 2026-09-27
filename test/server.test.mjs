import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';

test('load/save, conflict protection, validation, secrets and static files',async()=>{
  let row={id:'main',revision:0,payload:null};
  const server=createServer({url:'https://example.supabase.co',key:'sb_secret_TEST',fetcher:async(url,options)=>{
    assert.equal(options.headers.apikey,'sb_secret_TEST');
    assert.equal(options.headers.Authorization,undefined);
    if(options.method==='PATCH'){
      if(url.searchParams.get('revision')!=='eq.'+row.revision)return Response.json([]);
      row={...row,...JSON.parse(options.body)};
    }
    return Response.json([row]);
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const put=body=>fetch(base+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try{
    assert.equal((await (await fetch(base+'/api/state')).json()).revision,0);
    const payload=Object.fromEntries(['years','schools','students','counsel','contacts','notes','assessments','results','exams','tasks','subjectNotes','reportDrafts'].map(k=>[k,[]]));
    payload.students.push({id:'test',name:'시험 학생'});
    assert.equal((await put({revision:0,payload})).status,200);
    assert.equal((await put({revision:0,payload})).status,409);
    assert.deepEqual((await (await fetch(base+'/api/state')).json()).payload,payload);
    assert.equal((await put({revision:1,payload:{}})).status,400);
    assert.equal((await fetch(base+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json','Sec-Fetch-Site':'cross-site'},body:'{}'})).status,403);
    for(const file of ['/','/.env','/server.mjs','/app.js','/cloud.js']){
      const r=await fetch(base+file),text=await r.text();
      assert.equal(r.status,file==='/.env'||file==='/server.mjs'?404:200);
      assert.ok(!text.includes('sb_secret_TEST'));
    }
    const results=await Promise.all([put({revision:1,payload}),put({revision:1,payload})]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  }finally{await new Promise(r=>server.close(r));}
});
test('missing configuration returns a storage failure',async()=>{
  const server=createServer({url:'',key:''});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{assert.equal((await fetch('http://127.0.0.1:'+server.address().port+'/api/state')).status,503);}
  finally{await new Promise(r=>server.close(r));}
});
