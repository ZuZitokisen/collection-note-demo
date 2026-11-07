import {makeChange, normalizeFields} from './reports-client.js';
import {createPendingStore} from './reports-pending.js';
import {formatLedgerNumber} from './ledger-panel.js';

const AUTH = new Set(['LOGIN_REQUIRED','UNAUTHENTICATED','FORBIDDEN','AUTH_UNAVAILABLE']);
const ERRORS = {
  CONFLICT:'別の変更があります。再読込して内容を確認し、改めて編集してください。',
  SOURCE_CONFLICT:'元データと訂正が競合しています。管理者の確認が必要です。',
  CUSTOMER_CHANGED:'取引先が変更されています。再読込して選び直してください。',
  DUPLICATE:'同じ日付・取引先の記録があります。既存の記録を確認してください。',
  BAD_REQUEST:'日付・取引先と、重量または備考・その他金額を確認してください。数値は0以上、小数6桁までです。',
  IDEMPOTENCY_CONFLICT:'同じ操作の内容が一致しません。管理者に確認してください。',
};

/** Separate cloud data source. No demo data, price inference or background writes. Only pending requests are persisted. */
export function installReportsPanel({host,readPage,change,uuid = () => globalThis.crypto.randomUUID(),pageSize = 30, getStorage, getLocks}) {
  const doc = host.ownerDocument, view = doc.defaultView;
  let visible = false, authorized = false, disposed = false, identity = null, sequence = 0;
  let snapshot = null, controller = null, reading = null, status = 'locked', month = '', trash = false, page = 0;
  let editor = null, returnFocus = null, storageError = false;
  const pendingStore = createPendingStore(getStorage || (() => view.localStorage), getLocks || (() => view.navigator.locks));
  // Memory contains only the active actor. Durable pending requests remain actor-scoped.
  const operations = new Map();
  const listeners = [];
  const el = (tag,cls,text) => { const n=doc.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text; return n; };
  const button = (text,action,fn) => { const b=el('button','rn-ledger-button',text); b.type='button'; b.dataset.action=action; if(fn)b.addEventListener('click',fn); return b; };
  const on = (target,event,fn) => {target.addEventListener(event,fn);listeners.push(()=>target.removeEventListener(event,fn));};
  const root=el('section','rn-ledger'); root.setAttribute('aria-label','スプレッドシートの記録');
  const heading=el('div','rn-ledger-heading'); heading.append(el('h2','rn-ledger-title','スプレッドシートの記録'));
  const notice=el('p','rn-ledger-notice','元の行は残し、訂正・追加・削除・復元を別の履歴に保存します。このブラウザの試作データや設定は送信しません。');
  const toolbar=el('div','rn-ledger-toolbar');
  const refreshButton=button('再読込','refresh',()=>void refresh());
  const createButton=button('記録を追加','create',()=>openEditor('create'));
  const trashButton=button('削除済みを表示','trash',()=>{trash=!trash;page=0;render();});
  const monthSelect=el('select','rn-ledger-month');monthSelect.setAttribute('aria-label','対象月');
  toolbar.append(monthSelect,refreshButton,createButton,trashButton);
  const message=el('p','rn-ledger-status');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
  const warning=el('p','rn-ledger-warning');
  const storageWarning=el('p','rn-ledger-warning');storageWarning.setAttribute('role','alert');
  const recovery=el('div','rn-reports-recovery');
  const recoveryText=el('p','','結果未確認の操作があります。新しい操作は停止しています。「再読込」で現状を確認できますが、保存結果の確定には同じ操作の確認・再送が必要です。');
  const retry=button('同じ操作を確認・再送','retry-change',()=>void submit(operations.get(identity)));
  recovery.append(recoveryText,retry);
  const list=el('div','rn-ledger-list');list.setAttribute('role','list');
  const nav=el('nav','rn-ledger-pagination');
  const prev=button('前へ','previous',()=>{page--;render();});const next=button('次へ','next',()=>{page++;render();});const pageText=el('span','rn-ledger-page');nav.append(prev,pageText,next);
  root.append(heading,notice,toolbar,message,warning,storageWarning,recovery,list,nav,el('p','rn-ledger-footnote','空欄と0は区別します。実データの単価・請求額・税額は計算しません。画面を離れると表示を消去します。結果未確認の操作内容は、この端末に一時保存し、同じGoogleアカウントで復旧します。共有端末では注意してください。ブラウザデータを削除しないでください。'));
  const dialog=el('dialog','rn-reports-dialog');dialog.setAttribute('aria-label','スプレッドシートの記録を変更');
  host.replaceChildren(root,dialog);host.hidden=true;
  const pending = () => operations.get(identity);
  const busy = () => status === 'loading' || pending()?.state === 'sending';
  const editable = () => authorized && visible && snapshot && !snapshot.blocked && !storageError && !pending() && !busy();
  const currentRows = () => (snapshot?.records || []).filter(r=>r.deleted===trash && (!month || r.fields.date.slice(0,7)===month));
  function closeEditor() {editor=null;if(dialog.open)dialog.close();dialog.replaceChildren();if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null;}
  function clear() {sequence++;controller?.abort();controller=null;reading=null;snapshot=null;month='';page=0;closeEditor();list.replaceChildren();warning.textContent='';message.textContent='';}
  function controls() {
    storageWarning.textContent=storageError?'確認用の操作をこの端末に安全に保存・読込できないため、書き込みを停止しています。ブラウザデータは削除せず、保存設定とWeb Locks対応ブラウザを確認して再読込してください。破損がある場合は管理者に確認してください。':'';
    root.dataset.state=status;root.setAttribute('aria-busy',String(busy()));
    refreshButton.disabled=!authorized || busy();createButton.disabled=!editable();trashButton.disabled=!snapshot || busy();monthSelect.disabled=!snapshot || busy();
    trashButton.textContent=trash?'通常の記録を表示':'削除済みを表示';trashButton.setAttribute('aria-pressed',String(trash));
    recovery.hidden=!authorized || !pending();retry.disabled=!authorized || storageError || busy() || pending()?.state !== 'uncertain';
    recoveryText.textContent=pending()?.state === 'sending'?'保存結果を確認しています。重複送信を防ぐため、操作を停止しています。':'結果未確認の操作があります。再読込は現状の確認のみです。同じ操作の確認・再送で保存結果を確定してください。操作内容はこの端末に一時保存しています。同じGoogleアカウントで確認してください。';
    const count=currentRows().length;nav.hidden=!snapshot || count<=pageSize;prev.disabled=busy()||page===0;next.disabled=busy()||(page+1)*pageSize>=count;
  }
  function render() {
    monthSelect.replaceChildren();const all=el('option','','すべての月');all.value='';monthSelect.append(all);
    for(const m of [...new Set((snapshot?.records || []).map(r=>r.fields.date.slice(0,7)))].sort().reverse()){const o=el('option','',m);o.value=m;monthSelect.append(o);}monthSelect.value=month;
    list.replaceChildren();const rows=currentRows();page=Math.min(Math.max(page,0),Math.max(0,Math.ceil(rows.length/pageSize)-1));
    for(const row of rows.slice(page*pageSize,(page+1)*pageSize)) {
      const f=row.fields,card=el('article','rn-ledger-card');card.setAttribute('role','listitem');
      card.append(el('time','rn-ledger-date',f.date),el('h3','rn-ledger-customer',f.customerName));
      const metrics=el('dl','rn-ledger-metrics');
      for(const [label,value] of [['可燃',formatLedgerNumber(f.combustibleKg,'kg')],['不燃',formatLedgerNumber(f.noncombustibleKg,'kg')],['備考',f.otherItem||'—'],['その他',formatLedgerNumber(f.otherFee,'円')]]){const item=el('div','rn-ledger-metric');item.append(el('dt','',label),el('dd','',value));metrics.append(item);}card.append(metrics);
      const actions=el('div','rn-ledger-toolbar');
      for(const [action,label] of row.deleted?[['restore','復元']]:[['update','編集'],['delete','削除']]){const b=button(label,action,()=>openEditor(action,row));b.disabled=!editable();actions.append(b);}card.append(actions);list.append(card);
    }
    pageText.textContent=`${page+1} / ${Math.max(1,Math.ceil(rows.length/pageSize))}`;
    warning.textContent=snapshot?.blocked?'競合があるため編集・集計を停止しています。管理者に確認してください。':snapshot && (!snapshot.projectionCurrent || snapshot.publicationPending)?'実効日次データへの反映を確認できません。集計には使わず、再読込で確認してください。':snapshot?'読込時点の実効日次データへの反映を確認しました。請求額の確認ではありません。':'';
    controls();
  }
  async function refresh() {
    if(disposed||!visible||!authorized||doc.visibilityState==='hidden'||pending()?.state==='sending')return false;
    if(reading)return reading;
    closeEditor();snapshot=null;status='loading';message.textContent='実データを読み込んでいます…';render();
    const ticket=++sequence;controller?.abort();const ctrl=new AbortController();controller=ctrl;
    reading=Promise.resolve().then(()=>readPage({signal:ctrl.signal})).then(result=>{
      if(disposed||!visible||!authorized||ticket!==sequence)return false;
      snapshot=result;status='ready';message.textContent=result.blocked?'元データと訂正履歴を確認してください。':`取得した記録 ${result.records.length}件`;render();return true;
    }).catch(error=>{
      if(ticket!==sequence)return false;
      snapshot=null;status='error';
      if(AUTH.has(error?.code)){authorized=false;identity=null;operations.clear();status='locked';message.textContent='Googleログインと登録メンバー権限を確認し、もう一度開いてください。';}
      else message.textContent=ERRORS[error?.code]||'読み込めませんでした。接続・サーバー設定を確認して再読込してください。';
      render();return false;
    }).finally(()=>{if(ticket===sequence){reading=null;controller=null;controls();}});
    return reading;
  }
  function openEditor(action,row) {
    if(!editable())return;
    closeEditor();returnFocus=doc.activeElement;editor={action,row};
    const form=el('form','rn-reports-form'),title=el('h3','',({create:'記録を追加',update:'記録を編集',delete:'この記録を削除',restore:'この記録を復元'})[action]);
    const error=el('p','rn-ledger-warning');error.setAttribute('role','alert');const fields={};form.append(title);
    if(action==='create'||action==='update') {
      for(const [name,label,type] of [['date','日付','date'],['customerName','取引先','select'],['combustibleKg','可燃 kg','number'],['noncombustibleKg','不燃 kg','number'],['otherItem','備考','text'],['otherFee','その他 円','number']]) {
        const wrap=el('label','field'),input=el(type==='select'?'select':'input');input.name=name;
        if(type==='select'){const empty=el('option','','選択してください');empty.value='';input.append(empty);for(const n of snapshot.customerNames){const o=el('option','',n);o.value=n;input.append(o);}}
        else input.type=type;
        if(type==='number'){input.min='0';input.max='1000000000';input.step='0.000001';input.inputMode='decimal';}
        if(type==='text')input.maxLength=500;
        if(name==='date'||name==='customerName')input.required=true;
        input.value=row?.fields[name] ?? '';fields[name]=input;wrap.append(el('span','',label),input);form.append(wrap);
      }
    } else form.append(el('p','',`${row.fields.date} / ${row.fields.customerName}`),el('p','',action==='delete'?'元の行と履歴は残ります。実効データから除外します。':'記録を実効データへ戻します。'));
    form.append(error);const footer=el('div','rn-ledger-toolbar'),cancel=button('キャンセル','cancel',closeEditor),save=button('確定して保存','save');save.type='submit';footer.append(cancel,save);form.append(footer);
    form.addEventListener('submit',event=>{
      event.preventDefault();if(!editor||!editable())return;
      try {
        let values;
        if(action==='create'||action==='update'){values=Object.fromEntries(Object.entries(fields).map(([name,input])=>[name,input.type==='number'?(input.value.trim()===''?null:Number(input.value)):input.value]));values=normalizeFields(values);}
        const input=makeChange(action,row,values,uuid());const operation={input,uid:identity,state:'new'};
        operations.set(identity,operation);closeEditor();void submit(operation);
      } catch {error.textContent=ERRORS.BAD_REQUEST;}
    });
    dialog.append(form);dialog.showModal();form.querySelector('input,select,button')?.focus();
  }
  async function submit(operation) {
    if(!operation || operation.uid!==identity || storageError || !authorized || !visible || operation.state==='sending' || operations.get(identity)!==operation)return;
    const uid=identity,ticket=sequence;
    // Lock duplicate clicks immediately, before awaiting durable storage.
    operation.state='sending';message.textContent='保存結果を確認しています…';render();
    try {await pendingStore.save(uid,operation.input);}
    catch {operation.state='uncertain';if(!disposed&&identity===uid&&ticket===sequence){storageError=true;render();}return;}
    // Navigation, logout or an account change while queued for the storage lock
    // must never dispatch a write. Keep the durable operation for explicit retry.
    if(disposed||!visible||!authorized||identity!==uid||ticket!==sequence||operations.get(uid)!==operation){operation.state='uncertain';if(!disposed&&identity===uid)render();return;}

    try {
      const result=await change(operation.input,{expectedUid:uid});
      if(result?.committed!==true)throw Object.assign(Error('Unknown'),{uncertain:true});
      await pendingStore.remove(uid,operation.input);
      if(operations.get(uid)===operation)operations.delete(uid);
      if(!disposed&&visible&&authorized&&identity===uid){await refresh();if(visible&&authorized&&identity===uid){message.textContent=result.projectionCurrent&&!result.publicationPending?'保存しました。現在の反映状況は下の表示で確認してください。':'訂正履歴は保存済みです。実効日次データへの反映は未確認です。再読込で確認してください。';controls();}}
    } catch(error) {
      // Unclassified errors may occur after dispatch. Never discard their operation ID.
      if(error?.uncertain!==false || error?.retainPending || operation.everUncertain){operation.state='uncertain';operation.everUncertain=true;}
      else {
        try {await pendingStore.remove(uid,operation.input);if(operations.get(uid)===operation)operations.delete(uid);}
        catch {operation.state='uncertain';operation.everUncertain=true;if(identity===uid)storageError=true;}
      }
      if(error?.message==='PENDING_STORAGE_UNAVAILABLE'&&identity===uid)storageError=true;
      if(!disposed&&visible&&authorized&&identity===uid){
        snapshot=null;status='error';
        if(AUTH.has(error?.code)){authorized=false;identity=null;operations.clear();closeEditor();message.textContent='Googleログインと権限を確認し、もう一度開いてください。';}
        else message.textContent=error?.code==='AUTH_TIMEOUT'?'認証の確認が時間切れになり、今回は送信していません。同じ操作の確認・再送で続けられます。':operation.state==='uncertain'?'保存結果が未確認です。自動再送はしていません。下のボタンで同じ操作を確認・再送できます。':ERRORS[error?.code]||'保存は確認できませんでした。再読込してから内容を確認してください。';
        render();
      }
    }
  }
  on(monthSelect,'change',()=>{month=monthSelect.value;page=0;render();});
  on(dialog,'cancel',()=>closeEditor());
  const suspend=()=>{clear();status=authorized?'idle':'locked';render();};
  on(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden')suspend();});
  on(view,'pagehide',suspend);
  on(view,'beforeunload',event=>{if(operations.size){event.preventDefault();event.returnValue='';}});
  render();
  return {
    async setIdentity(uid){
      if(identity!==uid){operations.clear();identity=uid;snapshot=null;closeEditor();list.replaceChildren();warning.textContent='';}
      const ticket=sequence;storageError=true;controls();
      try {
        const stored=await pendingStore.inspect(uid);
        if(disposed||identity!==uid||ticket!==sequence||!authorized)return;
        storageError=false;
        if(stored&&(!operations.has(uid)||JSON.stringify(operations.get(uid).input)!==JSON.stringify(stored)))operations.set(uid,{input:stored,uid,state:'uncertain',everUncertain:true});
      } catch {if(disposed||identity!==uid||ticket!==sequence||!authorized)return;storageError=true;}
      controls();
    },
    setAuthorization(value){authorized=value===true;if(!authorized){identity=null;operations.clear();storageError=false;clear();status='locked';message.textContent='Googleログインと登録メンバー権限を確認してください。';render();}return Promise.resolve(false);},
    show(){const changed=!visible;visible=true;host.hidden=false;return changed||status==='idle'||status==='locked'?refresh():reading||Promise.resolve(false);},
    hide(){visible=false;host.hidden=true;suspend();},refresh,
    getState:()=>({visible,authorized,status,rowCount:snapshot?.records.length||0,unresolved:!!pending(),storageError}),
    dispose(){disposed=true;visible=false;authorized=false;identity=null;operations.clear();clear();listeners.forEach(fn=>fn());root.remove();dialog.remove();host.hidden=true;},
  };
}
