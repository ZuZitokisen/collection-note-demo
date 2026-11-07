import {buildInvoiceDocument, invoicePageSVG, createInvoicePDF} from './invoice-document.js';
import {loadDefaultInvoiceSeal} from './invoice-seal.js';

const DRAFT = '実シートの確認用・未確定です。発行者・口座情報は今回入力した内容です。内容を確認しても正式な請求書としての検証は未完了です。PDFの文字は画像です。';
const fail = message => { throw new Error(message); };
const decimal = value => typeof value === 'string' && /^(0|[1-9]\d*)(\.\d+)?$/.test(value) && value.length < 80 ? value : fail('シートの金額・重量を確認できません。');
// Keep decimal arithmetic exact even beyond Number's integer range.
export function addLiveDecimals(...values) {
  values.forEach(decimal);
  const scale = Math.max(0, ...values.map(v => (v.split('.')[1] || '').length));
  const result = values.reduce((sum, value) => { const [a,b=''] = value.split('.'); return sum + BigInt(a + b.padEnd(scale, '0')); }, 0n).toString().padStart(scale + 1, '0');
  return scale ? `${result.slice(0,-scale)}.${result.slice(-scale)}`.replace(/\.?0+$/, '') : result;
}
const amountKeys = ['baseFee','disposalRate','combustibleKg','noncombustibleKg','combustibleAmount','noncombustibleAmount','otherFee','monthlySubtotal','submissionTotal'];
function customer(value) {
  if (!value || typeof value.key !== 'string' || !value.key || value.key !== value.name) fail('取引先の照合に失敗しました。');
  for (const key of amountKeys) { if (value[key] === null && ['baseFee','disposalRate','combustibleAmount','noncombustibleAmount','monthlySubtotal','submissionTotal'].includes(key)) continue; decimal(value[key]); }
  if (!Number.isSafeInteger(value.reportCount) || value.reportCount < 0 || !Array.isArray(value.missingInputs)) fail('回収記録の確認が必要です。');
  if ([value.baseFee,value.combustibleAmount,value.noncombustibleAmount,value.otherFee].every(v=>v!==null) && (value.monthlySubtotal===null || addLiveDecimals(value.baseFee,value.combustibleAmount,value.noncombustibleAmount,value.otherFee)!==addLiveDecimals(value.monthlySubtotal))) fail('月次小計が明細と一致しません。');
  return value;
}
export function validateLiveBilling(value, month) {
  if (!value || value.schemaVersion !== 1 || value.timezone !== 'Asia/Tokyo' || value.month !== month || value.projectionCurrent !== true || typeof value.snapshotId !== 'string' || !value.snapshotId || !Array.isArray(value.customers) || !value.verifiedAt) fail('最新のシート集計を確認できません。再読込してください。');
  if (value.taxFraction !== null) decimal(value.taxFraction); if (value.total !== null) decimal(value.total);
  value.customers.forEach(customer);
  if(value.customers.every(c=>c.monthlySubtotal!==null) && (value.total===null || addLiveDecimals(...value.customers.map(c=>c.monthlySubtotal))!==addLiveDecimals(value.total))) fail('集計合計が一致しません。');
  if (new Set(value.customers.map(c => c.key)).size !== value.customers.length) fail('取引先が重複しています。');
  return value;
}
export function liveInvoiceView(dto, {month, customerKey, kind, snapshotId}, seal = null) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !['invoice','monthly-detail'].includes(kind) || !dto || dto.schemaVersion !== 1 || dto.timezone !== 'Asia/Tokyo' || dto.projectionCurrent !== true || dto.kind !== kind || dto.month !== month || dto.snapshotId !== snapshotId || dto.customer?.key !== customerKey || dto.finalized !== false || !dto.verifiedAt || !Array.isArray(dto.daily)) fail('帳票の照合に失敗しました。再読込してください。');
  const c = customer(dto.customer), tax = dto.taxFraction === null ? null : decimal(dto.taxFraction);
  if (kind === 'invoice' && (tax === null || Number(tax) !== 0 || c.missingInputs.length || ['baseFee','disposalRate','combustibleAmount','noncombustibleAmount','monthlySubtotal'].some(key=>c[key]===null))) fail('税設定または未入力項目の確認が必要です。請求書出力を停止しました。');
  if (!dto.recipient || typeof dto.recipient.address !== 'string' || typeof dto.recipient.postalCode !== 'string') fail('シートの宛先情報を確認できません。');
  const count = new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5)), 0)).getUTCDate();
  const rows = new Map();
  for (const row of dto.daily) {
    if (typeof row.date !== 'string' || !row.date.startsWith(month+'-') || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || Number(row.date.slice(8)) < 1 || Number(row.date.slice(8)) > count || rows.has(row.date) || !Array.isArray(row.missingInputs) || !Number.isSafeInteger(row.reportCount) || row.reportCount < 0) fail('日別明細の照合に失敗しました。');
    ['combustibleKg','noncombustibleKg','otherFee'].forEach(key => decimal(row[key])); rows.set(row.date,row);
  }
  for (const key of ['combustibleKg','noncombustibleKg','otherFee']) if(addLiveDecimals(...dto.daily.map(row=>row[key]))!==addLiveDecimals(c[key])) fail('日別明細と月次集計が一致しません。');
  if(dto.daily.reduce((sum,row)=>sum+row.reportCount,0)!==c.reportCount) fail('報告件数が一致しません。');
  const cell = (value, missing = false) => ({value,missing});
  const daily = Array.from({length:count}, (_,i) => {
    const date = `${month}-${String(i+1).padStart(2,'0')}`, row = rows.get(date);
    if (!row || row.reportCount === 0) return {date,combustible:cell(null),noncombustible:cell(null),other:cell(null),weight:cell(null)};
    const missing = row.missingInputs.length > 0;
    return {date,combustible:cell(row.combustibleKg,missing),noncombustible:cell(row.noncombustibleKg,missing),other:cell(row.otherFee,missing),weight:cell(addLiveDecimals(row.combustibleKg,row.noncombustibleKg),missing)};
  });
  return {liveBilling:{taxFraction:tax,baseFee:c.baseFee,monthlySubtotal:c.monthlySubtotal,submissionTotal:c.submissionTotal},customer:{name:c.name},month,label:month,documentType:kind,issueDate:`${month}-${count}`,seal,
    recipient:{postalCode:dto.recipient.postalCode,address:dto.recipient.address},issuer:{},bankAccounts:[],
    lines:['combustible','noncombustible'].map((key,i) => ({title:i?'不燃':'可燃',entered:true,missing:c.missingInputs.length>0,quantityMissing:c.missingInputs.length>0,quantity:c[key+'Kg'],rates:[c.disposalRate],amount:c[key+'Amount'],details:[]})),
    other:{title:'その他料金',entered:true,amount:c.otherFee,details:dto.daily.filter(row=>row.otherItems).map(row=>({date:row.date,text:Array.isArray(row.otherItems)?row.otherItems.join('、'):String(row.otherItems),amount:row.otherFee}))},
    recordedCharges:[c.combustibleAmount,c.noncombustibleAmount,c.otherFee].some(v=>v===null)?null:addLiveDecimals(c.combustibleAmount,c.noncombustibleAmount,c.otherFee),totalWeight:cell(addLiveDecimals(c.combustibleKg,c.noncombustibleKg),c.missingInputs.length>0),daily};
}

