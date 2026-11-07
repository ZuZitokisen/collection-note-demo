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

if (typeof document !== 'undefined') {
  const entry=document.getElementById('google-entry');
  const root=document.getElementById('google-app-root');
  if (!entry || !root) throw new Error('Google entry elements missing');
  const node=(tag,text)=>{const element=document.createElement(tag);element.textContent=text;return element;};
  const heading=node('h1','RouteNote');
  const subtitle=node('h2','Googleログイン');
  const status=node('p','Googleログインを準備しています…');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const login=node('button','Googleでログイン');login.type='button';login.className='button primary';login.disabled=true;
  const retry=node('button','もう一度確認');retry.type='button';retry.className='button secondary';retry.hidden=true;
  const reload=node('button','ページを再読み込み');reload.type='button';reload.className='button secondary';reload.addEventListener('click',()=>location.reload());
  const notice=node('p','Google本人確認後にアプリへ進みます。シートの表示・訂正では、サーバー側で登録メンバーを別途確認します。「このブラウザ」の試作報告・設定は共有しません。この入口だけで実データへのアクセスを許可するものではありません。');
  const scope=node('p','Googleから名前・プロフィール写真・メールアドレスを取得します。Driveやスプレッドシートの権限は要求しません。');
  const recovery=node('a','更新・復旧画面を開く');recovery.href='./update.html';
  entry.replaceChildren(heading,subtitle,status,login,retry,notice,scope,reload,node('p',''),recovery);
  const gate=createEntryGate({
    initialize:async()=> (await import('./firebase-driver.js')).initializeGoogleSession(),
    loadApp:()=>import('./app.js'), online:()=>navigator.onLine,
    show:({message,canLogin,canRetry})=>{status.textContent=message;login.disabled=!canLogin;retry.hidden=!canRetry;},
    prepare:()=>{root.hidden=false;root.inert=false;},
    close:()=>{root.hidden=true;root.inert=true;},
    open:()=>{entry.hidden=true;},
  });
  login.addEventListener('click',()=>void gate.signIn());
  retry.addEventListener('click',()=>void gate.start());
  void gate.start();
}
