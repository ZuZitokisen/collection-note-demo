import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {resolve,dirname,posix} from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const text=path=>readFile(resolve(root,path),'utf8');
const normalize=path=>{const clean=posix.normalize(path.split(/[?#]/)[0]).replace(/^\.\//,'');if(!clean||clean.startsWith('../')||clean.startsWith('/')||clean.includes('\\'))throw Error('Invalid asset path: '+path);return clean;};
export async function buildAssetManifest(){
 const worker=await text('sw.js'),version=JSON.parse(await text('version.json')),updates=await text('src/updates.js');
 const cache=worker.match(/const CACHE = '([^']+)'/)[1],workerVersion=worker.match(/const VERSION = '([^']+)'/)[1];if(version.version!==workerVersion||!updates.includes(`APP_VERSION = '${version.version}'`))throw Error('Version mismatch');
 const assetLiteral=worker.match(/const ASSETS = (\[[\s\S]*?\]);/)[1],precache=[...assetLiteral.matchAll(/'([^']+)'/g)].map(x=>normalize(x[1]));if(new Set(precache).size!==precache.length)throw Error('Duplicate cache path');
 const paths=new Set([...precache,'sw.js','version.json','update.html','update.css','src/recovery.js','operator.html']),edges=[];
 for(const path of paths){
  const content=await text(path);const refs=path.endsWith('.js')?[...content.matchAll(/(?:from\s*|import\s*\()(['"])(\.[^'"]+)\1/g)].map(x=>x[2]):path.endsWith('.html')?[...content.matchAll(/(?:src|href)=["'](\.?\/?[^"'#]+)["']/g)].map(x=>x[1]).filter(x=>!x.includes(':')&&!x.startsWith('//')):[];
  for(const ref of refs){const target=normalize(posix.join(posix.dirname(path),ref));edges.push({from:path,to:target});paths.add(target);}
 }
 // Recovery intentionally bypasses cache; all main-app relative JS imports must be cached.
 for(const edge of edges.filter(x=>x.from.endsWith('.js')&&x.from!=='src/recovery.js'&&x.from!=='src/operator-page.js'))if(!precache.includes(edge.to))throw Error('Missing precache dependency: '+edge.to);
 const assets=[];for(const path of [...paths].sort()){const bytes=await readFile(resolve(root,path));assets.push({path,sha256:createHash('sha256').update(bytes).digest('hex')});}
 return{manifest:{version:version.version,cacheName:cache,assets},audit:{generatedAt:new Date().toISOString(),published:false,defaultCloudEnabled:/enabled\s*:\s*true/.test(await text('src/workspace-config.js')),sourceRoot:root,edges}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const result=await buildAssetManifest();if(process.argv[2]){const output=resolve(process.argv[2]);await writeFile(output,JSON.stringify(result.manifest,null,2)+'\n');await writeFile(output+'.audit.json',JSON.stringify(result.audit,null,2)+'\n');}console.log(`PASS ${result.manifest.version} ${result.manifest.cacheName}: ${result.manifest.assets.length} raw-byte SHA256 assets; import/precache closure verified; candidate cloud entry configured (not deployed)`);}
