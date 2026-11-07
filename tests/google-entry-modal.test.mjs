import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {installEntrySurface} from '../src/google-entry.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function harness({signedIn=false,verify=async()=>({uid:'synthetic'}),loadApp=async()=>{},online=()=>true}={}){
 const dom=new JSDOM('<section id="google-entry"></section><div id="google-app-root" hidden inert><button>Report</button></div>',{url:'https://example.test/'});
 let listener,signIns=0;
 const session={state:{status:signedIn?'signed-in':'signed-out',user:signedIn?{uid:'synthetic'}:null},subscribe(fn){listener=fn;fn({status:signedIn?'signed-in':'signed-out',user:session.state.user});return()=>{};},dispose(){},verifyIdentity:verify,signIn(){signIns++;return Promise.resolve();}};
 const ui=installEntrySurface({doc:dom.window.document,initialize:async()=>session,loadApp,online});
 return {dom,ui,session,get signIns(){return signIns;},notify(status){listener({status});}};
}
test('login guidance is a modal overlay, never normal stacked document content',async()=>{
 const h=harness();await tick();assert.equal(h.ui.entry.getAttribute('role'),'dialog');assert.equal(h.ui.entry.getAttribute('aria-modal'),'true');assert.equal(h.ui.root.hidden,true);assert.equal(h.ui.root.inert,true);
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');assert.match(css,/#google-entry\{position:fixed;inset:0;/);assert.match(css,/#google-entry\[hidden\]\{display:none!important\}/);assert.ok(h.ui.entry.querySelector('.google-entry-card'));
 h.dom.window.close();
});
test('successful verification hides entry completely, original app becomes usable only after load',async()=>{
 let release;const h=harness({signedIn:true,loadApp:()=>new Promise(resolve=>{release=resolve;})});await tick();assert.equal(h.ui.root.inert,true);assert.equal(h.ui.entry.hidden,false);release();await tick();assert.equal(h.ui.entry.hidden,true);assert.equal(h.ui.root.hidden,false);assert.equal(h.ui.root.inert,false);assert.equal(h.ui.gate.started,true);h.dom.window.close();
});
test('failed identity verification never loads or exposes application',async()=>{
 let loads=0;const h=harness({signedIn:true,verify:async()=>{throw Error('failure');},loadApp:async()=>{loads++;}});await tick();assert.equal(loads,0);assert.equal(h.ui.root.hidden,true);assert.equal(h.ui.root.inert,true);assert.equal(h.ui.entry.hidden,false);assert.match(h.ui.entry.textContent,/本人確認が完了しませんでした/);h.dom.window.close();
});
test('failed app load returns to blocked modal with reload message',async()=>{
 const h=harness({signedIn:true,loadApp:async()=>{throw Error('failure');}});await tick();assert.equal(h.ui.root.hidden,true);assert.equal(h.ui.root.inert,true);assert.match(h.ui.entry.textContent,/本体の読み込みに失敗/);h.dom.window.close();
});
test('login click starts signIn in the same user event turn; Escape cannot bypass login',async()=>{
 const h=harness();await tick();[...h.ui.entry.querySelectorAll('button')].find(b=>b.textContent==='Googleでログイン').click();assert.equal(h.signIns,1);
 const event=new h.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});h.ui.entry.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(h.ui.entry.hidden,false);assert.equal(h.ui.root.inert,true);h.dom.window.close();
});
test('offline shows retry guidance without initializing or loading app',async()=>{
 const h=harness({online:()=>false});await tick();assert.match(h.ui.entry.textContent,/インターネット接続が必要/);assert.equal(h.ui.root.hidden,true);h.dom.window.close();
});
test('after identity verification login is replaced by actual preparation animation until ready',async()=>{
 let finish;const h=harness({signedIn:true,loadApp:()=>new Promise(resolve=>{finish=resolve;})});await tick();
 const slot=h.ui.entry.querySelector('.google-entry-action');assert.equal(slot.querySelector('button').hidden,true);assert.equal(slot.querySelector('.google-entry-activity').hidden,false);assert.match(slot.textContent,/画面を準備しています/);assert.equal(h.ui.entry.getAttribute('aria-busy'),'true');
 finish();await tick();assert.equal(h.ui.entry.hidden,true);assert.equal(h.ui.entry.getAttribute('aria-busy'),'false');h.dom.window.close();
});
test('native app dialogs are deferred until readiness and remain blocked if load fails',async()=>{
 for(const fails of [false,true]){
  let release,opened=0;const dom=new JSDOM('<section id="google-entry"></section><div id="google-app-root" hidden inert><dialog></dialog></div>',{url:'https://example.test/'});const dialog=dom.window.document.querySelector('dialog');dialog.inert=false;
  dialog.showModal=function(){opened++;this.open=true;};dialog.close=function(){this.open=false;};const nativeShow=dialog.showModal;
  const session={state:{status:'signed-in',user:{uid:'synthetic'}},subscribe(fn){fn({status:'signed-in',user:this.state.user});return()=>{};},dispose(){},verifyIdentity:async()=>({uid:'synthetic'}),signIn:async()=>{}};
  const ui=installEntrySurface({doc:dom.window.document,initialize:async()=>session,online:()=>true,loadApp:()=>{dialog.showModal();return new Promise((resolve,reject)=>{release=fails?()=>reject(Error('failed')):resolve;});}});
  await tick();assert.equal(dialog.inert,true);assert.equal(opened,0);assert.equal(ui.root.inert,true);release();await tick();assert.equal(dialog.showModal,nativeShow);
  if(fails){assert.equal(opened,0);assert.equal(dialog.open,false);assert.equal(ui.root.hidden,true);assert.equal(ui.entry.hidden,false);}else{assert.equal(opened,1);assert.equal(dialog.inert,false);assert.equal(ui.entry.hidden,true);}
  dom.window.close();
 }
});
test('idle startup is only centered title and login; recovery appears only on failure',async()=>{
 const h=harness();await tick();const card=h.ui.entry.querySelector('.google-entry-card');
 assert.equal(card.querySelector('h1').textContent,'RouteNote');assert.equal(card.querySelector('h2'),null);assert.equal(card.querySelector('a'),null);
 const visible=[...card.querySelectorAll('button')].filter(node=>!node.hidden);assert.deepEqual(visible.map(node=>node.textContent),['Googleでログイン']);assert.equal(card.querySelector('[role="status"]').hidden,true);assert.equal(card.querySelector('.google-entry-activity').hidden,true);
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');assert.match(css,/\.google-entry-card\{[^}]*text-align:center/);assert.match(css,/\.google-entry-action\{[^}]*align-items:center/);h.dom.window.close();
 const fail=harness({online:()=>false});await tick();assert.equal(fail.ui.entry.querySelector('[role="status"]').hidden,false);assert.ok([...fail.ui.entry.querySelectorAll('button')].some(node=>!node.hidden&&node.textContent==='もう一度確認'));fail.dom.window.close();
});
test('load-stage transient failure permits another attempt and distinguishes safe error codes',async()=>{
 let loads=0;const h=harness({signedIn:true,loadApp:async()=>{if(++loads===1)throw Object.assign(Error('private details must not display'),{code:'startup-session-changed'});}});
 await tick();assert.match(h.ui.entry.textContent,/ログイン状態または接続/);assert.doesNotMatch(h.ui.entry.textContent,/private details/);
 await h.ui.gate.start();await tick();assert.equal(loads,2);assert.equal(h.ui.gate.started,true);assert.equal(h.ui.entry.hidden,true);h.dom.window.close();
});
test('known startup seal and storage failures have distinct safe diagnoses',async()=>{
 for(const [code,label] of [['startup-seal','SEAL'],['startup-storage','STORAGE']]){
  const h=harness({signedIn:true,loadApp:async()=>{throw Object.assign(Error('private details'),{code});}});await tick();assert.ok(h.ui.entry.textContent.includes(label));assert.doesNotMatch(h.ui.entry.textContent,/private details/);assert.equal(h.ui.root.hidden,true);h.dom.window.close();
 }
});
test('session retry preserves app dialog requested during first preparation',async()=>{
 let calls=0,opened=0;const dom=new JSDOM('<section id="google-entry"></section><div id="google-app-root" hidden inert><dialog></dialog></div>',{url:'https://example.test/'});const dialog=dom.window.document.querySelector('dialog');dialog.showModal=function(){opened++;this.open=true;};dialog.close=function(){this.open=false;};
 const session={state:{status:'signed-in',user:{uid:'synthetic'}},subscribe(fn){fn(this.state);return()=>{};},dispose(){},verifyIdentity:async()=>({uid:'synthetic'}),signIn:async()=>{}};
 const ui=installEntrySurface({doc:dom.window.document,initialize:async()=>session,online:()=>true,loadApp:async()=>{if(++calls===1){dialog.showModal();throw Object.assign(Error('changed'),{code:'startup-session-changed'});}}});
 await tick();assert.equal(opened,0);await ui.gate.start();await tick();assert.equal(opened,1);assert.equal(ui.gate.started,true);dom.window.close();
});

