import { CUSTOMERS, PEOPLE, sampleState, clone, optionalDecimal, validateDate, monthBounds, sumField, ConflictError, ValidationError, DuplicateError } from './model.js';
export { clone, ConflictError, ValidationError, DuplicateError };
export const STORAGE_KEY_V3 = 'collection-report-local-prototype-v3';
export const CATEGORIES = { combustible: '可燃', noncombustible: '不燃', other: 'その他' };
const types = ['customers', 'members', 'items'];
const stamp = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const text = (v, max = 120) => { const s = String(v ?? '').trim(); if (!s || s.length > max) throw new ValidationError(`名称は1〜${max}文字で入力してください。`); return s; };
function validateCategoryNotes(notes) {
  if (!notes || typeof notes !== 'object' || Array.isArray(notes) || Object.entries(notes).some(([key, value]) => !Object.hasOwn(CATEGORIES, key) || typeof value !== 'string' || value.length > 500)) throw new ValidationError('各区分の備考は500文字以内の文字列で入力してください。');
  return notes;
}
function readReportNote(value) {
  if (typeof value !== 'string' || value.length > 500) throw new ValidationError('各区分の備考は500文字以内の文字列で入力してください。');
  return value.trim();
}
// Notes are free text, not additional disposal categories or item selections.
// otherItem remains the authoritative legacy-compatible その他 note field.
export function reportNotes(record = {}) {
  return { combustible: record.categoryNotes?.combustible ?? '', noncombustible: record.categoryNotes?.noncombustible ?? '', other: record.otherItem ?? record.categoryNotes?.other ?? '' };
}
function validateMemberProfile(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p) || (p.age !== null && (!Number.isInteger(p.age) || p.age < 0 || p.age > 120)) || !['', '男', '女', 'ー'].includes(p.gender) || typeof p.license !== 'string' || p.license.length > 200 || typeof p.other !== 'string' || p.other.length > 500) throw new ValidationError('プロフィールの形式が正しくありません。年齢は0〜120歳、性別は男・女・ーから選択してください。');
  return p;
}
function readMemberProfile(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new ValidationError('プロフィールの形式が正しくありません。');
  const age=p.age===null||p.age===undefined||p.age===''?null:(typeof p.age==='string'&&/^\d{1,3}$/.test(p.age)?Number(p.age):p.age);
  return validateMemberProfile({age,gender:p.gender??'',license:typeof p.license==='string'?p.license.trim():p.license??'',other:typeof p.other==='string'?p.other.trim():p.other??''});
}
function master(state, type, id) { return state.masters[type]?.find(x => x.id === id); }
export function activeMasters(state, type) { return state.masters[type].filter(x => x.active); }
export function displayName(state, type, id, snapshot = '') { const m = master(state, type, id); return `${snapshot || m?.name || '名称不明'}${m && !m.active ? '（×）' : ''}`; }
function member(state, id) { const m = master(state, 'members', id); if (!m?.active) throw new ValidationError('今回操作する有効なメンバーを選択してください。'); return m; }
function defaults() { return { enabled: { combustible: true, noncombustible: true, other: true }, rates: { combustible: 30, noncombustible: 45, other: 300 }, itemIds: ['demo-item-1', 'demo-item-2', 'demo-item-3'] }; }
function initialMasters() { return { customers: CUSTOMERS.map(c => ({ ...c, active: true, version: 1, ...defaults() })), members: PEOPLE.map((name, i) => ({ id: `demo-member-${i+1}`, name, active: true, version: 1 })), items: Object.keys(CATEGORIES).map((category, i) => ({ id: `demo-item-${i+1}`, name: `${CATEGORIES[category]}サンプル（架空）`, category, active: true, version: 1 })) }; }
const numericFields = ['combustibleKg','noncombustibleKg','otherFee','combustibleRate','noncombustibleRate'];
function validateLegacy(value) {
  if (!value || value.schema !== 2 || !Array.isArray(value.records) || !Array.isArray(value.history)) throw new ValidationError('旧データの形式を確認できません。元データは変更しません。');
  const ids = new Set();
  for (const r of value.records) {
    if (!r || typeof r.id !== 'string' || ids.has(r.id) || !CUSTOMERS.some(c => c.id === r.customerId) || !PEOPLE.includes(r.createdBy) || !PEOPLE.includes(r.lastEditedBy) || typeof r.deleted !== 'boolean' || !Number.isInteger(r.version) || r.version < 1 || !Number.isFinite(Date.parse(r.createdAt)) || !Number.isFinite(Date.parse(r.updatedAt))) throw new ValidationError('旧記録の形式を確認できません。');
    validateDate(r.date); for (const key of ['combustibleKg','noncombustibleKg','otherFee']) { if (r[key] !== null && typeof r[key] !== 'number') throw new ValidationError('旧記録の数値形式が不正です。'); optionalDecimal(r[key], key); }
    if (typeof r.otherItem !== 'string' || r.otherItem.length > 500) throw new ValidationError('旧品名が不正です。'); ids.add(r.id);
  }
  for (const e of value.history) if (!e || typeof e.id !== 'string' || !ids.has(e.recordId) || !['create','update','delete','restore'].includes(e.action) || !PEOPLE.includes(e.actor) || !Number.isFinite(Date.parse(e.timestamp)) || !e.after || typeof e.after !== 'object') throw new ValidationError('旧履歴の形式を確認できません。');
}
export function migrateState(value) {
  if (value?.schema === 3) return validateState(clone(value));
  validateLegacy(value); const masters = initialMasters();
  const augment = r => r ? { ...clone(r), customerName: CUSTOMERS.find(c => c.id === r.customerId)?.name ?? '', createdById: masters.members.find(x => x.name === r.createdBy)?.id ?? '', lastEditedById: masters.members.find(x => x.name === r.lastEditedBy)?.id ?? '', combustibleRate: null, noncombustibleRate: null, itemIds: { combustible: '', noncombustible: '', other: '' }, itemNames: { combustible: '', noncombustible: '', other: '' }, defaultRates: { combustible: null, noncombustible: null, other: null }, priceSource: 'legacy-unknown' } : null;
  return validateState({ schema: 3, revision: 1, masterRevision: 1, migratedFrom: 2, masters, records: value.records.map(augment), history: value.history.map(e => ({ ...clone(e), actorId: masters.members.find(x => x.name === e.actor)?.id ?? '', before: augment(e.before), after: augment(e.after) })), settingsHistory: [] });
}
export function createSampleState() {
  const s=migrateState(sampleState());
  const names=['青葉みどり商店','港町こむぎ食堂','日向ビル管理','森のまちスーパー','さくら通りオフィス','つばめ製作所','白波ビジネスホテル','こもれび菓子店','北町物流センター','あおぞらホームセンター','丘の上ベーカリー','若葉家具工房','七色イベント会館','風見カフェ','小春フラワーショップ','ひだまり集合住宅','水辺の宿','中央文具センター','つきのわ飲食館','山の手整備工場','虹ヶ丘販売所','あさひ食品加工','星の森雑貨店','駅前しおかぜ書店','若草園芸センター','木立レンタル倉庫','南町コミュニティ館','てらす共同事務所','三日月包装工場'];
  s.masters.customers.forEach((c,i)=>{c.name=names[i]+'（架空）';c.rates={combustible:25+(i%5)*5,noncombustible:40+(i%4)*10,other:200+(i%6)*100};});
  for(const r of s.records)r.customerName=master(s,'customers',r.customerId).name;
  for(const e of s.history)for(const r of [e.before,e.after])if(r)r.customerName=master(s,'customers',r.customerId).name;
  return validateState(s);
}
export function validateState(s) {
  if (!s || s.schema !== 3 || !Number.isInteger(s.revision) || s.revision < 1 || !Number.isInteger(s.masterRevision) || s.masterRevision < 1 || !Array.isArray(s.records) || !Array.isArray(s.history) || !Array.isArray(s.settingsHistory)) throw new ValidationError('保存形式が正しくありません。');
  for (const type of types) { const ids = new Set(); if (!Array.isArray(s.masters?.[type])) throw new ValidationError('設定形式が正しくありません。'); for (const m of s.masters[type]) { if (!m || typeof m.id !== 'string' || !m.id || ids.has(m.id) || typeof m.active !== 'boolean' || !Number.isInteger(m.version) || m.version < 1) throw new ValidationError('設定IDまたは版が正しくありません。'); text(m.name); ids.add(m.id); if (type === 'members' && m.profile !== undefined) validateMemberProfile(m.profile); if (type === 'items' && m.category !== undefined && !CATEGORIES[m.category]) throw new ValidationError('区分が正しくありません。'); if (type === 'customers') { if (!Array.isArray(m.itemIds) || Object.keys(CATEGORIES).some(k => typeof m.enabled?.[k] !== 'boolean' || (m.rates?.[k] !== null && typeof m.rates?.[k] !== 'number'))) throw new ValidationError('取引先設定が正しくありません。'); for(const k of Object.keys(CATEGORIES)) optionalDecimal(m.rates[k], '単価'); } } }
  if (!activeMasters(s, 'members').length) throw new ValidationError('有効なメンバーが必要です。');
  for (const c of s.masters.customers) if(c.itemIds.some(id => !master(s,'items',id))) throw new ValidationError('設定の処分物品参照が不正です。');
  const ids = new Set();
  for (const r of s.records) { if (!r || typeof r.id !== 'string' || ids.has(r.id) || !master(s,'customers',r.customerId) || !master(s,'members',r.createdById) || !master(s,'members',r.lastEditedById) || !Number.isInteger(r.version) || r.version < 1 || typeof r.deleted !== 'boolean' || !Number.isFinite(Date.parse(r.createdAt)) || !Number.isFinite(Date.parse(r.updatedAt))) throw new ValidationError('記録の形式が正しくありません。'); validateDate(r.date); text(r.customerName); text(r.createdBy); text(r.lastEditedBy); for(const key of numericFields) { if(r[key] !== null && typeof r[key] !== 'number') throw new ValidationError('数値形式が正しくありません。'); optionalDecimal(r[key],key); } if(typeof r.otherItem !== 'string' || r.otherItem.length > 500) throw new ValidationError('その他備考の形式が正しくありません。'); if(r.categoryNotes!==undefined)validateCategoryNotes(r.categoryNotes); for(const k of Object.keys(CATEGORIES)) if(typeof r.itemIds?.[k] !== 'string' || typeof r.itemNames?.[k] !== 'string' || (r.itemIds[k] && !master(s,'items',r.itemIds[k]))) throw new ValidationError('処分物品の参照が不正です。'); ids.add(r.id); }
  if (s.history.some(e => !e || typeof e.id !== 'string' || !ids.has(e.recordId) || !['create','update','delete','restore'].includes(e.action) || !master(s,'members',e.actorId) || !Number.isFinite(Date.parse(e.timestamp)) || !e.after || typeof e.after !== 'object') || s.settingsHistory.some(e => !e || !types.includes(e.type) || !master(s,e.type,e.masterId) || !master(s,'members',e.actorId) || !Number.isFinite(Date.parse(e.timestamp)))) throw new ValidationError('履歴の形式が正しくありません。');
  for (const e of s.history) {
    if (!Number.isInteger(e.version) || e.version < 1 || typeof e.actor !== 'string' || (e.before !== null && typeof e.before !== 'object')) throw new ValidationError('履歴の版・実行者が不正です。');
    for (const snapshot of [e.before,e.after]) if (snapshot) {
      if (snapshot.id !== e.recordId) throw new ValidationError('履歴の記録IDが一致しません。');
      validateState({...s,records:[snapshot],history:[],settingsHistory:[]});
    }
  }
  for (const e of s.settingsHistory) if (e.type === 'members') for (const snapshot of [e.before,e.after]) if (snapshot?.profile !== undefined) validateMemberProfile(snapshot.profile);
  return s;
}
export function masterDraft(s,type,id,{duplicate=false}={}) { const old=master(s,type,id); if(!old) throw new ValidationError('対象がありません。'); const d=clone(old); if(duplicate){delete d.id;delete d.version;d.name='';d.active=true;} return d; }
function masterChange(s,type,before,after,actorId,action) { const actor=member(s,actorId),next=clone(s); next.masters[type]=before?next.masters[type].map(m=>m.id===before.id?after:m):[...next.masters[type],after]; next.revision++;next.masterRevision++; next.settingsHistory.push({id:uid(),type,masterId:after.id,action,actorId,actor:actor.name,timestamp:stamp(),before:clone(before),after:clone(after)}); return {state:validateState(next),master:clone(after)}; }
export function saveMaster(s,type,input,{id=null,expectedVersion=null,actorId}={}) {
  if(!types.includes(type)) throw new ValidationError('設定種別が不正です。'); member(s,actorId); const old=id?master(s,type,id):null;
  if(id && (!old || old.version!==expectedVersion)) throw new ConflictError(old??null);
  const name=text(input.name); if(s.masters[type].some(m=>m.id!==id && m.active && m.name===name)) throw new ValidationError('同じ名称が登録済みです。区別できる名称にしてください。');
  const next={id:old?.id??uid(),name,active:old?.active??true,version:(old?.version??0)+1};
  if(type==='members'){if(input.profile!==undefined)next.profile=readMemberProfile(input.profile);else if(old?.profile!==undefined)next.profile=clone(old.profile);}
  if(type==='items'){
    // Old classifications remain audit data; new note candidates need no category.
    const category=input.category===undefined?old?.category:input.category;
    if(category!==undefined){if(!CATEGORIES[category])throw new ValidationError('区分が正しくありません。');if(old && old.category!==category && s.records.some(r=>Object.values(r.itemIds).includes(id)))throw new ValidationError('使用済み物品の区分は変更できません。');next.category=category;}
  }
  if(type==='customers'){
    next.enabled=clone(input.enabled??old?.enabled??defaults().enabled);
    next.rates={};for(const k of Object.keys(CATEGORIES))next.rates[k]=optionalDecimal((input.rates??old?.rates)?.[k],`${CATEGORIES[k]}の初期値`);
    next.itemIds=[...new Set(input.itemIds??old?.itemIds??[])];
    if(next.itemIds.some(id=>!master(s,'items',id)))throw new ValidationError('処分物品が見つかりません。');
  }
  return masterChange(s,type,old,next,actorId,old?'update':'create');
}
export function setMasterActive(s,type,id,expectedVersion,active,actorId){member(s,actorId);const m=master(s,type,id);if(!m||m.version!==expectedVersion)throw new ConflictError(m??null);if(type==='members'&&!active&&activeMasters(s,type).length===1&&m.active)throw new ValidationError('最後の有効なメンバーは削除できません。');if(active&&s.masters[type].some(x=>x.id!==id&&x.active&&x.name===m.name))throw new ValidationError('同じ名称の有効な項目があります。先に名称を区別してください。');return masterChange(s,type,m,{...m,active:!!active,version:m.version+1},actorId,active?'reactivate':'deactivate');}
export function reportDefaults(s,customerId){const c=master(s,'customers',customerId);if(!c?.active)throw new ValidationError('有効な取引先を選択してください。');return {combustibleKg:null,noncombustibleKg:null,otherItem:'',otherFee:c.rates.other,combustibleRate:c.rates.combustible,noncombustibleRate:c.rates.noncombustible,itemIds:{combustible:'',noncombustible:'',other:''},defaultRates:clone(c.rates),priceSource:'customer-default',masterRevision:s.masterRevision};}
function fields(s,input,current=null){
  const c=master(s,'customers',input.customerId);if(!c || (!c.active&&current?.customerId!==c.id))throw new ValidationError('有効な取引先を選択してください。');
  if(input.masterRevision!==s.masterRevision)throw new ConflictError({message:'設定が変更されています。入力内容を控え、設定を再確認してください。'});
  if(input.categoryNotes!==undefined)validateCategoryNotes(input.categoryNotes);
  const otherChanged=input.otherItem!==undefined||input.categoryNotes?.other!==undefined;
  const f={date:validateDate(input.date),customerId:c.id,customerName:current?.customerId===c.id?current.customerName:c.name,otherItem:otherChanged?readReportNote(input.otherItem!==undefined?input.otherItem:input.categoryNotes.other):current?.otherItem??current?.categoryNotes?.other??'',itemIds:{},itemNames:{},defaultRates:clone(current?.defaultRates??c.rates),priceSource:current?.priceSource??'report-input'};
  if(current?.categoryNotes!==undefined||input.categoryNotes!==undefined){f.categoryNotes=clone(current?.categoryNotes??{});for(const [key,value]of Object.entries(input.categoryNotes??{}))f.categoryNotes[key]=readReportNote(value);if(otherChanged&&f.categoryNotes.other!==undefined)f.categoryNotes.other=f.otherItem;}
  for(const key of numericFields)f[key]=optionalDecimal(input[key],key);
  for(const k of Object.keys(CATEGORIES)){const id=String(input.itemIds?.[k]??current?.itemIds?.[k]??''),i=master(s,'items',id);if(id && (!i || i.category!==k || ((!i.active||!c.itemIds.includes(id))&&current?.itemIds?.[k]!==id)))throw new ValidationError('選択した処分物品は現在利用できません。設定を確認してください。');f.itemIds[k]=id;f.itemNames[k]=current&&input.itemIds?.[k]===undefined?current.itemNames[k]:id?(current?.itemIds?.[k]===id?current.itemNames[k]:i.name):'';}
  const notes=reportNotes(f);

  if(f.combustibleKg===null&&f.noncombustibleKg===null&&f.otherFee===null&&!Object.values(notes).some(Boolean)&&!f.itemIds.other)throw new ValidationError('重量・備考・その他金額のいずれかを入力してください。');
  if(s.records.some(r=>!r.deleted&&r.id!==current?.id&&r.date===f.date&&r.customerId===c.id))throw new DuplicateError('同じ日・取引先の記録があります。閲覧編集から既存記録を編集してください。');
  return f;
}
function recordChange(s,before,after,actorId,action){const a=member(s,actorId),next=clone(s);next.records=before?next.records.map(r=>r.id===before.id?after:r):[...next.records,after];next.revision++;next.history.push({id:uid(),recordId:after.id,action,actorId,actor:a.name,timestamp:after.updatedAt,version:after.version,before:clone(before),after:clone(after)});return {state:validateState(next),record:clone(after)};}
export function createRecord(s,input,actorId){const a=member(s,actorId),creator=member(s,input.createdById),f=fields(s,input);const now=stamp();return recordChange(s,null,{...f,id:uid(),createdById:creator.id,createdBy:creator.name,lastEditedById:a.id,lastEditedBy:a.name,createdAt:now,updatedAt:now,version:1,deleted:false},actorId,'create');}
export function createRecords(s,input,actorId){member(s,actorId);if(!input.rows?.length)throw new ValidationError('入力する取引先を選択してください。');let next=s;const records=[];for(const row of input.rows){try{const r=createRecord(next,{...row,date:input.date,createdById:input.createdById,masterRevision:input.masterRevision},actorId);next=r.state;records.push(r.record);}catch(e){e.customerId=row.customerId;throw e;}}return {state:next,record:{count:records.length,records}};}
function currentRecord(s,id,v,deleted=false){const r=s.records.find(r=>r.id===id);if(!r||r.deleted!==deleted||r.version!==v)throw new ConflictError(r??null);return r;}
export function updateRecord(s,id,v,input,actorId){const a=member(s,actorId),old=currentRecord(s,id,v),f=fields(s,input,old);return recordChange(s,old,{...old,...f,lastEditedById:a.id,lastEditedBy:a.name,updatedAt:stamp(),version:old.version+1},actorId,'update');}
export function deleteRecord(s,id,v,actorId){const a=member(s,actorId),old=currentRecord(s,id,v);return recordChange(s,old,{...old,deleted:true,lastEditedById:a.id,lastEditedBy:a.name,updatedAt:stamp(),version:old.version+1},actorId,'delete');}
export function restoreRecord(s,id,v,actorId){const a=member(s,actorId),old=currentRecord(s,id,v,true);if(s.records.some(r=>!r.deleted&&r.id!==id&&r.date===old.date&&r.customerId===old.customerId))throw new DuplicateError('同じ日・取引先の有効な記録があるため復元を停止しました。');return recordChange(s,old,{...old,deleted:false,lastEditedById:a.id,lastEditedBy:a.name,updatedAt:stamp(),version:old.version+1},actorId,'restore');}
export function summarize(s,{period,value}){let start,end;if(period==='day'){start=validateDate(value);end=start+'~';}else if(period==='month'){({start,end}=monthBounds(value));}else if(period==='year'&&/^\d{4}$/.test(value)&&Number(value)>0){start=value+'-01-01';end=String(Number(value)+1).padStart(4,'0')+'-01-01';}else throw new ValidationError('集計期間を確認してください。');const records=s.records.filter(r=>!r.deleted&&r.date>=start&&r.date<end);return s.masters.customers.map(c=>{const rows=records.filter(r=>r.customerId===c.id);return {customerId:c.id,name:displayName(s,'customers',c.id),count:rows.length,combustibleKg:sumField(rows,'combustibleKg'),noncombustibleKg:sumField(rows,'noncombustibleKg'),otherFee:sumField(rows,'otherFee'),missingCombustible:rows.filter(r=>r.combustibleKg===null).length,missingNoncombustible:rows.filter(r=>r.noncombustibleKg===null).length,missingOther:rows.filter(r=>r.otherFee===null).length};}).filter(x=>x.count);}
