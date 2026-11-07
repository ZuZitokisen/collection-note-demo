import {createSealStore} from './invoice-seal.js';
// Account-scoped local convenience only. Never reads/copies/deletes legacy "current".
export function createAccountSealStore({identity,indexedDB,createStore=createSealStore}={}){
 const uid=identity.currentUid();if(!uid)throw Error('Googleログインを確認してください。');let epoch=0,disposed=false,observed=uid;
 const off=identity.subscribe(next=>{if(next!==observed){observed=next;epoch++;}});
 const initial=epoch;function guard(){if(disposed||epoch!==initial||identity.currentUid()!==uid)throw Object.assign(Error('ログイン状態が変わりました。'),{code:'LOGIN_REQUIRED'});}
 const store=createStore(indexedDB,{key:'account:'+uid,guard});
 return{...Object.fromEntries(['load','save','remove'].map(method=>[method,async(...args)=>{guard();const result=await store[method](...args);guard();return result;}])),dispose(){disposed=true;off?.();}};
}
