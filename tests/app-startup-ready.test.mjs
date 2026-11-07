import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('actual original app readiness waits for storage lock and first report render',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const script=`import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
 const root=process.argv[1];const dom=new JSDOM(readFileSync(root+'index.html','utf8'),{url:'https://example.test/',pretendToBeVisual:true});
 for(const k of ['window','document','location','localStorage','sessionStorage','HTMLElement'])globalThis[k]=dom.window[k];Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let finishSeal;
 const seal={dataURL:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',width:1,height:1};
 Object.defineProperty(dom.window,'indexedDB',{value:{open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){const operation={result:seal},tx={objectStore:()=>({get:()=>operation})};finishSeal=()=>{operation.onsuccess();tx.oncomplete();};return tx;}};request.onsuccess();});return request;}}});
 let locked,unlock;Object.defineProperty(navigator,'locks',{value:{request:(_name,fn)=>{locked=fn;return new Promise(resolve=>{unlock=resolve;});}}});
 const app=await import(pathToFileURL(root+'src/app.js'));let ready=false;app.appReady.then(()=>{ready=true;});await new Promise(r=>setTimeout(r,0));if(ready)throw Error('Ready before lock released');if(document.querySelector('#report-form'))throw Error('Rendered before initialize');locked();unlock();await new Promise(r=>setTimeout(r,0));if(ready)throw Error('Ready before seal loaded');if(!finishSeal)throw Error('Seal was not requested');finishSeal();await app.appReady;if(!document.querySelector('#report-form'))throw Error('Missing report after ready');dom.window.close();process.exit(0);`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script,root],{cwd:root,encoding:'utf8',timeout:15000});assert.equal(child.status,0,child.stderr||child.error?.message);
});
