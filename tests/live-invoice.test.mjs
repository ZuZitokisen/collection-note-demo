import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {addLiveDecimals,liveInvoiceView,validateLiveBilling,installLiveInvoiceOutput} from '../src/live-invoice.js';
import {buildInvoiceDocument,invoicePageSVG} from '../src/invoice-document.js';
const customer={key:'合成テスト',name:'合成テスト',baseFee:'500',disposalRate:'12.5',combustibleKg:'2',noncombustibleKg:'1',combustibleAmount:'25',noncombustibleAmount:'12.5',otherFee:'10',monthlySubtotal:'547.5',submissionTotal:'547',reportCount:1,missingInputs:[]};
const summary=()=>({schemaVersion:1,timezone:'Asia/Tokyo',month:'2024-02',customers:[{...customer}],total:'547.5',taxFraction:'0',warnings:[],snapshotId:'snapshot',verifiedAt:'2024-03-01T00:00:00Z',projectionCurrent:true});
const dto=()=>({schemaVersion:1,projectionCurrent:true,kind:'invoice',month:'2024-02',customer:{...customer},daily:[{date:'2024-02-29',combustibleKg:'2',noncombustibleKg:'1',otherFee:'10',otherItems:'合成品',reportCount:1,missingInputs:[]}],recipient:{postalCode:'0000000',address:'合成宛先'},issuer:{legalName:'合成発行者',address:'合成住所'},snapshotId:'snapshot',verifiedAt:'2024-03-01T00:00:00Z',timezone:'Asia/Tokyo',taxFraction:'0',warnings:[],finalized:false});
const expected={month:'2024-02',customerKey:customer.key,kind:'invoice',snapshotId:'snapshot'};
test('exact decimal weights and authoritative sheet totals/base fee, no local identities',()=>{
 assert.equal(addLiveDecimals('9007199254740993.99','0.01'),'9007199254740994');
 const view=liveInvoiceView(dto(),expected);assert.equal(view.daily.length,29);assert.equal(view.daily[28].weight.value,'3');assert.equal(view.daily[0].weight.value,null);
 const document=buildInvoiceDocument(view),svg=invoicePageSVG(document,0);
 assert.equal(document.geometry.pageWidth,182);assert.match(svg,/基本料金/);assert.match(svg,/500/);assert.doesNotMatch(svg,/547 円/);assert.match(svg,/547.5 円/);assert.match(svg,/実シート・確認用/);assert.doesNotMatch(svg,/架空データ/);assert.doesNotMatch(svg,/合成発行者/);assert.deepEqual(view.bankAccounts,[]);assert.equal(view.issuer.registrationNumber,undefined);
});
test('no records customer retains fixed fee and empty calendar',()=>{const value=dto();value.daily=[];value.customer={...customer,reportCount:0,combustibleKg:'0',noncombustibleKg:'0',combustibleAmount:'0',noncombustibleAmount:'0',otherFee:'0',monthlySubtotal:'500',submissionTotal:'500'};const view=liveInvoiceView(value,expected);assert.equal(view.liveBilling.submissionTotal,'500');assert.ok(view.daily.every(day=>day.weight.value===null));});
test('fails closed on tax, missing identity, stale snapshots and invalid date',()=>{
 for(const patch of [{taxFraction:'0.1'},{recipient:null},{snapshotId:'stale'},{customer:{...customer,key:'other'}},{daily:[{...dto().daily[0],date:'2024-02-30'}]}])assert.throws(()=>liveInvoiceView({...dto(),...patch},expected));
 assert.throws(()=>validateLiveBilling({...summary(),projectionCurrent:false},'2024-02'));
 const view=liveInvoiceView({...dto(),taxFraction:'0.1',kind:'monthly-detail'},{...expected,kind:'monthly-detail'});assert.equal(view.documentType,'monthly-detail');
});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function harness(overrides={}){
 const dom=new JSDOM('<div id="host"></div>',{url:'https://example.test/',pretendToBeVisual:true});const host=dom.window.document.querySelector('#host');let epoch=0,subscriber;const calls=[];
 const session={capture:()=>({epoch}),isCurrent:t=>t.epoch===epoch,subscribe:fn=>(subscriber=fn,()=>{})};
 const api={assertReady:async()=>{},readBilling:async()=>summary(),readBillingDocument:async args=>{calls.push(args);return dto();},...overrides.api};
 const control=installLiveInvoiceOutput({host,api,session,loadSeal:async()=>null,makePDF:async()=>new dom.window.Blob(['synthetic']),...overrides.options});
 let clicks=0;dom.window.HTMLAnchorElement.prototype.click=function(){clicks++;};dom.window.URL.createObjectURL=()=> 'blob:test';dom.window.URL.revokeObjectURL=()=>{};
 await control.refresh('2024-02');host.querySelector('[data-kind]').value='invoice';
 return {dom,host,control,calls,get clicks(){return clicks;},invalidateAuth(){epoch++;subscriber();}};
}
test('PDF requires confirmation and revalidates membership/snapshot after rendering',async()=>{const h=await harness();h.host.querySelector('[data-pdf]').click();await tick();assert.equal(h.clicks,0);h.host.querySelector('[data-confirm]').checked=true;h.host.querySelector('[data-pdf]').click();await tick();await tick();assert.equal(h.clicks,1);assert.equal(h.calls.length,2);assert.ok(h.calls.every(x=>x.expectedSnapshotId==='snapshot'));h.control.destroy();});
test('auth/navigation during asynchronous PDF prevents byte exposure',async()=>{for(const mode of ['auth','hide','pagehide']){let release;const h=await harness({options:{makePDF:()=>new Promise(resolve=>release=resolve)}});h.host.querySelector('[data-confirm]').checked=true;h.host.querySelector('[data-pdf]').click();await tick();assert.ok(release);if(mode==='auth')h.invalidateAuth();else if(mode==='hide')h.control.hide();else h.dom.window.dispatchEvent(new h.dom.window.Event('pagehide'));release(new h.dom.window.Blob(['x']));await tick();assert.equal(h.clicks,0);assert.equal(h.host.querySelector('[data-preview-host]').childElementCount,0);h.control.destroy();}});
test('stale final snapshot aborts export; browser print invalidates preview',async()=>{let n=0;const h=await harness({api:{readBillingDocument:async()=>({...dto(),snapshotId:++n===1?'snapshot':'changed'})}});h.host.querySelector('[data-confirm]').checked=true;h.host.querySelector('[data-pdf]').click();await tick();await tick();assert.equal(h.clicks,0);assert.match(h.host.querySelector('[data-status]').textContent,/再読込/);h.control.destroy();const p=await harness();p.host.querySelector('[data-confirm]').checked=true;p.host.querySelector('[data-preview]').click();await tick();assert.ok(p.host.querySelector('svg'));p.dom.window.dispatchEvent(new p.dom.window.Event('beforeprint'));assert.equal(p.host.querySelector('svg'),null);p.control.destroy();});

