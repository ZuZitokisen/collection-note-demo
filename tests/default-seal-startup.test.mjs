import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadDefaultInvoiceSeal,validateCanonicalSeal} from '../src/invoice-seal.js';
const bytes=readFileSync(new URL('../icons/invoice-seal-lowres.png',import.meta.url));
const doc={defaultView:{location:new URL('https://example.test/collection-note-demo/')} ,createElement(){throw Error('Canvas must not be needed for the bundled normalized image');}};
const response=(body=bytes,options={})=>({ok:true,type:'basic',redirected:false,url:'https://example.test/collection-note-demo/icons/invoice-seal-lowres.png',blob:async()=>new Blob([body],{type:'image/png'}),...options});
test('bundled default seal loads exact normalized pixels without browser canvas re-encoding',async()=>{
 let request;const seal=await loadDefaultInvoiceSeal(doc,async(url,options)=>{request={url,options};return response();});
 assert.equal(seal.width,160);assert.equal(seal.height,160);
 assert.equal(seal.dataURL,'data:image/png;base64,'+bytes.toString('base64'));
 assert.deepEqual(validateCanonicalSeal(seal),seal);
 assert.equal(request.options.redirect,'error');assert.equal(request.options.mode,'same-origin');
});
test('default seal still rejects corrupt or redirected image and wrong MIME without writes',async()=>{
 const corrupt=Buffer.from(bytes);corrupt[50]^=1;
 for(const r of [response(corrupt),response(bytes,{redirected:true}),response(bytes,{url:'https://other.test/seal.png'}),response(bytes,{blob:async()=>new Blob([bytes],{type:'text/html'})})]){
  await assert.rejects(loadDefaultInvoiceSeal(doc,async()=>r));
 }
});
