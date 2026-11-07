import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {getAuth,setPersistence,browserSessionPersistence,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
const endpoint='https://script.google.com/macros/s/AKfycbxhTCY4IWpOh-tEQoS24yXXQYctbpHfB-l5iQObilc1-2Jud2-0bYJFhvpnOzAZ0dF-Wg/exec';
const app=initializeApp({apiKey:'AIzaSyBcjwDYX1YjPXMRYx6ZOI6H0lX26qc8L8w',authDomain:'routenote-38b82.firebaseapp.com',projectId:'routenote-38b82',appId:'1:150886615845:web:807dfafa886208e85ea8cc'},'routenote-sheet-qa');
const auth=getAuth(app);await setPersistence(auth,browserSessionPersistence);auth.languageCode='ja';
const out=document.querySelector('#result'),identity=document.querySelector('#identity');
onAuthStateChanged(auth,u=>identity.textContent=u?'Googleログイン済み: '+u.email:'Googleログインしていません');
async function run(fn){document.querySelectorAll('button').forEach(b=>b.disabled=true);out.textContent='確認中';try{out.textContent=JSON.stringify(await fn(),null,2);}catch(e){out.textContent=e.safeMessage||'処理を確認できませんでした。書込み結果は不明の場合があります。検証タブを確認してください。';}finally{document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function fail(text){const e=new Error();e.safeMessage=text;throw e;}
async function send(action,idToken,nonce){let r;try{r=await fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',redirect:'follow',cache:'no-store',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action,idToken,nonce})});}catch{fail('CORSまたは通信に失敗。書込みの成否は未確認です。');}if(!r.ok||r.type==='opaque')fail('読み取り可能な応答を取得できません。');const b=await r.json();return b;}
async function token(){if(!auth.currentUser)fail('先にGoogleログインしてください。');return auth.currentUser.getIdToken(true);}
document.querySelector('#login').onclick=()=>run(async()=>{await signInWithPopup(auth,new GoogleAuthProvider());return{googleLogin:true};});
document.querySelector('#logout').onclick=()=>run(async()=>{await signOut(auth);return{signedOut:true};});
document.querySelector('#missing').onclick=()=>run(async()=>{const r=await send('whoami','');return{test:'missing-token',rejected:r.ok===false&&r.error==='UNAUTHENTICATED',error:r.error};});
document.querySelector('#forged').onclick=()=>run(async()=>{const r=await send('whoami','fake.forged.signature');return{test:'forged-token',rejected:r.ok===false&&r.error==='UNAUTHENTICATED',error:r.error};});
document.querySelector('#whoami').onclick=()=>run(async()=>{const r=await send('whoami',await token());return{test:'member-auth',verified:r.ok===true,role:r.actor?.role,error:r.error};});
document.querySelector('#write').onclick=()=>run(async()=>{const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');const r=await send('sheetProbe',await token(),nonce);return{test:'synthetic-write-readback',verified:r.ok===true&&r.probe?.nonce===nonce&&r.probe?.writeReadback===true&&r.probe?.businessDataTouched===false,nonce,error:r.error};});
