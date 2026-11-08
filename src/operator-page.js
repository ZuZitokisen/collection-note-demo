import {initializeGoogleSession,googleApiIdentity} from './firebase-driver.js';
import {createWorkspaceOperatorClient} from './operator-client.js?maintenance=finish-only-1';
const ENDPOINT='https://script.google.com/macros/s/AKfycbxhTCY4IWpOh-tEQoS24yXXQYctbpHfB-l5iQObilc1-2Jud2-0bYJFhvpnOzAZ0dF-Wg/exec';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const READS=['bootstrapPreflight','pricingPreflight'],WRITES=['bootstrap','preparePricing','finishPricingRecovery','activate'];
const BOOLEAN_FIELDS=['ok','readOnly','targetEmpty','sourceCurrent','changesApplied','initialized','replayed','activated','installed','rolledBack','sourceFreshRequired','mayMarkReady'];
const HASH_FIELDS=['sourceFingerprint','configurationHash','documentHash','storedSourceFingerprint','resultHash','sourceContextHash','formulaHash'];
export function validateOperatorResult(action,result,operationId){
 const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),integer=value=>Number.isSafeInteger(value)&&value>=0,bool=value=>typeof value==='boolean';
 if(!result||result.ok!==true)throw Error('INVALID_RESPONSE');
 let valid=false;
 if(action==='bootstrapPreflight')valid=result.readOnly===true&&result.changesApplied===false&&hash(result.sourceFingerprint)&&hash(result.configurationHash)&&bool(result.targetEmpty)&&(result.targetEmpty||hash(result.documentHash)&&integer(result.revision)&&hash(result.storedSourceFingerprint)&&bool(result.sourceCurrent)&&result.sourceCurrent===(result.storedSourceFingerprint===result.sourceFingerprint));
 if(action==='pricingPreflight')valid=result.changesApplied===false&&hash(result.sourceContextHash)&&hash(result.formulaHash)&&integer(result.formulaCellCount)&&integer(result.projectionColumns);
 if(action==='bootstrap')valid=result.initialized===true&&result.activated===false&&result.operationId===operationId&&hash(result.resultHash)&&bool(result.replayed);
 if(action==='preparePricing')valid=result.installed===true&&result.rolledBack===false&&result.mayMarkReady===false&&bool(result.sourceFreshRequired)&&(result.replayed===undefined||bool(result.replayed));
 // The fixed client action identifies the endpoint; accept only its bounded response contract.
 if(action==='finishPricingRecovery'){
  const keys=Object.keys(result).sort().join(',');
  const base=['ok','installed','rolledBack','sourceFreshRequired','mayMarkReady'];
  valid=(keys===base.sort().join(',')||keys===[...base,'replayed'].sort().join(',')&&result.replayed===true)&&result.installed===true&&result.rolledBack===false&&result.sourceFreshRequired===false&&result.mayMarkReady===false;
 }
 if(action==='activate')valid=result.activated===true&&bool(result.replayed)&&integer(result.revision);
 if(!valid)throw Error('INVALID_RESPONSE');return result;
}
export function safeOperatorResult(result){
 if(!result||result.ok!==true)throw Error('INVALID_RESPONSE');const safe={};
 for(const key of BOOLEAN_FIELDS)if(typeof result[key]==='boolean')safe[key]=result[key];
 for(const key of HASH_FIELDS)if(typeof result[key]==='string'&&/^[a-f0-9]{64}$/.test(result[key]))safe[key]=result[key];
 for(const key of ['revision','formulaCellCount'])if(Number.isSafeInteger(result[key])&&result[key]>=0)safe[key]=result[key];
 if(UUID.test(result.operationId??''))safe.operationId=result.operationId;return safe;
}
export async function installOperatorPage({doc=document,initialize=initializeGoogleSession,identityFactory=googleApiIdentity,clientFactory=createWorkspaceOperatorClient}={}){
 const status=doc.querySelector('#operator-status'),resultNode=doc.querySelector('#operator-result'),controls=doc.querySelector('#operator-controls'),login=doc.querySelector('#operator-login'),form=doc.querySelector('#operator-form');
 let session,identity,client,uid=null,epoch=0,busy=false,stopped=false,preflight=false;const attempted=new Set();
 const render=()=>{controls.hidden=!uid;login.disabled=busy||stopped;login.hidden=!!uid;for(const button of controls.querySelectorAll('button'))button.disabled=busy||stopped;form.querySelector('button').disabled=busy||stopped||!preflight;};
 async function execute(action,operationId){
  if(!uid||busy||stopped||(!READS.includes(action)&&!WRITES.includes(action)))return;
  const write=WRITES.includes(action);if(write&&(!preflight||!UUID.test(operationId??'')||attempted.has(operationId))){status.textContent='操作を停止しました。事前確認と未使用の承認済み UUID を確認してください。';return;}
  const ticket=epoch,owner=uid;if(action==='bootstrapPreflight')preflight=false;busy=true;if(write)attempted.add(operationId);resultNode.textContent='';status.textContent=`workspace.${action} を確認しています。`;render();
  try{const response=await client[action](operationId);if(epoch!==ticket||uid!==owner)throw Object.assign(Error('LOGIN_REQUIRED'),{code:'LOGIN_REQUIRED',unknown:write});const safe=safeOperatorResult(validateOperatorResult(action,response,operationId));resultNode.textContent=JSON.stringify(safe,null,2);if(action==='bootstrapPreflight')preflight=true;status.textContent=action==='finishPricingRecovery'?'完了記録のみの確定応答を確認しました。数式変更・接続有効化は行っていません。サーバー側の記録を照合してください。':write?'応答を確認しました。結果の各項目を確認してから次へ進んでください。':'読み取り確認が完了しました。';form.elements.confirmed.checked=false;}
  catch(error){if(write&&!error.definitiveRejection){stopped=true;status.textContent='結果不明のため停止しました。再送・再読込せず、サーバー側の記録を確認してください。';}else{const code=typeof error.code==='string'&&/^[A-Z_]{1,64}$/.test(error.code)?error.code:'REQUEST_FAILED';status.textContent=`操作できませんでした (${code})。`;if(['FORBIDDEN','UNAUTHENTICATED','LOGIN_REQUIRED'].includes(code)){stopped=true;preflight=false;}}}
  finally{busy=false;render();}
 }
 doc.querySelectorAll('[data-read]').forEach(button=>button.addEventListener('click',()=>void execute(button.dataset.read)));
 form.addEventListener('submit',event=>{event.preventDefault();if(form.elements.confirmed.checked)void execute(form.elements.action.value,form.elements.operationId.value.trim());});
 login.addEventListener('click',()=>{if(session&&!busy&&!stopped)void session.signIn().catch(()=>{status.textContent='Googleログインを完了できませんでした。管理操作は実行していません。';});});
 try{session=await initialize();identity=await identityFactory();client=clientFactory({identity,endpoint:ENDPOINT});session.subscribe(state=>{const next=state.status==='signed-in'?state.user?.uid??null:null;if(next!==uid){epoch++;preflight=false;if(busy)stopped=true;uid=next;resultNode.textContent='';}status.textContent=stopped?'ログイン状態が変わったため停止しました。再送しないでください。':uid?'ログイン済みです。まず読み取り確認を実行してください。':'Googleでログインしてください。';render();});}
 catch{stopped=true;status.textContent='ログインの初期化に失敗しました。操作は実行していません。';render();}
 return {execute,get stopped(){return stopped;}};
}
if(typeof document!=='undefined')void installOperatorPage();
