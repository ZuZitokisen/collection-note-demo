import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';import {installOperatorPage,validateOperatorResult} from '../src/operator-page.js';import {createWorkspaceOperatorClient} from '../src/operator-client.js';
const ID='12345678-1234-4123-8123-123456789abc',ENDPOINT='https://script.google.com/macros/s/reviewed/exec';
async function setup(client){const dom=new JSDOM(readFileSync(new URL('../operator.html',import.meta.url),'utf8'));const session={subscribe(fn){fn({status:'signed-in',user:{uid:'synthetic'}});},signIn:async()=>{}};const app=await installOperatorPage({doc:dom.window.document,initialize:async()=>session,identityFactory:async()=>({}),clientFactory:()=>client});return {dom,app};}
test('operator never runs API automatically; requires successful preflight and explicit operation UUID',async()=>{const calls=[];const h=await setup({bootstrapPreflight:async()=>{calls.push('read');return {ok:true,readOnly:true,sourceFingerprint:'a'.repeat(64),configurationHash:'b'.repeat(64),targetEmpty:true,changesApplied:false,secret:'not for display'};},bootstrap:async id=>{calls.push(id);return {ok:true,initialized:true,activated:false,replayed:false,operationId:id,resultHash:'c'.repeat(64),bank:'private'};}});assert.deepEqual(calls,[]);await h.app.execute('bootstrap',ID);assert.deepEqual(calls,[]);await h.app.execute('bootstrapPreflight');await h.app.execute('bootstrap',ID);assert.deepEqual(calls,['read',ID]);assert.doesNotMatch(h.dom.window.document.body.textContent,/not for display|private/);await h.app.execute('bootstrap',ID);assert.equal(calls.length,2);await h.app.execute('arbitrary',ID);assert.equal(calls.length,2);h.dom.window.close();});
test('ambiguous write stops all calls including repeated clicks; forbidden read never enables writes',async()=>{for(const forbidden of [false,true]){let writes=0,reads=0;const h=await setup({bootstrapPreflight:async()=>{reads++;if(forbidden)throw Object.assign(Error(),{code:'FORBIDDEN',definitiveRejection:true});return {ok:true,readOnly:true,sourceFingerprint:'a'.repeat(64),configurationHash:'b'.repeat(64),targetEmpty:true,changesApplied:false};},bootstrap:async()=>{writes++;throw Object.assign(Error(),{code:'TIMEOUT',unknown:true,definitiveRejection:false});}});await h.app.execute('bootstrapPreflight');await h.app.execute('bootstrap',ID);assert.equal(h.app.stopped,true);await h.app.execute('bootstrap',ID);await h.app.execute('bootstrapPreflight');assert.equal(reads,1);assert.equal(writes,forbidden?0:1);h.dom.window.close();}});
test('fixed operator transport sends only reviewed action, token and UUID; response loss remains uncertain',async()=>{const identity={currentUid:()=> 'u',subscribe:()=>()=>{},getIdToken:async()=> 'memory-token'},bodies=[];const client=createWorkspaceOperatorClient({identity,endpoint:ENDPOINT,fetchImpl:async(_url,options)=>{bodies.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,initialized:true})};}});assert.deepEqual(Object.keys(client),['bootstrapPreflight','pricingPreflight','bootstrap','preparePricing','finishPricingRecovery','activate']);await client.bootstrapPreflight();await client.bootstrap(ID);assert.deepEqual(bodies,[{action:'workspace.bootstrapPreflight',idToken:'memory-token'},{action:'workspace.bootstrap',idToken:'memory-token',operationId:ID}]);const uncertain=createWorkspaceOperatorClient({identity,endpoint:ENDPOINT,fetchImpl:async()=>{throw Error('lost');}});await assert.rejects(uncertain.activate(ID),error=>error.unknown===true&&error.definitiveRejection===false);});
test('server admin rejection is honored without exposing messages or executing changes',async()=>{const identity={currentUid:()=> 'u',subscribe:()=>()=>{},getIdToken:async()=> 'token'};const client=createWorkspaceOperatorClient({identity,endpoint:ENDPOINT,fetchImpl:async()=>({ok:true,json:async()=>({ok:false,error:'FORBIDDEN'})})});await assert.rejects(client.bootstrapPreflight(),error=>error.code==='FORBIDDEN');});

