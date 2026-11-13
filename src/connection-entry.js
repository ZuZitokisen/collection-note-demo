import {createStartupRead} from './startup-read.js';
import {createWorkspaceClient,markStartupFailure} from './workspace-client.js';
import {createWorkspacePendingJournal} from './workspace-pending.js';
import {createConnectedAppLoader} from './connected-original-app.js';
// Explicit deployment switch defaults OFF. Merely importing this module never contacts a service.
// Enabling requires a reviewed endpoint and separately verified backend readiness.
export function createConnectionEntry({enabled=false,endpoint,doc=globalThis.document,identityFactory=async()=> (await import('./firebase-driver.js')).googleApiIdentity(),fetchImpl=globalThis.fetch,services={},pendingJournal,loadLocal=async()=> (await import('./app.js')).appReady}={}){
 let preparing=null,loader=null,resources=null,hasLoaded=false;
 async function ensure(){
  if(!loader){
   if(!preparing)preparing=(async()=>{const identity=await identityFactory();const client=createWorkspaceClient({identity,endpoint,fetchImpl});const journal=pendingJournal??createWorkspacePendingJournal({storage:doc.defaultView.localStorage,locks:doc.defaultView.navigator.locks});resources={identity,client};return createConnectedAppLoader({doc,identity,client,pendingJournal:journal,services});})().finally(()=>{preparing=null;});
   loader=await preparing;
  }
  return loader;
 }
 const load=async({startupRead}={})=>{if(!enabled)return loadLocal();await ensure();const app=await loader(startupRead?{initialRead:()=>startupRead.consume()}:{});hasLoaded=true;return app;};
 load.prepare=async({uid,isCurrent=()=>true}={})=>{
  if(!enabled||hasLoaded||!isCurrent())return null;await ensure();
  if(hasLoaded||!isCurrent()||!uid||resources.identity.currentUid()!==uid)return null;
  return createStartupRead({identity:resources.identity,uid,isCurrent,read:identity=>createWorkspaceClient({identity,endpoint,fetchImpl}).read().catch(error=>{throw markStartupFailure(error,'READ');})});
 };
 return load;
}