test('corrupted totals, decimals, missing snapshot and daily divergence are rejected',()=>{
 assert.throws(()=>validateLiveBilling({...summary(),snapshotId:''},'2024-02'));
 assert.throws(()=>validateLiveBilling({...summary(),total:'999'},'2024-02'));
 assert.throws(()=>validateLiveBilling({...summary(),customers:[{...customer,baseFee:'1e3'}]},'2024-02'));
 assert.throws(()=>liveInvoiceView({...dto(),customer:{...customer,monthlySubtotal:'999'}},expected));
 assert.throws(()=>liveInvoiceView({...dto(),daily:[{...dto().daily[0],combustibleKg:'99'}]},expected));
 assert.throws(()=>liveInvoiceView({...dto(),daily:[]},expected));
 const unknown={...customer,baseFee:null,monthlySubtotal:null,submissionTotal:null};
 assert.doesNotThrow(()=>validateLiveBilling({...summary(),customers:[unknown],total:null},'2024-02'));
 assert.throws(()=>liveInvoiceView({...dto(),customer:unknown},expected));
});

test('billing DTO metadata fails closed for unknown versions, zones, projection and document kinds',()=>{
 for(const patch of [{schemaVersion:undefined},{schemaVersion:'1'},{schemaVersion:2},{timezone:undefined},{timezone:'UTC'},{projectionCurrent:undefined},{projectionCurrent:false}]) {
  assert.throws(()=>validateLiveBilling({...summary(),...patch},'2024-02'));
  assert.throws(()=>liveInvoiceView({...dto(),...patch},expected));
 }
 for(const kind of [undefined,'monthly-detail','unexpected']) assert.throws(()=>liveInvoiceView({...dto(),kind},expected));
 assert.doesNotThrow(()=>liveInvoiceView({...dto(),kind:'monthly-detail'},{...expected,kind:'monthly-detail'}));
});

