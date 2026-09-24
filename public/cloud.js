'use strict';
(async () => {
  let values={}, revision=0, generation=0, saved=0, busy=false, conflict=false, timer;
  const status=document.querySelector('#cloudStatus');
  const retry=document.querySelector('#cloudRetry');
  const backup=document.querySelector('#cloudBackup');
  function display(message) {
    status.textContent=message; backup.hidden=generation===saved;
    document.querySelector('#cloudBar').dataset.state=/실패|다른 창|못했습니다|timeout|aborted/i.test(message)?'error':/중/.test(message)?'pending':'saved';
  }
  function download() {
    const url=URL.createObjectURL(new Blob([values.teacher_workspace_v1||'{}'],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='교무수첩_서버복구백업.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  backup.onclick=download;
  document.querySelector('#cloudReload').onclick=()=>{if(generation!==saved&&!confirm('서버에 저장하지 못한 변경이 있습니다. 먼저 다운로드하세요. 현재 변경을 버리고 새로고침할까요?'))return; saved=generation;location.reload();};
  window.addEventListener('beforeunload',e=>{if(generation!==saved){e.preventDefault();e.returnValue='';}});
  async function flush() {
    if(busy||conflict||generation===saved)return;
    busy=true; const target=generation;
    display('서버에 저장 중…');retry.hidden=true;
    try {
      const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,values}),signal:AbortSignal.timeout(25000)});
      if(response.status===409){conflict=true;throw Error('다른 창에서 자료가 변경되었습니다. 미저장 자료를 다운로드하고 최신 자료를 불러오세요.');}
      if(!response.ok)throw Error('서버 저장 실패. 연결을 확인하고 다시 저장하세요.');
      const result=await response.json();revision=result.revision;saved=target;
      display('서버 저장 완료 · '+new Date().toLocaleTimeString('ko-KR'));
      const el=document.querySelector('#saveIndicator');if(el)el.textContent='서버 저장 완료';
    } catch(error) {display(error.message);retry.hidden=conflict;} finally {busy=false;}
    if(generation!==saved&&retry.hidden&&!conflict)timer=setTimeout(flush,100);
  }
  retry.onclick=flush;
  window.addEventListener('online',flush);
  try {
    const response=await fetch('/api/state',{cache:'no-store',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error('서버 연결 실패');
    const state=await response.json();values=state.values;revision=state.revision;
    const storage={
      getItem:key=>Object.hasOwn(values,key)?values[key]:null,
      setItem(key,value){value=String(value);if(values[key]===value)return;values[key]=value;changed();},
      removeItem(key){if(!Object.hasOwn(values,key))return;delete values[key];changed();}
    };
    function changed(){generation++;display('서버 저장 대기 중…');clearTimeout(timer);timer=setTimeout(flush,350);}
    window.startWorkspace(storage);
    document.querySelector('main').inert=false;
    if(!generation)display('서버 자료 불러오기 완료');
  } catch(error) { display('앱을 열지 못했습니다. 서버 및 DATABASE_URL 설정을 확인하고 최신 자료 불러오기를 누르세요.');console.error(error); }
})();
