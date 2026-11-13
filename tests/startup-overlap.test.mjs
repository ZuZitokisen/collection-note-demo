import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';
import {createStartupRead} from '../src/startup-read.js';
import {createConnectionEntry} from '../src/connection-entry.js';
import {installEntrySurface,createEntryGate} from '../src/google-entry.js';
import {createIdentityVerifier} from '../src/identity-verifier.js';
import {createApiIdentity} from '../src/firebase-driver.js';
import * as D from '../src/domain.js';import {emptyInvoiceSettings} from '../src/invoice-settings.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=()=>new Promise(r=>setTimeout(r,0));async function settle(){for(let i=0;i<5;i++)await tick();}
const dto=()=>({ok:true,schemaVersion:1,state:D.createSampleState(),invoiceSettings:emptyInvoiceSettings(),invoiceSettingsProvenance:null,actor:{memberId:'demo-member-1',displayName:'Synthetic',role:'admin'},capabilities:{recordsWrite:true,customersWrite:true,itemsWrite:true,membersWrite:true,invoiceSettingsWrite:true},revision:0,sourceFingerprint:'a'.repeat(64),watchCursor:'b'.repeat(64),billingStatus:{ready:true,reasons:[],scope:'reference-subtotal',formalTotalsVerified:false},projectionCurrent:true,reasons:[]});
function identity(){let uid='A';const listeners=new Set();return{currentUid:()=>uid,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},getIdToken:async()=> 'synthetic',set(value){uid=value;for(const fn of [...listeners])fn(uid);}};}
test('startup result is in-memory one-use data and clears on disposal',async()=>{const who=identity(),p=createStartupRead({identity:who,uid:'A',read:async()=>({private:'synthetic'})});await p.ready;assert.deepEqual(await p.consume(),{private:'synthetic'});await assert.rejects(p.consume(),{code:'STALE_READ'});p.dispose();await assert.rejects(p.consume(),{code:'LOGIN_REQUIRED'});});
test('UID change and A-null-A invalidate even a late successful read',async()=>{for(const next of ['B',null]){const who=identity(),response=deferred(),p=createStartupRead({identity:who,uid:'A',read:()=>response.promise});await tick();who.set(next);who.set('A');response.resolve({private:'old'});await assert.rejects(p.ready,{code:'LOGIN_REQUIRED'});await assert.rejects(p.consume());}});
test('cancellation before token verification finishes suppresses request dispatch',async()=>{const who=identity(),token=deferred();who.getIdToken=()=>token.promise;let dispatched=0;const p=createStartupRead({identity:who,uid:'A',read:async guarded=>{await guarded.getIdToken();dispatched++;}});await tick();p.dispose();token.resolve('synthetic');await assert.rejects(p.ready);assert.equal(dispatched,0);});
test('cancelled or local-mode preparation never initializes an identity or calls the service',async()=>{for(const enabled of [false,true]){const load=createConnectionEntry({enabled,identityFactory:()=>{throw Error('must not initialize');}});assert.equal(await load.prepare({uid:'A',isCurrent:()=>false}),null);}const local=createConnectionEntry({identityFactory:()=>{throw Error('must not initialize');}});assert.equal(await local.prepare({uid:'A'}),null);});
function fixture({verify=deferred()}={}){
 const dom=new JSDOM(readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.test/',pretendToBeVisual:true}),doc=dom.window.document;dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const who=identity(),requests=[],seal=deferred();let app,sessionListener;
 const load=createConnectionEntry({enabled:true,endpoint:'https://script.google.com/macros/s/synthetic/exec',doc,identityFactory:async()=>who,fetchImpl:(url,options)=>{assert.equal(JSON.parse(options.body).action,'workspace.read');return new Promise((resolve,reject)=>{const entry={options,resolve:value=>resolve({ok:true,json:async()=>value})};requests.push(entry);options.signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true});});},pendingJournal:{read:async()=>null},services:{invoiceSealStore:{dispose(){}},installInvoiceOutput:()=>({ready:seal.promise,destroy(){}}),installInputAssist:()=>()=>{},startUpdates:()=>({dispose(){}})}});
 const session={state:{status:'signed-in',user:{uid:'A'}},subscribe(fn){sessionListener=fn;fn(this.state);return()=>{};},verifyIdentity:()=>verify.promise,dispose(){}};
 const ui=installEntrySurface({doc,initialize:async()=>session,online:()=>true,prepareApp:options=>load.prepare(options),loadApp:async options=>app=await load(options)});
 return{dom,doc,who,session,verify,requests,seal,ui,change(uid){who.set(uid);session.state={status:uid?'signed-in':'signed-out',user:uid?{uid}:null};sessionListener(session.state);},close(){app?.dispose();dom.window.close();}};
}
test('full workspace read overlaps verification but cannot render until both complete',async()=>{const h=fixture();try{await settle();assert.equal(h.requests.length,1);assert.equal(h.ui.root.hidden,true);assert.equal(h.doc.querySelector('#report-form'),null);h.requests[0].resolve(dto());await settle();assert.equal(h.doc.querySelector('#report-form'),null);h.verify.resolve({uid:'A'});await settle();assert.equal(h.requests.length,1,'initial read consumed once, no duplicate');assert.equal(h.ui.root.hidden,true);h.seal.resolve();await settle();assert.equal(h.ui.gate.started,true);assert.equal(h.ui.root.hidden,false);assert.ok(h.doc.querySelector('#report-form'));}finally{h.close();}});
test('failed verification cancels early read and late data cannot create UI',async()=>{const h=fixture();try{await settle();h.verify.reject(Error('revoked'));await settle();assert.equal(h.requests[0].options.signal.aborted,true);h.requests[0].resolve(dto());await settle();assert.equal(h.ui.root.hidden,true);assert.equal(h.ui.gate.started,false);assert.equal(h.doc.querySelector('#report-form'),null);}finally{h.close();}});
test('early service rejection cannot mount UI even if identity later succeeds',async()=>{const h=fixture();try{await settle();h.requests[0].resolve({ok:false,error:'FORBIDDEN'});await settle();assert.equal(h.doc.querySelector('#report-form'),null);h.verify.resolve({uid:'A'});await settle();assert.equal(h.ui.root.hidden,true);assert.equal(h.doc.querySelector('#report-form'),null);assert.equal(h.requests.length,1);assert.match(h.ui.entry.textContent,/APP \/ READ \/ FORBIDDEN/);}finally{h.close();}});
test('same UID logout/login cycle cannot reuse earlier prepared response',async()=>{const h=fixture();try{await settle();h.change(null);h.change('A');h.requests[0].resolve(dto());h.verify.resolve({uid:'A'});await settle();assert.equal(h.ui.root.hidden,true);assert.equal(h.doc.querySelector('#report-form'),null);}finally{h.close();}});
test('shared identity refresh gates actual transport: no request until token succeeds',async()=>{
 const user={uid:'A',email:'synthetic@example.test',emailVerified:true,providerData:[{providerId:'google.com'}]},auth={currentUser:user},reload=deferred(),token=deferred();let reloads=0,tokens=0,reads=0;
 const sdk={onAuthStateChanged(_a,fn){fn(auth.currentUser);return()=>{};},reload(){reloads++;return reload.promise;},getIdToken(){tokens++;return token.promise;}};
 const verifier=createIdentityVerifier({auth,sdk,online:()=>true}),who=createApiIdentity({auth,sdk,online:()=>true,verifier});
 const gateVerification=verifier.verify();const p=createStartupRead({identity:who,uid:'A',read:async identity=>{await identity.getIdToken();reads++;return{};}});
 await settle();assert.equal(reloads,1);assert.equal(reads,0);reload.resolve();await settle();assert.equal(tokens,1);assert.equal(reads,0);token.resolve('synthetic');await gateVerification;await p.ready;assert.equal(reads,1);p.dispose();verifier.dispose();
});
test('signed-out gate does not start workspace preparation',async()=>{let calls=0;const session={state:{status:'signed-out',user:null},subscribe(fn){fn(this.state);return()=>{};},dispose(){}};const gate=createEntryGate({initialize:async()=>session,prepareApp:()=>calls++,loadApp:()=>{throw Error('unexpected');},online:()=>true,show(){},open(){}});await gate.start();await settle();assert.equal(calls,0);});

