import { createDemoSession } from './session.js';
import { installMasterReorder } from './master-reorder.js';
import { installInvoiceOutput } from './invoice.js';
import { installInvoiceSettings, INVOICE_SETTINGS_KEY } from './invoice-settings.js';
import { installInputAssist } from './input-assist.js';
import { startUpdates } from './updates.js';
import * as D from './domain.js';
import { STORAGE_KEY as LEGACY_KEY, localDate } from './model.js';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amount = v => v===null||v===undefined||v===''?'ー':new Intl.NumberFormat('ja-JP',{maximumFractionDigits:6}).format(Number(v));
const time = v => new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v));
const pages={report:['報告','＋'],browse:['閲覧・編集','▤'],summary:['集計','▥'],output:['出力','⇧'],settings:['設定','⚙']};
function navIcon(key){const paths={report:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h5M8 17h3"/>',browse:'<path d="M12 4H5v17h14v-7M8 8h3M8 12h2M14 8l5-5 3 3-5 5-4 1z"/>',summary:'<path d="M3 3v18h18"/><rect x="6" y="12" width="3" height="5" rx=".5"/><rect x="12" y="7" width="3" height="10" rx=".5"/><rect x="18" y="4" width="3" height="13" rx=".5"/>',output:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',settings:'<path d="M3 6h4m4 0h10M3 12h10m4 0h4M3 18h2m4 0h12"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="18" r="2"/>'};return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;}
const titles={customers:'取引先',members:'メンバー',items:'処分物品'};
let invoiceOutput, invoiceSettings, state, storageFailed=false, pending=false, reportDirty=false, modalDirty=false, currentPage='report', currentRoute='report', selectedCustomerId=null, customerSection=null, priceDirty=false, priceContext=null, browseTab='list', masterType='members', masterSelectionMode=false, selectedMasterId=null, period='month', modalContext=null, dialogOrigin=null, toastTimer;
const IS_CALCULATION_SAMPLE=new URLSearchParams(location.search).get('example')==='calculation';
const APP_STORAGE_KEY=IS_CALCULATION_SAMPLE?D.STORAGE_KEY_V3+':calculation-v1':D.STORAGE_KEY_V3;
const ISSUER_STORAGE_KEY=IS_CALCULATION_SAMPLE?INVOICE_SETTINGS_KEY+':calculation-v1':INVOICE_SETTINGS_KEY;
let calculationDraftOffered=false;
let masterReorder=null,masterReorderMode=false,reorderContext=null;
const dialog=$('#main-dialog'),confirmDialog=$('#confirm-dialog'),sessionDialog=$('#demo-session-dialog');
const demoSession=createDemoSession({getStorage:()=>window.sessionStorage});
function read(){const raw=localStorage.getItem(APP_STORAGE_KEY);return raw===null?null:D.upgradeInitialItems(JSON.parse(raw));}
function fail(error){storageFailed=true;$('#global-error').hidden=false;$('#global-error').textContent=`端末内データを保護するため変更を止めています。保存形式・空き容量・ブラウザ設定を確認してください。元データは削除していません。${error.message}`;}
function initialize(ready){
 let finished=false;const finish=()=>{if(finished)return;finished=true;ready();};
 const recover=error=>{state=D.createSampleState();state.records=[];state.history=[];fail(error);finish();};
 const perform=()=>{try{
  const raw=localStorage.getItem(APP_STORAGE_KEY);
  if(raw!==null)state=D.upgradeInitialItems(JSON.parse(raw));
  else if(IS_CALCULATION_SAMPLE)state=D.createCalculationSampleState();else{const old=localStorage.getItem(LEGACY_KEY);state=old===null?D.createSampleState():D.migrateState(JSON.parse(old));}
  const next=JSON.stringify(state);
  if(next!==raw){if(localStorage.getItem(APP_STORAGE_KEY)!==raw)throw new Error('別の画面で保存が更新されました。上書きせず止めました。再読み込みしてください。');localStorage.setItem(APP_STORAGE_KEY,next);}
 }catch(error){recover(error);return;}finish();};
 try{const promise=navigator.locks?.request?navigator.locks.request(`${APP_STORAGE_KEY}:mutation`,perform):perform();promise?.catch(error=>{if(!finished)recover(error);});}catch(error){if(!finished)recover(error);}
}
async function mutate(operation,{render=true}={}){const perform=()=>{if(storageFailed)throw new Error('保存を利用できません。');let fresh;try{fresh=read();if(!fresh)throw new Error('保存データが消去されました。再読み込みしてください。');}catch(e){fail(e);throw e;}state=fresh;const actor=demoSession.require(fresh);const result=operation(fresh,actor.id);try{localStorage.setItem(APP_STORAGE_KEY,JSON.stringify(result.state));}catch(e){fail(e);throw new Error('保存できませんでした。入力を残しています。');}state=result.state;if(render)renderSecondary();return result;};return navigator.locks?.request?navigator.locks.request(`${APP_STORAGE_KEY}:mutation`,perform):perform();}
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),5000);}
function options(type,selected='',placeholder='選択してください',includeId=''){return `<option value="">${esc(placeholder)}</option>`+state.masters[type].filter(x=>x.active||x.id===includeId).map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(D.displayName(state,type,x.id))}</option>`).join('');}
function sessionAttribution(label='編集者'){const member=demoSession.current(state);return `<p class="session-attribution">${esc(label)} <strong data-demo-user-name>${esc(member?.name??'未選択')}</strong></p>`;}
function renderSessionIdentity(){const member=demoSession.current(state);$$('[data-demo-user-name]').forEach(el=>{el.textContent=member?.name??'未選択';el.title=member?.name??'未選択';});$('#demo-session-storage-note').hidden=demoSession.storageAvailable;}
function showDemoSession(){
 const current=demoSession.current(state),selection=$('#demo-session-member').value;
 $('#demo-session-member').innerHTML=options('members',current?.id??selection,'利用者を選択');
 $('#cancel-demo-session').hidden=!current;$('#demo-session-error').hidden=true;
 if(!sessionDialog.open)sessionDialog.showModal();$('#demo-session-member').focus();
}
function ensureDemoSession(){renderSessionIdentity();if(!pending&&!storageFailed&&!demoSession.current(state))showDemoSession();}
$('#demo-session-form').addEventListener('submit',e=>{e.preventDefault();if(pending||!e.currentTarget.reportValidity())return;try{const fresh=read();if(!fresh)throw new Error('保存データを確認できません。再読み込みしてください。');state=fresh;demoSession.select(state,$('#demo-session-member').value);sessionDialog.close();renderSessionIdentity();}catch(error){showError('demo-session-error',error);}});
$('#cancel-demo-session').addEventListener('click',()=>{if(!pending&&demoSession.current(state))sessionDialog.close();});
sessionDialog.addEventListener('cancel',e=>{if(pending||!demoSession.current(state))e.preventDefault();});
function errorHTML(id){return `<div id="${id}" class="form-error" role="alert" tabindex="-1" hidden></div>`;}
function showError(id,error){const el=$(`#${id}`);el.hidden=false;el.textContent=error.message||String(error);el.focus();}
function numeric(name,label,value,unit=''){return `<label class="field"><span class="field-label">${label}${unit?` <small>${unit}</small>`:''}</span><input type="number" inputmode="decimal" enterkeyhint="next" min="0" max="1000000000" step="any" name="${esc(name)}" value="${value??''}" placeholder="未入力"></label>`;}
function noteFields(key,record,prefix){
 const notes=D.reportNotes(record),name=prefix+(key==='other'?'otherItem':'notes:'+key);
 return `<div class="category-notes field full"><label class="field"><span class="field-label">備考 <small>任意・自由入力</small></span><textarea name="${esc(name)}" rows="2" maxlength="500" placeholder="内容や補足を入力">${esc(notes[key])}</textarea></label>${record.itemIds?.[key]?`<p class="rate-note">以前の処分物品：${esc(D.displayName(state,'items',record.itemIds[key],record.itemNames?.[key]))}（記録に保持）</p>`:''}</div>`;
}
function measures(customer,record,prefix='',editing=false){return Object.keys(D.CATEGORIES).map(k=>{if(k==='other'){const used=editing&&(record.otherFee!==null||D.reportNotes(record).other||record.itemIds?.other);return `<div class="category-block"><label class="check-label"><input type="checkbox" data-use-other="${esc(prefix)}" ${used?'checked':''}>その他も報告する</label><div class="other-fields form-grid" data-other-fields="${esc(prefix)}" ${used?'':'hidden'}>${noteFields(k,record,prefix)}${numeric(prefix+'otherFee','当回の金額',record.otherFee,'円')}</div><p class="rate-note">設定の初期金額を表示。今回だけ変更しても設定は変わりません。</p></div>`;}return `<div class="category-block"><h3>${D.CATEGORIES[k]}</h3><div class="form-grid">${numeric(prefix+k+'Kg','重量',record[k+'Kg'],'kg')}${numeric(prefix+k+'Rate','当回の単価',record[k+'Rate'],'円 / kg・仮仕様')}${noteFields(k,record,prefix)}</div><p class="rate-note">単価は今回だけ編集できます。請求額の自動計算はしません。</p></div>`;}).join('');}
function enforceOther(scope){scope.querySelectorAll('[data-other-fields]').forEach(box=>{box.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=box.hidden);});}
let reportRowSequence=0,activeReportRowId=null,reportTabsObserver=null;
function reportRowHTML(){const id=`report-row-${++reportRowSequence}`;return `<article class="entry-card" id="${id}" role="tabpanel" aria-labelledby="${id}-tab" data-report-row="${id}" data-entry="" hidden><div class="entry-customer-header"><label class="field"><span class="field-label">取引先<span class="required">必須</span></span><select data-report-customer name="${id}:customerId" required>${options('customers','','取引先を選択')}</select></label><button class="button secondary danger-text" type="button" data-remove-report-row aria-label="この入力行を削除">削除</button></div><div class="entry-fields" hidden></div></article>`;}
function reportRows(){return $$('#report-form [data-report-row]');}
function reportRowLabel(row,index){return row.dataset.entry?D.displayName(state,'customers',row.dataset.entry):`取引先 ${index+1}（未選択）`;}
function revealReportTab(tab){
 if(!tab)return;const strip=$('#report-tabs'),bounds=strip.getBoundingClientRect(),item=tab.getBoundingClientRect();
 // Scroll only the tab strip; changing customers must not move the whole page.
 if(item.left<bounds.left)strip.scrollLeft-=bounds.left-item.left;
 else if(item.right>bounds.right)strip.scrollLeft+=item.right-bounds.right;
}
function selectReportRow(id,{focusTab=false,reveal=true}={}){
 const rows=reportRows(),row=rows.find(row=>row.dataset.reportRow===id)??rows[0];activeReportRowId=row?.dataset.reportRow??null;
 rows.forEach(item=>item.hidden=item!==row);
 $$('#report-tabs [data-report-tab]').forEach(tab=>{const selected=tab.dataset.reportTab===activeReportRowId;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
 const label=$('#report-active-customer');label.hidden=!row;label.textContent=row?`入力中：${reportRowLabel(row,rows.indexOf(row))}`:'';
 const tab=row?document.getElementById(`${activeReportRowId}-tab`):null;if(focusTab)tab?.focus({preventScroll:true});if(reveal)revealReportTab(tab);
}
function refreshReportChoices(){
 const rows=reportRows(),chosen=rows.map(row=>row.dataset.entry).filter(Boolean),available=D.activeMasters(state,'customers').length;
 rows.forEach((row,index)=>{const select=row.querySelector('[data-report-customer]');select.setAttribute('aria-label',`取引先 ${index+1}`);[...select.options].forEach(option=>option.disabled=!!option.value&&chosen.includes(option.value)&&option.value!==row.dataset.entry);row.querySelector('[data-remove-report-row]').setAttribute('aria-label',`${reportRowLabel(row,index)}の入力行を削除`);});
 const strip=$('#report-tabs'),scroll=strip.scrollLeft;strip.innerHTML=rows.map(row=>`<button type="button" class="report-tab" id="${row.dataset.reportRow}-tab" role="tab" aria-selected="false" aria-controls="${row.dataset.reportRow}" tabindex="-1" data-report-tab="${row.dataset.reportRow}"><span class="report-tab-name"></span></button>`).join('');layoutReportTabs();strip.scrollLeft=scroll;
 $('#selected-count').textContent=`${chosen.length}件入力`;$('#add-report-row').disabled=storageFailed||rows.length>=available;$('#report-empty').hidden=rows.length>0;
 selectReportRow(activeReportRowId);
}
function layoutReportTabs(){
 const strip=$('#report-tabs');if(!strip)return;
 const rows=reportRows(),tabs=[...strip.querySelectorAll('[data-report-tab]')],named=rows.length<=3;
 const labelTabs=mode=>{
  strip.dataset.labelMode=mode;
  tabs.forEach((tab,index)=>{
   const row=rows[index],ordinal=`取引先${index+1}`,company=row.dataset.entry?D.displayName(state,'customers',row.dataset.entry):'',label=mode==='names'?(company||ordinal):mode==='numbered'?ordinal:String(index+1);
   // Keep the full company and row number accessible even when the visible label is shortened.
   tab.title=company?`${ordinal}：${company}`:ordinal;tab.setAttribute('aria-label',tab.title);
   const name=tab.querySelector('.report-tab-name');
   if(mode==='numbered')name.innerHTML=`<span class="report-tab-prefix">取引先</span><span>${index+1}</span>`;else name.textContent=label;
  });
 };
 labelTabs(named?'names':'numbered');
 // Measure the actual rendered strip, including font size, gaps and the separate Add button.
 // Never shrink touch targets below 44 px: numeric tabs may still scroll at large counts.
 if(!named&&strip.clientWidth>0&&strip.scrollWidth>strip.clientWidth+1)labelTabs('numbers');
 revealReportTab(document.getElementById(`${activeReportRowId}-tab`));
}
function observeReportTabs(){
 reportTabsObserver?.disconnect();
 if(window.ResizeObserver){let width=-1;reportTabsObserver=new window.ResizeObserver(entries=>{const next=entries[0]?.contentRect.width;if(next===width)return;width=next;layoutReportTabs();});reportTabsObserver.observe($('#report-tabs'));}
}
window.addEventListener('resize',layoutReportTabs);
function renderReport(){const today=localDate(),available=D.activeMasters(state,'customers').length;reportRowSequence=0;activeReportRowId=null;$('#report-form-host').innerHTML=`<form id="report-form" novalidate data-master-revision="${state.masterRevision}">${errorHTML('report-error')}<div class="report-meta"><div class="form-grid"><label class="field"><span class="field-label">回収日<span class="required">必須</span></span><input name="date" type="date" value="${today}" required></label><div class="field report-user"><span class="field-label">報告者</span><output class="report-user-name" data-demo-user-name>${esc(demoSession.current(state)?.name??'未選択')}</output></div></div></div><div class="batch-title"><h2>入力する取引先</h2><span class="page-chip" id="selected-count" aria-live="polite">0件入力</span></div><p class="form-note" id="report-tabs-help">「＋ 追加」で取引先を増やし、タブで入力欄を切り替えます。タブが隠れている場合は横にスクロールできます。</p><div class="report-workspace"><p class="sr-only" id="report-active-customer" aria-live="polite" aria-atomic="true"></p><div class="report-tab-toolbar"><div id="report-tabs" class="report-tabs" role="tablist" aria-label="入力する取引先" aria-orientation="horizontal" aria-describedby="report-tabs-help"></div><button class="button secondary add-report-row" type="button" id="add-report-row" aria-label="取引先を追加" title="取引先を追加" ${storageFailed||!available?'disabled':''}><span aria-hidden="true">＋</span> 追加</button></div><div class="card-list" id="report-rows">${available?reportRowHTML():''}</div><p class="empty-state" id="report-empty" ${available?'hidden':''}>${available?'「＋ 追加」から入力を始めてください。':'有効な取引先がありません。設定から追加してください。'}</p></div><div class="report-save"><p>空欄と0を区別します。<br>すべてのタブの入力を確認してから一括保存します。</p><button class="button primary" type="submit" id="save-report" ${storageFailed?'disabled':''}>入力分を保存</button></div></form>`;reportDirty=false;refreshReportChoices();observeReportTabs();if(IS_CALCULATION_SAMPLE&&!calculationDraftOffered&&!state.records.length)fillCalculationSampleDraft();}
function fillCalculationSampleDraft(){
 calculationDraftOffered=true;
 for(const example of D.calculationSampleRows()){
  let row=reportRows().find(r=>!r.dataset.entry);if(!row){$('#report-rows').insertAdjacentHTML('beforeend',reportRowHTML());row=reportRows().at(-1);}
  const select=row.querySelector('[data-report-customer]');select.value=example.customerId;changeReportCustomer(select);
  for(const key of ['combustibleKg','noncombustibleKg','otherFee'])row.querySelector(`[name="${example.customerId}:${key}"]`).value=example[key];
  const checkbox=row.querySelector('[data-use-other]');checkbox.checked=true;checkbox.parentElement.nextElementSibling.hidden=false;enforceOther(row);
 }
 activeReportRowId=reportRows()[0].dataset.reportRow;refreshReportChoices();reportDirty=true;
}
function confirmReportRow({title,body,label,origin,apply}){
 $('#confirm-content').innerHTML=`<div class="dialog-head"><h2 id="confirm-title">${title}</h2></div><div class="dialog-body"><p class="confirm-text">${body}</p></div><div class="dialog-foot"><button class="button secondary" type="button" id="cancel-report-row">入力を残す</button><button class="button danger" type="button" id="confirm-report-row">${label}</button></div>`;
 confirmDialog.showModal();$('#cancel-report-row').onclick=()=>{confirmDialog.close();origin?.focus();};$('#confirm-report-row').onclick=()=>{confirmDialog.close();apply();};$('#cancel-report-row').focus();
}
function changeReportCustomer(select){
 const row=select.closest('[data-report-row]'),previous=row.dataset.entry,next=select.value;select.value=previous;selectReportRow(row.dataset.reportRow);
 if(next===previous)return;
 const customer=state.masters.customers.find(c=>c.id===next&&c.active);
 if(next&&(!customer||reportRows().some(other=>other!==row&&other.dataset.entry===next))){showError('report-error',new Error(customer?'同じ取引先は1つの入力行にまとめてください。':'この取引先は現在利用できません。設定を確認してください。'));return;}
 const apply=()=>{if(next&&reportRows().some(other=>other!==row&&other.dataset.entry===next)){showError('report-error',new Error('同じ取引先は1つの入力行にまとめてください。'));return;}const current=state.masters.customers.find(c=>c.id===next&&c.active);if(next&&!current){showError('report-error',new Error('この取引先は現在利用できません。入力中の内容は残しています。'));return;}const fields=next?measures(current,D.reportDefaults(state,next),next+':'):'';row.dataset.entry=next;select.value=next;const box=row.querySelector('.entry-fields');box.innerHTML=fields;box.hidden=!next;enforceOther(box);reportDirty=true;$('#report-error').hidden=true;refreshReportChoices();select.focus();};
 if(previous){const oldName=D.displayName(state,'customers',previous);confirmReportRow({title:'この行の取引先を変更しますか？',body:`${esc(oldName)}の入力内容と今回の単価変更を破棄します。ほかの行の入力は残ります。`,label:'破棄して変更',origin:select,apply});}else apply();
}
function removeReportRow(row){
 selectReportRow(row.dataset.reportRow);const origin=row.querySelector('[data-remove-report-row]'),apply=()=>{const rows=reportRows(),index=rows.indexOf(row);activeReportRowId=(rows[index+1]??rows[index-1])?.dataset.reportRow??null;row.remove();reportDirty=true;$('#report-error').hidden=true;refreshReportChoices();if(activeReportRowId)selectReportRow(activeReportRowId,{focusTab:true});else $('#add-report-row').focus();};
 if(row.dataset.entry)confirmReportRow({title:'この入力行を削除しますか？',body:`${esc(D.displayName(state,'customers',row.dataset.entry))}の未保存の入力を削除します。ほかの行や保存済みの記録は変わりません。`,label:'この行を削除',origin,apply});else apply();
}
function validateReportRows(){
 const rows=reportRows(),ids=rows.map(row=>row.querySelector('[data-report-customer]').value);let message='',invalid=-1;
 if(!rows.length)message='「＋ 追加」から入力する取引先を選択してください。';
 else if((invalid=ids.findIndex(id=>!id))>=0)message='未選択のタブがあります。取引先を選択するか、その入力行を削除してください。';
 else if((invalid=ids.findIndex((id,index)=>ids.indexOf(id)!==index))>=0)message='同じ取引先は1つの入力行にまとめてください。';
 else if((invalid=rows.findIndex((row,index)=>row.dataset.entry!==ids[index]))>=0)message='取引先を選び直してから保存してください。';
 if(message){if(invalid>=0)selectReportRow(rows[invalid].dataset.reportRow);showError('report-error',new Error(message));if(invalid>=0)rows[invalid].querySelector('[data-report-customer]').focus();return false;}return true;
}
function validateReportForm(form){
 if(!validateReportRows())return false;
 // Native submit validation would try to focus controls in hidden panels. Reveal the first invalid panel before showing its message.
 const invalid=[...form.elements].find(el=>el.willValidate&&!el.validity.valid);
 if(!invalid)return true;const row=invalid.closest('[data-report-row]');if(row)selectReportRow(row.dataset.reportRow);invalid.focus();invalid.reportValidity();return false;
}
function readMeasures(form,prefix){const value=n=>form.elements.namedItem(prefix+n)?.value??'';const other=form.querySelector(`[data-use-other="${prefix}"]`)?.checked;return {combustibleKg:value('combustibleKg'),noncombustibleKg:value('noncombustibleKg'),combustibleRate:value('combustibleRate'),noncombustibleRate:value('noncombustibleRate'),otherFee:other?value('otherFee'):'',otherItem:other?value('otherItem'):'',categoryNotes:{combustible:value('notes:combustible'),noncombustible:value('notes:noncombustible')}};}
function recordName(r){return D.displayName(state,'customers',r.customerId,r.customerName);}
function personName(r,key){return D.displayName(state,'members',r[key+'Id'],r[key]);}
function itemText(r){return Object.keys(D.CATEGORIES).filter(k=>r.itemIds[k]).map(k=>`${D.CATEGORIES[k]}: ${D.displayName(state,'items',r.itemIds[k],r.itemNames[k])}`).join(' / ');}
function noteText(r){const values=Object.values(D.reportNotes(r)).filter(Boolean);return values.length?'備考: '+values.join(' / '):'';}
function reportNotesHTML(r){return `<p class="card-meta report-notes">${esc(noteText(r))}</p>${itemText(r)?`<p class="card-meta">以前の処分物品: ${esc(itemText(r))}</p>`:''}`;}
function quantities(r){return `<div class="report-info"><div><small>可燃</small><strong>${amount(r.combustibleKg)}${r.combustibleKg!==null?' kg':''}</strong></div><div><small>不燃</small><strong>${amount(r.noncombustibleKg)}${r.noncombustibleKg!==null?' kg':''}</strong></div><div><small>その他</small><strong>${amount(r.otherFee)}${r.otherFee!==null?' 円':''}</strong></div></div>`;}
function renderBrowse(){const month=$('#browse-month').value,query=$('#browse-search').value.trim().toLowerCase();const records=state.records.filter(r=>r.deleted===(browseTab==='trash')&&(!month||r.date.startsWith(month))&&[recordName(r),noteText(r),itemText(r),personName(r,'createdBy'),personName(r,'lastEditedBy')].join(' ').toLowerCase().includes(query)).sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt));$('#browse-list').innerHTML=records.map(r=>`<article class="record-card"><p class="card-meta record-date">${r.date}${r.deleted?' · 削除済み':''}</p><div class="record-card-heading"><h2>${esc(recordName(r))}</h2><button class="button secondary" data-detail="${esc(r.id)}" aria-label="${esc(recordName(r))} ${r.date}の詳細">詳細</button></div>${quantities(r)}${r.deleted?`<div class="trash-restore"><button class="button secondary" data-record-action="restore" data-id="${esc(r.id)}" data-version="${r.version}" ${storageFailed?'disabled':''}>復旧</button></div>`:''}</article>`).join('')||'<div class="empty-state">この期間・条件の記録はありません。</div>';}

