import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installInvoiceOutput} from '../src/invoice.js';
import {createSampleState} from '../src/domain.js';
import {emptyInvoiceSettings} from '../src/invoice-settings.js';
const seal={dataURL:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',width:1,height:1};
function fixture(options){const dom=new JSDOM('<section id="output-section"></section>',{url:'https://example.test/'});return {dom,output:installInvoiceOutput({doc:dom.window.document,getState:createSampleState,getInvoiceSettings:emptyInvoiceSettings,...options})};}
test('invoice ready waits for default artwork and rejects failed or uncertain private artwork',async()=>{
 let resolve;const h=fixture({loadDefaultSeal:()=>new Promise(r=>{resolve=r;})});let ready=false;h.output.ready.then(()=>ready=true);await new Promise(r=>setTimeout(r,0));assert.equal(ready,false);resolve(seal);await h.output.ready;assert.equal(ready,true);h.output.destroy();h.dom.window.close();
 for(const options of [{loadDefaultSeal:async()=>{throw Error('fetch failed');}},{sealStore:{load:async()=>{throw Error('private store failed');}},loadDefaultSeal:async()=>seal}]){const f=fixture(options);await assert.rejects(f.output.ready);f.output.destroy();f.dom.window.close();}
});
