// One-use, memory-only full-workspace preparation. This is not cached authority.
// The transport still obtains a freshly verified token and the backend still
// authorizes the user before returning data. Importing this file is inert.
export function createStartupRead({identity,uid,isCurrent=()=>true,read}={}) {
 let cancelled=false,consumed=false,snapshot=null,off=()=>{};
 const listeners=new Set();
 const error=()=>Object.assign(Error('ログイン状態が変わりました。'),{code:'LOGIN_REQUIRED'});
 const current=()=>!cancelled&&isCurrent()&&identity.currentUid()===uid;
 const check=()=>{if(!current())throw error();};
 function dispose(){if(cancelled)return;cancelled=true;snapshot=null;off();for(const fn of [...listeners])fn(null);listeners.clear();}
 const unsubscribe=identity.subscribe(next=>{if(next!==uid)dispose();});
 if(cancelled)unsubscribe?.();else off=unsubscribe??(()=>{});
 const guardedIdentity={currentUid:()=>current()?uid:null,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},async getIdToken(){check();const token=await identity.getIdToken();check();return token;}};
 const ready=Promise.resolve().then(async()=>{check();const value=await read(guardedIdentity);check();snapshot=value;});
 // A failed speculative read must never become an unhandled rejection while
 // the entry gate is still waiting for identity verification.
 void ready.catch(()=>{});
 return {ready,async consume(){await ready;check();if(consumed)throw Object.assign(Error('起動データは既に使用されています。'),{code:'STALE_READ'});consumed=true;const value=snapshot;snapshot=null;off();return value;},dispose};
}
