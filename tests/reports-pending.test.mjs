import test from 'node:test';
import {createLockManager} from './lock-manager.mjs';
import assert from 'node:assert/strict';
import {createPendingStore,PENDING_PREFIX} from '../src/reports-pending.js';
import {makeChange} from '../src/reports-client.js';
const id='11111111-1111-4111-8111-111111111111';
const fields={date:'2026-11-07',customerName:'Example',combustibleKg:0,noncombustibleKg:null,otherItem:'',otherFee:null};
const locks=createLockManager(),getLocks=()=>locks;
const input=makeChange('create',null,fields,id);
function memory(){const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('new store reconstructs immutable request and actor scope without tokens',async()=>{
 const storage=memory(),first=createPendingStore(()=>storage,getLocks);await first.save('uid1',input);
 const second=createPendingStore(()=>storage,getLocks);assert.deepEqual(await second.read('uid1'),input);assert.ok(Object.isFrozen(await second.read('uid1')));assert.ok(Object.isFrozen((await second.read('uid1')).fields));assert.equal(await second.read('uid2'),null);
 const value=JSON.parse(storage.getItem(PENDING_PREFIX+'uid1'));assert.deepEqual(Object.keys(value),['version','uid','input']);assert.equal(JSON.stringify(value).includes('idToken'),false);
 await second.remove('uid1',input);assert.equal(await first.read('uid1'),null);
});
test('corrupt/foreign actor/extra fields fail closed and are not overwritten',async()=>{
 const storage=memory(),store=createPendingStore(()=>storage,getLocks),key=PENDING_PREFIX+'uid1';
 for(const value of ['{','null',JSON.stringify({version:1,uid:'uid2',input}),JSON.stringify({version:1,uid:'uid1',input:{...input,idToken:'secret'}}),JSON.stringify({version:1,uid:'uid1',input:{...input,fields:{...fields,combustibleKg:'0'}}})]) {
  storage.setItem(key,value);await assert.rejects(store.read('uid1'));await assert.rejects(store.save('uid1',input));assert.equal(storage.getItem(key),value);
 }
});
test('storage errors and conflicting pending operations fail closed',async()=>{
 const denied=createPendingStore(()=>{throw Error('denied');},getLocks);await assert.rejects(denied.probe('uid1'));await assert.rejects(denied.save('uid1',input));
 const storage=memory(),store=createPendingStore(()=>storage,getLocks);await store.save('uid1',input);const other=makeChange('create',null,{...fields,date:'2026-11-08'},'22222222-2222-4222-8222-222222222222');await assert.rejects(store.save('uid1',other));await assert.rejects(store.remove('uid1',other));assert.deepEqual(await store.read('uid1'),input);
});
test('two clients cannot overwrite each other when saves are interleaved',async()=>{
 const sharedLocks=createLockManager(),storage=memory();
 const a=createPendingStore(()=>storage,()=>sharedLocks),b=createPendingStore(()=>storage,()=>sharedLocks);
 const other=makeChange('create',null,{...fields,date:'2026-11-08'},'22222222-2222-4222-8222-222222222222');
 let release;const held=sharedLocks.request(PENDING_PREFIX+'uid1.lock',{mode:'exclusive'},()=>new Promise(r=>release=r));await new Promise(r=>setTimeout(r,0));
 const first=a.save('uid1',input),second=b.save('uid1',other);const rejected=assert.rejects(second);assert.equal(storage.data.size,0);
 // A different UID is not blocked by this user's lock.
 await b.save('uid2',other);assert.equal(storage.data.size,1);
 release();await held;await first;await rejected;assert.deepEqual(await b.read('uid1'),input);assert.deepEqual(await a.read('uid2'),other);
});
test('delayed removal never deletes another tab new pending request',async()=>{
 const sharedLocks=createLockManager(),storage=memory(),a=createPendingStore(()=>storage,()=>sharedLocks),b=createPendingStore(()=>storage,()=>sharedLocks);
 const other=makeChange('create',null,{...fields,date:'2026-11-08'},'22222222-2222-4222-8222-222222222222');
 await a.save('uid1',input);
 let release;const held=sharedLocks.request(PENDING_PREFIX+'uid1.lock',{mode:'exclusive'},()=>new Promise(r=>release=r));await new Promise(r=>setTimeout(r,0));
 const removeOld=a.remove('uid1',input),saveNew=b.save('uid1',other),lateOld=a.remove('uid1',input);const rejected=assert.rejects(lateOld);
 release();await held;await removeOld;await saveNew;await rejected;assert.deepEqual(await a.read('uid1'),other);
});
test('unavailable Web Locks never reads or mutates storage',async()=>{
 let accessed=0;const store=createPendingStore(()=>{accessed++;return memory();},()=>undefined);
 await assert.rejects(store.inspect('uid1'));await assert.rejects(store.save('uid1',input));await assert.rejects(store.remove('uid1',input));assert.equal(accessed,0);
});
