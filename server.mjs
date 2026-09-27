import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export function createServer({url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY,fetcher=fetch}={}) {
  async function database(method='GET',body,revision) {
    if(!url||!key)throw Error('Supabase 환경 변수가 없습니다.');
    const endpoint=new URL('/rest/v1/teacher_workspace',url);
    endpoint.searchParams.set('id','eq.main');
    if(revision!==undefined)endpoint.searchParams.set('revision','eq.'+revision);
    const headers={apikey:key,'Content-Type':'application/json',Prefer:'return=representation'};
    if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
    const response=await fetcher(endpoint,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Supabase 연결 또는 테이블 설정을 확인하세요.');
    const rows=await response.json();
    if(!Array.isArray(rows))throw Error('데이터베이스 응답 오류');
    return rows;
  }
  return http.createServer(async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
    try {
      const pathname=new URL(req.url,'http://localhost').pathname;
      if(pathname==='/healthz'&&req.method==='GET')return send(200,{ok:true});
      if(pathname==='/api/state'&&req.method==='GET') {
        const rows=await database();
        if(rows.length!==1)throw Error('Supabase에서 schema.sql을 먼저 실행하세요.');
        return send(200,rows[0]);
      }
      if(pathname==='/api/state'&&req.method==='PUT') {
        if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'외부 사이트 요청 거부'});
        if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON 요청만 지원합니다.'});
        let size=0,chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>20*1024*1024)return send(413,{error:'자료가 20MB를 초과합니다.'});chunks.push(chunk);}
        let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{return send(400,{error:'잘못된 JSON'});}
        if(!Number.isSafeInteger(input.revision)||input.revision<0||input.revision>=Number.MAX_SAFE_INTEGER||!validPayload(input.payload))return send(400,{error:'자료 형식 오류'});
        const rows=await database('PATCH',{payload:input.payload,revision:input.revision+1,updated_at:new Date().toISOString()},input.revision);
        if(rows.length!==1)return send(409,{error:'다른 창에서 저장했습니다. 현재 자료를 백업한 후 최신 자료를 불러오세요.'});
        return send(200,{revision:rows[0].revision});
      }
      const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/cloud.js':'cloud.js','/robots.txt':'robots.txt'};
      if(req.method==='GET'&&files[pathname]) {
        const data=await readFile(new URL('./public/'+files[pathname],import.meta.url));
        res.writeHead(200,{'Content-Type':pathname.endsWith('.js')?'text/javascript; charset=utf-8':pathname.endsWith('.txt')?'text/plain; charset=utf-8':'text/html; charset=utf-8'});
        return res.end(data);
      }
      send(404,{error:'Not found'});
    } catch(e){console.error('Request failed:',e.message);send(503,{error:'서버 저장소 연결 실패. 환경 변수와 Supabase SQL 설정을 확인하세요.'});}
  });
}
export function validPayload(p){return !!p&&typeof p==='object'&&!Array.isArray(p)&&['years','schools','students','counsel','contacts','notes','assessments','results','exams','tasks','subjectNotes','reportDrafts'].every(k=>Array.isArray(p[k]));}
if(process.argv[1]===fileURLToPath(import.meta.url))createServer().listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Teacher workspace server ready'));
