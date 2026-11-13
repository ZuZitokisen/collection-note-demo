import {safeStartupDiagnostic} from './workspace-client.js';
// This UI gate is not server authorization. Every real-data API needs its own checks.
export function createEntryGate({initialize, loadApp, prepareApp=null, online, show, open, prepare=()=>{}, close=()=>{}, isVisible=()=>true, waitUntilVisible=async()=>{}}) {
  let session, unsubscribe, attempt=0, identityEpoch=0, observedUid=null, checking=false, started=false, loading=false,visibilityVersion=0,cancelPreparation=null;
  const render = (message, canLogin=false, canRetry=true) => { if (!started) show({message,canLogin,canRetry}); };
  async function verify() {
    if (started || checking || !session?.state.user) return;
    if (!online()) { render('オンラインにして、もう一度確認してください。'); return; }
    const currentSession=session,currentAttempt=attempt,currentEpoch=identityEpoch,expectedUid=session.state.user.uid;
    const stillCurrent=()=>session===currentSession&&attempt===currentAttempt&&identityEpoch===currentEpoch&&session.state.status==='signed-in'&&session.state.user?.uid===expectedUid;
    checking=true;let preparedApp,retryVisible=false,preparation=null,cancelled=false;const visibleVersion=visibilityVersion;
    const preparationCurrent=()=>!cancelled&&stillCurrent()&&online()&&visibleVersion===visibilityVersion;
    const cancel=()=>{cancelled=true;void preparation?.then(value=>value?.dispose()).catch(()=>{});};
    cancelPreparation=cancel;
    render('Googleアカウントを確認しています…',false,false);
    try {
      await waitUntilVisible();if(!stillCurrent())throw new Error('identity unavailable');
      // Prepare raw data only, never the app DOM, while the independent entry
      // verification runs. API dispatch still requires its own verified token.
      if(prepareApp){preparation=Promise.resolve().then(()=>prepareApp({uid:expectedUid,isCurrent:preparationCurrent}));void preparation.catch(()=>{});}
      const identity=await currentSession.verifyIdentity();
      if (!identity || identity.uid!==expectedUid || !stillCurrent() || !online()) throw new Error('identity unavailable');
      if (!loading) {
        loading=true;
        render('画面を準備しています…',false,false);
        prepare();
        const startupRead=preparation?await preparation:null;
        await startupRead?.ready;
        if(!stillCurrent()||!online()||(preparation&&visibleVersion!==visibilityVersion))throw Object.assign(new Error('identity unavailable'),{code:'startup-session-changed'});
        preparedApp=await loadApp({startupRead});
        let preparedVisibility=visibleVersion;
        while(!isVisible()||preparedVisibility!==visibilityVersion){await waitUntilVisible();if(!stillCurrent())throw Object.assign(new Error('identity changed during preparation'),{code:'startup-session-changed'});const generation=visibilityVersion;await preparedApp?.reveal?.({expose:false});preparedVisibility=generation;}
        if(!stillCurrent()||!online())throw Object.assign(new Error('identity changed during preparation'),{code:'startup-session-changed'});
        open(preparedApp);
        started=true;
      }
    } catch (error) {
      const wasLoading=loading; preparedApp?.dispose?.();loading=false; close();
      const messages={
        WORKSPACE_NOT_ENABLED:'接続を準備中です。少し待って再試行してください。',
        'startup-session-changed':'読み込み中にログイン状態または接続が変わりました。もう一度確認してください。',
        'startup-seal':'社印の読み込みが完了しませんでした。ページを再読み込みしてください。（起動確認: SEAL）',
        'startup-storage':'端末内データの確認が完了しませんでした。データを削除せず、ページを再読み込みしてください。（起動確認: STORAGE）',
      };
      retryVisible=(wasLoading||!!preparation)&&visibleVersion!==visibilityVersion&&stillCurrent();
      const diagnostic=safeStartupDiagnostic(error);
      render(messages[diagnostic.code] || (wasLoading ? `本体の読み込みに失敗しました。ページを再読み込みしてください。（起動確認: APP / ${diagnostic.stage} / ${diagnostic.code}）` : '本人確認が完了しませんでした。接続を確認して再試行してください。'));
    }
    finally { cancel();if(cancelPreparation===cancel)cancelPreparation=null;checking=false; }
    if(retryVisible){render('画面を準備しています…',false,false);await waitUntilVisible();if(stillCurrent())return verify();}
  }
  return {
    async start() {
      if(started || checking) return;
      const current=++attempt;
      unsubscribe?.(); session?.dispose(); session=null;
      if (!online()) { render('初回のGoogle本人確認にはインターネット接続が必要です。'); return; }
      render('Googleログインを準備しています…',false,false);
      try {
        const next=await initialize();
        if(current!==attempt) {next.dispose();return;}
        session=next;
        unsubscribe=session.subscribe(state=>{
          const uid=state.status==='signed-in'?state.user?.uid??null:null;
          if(uid!==observedUid){observedUid=uid;identityEpoch++;}
          if(started) return;
          if(state.status==='signed-in') {void verify();return;}
          const busy=['loading','signing-in','signing-out'].includes(state.status);
          render(state.message || (busy?'Googleログインを確認しています…':'Googleアカウントでログインしてください。'), !busy && online(),!busy);
        });
      } catch { if(current===attempt) render('Googleログインを読み込めませんでした。接続を確認して再試行してください。'); }
    },
    async restart(){started=false;loading=false;return this.start();},
    visibilityChanged(visible){if(!visible){visibilityVersion++;cancelPreparation?.();}},
    async signIn(){ if(!started && session && online()) await session.signIn(); },
    get started(){return started;},
  };
}

