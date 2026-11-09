import {markStartupFailure} from './workspace-client.js';
import {startOriginalApp} from './original-app.js';
import {createOriginalDataAdapter} from './original-data-adapter.js';
import {createAccountSealStore} from './account-seal-store.js';
// Candidate entry may be configured, but publication requires verified backend readiness.
export async function startConnectedOriginalApp({doc,identity,client,pendingJournal,services={},startApp=startOriginalApp}={}){
 const root=doc.getElementById('google-app-root');if(!root)throw Error('本体の画面を確認できません。');const original=root.innerHTML;
 root.hidden=true;root.inert=true;let app,adapter,sealStore;
 try{
  adapter=createOriginalDataAdapter({identity,readSnapshot:()=>client.read(),sendCommand:command=>client.change(command),queryOperation:id=>client.operation(id),pendingJournal});
  sealStore=services.invoiceSealStore??createAccountSealStore({identity,indexedDB:doc.defaultView.indexedDB});
  app=await startApp({doc,adapter,services:{...services,currentAccountUid:()=>identity.currentUid(),invoiceSealStore:sealStore,checkWorkspaceChanges:value=>client.check(value)}});
  try{adapter.read();}catch(error){throw markStartupFailure(error,'FINAL');}
  let disposed=false;return{...app,assertCurrent:()=>adapter.read(),dispose(){if(disposed)return;disposed=true;app.dispose?.();sealStore.dispose?.();adapter.dispose();}};
 }catch(error){app?.dispose?.();sealStore?.dispose?.();adapter?.dispose();root.innerHTML=original;root.hidden=true;root.inert=true;throw markStartupFailure(error,'UI');}
}
export function createConnectedAppLoader(options){let pending=null,app=null,original=null,owner=null;return async()=>{
 const root=options.doc.getElementById('google-app-root');original??=root.innerHTML;
 if(app){try{app.assertCurrent();return app;}catch{if(options.identity.currentUid()===owner&&!app.isDisposed?.()){await app.reveal({expose:false});app.assertCurrent();return app;}app.dispose();app=null;root.innerHTML=original;root.hidden=true;root.inert=true;}}
 if(pending)return pending;
 const nextOwner=options.identity.currentUid();pending=startConnectedOriginalApp(options).then(value=>{owner=nextOwner;return app=value;}).finally(()=>{pending=null;});return pending;
};}
