import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const setupError=(code,message)=>Object.assign(new Error(message),{publicCode:code});

export function createServer({url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY,fetcher=fetch}={}) {
  async function database(method='GET',body,revision) {
    const cleanUrl=url?.trim(),cleanKey=key?.trim();
    if(!cleanUrl||!cleanKey)throw setupError('CONFIG_MISSING','Render Environment에 SUPABASE_URL과 SUPABASE_SECRET_KEY를 입력하고 재배포하세요.');
    let endpoint;
    try{const base=new URL(cleanUrl);if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error();endpoint=new URL('/rest/v1/teacher_workspace',base);}catch{throw setupError('URL_INVALID','SUPABASE_URL에는 https://프로젝트ID.supabase.co 형식의 프로젝트 URL만 입력하세요. 대시보드 주소나 postgres 연결 문자열은 사용할 수 없습니다.');}
    if(cleanKey.startsWith('sb_publishable_'))throw setupError('KEY_TYPE','SUPABASE_SECRET_KEY에는 publishable 키가 아니라 sb_secret_로 시작하는 Secret key를 입력하세요.');
    endpoint.searchParams.set('id','eq.main');
    if(revision!==undefined)endpoint.searchParams.set('revision','eq.'+revision);
    const headers={apikey:cleanKey,'Content-Type':'application/json',Prefer:'return=representation'};
    if(!cleanKey.startsWith('sb_secret_'))headers.Authorization='Bearer '+cleanKey;
    let response;
    try{response=await fetcher(endpoint,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});}catch{throw setupError('NETWORK','Supabase 서버에 연결할 수 없습니다. 프로젝트 URL, 프로젝트 일시 중지 여부, 네트워크를 확인하세요.');}
    if(!response.ok){
      const detail=await response.json().catch(()=>({}));
      if(detail.code==='PGRST205'||detail.code==='42P01')throw setupError('TABLE_MISSING','teacher_workspace 테이블을 찾지 못했습니다. 같은 Supabase 프로젝트의 SQL Editor에서 supabase/schema.sql 전체를 실행하세요.');
      if(detail.code==='42501')throw setupError('DB_PERMISSION','테이블 접근 권한이 없습니다. Secret key 또는 service_role 키를 사용하고 schema.sql을 다시 실행하세요.');
      if(response.status===401||response.status===403)throw setupError('KEY_REJECTED','Supabase가 API 키를 거부했습니다. URL과 키가 같은 프로젝트인지, Secret key 또는 service_role 키인지 확인하세요.');
      if(response.status===404)throw setupError('API_NOT_FOUND','Supabase REST API를 찾지 못했습니다. 프로젝트 URL과 Data API 활성화 여부를 확인하세요.');
      throw setupError('UPSTREAM_'+response.status,'Supabase 응답 오류 (HTTP '+response.status+'). 프로젝트 상태와 SQL 테이블 구조를 확인하세요.');
    }
    const rows=await response.json().catch(()=>null);
    if(!Array.isArray(rows))throw setupError('RESPONSE_INVALID','Supabase 자료 응답이 올바르지 않습니다. 프로젝트 URL과 Data API 설정을 확인하세요.');
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
        if(rows.length!==1)throw setupError('ROW_MISSING','초기 main 자료 행을 읽을 수 없습니다. schema.sql 전체를 실행하고 서버 전용 Secret key를 사용하세요.');
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
      const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/cloud.js':'cloud.js','/sw.js':'sw.js','/robots.txt':'robots.txt'};
      if(req.method==='GET'&&files[pathname]) {
        const data=await readFile(new URL('./public/'+files[pathname],import.meta.url));
        res.writeHead(200,{'Content-Type':pathname.endsWith('.js')?'text/javascript; charset=utf-8':pathname.endsWith('.txt')?'text/plain; charset=utf-8':'text/html; charset=utf-8'});
        return res.end(data);
      }
      send(404,{error:'Not found'});
    } catch(e){const code=e.publicCode||'INTERNAL';console.error('Request failed:',code);send(503,{code,error:e.publicCode?e.message:'서버 내부 오류가 발생했습니다. Render 로그를 확인하세요.'});}
  });
}
export function validPayload(p){return !!p&&typeof p==='object'&&!Array.isArray(p)&&['years','schools','students','counsel','contacts','notes','assessments','results','exams','tasks','subjectNotes','reportDrafts'].every(k=>Array.isArray(p[k]));}
if(process.argv[1]===fileURLToPath(import.meta.url))createServer().listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Teacher workspace server ready'));

