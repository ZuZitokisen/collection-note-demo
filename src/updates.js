export const APP_VERSION = '0.5.7';
export const RELEASE_CHANGES = ["請求書を写真見本に合わせたB5縦へ変更", "PDFを直接保存、日別明細は必要時に選択", "対象月と発行日を別々に指定", "保存済みの報告・設定・履歴は保持"];
// Update only application shell files. This module never reads or writes report storage.
export function startUpdates({win=window,doc=document,guard=fn=>fn(),canReload=()=>true,reload=()=>win.location.reload(),recovery=false}={}) {
  const checkButton=doc.querySelector('#check-update'),applyButton=doc.querySelector('#apply-update'),status=doc.querySelector('#update-status'),notice=doc.querySelector('#update-notice');
  const sw=win.navigator.serviceWorker;let registration=null,checking=false,applying=false,controllerChanged=false,lastCheck=0,hadController=!!sw?.controller,availableVersion=null,availableChanges=[],hasUpdate=false;
  const panel=doc.querySelector('.app-updates');
  let toast=doc.querySelector('#update-toast');if(!toast){toast=doc.createElement('section');toast.id='update-toast';doc.body.append(toast);}
  toast.removeAttribute('role');toast.removeAttribute('aria-live');toast.setAttribute('aria-labelledby','update-toast-title');toast.hidden=true;
  const toastHeader=doc.createElement('div');toastHeader.className='update-toast-header';
  const toastTitle=doc.createElement('h2');toastTitle.id='update-toast-title';toastTitle.textContent='更新内容';
  const toastClose=doc.createElement('button');toastClose.type='button';toastClose.className='update-toast-close';toastClose.textContent='閉じる';toastClose.setAttribute('aria-label','更新内容を閉じる');
  const toastBody=doc.createElement('div');toastBody.className='update-toast-body';toastBody.tabIndex=0;toastBody.setAttribute('role','status');toastBody.setAttribute('aria-live','polite');toastBody.setAttribute('aria-atomic','true');toastBody.setAttribute('aria-label','更新内容の詳細');
  toastHeader.append(toastTitle,toastClose);toast.replaceChildren(toastHeader,toastBody);
  toastClose.addEventListener('click',()=>{const restoreFocus=toast.contains(doc.activeElement);toast.hidden=true;toast.classList.remove('visible');if(restoreFocus)checkButton?.focus();});
  // Release notes stay readable until dismissed; never steal focus from input.
  const flash=(text,state)=>{toastBody.textContent=text;toast.dataset.state=state;toast.hidden=false;toast.classList.add('visible');};
  const buttonState=state=>{if(!checkButton)return;checkButton.dataset.state=state;checkButton.classList.toggle('update-ready',hasUpdate);checkButton.textContent=state==='checking'?'確認中…':hasUpdate?'更新あり':state==='error'?'更新を再確認':'更新';checkButton.setAttribute('aria-label',hasUpdate?'新しい版があります。変更内容を確認':'アプリの更新を確認');};
  const changeText=(version,changes)=>`v${version} の変更内容\n${changes.length?changes.map(x=>'・'+x).join('\n'):'変更内容の詳細は取得できませんでした。'}`;
  try{const applied=win.sessionStorage.getItem('collection-note-applied-version');if(applied){win.sessionStorage.removeItem('collection-note-applied-version');if(applied===APP_VERSION)flash('更新しました。\n'+changeText(APP_VERSION,RELEASE_CHANGES),'applied');}}catch{}
  const say=text=>{if(status)status.textContent=text;};
  const ready=()=>{hasUpdate=true;buttonState('ready');if(panel)panel.hidden=false;if(notice)notice.hidden=false;if(applyButton)applyButton.hidden=false;say('新しい版の準備ができました。保存済みデータを残して更新できます。');};
  const doReload=()=>{applying=false;if(canReload()){try{win.sessionStorage.setItem('collection-note-applied-version',availableVersion||APP_VERSION);}catch{}reload();}else{ready();say('新しい版の準備ができました。入力中の内容を保存してから更新してください。');}};
  const waitInstall=worker=>new Promise((resolve,reject)=>{if(!worker)return resolve();let timer;const done=()=>{if(['installed','activated','redundant'].includes(worker.state)){worker.removeEventListener('statechange',done);win.clearTimeout(timer);worker.state==='redundant'?reject(new Error('新版を取得できませんでした。')):resolve();}};worker.addEventListener('statechange',done);timer=win.setTimeout(()=>{worker.removeEventListener('statechange',done);reject(new Error('更新準備が完了しませんでした。'));},15000);done();});
  const workerVersion=()=>new Promise(resolve=>{if(!sw?.controller||!win.MessageChannel)return resolve(null);const channel=new win.MessageChannel();const timer=win.setTimeout(()=>{channel.port1.close();resolve(null);},1500);channel.port1.onmessage=e=>{win.clearTimeout(timer);channel.port1.close();resolve(e.data?.version??null);};sw.controller.postMessage({type:'GET_VERSION'},[channel.port2]);});
  const ensureRegistration=async()=>{if(!registration){registration=await sw.register('./sw.js',{updateViaCache:'none'});registration.addEventListener('updatefound',()=>{const worker=registration.installing;if(worker)waitInstall(worker).then(()=>{if(registration.waiting)ready();}).catch(()=>say('新しい版の取得に失敗しました。今の画面と保存データは残っています。'));});if(registration.waiting)ready();}return registration;};
  async function check({manual=false}={}) {
    if(checking)return;if(!manual&&Date.now()-lastCheck<60000)return;lastCheck=Date.now();checking=true;if(checkButton)checkButton.disabled=true;buttonState('checking');say('公開中の版と接続を確認しています…');if(manual)flash('更新を確認しています…','checking');
    try{
      if(!sw)throw new Error('この環境ではアプリ内更新を利用できません。');
      const response=await win.fetch('./version.json?check='+Date.now(),{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error('公開先へ接続できません。');const data=await response.json();if(typeof data.version!=='string'||!/^\d+\.\d+\.\d+$/.test(data.version))throw new Error('公開版を確認できません。');
      availableVersion=data.version;availableChanges=Array.isArray(data.changes)?data.changes.filter(x=>typeof x==='string').slice(0,12).map(x=>x.slice(0,180)):(data.version===APP_VERSION?RELEASE_CHANGES:[]);
      const reg=await ensureRegistration();await reg.update();await waitInstall(reg.installing);
      if(reg.waiting){ready();if(manual)flash('更新できます。まだ適用していません。\n'+changeText(availableVersion,availableChanges),'ready');return;}
      const active=await workerVersion();
      if(controllerChanged||(active&&active!==APP_VERSION)||recovery){ready();if(manual)flash('新しい画面へ切り替えられます。\n'+changeText(availableVersion,availableChanges),'ready');return;}
      if(data.version!==APP_VERSION)throw new Error('新しい版がありますが、準備を完了できませんでした。少し後で更新を確認してください。');
      hasUpdate=false;buttonState('current');if(notice)notice.hidden=true;if(applyButton)applyButton.hidden=true;if(panel)panel.hidden=true;if(manual)flash('最新です。更新は不要です。\n'+changeText(APP_VERSION,RELEASE_CHANGES),'current');
      say(`表示中 v${APP_VERSION} は公開中の版と一致しています。保存データは変更していません。`);
    }catch(error){buttonState('error');if(manual)flash('更新を確認できませんでした。保存データは残っています。\n'+error.message,'error');say(`${error.message} 今の画面と保存データは残しています。通信を確認してもう一度お試しください。`);}
    finally{checking=false;if(checkButton)checkButton.disabled=false;}
  }
  function apply(){if(applying)return;guard(async()=>{if(!canReload())return;applying=true;try{const reg=await ensureRegistration();if(!reg.waiting&&!controllerChanged&&!recovery){const active=await workerVersion();if(!active||active===APP_VERSION){applying=false;await check({manual:true});return;}}if(reg.waiting){say('更新を適用しています…');flash('更新を適用しています…','applying');reg.waiting.postMessage({type:'SKIP_WAITING'});win.setTimeout(()=>{if(applying){applying=false;ready();say('適用を確認できませんでした。データを消さず、更新を確認し直してください。');flash('適用を確認できませんでした。データを消さず、更新を確認し直してください。','error');}},15000);}else doReload();}catch{applying=false;say('更新を適用できませんでした。保存データは変更していません。');flash('更新を適用できませんでした。保存データは変更していません。','error');}});}
  checkButton?.addEventListener('click',()=>check({manual:true}));applyButton?.addEventListener('click',apply);
  if(sw){sw.addEventListener('controllerchange',()=>{const first=!hadController;hadController=true;if(first&&!recovery)return;controllerChanged=true;if(applying)doReload();else ready();});doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')check();});win.addEventListener('online',()=>check());ensureRegistration().then(()=>check()).catch(()=>say('更新機能を開始できませんでした。今の画面と保存データは残っています。'));}
  else say('この環境ではアプリ内更新を利用できません。');
  return {check,apply};
}
