import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('service worker caches entire shell and serves it offline without caching API',async()=>{
 const events={},saved=new Map();const cache={addAll:async paths=>{paths.forEach(p=>saved.set(p,'cached:'+p));},match:async p=>saved.get(p)};
 const self={location:{origin:'https://test.local'},clients:{claim:async()=>{}},addEventListener:(n,f)=>events[n]=f};
 vm.runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL,caches:{open:async()=>cache,keys:async()=>[],delete:async()=>{}},fetch:()=>{throw Error('offline');}});
 let waiting;events.install({waitUntil:p=>waiting=p});await waiting;
 for(const p of ['/','/index.html','/app.js','/cloud.js']){let result;events.fetch({request:{method:'GET',url:'https://test.local'+p},respondWith:r=>result=r});assert.equal(await result,'cached:'+p);}
 let handled=false;events.fetch({request:{method:'GET',url:'https://test.local/api/state'},respondWith:()=>handled=true});assert.equal(handled,false);
});
