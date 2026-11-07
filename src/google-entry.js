// This UI gate is not server authorization. Every real-data API needs its own checks.
export function createEntryGate({initialize, loadApp, online, show, open, prepare=()=>{}, close=()=>{}}) {
  let session, unsubscribe, attempt=0, checking=false, started=false, loading=false;
  const render = (message, canLogin=false, canRetry=true) => { if (!started) show({message,canLogin,canRetry}); };
  async function verify() {
    if (started || checking || !session?.state.user) return;
    if (!online()) { render('オンラインにして、もう一度確認してください。'); return; }
    checking=true;
    render('Googleアカウントを確認しています…',false,false);
    try {
      const identity=await session.verifyIdentity();
      if (!identity || !online()) throw new Error('identity unavailable');
      if (!loading) {
        loading=true;
        render('画面を準備しています…',false,false);
        prepare();
        await loadApp();
        started=true;
        open();
      }
    } catch { close(); render(loading ? '本体の読み込みに失敗しました。ページを再読み込みしてください。' : '本人確認が完了しませんでした。接続を確認して再試行してください。'); }
    finally { checking=false; }
  }
  return {
    async start() {
      if(started || checking) return;
      if(loading) { render('本体の読み込みに失敗しました。ページを再読み込みしてください。'); return; }
      const current=++attempt;
      unsubscribe?.(); session?.dispose(); session=null;
      if (!online()) { render('初回のGoogle本人確認にはインターネット接続が必要です。'); return; }
      render('Googleログインを準備しています…',false,false);
      try {
        const next=await initialize();
        if(current!==attempt) {next.dispose();return;}
        session=next;
        unsubscribe=session.subscribe(state=>{
          if(started) return;
          if(state.status==='signed-in') {void verify();return;}
          const busy=['loading','signing-in','signing-out'].includes(state.status);
          render(state.message || (busy?'Googleログインを確認しています…':'Googleアカウントでログインしてください。'), !busy && online(),!busy);
        });
      } catch { if(current===attempt) render('Googleログインを読み込めませんでした。接続を確認して再試行してください。'); }
    },
    async signIn(){ if(!started && session && online()) await session.signIn(); },
    get started(){return started;},
  };
}

export function installEntrySurface({doc=document, initialize=async()=> (await import('./firebase-driver.js')).initializeGoogleSession(), loadApp=async()=>{const app=await import('./app.js');await app.appReady;}, online=()=>navigator.onLine}={}) {
  const document=doc;
  const entry=document.getElementById('google-entry');
  const root=document.getElementById('google-app-root');
  if (!entry || !root) throw new Error('Google entry elements missing');
  const node=(tag,text)=>{const element=document.createElement(tag);element.textContent=text;return element;};
  const heading=node('h1','RouteNote');
  const subtitle=node('h2','Googleログイン');
  const activity=node('span','');activity.className='google-entry-activity';activity.setAttribute('aria-hidden','true');
  const status=node('p','Googleログインを準備しています…');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const login=node('button','Googleでログイン');login.type='button';login.className='button primary';login.disabled=true;
  const retry=node('button','もう一度確認');retry.type='button';retry.className='button secondary';retry.hidden=true;
  const reload=node('button','ページを再読み込み');reload.type='button';reload.className='button secondary';reload.addEventListener('click',()=>location.reload());
  const notice=node('p','Google本人確認後にアプリへ進みます。シートの表示・訂正では、サーバー側で登録メンバーを別途確認します。「このブラウザ」の試作報告・設定は共有しません。この入口だけで実データへのアクセスを許可するものではありません。');
  const scope=node('p','Googleから名前・プロフィール写真・メールアドレスを取得します。Driveやスプレッドシートの権限は要求しません。');
  const recovery=node('a','更新・復旧画面を開く');recovery.href='./update.html';
  const card=node('div','');card.className='google-entry-card';
  heading.id='google-entry-title';entry.setAttribute('role','dialog');entry.setAttribute('aria-modal','true');entry.setAttribute('aria-labelledby',heading.id);
  const actionSlot=node('div','');actionSlot.className='google-entry-action';actionSlot.append(login,activity,status);
  card.append(heading,subtitle,actionSlot,retry,notice,scope,reload,node('p',''),recovery);entry.replaceChildren(card);
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
  function holdDialogs(){
    for(const dialog of root.querySelectorAll('dialog')){
      const saved={inert:dialog.inert,show:dialog.showModal,close:dialog.close,showOwn:Object.getOwnPropertyDescriptor(dialog,'showModal'),closeOwn:Object.getOwnPropertyDescriptor(dialog,'close'),requested:false};
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
      if(success&&saved.requested)pending.push(()=>saved.show?.call(dialog));
    }
    heldDialogs.clear();for(const show of pending)show();
  }
  const gate=createEntryGate({
    initialize, loadApp, online,
    show:({message,canLogin,canRetry})=>{entry.hidden=false;const busy=!canLogin&&!canRetry;activity.hidden=!busy;login.hidden=busy;entry.setAttribute('aria-busy',String(busy));status.textContent=message;login.disabled=!canLogin;retry.hidden=!canRetry;if(!entry.contains(document.activeElement))(canLogin?login:canRetry?retry:reload).focus();},
    prepare:()=>{root.hidden=false;root.inert=true;holdDialogs();},
    close:()=>{releaseDialogs(false);root.hidden=true;root.inert=true;entry.hidden=false;},
    open:()=>{entry.hidden=true;entry.setAttribute('aria-busy','false');activity.hidden=true;root.inert=false;releaseDialogs(true);},
  });
  login.addEventListener('click',()=>void gate.signIn());
  retry.addEventListener('click',()=>void gate.start());
  void gate.start();
  return {gate,entry,root};
}
if (typeof document !== 'undefined') installEntrySurface();
