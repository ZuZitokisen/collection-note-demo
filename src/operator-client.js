export const WORKSPACE_BODY_MAX_BYTES=524288;
// Endpoint supplied explicitly by the reviewed deployment. No background write retries.
function createTransport({identity,endpoint,fetchImpl=globalThis.fetch,timeoutMs=30000}={}){
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint))throw new TypeError('Reviewed Apps Script endpoint required');
 async function request(action,values={}){
  const mutating=['workspace.change','workspace.bootstrap','workspace.preparePricing','workspace.activate'].includes(action);
  const uid=identity.currentUid();if(!uid)throw Object.assign(Error('Googleログインを確認してください。'),{code:'LOGIN_REQUIRED',definitiveRejection:true});
  const controller=new AbortController();let sent=false,changed=false,serverRejected=false;
  const aborted=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Object.assign(Error('interrupted'),{interrupted:true})),{once:true}));void aborted.catch(()=>{});
  const off=identity.subscribe(next=>{if(next!==uid){changed=true;controller.abort();}}),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const token=await Promise.race([identity.getIdToken(),aborted]);if(changed||identity.currentUid()!==uid||controller.signal.aborted)throw Error('interrupted');
   const body=JSON.stringify({action,idToken:token,...values});if(body.length>WORKSPACE_BODY_MAX_BYTES||new TextEncoder().encode(body).byteLength>WORKSPACE_BODY_MAX_BYTES)throw Object.assign(Error('入力が一度に送れる量を超えています。入力を残しています。'),{code:'BODY_TOO_LARGE',definitiveRejection:true});
   sent=true;const response=await Promise.race([fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body,credentials:'omit',cache:'no-store',redirect:'follow',signal:controller.signal}),aborted]);
   if(!response.ok)throw Error('transport');const result=await Promise.race([response.json(),aborted]);
   if(changed||identity.currentUid()!==uid||controller.signal.aborted)throw Error('interrupted');
   if(result.ok!==true){serverRejected=true;throw Object.assign(Error('共有データの操作を完了できませんでした。'),{code:(typeof result.error==='string'?result.error:result.error?.code)??result.code??'API_ERROR',definitiveRejection:!mutating||result.definitiveRejection===true});}
   return result;
  }catch(error){if(error?.code){const definitiveRejection=!sent||(serverRejected&&error.definitiveRejection===true);throw Object.assign(Error(!sent?'送信前の確認に失敗しました。入力内容は残しています。':'共有データの操作結果を確認してください。'),{code:error.code,definitiveRejection,unknown:sent&&mutating&&!definitiveRejection});}throw Object.assign(Error(changed?'Googleログインを確認してください。':'読み込みを完了できませんでした。再試行してください。'),{code:changed?'LOGIN_REQUIRED':controller.signal.aborted?'TIMEOUT':'NETWORK',definitiveRejection:!sent,unknown:sent&&mutating});}finally{clearTimeout(timer);off?.();}
 }
 return request;
}
// Fixed administrative packet only; no arbitrary API action/body interface.
export function createWorkspaceOperatorClient(options){
 const request=createTransport(options);
 return Object.freeze({
  bootstrapPreflight:()=>request('workspace.bootstrapPreflight'),
  pricingPreflight:()=>request('workspace.pricingPreflight'),
  bootstrap:operationId=>request('workspace.bootstrap',{operationId}),
  preparePricing:operationId=>request('workspace.preparePricing',{operationId}),
  activate:operationId=>request('workspace.activate',{operationId}),
 });
}