function historyHTML(e){const labels={create:'作成',update:'編集',delete:'削除',restore:'復元'};const r=e.after;const summary=x=>x?`${x.date} ${recordName(x)}\n可燃 ${amount(x.combustibleKg)} kg / 単価 ${amount(x.combustibleRate)} 円\n不燃 ${amount(x.noncombustibleKg)} kg / 単価 ${amount(x.noncombustibleRate)} 円\nその他 ${amount(x.otherFee)} 円\n${noteText(x)}\n${itemText(x)}\n${x.deleted?'削除済み':'有効'}`:'なし';return `<article class="history-event"><div class="history-event-head"><span class="event-action ${e.action==='delete'?'delete':''}">${labels[e.action]}</span>${esc(D.displayName(state,'members',e.actorId,e.actor))}<time>${esc(time(e.timestamp))} JST</time></div><h3>${esc(recordName(r))} · ${r.date}</h3><p>v${e.version} / ID ${esc(e.recordId)}</p><details><summary>変更前後を確認</summary><pre>変更前\n${esc(summary(e.before))}\n\n変更後\n${esc(summary(e.after))}</pre></details></article>`;}
function renderSummary(){try{const labels=D.summaryPeriodLabels(period,$('#period-value').value);$('#period-display').textContent=labels.label;$('#period-era').textContent=`（${labels.era}）`;const data=D.summarize(state,{period,value:$('#period-value').value});$('#summary-list').innerHTML=data.map(x=>`<article class="summary-card"><h2>${esc(x.name)}</h2><p class="card-meta">${x.count}件の記録</p><dl class="summary-values"><div><dt>可燃</dt><dd>${esc(x.combustibleKg)} <small>kg</small></dd><small>未入力 ${x.missingCombustible}件</small></div><div><dt>不燃</dt><dd>${esc(x.noncombustibleKg)} <small>kg</small></dd><small>未入力 ${x.missingNoncombustible}件</small></div><div><dt>その他</dt><dd>${amount(x.otherFee)} <small>円</small></dd><small>入力した金額 · 未入力 ${x.missingOther}件・請求額ではありません</small></div></dl></article>`).join('')||'<div class="empty-state">この期間の記録はありません。</div>';}catch(e){$('#period-display').textContent='期間を選択';$('#period-era').textContent='';$('#summary-list').innerHTML=`<div class="info-note">${esc(e.message)}</div>`;}}
function masterSummary(m,type){if(type==='items')return '登録された処分物品';if(type==='members')return '報告・操作の履歴に記録する利用者';return Object.keys(D.CATEGORIES).map(k=>`${D.CATEGORIES[k]} ${amount(m.rates[k])}${k==='other'?'円':'円/kg'}`).join(' · ');}
function customerRoute(id,section=''){return `settings/customers/${encodeURIComponent(id)}${section?'/'+section:''}`;}
function settingsBack(route,label){return `<button type="button" class="settings-back" data-settings-route="${esc(route)}">‹ ${esc(label)}</button>`;}
function renderMasterSelectionActions(){
 const box=$('#master-selection-actions');box.hidden=!masterSelectionMode||!!selectedCustomerId;
 if(box.hidden){box.innerHTML='';return;}
 const m=state.masters[masterType].find(x=>x.id===selectedMasterId&&(x.active||$('#show-inactive').checked));if(!m)selectedMasterId=null;
 const disabled=!m||storageFailed?'disabled':'';
 box.innerHTML=`<button class="button secondary danger-text" id="master-delete" ${m?`data-toggle-master="${esc(m.id)}" data-version="${m.version}"`:''} ${disabled}>${m&&!m.active?'復元':'削除'}</button><button class="button secondary" id="master-copy" ${m?`data-copy-master="${esc(m.id)}"`:''} ${disabled}>複製</button>`;
 box.setAttribute('aria-label',m?`${D.displayName(state,masterType,m.id)}への操作`:'対象を選択してください');
}
function compactMasterRow(m){
 const name=esc(D.displayName(state,masterType,m.id)),rowClass={members:'master-member',customers:'master-customer',items:'master-item'}[masterType];
 const details=`<div class="card-actions"><button class="button secondary" ${masterType==='members'?`data-member-detail="${esc(m.id)}"`:masterType==='items'?`data-item-detail="${esc(m.id)}"`:`data-settings-route="${esc(customerRoute(m.id))}" data-open-customer="${esc(m.id)}"`} aria-label="${name}の詳細">詳細</button></div>`;
 return `<article data-master-id="${esc(m.id)}" class="master-card master-compact ${rowClass} ${m.active?'':'inactive'} ${selectedMasterId===m.id&&masterSelectionMode?'is-selected':''}">${masterSelectionMode?`<label class="master-choice"><span class="master-name" title="${name}">${name}</span><input type="radio" name="masterSelection" data-master-select="${esc(m.id)}" aria-label="${name}を選択" ${selectedMasterId===m.id?'checked':''}></label>`:`<h2 title="${name}">${name}</h2>${masterReorderMode?'':details}`}</article>`;
}
function resetMasterSelection(){masterSelectionMode=false;selectedMasterId=null;}
function renderCustomerDialog(){
 if(currentPage!=='settings'||!selectedCustomerId)return;
 if(dialog.open&&modalContext?.kind==='master')return;
 const selected=state.masters.customers.find(c=>c.id===selectedCustomerId);
 if(!dialogOrigin)dialogOrigin={attribute:'data-open-customer',value:selectedCustomerId};
 if(!selected){showDialog(`${head('取引先の詳細')}<div class="dialog-body"><p class="info-note">この取引先は見つかりません。取引先一覧に戻ってください。</p></div><div class="dialog-foot"><button class="button secondary" data-close-dialog>閉じる</button></div>`,{kind:'customer-missing'});return;}
 const name=esc(D.displayName(state,'customers',selected.id));
 if(customerSection==='prices'){
  if(priceContext?.id===selected.id&&(priceDirty||pending)&&$('#price-form'))return;
  priceContext={id:selected.id,version:selected.version,snapshot:D.clone(selected)};
  showDialog(`${head('値段',name)}<form id="price-form"><div class="dialog-body customer-prices">${settingsBack(customerRoute(selected.id),'取引先の詳細に戻る')}<p class="form-note">この取引先の初期値です。空欄の場合のみ、処分物品の共通値を使います。報告時に今回だけ変更できます。過去の記録は書き換えません。</p>${errorHTML('price-error')}${Object.keys(D.CATEGORIES).map(k=>`<div class="setting-category"><h3>${D.CATEGORIES[k]}</h3>${numeric('rate:'+k,k==='other'?'初期金額':'初期単価',selected.rates[k],k==='other'?'円':'円/kg・仮仕様')}</div>`).join('')}${sessionAttribution()}<p class="form-note">自由入力。空欄と0を区別します。税・請求計算は未実装です。</p></div><div class="dialog-foot price-actions"><button type="button" class="button secondary" data-settings-route="${esc(customerRoute(selected.id))}">キャンセル</button><button type="button" class="button primary" id="save-prices">値段を保存</button></div></form>`,{kind:'customer-prices',id:selected.id,version:selected.version});
 }else{
  priceContext=null;
  if(dialog.open&&modalContext?.kind==='customer-detail'&&modalContext.id===selected.id&&modalContext.version===selected.version)return;
  showMasterPanel('customers',selected.id,false);
 }
}
function reorderDirty(){return !!masterReorderMode&&!!masterReorder?.getDirty();}
function finishMasterReorder(render=true){
 masterReorderMode=false;reorderContext=null;const controller=masterReorder;masterReorder=null;controller?.destroy();
 if(render)renderSettings();
}
function startMasterReorder(){
 if(storageFailed||pending||masterReorderMode)return;
 resetMasterSelection();masterReorderMode=true;reorderContext={type:masterType,revision:state.masterRevision,allIds:state.masters[masterType].map(m=>m.id),visibleIds:state.masters[masterType].filter(m=>m.active||$('#show-inactive').checked).map(m=>m.id),draggedId:null};
 $('#master-reorder-error').hidden=true;renderSettings();
 masterReorder=installMasterReorder({container:$('#settings-list'),getRevision:()=>state.masterRevision,viewportInsets:{top:10,bottom:85},onDraftChange:({draggedId})=>{if(reorderContext)reorderContext.draggedId=draggedId;},onError:error=>showError('master-reorder-error',error),onStatusChange:status=>{if(!masterReorderMode)return;if(!status.enabled){finishMasterReorder();return;}$('#save-master-reorder').disabled=storageFailed||pending||status.dragging||!status.dirty;}});
 masterReorder.setEnabled(true);
}
async function saveMasterReorder(){
 if(!masterReorderMode||!masterReorder||masterReorder.dragging)return;
 const controller=masterReorder,ctx=reorderContext,draft=controller.getOrder(),visible=new Set(ctx.visibleIds);let i=0;
 const complete=ctx.allIds.map(id=>visible.has(id)?draft[i++]:id);
 await saving($('#save-master-reorder'),'master-reorder-error',async()=>{
  controller.setBusy(true);
  try{await mutate((s,actor)=>D.reorderMasters(s,ctx.type,complete,ctx.revision,actor,ctx.draggedId??draft[0]),{render:false});finishMasterReorder(false);renderSecondary();if(!reportDirty)renderReport();toast('並び順を保存しました。');}
  finally{controller.setBusy(false);}
 });
 if(masterReorderMode)$('#save-master-reorder').disabled=!masterReorder.getDirty()||storageFailed;
}
function renderIssuerPanel(){
 const panel=$('#issuer-settings-panel');
 try{const config=invoiceSettings?.getSettings()??{},value=config.issuer??{},banks=config.bankAccounts??[],tax=config.tax??{};panel.innerHTML=`<section class="other-settings-group"><div class="other-settings-heading"><h2>会社情報</h2><button type="button" class="button secondary" data-invoice-settings="issuer">変更</button></div><dl class="issuer-summary">${Object.entries({tradeName:'会社名・屋号',legalName:'法人名・氏名',postalCode:'郵便番号',address:'住所',registrationNumber:'適格請求書発行事業者の登録番号'}).map(([key,label])=>`<div><dt>${label}</dt><dd>${esc(value[key]||'ー')}</dd></div>`).join('')}</dl></section><section class="other-settings-group"><div class="other-settings-heading"><h2>銀行情報</h2><button type="button" class="button secondary" data-invoice-settings="bank">変更</button></div><dl class="issuer-summary">${banks.length?banks.map((bank,i)=>`<div><dt>振込先${i+1}</dt><dd>${esc([bank.bankName,bank.branchName,({ordinary:'普通',checking:'当座',savings:'貯蓄'})[bank.accountType],bank.accountNumber,bank.accountHolder].filter(Boolean).join(' ' )||'ー')}</dd></div>`).join(''):'<div><dd>ー</dd></div>'}</dl><p class="form-note">実際の銀行情報は入力しないでください。</p></section><section class="other-settings-group"><div class="other-settings-heading"><h2>税率</h2><button type="button" class="button secondary" data-invoice-settings="tax">変更</button></div><dl class="issuer-summary"><div><dt>税率</dt><dd>${tax.rate!==null&&tax.rate!==undefined&&tax.rate!==''?esc(tax.rate)+'%':'ー'}</dd></div><div><dt>価格の扱い</dt><dd>${esc(({exclusive:'税抜',inclusive:'税込'})[tax.priceMode]||'ー')}</dd></div><div><dt>端数処理</dt><dd>${esc(({floor:'切り捨て',round:'四捨五入',ceil:'切り上げ'})[tax.rounding]||'ー')}</dd></div></dl><p class="form-note">税条件は設定の記録のみです。過去報告に推測で適用せず、正式な税額・請求額は未確定です。</p></section>`;}catch(error){panel.innerHTML=`<p class="form-error">${esc(error.message)}</p>`;}
}

