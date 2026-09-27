import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../public/cloud.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function storage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}
function setup(remote,fail=false){
  const elements=[],callbacks=[],localStorage=storage(),sessionStorage=storage();let writes=0;
  const element=()=>{const e={style:{},hidden:false,append(){},setAttribute(){}};elements.push(e);return e;};
  const main=element(),aside=element();
  const context={console,AbortSignal,URL,Blob,localStorage,sessionStorage,confirm:()=>true,location:{reload(){}},addEventListener(){},clearTimeout(){},setTimeout:fn=>{callbacks.push(fn);return callbacks.length;},document:{createElement:element,querySelector:s=>s==='main'?main:aside,body:{prepend(){},append:e=>e.onload()}},fetch:async(_url,options)=>{
    if(options.method==='PUT'){writes++;if(fail)return Response.json({error:'conflict'},{status:409});return Response.json({revision:remote.revision+1});}
    return Response.json(remote);
  }};
  context.window=context;
  return {context,elements,callbacks,localStorage,sessionStorage,main,writes:()=>writes};
}
test('loads server state before app, saves queued edits, clears pending on success',async()=>{
  const s=setup({revision:3,payload:{students:[]}});vm.runInNewContext(code,s.context);await tick();
  assert.equal(s.localStorage.getItem('teacher_workspace_v1'),'{"students":[]}');assert.equal(s.main.hidden,false);
  s.context.cloudSave('{"students":[1]}');assert.ok(s.sessionStorage.getItem('teacher-cloud-pending-v1'));
  await s.callbacks.pop()();await tick();assert.equal(s.writes(),1);assert.equal(s.sessionStorage.getItem('teacher-cloud-pending-v1'),null);
});
test('409 preserves pending edits and blocks further overwrite',async()=>{
  const s=setup({revision:1,payload:{}},true);vm.runInNewContext(code,s.context);await tick();s.context.cloudSave('{"students":[1]}');await s.callbacks.pop()();await tick();
  assert.ok(s.sessionStorage.getItem('teacher-cloud-pending-v1'));assert.throws(()=>s.context.cloudSave('{}'),/충돌/);
});
test('reload with conflicting unsent data does not start app or discard edits',async()=>{
  const s=setup({revision:2,payload:{}});s.sessionStorage.setItem('teacher-cloud-pending-v1',JSON.stringify({revision:1,value:'{"students":[1]}'}));
  vm.runInNewContext(code,s.context);await tick();assert.equal(s.main.hidden,true);assert.ok(s.sessionStorage.getItem('teacher-cloud-pending-v1'));assert.equal(s.writes(),0);
});
