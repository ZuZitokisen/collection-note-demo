// Only opaque operation metadata is persisted. Never store command, bank data or token.
export function createWorkspacePendingJournal({storage,locks}={}){
 const prefix='routenote-workspace-pending-v1:';
 const key=uid=>{if(typeof uid!=='string'||!uid)throw Error('Missing identity');return prefix+encodeURIComponent(uid);};
 function read(uid){const raw=storage.getItem(key(uid));if(raw===null)return null;const value=JSON.parse(raw);if(!value||Object.keys(value).sort().join(',')!=='expectedRevision,operationId'||typeof value.operationId!=='string'||!value.operationId||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<0)throw Error('保存結果の記録を確認してください。');return value;}
 function locked(uid,fn){if(!locks?.request)throw Error('安全な保存ロックを利用できません。');return locks.request(key(uid),fn);}
 return{read:async uid=>read(uid),claim:(uid,marker)=>locked(uid,()=>{if(read(uid))throw Error('前の保存結果を確認してください。');if(Object.keys(marker).sort().join(',')!=='expectedRevision,operationId')throw Error('Invalid operation marker');storage.setItem(key(uid),JSON.stringify(marker));const persisted=read(uid);if(persisted?.operationId!==marker.operationId||persisted.expectedRevision!==marker.expectedRevision)throw Error('保存確認用の記録を保持できません。');}),clear:(uid,id)=>locked(uid,()=>{if(read(uid)?.operationId===id){storage.removeItem(key(uid));if(read(uid)?.operationId===id)throw Error('保存結果の確認記録を更新できません。');}})};
}