function renderSettings(){
 if(masterReorderMode&&masterReorder)return;
 const issuer=['settings/other','settings/issuer'].includes(currentRoute);$('#issuer-settings-tab').classList.toggle('active',issuer);$('#issuer-settings-panel').hidden=!issuer;
 if(issuer){$$('[data-master-type]').forEach(b=>b.classList.remove('active'));$('.settings-toolbar').hidden=true;$('#settings-list').hidden=true;$('#settings-history').closest('details').hidden=true;renderIssuerPanel();return;}
 $('#settings-list').hidden=false;$('#settings-history').closest('details').hidden=false;
 $('#settings-tabs').hidden=false;$('.settings-toolbar').hidden=false;$('#settings-list-note').hidden=false;
 $('#reorder-masters').hidden=masterSelectionMode||masterReorderMode;$('#cancel-master-reorder').hidden=!masterReorderMode;$('#save-master-reorder').hidden=!masterReorderMode;$('#save-master-reorder').disabled=!reorderDirty()||storageFailed;$('#master-reorder-help').hidden=!masterReorderMode;$('#show-inactive').disabled=masterReorderMode;
 $('#select-masters').hidden=masterReorderMode;$('#select-masters').textContent=masterSelectionMode?'キャンセル':'選択';$('#select-masters').setAttribute('aria-pressed',String(masterSelectionMode));$('#new-master').hidden=masterSelectionMode||masterReorderMode;
 $('#show-inactive-label').textContent='削除済みも表示';renderMasterSelectionActions();
 $$('[data-master-type]').forEach(b=>b.classList.toggle('active',b.dataset.masterType===masterType));
 const items=state.masters[masterType].filter(x=>x.active||$('#show-inactive').checked);
 $('#settings-list').innerHTML=items.map(compactMasterRow).join('')||'<div class="empty-state">このリストに項目はありません。</div>';
 renderCustomerDialog();
 $('#settings-history').innerHTML=state.settingsHistory.filter(e=>['deactivate','reactivate'].includes(e.action)).reverse().map(settingsHistoryHTML).join('')||'<p class="card-meta">削除履歴はありません。</p>';
}
function settingsHistoryHTML(e){
 const m=state.masters[e.type]?.find(x=>x.id===e.masterId),latest=state.settingsHistory.filter(x=>x.type===e.type&&x.masterId===e.masterId&&['deactivate','reactivate'].includes(x.action)).at(-1);
 const canRestore=e.action==='deactivate'&&m&&!m.active&&latest===e&&!storageFailed;
 const restore=e.action==='deactivate'?`<button class="button secondary" data-restore-master-history="${esc(e.masterId)}" data-master-kind="${e.type}" data-version="${m?.version??0}" ${canRestore?'':'disabled'}>${m?.active?'復旧済み':latest!==e?'後の履歴あり':'復旧'}</button>`:'';
 return `<article class="history-event"><div class="history-event-head"><span class="event-action">${({deactivate:'削除',reactivate:'復元'})[e.action]}</span>${restore}</div><h3>${titles[e.type]} · ${esc(D.displayName(state,e.type,e.masterId,e.after.name))}</h3><p>${esc(D.displayName(state,'members',e.actorId,e.actor))} / ${esc(time(e.timestamp))} JST</p><details><summary>変更前後を確認</summary><pre>変更前: ${esc(e.before?JSON.stringify(e.before,null,2):'なし')}\n変更後: ${esc(JSON.stringify(e.after,null,2))}</pre></details></article>`;
}
$('#settings-help-toggle').addEventListener('click',()=>{const help=$('#settings-list-note');help.open=!help.open;$('#settings-help-toggle').setAttribute('aria-expanded',String(help.open));});
$('#settings-list-note').addEventListener('toggle',()=>$('#settings-help-toggle').setAttribute('aria-expanded',String($('#settings-list-note').open)));
function focusItemSettingsAction(id){setTimeout(()=>{if(currentPage==='settings'&&masterType==='items'&&!dialog.open&&!confirmDialog.open)$(id)?.focus();},0);}
function renderSecondary(){renderSessionIdentity();renderBrowse();renderSettings();renderSummary();invoiceOutput?.refresh();}
function switchPage(route){
 const changed=currentRoute!==route;if(changed){if(masterReorderMode)finishMasterReorder(false);resetMasterSelection();modalContext=null;priceContext=null;modalDirty=false;priceDirty=false;}
 const parts=String(route||'report').split('/');let page=parts[0];if(!pages[page]){page='report';route='report';}
 currentPage=page;document.body.dataset.page=page;currentRoute=route;selectedCustomerId=null;customerSection=null;
 Object.keys(pages).forEach(p=>$(`#${p}-section`).hidden=p!==page);$$('[data-nav]').forEach(b=>{b.classList.toggle('active',b.dataset.nav===page);if(b.dataset.nav===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});$('#breadcrumb-current').textContent=pages[page][0];
 if(page==='settings'){masterType=titles[parts[1]]?parts[1]:'members';try{selectedCustomerId=masterType==='customers'&&parts[2]?decodeURIComponent(parts[2]):null;}catch{selectedCustomerId=null;}customerSection=selectedCustomerId&&parts[3]==='prices'?'prices':null;renderSettings();}else priceContext=null;
 if(!selectedCustomerId&&(dialog.open||dialogOrigin))dismissDialog();
}
function rememberDialogOrigin(button){
 if(dialog.open)return;
 const attribute=['data-open-customer','data-member-detail','data-item-detail','data-detail','data-edit-master','data-copy-master'].find(a=>button.hasAttribute(a));
 dialogOrigin={element:button,...(attribute?{attribute,value:button.getAttribute(attribute)}:{id:button.id})};
}
function dismissDialog(){
 if(dialog.open)dialog.close();modalContext=null;modalDirty=false;$('#dialog-content').replaceChildren();dialog.classList.remove('customer-popup');
 const origin=dialogOrigin;dialogOrigin=null;
 let target=origin?.element?.isConnected?origin.element:origin?.attribute?$$(`[${origin.attribute}]`).find(el=>el.getAttribute(origin.attribute)===origin.value):origin?.id?document.getElementById(origin.id):null;
 if(target?.closest('section[hidden]'))target=null;
 (target??(currentPage==='settings'?$('#new-master'):document.querySelector(`[data-nav="${currentPage}"]`)))?.focus();
}
function requestDialogClose(){
 if(pending)return;
 if(currentPage==='settings'&&selectedCustomerId)return navigate('settings/customers');
 discard(dismissDialog);
}

function discard(then){if(pending||invoiceSettings?.isBusy())return;if(!reportDirty&&!modalDirty&&!priceDirty&&!reorderDirty()&&!invoiceSettings?.isDirty()){invoiceSettings?.close();then();return;}$('#confirm-content').innerHTML=`<div class="dialog-head"><h2 id="confirm-title">未保存の入力を破棄しますか？</h2></div><div class="dialog-body"><p class="confirm-text">入力中の内容は保存されていません。続ける場合は入力画面へ戻れます。</p></div><div class="dialog-foot"><button class="button secondary" id="keep-draft">入力を続ける</button><button class="button danger" id="discard-draft">破棄して進む</button></div>`;confirmDialog.showModal();$('#keep-draft').onclick=()=>confirmDialog.close();$('#discard-draft').onclick=()=>{confirmDialog.close();modalDirty=false;reportDirty=false;priceDirty=false;if(masterReorderMode)finishMasterReorder(false);invoiceSettings?.close({discard:true});if(dialog.open)dialog.close();renderReport();then();};$('#keep-draft').focus();}
function navigate(route){discard(()=>{if(currentRoute===route)return;priceContext=null;location.hash=route;switchPage(route);});}
function head(title,subtitle=''){return `<div class="dialog-head"><div><h2 id="dialog-title">${title}</h2><p>${subtitle}</p></div><button class="close-button" data-close-dialog aria-label="閉じる">×</button></div>`;}
function showDialog(html,context){modalContext=context;modalDirty=false;dialog.classList.toggle('customer-popup',context.kind.startsWith('customer-')||(context.kind==='master'&&context.type==='customers'));$('#dialog-content').innerHTML=html;if(!dialog.open)dialog.showModal();$('#dialog-content').scrollTop=0;$('#dialog-content').focus();}
function showDetail(id){const r=state.records.find(r=>r.id===id);if(!r)return toast('記録が変更されています。');showDialog(`${head('記録の詳細',`${r.deleted?'削除済み · ':''}v${r.version}`)}<div class="dialog-body"><h3 class="detail-title">${esc(recordName(r))}</h3><p>${r.date}</p>${quantities(r)}${reportNotesHTML(r)}<dl class="detail-meta"><div><dt>当回の可燃単価</dt><dd>${amount(r.combustibleRate)} 円/kg</dd></div><div><dt>当回の不燃単価</dt><dd>${amount(r.noncombustibleRate)} 円/kg</dd></div><div><dt>作成者</dt><dd>${esc(personName(r,'createdBy'))}<br>${time(r.createdAt)} JST</dd></div><div><dt>${r.deleted?'削除者':'最終編集者'}</dt><dd>${esc(personName(r,'lastEditedBy'))}<br>${time(r.updatedAt)} JST</dd></div></dl>${r.priceSource==='legacy-unknown'?'<p class="price-unknown">旧版の単価は不明のまま保持しています。現在の設定で補完していません。</p>':''}<p class="record-id">ID ${esc(r.id)}</p><h3>この記録の変更履歴</h3>${state.history.filter(e=>e.recordId===r.id).reverse().map(historyHTML).join('')}</div><div class="dialog-foot">${r.deleted?`<button class="button secondary" data-close-dialog>閉じる</button><button class="button primary" data-record-action="restore" data-id="${esc(r.id)}" data-version="${r.version}" ${storageFailed?'disabled':''}>この記録を復元</button>`:`<button class="button secondary danger-text" data-record-action="delete" data-id="${esc(r.id)}" data-version="${r.version}">削除</button><button class="button primary" data-edit-record="${esc(r.id)}">編集する</button>`}</div>`,{kind:'detail',id,version:r.version});}
function showEdit(id){const r=state.records.find(r=>r.id===id&&!r.deleted);if(!r)return toast('記録が変更されています。');const c=state.masters.customers.find(c=>c.id===r.customerId);showDialog(`${head('記録を編集',`作成者は変更しません · v${r.version}`)}<form id="edit-form"><div class="dialog-body">${errorHTML('edit-error')}<div id="conflict-panel" hidden></div><div class="form-grid"><label class="field"><span>回収日</span><input type="date" name="date" value="${r.date}" required></label><label class="field"><span>取引先</span><input value="${esc(recordName(r))}" readonly></label></div>${measures(c,r,'',true)}<div class="form-grid">${sessionAttribution()}</div><p class="form-note">設定の現在値で過去の単価を上書きしません。保存するのはこの記録だけです。</p><div class="simulation-note"><p>他の編集が先に保存された状態を再現します。</p><button type="button" class="button secondary" id="simulate-conflict">他の編集を再現</button></div></div><div class="dialog-foot"><button type="button" class="button secondary" data-close-dialog>キャンセル</button><button type="button" class="button primary" id="save-edit">変更を保存</button></div></form>`,{kind:'edit',id,version:r.version,record:D.clone(r),masterRevision:state.masterRevision});enforceOther($('#edit-form'));}
function showMemberDetail(id){showMasterPanel('members',id,false);}
function showItemDetail(id){showMasterPanel('items',id,false);}
function showMasterPanel(type,id,editing=false){
 const m=state.masters[type].find(x=>x.id===id);if(!m)return toast('対象が見つかりません。');
 const formId=editing?'master-form':'master-view',ro=editing?'':'readonly tabindex="-1"',disabled=editing?'':'disabled',name=D.displayName(state,type,id);
 const input=(field,label,value,{kind='text',max=120,unit='',min='',maxValue=''}={})=>`<label class="field"><span>${label}${unit?` <small>${unit}</small>`:''}</span><input name="${field}" type="${editing?kind:'text'}" value="${esc(value??'')}" maxlength="${max}" ${min!==''?`min="${min}"`:''} ${maxValue?`max="${maxValue}"`:''} ${kind==='number'?'step="any" inputmode="decimal"':''} placeholder="ー" ${ro}></label>`;
 const textarea=(field,label,value,max)=>`<label class="field full"><span>${label}</span><textarea name="${field}" rows="3" maxlength="${max}" placeholder="ー" ${ro}>${esc(value??'')}</textarea></label>`;
 let fields='';
 if(type==='members'){const profile=m.profile??{};fields=`<div class="form-grid member-profile-fields">${input('profileBirthDate','生年月日',profile.birthDate,{kind:'date',min:'0001-01-01',maxValue:localDate()})}<label class="field"><span>性別</span><select name="profileGender" ${disabled}><option value="">ー</option>${['男','女','ー'].map(value=>`<option value="${value}" ${profile.gender===value?'selected':''}>${value}</option>`).join('')}</select></label>${textarea('profileLicense','免許',profile.license,1000)}${textarea('profileOther','その他',profile.other,500)}</div>`;}
 else if(type==='customers'){fields=`<div class="form-grid customer-info-fields">${input('invoicePostalCode','郵便番号',m.invoicePostalCode,{max:16})}${textarea('invoiceAddress','住所',m.invoiceAddress,90)}</div><h3>値段</h3><div class="form-grid customer-rate-fields">${Object.keys(D.CATEGORIES).map(k=>input('rate:'+k,D.CATEGORIES[k],m.rates[k],{kind:'number',min:0,maxValue:'1000000000',unit:k==='other'?'円':'円/kg'})).join('')}</div>`;}
 else{const category=D.commonRateCategory(m);fields=category?input('defaultRate',category==='other'?'共通の初期金額':'共通の初期単価',m.defaultRate,{kind:'number',min:0,maxValue:'1000000000',unit:category==='other'?'円':'円/kg'}):'';}
 const context=editing?{kind:'master',type,id,version:m.version,draft:D.clone(m)}:{kind:type==='customers'?'customer-detail':type==='members'?'member-detail':'item-detail',id,version:m.version};
 showDialog(`<form id="${formId}" class="master-detail-form ${editing?'is-edit':'is-view'}"><div class="dialog-head"><h2 id="dialog-title" aria-label="${esc(name)}"><input class="detail-name" aria-label="名称" name="name" value="${esc(editing?m.name:name)}" maxlength="120" required ${ro}></h2><button type="button" class="close-button" data-close-dialog aria-label="閉じる">×</button></div><div class="dialog-body ${type==='members'?'member-profile':''}">${errorHTML('master-error')}${fields}</div><div class="dialog-foot">${editing?'<button type="button" class="button secondary" data-cancel-master>キャンセル</button><button type="button" class="button primary" id="save-master">保存</button>':`<button type="button" class="button secondary danger-text" data-toggle-master="${esc(id)}" data-version="${m.version}">${m.active?'削除':'復旧'}</button><button type="button" class="button primary" data-edit-master="${esc(id)}">変更</button>`}</div></form>`,context);
}
function cancelMasterEdit(){const ctx=modalContext;if(ctx?.kind!=='master'||!ctx.id)return requestDialogClose();discard(()=>{modalContext=null;showMasterPanel(ctx.type,ctx.id,false);});}
function memberProfileFields(m){const p=m.profile??{};return `<div class="form-grid member-profile-fields"><label class="field"><span>生年月日</span><input type="date" name="profileBirthDate" min="0001-01-01" max="${localDate()}" value="${esc(p.birthDate??'')}"></label><label class="field"><span>性別</span><select name="profileGender"><option value="">未選択</option>${['男','女','ー'].map(value=>`<option value="${value}" ${p.gender===value?'selected':''}>${value}</option>`).join('')}</select></label><label class="field full"><span>免許</span><textarea name="profileLicense" rows="3" maxlength="1000" placeholder="種類・資格名">${esc(p.license??'')}</textarea></label><label class="field full"><span>その他</span><textarea name="profileOther" rows="3" maxlength="500" placeholder="任意の短いメモ">${esc(p.other??'')}</textarea></label></div>`;}
function showMaster(id=null,duplicate=false){if(id&&!duplicate)return showMasterPanel(masterType,id,true);const old=id?state.masters[masterType].find(x=>x.id===id):null;const m=old?D.masterDraft(state,masterType,id,{duplicate}):{name:'',enabled:{combustible:true,noncombustible:true,other:true},rates:{combustible:null,noncombustible:null,other:null},itemIds:[]};const extra=masterType==='customers'?`<label class="field"><span>郵便番号</span><input name="invoicePostalCode" value="${esc(m.invoicePostalCode??'')}" maxlength="16" autocomplete="off"></label><label class="field"><span>住所</span><textarea name="invoiceAddress" rows="3" maxlength="90">${esc(m.invoiceAddress??'')}</textarea><small>3行以内</small></label><h3>値段</h3>${Object.keys(D.CATEGORIES).map(k=>numeric('rate:'+k,D.CATEGORIES[k],m.rates[k],k==='other'?'円':'円/kg')).join('')}<p class="form-note">空欄の場合のみ処分物品の共通値を使います。0はそのまま使います。過去の報告は変えません。</p>`:masterType==='items'?`${!duplicate&&old&&D.commonRateCategory(old)?numeric('defaultRate',old.category==='other'?'共通の初期金額':'共通の初期単価',m.defaultRate,old.category==='other'?'円':'円/kg')+'<p class="form-note">任意。取引先の値段が未設定の場合だけ使います。0と空欄を区別します。</p>':'<p class="form-note">処分物品の名称を登録します。細かい内容は報告の備考で補います。</p>'}`:memberProfileFields(m);
showDialog(`${head(`${titles[masterType]}を${duplicate?'複製':old?'編集':'追加'}`,duplicate?'名称は空欄、新しいIDで作成。過去の記録は複製しません。':'このブラウザだけの設定') }<form id="master-form"><div class="dialog-body">${errorHTML('master-error')}<label class="field"><span class="field-label">名称<span class="required">必須</span></span><input name="name" value="${esc(m.name)}" maxlength="120" required placeholder="新しい名称"></label>${extra}<div class="category-block">${sessionAttribution()}</div></div><div class="dialog-foot"><button type="button" class="button secondary" data-close-dialog>キャンセル</button><button type="button" class="button primary" id="save-master">${old&&!duplicate?'保存':'追加する'}</button></div></form>`,{kind:'master',type:masterType,id:duplicate?null:id,version:duplicate?null:old?.version,draft:D.clone(m)});}
function operationConfirm({title,body,label,operation,onSuccess}){if(storageFailed)return toast('保存を利用できません。');$('#confirm-content').innerHTML=`<div class="dialog-head"><h2 id="confirm-title">${title}</h2></div><form id="operation-form"><div class="dialog-body">${errorHTML('operation-error')}<p class="confirm-text">${body}</p>${sessionAttribution('操作する人')}</div><div class="dialog-foot"><button class="button secondary" type="button" id="cancel-operation">キャンセル</button><button class="button primary" id="confirm-operation">${label}</button></div></form>`;confirmDialog.showModal();$('#cancel-operation').onclick=()=>{if(!pending)confirmDialog.close();};$('#operation-form').onsubmit=async e=>{e.preventDefault();if(pending||!e.currentTarget.reportValidity())return;await saving($('#confirm-operation'),'operation-error',async()=>{await mutate(operation);confirmDialog.close();if(dialog.open)dialog.close();modalDirty=false;onSuccess?.();toast(`${label}操作を保存しました。履歴は残っています。`);});};$('#cancel-operation').focus();}
async function saving(button,errorId,fn){if(pending||storageFailed)return;pending=true;const label=button.textContent,controls=$$('input,select,textarea,button').map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);button.textContent='保存中…';try{await fn();}catch(e){if(errorId==='report-error'&&e.customerId){const row=reportRows().find(row=>row.dataset.entry===e.customerId);if(row)selectReportRow(row.dataset.reportRow);}showError(errorId,e);}finally{pending=false;controls.forEach(([el,disabled])=>{if(el.isConnected)el.disabled=disabled;});if(button.isConnected)button.textContent=label;ensureDemoSession();}}
function setPeriod(next){period=next;$$('[data-period]').forEach(b=>b.classList.toggle('active',b.dataset.period===next));const el=$('#period-value');el.type=next==='day'?'date':next==='month'?'month':'number';if(next==='year'){el.min='1';el.max='9999';el.step='1';}el.value=next==='day'?localDate():next==='month'?localDate().slice(0,7):localDate().slice(0,4);$('#period-label').textContent=next==='day'?'対象日':next==='month'?'対象年月':'対象年（1〜12月）';renderSummary();}
// Only an explicit save button invokes a detail-form submit. IME confirmation
// and textarea newlines are never interpreted as save commands.
let explicitDetailSave=false;
const detailEditing=el=>el?.closest?.('#master-form,#price-form,#edit-form');
document.addEventListener('keydown',e=>{if(detailEditing(e.target)&&e.key==='Enter'&&e.target.tagName!=='TEXTAREA'&&!e.isComposing&&e.keyCode!==229)e.preventDefault();},true);
document.addEventListener('input',e=>{if(e.target.closest('#report-form'))reportDirty=true;if(e.target.closest('#edit-form,#master-form'))modalDirty=true;if(e.target.closest('#price-form'))priceDirty=true;});
document.addEventListener('change',e=>{const el=e.target;if(el.matches('[data-report-customer]'))changeReportCustomer(el);if(el.matches('[data-use-other]')){const box=el.parentElement.nextElementSibling;box.hidden=!el.checked;enforceOther(box.parentElement);if(el.closest('#report-form'))reportDirty=true;else modalDirty=true;}if(el.id==='browse-month')renderBrowse();if(el.id==='period-value')renderSummary();if(el.matches('[data-master-select]')){selectedMasterId=el.dataset.masterSelect;$$('.master-compact').forEach(row=>row.classList.toggle('is-selected',row.querySelector('[data-master-select]')?.checked??false));renderMasterSelectionActions();}if(el.id==='show-inactive')renderSettings();});
$('#browse-search').addEventListener('input',renderBrowse);
document.addEventListener('keydown',e=>{
 const tab=e.target.closest('[data-report-tab]');if(!tab||pending||e.altKey||e.ctrlKey||e.metaKey)return;
 const tabs=$$('#report-tabs [data-report-tab]'),index=tabs.indexOf(tab);let next;
 if(e.key==='ArrowRight')next=(index+1)%tabs.length;else if(e.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;
 e.preventDefault();selectReportRow(tabs[next].dataset.reportTab,{focusTab:true});
});
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||pending||b.disabled)return;if(['save-master','save-edit','save-prices'].includes(b.id)){explicitDetailSave=true;try{b.form.requestSubmit();}finally{explicitDetailSave=false;}return;}if(b.hasAttribute('data-report-tab'))return selectReportRow(b.dataset.reportTab,{focusTab:true});if(b.id==='add-report-row'){$('#report-rows').insertAdjacentHTML('beforeend',reportRowHTML());activeReportRowId=reportRows().at(-1).dataset.reportRow;reportDirty=true;refreshReportChoices();reportRows().at(-1).querySelector('[data-report-customer]').focus();return;}if(b.hasAttribute('data-remove-report-row'))return removeReportRow(b.closest('[data-report-row]'));if(b.matches('[data-open-customer],[data-member-detail],[data-item-detail],[data-detail],[data-edit-master],[data-copy-master],#new-master,#master-copy'))rememberDialogOrigin(b);if(b.id==='change-demo-user')return discard(()=>{priceContext=null;renderSettings();showDemoSession();});if(b.dataset.nav)return navigate(b.dataset.nav);if(b.dataset.browse){browseTab=b.dataset.browse;$$('[data-browse]').forEach(x=>x.classList.toggle('active',x===b));renderBrowse();return;}if(b.dataset.period)return setPeriod(b.dataset.period);if(b.dataset.masterType)return navigate('settings/'+b.dataset.masterType);if(b.dataset.settingsRoute)return navigate(b.dataset.settingsRoute);if(b.id==='reorder-masters')return startMasterReorder();if(b.id==='cancel-master-reorder'){masterReorder?.cancel();return;}if(b.id==='save-master-reorder')return saveMasterReorder();if(b.id==='select-masters'){masterSelectionMode=!masterSelectionMode;selectedMasterId=null;renderSettings();return;}if(b.dataset.memberDetail)return showMemberDetail(b.dataset.memberDetail);if(b.dataset.itemDetail)return showItemDetail(b.dataset.itemDetail);if(b.id==='new-master')return showMaster();if(b.dataset.editMaster)return showMaster(b.dataset.editMaster);if(b.dataset.copyMaster)return showMaster(b.dataset.copyMaster,true);if(b.dataset.detail)return showDetail(b.dataset.detail);if(b.dataset.editRecord)return showEdit(b.dataset.editRecord);if(b.hasAttribute('data-cancel-master'))return cancelMasterEdit();if(b.hasAttribute('data-close-dialog'))return requestDialogClose();if(b.dataset.restoreMasterHistory){const id=b.dataset.restoreMasterHistory,type=b.dataset.masterKind,m=state.masters[type]?.find(x=>x.id===id),v=Number(b.dataset.version);if(!m||m.active)return toast('この項目は既に復旧されています。');return operationConfirm({title:`この${titles[type]}を復旧しますか？`,body:`${esc(m.name)}<br>同じID・内容で選択肢に戻します。過去の記録・単価・削除履歴は保持します。`,label:'復旧する',operation:(s,a)=>D.setMasterActive(s,type,id,v,true,a),onSuccess:()=>{resetMasterSelection();renderSettings();if(!reportDirty)renderReport();}});}if(b.dataset.toggleMaster){const id=b.dataset.toggleMaster,type=masterType,m=state.masters[type].find(x=>x.id===id),v=Number(b.dataset.version);return operationConfirm({title:m.active?'削除しますか？':'復旧しますか？',body:`${esc(m.name)}<br>${m.active?'削除履歴から復旧できます。過去の記録は残り、新規入力の選択肢から外れます。':'新しい入力の選択肢に戻します。'}`,label:m.active?'削除する':'復元する',operation:(s,a)=>D.setMasterActive(s,type,id,v,!m.active,a),onSuccess:()=>{resetMasterSelection();renderSettings();if(type==='items')focusItemSettingsAction('#select-masters');if(!reportDirty)renderReport();}});}if(b.dataset.recordAction){const action=b.dataset.recordAction,id=b.dataset.id,v=Number(b.dataset.version),r=state.records.find(x=>x.id===id);return operationConfirm({title:action==='delete'?'この記録を削除しますか？':'この記録を復元しますか？',body:`${esc(recordName(r))} · ${r.date}<br>${action==='delete'?'削除前内容・削除者・日時・IDを残し、削除済みから復元できます。':'同じ日・取引先の有効な記録がある場合は復元を止めます。削除履歴は消しません。'}`,label:action==='delete'?'削除する':'復元する',operation:(s,a)=>(action==='delete'?D.deleteRecord:D.restoreRecord)(s,id,v,a)});}if(b.id==='simulate-conflict'){const ctx=modalContext;await saving(b,'edit-error',async()=>{await mutate((s,currentActorId)=>{const r=s.records.find(x=>x.id===ctx.id),actor=D.activeMasters(s,'members').find(m=>m.id!==currentActorId)??D.activeMasters(s,'members')[0];return D.updateRecord(s,r.id,r.version,{...r,otherItem:r.otherItem+'【編集競合の確認】',masterRevision:s.masterRevision},actor.id);});toast('別の編集が先に保存された状態を再現しました。');});}});
document.addEventListener('submit',async e=>{const form=e.target;if(form.id==='master-view'){e.preventDefault();return;}if(!['report-form','edit-form','master-form','price-form'].includes(form.id))return;e.preventDefault();if(form.id!=='report-form'&&!explicitDetailSave)return;if(pending||(form.id==='report-form'?!validateReportForm(form):!form.reportValidity()))return;const fd=new FormData(form);if(form.id==='price-form'){const ctx=priceContext,input={...D.clone(ctx.snapshot),rates:Object.fromEntries(Object.keys(D.CATEGORIES).map(k=>[k,fd.get('rate:'+k)]))};await saving($('#save-prices'),'price-error',async()=>{await mutate((s,actor)=>D.saveMaster(s,'customers',input,{id:ctx.id,expectedVersion:ctx.version,actorId:actor}));priceDirty=false;priceContext=null;renderSettings();if(!reportDirty)renderReport();toast('この取引先の値段を保存しました。過去の報告は変えていません。');});}else if(form.id==='report-form'){const input={date:fd.get('date'),masterRevision:Number(form.dataset.masterRevision),rows:reportRows().map(row=>({customerId:row.dataset.entry,...readMeasures(form,row.dataset.entry+':')}))};await saving($('#save-report'),'report-error',async()=>{const r=await mutate((s,actor)=>D.createRecords(s,{...input,createdById:actor},actor));reportDirty=false;renderReport();toast(`${r.record.count}件を保存しました。利用者を作成者として記録しました。`);});}else if(form.id==='edit-form'){const ctx=modalContext,input={...readMeasures(form,''),date:fd.get('date'),customerId:ctx.record.customerId,masterRevision:ctx.masterRevision};await saving($('#save-edit'),'edit-error',async()=>{try{await mutate((s,actor)=>D.updateRecord(s,ctx.id,ctx.version,input,actor));modalDirty=false;dismissDialog();toast('変更を保存しました。設定の単価は変えていません。');}catch(error){if(error instanceof D.ConflictError){const panel=$('#conflict-panel');panel.hidden=false;panel.className='conflict-panel';panel.innerHTML='<h3>更新が重なりました。保存していません。</h3><p>下書きはフォームに残しています。入力を控え、キャンセルして最新の記録・設定を確認してください。自動上書きはしません。</p>';}throw error;}});}else{const ctx=modalContext,input={...D.clone(ctx.draft),name:fd.get('name'),...(ctx.type==='customers'?{invoicePostalCode:fd.get('invoicePostalCode'),invoiceAddress:fd.get('invoiceAddress'),rates:Object.fromEntries(Object.keys(D.CATEGORIES).map(k=>[k,fd.get('rate:'+k)]))}:{}),...(ctx.type==='items'&&fd.has('defaultRate')?{defaultRate:fd.get('defaultRate')}:{}),...(ctx.type==='members'?{profile:{...D.clone(ctx.draft.profile??{}),birthDate:fd.get('profileBirthDate'),gender:fd.get('profileGender'),license:fd.get('profileLicense'),other:fd.get('profileOther')}}:{})};await saving($('#save-master'),'master-error',async()=>{const saved=await mutate((s,actor)=>D.saveMaster(s,ctx.type,input,{id:ctx.id,expectedVersion:ctx.version,actorId:actor}));modalDirty=false;dialog.close();modalContext=null;resetMasterSelection();renderSettings();if(ctx.type==='customers'){const route=customerRoute(saved.master.id);location.hash=route;switchPage(route);}else if(ctx.type==='members')showMemberDetail(saved.master.id);else showItemDetail(saved.master.id);if(!reportDirty)renderReport();});}});
dialog.addEventListener('cancel',e=>{e.preventDefault();requestDialogClose();});confirmDialog.addEventListener('cancel',e=>{if(pending)e.preventDefault();});
window.addEventListener('beforeunload',e=>{if(reportDirty||modalDirty||priceDirty||reorderDirty()||pending||invoiceSettings?.isDirty()||invoiceSettings?.isBusy()){e.preventDefault();e.returnValue='';}});
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(next===currentRoute)return;if(reportDirty||modalDirty||priceDirty||reorderDirty()||invoiceSettings?.isDirty()){history.replaceState(null,'','#'+currentRoute);discard(()=>{location.hash=next;switchPage(next);});}else switchPage(next);});
window.addEventListener('storage',e=>{if(e.key!==APP_STORAGE_KEY&&e.key!==null)return;try{const next=read();if(!next)throw new Error('別の操作で保存データが消えました。');state=next;renderSecondary();if(!reportDirty&&!pending)renderReport();toast('別の画面の更新を読み込みました。入力中の内容はそのままです。');ensureDemoSession();}catch(error){fail(error);}});
initialize(()=>{$('#calculation-sample-banner').hidden=!IS_CALCULATION_SAMPLE;for(const selector of ['#desktop-nav','#mobile-nav'])$(selector).innerHTML=Object.entries(pages).map(([key,[label,icon]])=>`<button class="${selector==='#desktop-nav'?'nav-item':''}" data-nav="${key}"><span aria-hidden="true">${navIcon(key)}</span>${label}</button>`).join('');$('#browse-month').value=localDate().slice(0,7);renderReport();setPeriod('month');renderSecondary();switchPage(location.hash.slice(1));
invoiceSettings=installInvoiceSettings({doc:document,storageKey:ISSUER_STORAGE_KEY,onChange:()=>renderIssuerPanel()});
renderSettings();
invoiceOutput=installInvoiceOutput({doc:document,getState:()=>state,getInvoiceSettings:()=>invoiceSettings.getSettings(),storageKey:ISSUER_STORAGE_KEY});
installInputAssist();
startUpdates({guard:discard,canReload:()=>!reportDirty&&!modalDirty&&!priceDirty&&!reorderDirty()&&!masterReorder?.dragging&&!pending&&!invoiceSettings?.isDirty()&&!invoiceSettings?.isBusy()});
ensureDemoSession();
});
