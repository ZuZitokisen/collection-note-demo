import {installLedgerPanel} from './ledger-panel.js';
import {createLedgerReader} from './ledger-read-client.js';
// Public deployment address, never a credential. Membership is checked by this server.
const ENDPOINT='https://script.google.com/macros/s/AKfycbxhTCY4IWpOh-tEQoS24yXXQYctbpHfB-l5iQObilc1-2Jud2-0bYJFhvpnOzAZ0dF-Wg/exec';
async function loadGoogleConnection(){
 const identity=await (await import('./firebase-driver.js')).googleApiIdentity();
 return {...identity,readPage:createLedgerReader({endpoint:ENDPOINT,getIdToken:()=>identity.getIdToken()})};
}
const authError=()=>Object.assign(new Error('Googleログインを確認してください。'),{code:'UNAUTHENTICATED'});
export function installSheetConnection({doc=document,loadConnection=loadGoogleConnection}={}){
 const host=doc.querySelector('#sheet-ledger-panel'),local=doc.querySelector('#browse-local'),buttons=[...doc.querySelectorAll('[data-browse-source]')];
 let page='',source='local',sequence=0,unsubscribe=null,disposed=false,identityUid=null;
 function clearIdentity(){unsubscribe?.();unsubscribe=null;identityUid=null;}
 const panel=installLedgerPanel({host,readPage:async({signal})=>{
  const request=sequence;
  const connection=await loadConnection();
  if(disposed||request!==sequence||signal.aborted)throw authError();
  const uid=connection.currentUid();if(!uid)throw authError();
  clearIdentity();identityUid=uid;
  unsubscribe=connection.subscribe(next=>{
   if(next!==identityUid){sequence++;clearIdentity();panel.setAuthorization(false);}
  });
  if(!identityUid||signal.aborted)throw authError();
  const result=await connection.readPage({signal});
  if(disposed||request!==sequence||signal.aborted||connection.currentUid()!==uid)throw authError();
  return result;
 }});
 function render(){
  buttons.forEach(button=>{const active=button.dataset.browseSource===source;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  local.hidden=source==='sheet';
  if(page==='browse'&&source==='sheet'){
   // Initial Google identity is already verified by the app entry. Each fetch still
   // refreshes it and requires server membership; this flag is not API authorization.
   void panel.setAuthorization(true);void panel.show();
  }else{sequence++;clearIdentity();panel.hide();panel.setAuthorization(false);}
 }
 const handlers=buttons.map(button=>{const listener=()=>{const next=button.dataset.browseSource;if(next===source)return;sequence++;clearIdentity();panel.hide();panel.setAuthorization(false);source=next;render();};button.addEventListener('click',listener);return()=>button.removeEventListener('click',listener);});
 const conceal=()=>{sequence++;clearIdentity();panel.hide();panel.setAuthorization(false);};
 doc.defaultView.addEventListener('pagehide',conceal);
 return {setPage(next,preferredSource){const nextSource=preferredSource??source;if(next===page&&nextSource===source)return;page=next;source=nextSource;render();},dispose(){if(disposed)return;disposed=true;sequence++;clearIdentity();handlers.forEach(remove=>remove());doc.defaultView.removeEventListener('pagehide',conceal);panel.dispose();},getState:()=>({source,page,...panel.getState()})};
}
