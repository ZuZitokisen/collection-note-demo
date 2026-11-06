export const APP_VERSION = '0.5.3';
// Update only application shell files. This module never reads or writes report storage.
export function startUpdates({win=window,doc=document,guard=fn=>fn(),canReload=()=>true,reload=()=>win.location.reload(),recovery=false}={}) {
  const checkButton=doc.querySelector('#check-update'),applyButton=doc.querySelector('#apply-update'),status=doc.querySelector('#update-status'),notice=doc.querySelector('#update-notice');
  const sw=win.navigator.serviceWorker;let registration=null,checking=false,applying=false,controllerChanged=false,lastCheck=0,hadController=!!sw?.controller;
  const say=text=>{if(status)status.textContent=text;};
  const ready=()=>{if(notice)notice.hidden=false;if(applyButton)applyButton.hidden=false;say('新しい版の準備ができました。保存済みデータを残して更新できます。');};
  const doReload=()=>{applying=false;if(canReload())reload();else{ready();say('新しい版の準備ができました。入力中の内容を保存してから更新してください。');}};
  const waitInstall=worker=>new Promise((resolve,reject)=>{if(!worker)return resolve();let timer;const done=()=>{if(['installed','activated','redundant'].includes(worker.state)){worker.removeEventListener('statechange',done);win.clearTimeout(timer);worker.state==='redundant'?reject(new Error('新版を取得できませんでした。')):resolve();}};worker.addEventListener('statechange',done);timer=win.setTimeout(()=>{worker.removeEventListener('statechange',done);reject(new Error('更新準備が完了しませんでした。'));},15000);done();});
  const workerVersion=()=>new Promise(resolve=>{if(!sw?.controller||!win.MessageChannel)return resolve(null);const channel=new win.MessageChannel();const timer=win.setTimeout(()=>{channel.port1.close();resolve(null);},1500);channel.port1.onmessage=e=>{win.clearTimeout(timer);channel.port1.close();resolve(e.data?.version??null);};sw.controller.postMessage({type:'GET_VERSION'},[channel.port2]);});
  const ensureRegistration=async()=>{if(!registration){registration=await sw.register('./sw.js',{updateViaCache:'none'});registration.addEventListener('updatefound',()=>{const worker=registration.installing;if(worker)waitInstall(worker).then(()=>{if(registration.waiting)ready();}).catch(()=>say('新しい版の取得に失敗しました。今の画面と保存データは残っています。'));});if(registration.waiting)ready();}return registration;};
  async function check({manual=false}={}) {
    if(checking)return;if(!manual&&Date.now()-lastCheck<60000)return;lastCheck=Date.now();checking=true;if(checkButton)checkButton.disabled=true;say('公開中の版と接続を確認しています…');
    try{
      if(!sw)throw new Error('この環境ではアプリ内更新を利用できません。');
      const response=await win.fetch('./version.json?check='+Date.now(),{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error('公開先へ接続できません。');const data=await response.json();if(typeof data.version!=='string')throw new Error('公開版を確認できません。');
      const reg=await ensureRegistration();await reg.update();await waitInstall(reg.installing);
      if(reg.waiting){ready();return;}
      const active=await workerVersion();
      if(controllerChanged||(active&&active!==APP_VERSION)||recovery){ready();return;}
      if(data.version!==APP_VERSION)throw new Error('新しい版がありますが、準備を完了できませんでした。少し後で更新を確認してください。');
      say(`表示中 v${APP_VERSION} は公開中の版と一致しています。保存データは変更していません。`);
    }catch(error){say(`${error.message} 今の画面と保存データは残しています。通信を確認してもう一度お試しください。`);}
    finally{checking=false;if(checkButton)checkButton.disabled=false;}
  }
  function apply(){if(applying)return;guard(async()=>{if(!canReload())return;applying=true;try{const reg=await ensureRegistration();if(!reg.waiting&&!controllerChanged&&!recovery){const active=await workerVersion();if(!active||active===APP_VERSION){applying=false;await check({manual:true});return;}}if(reg.waiting){say('更新を適用しています…');reg.waiting.postMessage({type:'SKIP_WAITING'});win.setTimeout(()=>{if(applying){applying=false;ready();say('適用を確認できませんでした。データを消さず、更新を確認し直してください。');}},15000);}else doReload();}catch{applying=false;say('更新を適用できませんでした。保存データは変更していません。');}});}
  checkButton?.addEventListener('click',()=>check({manual:true}));applyButton?.addEventListener('click',apply);
  if(sw){sw.addEventListener('controllerchange',()=>{const first=!hadController;hadController=true;if(first&&!recovery)return;controllerChanged=true;if(applying)doReload();else ready();});doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')check();});win.addEventListener('online',()=>check());ensureRegistration().then(()=>check()).catch(()=>say('更新機能を開始できませんでした。今の画面と保存データは残っています。'));}
  else say('この環境ではアプリ内更新を利用できません。');
  return {check,apply};
}
