'use strict';
(() => {
  const KEY='teacher_workspace_v1', STORE='teacher-offline-v2';
  let state, busy=false, conflict=false, timer, started=false;
  const main=document.querySelector('main'), aside=document.querySelector('aside');
  main.hidden=true;if(aside)aside.hidden=true;
  const bar=document.createElement('section');
  bar.style.cssText='position:sticky;top:0;z-index:1000;background:#fff0e6;padding:10px;display:flex;gap:10px;flex-wrap:wrap';
  const status=document.createElement('span');status.setAttribute('role','status');bar.append(status);
  function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;bar.append(b);return b;}
  const retry=button('연결 / 저장 재시도',()=>sync());
  const backup=button('이 기기 자료 백업',()=>{if(!state?.value)return;const u=URL.createObjectURL(new Blob([state.value],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='교무수첩_오프라인백업.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});
  const latest=button('서버 자료 불러오기',async()=>{
    if(busy)return;
    if(state?.pending&&!confirm('이 기기의 미전송 자료를 교체합니다. 필요한 자료를 JSON으로 백업했나요?'))return;
    busy=true;
    try{const r=await request();store({revision:r.revision,value:r.payload?JSON.stringify(r.payload):null,pending:false});location.reload();}
    catch(e){show(e.message);}finally{busy=false;}
  });
  document.body.prepend(bar);
  function show(text=''){bar.hidden=!text;status.textContent=text;backup.hidden=!state?.value;latest.hidden=!conflict;retry.hidden=!started;}
  function store(next){localStorage.setItem(STORE,JSON.stringify(next));state=next;}
  function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
  async function request(options){
    if(navigator.onLine===false)throw Error('오프라인 · 이 기기에 저장됩니다. 인터넷 연결 후 자동 전송합니다.');
    const r=await fetch('/api/state',{cache:'no-store',...options,signal:AbortSignal.timeout(12000)});
    const data=await r.json();if(!r.ok){const e=Error(data.error||'서버 연결 실패');e.status=r.status;throw e;}return data;
  }
  function collision(){conflict=true;show('다른 기기의 변경과 충돌했습니다. 이 기기 자료를 백업한 후 서버 자료를 불러와 필요한 내용을 반영하세요.');}
  async function sync(){
    if(busy||conflict||!state)return;
    busy=true;
    try{
      // Read first: also handles a successful write whose response was lost.
      const remote=await request();
      if(state.pending){
        if(canonical(remote.payload)===canonical(JSON.parse(state.value))){store({...state,revision:remote.revision,pending:false});}
        else if(remote.revision!==state.revision){collision();return;}
        else {
          const sending=state.value;
          const r=await request({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision,payload:JSON.parse(sending)})});
          store({...state,revision:r.revision,pending:state.value!==sending});
        }
      } else if(remote.revision!==state.revision){
        show('서버에 새 자료가 있습니다. 편집 전에 새로고침하세요.');return;
      }
      show();
      if(state.pending)timer=setTimeout(sync,500);
    }catch(e){if(e.status===409)collision();else show(e.message+' · 미전송 자료는 이 기기에 보관됩니다.');}
    finally{busy=false;}
  }
  window.cloudSave=value=>{
    if(!state)throw Error('자료가 준비되지 않았습니다.');
    if(value!==state.value)store({...state,value,pending:true});
    if(conflict){collision();return;}
    if(navigator.onLine===false)show('오프라인 · 이 기기에 저장됩니다. 연결 후 자동 전송합니다.');
    clearTimeout(timer);timer=setTimeout(sync,500);
  };
  async function start(){
    show('자료를 불러오는 중…');
    try{
      const raw=localStorage.getItem(STORE);if(raw){state=JSON.parse(raw);if(!Number.isSafeInteger(state.revision)||!(state.value===null||typeof state.value==='string'))throw Error('기기 저장 자료를 읽지 못했습니다. 브라우저 자료를 삭제하지 마세요.');}
      // Preserve unsent data from the previous deployment, if this tab has it.
      if(!state){const old=sessionStorage.getItem('teacher-cloud-pending-v1');if(old){const p=JSON.parse(old);store({revision:p.revision,value:p.value,pending:true});sessionStorage.removeItem('teacher-cloud-pending-v1');}}
      try{
        const remote=await request();
        if(!state?.pending)store({revision:remote.revision,value:remote.payload?JSON.stringify(remote.payload):null,pending:false});
        else if(canonical(remote.payload)===canonical(JSON.parse(state.value)))store({...state,revision:remote.revision,pending:false});
        else if(remote.revision!==state.revision)conflict=true;
      }catch(e){if(!state)throw e;show(e.message);}
      if(state.value)localStorage.setItem(KEY,state.value);else localStorage.removeItem(KEY);
      const app=document.createElement('script');app.src='/app.js';
      app.onload=()=>{started=true;main.hidden=false;if(aside)aside.hidden=false;if(conflict)collision();else if(navigator.onLine===false)show('오프라인 · 이 기기에 저장됩니다. 연결 후 자동 전송합니다.');else void sync();};
      app.onerror=()=>show('앱 화면을 불러오지 못했습니다. 온라인에서 다시 접속하세요.');document.body.append(app);
    }catch(e){show(e.message+' 처음 한 번은 온라인에서 접속해야 합니다.');}
  }
  addEventListener('online',()=>sync());
  addEventListener('offline',()=>show('오프라인 · 이 기기에 저장됩니다. 연결 후 자동 전송합니다.'));
  setInterval(()=>{if(started&&!conflict)void sync();},30000);
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{if(!localStorage.getItem('teacher-offline-ready-v1')){localStorage.setItem('teacher-offline-ready-v1','1');alert('오프라인 사용 준비가 완료되었습니다. 다음부터 인터넷 없이도 이 주소를 열 수 있습니다.');}}).catch(()=>show('오프라인 화면 준비 실패. 온라인에서 새로고침하세요.'));
  // One editing tab per device avoids local queue races; other devices use revision checks.
  if(navigator.locks)navigator.locks.request('teacher-workspace-editor',{ifAvailable:true},async lock=>{
    if(!lock){show('이 기기의 다른 창에서 교무수첩이 열려 있습니다. 그 창을 닫고 새로고침하세요.');return;}
    await start();await new Promise(()=>{});
  });else show('이 브라우저는 오프라인 저장 잠금을 지원하지 않습니다. 최신 Edge 또는 Chrome을 사용하세요.');
})();