export function installLiveInvoiceOutput({host,api,session,makePDF=createInvoicePDF,loadSeal=loadDefaultInvoiceSeal}) {
  const doc=host.ownerDocument, win=doc.defaultView;
  let active=false, disposed=false, generation=0, controller=null, summary=null, view=null, blobURL=null, printing=false;
  host.innerHTML = '<h2>実シート帳票</h2><p data-notice></p><div class="invoice-controls"><label>対象月<input type="month" data-month></label><label>取引先<select data-customer></select></label><label>帳票<select data-kind><option value="monthly-detail">月間回収明細（確認用）</option><option value="invoice">請求書（未確定）</option></select></label><fieldset data-issuer-inputs autocomplete="off"><legend>発行者・振込先（今回の手入力）</legend><p>会社情報・口座情報は自動入力しません。この画面内だけで使用し、サーバーやブラウザ保存領域に保存しません。画面移動・ログアウトで消去します。宛先の取引先名・住所は実シートの最新情報を使用します。</p><label>会社名・氏名<input data-entry="legalName" maxlength="120" autocomplete="off"></label><label>発行者郵便番号<input data-entry="postalCode" maxlength="20" autocomplete="off"></label><label>発行者住所（3行まで）<textarea data-entry="address" maxlength="240" rows="3" autocomplete="off"></textarea></label><label>TEL<input data-entry="phone" maxlength="60" autocomplete="off"></label><label>登録番号<input data-entry="registrationNumber" maxlength="60" autocomplete="off"></label><label>請求番号<input data-entry="invoiceNumber" maxlength="60" autocomplete="off"></label><label>振込先（金融機関・支店・種別・口座番号・名義、3行まで）<textarea data-entry="bankInstructions" maxlength="360" rows="3" autocomplete="off"></textarea></label></fieldset><button type="button" data-refresh>最新集計を読込</button><button type="button" data-preview>確認用プレビュー</button><label><input type="checkbox" data-confirm>手入力した発行者・振込先、シート由来の宛先と金額を確認し、未確定の確認用帳票として表示・保存する</label><button type="button" data-pdf>確認用PDFを保存</button><button type="button" data-print>確認用帳票を印刷</button></div><p role="status" data-status></p><div data-preview-host></div>';
  const q=s=>host.querySelector(s), month=q('[data-month]'), select=q('[data-customer]'), kind=q('[data-kind]'), preview=q('[data-preview-host]'), status=q('[data-status]'), confirm=q('[data-confirm]');
  host.setAttribute('data-live-invoice-ui','');
  for(const label of host.querySelectorAll('label')) label.classList.add('field');
  confirm.parentElement.className='invoice-optional';
  for(const button of host.querySelectorAll('button')) button.className='button secondary';
  q('[data-pdf]').className='button primary';
  for(const name of ['address','bankInstructions']) q(`[data-entry="${name}"]`).parentElement.classList.add('live-wide');
  q('[data-notice]').textContent=DRAFT;
  month.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).format(new Date());

  const entries = [...host.querySelectorAll('[data-entry]')];
  function clearEntries() { for (const entry of entries) entry.value=''; }
  function readEntries() { const result={}; for(const entry of entries) { if(entry.value.length>Number(entry.maxLength)) fail('入力内容が長すぎます。'); result[entry.dataset.entry]=entry.value.trim(); } if(result.address.split('\n').length>3 || result.address.split('\n').some(line=>line.length>80)) fail('発行者住所は1行80文字以内・3行までで入力してください。'); if(result.bankInstructions.split('\n').length>3 || result.bankInstructions.split('\n').some(line=>line.length>120)) fail('振込先は1行120文字以内・3行までで入力してください。'); return result; }
  function applyEntries(next,entry) { next.issuer={legalName:entry.legalName,postalCode:entry.postalCode,address:entry.address,phone:entry.phone,registrationNumber:entry.registrationNumber};next.liveBilling.invoiceNumber=entry.invoiceNumber;next.liveBilling.bankInstructions=entry.bankInstructions;return next; }
  function clear() { view=null; preview.replaceChildren();preview.removeAttribute('data-live-print');printing=false;confirm.checked=false;if(blobURL){win.URL.revokeObjectURL(blobURL);blobURL=null;} }
  function invalidate() {generation++;controller?.abort();controller=null;summary=null;select.replaceChildren();clear();status.textContent='最新のシート集計を再読込してください。';}
  function begin() {generation++;controller?.abort();controller=new AbortController();return {generation,ticket:session.capture(),signal:controller.signal};}
  function check(op) {if(disposed||!active||op.generation!==generation||op.signal.aborted||!session.isCurrent(op.ticket)||doc.visibilityState==='hidden') fail('認証・画面が変更されました。再読込してください。');}
  async function ready(op) {await api.assertReady();check(op);}
  function render(next) {const result=buildInvoiceDocument(next);preview.innerHTML=result.pages.map((_,i)=>`<div class="invoice-paper">${invoicePageSVG(result,i)}</div>`).join('');view=next;}
  async function refresh(requested=month.value) {
    active=true;month.value=requested;invalidate();const op=begin();status.textContent='実シートの集計を確認中…';
    try {await ready(op);const result=await api.readBilling({month:requested,signal:op.signal});check(op);summary=validateLiveBilling(result,requested);for(const c of summary.customers){const option=doc.createElement('option');option.value=c.key;option.textContent=`${c.name}（月次小計 ${c.monthlySubtotal === null ? '算出不可' : c.monthlySubtotal+'円'}）`;select.append(option);}status.textContent=summary.customers.length?'最新集計を確認しました。帳票は未確定です。':'対象の取引先がありません。';if(summary.warnings?.length)status.textContent+=' 警告：'+summary.warnings.map(v=>typeof v==='string'?v:'シート内容の確認が必要です').join('／');}
    catch(error){if(op.generation===generation){invalidate();status.textContent=error.message;}}
  }
  async function documentView(op, expected) {await ready(op);const dto=await api.readBillingDocument({month:expected.month,customerKey:expected.customerKey,kind:expected.kind,expectedSnapshotId:expected.snapshotId,signal:op.signal});check(op);return liveInvoiceView(dto,expected);}
  async function action(mode) {
    if(!summary||!select.value){status.textContent='先に最新集計を読み込んでください。';return;}
    if(!confirm.checked){status.textContent='手入力情報・宛先と金額・未確定であることの確認にチェックしてください。';return;}
    let entry;try{entry=readEntries();}catch(error){status.textContent=error.message;return;}
    const expected={month:month.value,customerKey:select.value,kind:kind.value,snapshotId:summary.snapshotId};const op=begin();clear();status.textContent='最新の権限・集計を照合中…';
    try {
      let next=applyEntries(await documentView(op,expected),entry);
      // Only the existing public default asset is used; never local overrides.
      try{next.seal=await loadSeal(doc);}catch{next.seal=null;}check(op);
      if(mode==='preview'){render(next);status.textContent=DRAFT;return;}
      if(mode==='pdf'){
        const blob=await makePDF(next,doc);check(op);
        // Rendering can be slow. Recheck membership, pending writes and snapshot
        // immediately before exposing any generated bytes to the user.
        await documentView(op,expected);check(op);
        blobURL=win.URL.createObjectURL(blob);const anchor=doc.createElement('a');anchor.href=blobURL;anchor.download=`確認用_${expected.month}_${expected.kind}.pdf`;host.append(anchor);anchor.click();anchor.remove();win.URL.revokeObjectURL(blobURL);blobURL=null;status.textContent='未確定の確認用PDFを保存しました。';
      }else{
        next=Object.assign(applyEntries(await documentView(op,expected),entry),{seal:next.seal});check(op);render(next);printing=true;preview.setAttribute('data-live-print','');win.print();preview.removeAttribute('data-live-print');printing=false;status.textContent=DRAFT;
      }
    }catch(error){if(op.generation===generation){invalidate();status.textContent=error.message+' 最新集計を再読込してください。';}}
  }
  const listeners=[];function on(target,event,fn){target.addEventListener(event,fn);listeners.push(()=>target.removeEventListener(event,fn));}
  on(q('[data-refresh]'),'click',()=>refresh());on(q('[data-preview]'),'click',()=>action('preview'));on(q('[data-pdf]'),'click',()=>action('pdf'));on(q('[data-print]'),'click',()=>action('print'));
  // Kind/customer/issuer edits invalidate document work only. A summary load
  // has no document yet and must finish even if these controls are edited.
  function invalidateOutput() {if(summary){generation++;controller?.abort();}clear();}
  for(const input of entries)on(input,'input',invalidateOutput);
  on(month,'change',()=>refresh());for(const element of [select,kind])on(element,'change',invalidateOutput);
  on(win,'pagehide',()=>{active=false;clearEntries();invalidate();});on(win,'pageshow',event=>{if(event.persisted){active=false;clearEntries();invalidate();}});
  on(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden')invalidate();});
  on(win,'beforeprint',()=>{if(!printing)invalidate();});on(win,'afterprint',()=>invalidate());
  on(doc,'keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='p'&&active){event.preventDefault();invalidate();status.textContent='最新集計を読み込み、確認用帳票の印刷ボタンを使用してください。';}});
  const unsubscribe=session.subscribe(()=>{clearEntries();invalidate();});
  const hide=()=>{active=false;clearEntries();invalidate();};const dispose=()=>{hide();disposed=true;unsubscribe?.();listeners.forEach(fn=>fn());host.replaceChildren();};
  return {refresh,show:()=>refresh(),hide,invalidate,destroy:dispose,dispose};
}