let appModulePromise;
const warmApp=()=>appModulePromise??=import('./app-entry.js').catch(error=>{appModulePromise=null;throw error;});
const defaultLoadApp=async options=>(await warmApp()).loadApp(options);
const defaultPrepareApp=async options=>(await warmApp()).prepareApp(options);
export function installEntrySurface({doc=document, initialize=async()=> (await import('./firebase-driver.js')).initializeGoogleSession(), loadApp=defaultLoadApp, prepareApp=loadApp===defaultLoadApp?defaultPrepareApp:null, online=()=>navigator.onLine}={}) {
  const document=doc;
  const entry=document.getElementById('google-entry');
  const root=document.getElementById('google-app-root');
  if (!entry || !root) throw new Error('Google entry elements missing');
  const node=(tag,text)=>{const element=document.createElement(tag);element.textContent=text;return element;};
  const heading=node('h1','RouteNote');
  const activity=node('span','');activity.className='google-entry-activity';activity.setAttribute('aria-hidden','true');
  const status=node('p','Googleログインを準備しています…');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const login=node('button','Googleでログイン');login.type='button';login.className='button primary';login.disabled=true;
  const retry=node('button','もう一度確認');retry.type='button';retry.className='button secondary';retry.hidden=true;
  const reload=node('button','ページを再読み込み');reload.type='button';reload.className='button secondary';reload.addEventListener('click',()=>location.reload());
  const card=node('div','');card.className='google-entry-card';
  heading.id='google-entry-title';entry.setAttribute('role','dialog');entry.setAttribute('aria-modal','true');entry.setAttribute('aria-labelledby',heading.id);
  const actionSlot=node('div','');actionSlot.className='google-entry-action';actionSlot.append(login,activity,status);
  card.append(heading,actionSlot,retry,reload);entry.replaceChildren(card);
  root.hidden=true;root.inert=true;
  entry.addEventListener('keydown',event=>{
    if(entry.hidden)return;
    if(event.key==='Escape'){event.preventDefault();return;}
    if(event.key!=='Tab')return;
    const controls=[...card.querySelectorAll('button,a[href]')].filter(el=>!el.hidden&&!el.disabled);
    if(!controls.length){event.preventDefault();return;}
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&(document.activeElement===first||!card.contains(document.activeElement))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!card.contains(document.activeElement))){event.preventDefault();first.focus();}
  });
  const heldDialogs=new Map();
  const pendingDialogs=new Set();
  function holdDialogs(){
    for(const dialog of root.querySelectorAll('dialog')){
      const saved={inert:dialog.inert,show:dialog.showModal,close:dialog.close,showOwn:Object.getOwnPropertyDescriptor(dialog,'showModal'),closeOwn:Object.getOwnPropertyDescriptor(dialog,'close'),requested:pendingDialogs.has(dialog)};
      heldDialogs.set(dialog,saved);dialog.inert=true;
      dialog.showModal=()=>{saved.requested=true;};
      dialog.close=(...args)=>{saved.requested=false;if(dialog.open)saved.close?.apply(dialog,args);};
    }
  }
  function releaseDialogs(success){
    const pending=[];
    for(const [dialog,saved] of heldDialogs){
      if(saved.showOwn)Object.defineProperty(dialog,'showModal',saved.showOwn);else delete dialog.showModal;
      if(saved.closeOwn)Object.defineProperty(dialog,'close',saved.closeOwn);else delete dialog.close;
      if(!success&&dialog.open)saved.close?.call(dialog);
      dialog.inert=success?saved.inert:true;
      if(!success&&saved.requested)pendingDialogs.add(dialog);
      if(success&&saved.requested){pendingDialogs.delete(dialog);pending.push(()=>saved.show?.call(dialog));}
    }
    heldDialogs.clear();for(const show of pending)show();
  }
  const gate=createEntryGate({
    initialize, loadApp, prepareApp, online,
    isVisible:()=>doc.visibilityState!=='hidden',
    waitUntilVisible:()=>doc.visibilityState!=='hidden'?Promise.resolve():new Promise(resolve=>{const visible=()=>{if(doc.visibilityState==='hidden')return;doc.removeEventListener('visibilitychange',visible);resolve();};doc.addEventListener('visibilitychange',visible);}),
    show:({message,canLogin,canRetry})=>{entry.hidden=false;const busy=!canLogin&&!canRetry;const idle=canLogin&&message==='Googleアカウントでログインしてください。';activity.hidden=!busy;login.hidden=!canLogin;entry.setAttribute('aria-busy',String(busy));status.textContent=message;status.hidden=idle;login.disabled=!canLogin;retry.hidden=!canRetry||idle;reload.hidden=!canRetry||idle;if(!entry.contains(document.activeElement)){if(canLogin)login.focus();else if(canRetry)retry.focus();else{entry.tabIndex=-1;entry.focus();}}},
    prepare:()=>{root.hidden=true;root.inert=true;holdDialogs();},
    close:()=>{releaseDialogs(false);root.hidden=true;root.inert=true;entry.hidden=false;},
    open:app=>{app?.activate?.();root.hidden=false;entry.hidden=true;entry.setAttribute('aria-busy','false');activity.hidden=true;root.inert=false;releaseDialogs(true);app?.completeReveal?.();},
  });
  doc.addEventListener('visibilitychange',()=>gate.visibilityChanged(doc.visibilityState!=='hidden'));
  login.addEventListener('click',()=>void gate.signIn());
  let recovery=null;
  retry.addEventListener('click',()=>{if(recovery){retry.hidden=true;reload.hidden=true;activity.hidden=false;void Promise.resolve(recovery()).catch(()=>{activity.hidden=true;retry.hidden=false;reload.hidden=false;});}else void gate.start();});
  doc.addEventListener('routenote-connection-error',event=>{recovery=event.detail?.reauthenticate?()=>{recovery=null;return gate.restart();}:event.detail?.retry;root.hidden=true;root.inert=true;entry.hidden=false;activity.hidden=true;login.hidden=true;status.hidden=false;status.textContent=event.detail?.message||'接続を確認してください。';retry.hidden=false;reload.hidden=false;entry.setAttribute('aria-busy','false');});
  doc.addEventListener('routenote-connection-loading',()=>{root.hidden=true;root.inert=true;entry.hidden=false;activity.hidden=false;login.hidden=true;status.hidden=false;status.textContent='画面を準備しています…';retry.hidden=true;reload.hidden=true;entry.setAttribute('aria-busy','true');});
  doc.addEventListener('routenote-connection-restored',()=>{recovery=null;entry.hidden=true;activity.hidden=true;});
  // Only same-origin public modules/artwork are warmed before account selection.
  if(loadApp===defaultLoadApp)void warmApp().then(module=>module.preloadPublicAssets(doc)).catch(()=>{});
  void gate.start();
  return {gate,entry,root};
}
if (typeof document !== 'undefined') installEntrySurface();