test('only explicit workspace pending mode displays preparation guidance and retry remains usable',async()=>{
 let calls=0;const h=harness({signedIn:true,loadApp:async()=>{if(++calls===1)throw Object.assign(Error('private mode details'),{code:'WORKSPACE_NOT_ENABLED'});}});
 await tick();assert.equal(h.ui.entry.querySelector('[role="status"]').textContent,'接続を準備中です。少し待って再試行してください。');assert.equal(h.ui.root.hidden,true);assert.equal(h.ui.root.inert,true);assert.equal(h.ui.gate.started,false);
 const retry=[...h.ui.entry.querySelectorAll('button')].find(b=>b.textContent==='もう一度確認');assert.equal(retry.hidden,false);retry.click();await tick();assert.equal(calls,2);assert.equal(h.ui.gate.started,true);assert.equal(h.ui.entry.hidden,true);h.dom.window.close();
 for(const code of ['NOT_CONFIGURED','UNAUTHENTICATED','NETWORK_ERROR']){
  const other=harness({signedIn:true,loadApp:async()=>{throw Object.assign(Error('private failure details'),{code});}});await tick();assert.doesNotMatch(other.ui.entry.textContent,/接続を準備中/);assert.match(other.ui.entry.textContent,/起動確認: APP/);assert.doesNotMatch(other.ui.entry.textContent,/private failure details/);assert.equal(other.ui.root.hidden,true);other.dom.window.close();
 }
});
