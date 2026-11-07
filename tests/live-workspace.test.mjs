import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveApi,createLiveSession} from '../src/live-api.js';
import {validateBilling} from '../src/live-workspace.js';
import {isLocalMode} from '../src/app-entry.js';
const identity=()=>{let uid='a',listener;return {currentUid:()=>uid,getIdToken:async()=> 'token',subscribe:fn=>{listener=fn;return()=>{};},switch(next){uid=next;listener(next);}};};
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const locks={request:async(n,o,fn)=>fn({})};
test('default is live; browser demo only explicit mode',()=>{assert.equal(isLocalMode(''),false);assert.equal(isLocalMode('?example=calculation'),false);assert.equal(isLocalMode('?mode=local'),true);});
test('session rejects late requests and account changes',()=>{const id=identity(),s=createLiveSession(id),t=s.capture();assert.equal(s.isCurrent(t),true);id.switch('b');assert.equal(s.isCurrent(t),false);s.dispose();});
test('billing uses fresh authenticated no-store POST',async()=>{const id=identity(),session=createLiveSession(id);let calls=0;id.getIdToken=async()=>{calls++;return 'fresh';};const api=createLiveApi({identity:id,session,getStorage:()=>store(),getLocks:()=>locks,fetchImpl:async(url,opts)=>{assert.equal(opts.method,'POST');assert.equal(opts.cache,'no-store');assert.deepEqual(JSON.parse(opts.body),{action:'billing.read',idToken:'fresh',month:'2026-11'});return {ok:true,json:async()=>({ok:true})};}});await api.readBilling({month:'2026-11'});await api.readBilling({month:'2026-11'});assert.equal(calls,2);});
test('billing rejects stale response after identity change',async()=>{const id=identity(),session=createLiveSession(id);const api=createLiveApi({identity:id,session,getStorage:()=>store(),getLocks:()=>locks,fetchImpl:async()=>{id.switch('b');return {ok:true,json:async()=>({ok:true})};}});await assert.rejects(api.readBilling({month:'2026-11'}));});
test('billing fails closed without locks',async()=>{const id=identity(),session=createLiveSession(id);let fetched=false;const api=createLiveApi({identity:id,session,getStorage:()=>store(),getLocks:()=>null,fetchImpl:async()=>{fetched=true;}});await assert.rejects(api.readBilling({month:'2026-11'}));assert.equal(fetched,false);});
test('billing validator preserves null versus zero and rejects numeric floats',()=>{const c={key:'A',name:'A',reportCount:0,missingInputs:[],baseFee:null,disposalRate:'0',combustibleKg:'0',noncombustibleKg:'0',combustibleAmount:null,noncombustibleAmount:null,otherFee:'0',monthlySubtotal:null,submissionTotal:null};const v={ok:true,schemaVersion:1,projectionCurrent:true,month:'2026-11',snapshotId:'s',customers:[c],total:null};assert.equal(validateBilling(v).customers[0].baseFee,null);assert.equal(validateBilling(v).customers[0].disposalRate,'0');assert.throws(()=>validateBilling({...v,customers:[{...c,baseFee:0}]}));});
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {startLiveWorkspace} from '../src/live-workspace.js';
const billingFixture=()=>({ok:true,schemaVersion:1,projectionCurrent:true,month:'2026-11',timezone:'Asia/Tokyo',verifiedAt:'2026-11-07T00:00:00.000Z',snapshotId:'s',total:'0',customers:[{key:'実取引先',name:'実取引先',reportCount:0,missingInputs:[],baseFee:'0',disposalRate:'0',combustibleKg:'0',noncombustibleKg:'0',combustibleAmount:'0',noncombustibleAmount:'0',otherFee:'0',monthlySubtotal:'0',submissionTotal:'0'}]});
test('live default mounts server customers and leaves legacy records untouched',async()=>{
 const dom=new JSDOM(readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.test/#report'}),doc=dom.window.document;
 Object.defineProperty(dom.window.navigator,'locks',{value:locks});dom.window.localStorage.setItem('routenote.v3','legacy untouched');const id=identity(),session=createLiveSession(id);
 const api={readBilling:async()=>billingFixture(),assertReady:async()=>session.capture()};const workspace=await startLiveWorkspace({doc,identity:id,session,api});
 assert.match(doc.querySelector('#report-form-host').textContent,/実取引先/);assert.match(doc.querySelector('#report-form-host').textContent,/現在のシート設定/);assert.equal(dom.window.localStorage.getItem('routenote.v3'),'legacy untouched');assert.equal(dom.window.localStorage.length,1);assert.equal(doc.querySelector('#demo-session-dialog').open,false);
 const t=session.capture();id.switch('b');assert.equal(session.isCurrent(t),false);assert.equal(doc.querySelector('#report-form-host').textContent,'');workspace.dispose();dom.window.close();
});
test('successful but stale change remains uncertain for durable same-operation recovery',async()=>{
 const id=identity(),session=createLiveSession(id),storage=store();const api=createLiveApi({identity:id,session,getStorage:()=>storage,getLocks:()=>locks,fetchImpl:async()=>{id.switch('b');return {ok:true,json:async()=>({ok:true,committed:true,projectionCurrent:true,publicationPending:false})};}});
 await assert.rejects(api.change({}, {expectedUid:'a'}),e=>e.uncertain===true);
});
test('restored attempted draft cannot become a new operation',async()=>{
 const dom=new JSDOM(readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.test/#report'}),doc=dom.window.document;Object.defineProperty(dom.window.navigator,'locks',{value:locks});
 const fields={date:'2026-11-07',customerName:'実取引先',combustibleKg:'0',noncombustibleKg:'',otherItem:'',otherFee:''};dom.window.localStorage.setItem('routenote.live.draft.v1.a',JSON.stringify({uid:'a',fields,operationId:'12345678-1234-4123-8123-123456789abc'}));
 const id=identity(),session=createLiveSession(id);const workspace=await startLiveWorkspace({doc,identity:id,session,api:{readBilling:async()=>billingFixture(),assertReady:async()=>session.capture()}});
 assert.equal(doc.querySelector('#report-form-host [type=submit]').disabled,true);assert.match(doc.querySelector('#report-form-host').textContent,/一度送信を試みています/);workspace.dispose();dom.window.close();
});
test('unsent draft detects competing tab changes without overwrite',async()=>{
 const dom=new JSDOM(readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.test/#report'}),doc=dom.window.document;Object.defineProperty(dom.window.navigator,'locks',{value:locks});
 const id=identity(),session=createLiveSession(id);const workspace=await startLiveWorkspace({doc,identity:id,session,api:{readBilling:async()=>billingFixture(),assertReady:async()=>session.capture()}});
 const competing='another-tab';dom.window.localStorage.setItem('routenote.live.draft.v1.a',competing);const input=doc.querySelector('[name=combustibleKg]');input.value='1';input.dispatchEvent(new dom.window.Event('input'));await new Promise(r=>setTimeout(r,10));assert.equal(dom.window.localStorage.getItem('routenote.live.draft.v1.a'),competing);assert.equal(doc.querySelector('#global-error').hidden,false);workspace.dispose();dom.window.close();
});
test('day and year summary use actual records with decimal-safe quantities, no monthly fee total',async()=>{
 const dom=new JSDOM(readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.test/#summary'}),doc=dom.window.document;Object.defineProperty(dom.window.navigator,'locks',{value:locks});
 const id=identity(),session=createLiveSession(id);const api={readBilling:async()=>billingFixture(),assertReady:async()=>session.capture(),readPage:async()=>({blocked:false,projectionCurrent:true,publicationPending:false,records:[{deleted:false,fields:{date:'2026-11-07',customerName:'実取引先',combustibleKg:0.1,noncombustibleKg:null,otherFee:0}},{deleted:false,fields:{date:'2026-11-07',customerName:'実取引先',combustibleKg:0.2,noncombustibleKg:0,otherFee:10}},{deleted:true,fields:{date:'2026-11-07',customerName:'実取引先',combustibleKg:99,noncombustibleKg:0,otherFee:0}}]})};
 const workspace=await startLiveWorkspace({doc,identity:id,session,api});doc.querySelector('[data-period=year]').click();await new Promise(r=>setTimeout(r,5));const period=doc.querySelector('#period-value');period.value='2026';period.dispatchEvent(new dom.window.Event('change'));await new Promise(r=>setTimeout(r,5));const text=doc.querySelector('#summary-list').textContent;assert.match(text,/0.3 kg/);assert.match(text,/10 円/);assert.match(text,/月額基本料金・単価による計算・税額は含めません/);assert.doesNotMatch(text,/99 kg/);assert.match(text,/空欄を含みます/);workspace.dispose();dom.window.close();
});
