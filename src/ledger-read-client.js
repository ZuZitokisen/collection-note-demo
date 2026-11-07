// Browser-only read adapter. No writes, member administration, storage or Firebase dependency.
export class LedgerReadError extends Error {constructor(code){super(code);this.code=code;}}
const fail=code=>{throw new LedgerReadError(code);};
export function normalizeLedgerResponse(value){
 if(!value||value.ok!==true||value.readOnly!==true||value.writeSupported!==false||!Array.isArray(value.records)||!Array.isArray(value.issues)||value.records.length>9999||value.issues.length>9999)fail('INVALID_RESPONSE');
 const used=new Set();
 const row=n=>{if(!Number.isInteger(n)||n<2||n>10000||used.has(n))fail('INVALID_RESPONSE');used.add(n);return n;};
 const str=(s,max)=>{if(typeof s!=='string'||s.length>max)fail('INVALID_RESPONSE');return s;};
 const number=n=>{if(n===null)return null;if(typeof n!=='number'||!Number.isFinite(n)||n<0)fail('INVALID_RESPONSE');return n;};
 const records=value.records.map(r=>{if(!r||r.readOnly!==true)fail('INVALID_RESPONSE');const date=str(r.date,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)fail('INVALID_RESPONSE');const customerName=str(r.customerName,1000);if(!customerName.trim())fail('INVALID_RESPONSE');return Object.freeze({sourceRow:row(r.sourceRow),date,customerName,combustibleKg:number(r.combustibleKg),noncombustibleKg:number(r.noncombustibleKg),otherItem:str(r.otherItem,10000),otherFee:number(r.otherFee),readOnly:true});});
 const issues=value.issues.map(x=>{if(!x||x.error!=='INVALID_SOURCE_ROW')fail('INVALID_RESPONSE');return Object.freeze({sourceRow:row(x.sourceRow),error:x.error});});
 return Object.freeze({ok:true,records:Object.freeze(records),issues:Object.freeze(issues),readOnly:true,writeSupported:false});
}
export function createLedgerReader({endpoint,getIdToken,fetchImpl=fetch,timeoutMs=30000}){
 const url=new URL(endpoint);if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)||url.search||url.hash||typeof getIdToken!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Invalid reader configuration');
 return async function readPage({signal}={}){
  if(signal?.aborted)fail('ABORTED');
  let idToken;try{idToken=await getIdToken(true);}catch{fail('LOGIN_REQUIRED');}if(typeof idToken!=='string'||!idToken)fail('LOGIN_REQUIRED');if(signal?.aborted)fail('ABORTED');
  const controller=new AbortController();let timedOut=false;const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  try{
   const response=await fetchImpl(url.href,{method:'POST',mode:'cors',credentials:'omit',redirect:'follow',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action:'ledger.read',idToken})});
   if(!response.ok||response.type==='opaque')fail('TRANSPORT_FAILED');
   const value=await response.json();if(signal?.aborted)fail('ABORTED');if(timedOut)fail('TIMEOUT');
   if(value?.ok===false){const safe=['UNAUTHENTICATED','FORBIDDEN','AUTH_UNAVAILABLE','SOURCE_CHANGED','SOURCE_LIMIT','ROSTER_NOT_CONFIGURED','ROSTER_INVALID','NOT_CONFIGURED','BUSY'];fail(safe.includes(value.error)?value.error:'SERVER_UNAVAILABLE');}
   return normalizeLedgerResponse(value);
  }catch(error){if(signal?.aborted)fail('ABORTED');if(timedOut)fail('TIMEOUT');if(error instanceof LedgerReadError)throw error;fail('TRANSPORT_FAILED');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 };
}