test('issuer and bank entries start empty, never use backend/local defaults, require preview consent',async()=>{
 const h=await harness();h.dom.window.localStorage.setItem('invoice-settings',JSON.stringify({legalName:'旧ローカル会社'}));
 assert.ok([...h.host.querySelectorAll('[data-entry]')].every(input=>input.value===''));
 h.host.querySelector('[data-preview]').click();await tick();assert.equal(h.calls.length,0);assert.equal(h.host.querySelector('svg'),null);
 const values={legalName:'今回の会社',address:'今回の住所',phone:'000-0000',registrationNumber:'TEST-REG',invoiceNumber:'TEST-NO',bankInstructions:'合成銀行 合成支店\n普通 0000000\n合成名義'};
 for(const [key,value] of Object.entries(values))h.host.querySelector(`[data-entry="${key}"]`).value=value;
 h.host.querySelector('[data-confirm]').checked=true;h.host.querySelector('[data-preview]').click();await tick();
 const svg=h.host.querySelector('svg').textContent;assert.match(svg,/今回の会社/);assert.match(svg,/今回の住所/);assert.match(svg,/TEST-REG/);assert.match(svg,/TEST-NO/);assert.match(svg,/合成銀行/);assert.match(svg,/合成宛先/);assert.doesNotMatch(svg,/旧ローカル会社|合成発行者/);
 assert.ok(h.calls.every(call=>!JSON.stringify(call).includes('合成銀行')));
 assert.equal(h.dom.window.localStorage.length,1);
 h.host.querySelector('[data-entry="legalName"]').dispatchEvent(new h.dom.window.Event('input'));assert.equal(h.host.querySelector('svg'),null);assert.equal(h.host.querySelector('[data-confirm]').checked,false);
 h.invalidateAuth();assert.ok([...h.host.querySelectorAll('[data-entry]')].every(input=>input.value===''));h.control.destroy();
});
test('changing entered information during PDF creation cancels export and navigation erases fields',async()=>{
 let release;const h=await harness({options:{makePDF:()=>new Promise(resolve=>release=resolve)}});
 h.host.querySelector('[data-entry="legalName"]').value='合成会社';h.host.querySelector('[data-confirm]').checked=true;h.host.querySelector('[data-pdf]').click();await tick();
 h.host.querySelector('[data-entry="legalName"]').value='変更会社';h.host.querySelector('[data-entry="legalName"]').dispatchEvent(new h.dom.window.Event('input'));release(new h.dom.window.Blob(['x']));await tick();assert.equal(h.clicks,0);
 h.control.hide();assert.equal(h.host.querySelector('[data-entry="legalName"]').value,'');h.control.destroy();
});

test('B5 issuer address has bounded lines and native printing hides raw entry controls',async()=>{
 const h=await harness();const address=h.host.querySelector('[data-entry="address"]');
 for(const value of ['一\n二\n三\n四','字'.repeat(81)]) {address.value=value;h.host.querySelector('[data-confirm]').checked=true;h.host.querySelector('[data-preview]').click();await tick();assert.equal(h.calls.length,0);assert.match(h.host.querySelector('[data-status]').textContent,/3行/);}
 address.value='一\n二\n三';h.host.querySelector('[data-confirm]').checked=true;h.host.querySelector('[data-preview]').click();await tick();assert.ok(h.host.querySelector('svg'));
 const printCSS=readFileSync(new URL('../invoice.css',import.meta.url),'utf8');assert.match(printCSS,/@media print\{\[data-issuer-inputs\]\{display:none!important\}/);
 h.dom.window.dispatchEvent(new h.dom.window.Event('beforeprint'));assert.equal(h.host.querySelector('svg'),null);h.control.destroy();
});

test('kind and issuer edits during pending summary load do not abort or strand refresh',async()=>{
 let reads=0,release,signal;const h=await harness({api:{readBilling:async args=>{if(++reads===1)return summary();signal=args.signal;return new Promise(resolve=>release=resolve);}}});
 const loading=h.control.refresh('2024-02');await tick();assert.ok(release);assert.equal(h.host.querySelector('[data-customer]').options.length,0);
 const kind=h.host.querySelector('[data-kind]');kind.value='monthly-detail';kind.dispatchEvent(new h.dom.window.Event('change'));
 const name=h.host.querySelector('[data-entry="legalName"]');name.value='今回の会社';name.dispatchEvent(new h.dom.window.Event('input'));
 assert.equal(signal.aborted,false);release(summary());await loading;
 assert.equal(h.host.querySelector('[data-customer]').options.length,1);assert.match(h.host.querySelector('[data-status]').textContent,/最新集計を確認しました/);assert.equal(kind.value,'monthly-detail');assert.equal(name.value,'今回の会社');h.control.destroy();
});

test('live form uses scoped responsive fields and existing button styles',async()=>{
 const h=await harness();assert.ok(h.host.hasAttribute('data-live-invoice-ui'));assert.ok(h.host.querySelector('[data-entry="address"]').parentElement.classList.contains('live-wide'));assert.ok(h.host.querySelector('[data-entry="phone"]').parentElement.classList.contains('field'));assert.ok(h.host.querySelector('[data-confirm]').parentElement.classList.contains('invoice-optional'));assert.ok([...h.host.querySelectorAll('button')].every(button=>button.classList.contains('button')));const css=readFileSync(new URL('../invoice.css',import.meta.url),'utf8');assert.match(css,/@media\(max-width:600px\)/);assert.match(css,/grid-column:1\/-1/);h.control.destroy();
});
