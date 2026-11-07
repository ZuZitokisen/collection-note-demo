import {createReportsClient, ReportsError} from './reports-client.js';
import {createPendingStore} from './reports-pending.js';
export const LIVE_ENDPOINT='https://script.google.com/macros/s/AKfycbxhTCY4IWpOh-tEQoS24yXXQYctbpHfB-l5iQObilc1-2Jud2-0bYJFhvpnOzAZ0dF-Wg/exec';
export function createLiveSession(identity) {
 let epoch=0;const listeners=new Set();
 const session={capture:()=>({epoch,uid:identity.currentUid()}),isCurrent:t=>!!t&&!!t.uid&&t.epoch===epoch&&t.uid===identity.currentUid(),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},invalidate(){epoch++;for(const fn of listeners)fn();}};
 let uid=identity.currentUid();const off=identity.subscribe(next=>{if(next!==uid){uid=next;session.invalidate();}});
 session.dispose=()=>{off();session.invalidate();listeners.clear();};return session;
}
export function createLiveApi({identity,session,endpoint=LIVE_ENDPOINT,fetchImpl=fetch,getStorage=()=>localStorage,getLocks=()=>navigator.locks,timeoutMs=30000}) {
 const pending=createPendingStore(getStorage,getLocks), reports=createReportsClient({endpoint,getIdToken:()=>identity.getIdToken(),fetchImpl,timeoutMs});
 const check=t=>{if(!session.isCurrent(t))throw new ReportsError('LOGIN_REQUIRED');};
 async function assertReady(){const t=session.capture();check(t);if(await pending.inspect(t.uid))throw new ReportsError('PENDING_OPERATION');check(t);return t;}
 async function request(action,params,{signal}={}) {
  const t=await assertReady(),controller=new AbortController();const off=session.subscribe(()=>controller.abort());const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeoutMs);
  try {
   if(signal?.aborted)throw new ReportsError('ABORTED');
   const token=await Promise.race([identity.getIdToken(),new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new ReportsError('ABORTED')),{once:true}))]);check(t);
   if(controller.signal.aborted)throw new ReportsError('ABORTED');
   const r=await fetchImpl(endpoint,{method:'POST',mode:'cors',credentials:'omit',redirect:'follow',cache:'no-store',headers:{'Content-Type':'text/plain;charset=UTF-8'},signal:controller.signal,body:JSON.stringify({action,idToken:token,...params})});
   if(!r.ok||r.type==='opaque')throw new ReportsError('TRANSPORT_FAILED');const value=await r.json();check(t);if(controller.signal.aborted)throw new ReportsError('ABORTED');if(value?.ok!==true)throw new ReportsError(value?.error||'INVALID_RESPONSE');await assertReady();check(t);return value;
  }finally{clearTimeout(timer);off();signal?.removeEventListener('abort',abort);}
 }
 return {pending,assertReady,readBilling:({month,signal}={})=>request('billing.read',{month},{signal}),readBillingDocument:({month,customerKey,kind,expectedSnapshotId,signal})=>request('billing.document',{month,customerKey,kind,expectedSnapshotId},{signal}),async readPage(options){const t=session.capture();check(t);const r=await reports.readPage(options);check(t);return r;},async change(input,{expectedUid,...options}={}){const t=session.capture();check(t);if(t.uid!==expectedUid)throw new ReportsError('LOGIN_REQUIRED');const r=await reports.change(input,options);if(!session.isCurrent(t))throw new ReportsError('LOGIN_REQUIRED',true);return r;}};
}
