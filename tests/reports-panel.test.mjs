import test from 'node:test';
import {createLockManager} from './lock-manager.mjs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installReportsPanel} from '../src/reports-panel.js';
import {ReportsError} from '../src/reports-client.js';
const id='11111111-1111-4111-8111-111111111111';
const fields={date:'2026-11-07',customerName:'<img src=x onerror=alert(1)>',combustibleKg:0,noncombustibleKg:null,otherItem:'<script>bad</script>',otherFee:null};
const row={id,revision:3,deleted:false,fingerprint:'fp3',fields};
const snapshot=()=>({records:[row,{...row,id:'22222222-2222-4222-8222-222222222222',deleted:true}],customerNames:[fields.customerName],blocked:false,projectionCurrent:true,publicationPending:false});
const defaultLocks=createLockManager();
const tick=()=>new Promise(r=>setTimeout(r,0));
function setup({getLocks=()=>defaultLocks,getStorage,uid='uid1',readPage=async()=>snapshot(),change=async()=>({committed:true,projectionCurrent:true,publicationPending:false})}={}){
 const dom=new JSDOM('<div id="host"></div>',{pretendToBeVisual:true,url:'https://example.test/'}),doc=dom.window.document;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const panel=installReportsPanel({host:doc.querySelector('#host'),readPage:async options=>{await panel.setIdentity(uid);return readPage(options);},change,getStorage,getLocks,uuid:()=>id});
 const click=action=>doc.querySelector(`[data-action="${action}"]`).click();
 return {dom,doc,panel,click,start:async()=>{await panel.setAuthorization(true);await panel.show();},dispose:()=>{panel.dispose();dom.window.close();}};
}
test('safe text, blank/zero, edit canceled without write, deletion and restoration confirmation',async()=>{
 const calls=[];const t=setup({change:async(input)=>{calls.push(input);return {committed:true,projectionCurrent:true,publicationPending:false};}});await t.start();
 assert.equal(t.doc.querySelectorAll('img,script').length,0);assert.match(t.doc.querySelector('.rn-ledger-list').textContent,/0 kg/);assert.match(t.doc.querySelector('.rn-ledger-list').textContent,/—/);
 t.click('update');t.doc.querySelector('[name="combustibleKg"]').value='99';t.click('cancel');assert.equal(t.doc.querySelector('dialog').open,false);assert.equal(calls.length,0);
 t.click('delete');t.doc.querySelector('form').requestSubmit();await tick();assert.equal(calls[0].action,'delete');assert.equal(calls[0].expectedRevision,3);assert.equal(calls[0].expectedFingerprint,'fp3');assert.equal(calls[0].fields,undefined);
 t.click('trash');t.click('restore');t.doc.querySelector('form').requestSubmit();await tick();assert.equal(calls[1].action,'restore');t.dispose();
});
test('update preserves blank versus zero and double submit sends once',async()=>{
 let resolve;const calls=[];const t=setup({change:input=>{calls.push(input);return new Promise(r=>resolve=r);}});await t.start();t.click('update');
 const form=t.doc.querySelector('form');form.requestSubmit();form.requestSubmit();await tick();assert.equal(calls.length,1);assert.equal(calls[0].fields.combustibleKg,0);assert.equal(calls[0].fields.noncombustibleKg,null);assert.equal(t.doc.querySelector('[data-action="create"]').disabled,true);
 resolve({committed:true,projectionCurrent:true,publicationPending:false});await tick();t.dispose();
});
test('unknown outcome blocks new changes and retry reuses input after navigation',async()=>{
 const calls=[];const t=setup({change:async input=>{calls.push(input);if(calls.length===1)throw new ReportsError('TRANSPORT_FAILED',true);return {committed:true,projectionCurrent:false,publicationPending:true};}});await t.start();t.click('delete');t.doc.querySelector('form').requestSubmit();await tick();assert.equal(calls.length,1);assert.equal(t.panel.getState().unresolved,true);
 t.panel.hide();await t.panel.setAuthorization(false);assert.equal(t.doc.querySelector('.rn-ledger-list').textContent,'');await t.panel.setAuthorization(true);await t.panel.show();assert.equal(t.doc.querySelector('[data-action="create"]').disabled,true);assert.equal(calls.length,1);
 t.click('retry-change');await tick();assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.match(t.doc.querySelector('.rn-ledger-status').textContent,/保存済み/);t.dispose();
});
test('logout closes modal and late reads cannot restore private display',async()=>{
 let resolve;const t=setup({readPage:()=>new Promise(r=>resolve=r)});await t.panel.setAuthorization(true);const request=t.panel.show();await tick();await t.panel.setAuthorization(false);resolve(snapshot());await request;assert.equal(t.panel.getState().rowCount,0);assert.equal(t.doc.querySelector('.rn-ledger-list').textContent,'');t.dispose();
 const u=setup();await u.start();u.click('update');await u.panel.setAuthorization(false);assert.equal(u.doc.querySelector('dialog').open,false);assert.equal(u.doc.querySelector('dialog').textContent,'');u.dispose();
});
test('conflict clears stale record and requires reread; projection conflict blocks edits',async()=>{
 const t=setup({change:async()=>{throw new ReportsError('CONFLICT');}});await t.start();t.click('update');t.doc.querySelector('form').requestSubmit();await tick();assert.equal(t.panel.getState().rowCount,0);assert.match(t.doc.querySelector('.rn-ledger-status').textContent,/別の変更/);assert.equal(t.doc.querySelector('[data-action="create"]').disabled,true);t.dispose();
 const u=setup({readPage:async()=>({...snapshot(),blocked:true,projectionCurrent:false,publicationPending:true})});await u.start();assert.equal(u.doc.querySelector('[data-action="create"]').disabled,true);assert.match(u.doc.querySelector('.rn-ledger-warning').textContent,/集計を停止/);u.dispose();
});
test('new records never read demo storage and source contains no price fields',async()=>{
 const calls=[];const t=setup({change:async input=>{calls.push(input);return {committed:true,projectionCurrent:true,publicationPending:false};}});await t.start();t.dom.window.localStorage.setItem('demo','do not upload');t.click('create');t.doc.querySelector('[name="date"]').value='2026-11-08';t.doc.querySelector('[name="customerName"]').value=fields.customerName;t.doc.querySelector('[name="otherFee"]').value='0';t.doc.querySelector('form').requestSubmit();await tick();assert.equal(calls[0].action,'create');assert.equal(calls[0].fields.otherFee,0);assert.equal(calls[0].fields.combustibleKg,null);assert.equal(calls[0].recordId,undefined);assert.equal(JSON.stringify(calls).includes('do not upload'),false);t.dispose();
});
test('an uncertain operation survives a failed reauthentication retry',async()=>{
 let attempts=0;const t=setup({change:async()=>{attempts++;throw new ReportsError(attempts===1?'TRANSPORT_FAILED':'LOGIN_REQUIRED',attempts===1);}});await t.start();t.click('delete');t.doc.querySelector('form').requestSubmit();await tick();t.click('retry-change');await tick();assert.equal(t.panel.getState().authorized,false);
 t.panel.hide();await t.panel.setAuthorization(true);await t.panel.show();assert.equal(t.panel.getState().unresolved,true);assert.equal(t.doc.querySelector('[data-action="create"]').disabled,true);t.dispose();
});
test('Escape cancels edits; hidden document clears data and late writes never reopen editor',async()=>{
 let finish;const t=setup({change:()=>new Promise(r=>finish=r)});await t.start();t.click('update');t.doc.querySelector('dialog').dispatchEvent(new t.dom.window.Event('cancel'));assert.equal(t.doc.querySelector('dialog').open,false);
 t.click('delete');t.doc.querySelector('form').requestSubmit();await tick();t.panel.hide();await t.panel.setAuthorization(false);finish({committed:true,projectionCurrent:true,publicationPending:false});await tick();assert.equal(t.doc.querySelector('dialog').open,false);assert.equal(t.panel.getState().rowCount,0);assert.equal(t.doc.querySelector('.rn-ledger-list').textContent,'');t.dispose();
 const u=setup();await u.start();u.click('update');Object.defineProperty(u.doc,'visibilityState',{configurable:true,value:'hidden'});u.doc.dispatchEvent(new u.dom.window.Event('visibilitychange'));assert.equal(u.doc.querySelector('dialog').open,false);assert.equal(u.panel.getState().rowCount,0);u.dispose();
});
test('pending operation is not exposed or retried by a different UID',async()=>{
 const t=setup({change:async()=>{throw new ReportsError('TRANSPORT_FAILED',true);}});await t.start();t.click('delete');t.doc.querySelector('form').requestSubmit();await tick();await t.panel.setIdentity('uid2');assert.equal(t.panel.getState().unresolved,false);await t.panel.setIdentity('uid1');assert.equal(t.panel.getState().unresolved,true);t.dispose();
});
const durableMemory=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
test('reload reconstructs the exact operation; only explicit retry writes, commit clears storage',async()=>{
 const storage=durableMemory(),calls=[];const first=setup({getStorage:()=>storage,change:async input=>{calls.push(input);assert.equal(storage.data.size,1);throw new ReportsError('TRANSPORT_FAILED',true);}});await first.start();first.click('delete');first.doc.querySelector('form').requestSubmit();await tick();assert.equal(storage.data.size,1);first.dispose();
 const second=setup({getStorage:()=>storage,change:async input=>{calls.push(input);return {committed:true,projectionCurrent:true,publicationPending:false};}});await second.start();assert.equal(calls.length,1);assert.equal(second.panel.getState().unresolved,true);assert.equal(second.doc.querySelector('[data-action="create"]').disabled,true);second.click('retry-change');await tick();assert.deepEqual(calls[1],calls[0]);assert.equal(storage.data.size,0);second.dispose();
});
test('reconstructed operation remains private to its UID and survives logout/reauth',async()=>{
 const storage=durableMemory();const first=setup({getStorage:()=>storage,change:async()=>{throw new ReportsError('TRANSPORT_FAILED',true);}});await first.start();first.click('update');first.doc.querySelector('form').requestSubmit();await tick();await first.panel.setAuthorization(false);assert.equal(first.doc.querySelector('.rn-reports-recovery').hidden,true);assert.equal(first.doc.querySelector('dialog').textContent,'');assert.equal(storage.data.size,1);first.dispose();
 const other=setup({uid:'uid2',getStorage:()=>storage});await other.start();assert.equal(other.panel.getState().unresolved,false);assert.equal(other.doc.querySelector('.rn-reports-recovery').hidden,true);assert.equal(storage.data.size,1);other.dispose();
 const original=setup({getStorage:()=>storage});await original.start();assert.equal(original.panel.getState().unresolved,true);original.dispose();
});
test('corruption and disabled storage stop writes with explanation',async()=>{
 for(const getStorage of [()=>{throw Error('disabled');},()=>({getItem:()=>'{corrupt',setItem(){},removeItem(){}})]) {
  let writes=0;const t=setup({getStorage,change:async()=>{writes++;}});await t.start();assert.equal(t.panel.getState().storageError,true);assert.equal(t.doc.querySelector('[data-action="create"]').disabled,true);assert.match(t.doc.querySelector('[role="alert"]').textContent,/書き込みを停止/);assert.equal(writes,0);t.dispose();
 }
});
test('failure to durably save before dispatch never sends; definite rejection clears pending',async()=>{
 const storage=durableMemory();let fail=false,writes=0;const original=storage.setItem;storage.setItem=(k,v)=>{if(fail)throw Error('quota');original(k,v);};
 const t=setup({getStorage:()=>storage,change:async()=>{writes++;}});await t.start();t.click('delete');fail=true;t.doc.querySelector('form').requestSubmit();await tick();assert.equal(writes,0);assert.equal(t.panel.getState().storageError,true);t.dispose();
 const clean=durableMemory(),u=setup({getStorage:()=>clean,change:async()=>{throw new ReportsError('CONFLICT');}});await u.start();u.click('delete');u.doc.querySelector('form').requestSubmit();await tick();assert.equal(clean.data.size,0);u.dispose();
});
test('auth timeout preserves the durable unsent operation for retry',async()=>{
 const storage=durableMemory(),t=setup({getStorage:()=>storage,change:async()=>{throw Object.assign(new ReportsError('AUTH_TIMEOUT'),{retainPending:true});}});await t.start();t.click('delete');t.doc.querySelector('form').requestSubmit();await tick();assert.equal(t.panel.getState().unresolved,true);assert.equal(storage.data.size,1);assert.match(t.doc.querySelector('.rn-ledger-status').textContent,/今回は送信していません/);t.dispose();
});
test('failed pending cleanup after confirmed commit keeps operation and stops writes',async()=>{
 const storage=durableMemory();let fail=false;const remove=storage.removeItem;storage.removeItem=k=>{if(fail&&!k.endsWith('.probe'))throw Error('denied');remove(k);};
 const t=setup({getStorage:()=>storage,change:async()=>{fail=true;return {committed:true,projectionCurrent:true,publicationPending:false};}});await t.start();t.click('delete');t.doc.querySelector('form').requestSubmit();await tick();assert.equal(t.panel.getState().unresolved,true);assert.equal(t.panel.getState().storageError,true);assert.equal(storage.data.size,1);t.dispose();
});
test('logout while awaiting a save lock prevents dispatch and preserves the original UID pending',async()=>{
 const storage=durableMemory(),locks=createLockManager();let writes=0;
 const t=setup({getStorage:()=>storage,getLocks:()=>locks,change:async()=>{writes++;}});await t.start();
 let release;const held=locks.request('routenote.reports.pending.v1.uid1.lock',{mode:'exclusive'},()=>new Promise(r=>release=r));await tick();
 t.click('delete');t.doc.querySelector('form').requestSubmit();assert.equal(t.doc.querySelector('[data-action="create"]').disabled,true);t.panel.hide();await t.panel.setAuthorization(false);
 release();await held;await tick();assert.equal(writes,0);assert.equal(t.panel.getState().unresolved,false);assert.equal(t.doc.querySelector('.rn-ledger-list').textContent,'');assert.equal(storage.data.size,1);
 await t.panel.setAuthorization(true);await t.panel.show();assert.equal(t.panel.getState().unresolved,true);assert.equal(writes,0);t.dispose();
});
test('logout while awaiting identity storage inspection cannot restore old data',async()=>{
 const storage=durableMemory(),locks=createLockManager();let release;
 const held=locks.request('routenote.reports.pending.v1.uid1.lock',{mode:'exclusive'},()=>new Promise(r=>release=r));await tick();
 const t=setup({getStorage:()=>storage,getLocks:()=>locks});const starting=t.start();await tick();await t.panel.setAuthorization(false);release();await held;await starting;
 assert.equal(t.panel.getState().authorized,false);assert.equal(t.panel.getState().rowCount,0);assert.equal(t.doc.querySelector('.rn-ledger-list').textContent,'');t.dispose();
});
test('missing Web Locks disables editing rather than allowing untracked writes',async()=>{
 const t=setup({getLocks:()=>undefined});await t.start();assert.equal(t.panel.getState().storageError,true);assert.equal(t.doc.querySelector('[data-action="create"]').disabled,true);assert.match(t.doc.querySelector('[role="alert"]').textContent,/Web Locks/);t.dispose();
});
