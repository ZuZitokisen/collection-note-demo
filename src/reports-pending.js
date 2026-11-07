import {makeChange} from './reports-client.js';

export const PENDING_PREFIX = 'routenote.reports.pending.v1.';
const fail = () => { throw new Error('PENDING_STORAGE_UNAVAILABLE'); };
const keys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === allowed.length && allowed.every(k => Object.hasOwn(value,k));
function validate(input) {
  const action=input?.action;
  const allowed=['operationId','action',...(action==='create'?[]:['recordId','expectedRevision','expectedFingerprint']),...(['create','update'].includes(action)?['fields']:[])];
  if(!keys(input,allowed))fail();
  if(action!=='create' && (!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1||typeof input.expectedFingerprint!=='string'||!input.expectedFingerprint||input.expectedFingerprint.length>256))fail();
  if(['create','update'].includes(action)&&!keys(input.fields,['date','customerName','combustibleKg','noncombustibleKg','otherItem','otherFee']))fail();
  const copy=makeChange(action,action==='create'?null:{id:input.recordId,revision:input.expectedRevision,fingerprint:input.expectedFingerprint},input.fields,input.operationId);
  for(const k of allowed) {
    if(k==='fields'){for(const f of Object.keys(copy.fields))if(copy.fields[f]!==input.fields[f])fail();}
    else if(copy[k]!==input[k])fail();
  }
  return copy;
}
/** Only unresolved request + actor UID. Never tokens, cached records, or demo data. */
export function createPendingStore(getStorage, getLocks = () => globalThis.navigator?.locks) {
  const key=uid=>{if(typeof uid!=='string'||!uid||uid.length>256)fail();return PENDING_PREFIX+encodeURIComponent(uid);};
  function read(uid) {
    try {
      const raw=getStorage().getItem(key(uid));if(raw===null)return null;
      if(typeof raw!=='string'||raw.length>10000)fail();
      const value=JSON.parse(raw);
      if(!keys(value,['version','uid','input'])||value.version!==1||value.uid!==uid)fail();
      return validate(value.input);
    } catch {fail();}
  }
  async function exclusive(uid, operation) {
    const name=key(uid)+'.lock';
    try {
      const locks=getLocks();if(typeof locks?.request!=='function')fail();
      // Never hold a lock over authentication or network I/O. Fail closed if it
      // cannot be obtained promptly, including a suspended competing tab.
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
      try {return await locks.request(name,{mode:'exclusive',signal:controller.signal},lock=>{if(!lock)fail();return operation();});}
      finally {clearTimeout(timer);}
    } catch {fail();}
  }
  function probe(uid){try{const storage=getStorage(),k=key(uid)+'.probe';storage.setItem(k,'1');if(storage.getItem(k)!=='1')fail();storage.removeItem(k);}catch{fail();}}
  return {
    read:uid=>exclusive(uid,()=>read(uid)),
    probe:uid=>exclusive(uid,()=>probe(uid)),
    inspect:uid=>exclusive(uid,()=>{probe(uid);return read(uid);}),
    save(uid,input){return exclusive(uid,()=>{
      try {
        const copy=validate(input),existing=read(uid);
        if(existing&&JSON.stringify(existing)!==JSON.stringify(copy))fail();
        const raw=JSON.stringify({version:1,uid,input:copy}),storage=getStorage();
        storage.setItem(key(uid),raw);
        if(storage.getItem(key(uid))!==raw)fail();
      } catch {fail();}
    });},
    remove(uid,input){return exclusive(uid,()=>{
      try {
        const existing=read(uid);
        if(existing&&JSON.stringify(existing)!==JSON.stringify(validate(input)))fail();
        const storage=getStorage();storage.removeItem(key(uid));if(storage.getItem(key(uid))!==null)fail();
      } catch {fail();}
    });},
  };
}
