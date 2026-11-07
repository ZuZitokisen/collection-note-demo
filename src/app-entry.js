// Old browser records are read only when the user explicitly opens the local demo.
export const isLocalMode = search => new URLSearchParams(search).get('mode') === 'local';
if(typeof document!=='undefined') {
 if(isLocalMode(location.search)) await import('./app.js');
 else {const {startLiveWorkspace}=await import('./live-workspace.js');await startLiveWorkspace();}
}
