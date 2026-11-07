import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {installEntrySurface} from '../src/google-entry.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function harness({signedIn=false,verify=async()=>({uid:'synthetic'}),loadApp=async()=>{},online=()=>true}={}){
 const dom=new JSDOM('<section id="google-entry"></section><div id="google-app-root" hidden inert><button>Report</button></div>',{url:'https://example.test/'});
 let listener,signIns=0;
 const session={state:{user:signedIn?{}:null},subscribe(fn){listener=fn;fn({status:signedIn?'signed-in':'signed-out'});return()=>{};},dispose(){},verifyIdentity:verify,signIn(){signIns++;return Promise.resolve();}};
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
  const session={state:{user:{}},subscribe(fn){fn({status:'signed-in'});return()=>{};},dispose(){},verifyIdentity:async()=>({uid:'synthetic'}),signIn:async()=>{}};
  const ui=installEntrySurface({doc:dom.window.document,initialize:async()=>session,online:()=>true,loadApp:()=>{dialog.showModal();return new Promise((resolve,reject)=>{release=fails?()=>reject(Error('failed')):resolve;});}});
  await tick();assert.equal(dialog.inert,true);assert.equal(opened,0);assert.equal(ui.root.inert,true);release();await tick();assert.equal(dialog.showModal,nativeShow);
  if(fails){assert.equal(opened,0);assert.equal(dialog.open,false);assert.equal(ui.root.hidden,true);assert.equal(ui.entry.hidden,false);}else{assert.equal(opened,1);assert.equal(dialog.inert,false);assert.equal(ui.entry.hidden,true);}
  dom.window.close();
 }
});
