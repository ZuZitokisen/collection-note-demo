import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleSession} from '../src/google-session.js';
import {createEntryGate} from '../src/google-entry.js';
const user={uid:'synthetic',email:'synthetic@example.test',emailVerified:true,providerData:[{providerId:'google.com'}]};
const tick=()=>new Promise(r=>setTimeout(r,0));
function setup({actualUser=user}={}){
 let observe,resolve,reject,opens=0,loads=0;
 const session=createGoogleSession({observe(fn){observe=fn;fn(null);return()=>{};},signIn:()=>new Promise((a,b)=>{resolve=a;reject=b;}),signOut:async()=>{observe(null);}});
 session.verifyIdentity=async()=>actualUser?{uid:actualUser.uid}:null;
 const messages=[];const gate=createEntryGate({initialize:async()=>session,loadApp:async()=>{loads++;},online:()=>true,show:s=>messages.push(s.message),open:()=>opens++});
 return {session,gate,messages,observe:v=>observe(v),resolve:v=>resolve(v),reject:v=>reject(v),get opens(){return opens;},get loads(){return loads;}};
}
test('initial null during popup cannot reset pending login; returned credential proceeds through verification',async()=>{const h=setup();await h.gate.start();const p=h.gate.signIn();h.observe(null);assert.equal(h.session.state.status,'signing-in');h.resolve({user});await p;await tick();assert.equal(h.opens,1);assert.equal(h.loads,1);assert.equal(h.session.state.status,'signed-in');h.session.dispose();});
test('successful credential without observer event does not remain stuck',async()=>{const h=setup();await h.gate.start();const p=h.gate.signIn();h.resolve({user});await p;await tick();assert.equal(h.opens,1);h.session.dispose();});
test('normal observed success loads exactly once even when credential also returns',async()=>{const h=setup();await h.gate.start();const p=h.gate.signIn();h.observe(user);h.resolve({user});await p;await tick();assert.equal(h.opens,1);assert.equal(h.loads,1);h.session.dispose();});
test('popup failure remains visible after later null observer notification',async()=>{const h=setup();await h.gate.start();const p=h.gate.signIn();h.reject({code:'auth/popup-closed-by-user'});await p;h.observe(null);assert.equal(h.session.state.user,null);assert.equal(h.session.state.message,'ログインをキャンセルしました。');assert.equal(h.opens,0);h.session.dispose();});
test('invalid, unverified or wrong-provider credential cannot become an identity',async()=>{for(const candidate of [null,{}, {...user,emailVerified:false},{...user,providerData:[{providerId:'password'}]}]){const h=setup();await h.gate.start();const p=h.gate.signIn();h.resolve({user:candidate});await p;await tick();assert.equal(h.opens,0);assert.equal(h.loads,0);assert.equal(h.session.state.user,null);assert.equal(h.session.state.status,'signed-out');h.session.dispose();}});
test('stale credential cannot open app without actual currentUser verification',async()=>{const h=setup({actualUser:null});await h.gate.start();const p=h.gate.signIn();h.resolve({user});await p;await tick();assert.equal(h.opens,0);assert.equal(h.loads,0);assert.match(h.messages.at(-1),/本人確認が完了しませんでした/);h.session.dispose();});
test('genuine signout clears identity and old returned credential cannot restore observed revocation',async()=>{const h=setup({actualUser:null});await h.gate.start();const p=h.gate.signIn();h.observe(user);h.observe(null);h.resolve({user});await p;await tick();assert.equal(h.session.state.user,null);assert.equal(h.opens,0);h.session.dispose();});
test('signout after completed login clears identity normally',async()=>{const h=setup();await h.gate.start();const p=h.gate.signIn();h.resolve({user});await p;await tick();await h.session.signOut();assert.equal(h.session.state.user,null);assert.equal(h.session.state.status,'signed-out');assert.equal(h.session.state.message,'');h.session.dispose();});
test('disposed session ignores late popup result',async()=>{const h=setup();await h.gate.start();const p=h.gate.signIn();h.session.dispose();h.resolve({user});await p;await tick();assert.equal(h.opens,0);assert.equal(h.session.state.user,null);});
test('signout while actual verification awaits cannot open the app',async()=>{
 const h=setup();let finish;h.session.verifyIdentity=()=>new Promise(r=>{finish=r;});await h.gate.start();const p=h.gate.signIn();h.resolve({user});await p;h.observe(null);finish({uid:user.uid});await tick();assert.equal(h.opens,0);assert.equal(h.loads,0);h.session.dispose();
});
test('signout or UID change during app initialization cannot expose the prepared app',async()=>{
 for(const replacement of [null,{...user,uid:'other'}]){
  let observer,finish,opens=0,closed=0;const session=createGoogleSession({observe(fn){observer=fn;fn(null);return()=>{};},signIn:async()=>({user})});session.verifyIdentity=async()=>({uid:user.uid});
  const gate=createEntryGate({initialize:async()=>session,loadApp:()=>new Promise(r=>{finish=r;}),online:()=>true,show:()=>{},open:()=>opens++,close:()=>closed++});await gate.start();await gate.signIn();await tick();observer(replacement);finish();await tick();assert.equal(opens,0);assert.equal(closed,1);session.dispose();
 }
});
test('signout then same UID return during preparation still invalidates the old attempt',async()=>{
 let observer,finish,opens=0;const session=createGoogleSession({observe(fn){observer=fn;fn(null);return()=>{};},signIn:async()=>({user})});session.verifyIdentity=async()=>({uid:user.uid});const gate=createEntryGate({initialize:async()=>session,loadApp:()=>new Promise(r=>{finish=r;}),online:()=>true,show:()=>{},open:()=>opens++});await gate.start();await gate.signIn();await tick();observer(null);observer(user);finish();await tick();assert.equal(opens,0);session.dispose();
});
