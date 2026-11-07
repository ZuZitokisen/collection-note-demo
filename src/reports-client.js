// Authenticated correction API. No local demo imports, persistent storage or retries.
export class ReportsError extends Error {
  constructor(code, uncertain = false) { super(code); this.code = code; this.uncertain = uncertain; }
}
const fail = (code, uncertain = false) => { throw new ReportsError(code, uncertain); };
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function normalizeFields(value) {
  if (!value || typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isFinite(Date.parse(value.date + 'T00:00:00Z')) || new Date(value.date + 'T00:00:00Z').toISOString().slice(0,10) !== value.date) fail('BAD_REQUEST');
  const str = (v, max) => { if (typeof v !== 'string' || v.length > max) fail('BAD_REQUEST'); return v.trim(); };
  const num = v => { if (v === null) return null; if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e9 || Math.abs(v*1e6-Math.round(v*1e6)) > 0.0001) fail('BAD_REQUEST'); return v; };
  const result = {date:value.date, customerName:str(value.customerName,120), combustibleKg:num(value.combustibleKg), noncombustibleKg:num(value.noncombustibleKg), otherItem:str(value.otherItem,500), otherFee:num(value.otherFee)};
  if (!result.customerName || (result.combustibleKg === null && result.noncombustibleKg === null && result.otherFee === null && !result.otherItem)) fail('BAD_REQUEST');
  return result;
}
export function normalizeReports(value) {
  if (!value || !Array.isArray(value.records) || value.records.length > 10000 || !Array.isArray(value.conflicts) || typeof value.totalsBlocked !== 'boolean' || typeof value.projectionCurrent !== 'boolean' || typeof value.publicationPending !== 'boolean') fail('INVALID_RESPONSE');
  if (value.ok !== true && !(value.ok === false && value.totalsBlocked && value.conflicts.length)) fail('INVALID_RESPONSE');
  if (value.ok && (!Array.isArray(value.customerNames) || value.customerNames.some(n => typeof n !== 'string' || n.length > 120))) fail('INVALID_RESPONSE');
  const ids = new Set();
  const records = value.records.map(r => {
    if (!r || !uuid(r.id) || ids.has(r.id) || !Number.isSafeInteger(r.revision) || r.revision < 1 || typeof r.deleted !== 'boolean' || typeof r.fingerprint !== 'string' || !r.fingerprint || r.fingerprint.length > 256) fail('INVALID_RESPONSE');
    ids.add(r.id);
    let fields; try { fields = normalizeFields(r.fields); } catch { fail('INVALID_RESPONSE'); }
    return {id:r.id, revision:r.revision, deleted:r.deleted, fingerprint:r.fingerprint, fields};
  });
  return {records, customerNames:value.customerNames || [], blocked:value.totalsBlocked || value.conflicts.length > 0, projectionCurrent:value.projectionCurrent, publicationPending:value.publicationPending};
}
export function makeChange(action, record, fields, operationId = globalThis.crypto.randomUUID()) {
  if (!uuid(operationId) || !['create','update','delete','restore'].includes(action)) fail('BAD_REQUEST');
  const change = {operationId, action};
  if (action !== 'create') {
    if (!record || !uuid(record.id) || !Number.isSafeInteger(record.revision) || typeof record.fingerprint !== 'string') fail('BAD_REQUEST');
    Object.assign(change,{recordId:record.id,expectedRevision:record.revision,expectedFingerprint:record.fingerprint});
  }
  if (action === 'create' || action === 'update') change.fields = Object.freeze(normalizeFields(fields));
  return Object.freeze(change);
}
export function createReportsClient({endpoint, getIdToken, fetchImpl = fetch, timeoutMs = 30000}) {
  const url = new URL(endpoint);
  if (url.origin !== 'https://script.google.com' || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) || url.search || url.hash || typeof getIdToken !== 'function' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw Error('Invalid reports configuration');
  async function request(action, change, {signal} = {}) {
    const writing = action === 'reports.change';
    if (signal?.aborted) fail('ABORTED');
    let token, authTimer, authAbort;
    try {
      const interrupted = new Promise((resolve,reject) => {
        authTimer=setTimeout(()=>reject(Object.assign(new ReportsError('AUTH_TIMEOUT'),{retainPending:true})),timeoutMs);
        authAbort=()=>reject(new ReportsError('ABORTED'));
        signal?.addEventListener('abort',authAbort,{once:true});
      });
      token=await Promise.race([Promise.resolve().then(()=>getIdToken(true)),interrupted]);
    } catch(error) {if(error instanceof ReportsError)throw error;fail('LOGIN_REQUIRED');}
    finally {clearTimeout(authTimer);signal?.removeEventListener('abort',authAbort);} 
    if (typeof token !== 'string' || !token) fail('LOGIN_REQUIRED');
    if (signal?.aborted) fail('ABORTED');
    const controller = new AbortController(), abort = () => controller.abort();
    signal?.addEventListener('abort',abort,{once:true});
    const timer = setTimeout(abort,timeoutMs);
    try {
      const response = await fetchImpl(url.href,{method:'POST',mode:'cors',credentials:'omit',redirect:'follow',cache:'no-store',headers:{'Content-Type':'text/plain;charset=UTF-8'},signal:controller.signal,body:JSON.stringify({action,idToken:token,...(writing ? {change} : {})})});
      if (!response.ok || response.type === 'opaque') fail('TRANSPORT_FAILED',writing);
      const value = await response.json();
      if (value?.ok === false && typeof value.error === 'string') {
        // Only known precommit rejections release an operation. Everything else is uncertain.
        const rejected = ['BAD_REQUEST','UNAUTHENTICATED','FORBIDDEN','AUTH_UNAVAILABLE','BUSY','CONFLICT','NOT_FOUND','SOURCE_CONFLICT','SOURCE_CHANGED','SOURCE_ID_INVALID','CUSTOMER_CHANGED','DUPLICATE','IDEMPOTENCY_CONFLICT','ID_CONFLICT','ROSTER_NOT_CONFIGURED','ROSTER_INVALID'];
        fail(value.error, writing && !rejected.includes(value.error));
      }
      if (!writing) return normalizeReports(value);
      if (value?.ok !== true || value.committed !== true || typeof value.projectionCurrent !== 'boolean' || typeof value.publicationPending !== 'boolean') fail('INVALID_RESPONSE',true);
      return {committed:true,projectionCurrent:value.projectionCurrent,publicationPending:value.publicationPending};
    } catch (error) {
      if (error instanceof ReportsError) throw error;
      fail('TRANSPORT_FAILED',writing);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort',abort); }
  }
  return {readPage: options => request('reports.read',null,options), change: (input,options) => request('reports.change',input,options)};
}
