// Derived calculation view only. Never pass this view to record editors or save commands.
const clone=value=>structuredClone(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
// Match backend canonical decimal acceptance; multiplying floats by 1e6 loses precision.
const rate=value=>value===null||typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1e9&&/^\d+(?:\.\d{1,6})?$/.test(String(value));
const origins=['legacy-sheet','legacy-report-api','direct-sheet-sync'];
export function legacyReferenceView(state,context,sourceFingerprint){
 const result={state:clone(state),applied:[],basis:null};
 if(context==null)return result;
 if(context.schemaVersion!==1||context.basis!=='current-source-sheet'||context.historicalRatesVerified!==false||context.formalTotalsVerified!==false||!hash(context.sourceFingerprint)||context.sourceFingerprint!==sourceFingerprint||!Array.isArray(context.records)||!Array.isArray(context.unavailable))return result;
 const ids=new Set(),unavailable=new Set();
 for(const entry of context.unavailable){if(!entry||typeof entry.recordId!=='string'||typeof entry.reason!=='string'||unavailable.has(entry.recordId))return result;unavailable.add(entry.recordId);}
 for(const entry of context.records){if(!entry||typeof entry.recordId!=='string'||typeof entry.customerId!=='string'||ids.has(entry.recordId)||unavailable.has(entry.recordId)||!rate(entry.combustibleRate)||!rate(entry.noncombustibleRate))return result;ids.add(entry.recordId);}
 // Validate the entire context before applying any field, so malformed later rows cannot partially apply.
 for(const entry of context.records){
  const matches=state.records.filter(record=>record.id===entry.recordId);if(matches.length!==1)return result;
  const record=matches[0];if(record.deleted||record.customerId!==entry.customerId||!origins.includes(record.provenance?.origin)||typeof record.provenance.sourceRecordId!=='string'||!record.provenance.sourceRecordId||record.billingProvenance)return result;
  for(const category of ['combustible','noncombustible'])if(entry[category+'Rate']!==null&&record[category+'Rate']!==null)return result;
 }
 for(const entry of context.records){const record=result.state.records.find(row=>row.id===entry.recordId);for(const category of ['combustible','noncombustible']){const key=category+'Rate';if(entry[key]!==null){record[key]=entry[key];result.applied.push({recordId:record.id,category});}}}
 if(result.applied.length){result.basis='current-source-sheet';result.state.referenceCalculation={basis:result.basis,historicalRatesVerified:false,formalTotalsVerified:false,applied:clone(result.applied)};}
 return result;
}
