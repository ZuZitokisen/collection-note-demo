import test from 'node:test';
import {createLockManager} from './lock-manager.mjs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installSheetConnection} from '../src/sheet-connection.js';
const tick=()=>new Promise(r=>setTimeout(r,0));
test('connection retains separate demo surface; identity change clears cloud data/modal',async()=>{
 const dom=new JSDOM('<button data-browse-source="local"></button><button data-browse-source="sheet"></button><div id="browse-local">local demo</div><div id="sheet-ledger-panel"></div>',{pretendToBeVisual:true,url:'https://example.test/'});
 const doc=dom.window.document;Object.defineProperty(dom.window.navigator,'locks',{value:createLockManager()});dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let uid='a',listener;const connection={currentUid:()=>uid,subscribe:cb=>{listener=cb;return()=>{};},readPage:async()=>({records:[],customerNames:['Example'],blocked:false,projectionCurrent:true,publicationPending:false}),change:async()=>{throw Error('must not write');}};
 const c=installSheetConnection({doc,loadConnection:async()=>connection});c.setPage('browse','sheet');await tick();assert.equal(c.getState().status,'ready');doc.querySelector('[data-action="create"]').click();assert.equal(doc.querySelector('dialog').open,true);uid='b';listener(uid);assert.equal(c.getState().authorized,false);assert.equal(doc.querySelector('dialog').open,false);assert.equal(doc.querySelector('#browse-local').textContent,'local demo');
 c.setPage('browse','local');assert.equal(doc.querySelector('#browse-local').hidden,false);assert.equal(doc.querySelector('#sheet-ledger-panel').hidden,true);c.dispose();dom.window.close();
});