test('read failures retain safe APP/READ diagnostics and retry starts one fresh read',async()=>{
 for(const code of ['TIMEOUT','NETWORK']){const h=fixture();try{
  await settle();h.verify.resolve({uid:'A'});h.requests[0].resolve({ok:false,error:code,detail:'PRIVATE_TOKEN_SHOULD_NOT_DISPLAY'});await settle();
  assert.match(h.ui.entry.textContent,new RegExp('APP / READ / '+code));assert.doesNotMatch(h.ui.entry.textContent,/PRIVATE_TOKEN/);assert.equal(h.ui.root.hidden,true);
  await h.ui.gate.start();await settle();assert.equal(h.requests.length,2);h.requests[1].resolve(dto());h.seal.resolve();await settle();assert.equal(h.ui.gate.started,true);assert.equal(h.ui.root.hidden,false);
 }finally{h.close();}}
});
test('hidden preparation aborts old read and requires fresh visible data before reveal',async()=>{
 const h=fixture();try{await settle();let visibility='hidden';Object.defineProperty(h.doc,'visibilityState',{get:()=>visibility,configurable:true});h.doc.dispatchEvent(new h.dom.window.Event('visibilitychange'));await settle();assert.equal(h.requests[0].options.signal.aborted,true);
  h.verify.resolve({uid:'A'});await settle();assert.equal(h.requests.length,1);assert.equal(h.ui.root.hidden,true);visibility='visible';h.doc.dispatchEvent(new h.dom.window.Event('visibilitychange'));await settle();assert.equal(h.requests.length,2);h.requests[0].resolve(dto());await settle();assert.equal(h.doc.querySelector('#report-form'),null);h.requests[1].resolve(dto());h.seal.resolve();await settle();assert.equal(h.ui.gate.started,true);assert.equal(h.ui.root.hidden,false);
 }finally{h.close();}
});
test('preparation that returns after failed gate verification is disposed immediately',async()=>{
 const verify=deferred(),prepared=deferred();let disposed=0,loaded=0;const session={state:{status:'signed-in',user:{uid:'A'}},subscribe(fn){fn(this.state);return()=>{};},verifyIdentity:()=>verify.promise,dispose(){}};
 const gate=createEntryGate({initialize:async()=>session,prepareApp:()=>prepared.promise,loadApp:()=>loaded++,online:()=>true,show(){},open(){}});await gate.start();await settle();verify.reject(Error('verification failed'));await settle();prepared.resolve({ready:Promise.resolve(),dispose(){disposed++;}});await settle();assert.equal(disposed,1);assert.equal(loaded,0);
});
test('same UID logout/login after stale read can retry through full startup',async()=>{
 const h=fixture();try{await settle();h.change(null);h.change('A');h.verify.resolve({uid:'A'});h.requests[0].resolve(dto());await settle();assert.equal(h.ui.root.hidden,true);await h.ui.gate.start();await settle();assert.equal(h.requests.length,2);h.requests[1].resolve(dto());h.seal.resolve();await settle();assert.equal(h.ui.gate.started,true);assert.equal(h.ui.root.hidden,false);}finally{h.close();}
});