test('action-specific operator contracts reject missing, contradictory and foreign-operation successes',()=>{const hash='a'.repeat(64),valid={bootstrapPreflight:{ok:true,readOnly:true,changesApplied:false,sourceFingerprint:hash,configurationHash:hash,targetEmpty:true},pricingPreflight:{ok:true,changesApplied:false,sourceContextHash:hash,formulaHash:hash,formulaCellCount:3,projectionColumns:12},bootstrap:{ok:true,initialized:true,activated:false,operationId:ID,resultHash:hash,replayed:false},preparePricing:{ok:true,installed:true,rolledBack:false,sourceFreshRequired:false,mayMarkReady:false},activate:{ok:true,activated:true,replayed:false,revision:0}};for(const [action,response] of Object.entries(valid)){assert.equal(validateOperatorResult(action,response,ID),response);assert.throws(()=>validateOperatorResult(action,{ok:true},ID));for(const key of Object.keys(response)){const missing={...response};delete missing[key];assert.throws(()=>validateOperatorResult(action,missing,ID),action+':'+key);}}assert.throws(()=>validateOperatorResult('bootstrap',{...valid.bootstrap,operationId:'ffffffff-ffff-4fff-8fff-ffffffffffff'},ID));assert.throws(()=>validateOperatorResult('bootstrapPreflight',{...valid.bootstrapPreflight,targetEmpty:false,documentHash:hash,revision:1,storedSourceFingerprint:hash,sourceCurrent:false},ID));assert.throws(()=>validateOperatorResult('preparePricing',{...valid.preparePricing,mayMarkReady:true},ID));});
test('malformed preflight never enables writes; malformed mutation freezes further operations',async()=>{for(const malformedRead of [false,true]){let writes=0;const h=await setup({bootstrapPreflight:async()=>malformedRead?{ok:true}:{ok:true,readOnly:true,sourceFingerprint:'a'.repeat(64),configurationHash:'b'.repeat(64),targetEmpty:true,changesApplied:false},bootstrap:async()=>{writes++;return {ok:true};}});await h.app.execute('bootstrapPreflight');await h.app.execute('bootstrap',ID);assert.equal(writes,malformedRead?0:1);assert.equal(h.app.stopped,!malformedRead);await h.app.execute('bootstrap',ID);assert.equal(writes,malformedRead?0:1);h.dom.window.close();}});

