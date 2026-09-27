'use strict';
(() => {
  const KEY='teacher_workspace_v1', PENDING='teacher-cloud-pending-v1';
  let revision=0, pending=null, busy=false, blocked=false, timer;
  const bar=document.createElement('section');
  bar.style.cssText='position:sticky;top:0;z-index:1000;background:#edf3ee;border-bottom:1px solid #b8c9be;padding:8px 16px;font:14px/1.6 sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
  const status=document.createElement('span');status.setAttribute('role','status');bar.append(status);
  const retry=document.createElement('button');retry.textContent='저장 재시도';retry.hidden=true;bar.append(retry);
  const backup=document.createElement('button');backup.textContent='미전송 자료 JSON 다운로드';backup.hidden=true;bar.append(backup);
  const reload=document.createElement('button');reload.textContent='서버 자료 다시 불러오기';reload.hidden=true;bar.append(reload);
  document.body.prepend(bar);
  const main=document.querySelector('main'),aside=document.querySelector('aside');
  main.hidden=true;if(aside)aside.hidden=true;
  function message(text,error=false,loading=false){status.textContent=text;bar.hidden=!error&&!loading;bar.style.background=error?'#fff0e6':'#edf3ee';}
  function controls(){backup.hidden=!pending;retry.hidden=!pending||blocked;reload.hidden=false;}
  backup.onclick=()=>{if(!pending)return;const url=URL.createObjectURL(new Blob([pending.value],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='교무수첩_미전송백업.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  reload.onclick=()=>{if(pending&&!confirm('미전송 변경을 버리고 서버 자료를 불러옵니다. 필요한 JSON 백업을 다운로드했나요?'))return;sessionStorage.removeItem(PENDING);pending=null;location.reload();};
  async function request(options){const r=await fetch('/api/state',{cache:'no-store',...options,signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok){const e=Error(data.error||'서버 연결 실패');e.status=r.status;throw e;}return data;}
  async function flush(){
    if(!pending||busy||blocked)return;
    busy=true;const sending=pending;
    message('Supabase에 저장 중…');
    try {
      const result=await request({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,payload:JSON.parse(sending.value)})});
      revision=result.revision;
      if(pending===sending){pending=null;sessionStorage.removeItem(PENDING);message('Supabase 저장 완료 · '+new Date().toLocaleTimeString('ko-KR'));retry.hidden=true;backup.hidden=true;}
      else {pending.revision=revision;sessionStorage.setItem(PENDING,JSON.stringify(pending));}
    } catch(e){blocked=e.status===409;message((blocked?'저장 충돌: ':'서버 미저장: ')+e.message+' · 이 창의 자료를 JSON으로 백업할 수 있습니다.',true);controls();}
    finally{busy=false;}
    if(pending&&pending!==sending&&!blocked)void flush();
  }
  retry.onclick=()=>void flush();
  window.cloudSave=value=>{
    if(blocked)throw Error('서버 저장 충돌. 현재 자료를 백업하고 새로 불러오세요.');
    pending={value,revision};sessionStorage.setItem(PENDING,JSON.stringify(pending));
    message('브라우저 임시 저장 · 서버 전송 대기');backup.hidden=false;
    clearTimeout(timer);timer=setTimeout(flush,400);
  };
  addEventListener('beforeunload',e=>{if(pending){e.preventDefault();e.returnValue='';}});
  addEventListener('online',()=>void flush());
  async function boot(){
    message('자료를 불러오는 중…',false,true);
    try {
      const saved=sessionStorage.getItem(PENDING);if(saved)pending=JSON.parse(saved);
      const remote=await request();revision=remote.revision;
      if(pending){
        if(JSON.stringify(remote.payload)===pending.value){pending=null;sessionStorage.removeItem(PENDING);}
        else if(pending.revision!==revision){blocked=true;throw Error('미전송 자료와 서버 자료가 다릅니다. JSON 백업 후 서버 자료를 다시 불러오세요.');}
      }
      if(pending)localStorage.setItem(KEY,pending.value);
      else if(remote.payload)localStorage.setItem(KEY,JSON.stringify(remote.payload));
      else localStorage.removeItem(KEY);
      const app=document.createElement('script');app.src='/app.js';
      app.onload=()=>{main.hidden=false;if(aside)aside.hidden=false;if(pending)void flush();else message('Supabase 연결됨 · 주요 자료 자동 저장');};
      app.onerror=()=>message('앱 파일을 불러오지 못했습니다. 새로고침하세요.',true);
      document.body.append(app);
    }catch(e){message(e.message,true);controls();retry.hidden=true;}
  }
  void boot();
})();
