import test from 'node:test';import assert from 'node:assert/strict';
import {markStartupFailure,safeStartupDiagnostic} from '../src/workspace-client.js';
import {createEntryGate} from '../src/google-entry.js';
import {createOriginalDataAdapter} from '../src/original-data-adapter.js';
const secret='DO-NOT-EXPOSE-token-bank-personal-info';
async function failure(error){let shown,loads=0;const session={state:{status:'signed-in',user:{uid:'synthetic'}},subscribe(fn){fn(this.state);return()=>{};},verifyIdentity:async()=>({uid:'synthetic'}),dispose(){}};const gate=createEntryGate({initialize:async()=>session,loadApp:async()=>{loads++;throw error;},online:()=>true,show:x=>{shown=x;},open:()=>{throw Error('must not open')},close:()=>{}});await gate.start();for(let i=0;i<12;i++)await Promise.resolve();return{shown,loads,gate};}
test('each fixed stage/code is shown only at existing failed APP status',async()=>{for(const stage of ['READ','VALIDATE','UI','OUTPUT','FINAL']){const e=Object.assign(Error(secret),{code:'NETWORK',stack:secret,body:secret});assert.equal(markStartupFailure(e,stage),e);const {shown,loads,gate}=await failure(e);assert.match(shown.message,new RegExp('APP / '+stage+' / NETWORK'));assert.equal(loads,1);assert.equal(gate.started,false);assert.doesNotMatch(JSON.stringify(shown),new RegExp(secret));}});
test('unknown, forged and hostile diagnostics cannot expose any supplied text',async()=>{
 for(const e of [Object.assign(Error(secret),{code:secret,startupStage:secret,stack:secret}),{code:'toString',message:secret,stage:'READ'},secret,null,Object.defineProperty({},'code',{get(){throw Error(secret)}}),Object.defineProperty({},'code',{get(){return {toString(){return secret}}}})]){
  markStartupFailure(e,secret);assert.deepEqual(safeStartupDiagnostic(e),{stage:'UNKNOWN',code:'UNKNOWN'});const {shown}=await failure(e);assert.match(shown.message,/APP \/ UNKNOWN \/ UNKNOWN/);assert.doesNotMatch(shown.message,new RegExp(secret));
 }
 let reads=0;const e=Object.defineProperty({},'code',{get(){return ++reads===1?'NETWORK':secret}});const result=safeStartupDiagnostic(e);assert.deepEqual(result,{stage:'UNKNOWN',code:'NETWORK'});assert.equal(reads,1);
});
test('first trusted stage is retained without mutating or wrapping original error',()=>{const e=Object.freeze(Object.assign(Error(secret),{code:'INVALID_SNAPSHOT'}));const keys=Object.getOwnPropertyNames(e);assert.equal(markStartupFailure(e,'VALIDATE'),e);markStartupFailure(e,'READ');assert.deepEqual(Object.getOwnPropertyNames(e),keys);assert.deepEqual(safeStartupDiagnostic(e),{stage:'VALIDATE',code:'INVALID_SNAPSHOT'});});
test('existing special startup messages remain unchanged and contain no raw error',async()=>{for(const [code,expected]of [['startup-seal','起動確認: SEAL'],['startup-storage','起動確認: STORAGE'],['startup-session-changed','ログイン状態または接続が変わりました'],['WORKSPACE_NOT_ENABLED','接続を準備中']]){const{shown}=await failure(Object.assign(Error(secret),{code}));assert.ok(shown.message.includes(expected));assert.doesNotMatch(shown.message,new RegExp(secret));}});
test('actual adapter distinguishes transport failure from snapshot validation',async()=>{
 const identity={currentUid:()=> 'synthetic',subscribe:()=>()=>{}},journal={read:async()=>null};
 for(const invalid of [false,true]){const original=Object.assign(Error(secret),{code:'SERVER_UNCONFIRMED'});let sent=0;const adapter=createOriginalDataAdapter({identity,pendingJournal:journal,readSnapshot:async()=>{sent++;if(invalid)return {ok:true};throw original;}});
  let caught;try{await adapter.initialize()}catch(e){caught=e;}assert.ok(caught);assert.equal(sent,1);assert.deepEqual(safeStartupDiagnostic(caught),invalid?{stage:'VALIDATE',code:'INVALID_SNAPSHOT'}:{stage:'READ',code:'SERVER_UNCONFIRMED'});if(!invalid)assert.equal(caught,original);adapter.dispose();
 }
});
test('actual UI, output-ready and final foreground boundaries retain original errors',async()=>{
 const [{JSDOM},{readFileSync},D,{emptyInvoiceSettings},{startOriginalApp},{startConnectedOriginalApp}]=await Promise.all([import('jsdom'),import('node:fs'),import('../src/domain.js'),import('../src/invoice-settings.js'),import('../src/original-app.js'),import('../src/connected-original-app.js')]);
 const snapshot=()=>({ok:true,schemaVersion:1,state:D.createSampleState(),invoiceSettings:emptyInvoiceSettings(),actor:{memberId:'demo-member-1',displayName:'Synthetic',role:'admin'},capabilities:{recordsWrite:true,customersWrite:true,itemsWrite:true,membersWrite:true,invoiceSettingsWrite:true},revision:0,sourceFingerprint:'a'.repeat(64),watchCursor:'b'.repeat(64),billingStatus:{ready:true,reasons:[],scope:'reference-subtotal',formalTotalsVerified:false},projectionCurrent:true,reasons:[]});
 for(const stage of ['UI','OUTPUT']){
  const dom=new JSDOM(readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.test',pretendToBeVisual:true});dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false};
  const adapter=createOriginalDataAdapter({identity:{currentUid:()=> 'synthetic',subscribe:()=>()=>{}},readSnapshot:async()=>snapshot(),pendingJournal:{read:async()=>null}}),error=Error(secret);
  const services=stage==='UI'?{installInvoiceSettings(){throw error;}}:{installInvoiceOutput:()=>({ready:Promise.reject(error),destroy(){}})};
  await assert.rejects(startOriginalApp({doc:dom.window.document,adapter,services}),e=>e===error);assert.deepEqual(safeStartupDiagnostic(error),{stage,code:'UNKNOWN'});adapter.dispose();dom.window.close();
 }
 const dom=new JSDOM('<main id="google-app-root">synthetic</main>',{url:'https://example.test'});Object.defineProperty(dom.window.document,'visibilityState',{value:'hidden',configurable:true});let requests=0;
 await assert.rejects(startConnectedOriginalApp({doc:dom.window.document,identity:{currentUid:()=> 'synthetic',subscribe:()=>()=>{}},client:{read:async()=>{requests++;return snapshot();}},pendingJournal:{read:async()=>null},services:{invoiceSealStore:{dispose(){}}},startApp:async({adapter})=>{await adapter.initialize();return{dispose(){}};}}),e=>safeStartupDiagnostic(e).stage==='FINAL');assert.equal(requests,1);assert.equal(dom.window.document.getElementById('google-app-root').hidden,true);dom.window.close();
});

for(const code of ['NOT_CONFIGURED','ROSTER_NOT_CONFIGURED','ROSTER_INVALID','SOURCE_LIMIT','SOURCE_ID_INVALID','BILLING_SCHEMA_CHANGED','STORAGE_ACCESS_DENIED','STORAGE_MERGED_CELLS','WORKSPACE_COMMIT_OUTCOME_UNKNOWN','BAD_REQUEST']){
 test(`fixed backend read diagnostic ${code} is shown without sensitive fields`,async()=>{
  const e=Object.assign(Error(secret),{code,stack:secret,body:secret,token:secret});markStartupFailure(e,'READ');
  assert.deepEqual(safeStartupDiagnostic(e),{stage:'READ',code});
  const {shown}=await failure(e);assert.ok(shown.message.endsWith(`（起動確認: APP / READ / ${code}）`));assert.ok(!JSON.stringify(shown).includes(secret));
  assert.deepEqual(safeStartupDiagnostic({code:code+' '+secret}),{stage:'UNKNOWN',code:'UNKNOWN'});
 });
}