const finishResult=()=>({ok:true,installed:true,rolledBack:false,sourceFreshRequired:false,mayMarkReady:false});
const preflightResult=()=>({ok:true,readOnly:true,sourceFingerprint:'a'.repeat(64),configurationHash:'b'.repeat(64),targetEmpty:false,documentHash:'c'.repeat(64),storedSourceFingerprint:'a'.repeat(64),revision:0,sourceCurrent:true,changesApplied:false});
test('finish-only success has exact keys and false safety flags; expanded flags never pass',()=>{
 const valid=finishResult();assert.equal(validateOperatorResult('finishPricingRecovery',valid,ID),valid);
 const replay={...valid,replayed:true};assert.equal(validateOperatorResult('finishPricingRecovery',replay,ID),replay);
 for(const key of Object.keys(valid)){const missing={...valid};delete missing[key];assert.throws(()=>validateOperatorResult('finishPricingRecovery',missing,ID));}
 for(const change of [{sourceFreshRequired:true},{mayMarkReady:true},{rolledBack:true},{installed:false},{replayed:false},{secret:'private'},{operationId:ID},{error:'bad'},{unknown:true},{ok:'true'}])assert.throws(()=>validateOperatorResult('finishPricingRecovery',{...valid,...change},ID));
});
test('finish-only transport sends only its fixed action, token and UUID; only this action waits 90 seconds',async t=>{
 const delays=[];t.mock.method(globalThis,'setTimeout',(_fn,ms)=>{delays.push(ms);return 0;});t.mock.method(globalThis,'clearTimeout',()=>{});
 const identity={currentUid:()=> 'u',subscribe:()=>()=>{},getIdToken:async()=> 'memory-token'},bodies=[];
 const client=createWorkspaceOperatorClient({identity,endpoint:ENDPOINT,fetchImpl:async(_url,options)=>{bodies.push(JSON.parse(options.body));return {ok:true,json:async()=>finishResult()};}});
 await client.finishPricingRecovery(ID);await client.preparePricing(ID);
 assert.deepEqual(delays,[90000,30000]);assert.deepEqual(bodies,[{action:'workspace.finishPricingRecovery',idToken:'memory-token',operationId:ID},{action:'workspace.preparePricing',idToken:'memory-token',operationId:ID}]);
});
test('finish-only response loss or property-write error is unknown and never retried or sent via preparePricing',async()=>{
 for(const response of [null,{ok:false,checkRequired:true,retryAllowed:false,phase:'proof-written',code:'FINISH_PROOF_UNCONFIRMED'}]){
  let calls=0;const identity={currentUid:()=> 'u',subscribe:()=>()=>{},getIdToken:async()=> 'memory-token'};
  const client=createWorkspaceOperatorClient({identity,endpoint:ENDPOINT,fetchImpl:async(_url,options)=>{calls++;assert.equal(JSON.parse(options.body).action,'workspace.finishPricingRecovery');if(response===null)throw Error('lost');return {ok:true,json:async()=>response};}});
  await assert.rejects(client.finishPricingRecovery(ID),error=>error.unknown===true&&error.definitiveRejection===false);assert.equal(calls,1);
 }
});
test('finish-only requires preflight, valid UUID and explicit checkbox; busy and repeated submission send once',async()=>{
 let calls=0,finish;const h=await setup({bootstrapPreflight:async()=>preflightResult(),finishPricingRecovery:async id=>{assert.equal(id,ID);calls++;return new Promise(resolve=>{finish=resolve;});}});
 const form=h.dom.window.document.querySelector('form');form.elements.action.value='finishPricingRecovery';form.elements.operationId.value=ID;
 form.dispatchEvent(new h.dom.window.Event('submit',{cancelable:true}));assert.equal(calls,0);
 await h.app.execute('finishPricingRecovery',ID);assert.equal(calls,0);await h.app.execute('bootstrapPreflight');
 await h.app.execute('finishPricingRecovery','not-a-uuid');assert.equal(calls,0);
 form.elements.confirmed.checked=true;form.dispatchEvent(new h.dom.window.Event('submit',{cancelable:true}));assert.equal(calls,1);
 form.dispatchEvent(new h.dom.window.Event('submit',{cancelable:true}));assert.equal(calls,1);
 finish(finishResult());await new Promise(resolve=>setImmediate(resolve));assert.equal(form.elements.confirmed.checked,false);
 assert.match(h.dom.window.document.querySelector('#operator-status').textContent,/接続有効化は行っていません/);
 form.elements.confirmed.checked=true;form.dispatchEvent(new h.dom.window.Event('submit',{cancelable:true}));assert.equal(calls,1);h.dom.window.close();
});
test('finish-only unknown or malformed success freezes page and never exposes secret values',async()=>{
 for(const response of [null,{...finishResult(),bank:'private-bank',idToken:'private-token'}]){
  let calls=0;const h=await setup({bootstrapPreflight:async()=>preflightResult(),finishPricingRecovery:async()=>{calls++;if(response===null)throw Object.assign(Error('private-error'),{unknown:true,definitiveRejection:false});return response;}});
  await h.app.execute('bootstrapPreflight');await h.app.execute('finishPricingRecovery',ID);assert.equal(h.app.stopped,true);
  await h.app.execute('finishPricingRecovery',ID);await h.app.execute('preparePricing',ID);assert.equal(calls,1);
  assert.doesNotMatch(h.dom.window.document.body.textContent,/private-bank|private-token|private-error/);h.dom.window.close();
 }
});
test('only operator HTML and client import are cache-versioned; ordinary app and service worker remain untouched',()=>{
 const html=readFileSync(new URL('../operator.html',import.meta.url),'utf8'),page=readFileSync(new URL('../src/operator-page.js',import.meta.url),'utf8');
 assert.match(html,/src="\.\/src\/operator-page\.js\?maintenance=finish-only-1"/);
 assert.match(page,/from '\.\/operator-client\.js\?maintenance=finish-only-1'/);
 assert.match(html,/完了記録のみ確定（数式変更なし）/);
 for(const path of ['../index.html','../sw.js','../src/app-entry.js'])assert.doesNotMatch(readFileSync(new URL(path,import.meta.url),'utf8'),/maintenance=finish-only-1/);
});
