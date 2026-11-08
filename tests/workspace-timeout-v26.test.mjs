import test from 'node:test';import assert from 'node:assert/strict';
import {createWorkspaceClient} from '../src/workspace-client.js';
const endpoint='https://script.google.com/macros/s/synthetic/exec';
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function setup(t,{responseAt=null,timeoutMs}={}){
 t.mock.timers.enable({apis:['setTimeout']});let calls=0,uid='synthetic',onChange,signal;
 const identity={currentUid:()=>uid,subscribe:fn=>{onChange=fn;return()=>{};},getIdToken:async()=> 'synthetic-token'};
 const fetchImpl=async(_url,options)=>{calls++;signal=options.signal;return new Promise(resolve=>{if(responseAt!==null)setTimeout(()=>resolve({ok:true,json:async()=>({ok:true,synthetic:true})}),responseAt);});};
 const client=createWorkspaceClient({identity,endpoint,fetchImpl,...timeoutMs===undefined?{}:{timeoutMs}});
 return{client,calls:()=>calls,signal:()=>signal,changeIdentity(){uid='other';onChange(uid);}};
}
test('42.267-second workspace read succeeds rather than falsely timing out at 30 seconds',async t=>{
 const h=setup(t,{responseAt:42267});let completed=false;const p=h.client.read().then(r=>{completed=true;return r;});await flush();assert.equal(h.calls(),1);
 t.mock.timers.tick(30000);await flush();assert.equal(completed,false);assert.equal(h.signal().aborted,false);
 t.mock.timers.tick(12267);await flush();assert.deepEqual(await p,{ok:true,synthetic:true});assert.equal(h.calls(),1);
});
for(const method of ['read','change','operation'])test(method+' has a finite 120-second upper bound and sends once',async t=>{
 const h=setup(t);const p=method==='change'?h.client.change({synthetic:true}):method==='operation'?h.client.operation('12345678-1234-4123-8123-123456789abc'):h.client.read();
 const checked=assert.rejects(p,e=>e.code==='TIMEOUT'&&e.definitiveRejection===false&&e.unknown===(method==='change'));await flush();
 t.mock.timers.tick(119999);await flush();assert.equal(h.signal().aborted,false);t.mock.timers.tick(1);await checked;assert.equal(h.signal().aborted,true);assert.equal(h.calls(),1);
 t.mock.timers.tick(300000);await flush();assert.equal(h.calls(),1);
});
test('lightweight check keeps its 30-second deadline',async t=>{
 const h=setup(t);const checked=assert.rejects(h.client.check({cursor:null}),e=>e.code==='TIMEOUT'&&e.unknown===false);await flush();
 t.mock.timers.tick(29999);await flush();assert.equal(h.signal().aborted,false);t.mock.timers.tick(1);await checked;assert.equal(h.calls(),1);
});
for(const method of ['read','check','change','operation'])test('explicit timeout override remains effective for '+method,async t=>{
 const h=setup(t,{timeoutMs:25});const p=method==='read'?h.client.read():method==='check'?h.client.check({cursor:null}):method==='change'?h.client.change({synthetic:true}):h.client.operation('12345678-1234-4123-8123-123456789abc');
 const checked=assert.rejects(p,e=>e.code==='TIMEOUT');await flush();t.mock.timers.tick(24);await flush();assert.equal(h.signal().aborted,false);t.mock.timers.tick(1);await checked;assert.equal(h.calls(),1);
});
test('authentication change immediately aborts sent mutation as unknown and never retries',async t=>{
 const h=setup(t);const checked=assert.rejects(h.client.change({synthetic:true}),e=>e.code==='LOGIN_REQUIRED'&&e.unknown===true&&e.definitiveRejection===false);await flush();
 t.mock.timers.tick(42000);h.changeIdentity();await checked;assert.equal(h.signal().aborted,true);assert.equal(h.calls(),1);t.mock.timers.tick(300000);await flush();assert.equal(h.calls(),1);
});
test('sent mutation timeout preserves the pending journal and blocks a new save',async t=>{
 const [{createOriginalDataAdapter},D,{emptyInvoiceSettings}]=await Promise.all([import('../src/original-data-adapter.js'),import('../src/domain.js'),import('../src/invoice-settings.js')]);
 const h=setup(t);let marker=null,clearCalls=0;const state=D.createSampleState();
 const snapshot={ok:true,schemaVersion:1,state,invoiceSettings:emptyInvoiceSettings(),actor:{memberId:state.masters.members[0].id,displayName:'Synthetic',role:'admin'},capabilities:{recordsWrite:true,customersWrite:true,itemsWrite:true,membersWrite:true,invoiceSettingsWrite:true},revision:0,sourceFingerprint:'a'.repeat(64),watchCursor:'b'.repeat(64),billingStatus:{ready:true,reasons:[],scope:'reference-subtotal',formalTotalsVerified:false},projectionCurrent:true,reasons:[]};
 const adapter=createOriginalDataAdapter({identity:{currentUid:()=> 'synthetic',subscribe:()=>()=>{}},readSnapshot:async()=>snapshot,sendCommand:command=>h.client.change(command),queryOperation:async()=>{throw Error('not requested');},pendingJournal:{read:async()=>marker,claim:async(_uid,value)=>{marker=value;},clear:async()=>{clearCalls++;marker=null;}}});
 await adapter.initialize();const command={type:'record.update',id:'synthetic-record',expectedVersion:1,input:{notes:'synthetic'}};
 const checked=assert.rejects(adapter.execute(command),e=>e.unknown===true&&e.code==='TIMEOUT');await flush();assert.equal(h.calls(),1);t.mock.timers.tick(120000);await checked;
 assert.ok(marker?.operationId);assert.equal(clearCalls,0);await assert.rejects(adapter.execute(command),e=>e.code==='OPERATION_UNKNOWN');assert.equal(h.calls(),1);assert.equal(clearCalls,0);adapter.dispose();
});
