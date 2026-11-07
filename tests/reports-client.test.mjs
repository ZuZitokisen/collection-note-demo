import test from 'node:test';
import assert from 'node:assert/strict';
import {createReportsClient,normalizeReports,makeChange,normalizeFields} from '../src/reports-client.js';
const id='11111111-1111-4111-8111-111111111111';
const fields={date:'2026-11-07',customerName:'取引先',combustibleKg:0,noncombustibleKg:null,otherItem:'',otherFee:null};
const record={id,revision:2,deleted:false,fingerprint:'abc',fields};
const envelope={ok:true,records:[record],conflicts:[],totalsBlocked:false,customerNames:['取引先'],projectionCurrent:true,publicationPending:false};
const endpoint='https://script.google.com/macros/s/test/exec';
const client=(fetchImpl,getIdToken=async()=> 'token')=>createReportsClient({endpoint,getIdToken,fetchImpl});
test('fields preserve blank/zero and validate dates/ranges/precision',()=>{
 assert.equal(normalizeFields(fields).combustibleKg,0);assert.equal(normalizeFields(fields).noncombustibleKg,null);
 for(const patch of [{date:'2026-02-30'},{combustibleKg:-1},{otherFee:Infinity},{otherFee:0.0000001},{customerName:''},{combustibleKg:null}])assert.throws(()=>normalizeFields({...fields,...patch}));
});
test('response validation fails closed, supports conflict envelope',()=>{
 assert.equal(normalizeReports(envelope).records.length,1);
 assert.equal(normalizeReports({...envelope,ok:false,records:[],conflicts:[{code:'BASE_CHANGED'}],totalsBlocked:true,projectionCurrent:false}).blocked,true);
 for(const patch of [{records:[record,record]},{records:[{...record,fingerprint:''}]},{projectionCurrent:undefined},{customerNames:[42]}])assert.throws(()=>normalizeReports({...envelope,...patch}));
});
test('change uses immutable fields and revision/fingerprint; no price or actor',()=>{
 const change=makeChange('update',record,fields,id);
 assert.equal(change.expectedRevision,2);assert.equal(change.expectedFingerprint,'abc');assert.equal(change.operationId,id);assert.equal(change.actor,undefined);assert.ok(Object.isFrozen(change.fields));
 assert.equal(makeChange('delete',record,null,id).fields,undefined);
});
test('client sends forced token in POST only, reports endpoints, no automatic retry',async()=>{
 const calls=[];let refresh;
 const c=client(async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>envelope};},async(force)=>{refresh=force;return 'token';});
 await c.readPage();assert.equal(refresh,true);assert.equal(calls.length,1);
 const {url,options}=calls[0];assert.ok(!url.includes('token'));assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');assert.deepEqual(JSON.parse(options.body),{action:'reports.read',idToken:'token'});
});
test('transport/invalid response/unknown server errors retain uncertain write',async()=>{
 for(const fetcher of [async()=>{throw Error('network');},async()=>({ok:true,json:async()=>({ok:true})}),async()=>({ok:true,json:async()=>({ok:false,error:'COMMIT_OUTCOME_UNKNOWN'})})]) {
  let count=0;const c=client(async(...args)=>{count++;return fetcher(...args);});await assert.rejects(c.change(makeChange('create',null,fields,id)),e=>e.uncertain===true);assert.equal(count,1);
 }
});
test('known precommit rejections are not uncertain; auth failure does not dispatch',async()=>{
 const c=client(async()=>({ok:true,json:async()=>({ok:false,error:'CONFLICT'})}));await assert.rejects(c.change({}),e=>e.code==='CONFLICT'&&e.uncertain===false);
 let sent=false;const login=client(async()=>{sent=true;},async()=>{throw Error();});await assert.rejects(login.change({}),e=>e.code==='LOGIN_REQUIRED'&&!e.uncertain);assert.equal(sent,false);
});
test('explicit retry serializes exact same change; committed pending is not final publication',async()=>{
 const bodies=[];const c=client(async(url,options)=>{bodies.push(JSON.parse(options.body));if(bodies.length===1)throw Error();return {ok:true,json:async()=>({ok:true,committed:true,projectionCurrent:false,publicationPending:true})};});
 const input=makeChange('create',null,fields,id);await assert.rejects(c.change(input));assert.equal((await c.change(input)).publicationPending,true);assert.deepEqual(bodies[0].change,bodies[1].change);
});
test('timeout never retries and remains uncertain; cancellation before token never dispatches',async()=>{
 let count=0;
 const c=createReportsClient({endpoint,getIdToken:async()=> 'token',timeoutMs:5,fetchImpl:async(url,{signal})=>{count++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}});
 await assert.rejects(c.change({}),e=>e.uncertain===true);assert.equal(count,1);
 const abort=new AbortController();abort.abort();await assert.rejects(c.change({},{signal:abort.signal}),e=>e.code==='ABORTED'&&e.uncertain===false);assert.equal(count,1);
});
test('hung token times out without dispatch and retains operation for explicit retry',async()=>{
 let resolve,dispatch=0;const c=createReportsClient({endpoint,timeoutMs:5,getIdToken:()=>new Promise(r=>resolve=r),fetchImpl:async()=>{dispatch++;}});
 await assert.rejects(c.change({}),e=>e.code==='AUTH_TIMEOUT'&&e.retainPending===true&&e.uncertain===false);assert.equal(dispatch,0);resolve('late-token');await new Promise(r=>setTimeout(r,10));assert.equal(dispatch,0);
});
