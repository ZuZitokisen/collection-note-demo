import {createConnectionEntry} from './connection-entry.js';
import {WORKSPACE_CONFIG} from './workspace-config.js';
// Browser-only legacy records are read only in explicit local mode. No automatic migration.
export const isLocalMode=search=>new URLSearchParams(search).get('mode')==='local';
export function createApplicationEntry({doc=globalThis.document,config=WORKSPACE_CONFIG,...options}={}){
 return createConnectionEntry({...options,doc,enabled:config.enabled&&!isLocalMode(doc.defaultView.location.search),endpoint:config.endpoint});
}
let loader;
export function loadApp(options){loader??=createApplicationEntry();return loader(options);}
export function prepareApp(options){loader??=createApplicationEntry();return loader.prepare(options);}
export async function preloadPublicAssets(doc){const {preloadDefaultInvoiceSeal}=await import('./invoice-seal.js');return preloadDefaultInvoiceSeal(doc);}
