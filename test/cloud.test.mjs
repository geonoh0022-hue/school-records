import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../public/cloud.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function storage(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}
function setup({local=storage(),online=true,revision=0,payload=null}={}){
 let remote={revision,payload},writes=0;const timers=[],events={},elements=[];
 const element=()=>{const e={style:{},hidden:false,append(){},setAttribute(){}};elements.push(e);return e;};
 const main=element(),aside=element();
 const c={console,AbortSignal,URL,Blob,localStorage:local,sessionStorage:storage(),confirm:()=>true,location:{reload(){}},navigator:{onLine:online,locks:{request:(_n,_o,fn)=>{void fn({});}}},addEventListener:(n,fn)=>events[n]=fn,setInterval(){},clearTimeout(){},setTimeout:fn=>{timers.push(fn);return timers.length;},document:{createElement:element,querySelector:s=>s==='main'?main:aside,body:{prepend(){},append:e=>e.onload()}},fetch:async(_url,o)=>{
 if(o.method==='PUT'){writes++;const b=JSON.parse(o.body);if(b.revision!==remote.revision)return Response.json({error:'conflict'},{status:409});remote={revision:remote.revision+1,payload:b.payload};return Response.json({revision:remote.revision});}return Response.json(remote);
 }};c.window=c;vm.runInNewContext(code,c);
 return {c,local,main,events,elements,timers,writes:()=>writes,remote:()=>remote};
}
test('offline edits survive closing/reopening; reconnect uploads',async()=>{
 const first=setup({payload:{students:[]},revision:2});await tick();
 first.c.navigator.onLine=false;first.c.cloudSave('{"students":[1]}');
 const next=setup({local:first.local,online:false,revision:2,payload:{students:[]}});await tick();
 assert.equal(next.main.hidden,false);assert.equal(JSON.parse(next.local.getItem('teacher-offline-v2')).pending,true);
 next.c.navigator.onLine=true;await next.events.online();await tick();assert.deepEqual(next.remote().payload,{students:[1]});assert.equal(JSON.parse(next.local.getItem('teacher-offline-v2')).pending,false);
});
test('remote conflict preserves local data without overwriting server',async()=>{
 const first=setup({revision:1,payload:{students:[]}});await tick();first.c.navigator.onLine=false;first.c.cloudSave('{"students":[1]}');
 const next=setup({local:first.local,revision:2,payload:{students:[2]}});await tick();
 assert.equal(next.writes(),0);assert.equal(next.main.hidden,false);assert.equal(JSON.parse(next.local.getItem('teacher-offline-v2')).value,'{"students":[1]}');
 assert.ok(next.elements.some(e=>e.textContent?.includes('충돌')));
});
test('first offline visit cannot create a replacement empty database',async()=>{
 const s=setup({online:false});await tick();assert.equal(s.main.hidden,true);assert.equal(s.writes(),0);assert.equal(s.local.getItem('teacher-offline-v2'),null);
});
test('lost acknowledgement reconciles despite JSON key order',async()=>{
 const local=storage();local.setItem('teacher-offline-v2',JSON.stringify({revision:1,value:'{"b":2,"a":1}',pending:true}));
 const s=setup({local,revision:2,payload:{a:1,b:2}});await tick();assert.equal(s.writes(),0);assert.equal(JSON.parse(local.getItem('teacher-offline-v2')).pending,false);
});
