import {createWorkspaceClient} from './workspace-client.js';
import {createWorkspacePendingJournal} from './workspace-pending.js';
import {createConnectedAppLoader} from './connected-original-app.js';
// Explicit deployment switch defaults OFF. Merely importing this module never contacts a service.
// Enabling requires a reviewed endpoint and separately verified backend readiness.
export function createConnectionEntry({enabled=false,endpoint,doc=globalThis.document,identityFactory=async()=> (await import('./firebase-driver.js')).googleApiIdentity(),fetchImpl=globalThis.fetch,services={},pendingJournal,loadLocal=async()=> (await import('./app.js')).appReady}={}){
 let preparing=null,loader=null;
 return async()=>{
  if(!enabled)return loadLocal();
  if(!loader){
   if(!preparing)preparing=(async()=>{const identity=await identityFactory();const client=createWorkspaceClient({identity,endpoint,fetchImpl});const journal=pendingJournal??createWorkspacePendingJournal({storage:doc.defaultView.localStorage,locks:doc.defaultView.navigator.locks});return createConnectedAppLoader({doc,identity,client,pendingJournal:journal,services});})().finally(()=>{preparing=null;});
   loader=await preparing;
  }
  return loader();
 };
}
