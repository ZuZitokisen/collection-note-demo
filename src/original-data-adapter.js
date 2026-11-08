import {markStartupFailure} from './workspace-client.js';
// Authenticated workspace boundary. No demo migration, token storage or silent write retry.
import {legacyReferenceView} from './legacy-reference.js';
import {validateState} from './domain.js';
import {validateInvoiceSettings} from './invoice-settings.js';
const copy=value=>structuredClone(value);
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const capabilities=['recordsWrite','customersWrite','itemsWrite','membersWrite','invoiceSettingsWrite'];
const issue=(code,message)=>Object.assign(new Error(message),{code});
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export async function workspaceResultHash(value){const bytes=new TextEncoder().encode(JSON.stringify(canonical({state:value.state,invoiceSettings:value.invoiceSettings})));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function validateWorkspaceSnapshot(value){
 if(!value||value.ok!==true||value.schemaVersion!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!hex(value.sourceFingerprint)||!hex(value.watchCursor))throw issue('INVALID_SNAPSHOT','共有データの形式を確認できません。');
 validateState(value.state);validateInvoiceSettings(value.invoiceSettings);
 const actor=value.actor;if(!actor||typeof actor.memberId!=='string'||!actor.memberId||typeof actor.displayName!=='string'||!['admin','worker'].includes(actor.role)||capabilities.some(key=>typeof value.capabilities?.[key]!=='boolean'))throw issue('INVALID_SNAPSHOT','利用権限を確認できません。');
 if(!value.state.masters.members.some(member=>member.id===actor.memberId&&member.active))throw issue('WORKSPACE_MEMBERSHIP_SYNC_REQUIRED','利用できるメンバーを確認してください。');
 const billing=value.billingStatus;if(!billing||typeof billing.ready!=='boolean'||!Array.isArray(billing.reasons)||billing.reasons.some(x=>typeof x!=='string')||billing.scope!=='reference-subtotal'||billing.formalTotalsVerified!==false||(billing.ready&&billing.reasons.length))throw issue('INVALID_SNAPSHOT','帳票の確認範囲を確認できません。');
 if(typeof value.projectionCurrent!=='boolean'||!Array.isArray(value.reasons)||value.reasons.some(x=>typeof x!=='string'))throw issue('INVALID_SNAPSHOT','集計の同期状態を確認できません。');
 if(value.invoiceSettingsProvenance!=null)for(const section of ['issuer','bank','tax']){const p=value.invoiceSettingsProvenance[section];if(!p||!['reference-document','unset','manual'].includes(p.origin)||!['unreviewed','user-saved'].includes(p.reviewStatus))throw issue('INVALID_SNAPSHOT','設定の確認状態を読み取れません。');}
 return copy(value);
}
const select=(value,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,copy(value[key])]));
const recordKeys=['date','customerId','masterRevision','combustibleKg','noncombustibleKg','otherFee','combustibleRate','noncombustibleRate','otherItem','categoryNotes','notes','combustibleNote','noncombustibleNote','otherNote','itemIds','priceSource','defaultRates'];
const masterKeys={members:['name','profile'],customers:['name','enabled','rates','itemIds','invoicePostalCode','invoiceAddress'],items:['name','category','defaultRate']};
export const originalCommandOperations={
 createRecords:(_state,input)=>({type:'record.createBatch',input:{...select(input,['date','masterRevision']),rows:input.rows.map(row=>select(row,recordKeys))}}),
 updateRecord:(_state,id,expectedVersion,input)=>({type:'record.update',id,expectedVersion,input:select(input,recordKeys)}),
 deleteRecord:(_state,id,expectedVersion)=>({type:'record.delete',id,expectedVersion}),
 restoreRecord:(_state,id,expectedVersion)=>({type:'record.restore',id,expectedVersion}),
 saveMaster:(_state,masterType,input,{id=null,expectedVersion=null}={})=>{if(!masterKeys[masterType])throw issue('BAD_REQUEST','設定の種類を確認してください。');return{type:'master.save',masterType,input:select(input,masterKeys[masterType]),id,expectedVersion};},
 setMasterActive:(_state,masterType,id,expectedVersion,active)=>({type:'master.setActive',masterType,id,expectedVersion,active}),
 reorderMasters:(_state,masterType,orderedIds,expectedMasterRevision,_actor,draggedId)=>({type:'master.reorder',masterType,orderedIds:copy(orderedIds),expectedMasterRevision,draggedId}),
};
export function createOriginalDataAdapter({identity,readSnapshot,sendCommand,queryOperation,pendingJournal,id=()=>crypto.randomUUID()}={}){
 let snapshot=null,owner=null,epoch=0,observed=identity.currentUid(),disposed=false,busy=false,unconfirmed=false,refreshPending=null,readEpoch=0,mutationEpoch=0;const listeners=new Set();
 const off=identity.subscribe(uid=>{if(uid!==observed){observed=uid;epoch++;snapshot=null;owner=null;for(const listener of listeners)listener();}});
 function handleAuthFailure(error){if(['LOGIN_REQUIRED','UNAUTHENTICATED','FORBIDDEN','WORKSPACE_MEMBERSHIP_SYNC_REQUIRED'].includes(error?.code)){epoch++;readEpoch++;snapshot=null;owner=null;for(const fn of listeners)fn();}return error;}
 function ticket(){const uid=identity.currentUid();if(disposed||!uid)throw issue('LOGIN_REQUIRED','Googleログインを確認してください。');return{uid,epoch};}
 function check(t){if(disposed||t.uid!==identity.currentUid()||t.epoch!==epoch)throw issue('LOGIN_REQUIRED','ログイン状態が変わりました。');}
 function current(){const t=ticket();if(!snapshot||owner!==t.uid)throw issue('NOT_READY','共有データを読み込んでいます。');return snapshot;}
 function accept(value,t){check(t);let next;try{next=validateWorkspaceSnapshot(value);}catch(error){throw markStartupFailure(error,'VALIDATE');}if(snapshot&&owner===t.uid&&next.revision<snapshot.revision)throw issue('STALE_READ','古い読み込み結果は反映していません。');snapshot=next;owner=t.uid;return copy(snapshot);}
 async function performRefresh(){const t=ticket(),before=snapshot,generation=mutationEpoch,readGeneration=readEpoch;if(busy)throw issue('BUSY','保存処理を確認しています。');if(pendingJournal){unconfirmed=!!(await pendingJournal.read(t.uid));check(t);}const value=await readSnapshot();check(t);if(busy||readGeneration!==readEpoch||generation!==mutationEpoch||before!==snapshot)throw issue('STALE_READ','読み込み中に内容が更新されました。再試行してください。');return accept(value,t);}
 async function refresh({fresh=false}={}){if(fresh&&refreshPending){try{await refreshPending;}catch{}}if(refreshPending)return refreshPending;refreshPending=performRefresh().catch(error=>{throw handleAuthFailure(markStartupFailure(error,'READ'));}).finally(()=>{refreshPending=null;});return refreshPending;}
 async function prepareRefresh(){const t=ticket(),before=current(),generation=mutationEpoch,readGeneration=readEpoch;const value=validateWorkspaceSnapshot(await readSnapshot());check(t);let consumed=false;return{commitIfCurrent(predicate=()=>true){if(consumed)return false;consumed=true;check(t);if(busy||unconfirmed||readGeneration!==readEpoch||before!==snapshot||generation!==mutationEpoch||!predicate())return false;accept(value,t);return true;}};}
 async function execute(command){
  if(busy)throw issue('BUSY','保存処理を確認しています。');busy=true;mutationEpoch++;
  let t,envelope,claimed=false,dispatched=false;
  try{
   t=ticket();const s=current();if(!pendingJournal)throw issue('JOURNAL_UNAVAILABLE','保存の確認機能を利用できません。');
   if(await pendingJournal.read(t.uid))throw issue('OPERATION_UNKNOWN','前の保存結果を確認してください。');check(t);
   envelope={operationId:id(),expectedRevision:s.revision,expectedSourceFingerprint:s.sourceFingerprint,command:copy(command)};
   await pendingJournal.claim(t.uid,{operationId:envelope.operationId,expectedRevision:s.revision});claimed=true;unconfirmed=true;check(t);
   dispatched=true;const response=await sendCommand(envelope);check(t);
   const verified=validateWorkspaceSnapshot(response),receipt=response.receipt;
   if(response.committed!==true||!receipt||receipt.operationId!==envelope.operationId||receipt.revision!==envelope.expectedRevision+1||!hex(receipt.resultHash))throw issue('OPERATION_UNKNOWN','保存結果を確認できません。');
   if(response.currentMatchesReceipt===true){if(verified.revision!==receipt.revision||await workspaceResultHash(verified)!==receipt.resultHash)throw issue('OPERATION_UNKNOWN','保存結果の整合を確認できません。');check(t);}else if(response.currentMatchesReceipt!==false||verified.revision<=receipt.revision)throw issue('OPERATION_UNKNOWN','保存結果を確認できません。');
   accept(verified,t);await pendingJournal.clear(t.uid,envelope.operationId);unconfirmed=false;check(t);
   if(!response.currentMatchesReceipt)throw issue('OPERATION_SUPERSEDED','前の保存は完了していますが、その後更新されています。最新内容を確認してください。');
   return{...copy(response.result),state:copy(snapshot.state),projectionCurrent:snapshot.projectionCurrent,reasons:copy(snapshot.reasons)};
  }catch(error){
   // Only clear an operation known not to have been dispatched, or definitively rejected.
   if(claimed&&(!dispatched||error.definitiveRejection===true))await pendingJournal.clear(t.uid,envelope.operationId).then(()=>{unconfirmed=false;}).catch(()=>{});
   throw handleAuthFailure(error);
  }finally{busy=false;}
 }
 const api={initialize:async()=>snapshot?copy(current()):refresh(),refresh,prepareRefresh,invalidateReads(){readEpoch++;},read:()=>copy(current().state),referenceView:()=>{const s=current();return legacyReferenceView(s.state,s.legacyCalculationContext,s.sourceFingerprint);},snapshot:()=>copy(current()),watchCursor:()=>current().watchCursor,actor:()=>copy(current().actor),snapshotKey:()=>{const s=current();return`${s.revision}:${s.sourceFingerprint}`;},operations:originalCommandOperations,mutate:operation=>execute(operation(copy(current().state),current().actor.memberId)),execute,isBusy:()=>busy,canBackgroundRefresh:()=>!busy&&!unconfirmed&&!disposed&&!!snapshot,subscribeInvalidation(fn){listeners.add(fn);return()=>listeners.delete(fn);},assertBillingReady(){const b=current().billingStatus;if(!b.ready)throw issue('BILLING_NOT_READY','参考帳票の計算条件を確認してください。');},async recover(){const t=ticket(),marker=await pendingJournal.read(t.uid);check(t);if(!marker)return{status:'none'};const result=await queryOperation(marker.operationId).catch(error=>{throw handleAuthFailure(error);});check(t);if(result.ok!==true||result.schemaVersion!==1||result.operationId!==marker.operationId||!['committed','not-found'].includes(result.status))throw issue('OPERATION_UNKNOWN','保存結果を確認できません。');if(result.status==='committed'){if(result.receipt?.operationId!==marker.operationId||result.receipt.revision!==marker.expectedRevision+1||!hex(result.receipt.resultHash))throw issue('OPERATION_UNKNOWN','保存結果を確認できません。');await pendingJournal.clear(t.uid,marker.operationId);check(t);await refresh();}return result;},dispose(){disposed=true;epoch++;snapshot=null;owner=null;off?.();listeners.clear();}};
 api.invoiceSettingsStore={read:()=>({raw:String(current().invoiceSettings.revision),settings:copy(current().invoiceSettings),provenance:copy(current().invoiceSettingsProvenance??null)}),getSettings:()=>copy(current().invoiceSettings),...Object.fromEntries([['saveIssuer','issuer'],['saveBankAccounts','bank'],['saveTax','tax']].map(([method,section])=>[method,async(values,raw)=>{await execute({type:'invoiceSettings.saveSection',section,values:copy(values),expectedSettingsRevision:Number(raw)});return api.invoiceSettingsStore.read();}]))};
 return api;
}
